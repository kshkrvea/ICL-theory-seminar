Experiments reproducing findings from [Statistical Foundations of Prior-Data Fitted Networks](https://arxiv.org/abs/2305.11097).

Two separate environments cover TabPFN v1 and the latest releases (v2.5, v3). Set each up once with `uv sync`, then run the scripts with `--device` pointing at your GPU.

```bash
# TabPFN v1 (Python 3.11)
cd tabpfn_v1 && uv sync
uv run reproduce_TN_plot.py --device cuda:0

# TabPFN latest — v2.5 or v3 (Python 3.12)
cd tabpfn_latest && uv sync
uv run create_plots_for_other_versions.py v3 --device cuda:0
```

Output plots and predictions are written to `results/`.
