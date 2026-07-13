This is the repo for my seminar talk on **Prior-Data Fitted Networks** for the LMU StaDS MSc course [s26] Theoretical Foundations of Amortization and Meta-, and In-Context Learning.

> **Note:** The slides are still in progress and will be finished by 23 July.

## Structure

```
src/        experiments and code supporting the talk
slides/     reveal.js (HTML) presentation
```

## src/

Experiments reproducing findings from [Statistical Foundations of Prior-Data Fitted Networks](https://arxiv.org/abs/2305.11097). See [src/README.md](src/README.md) for setup and usage.

## slides/

reveal.js deck with interactive visualizations (it replaced the original LaTeX Beamer deck, which remains in git history). Serve it with

```bash
cd slides
python3 serve.py 8000
# open http://localhost:8000
```

See [slides/README.md](slides/README.md) for controls, layout and conventions.
