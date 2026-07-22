"""Run the ACTUAL pretrained TabPFN v1 as the predictor in the locality demo.

slides/interactive/locality-bias.html contrasts a model's prediction on the
original data set D_n against its prediction on D~_n, where every label farther
than eps_n from the query is resampled from an adversarial constant phi~ = 0.9.
The gap between the two curves is the Definition's

    | q(y | x, D_n) - q(y | x, D~_n) |

and locality asks it to vanish. The window smoothers in that file are computed
analytically in JavaScript; this script adds the real thing — the pretrained
TabPFN v1 checkpoint, with its default settings, used as q_theta.

The context pool is the SAME pool the page draws: mulberry32(20240733) is ported
bit-exactly from the JS, so the sample dots on screen really are the rows TabPFN
was fitted on.

Because eps_n is measured FROM THE QUERY POINT, D~_n differs per query, so the
scrambled curve costs one fit per (n, query) pair. The original curve needs only
one fit per n. Variance is Monte-Carlo over independent data sets (there is no
closed form for a transformer), matching core/bias_variance.py in spirit.

Run from src/tabpfn_v1:  uv run generate_locality_predictions.py --device cuda:0
Writes: slides/interactive/data/locality_tabpfn.js  (window.LOCALITY_TABPFN)
"""
import argparse
import json
import os
import time

import numpy as np
import tabpfn

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.normpath(
    os.path.join(HERE, "..", "..", "slides", "interactive", "data", "locality_tabpfn.js")
)

# ---- constants mirrored EXACTLY from locality-bias.html ----
POOL_SEED = 20240733
N_POOL = 10000
# X ~ Uniform[X_MIN, X_MAX]: 1.8 periods of p0 (period 1), so the target's
# periodicity is visible on the page. Mirrored from locality-bias.html.
X_MIN, X_MAX = 0.0, 1.8
X_SPAN = X_MAX - X_MIN
P_TILDE = 0.9
EPS0, EPS_MIN, EPS_MAX = 0.20, 0.02, 0.40
N_REF = 40

N_GRID = [20, 32, 50, 80, 126, 200, 316, 500, 800, 1265, 2000, 3162]
QUERY_PTS = 121           # resolution of the two traces (over the wider support)
VAR_REPLICATES = 20       # independent data sets per n for the variance estimate
VAR_GRID = X_MIN + X_SPAN * np.linspace(0.08, 0.92, 25)

# x* grid for the measured attention window — matches the page's x-slider
# (min 0.05, max 1.75, step 0.01) so the page needs no interpolation.
XW_MIN, XW_STEP, XW_COUNT = 0.05, 0.01, 171
XW_GRID = XW_MIN + XW_STEP * np.arange(XW_COUNT)
XW_QUANTILES = (0.5, 0.9)   # attention-mass levels defining the window

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


def eps_n(n):
    return float(np.clip(EPS0 * (N_REF / n) ** (1 / 9), EPS_MIN, EPS_MAX))


def build_pool():
    """Same draw order as the JS loop, so the pools are identical."""
    r = mulberry32(POOL_SEED)
    x = np.empty(N_POOL)
    y = np.empty(N_POOL, dtype=int)
    alt = np.empty(N_POOL, dtype=int)
    for i in range(N_POOL):
        xi = X_MIN + r() * X_SPAN
        x[i] = xi
        y[i] = 1 if r() < p0(xi) else 0
        alt[i] = 1 if r() < P_TILDE else 0
        r()                      # poolJit — drawn in the JS, keeps the stream aligned
    return x, y, alt


def predict_p1(clf, X, y, Q):
    """P(y=1) at the rows of Q. Degenerate single-class contexts have no TabPFN
    prediction; fall back to the constant that context implies."""
    u = np.unique(y)
    if len(u) < 2:
        return np.full(len(Q), float(u[0]))
    clf.fit(X.reshape(-1, 1).astype(np.float32), y, overwrite_warning=True)
    proba = clf.predict_proba(Q.reshape(-1, 1).astype(np.float32))
    j = list(clf.classes_).index(1)
    return proba[:, j]


