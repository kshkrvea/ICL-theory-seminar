"""Record WHERE pretrained TabPFN v1 attends, in data space, unmodified.

Companion of generate_locality_predictions.py: it runs the SAME checkpoint on
the SAME 1-d pool that slides/interactive/locality-bias.html draws (the JS PRNG
mulberry32(20240733) is ported bit-exactly), and stores, for every context size
n and every test point x*, the query->context attention weight of each single
context point:

    a_j(x*) = softmax_j( (q(x*) . k_j) / sqrt(head_dim) ),   sum_j a_j = 1

averaged over the 3 default ensemble members and the 4 heads and kept PER ENCODER
LAYER — the map whose 50%/90% mass intervals locality-bias.html already draws as
TabPFN's "attention window". Storing the full map lets
slides/interactive/attention-weights.html plot a_j AT THE POSITION X_j of the
context point it belongs to, so the attention is readable spatially instead of
against a meaningless sample index.

Eval tokens attend only to train tokens and never to each other, so all x* are
run in ONE forward pass per n and their rows stay independent. TabPFN's own
input normalization is fitted on the n context points, so every n is read in its
real operating conditions.

Nothing is rescaled or re-normalized afterwards: the page draws these numbers.

Run from src/tabpfn_v1:  uv run generate_attention_scores.py --device cuda:0
Writes: slides/interactive/data/attention_scores.js  (window.ATTENTION_DATA)
"""
import argparse
import json
import os
import time

import numpy as np
import tabpfn

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.normpath(
    os.path.join(HERE, "..", "..", "slides", "interactive", "data", "attention_scores.js")
)

# ---- constants mirrored EXACTLY from locality-bias.html ----
POOL_SEED = 20240733
N_POOL = 10000
P_TILDE = 0.9

# Context sizes. A subset of locality-bias.html's N_GRID: past a few hundred
# points the bars overlap into a solid block, and the payload grows as n * |x*|.
N_GRID = [20, 32, 50, 80, 126, 200, 316, 500]

# x* grid — the page's x-slider snaps to it.
XQ_MIN, XQ_STEP, XQ_COUNT = 0.05, 0.025, 37
XQ_GRID = XQ_MIN + XQ_STEP * np.arange(XQ_COUNT)
QUANTILES = (0.5, 0.9)     # attention-mass levels defining the h50/h90 windows

# weights below this are stored as exact 0 — a decade under the plot's 1e-4 floor
# (so nothing visible is lost, and the mean over layers shifts by < 1e-6), and
# they dominate the file size otherwise
STORE_FLOOR = 1e-5

MASK = 0xFFFFFFFF


def mulberry32(seed):
    """Bit-exact port of the page's PRNG (verified against the browser)."""
    a = seed & MASK

    def rnd():
        nonlocal a
        a = (a + 0x6D2B79F5) & MASK
        t = ((a ^ (a >> 15)) * (1 | a)) & MASK
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & MASK)) & MASK) ^ t
        return ((t ^ (t >> 14)) & MASK) / 4294967296

    return rnd


def p0(x):
    return 0.5 + 0.4 * np.sin(2 * np.pi * x)


def build_pool():
    """Same draw order as the JS loop, so the pools are identical."""
    r = mulberry32(POOL_SEED)
    x = np.empty(N_POOL)
    y = np.empty(N_POOL, dtype=int)
    for i in range(N_POOL):
        xi = r()
        x[i] = xi
        y[i] = 1 if r() < p0(xi) else 0
        r()                      # poolAlt  — drawn in the JS, keeps the stream aligned
        r()                      # poolJit  — idem
    return x, y


