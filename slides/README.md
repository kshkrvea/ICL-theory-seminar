# Slides — Prior-Data Fitted Networks

Beamer deck for the *[s26] Theoretical Foundations of Amortization, Meta-, and In-Context Learning* seminar.

## Build

| Command | Output | Contents |
| --- | --- | --- |
| `make` | `main.pdf` | Talk deck — clean, no notes, hidden slides skipped |
| `make notes` | `main-notes.pdf` | Review copy — notes as extra pages + hidden slides revealed |
| `make present` | `main-present.pdf` | Dual-screen deck for pdfpc — each page is `slide \| note` |
| `make clean` | — | Remove LaTeX build artifacts |

## Present

Dual-screen presenter mode with [pdfpc](https://pdfpc.github.io/): the **projector shows
only the slide**, your **laptop shows the slide, its speaker notes, the next slide, and a
timer**. Overlays stay live, so `\note<n>{...}` notes track each build.

```bash
make present
pdfpc --notes=right main-present.pdf
```

Install pdfpc with `apt install pdfpc` (Debian/Ubuntu) or `brew install pdfpc` (macOS).
For a plain fullscreen slideshow with no notes, open `main.pdf` in any PDF viewer and
enter full-screen mode.