def attention_windows(clf, X, Y):
    """Measure the window TabPFN actually attends to, for every x* on XW_GRID.

    Captures the query->context attention of ALL 12 encoder layers (eval tokens
    attend only to train tokens, and never to each other, so all x* can be run in
    ONE forward pass and their rows stay independent). Weights are averaged over
    the 3 ensemble members, the 4 heads and the 12 layers to give one attention
    share per context point, then converted into the smallest symmetric interval
    around x* holding 50% / 90% of that mass.

    This is an attention footprint, not a causal influence measure — it says
    where the model looks, which is the transformer's counterpart of the window
    smoothers' averaging window drawn on the same plot.
    """
    layers = clf.model[2].transformer_encoder.layers
    grabbed, originals = [], []
    nq = len(XW_GRID)

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
        clf.predict_proba(XW_GRID.reshape(-1, 1).astype(np.float32))
    finally:
        for mha, orig in originals:
            mha.forward = orig

    per_layer = np.stack(grabbed)                         # (n_layers, nq, n)
    # row 0 = mean over all layers, rows 1.. = each layer on its own. The layers
    # disagree a lot (layer 0 anchors on a single FAR point, layers 1.. are the
    # local ones), so the page lets you step through them.
    maps = np.concatenate([per_layer.mean(axis=0, keepdims=True), per_layer], axis=0)

    halves = {ql: np.empty((maps.shape[0], nq)) for ql in XW_QUANTILES}
    for i, xq in enumerate(XW_GRID):
        d = np.abs(X - xq)
        order = np.argsort(d)
        ds = d[order]
        for k in range(maps.shape[0]):
            a = maps[k, i]
            cum = np.cumsum(a[order] / a.sum())
            for ql in XW_QUANTILES:
                halves[ql][k, i] = ds[min(np.searchsorted(cum, ql), len(ds) - 1)]
    return halves


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", default="cuda:0" if os.environ.get("CUDA_VISIBLE_DEVICES", "0") else "cpu")
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    clf = tabpfn.TabPFNClassifier(device=args.device)   # default settings
    poolX, poolY, poolAlt = build_pool()
    Q = np.linspace(X_MIN, X_MAX, QUERY_PTS)
    rng = np.random.default_rng(12345)

    out = {}
    t_all = time.time()
    for n in N_GRID:
        t0 = time.time()
        eps = eps_n(n)
        X, Y, ALT = poolX[:n], poolY[:n], poolAlt[:n]

        # --- original labels: one fit, all queries at once ---
        orig = predict_p1(clf, X, Y, Q)

        # --- scrambled far labels: eps is measured from each query, so the
        #     data set changes per query -> one fit each ---
        scr = np.empty(QUERY_PTS)
        for j, q in enumerate(Q):
            far = np.abs(X - q) > eps
            Yt = np.where(far, ALT, Y)
            scr[j] = predict_p1(clf, X, Yt, np.array([q]))[0]

        # --- variance over independent data sets from the same DGP ---
        preds = np.empty((VAR_REPLICATES, len(VAR_GRID)))
        for r_i in range(VAR_REPLICATES):
            xs = X_MIN + rng.random(n) * X_SPAN
            ys = (rng.random(n) < p0(xs)).astype(int)
            preds[r_i] = predict_p1(clf, xs, ys, VAR_GRID)
        var = float(preds.var(axis=0, ddof=0).mean())

        # --- the window the model actually attends to, per x* ---
        halves = attention_windows(clf, X, Y)

        out[n] = {"orig": orig, "scr": scr, "var": var, "eps": eps, "halves": halves}
        print(f"  n={n:5d}  eps={eps:.3f}  var={var:.3e}  "
              f"gap@0.75={abs(np.interp(0.75, Q, orig) - np.interp(0.75, Q, scr)):.3f}  "
              f"attn(mean) h50={halves[0.5][0].mean():.3f} h90={halves[0.9][0].mean():.3f}  "
              f"| layer0 h50={halves[0.5][1].mean():.3f}  "
              f"layers1+ h50={halves[0.5][2:].mean():.3f}  "
              f"({time.time() - t0:.1f}s)")

    print(f"total {time.time() - t_all:.1f}s")

    payload = {
        "nGrid": N_GRID,
        "queryPts": QUERY_PTS,
        "orig": {str(n): [round(float(v), 5) for v in out[n]["orig"]] for n in N_GRID},
        "scr": {str(n): [round(float(v), 5) for v in out[n]["scr"]] for n in N_GRID},
        "var": {str(n): out[n]["var"] for n in N_GRID},
        # measured attention window, per n, per x*. Each entry is a list of rows:
        # row 0 = mean over layers, rows 1..nLayers = individual encoder layers.
        "win": {
            "xMin": XW_MIN, "xStep": XW_STEP, "xCount": XW_COUNT,
            "nLayers": int(out[N_GRID[0]]["halves"][0.5].shape[0]) - 1,
            "h50": {str(n): [[round(float(v), 3) for v in row]
                             for row in out[n]["halves"][0.5]] for n in N_GRID},
            "h90": {str(n): [[round(float(v), 3) for v in row]
                             for row in out[n]["halves"][0.9]] for n in N_GRID},
        },
        "meta": {
            "source": "TabPFN v1 (tabpfn==0.1.11), pretrained checkpoint, default settings",
            "pool": f"mulberry32({POOL_SEED}) on [{X_MIN}, {X_MAX}] — identical to locality-bias.html",
            "p0": "0.5 + 0.4*sin(2*pi*x)", "p_tilde": P_TILDE,
            "eps_n": "clip(0.20*(40/n)^(1/9), 0.02, 0.40)",
            "var": f"Monte-Carlo over {VAR_REPLICATES} independent data sets, "
                   f"averaged over {len(VAR_GRID)} interior query points",
            "win": "smallest symmetric interval around x* holding 50%/90% of the "
                   "query->context attention mass, averaged over 3 ensemble "
                   "members, 4 heads and all 12 encoder layers, on D_n",
        },
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        f.write("/* Generated by src/tabpfn_v1/generate_locality_predictions.py — do not edit by hand.\n")
        f.write("   Real pretrained TabPFN v1 predictions for the locality demo. */\n")
        f.write("window.LOCALITY_TABPFN = ")
        json.dump(payload, f, separators=(",", ":"))
        f.write(";\n")
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
