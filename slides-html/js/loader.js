/* =====================================================================
   js/loader.js — deck assembly, mirroring main.tex + preamble.tex.

   What happens on load, in order:
     1. fetch each sections/<file>.html fragment (same order as the
        \input{sections/...} lines in main.tex) and inject its
        <section> slides into the .slides container;
     2. before each section's slides, insert a divider "Outline" slide
        with the current section highlighted and the rest dimmed —
        this reproduces \AtBeginSection in preamble.tex (the appendix
        gets NO divider and is NOT listed, like \appendix);
     3. fill the main Outline slide (\tableofcontents);
     4. render the TikZ-replacement figures (js/figures.js);
     5. typeset all math with KaTeX;
     6. start reveal.js and hook up the overlay-state helper.

   HOW TO ADJUST:
     - Add/rename/reorder sections: edit SECTIONS below. `toc` is the
       TOC label (TabPFN carries its \cite label "[3]", exactly as
       the rendered PDF shows).
     - Beamer-overlay emulation: any .fragment may carry
       data-slide-class="s2" — while that fragment is visible, the
       class is set on its <section>. Slides use cumulative classes
       s2/s3/s4... plus CSS like `.s2:not(.s3) .foo { color:... }`
       to reproduce \only<2>{\color{...}} / \alt<3>{...}{...}
       restyling. See sections/background.html for worked examples.
     - Slide geometry: DESIGN_W×DESIGN_H (1280×720) layout grid; loader.js
       sizes the reveal canvas to the fitted viewport at scale 1 (no CSS
       upscale blur) and sets --deck-scale for proportional typography.
===================================================================== */
(function () {
  'use strict';

  /* Section files, in main.tex \input order. `toc: null` = keep out
     of the outline and add no divider (the \appendix behavior). */
  const SECTIONS = [
    { file: 'sections/background.html',              toc: 'Background' },
    { file: 'sections/tabpfn.html',                  toc: 'TabPFN <span class="cite">[3]</span>' },
    { file: 'sections/statistical_foundations.html', toc: 'Statistical Foundations of PFNs' },
    { file: 'sections/tabpfnv2.html',                toc: 'TabPFNv2' },
    { file: 'sections/tabicl.html',                  toc: 'TabICL' },
    { file: 'sections/recent_sota.html',             toc: 'SOTA' },
    { file: 'sections/connections.html',             toc: 'Connections to Other Topics' },
    { file: 'sections/conclusion.html',              toc: 'Conclusion' },
    { file: 'sections/appendix.html',                toc: null },
  ];

  /* ---- outline list, optionally with one section highlighted ---- */
  function outlineHTML(currentIdx) {
    return SECTIONS.filter(s => s.toc !== null).map((s, i) =>
      `<li class="${currentIdx != null && i !== currentIdx ? 'dimmed' : ''}">${s.toc}</li>`
    ).join('');
  }

  function dividerSlide(idx) {
    const sec = document.createElement('section');
    sec.className = 'toc-slide section-divider';
    sec.innerHTML = `
      <header class="frame-head"><h2 class="frame-title">Outline</h2></header>
      <ul class="toc">${outlineHTML(idx)}</ul>`;
    return sec;
  }

  /* ---- overlay-state helper (Beamer \only / \alt emulation) ----
     Fragments tagged data-slide-class="X" toggle class X on their
     slide while visible. Full re-sync on slide change keeps state
     correct when jumping around. */
  function syncOverlayState() {
    document.querySelectorAll('.reveal .slides section').forEach(slide => {
      slide.querySelectorAll(':scope .fragment[data-slide-class]').forEach(f => {
        slide.classList.toggle(f.dataset.slideClass, f.classList.contains('visible'));
      });
    });
  }

  /* ---- crisp full-viewport fit (no CSS transform upscale) ----
     Reveal's default: fixed 1280×720 + transform:scale() to fill the
     window — fractional scale blurs text/KaTeX/SVG. Instead we size the
     slide canvas to the largest 16:9 rect that fits the viewport and lock
     scale to 1; --deck-scale (fittedWidth/1280) scales typography in CSS. */
  const DESIGN_W = 1280;
  const DESIGN_H = 720;
  const DESIGN_ASPECT = DESIGN_W / DESIGN_H;

  function fittedViewport() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let w, h;
    if (vw / vh > DESIGN_ASPECT) {
      h = vh;
      w = Math.round(h * DESIGN_ASPECT);
    } else {
      w = vw;
      h = Math.round(w / DESIGN_ASPECT);
    }
    return { w, h, deckScale: w / DESIGN_W };
  }

  function applyDeckScale(deckScale) {
    document.documentElement.style.setProperty('--deck-scale', String(deckScale));
  }

  const KATEX_OPTS = {
    delimiters: [
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
    ],
    macros: {
      '\\D': '\\mathcal{D}',
      '\\PPhi': '\\mathbb{P}_{\\Phi}',
    },
    trust: ctx => ctx.command === '\\htmlClass',
    strict: false,
    throwOnError: false,
  };

  let slidesElRef = null;
  let resizeTimer = null;

  function onViewportResize() {
    if (!slidesElRef || !Reveal.isReady()) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const { w, h, deckScale } = fittedViewport();
      applyDeckScale(deckScale);
      Reveal.configure({ width: w, height: h });
      Figures.renderAll(slidesElRef);
    }, 120);
  }

  async function build() {
    const slidesEl = document.querySelector('.reveal .slides');
    slidesElRef = slidesEl;

    const { w, h, deckScale } = fittedViewport();
    applyDeckScale(deckScale);

    /* 1+2: fetch fragments, inject with dividers */
    const parser = new DOMParser();
    let tocIdx = 0;
    for (const sec of SECTIONS) {
      const res = await fetch(sec.file);
      if (!res.ok) { console.error('Failed to load', sec.file); continue; }
      const doc = parser.parseFromString(await res.text(), 'text/html');
      if (sec.toc !== null) {
        slidesEl.appendChild(dividerSlide(tocIdx));
        tocIdx++;
      }
      doc.querySelectorAll('body > section').forEach(s =>
        slidesEl.appendChild(document.adoptNode(s)));
      /* carry over per-section <style> blocks (overlay CSS lives there) */
      doc.querySelectorAll('body > style').forEach(s =>
        document.head.appendChild(document.adoptNode(s)));
    }

    /* 3: the main Outline slide (all sections, none dimmed) */
    document.querySelector('[data-outline] .toc').innerHTML = outlineHTML(null);

    /* 4: TikZ-replacement figures (must run before KaTeX: figure
       labels contain \( \) math) */
    Figures.renderAll(slidesEl);

    /* 5: KaTeX. trust is limited to \htmlClass — used to tag formula
       parts (e.g. the x in a conditioning) so overlay CSS can
       recolor/hide them, reproducing \textcolor + \alt overlays. */
    renderMathInElement(slidesEl, KATEX_OPTS);

    /* 6: reveal.js — viewport-sized canvas, scale locked to 1 */
    Reveal.initialize({
      width: w,
      height: h,
      margin: 0,
      minScale: 1,
      maxScale: 1,
      center: false,
      hash: true,
      transition: 'none',
      backgroundTransition: 'none',
      display: 'flex',
      slideNumber: 'c',
      controls: true,
      progress: true,
      plugins: [RevealNotes],
    });

    Reveal.on('ready', syncOverlayState);
    Reveal.on('slidechanged', syncOverlayState);
    Reveal.on('fragmentshown', syncOverlayState);
    Reveal.on('fragmenthidden', syncOverlayState);
    Reveal.on('resize', onViewportResize);
    window.addEventListener('resize', onViewportResize);
  }

  build();
})();
