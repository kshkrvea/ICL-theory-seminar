---
name: Beamer to reveal.js migration
overview: Beamer deck migrated to slides-html/ (reveal.js). Initial migration complete; five follow-up polish fixes remain (vector text, architecture SVGs, LaTeX font, Theorem 3.1 layout, BNN/SCM dashboard).
todos:
  - id: scaffold
    content: Scaffold slides-html/ with pinned reveal.js, KaTeX math plugin (16:9), notes plugin, base minimalistic theme (drop dark-green bar), a per-section HTML-fragment loader, and a serve README.
    status: completed
  - id: frame-shell
    content: Mirror the source layout with one HTML file per section (sections/background.html, tabpfn.html, ...) loaded into index.html; create all 45 slides in order incl. title page, TOC, per-section divider Outline slides, empty placeholders, and appendix.
    status: completed
  - id: content-math
    content: Port all text, itemize/enumerate, blocks/alertblocks/theorems, and LaTeX formulas as KaTeX; add macro map; verify every formula renders.
    status: completed
  - id: overlays
    content: Map Beamer overlays (onslide, only, alt, pause, [<+->], alert@) to reveal fragments and in-place restyle fragments, matching original step counts.
    status: completed
  - id: tikz-svg
    content: Re-implement figures.tex TikZ drawings (featurecloud, hypothesis icons, metapanel bar panels) as inline SVG with exact coords, shared fixed bounding box, and original colors.
    status: completed
  - id: images
    content: Convert .pdf figures to SVG, copy .png figures, reproduce imgwidth/imgx/imgy placement + captions, and recreate the magenta highlight rectangles fragment.
    status: completed
  - id: interactive
    content: Adapt bnn.html, scm.html, theorem_3_1.html to fit the slide viewport (strip export chrome, responsive fill, theme match) and embed as full-slide iframes on their mapped slides.
    status: completed
  - id: citations
    content: Reproduce inline citations using labels from main.bbl/main.aux and rebuild the References slide list from references.bib.
    status: completed
  - id: docs
    content: Add HOW-TO-ADJUST comment headers throughout (mirroring figures.tex style) stating which component/knob controls which on-slide element, so the deck stays easily tweakable.
    status: completed
  - id: verify
    content: Serve and diff slide-by-slide against main.pdf for content/order/layout; confirm all 3 interactive embeds load and remain interactive.
    status: completed
  - id: fix-vector-text
    content: "Fix 1+2: Re-convert architecture PDFs with dvisvgm (not pdftocairo); switch body font to Latin Modern; add geometricPrecision text rendering."
    status: in_progress
  - id: fix-theorem-layout
    content: "Fix 4: Restructure sf-ppd-learn slide to side-by-side theorem (42%) + iframe viz (58%) with compact block styling."
    status: pending
  - id: fix-bnn-scm
    content: "Fix 5: Remove Unified Execution Ledger; theme-match buttons; fix scm.html corruption in renderUnifiedCanvas; spread class boundaries evenly on discretization axis."
    status: pending
  - id: fix-final-verify
    content: Serve deck in browser; confirm architecture SVGs render fully, text is crisp, Theorem 3.1 viz has room, BNN/SCM step 6 classes are separated.
    status: pending
isProject: false
---

# Migrate Beamer deck to interactive reveal.js HTML

## Goal & guardrails
Migrate the 45-frame Beamer/metropolis deck rooted at [slides/main.tex](slides/main.tex) into an **reveal.js** HTML deck under a new `slides-html/` directory. Non-negotiables, in priority order:
1. **Content parity** — every title, subtitle, itemize/enumerate, theorem/block, and LaTeX formula reproduced verbatim (math rendered, not screenshotted).
2. **Structure parity** — same section order, same slide order, same overlay/reveal steps, section-divider "Outline" slides, title page, TOC, appendix.
3. **Layout parity** — same relative positions, alignment, columns, and figure placement. The hand-drawn TikZ pieces in [slides/figures.tex](slides/figures.tex) must stay "perfectly aligned".
4. Minimalistic theme is fine: the metropolis **dark green top title bar may be dropped**; match layout/spacing/content over exact colors.

Do NOT alter the LaTeX sources. Treat them as the spec.

