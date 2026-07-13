# Prior-Data Fitted Networks — HTML slides

reveal.js deck (metropolis look, 16:9). It replaced the original LaTeX
Beamer deck it was ported from (recoverable from git history); content,
slide order and overlay steps still mirror that origin, with the
step-by-step PDF figure flips replaced by **interactive** visualizations.

## Serve

The deck fetches its section fragments at runtime, so it needs an HTTP
server (opening `index.html` via `file://` will not work):

```bash
cd slides
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
- On the interactive slides (BNN prior, SCM prior, Theorem 3.1, …)
  click the controls inside the frame; click *outside* the frame to give
  keyboard focus back to the deck before pressing `→`.

## Layout

| file                    | role                                        |
| ----------------------- | ------------------------------------------- |
| `index.html`            | thin shell; title page; library/script tags |
| `js/loader.js`          | section order, TOC + section dividers, overlay-state helper, reveal config |
| `sections/*.html`       | one file per section                        |
| `js/figures.js`         | TikZ-replacement SVG figures (original coordinates & colors) |
| `js/cite.js`            | `.bib`-driven citations (see below)         |
| `references.bib`        | curated BibTeX entries for everything the deck (will) cite |
| `css/theme.css`         | metropolis-like theme                       |
| `css/figures.css`       | image placement knobs `--img-w`/`--img-x`/`--img-y` |
| `interactive/*.html`    | self-contained visualizations embedded via iframes |
| `assets/**`             | static images (converted PDFs, PNGs)        |

Every file carries HOW-TO-ADJUST comments — look at the header of the
thing you want to tweak.

## Conventions worth knowing

- **Slide geometry**: 1280×720 px = the Beamer 16×9 cm page at 80 px/cm,
  so 1 cm from the original LaTeX sources = 80 px here. `--img-y` flips
  sign vs `\imgy` (CSS y grows downward); each slide's comment records
  the original value.
- **Overlays**: Beamer `\only`/`\alt` restyling is driven by fragments
  carrying `data-slide-class` (see the header of `js/loader.js`);
  image flips use reveal's `r-stack` fade-out/current-visible recipe.
- **Citations**: cite a paper with
  `<span class="cite" data-cite="bibKey"></span>` (comma-separate
  multiple keys). At load, `js/cite.js` parses `references.bib`, numbers
  the cited entries by first appearance in the deck, fills each marker
  with `[n]`, and generates the References slide
  (`sections/conclusion.html`) — nothing to renumber by hand. Uncited
  `.bib` entries are held for future slides and don't appear anywhere.
