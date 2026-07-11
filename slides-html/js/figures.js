/* =====================================================================
   js/figures.js — native SVG re-implementation of slides/figures.tex.

   Every drawing keeps the ORIGINAL TikZ coordinates verbatim (units are
   TikZ centimetres). A tiny coordinate mapper flips the y axis (TikZ y
   grows up, SVG y grows down) and multiplies by a per-figure pixel
   scale, so a coordinate you see in figures.tex can be pasted here 1:1.

   Pixel scale: the slide is 1280x720px for a 16x9cm Beamer page, i.e.
   80 px/cm; each figure additionally applies the same `scale=` factor
   its tikzpicture used (0.85 for the feature plots, 0.5 for the meta
   panels, ...).

   Colors — the exact \definecolor values from figures.tex:
     class0  rgb(56,142,60)   green  : y = 0, "o"
     class1  rgb(81,45,168)   purple : y = 1, "x"
     hlA     rgb(216,27,96)   pink   highlight ring/label
     hlB     rgb(230,81,0)    orange highlight ring/label
     testred rgb(198,40,40)   red    : test point / boundary / bars

   Public API (used by the sections via data attributes, rendered by
   Figures.renderAll(root) from js/loader.js):

     <div class="fig-host" data-fig="feature-plot" data-variant="stat-model">
     <div class="fig-host" data-fig="feature-plot" data-variant="sl-framework">
     <div class="fig-host" data-fig="metapanel"
          data-label="\\mathbb{P}_{\\Phi(\\cdot)}(\\varphi)"
          data-bars="0.3,0.3,0.3,0.3">
     <span class="fig-inline" data-fig="icon" data-icon="hypLinA" data-scale="0.45">

   Math in the generated labels uses \( \) delimiters; loader.js runs
   KaTeX auto-render AFTER Figures.renderAll, so labels come out typeset.
===================================================================== */
(function () {
  'use strict';

  const PX_PER_CM_BASE = 80;

  function deckScale() {
    const v = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--deck-scale'));
    return Number.isFinite(v) && v > 0 ? v : 1;
  }

  function pxPerCm() {
    return PX_PER_CM_BASE * deckScale();
  }

  /* exact figures.tex colors */
  const class0  = 'rgb(56,142,60)';
  const class1  = 'rgb(81,45,168)';
  const hlA     = 'rgb(216,27,96)';
  const hlB     = 'rgb(230,81,0)';
  const testred = 'rgb(198,40,40)';
  /* LaTeX "class0!20" etc. = mix with white (20% color / 80% white) */
  const class0_20 = 'rgb(215,232,216)';
  const class1_20 = 'rgb(220,213,238)';
  const class0_25 = 'rgb(205,227,206)';
  const class1_25 = 'rgb(212,203,233)';
  const testred_70 = 'rgb(215,105,105)';

  /* line widths in cm: TikZ default 0.4pt, thick 0.8pt (1pt=0.03515cm) */
  const LW  = 0.021;   /* slightly heavier than 0.4pt so hairlines survive scaling */
  const LWT = 0.032;   /* "thick" */

  /* -------------------------------------------------------------
     Coordinate mapper for one figure.
     bbox = [xmin, ymin, xmax, ymax] in TikZ cm (= \fixedbbox for the
     feature plots — this is what keeps every instance the same size).
     scale = the tikzpicture's `scale=` option.
     All draw helpers below take TikZ coords and emit SVG px.
  ------------------------------------------------------------- */
  function mapper(bbox, scale) {
    const [xmin, ymin, xmax, ymax] = bbox;
    const k = pxPerCm() * scale;
    return {
      W: (xmax - xmin) * k,
      H: (ymax - ymin) * k,
      k,
      X: x => (x - xmin) * k,
      Y: y => (ymax - y) * k,      /* y flip */
      L: len => len * k,           /* scalar length */
    };
  }

  /* ---------------- SVG primitive helpers (all take TikZ coords) --- */

  /* "$\circ$" data point: small unfilled circle */
  function ptCircle(m, x, y, color, r = 0.075, lw = LW) {
    return `<circle cx="${m.X(x)}" cy="${m.Y(y)}" r="${m.L(r)}"
      fill="none" stroke="${color}" stroke-width="${m.L(lw)}"/>`;
  }
  /* "$\times$" data point: two crossing strokes */
  function ptTimes(m, x, y, color, h = 0.085, lw = LW * 1.4) {
    const cx = m.X(x), cy = m.Y(y), d = m.L(h);
    return `<path d="M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx - d} ${cy + d}L${cx + d} ${cy - d}"
      stroke="${color}" stroke-width="${m.L(lw)}" stroke-linecap="round"/>`;
  }
  /* axis / plain line with optional -{Latex} arrowhead at the end */
  function line(m, x1, y1, x2, y2, color, lw = LW, arrow = false) {
    let s = `<line x1="${m.X(x1)}" y1="${m.Y(y1)}" x2="${m.X(x2)}" y2="${m.Y(y2)}"
      stroke="${color}" stroke-width="${m.L(lw)}"/>`;
    if (arrow) {
      /* Latex-style filled triangle head, ~0.14cm long */
      const ax = m.X(x2), ay = m.Y(y2);
      const dx = m.X(x2) - m.X(x1), dy = m.Y(y2) - m.Y(y1);
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, px = -uy, py = ux;
      const aL = m.L(0.14), aW = m.L(0.05);
      s += `<polygon points="${ax + ux * aL},${ay + uy * aL}
        ${ax - px * aW},${ay - py * aW} ${ax + px * aW},${ay + py * aW}"
        fill="${color}"/>`;
    }
    return s;
  }
  function ellipse(m, cx, cy, rx, ry, fill) {
    return `<ellipse cx="${m.X(cx)}" cy="${m.Y(cy)}" rx="${m.L(rx)}" ry="${m.L(ry)}" fill="${fill}"/>`;
  }
  function rect(m, x1, y1, x2, y2, fill, stroke, lw = LW) {
    const X = Math.min(m.X(x1), m.X(x2)), Y = Math.min(m.Y(y1), m.Y(y2));
    return `<rect x="${X}" y="${Y}" width="${Math.abs(m.X(x2) - m.X(x1))}"
      height="${Math.abs(m.Y(y2) - m.Y(y1))}" fill="${fill}"
      ${stroke ? `stroke="${stroke}" stroke-width="${m.L(lw)}"` : ''}/>`;
  }
  /* closed polygon from TikZ coord pairs */
  function polygon(m, pts, fill) {
    const d = pts.map(([x, y]) => `${m.X(x)},${m.Y(y)}`).join(' ');
    return `<polygon points="${d}" fill="${fill}"/>`;
  }
  /* plot[domain] of a function, optionally closed into a fill region */
  function plotFn(m, fn, x0, x1, samples, closePts, fill, stroke, lw) {
    let d = '';
    for (let i = 0; i <= samples; i++) {
      const x = x0 + (x1 - x0) * i / samples;
      d += `${i ? 'L' : 'M'}${m.X(x)} ${m.Y(fn(x))}`;
    }
    if (closePts) {
      for (const [x, y] of closePts) d += `L${m.X(x)} ${m.Y(y)}`;
      d += 'Z';
      return `<path d="${d}" fill="${fill}"/>`;
    }
    return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${m.L(lw)}"/>`;
  }
  /* plot[smooth] coordinates {...}: Catmull-Rom -> cubic Béziers,
     the same visual idea as TikZ's smooth plot */
  function smoothPath(m, pts, closePts, fill, stroke, lw) {
    const P = pts.map(([x, y]) => [m.X(x), m.Y(y)]);
    let d = `M${P[0][0]} ${P[0][1]}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[i + 1],
            p3 = P[Math.min(i + 2, P.length - 1)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
    }
    if (closePts) {
      for (const [x, y] of closePts) d += `L${m.X(x)} ${m.Y(y)}`;
      d += 'Z';
      return `<path d="${d}" fill="${fill}"/>`;
    }
    return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${m.L(lw)}"/>`;
  }
  /* HTML label overlaid at a TikZ coordinate (KaTeX-rendered later).
     anchor: 'c' (node default, centered), 'w' (node[right]), 's' (node[above]) */
  function label(m, x, y, html, opts = {}) {
    const cls = { c: '', w: ' anchor-w', s: ' anchor-s' }[opts.anchor || 'c'];
    const style = (opts.color ? `color:${opts.color};` : '') +
                  (opts.size ? `font-size:${opts.size * deckScale()}px;` : '');
    return `<div class="fig-label${cls}" style="left:${m.X(x)}px;top:${m.Y(y)}px;${style}">${html}</div>`;
  }

  /* =============================================================
     \featurecloud — background point cloud + axes shared by the
     Statistical Model / SL Framework slides.
     HOW TO ADJUST: identical to the TikZ macro — each ptCircle /
     ptTimes call is ONE data point at its original (x2, x1)
     coordinate; the two ellipses are the soft cluster backdrops;
     the two `line(...)` calls are the axes (labels are HTML,
     appended by featurePlot below).
  ============================================================= */
  function featurecloudSVG(m) {
    return [
      ellipse(m, 2.6, 2.7, 1.35, 1.05, class0_20),
      ellipse(m, 1.0, 1.0, 1.35, 1.05, class1_20),
      ptCircle(m, 2.2, 3.1,  class0),
      ptCircle(m, 2.6, 3.35, class0),
      ptCircle(m, 3.05, 3.05, class0),
      ptCircle(m, 2.35, 2.65, class0),
      ptCircle(m, 2.95, 2.5,  class0),
      ptCircle(m, 3.35, 2.85, class0),
      ptTimes(m, 0.5, 1.4,  class1),
      ptTimes(m, 0.8, 0.8,  class1),
      ptTimes(m, 1.15, 1.6, class1),
      ptTimes(m, 0.4, 0.6,  class1),
      ptTimes(m, 1.3, 1.0,  class1),
      ptTimes(m, 0.95, 1.9, class1),
      line(m, -0.3, 0, 4.3, 0, '#191919', LW, true),
      line(m, 0, -0.3, 0, 4.3, '#191919', LW, true),
    ].join('');
  }
  /* the axis labels: node[right] {$x_2$} / node[above] {$x_1$} */
  function featurecloudLabels(m) {
    return label(m, 4.52, 0, '\\(x_2\\)', { anchor: 'w', size: 19 }) +
           label(m, 0, 4.52, '\\(x_1\\)', { anchor: 's', size: 19 });
  }

  /* \featurelegend — the "$y=0$ / $y=1$" key box at (5.1+off, 1.7).
     Rendered as an HTML box so the text is real (KaTeX) text.       */
  function legendHTML(m, off = 0) {
    const glyph = (svgBody, w) =>
      `<svg width="${w}" height="${w}" viewBox="0 0 ${w} ${w}" style="overflow:visible">${svgBody}</svg>`;
    const r = m.L(0.075), d = m.L(0.085), c = 9;
    const circ = glyph(`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${class0}" stroke-width="1.6"/>`, 18);
    const tims = glyph(`<path d="M${c - d} ${c - d}L${c + d} ${c + d}M${c - d} ${c + d}L${c + d} ${c - d}" stroke="${class1}" stroke-width="2" stroke-linecap="round"/>`, 18);
    return `<div class="fig-legend" style="left:${m.X(5.1 + off)}px;top:${m.Y(1.7)}px;">
      <div class="row">${circ}<span>\\(y=0\\)</span></div>
      <div class="row">${tims}<span>\\(y=1\\)</span></div></div>`;
  }

  /* =============================================================
     feature-plot: full figure incl. \fixedbbox sizing.
     variant "stat-model":   highlight rings + x^{(1)}/x^{(12)} labels
                             + the D_n formula node at (3.0,-0.9)
     variant "sl-framework": red \bigstar test point + x_test label
     tikzpicture used scale=0.85 in both frames.
     \fixedbbox: (-0.5,-0.5) rectangle (6.4,4.6)  — do NOT change per
     variant; widen it here (once) if you add out-of-range content.
  ============================================================= */
  function featurePlot(variant) {
    const m = mapper([-0.5, -0.5, 6.4, 4.6], 0.85);
    let svg = featurecloudSVG(m);
    let html = featurecloudLabels(m);

    if (variant === 'stat-model') {
      /* \node[hlB, draw, circle, thick, minimum size=6pt] at (3.35,2.865) */
      svg += `<circle cx="${m.X(3.35)}" cy="${m.Y(2.865)}" r="${m.L(0.115)}"
        fill="none" stroke="${hlB}" stroke-width="${m.L(LWT)}"/>`;
      svg += `<circle cx="${m.X(0.95)}" cy="${m.Y(1.9)}" r="${m.L(0.115)}"
        fill="none" stroke="${hlA}" stroke-width="${m.L(LWT)}"/>`;
      html += label(m, 3.75, 3.25, '\\(x^{(12)}\\)', { color: hlB });
      html += label(m, 0.55, 2.25, '\\(x^{(1)}\\)',  { color: hlA });
      /* overlay node at (3.0,-0.9): the dataset formula under the plot */
      html += label(m, 3.0, -0.9,
        '\\(\\mathcal{D}_n = D_{12} = \\Big\\{ \\big(x^{(1)}; 1\\big),\\, \\dots,\\, \\big(x^{(12)}; 0\\big) \\Big\\}\\)',
        { size: 20 });
    } else if (variant === 'sl-framework') {
      /* \node[testred] at (2.0,3.95) {$\bigstar$} */
      svg += star(m, 2.0, 3.95, 0.16, testred);
      html += label(m, 2.0, 4.35, '\\(x_{\\text{test}}\\)', { color: testred });
    }
    html += legendHTML(m);

    /* the overlay D_n formula pokes ~0.6cm below the bbox; give the host
       the bbox size (layout parity — overlay nodes don't resize TikZ pics) */
    return host(m, svg, html);
  }

  /* $\bigstar$: 5-pointed filled star */
  function star(m, x, y, R, color) {
    const cx = m.X(x), cy = m.Y(y), r0 = m.L(R), r1 = r0 * 0.42;
    let pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r1 : r0;
      pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
  }

  function host(m, svg, html) {
    return `<svg width="${m.W}" height="${m.H}" viewBox="0 0 ${m.W} ${m.H}"
      style="overflow:visible">${svg}</svg>${html}`;
  }

  /* =============================================================
     Hypothesis icons — \hypIconBase + \hypLinA/B, \hypCurve,
     \hypWiggly. Fixed 1.4 x 1.4 box, content clipped to it, thin
     border. `scale` = the \scalebox factor at the call site
     (0.8 inside \metapanel, 0.45 inline in formulas).
     All coordinates below are verbatim from figures.tex.
  ============================================================= */
  const iconPt = { r: 0.045, h: 0.05, lw: 0.018 };  /* font=\tiny points */

  function hypIcon(scale, body) {
    const m = mapper([0, 0, 1.4, 1.4], scale);
    const id = 'clip' + Math.random().toString(36).slice(2, 8);
    return `<svg width="${m.W}" height="${m.H}" viewBox="0 0 ${m.W} ${m.H}">
      <clipPath id="${id}"><rect x="0" y="0" width="${m.W}" height="${m.H}"/></clipPath>
      <g clip-path="url(#${id})">${body(m)}</g>
      <rect x="0" y="0" width="${m.W}" height="${m.H}" fill="none"
        stroke="#191919" stroke-width="${m.L(0.014)}"/></svg>`;
  }

  /* Main-diagonal split: o top-right, x bottom-left */
  function hypLinA(scale) {
    return hypIcon(scale, m => [
      polygon(m, [[-0.15, 1.25], [1.55, 0.15], [1.55, 1.55], [-0.15, 1.55]], class0_25),
      polygon(m, [[-0.15, 1.25], [1.55, 0.15], [1.55, -0.1], [-0.15, -0.1]], class1_25),
      ptCircle(m, 0.8, 1.15, class0, iconPt.r, iconPt.lw),
      ptCircle(m, 1.15, 1.05, class0, iconPt.r, iconPt.lw),
      ptCircle(m, 0.95, 0.85, class0, iconPt.r, iconPt.lw),
      ptTimes(m, 0.3, 0.5,  class1, iconPt.h, iconPt.lw),
      ptTimes(m, 0.6, 0.3,  class1, iconPt.h, iconPt.lw),
      ptTimes(m, 0.35, 0.25, class1, iconPt.h, iconPt.lw),
      line(m, -0.15, 1.25, 1.55, 0.15, testred, LWT),
    ].join(''));
  }

  /* Anti-diagonal split: x top-left, o bottom-right */
  function hypLinB(scale) {
    return hypIcon(scale, m => [
      polygon(m, [[-0.15, 0.15], [1.55, 1.25], [1.55, 1.55], [-0.15, 1.55]], class1_25),
      polygon(m, [[-0.15, 0.15], [1.55, 1.25], [1.55, -0.1], [-0.15, -0.1]], class0_25),
      ptTimes(m, 0.3, 1.15, class1, iconPt.h, iconPt.lw),
      ptTimes(m, 0.6, 1.05, class1, iconPt.h, iconPt.lw),
      ptTimes(m, 0.4, 0.85, class1, iconPt.h, iconPt.lw),
      ptCircle(m, 1.1, 0.55, class0, iconPt.r, iconPt.lw),
      ptCircle(m, 0.85, 0.25, class0, iconPt.r, iconPt.lw),
      ptCircle(m, 1.15, 0.2, class0, iconPt.r, iconPt.lw),
      line(m, -0.15, 0.15, 1.55, 1.25, testred, LWT),
    ].join(''));
  }

  /* Quadratic split: boundary y = 2(x-0.7)^2 + 0.35 */
  function hypCurve(scale) {
    const f = x => 2 * (x - 0.7) * (x - 0.7) + 0.35;
    return hypIcon(scale, m => [
      plotFn(m, f, -0.15, 1.55, 60, [[1.55, 1.55], [-0.15, 1.55]], class0_25),
      plotFn(m, f, -0.15, 1.55, 60, [[1.55, -0.1], [-0.15, -0.1]], class1_25),
      ptTimes(m, 0.7, 0.15, class1, iconPt.h, iconPt.lw),
      ptTimes(m, 0.5, 0.25, class1, iconPt.h, iconPt.lw),
      ptTimes(m, 0.9, 0.25, class1, iconPt.h, iconPt.lw),
      ptTimes(m, 0.3, 0.45, class1, iconPt.h, iconPt.lw),
      ptTimes(m, 1.1, 0.45, class1, iconPt.h, iconPt.lw),
      ptCircle(m, 0.7, 0.9,  class0, iconPt.r, iconPt.lw),
      ptCircle(m, 0.35, 0.85, class0, iconPt.r, iconPt.lw),
      ptCircle(m, 1.05, 0.85, class0, iconPt.r, iconPt.lw),
      ptCircle(m, 0.1, 1.3,  class0, iconPt.r, iconPt.lw),
      ptCircle(m, 1.3, 1.3,  class0, iconPt.r, iconPt.lw),
      ptCircle(m, 0.7, 1.2,  class0, iconPt.r, iconPt.lw),
      plotFn(m, f, 0, 1.4, 60, null, null, testred, LWT),
    ].join(''));
  }

  /* Wiggly separation: smooth oscillating boundary */
  const wigglyPts = [[-0.1, 0.65], [0.2, 0.82], [0.45, 0.52], [0.7, 0.78],
                     [0.95, 0.55], [1.2, 0.72], [1.5, 0.62]];
  function hypWiggly(scale) {
    return hypIcon(scale, m => [
      smoothPath(m, wigglyPts, [[1.55, 1.55], [-0.15, 1.55]], class0_25),
      smoothPath(m, wigglyPts, [[1.55, -0.1], [-0.15, -0.1]], class1_25),
      ptCircle(m, 0.15, 1.25, class0, iconPt.r, iconPt.lw),
      ptCircle(m, 0.55, 1.1,  class0, iconPt.r, iconPt.lw),
      ptCircle(m, 1.05, 1.2,  class0, iconPt.r, iconPt.lw),
      ptCircle(m, 0.35, 1.3,  class0, iconPt.r, iconPt.lw),
      ptCircle(m, 0.85, 1.1,  class0, iconPt.r, iconPt.lw),
      ptCircle(m, 1.3, 1.05,  class0, iconPt.r, iconPt.lw),
      ptTimes(m, 0.15, 0.22, class1, iconPt.h, iconPt.lw),
      ptTimes(m, 0.55, 0.15, class1, iconPt.h, iconPt.lw),
      ptTimes(m, 1.05, 0.25, class1, iconPt.h, iconPt.lw),
      ptTimes(m, 0.35, 0.32, class1, iconPt.h, iconPt.lw),
      ptTimes(m, 0.85, 0.2,  class1, iconPt.h, iconPt.lw),
      ptTimes(m, 1.3, 0.35,  class1, iconPt.h, iconPt.lw),
      smoothPath(m, wigglyPts, null, null, testred, LWT),
    ].join(''));
  }

  const ICONS = { hypLinA, hypLinB, hypCurve, hypWiggly };

  /* =============================================================
     \metapanel{label}{h1}{h2}{h3}{h4} — "hypothesis histogram":
     a bar over φ per representative hypothesis, icon underneath.
     tikzpicture scale=0.5.
     HOW TO ADJUST (same knobs as the TikZ macro):
       - label   = the y-axis label (KaTeX string, no delimiters);
       - bars    = the four bar heights — the ONLY thing that
         differs between the prior and posterior calls;
       - each bar block below is x0->x1 at height h, icon centred
         at (xc, -1.85) scaled 0.8; "⋯" marks sit between bars.
  ============================================================= */
  function metapanel(labelTex, bars) {
    /* bbox chosen to contain axes + labels + icons (y down to -2.45) */
    const m = mapper([-2.55, -2.62, 10.75, 4.35], 0.5);
    const [h1, h2, h3, h4] = bars;
    let svg = [
      line(m, -1.9, 0, 10, 0, '#191919', LW, true),          /* x axis */
      line(m, -1.9, -0.2, -1.9, 3.7, '#191919', LW, true),   /* y axis */
      rect(m, -1.2, 0, 0.2, h1, testred_70, testred),
      rect(m, 1.8, 0, 3.2, h2, testred_70, testred),
      rect(m, 4.8, 0, 6.2, h3, testred_70, testred),
      rect(m, 7.8, 0, 9.2, h4, testred_70, testred),
    ].join('');

    /* icons at (xc, -1.85), \scalebox{0.8} of the 1.4cm box, at panel
       scale 0.5 => 0.4 effective; embed as nested <svg> positioned so
       its center is the icon's node coordinate */
    const iconScale = 0.8 * 0.5;         /* \scalebox{0.8} x panel scale 0.5 */
    const iconSz = 1.4 * iconScale * PX_PER_CM;
    const icon = (fn, xc) => {
      const cx = m.X(xc) - iconSz / 2, cy = m.Y(-1.85) - iconSz / 2;
      return `<g transform="translate(${cx},${cy})">${fn(iconScale)
        .replace('<svg ', '<svg x="0" y="0" ')}</g>`;
    };
    /* nested svg inside g: simplest is foreignObject-free direct embed */
    svg += icon(hypLinA, -0.5) + icon(hypLinB, 2.5) + icon(hypCurve, 5.5) + icon(hypWiggly, 8.5);

    let html = '';
    html += label(m, 10.28, 0, '\\(\\varphi\\)', { size: 17 });         /* node[right] of x axis */
    html += label(m, -1.9, 4.0, `\\(${labelTex}\\)`, { anchor: 's', size: 17 }); /* node[above] of y axis */
    html += label(m, 1.0, 0.35, '\\(\\cdots\\)', { size: 17 });
    html += label(m, 4.05, 0.35, '\\(\\cdots\\)', { size: 17 });
    html += label(m, 7.1, 0.35, '\\(\\cdots\\)', { size: 17 });

    return host(m, svg, html);
  }

  /* =============================================================
     Renderer: walk the injected slides and fill every [data-fig].
  ============================================================= */
  function renderAll(root) {
    root.querySelectorAll('[data-fig]').forEach(el => {
      const kind = el.dataset.fig;
      let m = null;
      if (kind === 'feature-plot') {
        el.innerHTML = featurePlot(el.dataset.variant);
        m = mapper([-0.5, -0.5, 6.4, 4.6], 0.85);
      } else if (kind === 'metapanel') {
        el.innerHTML = metapanel(el.dataset.label,
          el.dataset.bars.split(',').map(Number));
        m = mapper([-2.55, -2.62, 10.75, 4.35], 0.5);
      } else if (kind === 'icon') {
        const scale = parseFloat(el.dataset.scale || '1');
        el.innerHTML = ICONS[el.dataset.icon](scale);
        el.classList.add('fig-inline');
        return;
      } else {
        return;
      }
      /* fixed-size host = the HTML \fixedbbox: same box every slide */
      el.classList.add('fig-host');
      el.style.width = m.W + 'px';
      el.style.height = m.H + 'px';
    });
  }

  window.Figures = { renderAll };
})();