## Project structure (mirror the current per-section layout)
Keep the same modular organization the LaTeX deck uses (`main.tex` + `sections/*.tex` + `figures.tex`) — do NOT produce one monolithic `index.html` containing every slide. Instead:
- `slides-html/index.html` is a thin shell (analogous to [main.tex](slides/main.tex)): loads reveal.js, KaTeX, plugins, theme, the figure helpers, then pulls in each section fragment in the same order as [main.tex](slides/main.tex)'s `\input{sections/...}` calls.
- One HTML fragment per section under `slides-html/sections/` mirroring the source file names: `background.html`, `tabpfn.html`, `statistical_foundations.html`, `tabpfnv2.html`, `tabicl.html`, `recent_sota.html`, `connections.html`, `conclusion.html`, `appendix.html`. Each contains only that section's `<section>` slides.
- Load fragments with a tiny loader (fetch each `sections/*.html` and inject into the `.slides` container, then call `Reveal.initialize()`), so the split is real (one editable file per section) rather than a build-time concatenation. Title page + Outline live in `index.html` (or a `sections/frontmatter.html`), matching where they sit in `main.tex`.
- Shared figure code (the re-implemented `figures.tex` helpers) lives in one place, e.g. `slides-html/js/figures.js` + `css/figures.css`, analogous to `figures.tex` being shared across sections.

## Self-documenting code (mirror figures.tex "HOW TO ADJUST" style)
The source already documents every tunable ([slides/figures.tex](slides/figures.tex) has "HOW TO ADJUST" blocks; sections use `\imgwidth`/`\imgx`/`\imgy`/`\imglabel` knobs). Preserve that culture in the HTML deck: every non-trivial component must carry a comment explaining which element it controls and how to adjust it. Concretely:
- At the top of each `sections/*.html`, a short header comment listing the slides it contains and their order.
- For each figure/SVG helper in `js/figures.js`, a comment block (like `\featurecloud`/`\metapanel`) documenting each parameter, the coordinate system, colors, and "increase X to move right / resize" guidance — carry over the intent of the existing TikZ "HOW TO ADJUST" notes.
- For each embedded image, a comment naming the source figure and the CSS knobs that reproduce `\imgwidth`/`\imgx`/`\imgy` (e.g. `--img-w`, `--img-x`, `--img-y` custom properties) so position/size stay one-line tweaks.
- For each interactive iframe, a comment pointing to the adapted source file and what was changed to fit the slide.
- In `index.html`, comments marking the title page, TOC, section-divider mechanism, and the section-load order.

## Tech stack
- **reveal.js** (pin a version; CDN is acceptable since the 3 interactive HTMLs already use CDNs). 16:9 aspect ratio to match `aspectratio=169`.
- **KaTeX** (reveal `math` plugin with KaTeX renderer) for formulas. Verify every macro used renders: `\mathcal, \mathbb, \varphi, \Phi, \arg\max, \xrightarrow, \underbrace, \overset, \propto, \sim, \big\{...\big\}, \displaystyle, \tag`. Add a KaTeX macros map for repeated notation (e.g. `\D`, `\PPhi`).
- **reveal fragments** for overlays; **notes plugin** for `\note{}` content (port speaker notes as an optional but encouraged nicety).
- Overlay mapping: `\onslide<2->{...}` and `\pause` and `[<+->]` -> sequential `.fragment`; `alert@n` (statistical_foundations intro) -> `.fragment .highlight-current` style; `\only<n>{imgA}\only<n+1>{imgB}` image-swap sequences -> stacked `.fragment .current-visible` images (or the interactive iframe where applicable); `\alt<3>{red x}{x}` -> fragment that restyles in place.

