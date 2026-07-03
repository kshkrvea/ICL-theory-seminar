# Slides — Prior-Data Fitted Networks

Beamer deck for the *[s26] Theoretical Foundations of Amortization, Meta-, and In-Context Learning* seminar.

## Build

| Command | Output | Contents |
| --- | --- | --- |
| `make` | `main.pdf` | Talk deck — clean, no notes, hidden slides skipped |
| `make notes` | `main-notes.pdf` | Review copy — hidden slides revealed + speaker notes |
| `make clean` | — | Remove LaTeX build artifacts |

## Present

Presenter view (current slide + speaker notes + timer) with [pdfpc](https://pdfpc.github.io/):

```bash
pdfpc --notes=right main-notes.pdf
```

Install pdfpc with `brew install pdfpc` (macOS) or `apt install pdfpc` (Debian/Ubuntu).
For a plain fullscreen slideshow, open `main.pdf` in any PDF viewer and enter full-screen mode.
