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
       TOC label; the optional `cite` is the .bib key of the section's
       paper — it is rendered as a citation marker ONLY on that section's
       own divider slide (see outlineHTML), so the same paper is not
       re-cited on every outline slide.
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
    { file: 'sections/tabpfn.html',                  toc: 'TabPFN',
      cite: 'hollmannTabPFNTransformerThat2023' },
    { file: 'sections/statistical_foundations.html', toc: 'Statistical Foundations of PFNs',
      cite: 'naglerStatisticalFoundationsPriorData2023' },
    { file: 'sections/tabpfnv2.html',                toc: 'TabPFNv2',
      cite: 'hollmannAccuratePredictionsSmall2025' },
    { file: 'sections/tabicl.html',                  toc: 'TabICL',
      cite: 'quTabICLTabularFoundation2025' },
    { file: 'sections/recent_sota.html',             toc: 'SOTA' },
    { file: 'sections/connections.html',             toc: 'Connections to Other Topics' },
    { file: 'sections/conclusion.html',              toc: 'Conclusion' },
    { file: 'sections/appendix.html',                toc: null },
  ];

  const TOC_SECTIONS = SECTIONS.filter(s => s.toc !== null);

  /* ---- outline list, optionally with one section highlighted ----
     Every <li> carries data-goto-id pointing at that section's divider
     slide's id ("divider-N") — clicking it teleports there (see
     gotoSlideById / the delegated click listener below). This powers
     both the main Outline slide and every per-section divider's own
     outline list, so a click always jumps regardless of which one
     you're looking at.

     A section's `cite` marker is emitted ONLY on that section's own
     divider (currentIdx === i) — never on the main Outline (currentIdx
     null) and never on the other dividers. Otherwise the same paper
     would carry a visible [n] on all nine outline slides. js/cite.js
     numbers by first appearance in DOM order, so a section paper that
     is not cited earlier in the deck gets its number here, at the
     divider that opens its section. */
  function outlineHTML(currentIdx) {
    return TOC_SECTIONS.map((s, i) => {
      const cite = (s.cite && currentIdx === i)
        ? ` <span class="cite" data-cite="${s.cite}"></span>` : '';
      const dimmed = currentIdx != null && i !== currentIdx ? 'dimmed' : '';
      return `<li class="${dimmed}" data-goto-id="divider-${i}">${s.toc}${cite}</li>`;
    }).join('');
  }

  function dividerSlide(idx) {
    const sec = document.createElement('section');
    sec.id = `divider-${idx}`;
    sec.className = 'toc-slide section-divider';
    sec.innerHTML = `
      <header class="frame-head"><h2 class="frame-title">Outline</h2></header>
      <ul class="toc">${outlineHTML(idx)}</ul>`;
    return sec;
  }

  /* ---- outline click-to-navigate ----
     Delegated (survives the outline HTML being (re)written) so it
     works for the main Outline slide (data-outline) and every
     per-section divider alike. */
  function gotoSlideById(id) {
    if (!Reveal.isReady()) return;
    const target = document.getElementById(id);
    if (!target) return;
    const idx = Reveal.getSlides().indexOf(target);
    if (idx !== -1) Reveal.slide(idx);
  }

  document.addEventListener('click', e => {
    const li = e.target.closest('[data-goto-id]');
    if (li) {
      gotoSlideById(li.dataset.gotoId);
      toggleSectionMenu(false);
    }
  });

  /* ================= navigation: section menu + jump-to-slide =========
     Two ways to get somewhere fast without arrowing through the deck:

     1. TYPE A SLIDE NUMBER, PRESS ENTER (PowerPoint-style). reveal 5
        ships a jump-to-slide box (config `jumpToSlide`, opened with `G`)
        and — because our `slideNumber` is 'c' (one continuous count) —
        a plain number in it means exactly the number printed in the
        corner. The handler below lets you skip the `G`: any digit typed
        on the deck opens that box already holding the digit, so "12 ⏎"
        goes to slide 12. Escape cancels.

     2. CLICK THE SLIDE NUMBER -> section menu. A translucent list of the
        sections pops up above the corner; clicking one jumps to that
        section's divider slide. The section you are in is highlighted.

     Both are ignored while an iframe pop-up / Q&A overlay is open, and
     while focus is inside a text field (including reveal's own box).
  ==================================================================== */
  let sectionMenuEl = null;

  function buildSectionMenu() {
    const el = document.createElement('div');
    el.className = 'section-menu';
    el.innerHTML =
      '<ul class="section-menu-list">' +
      TOC_SECTIONS.map((s, i) =>
        `<li data-goto-id="divider-${i}">` +
          `<span class="n">${String(i + 1).padStart(2, '0')}</span>` +
          `<span class="t">${s.toc}</span>` +
        '</li>').join('') +
      '</ul>' +
      '<div class="section-menu-hint">Type a slide number, then <kbd>&crarr;</kbd></div>';
    document.body.appendChild(el);
    return el;
  }

  /* mark the section that contains the current slide (the last divider
     at or before it; the appendix keeps the last section marked) */
  function highlightCurrentSection() {
    if (!sectionMenuEl || !Reveal.isReady()) return;
    const slides = Reveal.getSlides();
    const cur = slides.indexOf(Reveal.getCurrentSlide());
    const items = sectionMenuEl.querySelectorAll('[data-goto-id]');
    let active = -1;
    items.forEach((li, i) => {
      const target = document.getElementById(li.dataset.gotoId);
      const idx = target ? slides.indexOf(target) : -1;
      if (idx !== -1 && idx <= cur) active = i;
      li.classList.remove('current');
    });
    if (active >= 0) items[active].classList.add('current');
  }

  function toggleSectionMenu(force) {
    if (!sectionMenuEl) sectionMenuEl = buildSectionMenu();
    const open = force === undefined
      ? !sectionMenuEl.classList.contains('open')
      : Boolean(force);
    sectionMenuEl.classList.toggle('open', open);
    if (open) highlightCurrentSection();
  }

  const overlayOpen = () =>
    !!document.querySelector('.viz-modal-backdrop.open, .qa-modal-backdrop.open');

  document.addEventListener('click', e => {
    /* the slide number is an <a href="#/..."> — swallow the hash nav */
    if (e.target.closest('.reveal .slide-number')) {
      e.preventDefault();
      toggleSectionMenu();
      return;
    }
    if (sectionMenuEl && sectionMenuEl.classList.contains('open')
        && !e.target.closest('.section-menu')) {
      toggleSectionMenu(false);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!/^[0-9]$/.test(e.key)) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (overlayOpen() || !Reveal.isReady()) return;

    e.preventDefault();
    toggleSectionMenu(false);
    Reveal.toggleJumpToSlide(true);
    const input = document.querySelector('.jump-to-slide-input');
    if (!input) return;
    input.value = e.key;                       /* seed it with the digit */
    input.dispatchEvent(new Event('input'));   /* arms reveal's auto-jump */
  });

  /* ---- generic click-to-open iframe pop-up (data-modal-src) ----
     Any element carrying data-modal-src opens that URL in a centered
     iframe overlay instead of navigating slides — used for inline
     "explore this" hints (see sections/statistical_foundations.html
     #sf-approx). One backdrop element is lazily created and reused.
     Reveal's keyboard nav is disabled while open so arrow keys reach
     the iframe's own controls (e.g. a slider) instead of flipping
     slides underneath; Escape (or a backdrop click) closes it. */
  function ensureModal() {
    let backdrop = document.getElementById('viz-modal-backdrop');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'viz-modal-backdrop';
    backdrop.className = 'viz-modal-backdrop';
    backdrop.innerHTML =
      '<div class="viz-modal">' +
        '<button type="button" class="viz-modal-close" aria-label="Close">&times;</button>' +
        '<iframe class="viz-modal-frame"></iframe>' +
      '</div>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeModal();
    });
    backdrop.querySelector('.viz-modal-close').addEventListener('click', closeModal);
    return backdrop;
  }

  function openModal(src, title) {
    const backdrop = ensureModal();
    const iframe = backdrop.querySelector('.viz-modal-frame');
    iframe.title = title || 'Interactive visualization';
    iframe.src = src;
    backdrop.classList.add('open');
    if (Reveal.isReady()) Reveal.configure({ keyboard: false });
  }

  function closeModal() {
    const backdrop = document.getElementById('viz-modal-backdrop');
    if (!backdrop || !backdrop.classList.contains('open')) return;
    backdrop.classList.remove('open');
    backdrop.querySelector('.viz-modal-frame').src = ''; /* stop e.g. sliders/animations */
    if (Reveal.isReady()) Reveal.configure({ keyboard: true });
  }

  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-modal-src]');
    if (trigger) openModal(trigger.dataset.modalSrc, trigger.dataset.modalTitle);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeQaModal();
      toggleSectionMenu(false);
    }
  });

  /* ---- audience Q&A pop-up (.audience-qa > [data-audience-qa]) ----
     Circled ? buttons open a text overlay for spontaneous audience
     questions — separate from speaker notes. Content lives in a sibling
     <template class="audience-qa-body"> (KaTeX is run on open). Copy
     the .audience-qa block onto any slide; add .audience-qa--bl to pin
     it to the bottom-left corner. */
  function ensureQaModal() {
    let backdrop = document.getElementById('qa-modal-backdrop');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'qa-modal-backdrop';
    backdrop.className = 'qa-modal-backdrop';
    backdrop.innerHTML =
      '<div class="qa-modal" role="dialog" aria-modal="true">' +
        '<button type="button" class="qa-modal-close" aria-label="Close">&times;</button>' +
        '<div class="qa-modal-body"></div>' +
      '</div>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeQaModal();
    });
    backdrop.querySelector('.qa-modal-close').addEventListener('click', closeQaModal);
    return backdrop;
  }

  function openQaModal(trigger) {
    const wrap = trigger.closest('.audience-qa');
    const tmpl = wrap && wrap.querySelector('template.audience-qa-body');
    if (!tmpl) return;
    const backdrop = ensureQaModal();
    const body = backdrop.querySelector('.qa-modal-body');
    body.innerHTML = tmpl.innerHTML;
    renderMathInElement(body, KATEX_OPTS);
    backdrop.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    if (Reveal.isReady()) Reveal.configure({ keyboard: false });
  }

  function closeQaModal() {
    const backdrop = document.getElementById('qa-modal-backdrop');
    if (!backdrop || !backdrop.classList.contains('open')) return;
    backdrop.classList.remove('open');
    backdrop.querySelector('.qa-modal-body').innerHTML = '';
    document.querySelectorAll('[data-audience-qa][aria-expanded="true"]')
      .forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    if (Reveal.isReady()) Reveal.configure({ keyboard: true });
  }

  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-audience-qa]');
    if (trigger) openQaModal(trigger);
  });

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
      /* Figures.renderAll() rewrites [data-fig] hosts with fresh raw
         \(...\) KaTeX source (e.g. metapanel axis labels) — it must be
         followed by a KaTeX pass every time it runs, not just on the
         initial build(), or a resize repaints those labels as literal
         un-typeset text ("\(\cdots\)") instead of rendered math. */
      Figures.renderAll(slidesElRef);
      renderMathInElement(slidesElRef, KATEX_OPTS);
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

    /* 5.5: citations — fill [data-cite] markers and the References
       slide from references.bib, numbered by first appearance
       (js/cite.js) */
    await Cite.apply(slidesEl);

    /* 6: reveal.js — viewport-sized canvas, scale locked to 1 */
    Reveal.initialize({
      width: w,
      height: h,
      margin: 0,
      minScale: 1,
      maxScale: 1,
      center: false,
      hash: true,
      transition: 'fade',
      transitionSpeed: 'fast',
      backgroundTransition: 'none',
      display: 'flex',
      /* 'c' = one continuous count; the jump-to-slide box (below) then
         takes exactly the number printed in the corner. */
      slideNumber: 'c',
      jumpToSlide: true,
      controls: false,
      progress: true,
      plugins: [RevealNotes],
    });

    Reveal.on('ready', syncOverlayState);
    Reveal.on('ready', highlightCurrentSection);
    Reveal.on('slidechanged', highlightCurrentSection);
    Reveal.on('slidechanged', syncOverlayState);
    Reveal.on('fragmentshown', syncOverlayState);
    Reveal.on('fragmenthidden', syncOverlayState);
    Reveal.on('resize', onViewportResize);
    window.addEventListener('resize', onViewportResize);
  }

  build();
})();