## Figures — native re-implementation (no slide screenshots)
- **TikZ vector drawings in [slides/figures.tex](slides/figures.tex)** (`\featurecloud`, `\featurelegend`, `\fixedbbox`, `\hypLinA/B`, `\hypCurve`, `\hypWiggly`, `\metapanel`): re-implement as **inline SVG** (or a small reusable JS/SVG helper) using the exact coordinates in the file (they are already numeric). Preserve the shared coordinate box so the feature-space plot does not "jump" between the Statistical Model and SL Framework slides (this is the purpose of `\fixedbbox`). Reuse the color definitions: `class0=rgb(56,142,60)`, `class1=rgb(81,45,168)`, `hlA=rgb(216,27,96)`, `hlB=rgb(230,81,0)`, `testred=rgb(198,40,40)`.
- **`.pdf` figures** (`figures/tabpfn/architecture/tabpfn-v1-*.pdf`, `figures/tabpfn-v2/*.pdf`): convert to **SVG** (`pdf2svg` or `dvisvgm --pdf` or Inkscape) and embed as `<img>`/inline SVG so they stay crisp. Keep same on-slide sizing (`width` fraction) and the vertical nudge (`\imgy`).
- **`.png` figures** (background, performance, ensembling, prior-data, tabicl, appendix hp-priors): copy as-is; reproduce the `\imgwidth`/`\imgx`/`\imgy` placement with CSS. Re-create the magenta highlight rectangles on the `performance-complex-tasks` slide (`tabpfn.tex` `\only<2>`) as an SVG/CSS overlay appearing on fragment 2.
- **Captions** (`\imglabel`, `\caption`) become a centered `<figcaption>` under the image at the same relative offset.
- The BNN/SCM step `.pdf`s are **superseded** by the interactive embeds below; do not convert them (optionally keep first step as a static fallback).

## The 3 interactive visualizations (the whole point)
Embed as **full-slide iframes, adapted to fit the reveal slide viewport** (user explicitly wants them modified to fit, not just dropped in). For each source file, create an adapted copy under `slides-html/interactive/` and:
- Strip standalone-page chrome that does not fit a slide: page margins, PDF/SVG export buttons and their CDN scripts (`jspdf`, `svg2pdf`) in `bnn.html`/`scm.html`, oversized `max-width:1450px` containers.
- Make the layout responsive to the iframe box (fill 100% width/height, scale controls panel down) and match the deck's minimalistic light theme.
- Keep all interactivity (three.js OrbitControls for `theorem_3_1.html`; sliders/controls + SVG render for `bnn`/`scm`).
- Mapping to slides:
  - [figures/tabpfn/bnn/bnn.html](slides/figures/tabpfn/bnn/bnn.html) -> TabPFN "Bayesian Neural Networks Prior" slide (replaces the 8-step PDF flip in [tabpfn.tex](slides/sections/tabpfn.tex)).
  - [figures/tabpfn/scm/scm.html](slides/figures/tabpfn/scm/scm.html) -> TabPFN "Structural Causal Models Prior" slide (replaces the 8-step SCM PDF flip).
  - [figures/statistical_foundations/theorem_3_1.html](slides/figures/statistical_foundations/theorem_3_1.html) -> statistical_foundations "When PPDs can Learn" (Theorem 3.1) slide; keep the Theorem 3.1 block text and add/adjust the interactive 3D viz to fit alongside or below it.

## Slide inventory / order to reproduce
1. Title page ([main.tex](slides/main.tex): `\titlepage`) — title "Prior-Data Fitted Networks", subtitle "[s26] Theoretical Foundations of Amortization and Meta-, and In-Context Learning", author "Egor Kashkarov", date.
2. Outline (TOC of the 8 sections).
3. A section-divider "Outline" slide before each `\section` (current section highlighted, others dimmed) — reproduce the `\AtBeginSection` behavior.
4. Sections in order: Background (8 frames, [background.tex](slides/sections/background.tex), heavy overlays + TikZ), TabPFN (11 frames, [tabpfn.tex](slides/sections/tabpfn.tex), images + 2 interactive), Statistical Foundations (10 frames, [statistical_foundations.tex](slides/sections/statistical_foundations.tex), 1 interactive + Theorem 3.1 block; 7 are empty placeholders), TabPFNv2 (3 frames), TabICL (3 frames), SOTA (2 empty frames), Connections (3 empty frames), Conclusion + References ([conclusion.tex](slides/sections/conclusion.tex)).
5. Appendix ([appendix.tex](slides/sections/appendix.tex)) — 1 frame, kept out of TOC, placed after the end.
- **Empty placeholder frames** (`% content`) are recreated as title+subtitle-only slides to preserve exact structure.

## Citations
`\cite{...}` keys resolve against the 312 KB [slides/references.bib](slides/references.bib). Since the rendered deck already resolved them (see `main.bbl`), reuse the numbered citation labels from `main.bbl`/`main.aux` as inline superscript/bracket citations, and reproduce the "References" slide list. Do not re-run a full bibliography engine unless needed.

