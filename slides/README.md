# Prior-Data Fitted Networks — HTML slides

reveal.js deck (modern light theme, 16:9). It replaced the original LaTeX
Beamer deck it was ported from (recoverable from git history); content,
slide order and overlay steps still mirror that origin, with the
step-by-step PDF figure flips replaced by **interactive** visualizations.

Live at **https://kshkrvea.github.io/ICL-theory-seminar/** — this directory
is published as-is by `.github/workflows/pages.yml` on every push to `main`
that touches `slides/` (no build step; `index.html` becomes the site root).

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
Inter and three.js are pinned CDN builds).

## Controls

There are **no on-screen arrows** (`controls: false` in `js/loader.js`) —
deliberately, so nothing competes with the slide content. The keyboard and
the corner slide number are the interface:

| | | where it comes from |
| --- | --- | --- |
| `→` / `Space`, `←` | next overlay step or slide, back (swipe on touch) | reveal defaults |
| `Esc` | overview grid; also closes an open pop-up or the section menu | `js/loader.js` |
| `S` | speaker view — timer, next slide, notes (opens a **pop-up window**: allow pop-ups for the site) | `RevealNotes`, loaded in `index.html` |
| `?` | all shortcuts | reveal default |
| any digit, then `↵` | jump to a slide | `js/loader.js` |
| click the slide number | section menu | `js/loader.js` |

- **Jump to a slide**: just type its number and press `↵` — the number is
  the one printed in the bottom-right corner (`12 ↵` → slide 12). `Esc`
  cancels. (reveal's own `G` opens the same box; the deck additionally
  lets any digit open it, PowerPoint-style. Typing a word instead of a
  number jumps to the first slide containing it.)
- **Jump to a section**: click the slide number in the corner — a
  translucent list of the sections drops up; clicking one goes to that
  section's divider slide. The section you are in is highlighted.
- **Interactive slides.** The `interactive/*.html` visualizations (BNN
  prior, SCM prior, Theorem 3.1, …) are embedded *inline* in the slide as
  `<iframe data-src=…>`, so reveal lazy-loads them as you approach. Click
  the controls inside the frame; click *outside* the frame to give
  keyboard focus back to the deck before pressing `→` or typing a number
  (while the focus is inside an iframe, the keys go to the iframe).
- **Audience-Q&A pop-ups.** The circled `?` buttons (`.audience-qa`, seven
  of them, all in `statistical_foundations.html`) open a text overlay with
  an answer to a question the audience tends to ask — separate from
  speaker notes. `Esc`, the `×`, or a backdrop click closes it; while it
  is open reveal's keyboard nav is off.
- **Deep links**: `hash: true`, so the URL tracks the current slide and
  `…/#/12` is shareable.

> Note: `js/loader.js` also carries a generic click-to-open iframe pop-up
> (`data-modal-src`) and `css/theme.css` a matching `.viz-hint` style, but
> **no slide uses them any more** — the theorem slides embed their viz
> inline instead. Both are dead code kept for reuse; the comment at
> `sections/statistical_foundations.html:635` claiming `sf-approx` still
> uses it is stale.

## Layout

| file                    | role                                        |
| ----------------------- | ------------------------------------------- |
| `index.html`            | thin shell; title page; library/script tags |
| `js/loader.js`          | section order, TOC + section dividers, overlay-state helper, reveal config |
| `sections/*.html`       | one file per section                        |
| `js/figures.js`         | TikZ-replacement SVG figures (original coordinates & colors) |
| `js/cite.js`            | `.bib`-driven citations (see below)         |
| `references.bib`        | curated BibTeX entries for everything the deck (will) cite |
| `css/theme.css`         | deck theme (palette, type scale, frame head, blocks, chrome) |
| `css/figures.css`       | image placement knobs `--img-w`/`--img-x`/`--img-y` |
| `interactive/*.html`    | self-contained visualizations embedded via iframes |
| `assets/**`             | static images (high-res renders of the source-paper figures, PNGs) |

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
- **Theme**: body/UI text is Inter (sans); math stays in KaTeX's LaTeX
  font. On slides with a `frame-subtitle`, the `frame-title` (section
  name) renders as a small uppercase kicker and the subtitle becomes the
  headline — pure CSS (`:has()`), the markup keeps title-then-subtitle
  order. Palette and type scale live in the `:root` block of
  `css/theme.css`.
- **Figure resolution**: raster figures taken from papers are re-rendered
  from the source-paper PDFs at ≥2× their largest on-screen size on a 4K
  display (target ≈5000–7000 px wide). If you add a figure, size it the
  same way — reveal renders the deck at viewport scale 1, so an image
  displayed at fraction `w` of the slide width needs
  `≥ 2 × w × 0.925 × 3840` source pixels to stay sharp on 4K.
- **Citations**: cite a paper with
  `<span class="cite" data-cite="bibKey"></span>` (comma-separate
  multiple keys). At load, `js/cite.js` parses `references.bib`, numbers
  the cited entries by first appearance in the deck, fills each marker
  with `[n]`, and generates the References slide
  (`sections/conclusion.html`) — nothing to renumber by hand. Uncited
  `.bib` entries are held for future slides and don't appear anywhere.
  A *section's* paper is declared as `cite:` on its entry in the
  `SECTIONS` list (`js/loader.js`), not inside the TOC label: the marker
  is then rendered only on that section's own divider slide, so the paper
  is not re-cited on the main Outline or on the other eight dividers.
