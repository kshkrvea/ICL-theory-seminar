# Prior-Data Fitted Networks — HTML slides

reveal.js port of the Beamer deck in [`../slides`](../slides) (`main.tex`,
metropolis theme, 16:9). Content, slide order, overlay steps and layout
mirror the LaTeX deck; the three step-by-step PDF figure flips are
replaced by the **interactive** visualizations they were exported from.

## Serve

The deck fetches its section fragments at runtime, so it needs an HTTP
server (opening `index.html` via `file://` will not work):

```bash
cd slides-html
python3 serve.py 8000
# open http://localhost:8000
```

`serve.py` is `http.server` with `Cache-Control: no-store` added to every
response. Plain `python -m http.server` sends `Last-Modified` but no
`Cache-Control`/`ETag`, so browsers heuristically cache the section
fragments `loader.js` fetches at runtime — edits to `sections/*.html` can
stop showing up even after a hard reload. Use `serve.py` during editing so
every reload is guaranteed fresh.

Internet access is required at presentation time (reveal.js, KaTeX,
Fira Sans and three.js are pinned CDN builds).

## Controls

- `→` / `Space`: next overlay step / slide; `←` back; `Esc` overview;
  `S` speaker notes window; `?` all shortcuts.
- On the three interactive slides (BNN prior, SCM prior, Theorem 3.1)
  click the controls inside the frame; click *outside* the frame to give
  keyboard focus back to the deck before pressing `→`.

## Layout (mirrors the LaTeX sources)

| here                    | LaTeX counterpart                          |
| ----------------------- | ------------------------------------------ |
| `index.html`            | `main.tex` (thin shell; title page)        |
| `js/loader.js`          | `\input{sections/...}` order, `\tableofcontents`, `\AtBeginSection` dividers, reveal config |
| `sections/*.html`       | `sections/*.tex` — one file per section    |
| `js/figures.js`         | `figures.tex` (TikZ → SVG, original coordinates & colors) |
| `css/theme.css`         | metropolis theme (dark title bar dropped)  |
| `css/figures.css`       | `\imgwidth`/`\imgx`/`\imgy` image knobs → `--img-w`/`--img-x`/`--img-y` |
| `interactive/*.html`    | adapted copies of the standalone visualizations under `../slides/figures/**` |
| `assets/**`             | `figures/**` (PDFs converted to SVG, PNGs copied) |

Every file carries HOW-TO-ADJUST comments in the spirit of
`figures.tex` — look at the header of the thing you want to tweak.

## Conventions worth knowing

- **Slide geometry**: 1280×720 px = the Beamer 16×9 cm page at 80 px/cm,
  so 1 cm from the LaTeX sources = 80 px here. `--img-y` flips sign vs
  `\imgy` (CSS y grows downward); each slide's comment records the
  original value.
- **Overlays**: Beamer `\only`/`\alt` restyling is driven by fragments
  carrying `data-slide-class` (see the header of `js/loader.js`);
  image flips use reveal's `r-stack` fade-out/current-visible recipe.
- **Citations**: fixed labels `[1]`–`[5]` copied from `main.bbl`
  (plain style); the References slide lists them. If `references.bib`
  changes, update `sections/conclusion.html` and the inline labels.