## Deliverables & verification
- New `slides-html/` with a thin `index.html` shell, one fragment per section under `sections/` (mirroring the source file names), `css/`, `js/` (shared SVG figure helpers), `interactive/` (3 adapted apps), `assets/` (converted SVGs + copied PNGs), and a short README with a serve command (`python -m http.server`).
- Code is self-documenting throughout: HOW-TO-ADJUST comments on every section file, figure helper, image knob, and interactive embed, in the spirit of [slides/figures.tex](slides/figures.tex).
- Verify against [slides/main.pdf](slides/main.pdf) (99 rendered pages incl. overlays) slide-by-slide for content/order/layout, and confirm each of the 3 interactive embeds loads and is usable inside its slide.

---

## Current state (post-initial migration)

The initial migration to `slides-html/` is **done** (untracked in git). Verified via headless Firefox: 53 reveal slides, overlays, KaTeX, BNN/SCM interactivity. **Not yet committed.**

A follow-up polish pass was started after user review but **interrupted mid-fix**. Status:

| Fix | Status |
|-----|--------|
| 1. Fuzzy text → vector | **Partial** — root cause identified; font + SVG conversion fixes drafted but not applied to CSS/HTML |
| 2. Architecture SVGs incomplete | **Done** — all 7 architecture PDFs re-converted with `dvisvgm --pdf` (0 `<image>` tags, pure `<path>` vectors). Debug files removed. |
| 3. LaTeX body font | **Pending** — still Fira Sans in `index.html` / `theme.css` |
| 4. Theorem 3.1 cramped layout | **Pending** — still stacked vertically |
| 5. BNN/SCM ledger + buttons + class overlap | **Pending** — ledger still present; **`interactive/scm.html` is corrupted** (entire page `<style>` block pasted inside `renderUnifiedCanvas` SVG `<defs>` at line ~518) |

---

## Follow-up fixes — implementation instructions

Execute in **agent mode** (plan mode blocks non-markdown edits). Delete any leftover debug files: `slides-html/_cmp.html`, `slides-html/pdftocairo-encode.svg`, `slides-html/dvisvgm-encode.svg`, `slides-html/mutool-encode1.svg` (already removed if absent).

### Fix 1+2: Crisp vector text and architecture figures

**Root cause:** `pdftocairo -svg` embeds masked content as raster `<image>` elements with a color-removal filter, causing blur and missing components. `dvisvgm --pdf` produces pure vector paths.

**Already done** — re-run if assets are stale:
```bash
cd slides
for pdf in figures/tabpfn/architecture/tabpfn-v1-{encode,attention,mlp}.pdf \
           figures/tabpfn-v2/tabpfn-v2-{encode,within-rows-attention,inter-rows-attention,mlp}.pdf; do
  rel="${pdf#figures/}"; rel="${rel%.pdf}.svg"
  dvisvgm --pdf --output="../slides-html/assets/$rel" "$pdf"
done
```

**Still needed in CSS:**
- [slides-html/css/theme.css](slides-html/css/theme.css): add `text-rendering: geometricPrecision` and antialiasing on `.reveal`.
- [slides-html/css/figures.css](slides-html/css/figures.css): add `shape-rendering: geometricPrecision` on `.page-fig img`.

### Fix 3: Standard LaTeX body font (Latin Modern Roman)

In [slides-html/index.html](slides-html/index.html), **replace** the Fira Sans Google Fonts link with:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/lmroman10@5.2.5/400.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/lmroman10@5.2.5/700.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/lmroman10@5.2.5/400-italic.css">
```

In [slides-html/css/theme.css](slides-html/css/theme.css):
```css
.reveal {
  font-family: 'LM Roman 10', 'Latin Modern Roman', 'Computer Modern', 'CMU Serif', Georgia, serif;
}
```

Also update `font-family` in `interactive/bnn.html`, `interactive/scm.html`, `interactive/theorem_3_1.html` to match.

KaTeX math already uses Computer Modern-like glyphs — no change needed there.

### Fix 4: Theorem 3.1 slide — give the viz more room

In [slides-html/sections/statistical_foundations.html](slides-html/sections/statistical_foundations.html), restructure `#sf-ppd-learn` from **vertical stack** to **side-by-side flex**:

- Left column (~42%): support line + Theorem 3.1 block with `.scriptsize` / `.theorem-compact` (reduced block-title/block-body padding, smaller `.katex-display` margins).
- Right column (~58%): iframe in `.theorem-viz-frame` with `width/height:100%`, bordered, `min-height:0` so it fills remaining slide height below the frame head.

