# Prior-Data Fitted Networks

Seminar talk for the LMU StaDS MSc course *[s26] Theoretical Foundations of Amortization and Meta-, and In-Context Learning*.

## ▶ [View the slides](https://kshkrvea.github.io/ICL-theory-seminar/)

## Using the slides

The deck shows **no on-screen arrows** by design — the keyboard is the interface:

| | |
| --- | --- |
| `→` `Space` / `←` | next overlay step or slide / back (swipe on touch) |
| type a number, `↵` | jump to that slide — the number printed in the bottom-right corner (`12 ↵` → slide 12). `Esc` cancels |
| click the slide number | section menu drops up; click a section to jump to it |
| `Esc` | overview grid (and closes any open pop-up) |
| `S` | speaker view — timer, next slide, notes (opens a pop-up window) |
| `?` | all shortcuts |

The interactive visualizations (BNN prior, SCM prior, Theorem 3.1, *n* as a regulariser, attention weights, …) are embedded **directly in the slides** — drag and click inside them. The circled **?** buttons open a short answer to a question the audience tends to ask; close with `Esc`, the `×`, or a click outside.

One gotcha: while your focus is *inside* an interactive frame, the keys go to the frame — click outside it to give the deck back its keyboard.

The URL tracks the current slide, so any slide is linkable: [`…/#/12`](https://kshkrvea.github.io/ICL-theory-seminar/#/12).

## Structure

```
src/        experiments and code supporting the talk
slides/     reveal.js (HTML) presentation
```

**`src/`** — experiments reproducing findings from [Statistical Foundations of Prior-Data Fitted Networks](https://arxiv.org/abs/2305.11097). See [src/README.md](src/README.md) for setup and usage.

**`slides/`** — reveal.js deck with interactive visualizations (it replaced the original LaTeX Beamer deck, which remains in git history). It fetches its section fragments at runtime, so it needs an HTTP server rather than `file://`:

```bash
cd slides
python3 serve.py 8000
# open http://localhost:8000
```

See [slides/README.md](slides/README.md) for controls, layout and conventions. Pushes to `main` that touch `slides/` redeploy the hosted copy via [.github/workflows/pages.yml](.github/workflows/pages.yml).

## License

[MIT](LICENSE) for the code and prose. The figures under `slides/assets/` are re-rendered from the papers cited in `slides/references.bib`; they remain the property of their authors and are reproduced here for academic use with attribution.