def attention_map(clf, X, Y):
    """(n_layers, len(XQ_GRID), n) query->context attention, mean over ensemble/heads."""
    layers = clf.model[2].transformer_encoder.layers
    grabbed, originals = [], []
    nq = len(XQ_GRID)

    for layer in layers:
        mha = layer.self_attn
        orig = mha.forward
        originals.append((mha, orig))

        def patched(q, k, v, *a, _orig=orig, **kw):
            if q.shape[0] == nq and k.shape[0] != nq:      # the eval-token call
                kw["need_weights"] = True
                kw["average_attn_weights"] = False
                out = _orig(q, k, v, *a, **kw)
                # (batch=ensemble, heads, nq, n) -> (nq, n)
                grabbed.append(out[1].detach().float().mean(dim=(0, 1)).cpu().numpy())
                return out
            return _orig(q, k, v, *a, **kw)

        mha.forward = patched

    try:
        clf.fit(X.reshape(-1, 1).astype(np.float32), Y, overwrite_warning=True)
        clf.predict_proba(XQ_GRID.reshape(-1, 1).astype(np.float32))
    finally:
        for mha, orig in originals:
            mha.forward = orig

    a = np.stack(grabbed)                                  # (n_layers, nq, n)
    # Every layer is kept on its own: they disagree sharply (layer 0 anchors on a
    # single FAR context point while layers 1.. are local and bell-shaped), so the
    # page offers a per-layer picker and computes their mean itself.
    return a / a.sum(axis=2, keepdims=True)


def mass_windows(X, a):
    """Smallest symmetric interval around each x* holding q of the attention mass."""
    out = {ql: np.empty(len(XQ_GRID)) for ql in QUANTILES}
    for i, xq in enumerate(XQ_GRID):
        d = np.abs(X - xq)
        order = np.argsort(d)
        ds = d[order]
        cum = np.cumsum(a[i][order] / a[i].sum())
        for ql in QUANTILES:
            out[ql][i] = ds[min(np.searchsorted(cum, ql), len(ds) - 1)]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", default="cuda:0" if os.environ.get("CUDA_VISIBLE_DEVICES", "0") else "cpu")
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    clf = tabpfn.TabPFNClassifier(device=args.device)      # default settings
    poolX, poolY = build_pool()

    maps, n_layers = {}, None
    t_all = time.time()
    for n in N_GRID:
        t0 = time.time()
        X, Y = poolX[:n], poolY[:n]
        a = attention_map(clf, X, Y)
        maps[n], n_layers = a, a.shape[0]
        am = a.mean(axis=0)
        wm, w0 = mass_windows(X, am), mass_windows(X, a[0])
        print(f"  n={n:5d}  mean of layers: max a={am.max(axis=1).mean():.3f}  "
              f"h50={wm[0.5].mean():.3f} h90={wm[0.9].mean():.3f}   "
              f"layer 0: h50={w0[0.5].mean():.3f}  "
              f"layers 1+: h50={mass_windows(X, a[1:].mean(axis=0))[0.5].mean():.3f}  "
              f"({time.time() - t0:.1f}s)")
    print(f"total {time.time() - t_all:.1f}s")

    def enc(v):
        return 0.0 if v < STORE_FLOOR else float(f"{v:.3g}")

    def encmap(n):
        """w[n][layer][x*][j] — one attention row per (layer, test point)."""
        return [[[enc(v) for v in row] for row in layer] for layer in maps[n]]

    n_max = max(N_GRID)
    payload = {
        "nGrid": N_GRID,
        "xMin": XQ_MIN, "xStep": XQ_STEP, "xCount": XQ_COUNT,
        "nLayers": int(n_layers),
        # the context pool, identical to locality-bias.html's poolX/poolY
        "poolX": [round(float(v), 5) for v in poolX[:n_max]],
        "poolY": [int(v) for v in poolY[:n_max]],
        # w[n][k][i][j] = attention of query XQ_GRID[i] on context point j, in
        # encoder layer k. The page averages over k for its "mean of layers".
        "w": {str(n): encmap(n) for n in N_GRID},
        "meta": {
            "source": "TabPFN v1 (tabpfn==0.1.11), pretrained checkpoint, default settings",
            "pool": f"mulberry32({POOL_SEED}) — identical to locality-bias.html",
            "p0": "0.5 + 0.4*sin(2*pi*x)",
            "quantity": "post-softmax query->context attention weights a_j(x*), "
                        "averaged over 3 ensemble members and 4 heads, "
                        "renormalized to sum 1, kept per encoder layer. "
                        "Unmodified model activations; values < 1e-6 stored as 0.",
        },
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        f.write("/* Generated by src/tabpfn_v1/generate_attention_scores.py — do not edit by hand.\n")
        f.write("   Spatial query->context attention of TabPFN v1 on the locality-bias pool. */\n")
        f.write("window.ATTENTION_DATA = ")
        json.dump(payload, f, separators=(",", ":"))
        f.write(";\n")
    print(f"wrote {args.out}  ({os.path.getsize(args.out) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