Add scoped CSS in the section's `<style>` block documenting the split ratio knobs (`flex: 0 0 42%` / `flex: 1 1 58%`).

Optional: in [slides-html/interactive/theorem_3_1.html](slides-html/interactive/theorem_3_1.html), slightly shrink `#ui-container` and `.label-card` since the iframe is now narrower.

### Fix 5: BNN and SCM interactive dashboards

**Files:** [slides-html/interactive/bnn.html](slides-html/interactive/bnn.html), [slides-html/interactive/scm.html](slides-html/interactive/scm.html)

#### 5a. Remove Unified Execution Ledger
- Delete the HTML block:
  ```html
  <div class="control-group">
    <label>Unified Execution Ledger</label>
    <div id="status" class="status-box">...</div>
  </div>
  ```
- Remove `.status-box` CSS and `const statusBox = ...`.
- Replace `logToLedger(...)` with a no-op `function logToLedger() {}` (keeps step handlers unchanged).
- Remove `.control-group:last-child { flex: 1; ... }` — no longer needed.

#### 5b. Theme-match buttons
Use deck palette from `theme.css`:
```css
:root { --mDarkTeal: #23373b; --mAlert: #eb811b; --mDarkTealHover: #1a292c; }
button { background: var(--mDarkTeal); border-color: var(--mDarkTeal); }
button:hover:not(:disabled) { background: var(--mDarkTealHover); }
button.secondary { background: #fff; color: var(--mDarkTeal); border-color: var(--mDarkTeal); }
button.warning { background: var(--mAlert); border-color: var(--mAlert); }
button.success { background: var(--mDarkTeal); }  /* not bootstrap green */
```
Also recolor the ŷ marker line (`#007bff` → `var(--mDarkTeal)`) and assigned-class highlight (`#28a745` → a subtle teal tint) in the SVG render code.

#### 5c. Fix scm.html corruption (critical bug)
In `renderUnifiedCanvas`, the `defs.innerHTML` block (lines ~518–642) incorrectly contains the **entire page stylesheet**. Replace with the correct 3-line SVG style (copy from `bnn.html`):
```javascript
defs.innerHTML = `
    <style>
        text { font-family: 'LM Roman 10', Georgia, serif; }
        .mono { font-family: monospace; font-weight: bold; }
    </style>
`;
```

#### 5d. Spread class boundaries on discretization axis (Step 6)
**Problem:** thresholds are sampled with random offsets around `continuousOutput`, so adjacent class intervals cluster and boundary labels overlap.

**Fix:** add a shared helper in both files:
```javascript
function spreadClassBoundaries(numClasses, continuousOutput, axisDomain) {
  const MIN_SPAN = 7.0;
  let minVal = axisDomain.min, maxVal = axisDomain.max;
  if (maxVal - minVal < MIN_SPAN) {
    const mid = (minVal + maxVal) / 2;
    minVal = mid - MIN_SPAN / 2;
    maxVal = mid + MIN_SPAN / 2;
  }
  const range = maxVal - minVal;
  const bounds = [];
  for (let i = 1; i < numClasses; i++) {
    bounds.push(+(minVal + (range * i) / numClasses).toFixed(2));
  }
  let assignedClass = 0;
  bounds.forEach(b => { if (b < continuousOutput) assignedClass++; });
  return { bounds, assignedClass, axisDomain: { min: minVal, max: maxVal } };
}
```
Call this in the Step 6 click handler instead of the random-offset loop.

**Rendering tweaks** in `renderUnifiedCanvas` class-axis section:
- Increase class band height (70 → 80px).
- Alternate boundary label y-positions (even indices above axis, odd below) to prevent collision.
- Skip `B_i` label text when mapped pixel width between adjacent boundaries is < 28px.

### Final verification

```bash
cd slides-html && python3 -m http.server 8741
```

Open in a desktop browser (WebGL needed for theorem_3_1):
1. TabPFN → Architecture slides: all boxes/arrows visible, sharp at any zoom.
2. Body text: serif (Latin Modern), not sans-serif.
3. Statistical Foundations → When PPDs can Learn: theorem left, 3D viz right, labels distinguishable.
4. TabPFN → BNN Prior / SCM Prior: no ledger panel; buttons dark teal; Step 6 class bands evenly spaced.