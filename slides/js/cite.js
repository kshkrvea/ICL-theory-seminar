/* =====================================================================
   js/cite.js — .bib-driven citations, replacing the hardcoded [1]-[5].

   How it works (Cite.apply() is called at the end of build() in
   js/loader.js, after figures + KaTeX):
     1. fetch references.bib (curated, 15 entries);
     2. collect every marker `<span class="cite" data-cite="key[,key...]">`
        in DOM order — including markers inside <template> pop-up bodies
        (audience-qa), which live in template.content, not the document;
     3. assign numbers by FIRST APPEARANCE in that order;
     4. fill every marker with its "[n]" / "[n, m]" text;
     5. render the cited entries (only those, in number order) into the
        References slide container ([data-references], conclusion.html).

   Outline slides need no special-casing here: js/loader.js emits a
   section's marker only on that section's own divider, so a paper is
   never cited on the main Outline or on a foreign section's divider.

   The BibTeX reader is deliberately minimal: brace/quote/bare field
   values, the accent macros our entries actually use, `--` en-dashes,
   and plain-bibliography-style sentence-casing of titles ({{...}}
   protects case, like bibtex). Uncited .bib entries are ignored, so
   the curated file can hold papers cited only by future slides.
===================================================================== */
(function () {
  'use strict';

  const BIB_URL = 'references.bib';

  /* ---- minimal BibTeX parser ---- */
  function parseBib(src) {
    const entries = {};
    const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const type = m[1].toLowerCase();
      if (type === 'comment' || type === 'preamble' || type === 'string') continue;
      const fields = {};
      let i = re.lastIndex;
      let depth = 1;                       /* inside the entry's outer { } */
      while (i < src.length && depth > 0) {
        /* skip whitespace and commas between fields */
        while (i < src.length && /[\s,]/.test(src[i])) i++;
        if (src[i] === '}') { depth--; i++; break; }
        /* field name */
        const eq = src.indexOf('=', i);
        if (eq === -1) break;
        const name = src.slice(i, eq).trim().toLowerCase();
        i = eq + 1;
        while (i < src.length && /\s/.test(src[i])) i++;
        /* field value: {balanced}, "quoted", or bare until , or } */
        let value = '';
        if (src[i] === '{') {
          let d = 0;
          const start = ++i;
          for (d = 1; i < src.length && d > 0; i++) {
            if (src[i] === '{') d++;
            else if (src[i] === '}') d--;
          }
          value = src.slice(start, i - 1);
        } else if (src[i] === '"') {
          const start = ++i;
          while (i < src.length && src[i] !== '"') i++;
          value = src.slice(start, i);
          i++;
        } else {
          const start = i;
          while (i < src.length && src[i] !== ',' && src[i] !== '}') i++;
          value = src.slice(start, i).trim();
        }
        if (name) fields[name] = value;
      }
      entries[m[2]] = { type, fields };
      re.lastIndex = i;
    }
    return entries;
  }

  /* ---- LaTeX cleanup (only what the curated entries contain) ---- */
  const ACCENTS = [
    [/\{\\ss\}|\\ss(?![a-zA-Z])/g, 'ß'],
    [/\{\\'e\}|\\'e/g, 'é'],
    [/\{\\`e\}|\\`e/g, 'è'],
    [/\{\\"e\}|\\"e/g, 'ë'],
    [/\{\\"u\}|\\"u/g, 'ü'],
    [/\{\\"o\}|\\"o/g, 'ö'],
    [/\{\\"a\}|\\"a/g, 'ä'],
  ];
  function clean(s) {
    let out = String(s);
    for (const [re, ch] of ACCENTS) out = out.replace(re, ch);
    return out
      .replace(/---/g, '—')
      .replace(/--/g, '–')
      .replace(/~/g, ' ')
      .replace(/[{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* plain-style title casing: lowercase everything outside braces except
     the first letter and the first letter after a colon (bibtex "t"). */
  function titleCase(raw) {
    let out = '';
    let depth = 0;
    let keepNext = true;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (c === '{') { depth++; out += c; continue; }
      if (c === '}') { depth = Math.max(0, depth - 1); out += c; continue; }
      if (/[a-zA-Z]/.test(c)) {
        out += (depth > 0 || keepNext) ? c : c.toLowerCase();
        keepNext = false;
      } else {
        out += c;
        if (c === ':') keepNext = true;
        else if (!/\s/.test(c)) keepNext = false;
      }
    }
    return clean(out);
  }

  function formatAuthors(raw) {
    const names = clean(raw).split(/\s+and\s+/).map(n => {
      const parts = n.split(',').map(s => s.trim());
      return parts.length >= 2 ? parts[1] + ' ' + parts[0] : parts[0];
    });
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + ' and ' + names[1];
    return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
  }

  /* "A. Author et al." — first author only, given names cut to one initial,
     "et al." whenever the entry has more. Used by the on-slide [data-cite-full]
     labels, which must stay short; the References slide keeps the full list. */
  function shortAuthorsEtAl(raw) {
    const names = clean(raw).split(/\s+and\s+/).filter(Boolean);
    if (!names.length) return '';
    const parts = names[0].split(',').map(s => s.trim());
    let surname, given;
    if (parts.length >= 2) {
      surname = parts[0];            /* "Hollmann, Noah" */
      given = parts[1];
    } else {
      const toks = names[0].split(/\s+/);   /* "Noah Hollmann" */
      surname = toks.pop();
      given = toks.join(' ');
    }
    const initial = given ? given.trim().charAt(0).toUpperCase() + '. ' : '';
    return initial + surname + (names.length > 1 ? ' et al.' : '');
  }

  /* Venue abbreviations, used ONLY by the on-slide labels (short mode) — the
     References slide keeps the full names. Add a row here when a new venue
     shows up in references.bib; unmatched venues just lose the
     "Proceedings of the 40th " scaffolding. */
  const VENUE_ABBREV = [
    [/international conference on machine learning/i, 'ICML'],
    [/neural information processing systems/i, 'NeurIPS'],
    [/international conference on learning representations/i, 'ICLR'],
    [/artificial intelligence and statistics/i, 'AISTATS'],
    [/computer vision and pattern recognition/i, 'CVPR'],
    [/uncertainty in artificial intelligence/i, 'UAI'],
    [/aaai conference on artificial intelligence/i, 'AAAI'],
    [/journal of machine learning research/i, 'JMLR'],
    [/transactions on machine learning research/i, 'TMLR'],
    [/ieee transactions on neural networks and learning systems/i, 'IEEE TNNLS'],
  ];

  function venueShort(raw) {
    const v = clean(raw);
    for (const [re, abbr] of VENUE_ABBREV) if (re.test(v)) return abbr;
    return v.replace(/^proceedings of (the )?(\d+(st|nd|rd|th)\s+)?/i, '');
  }

  const MONTHS = {
    jan: 'January', feb: 'February', mar: 'March', apr: 'April',
    may: 'May', jun: 'June', jul: 'July', aug: 'August',
    sep: 'September', oct: 'October', nov: 'November', dec: 'December',
  };

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatUrldate(raw) {
    const m = clean(raw).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return clean(raw);
    const [, y, mo, d] = m;
    const month = MONTHS[mo.toLowerCase()] || mo;
    return parseInt(d, 10) + ' ' + month + ' ' + y;
  }

  /* one formatted reference line (plain-bibliography look, matching the
     old main.bbl output the hardcoded list reproduced).
     `short` = the compact on-slide form for [data-cite-full] labels:
     "A. Author et al." instead of the full author list, the venue abbreviated
     (ICML, NeurIPS, ...), and no pages / volume / publisher / URL. */
  function formatEntry(e, short) {
    const f = e.fields;
    const title = f.title ? titleCase(f.title) : '';
    const withDot = t => t + (/[.?!]$/.test(t) ? '' : '.');
    const monthYear = [
      f.month ? (MONTHS[clean(f.month).toLowerCase()] || clean(f.month)) : '',
      f.year ? clean(f.year) : '',
    ].filter(Boolean).join(' ');

    let html = '';
    if (f.author) {
      const a = short ? shortAuthorsEtAl(f.author) : formatAuthors(f.author);
      html = esc(a) + (/\.$/.test(a) ? ' ' : '. ');   /* "et al." already ends in '.' */
    }
    if (e.type === 'article' && f.journal) {
      /* short: abbreviated journal + date only — no volume/number/pages */
      html += esc(withDot(title)) + ' <em>'
            + esc(short ? venueShort(f.journal) : clean(f.journal)) + '</em>';
      if (!short) {
        if (f.volume) {
          html += ', ' + esc(clean(f.volume));
          if (f.number) html += '(' + esc(clean(f.number)) + ')';
          if (f.pages) html += ':' + esc(clean(f.pages));
        } else if (f.pages) {
          html += ', pages ' + esc(clean(f.pages));
        }
      }
      if (monthYear) html += ', ' + monthYear;
      html += '.';
    } else if (e.type === 'inproceedings' && f.booktitle) {
      /* short: "In ICML, July 2023." — no pages, no publisher */
      html += esc(withDot(title)) + ' In <em>'
            + esc(short ? venueShort(f.booktitle) : clean(f.booktitle)) + '</em>';
      if (short) {
        html += monthYear ? ', ' + esc(monthYear) + '.' : '.';
      } else {
        if (f.pages) html += ', pages ' + esc(clean(f.pages));
        html += '.';
        const tail = [f.publisher ? clean(f.publisher) : '', monthYear].filter(Boolean).join(', ');
        if (tail) html += ' ' + esc(tail) + '.';
      }
    } else {
      /* @misc (arXiv) and fallback: "Title, Month Year." like plain.bst */
      html += esc(title);
      if (monthYear) html += ', ' + monthYear + '.';
      else if (title && !/[.?!]$/.test(title)) html += '.';
    }
    if (f.url && !short) {   /* a URL would dwarf an on-slide label */
      html += ' ' + esc(clean(f.url)) + '.';
      if (f.urldate) html += ' Accessed ' + esc(formatUrldate(f.urldate)) + '.';
    }
    return html;
  }

  /* ---- marker collection (DOM order, including <template> bodies) ----
     Two marker kinds share the numbering:
       [data-cite]      -> "[n]"                      (inline citation)
       [data-cite-full] -> "[n]: A. Author et al. ..." (.fig-source slide labels)
     Both are numbered by first appearance, so a figure label reuses the number
     its section divider already assigned rather than creating a new entry. */
  const CITE_SEL = '[data-cite], [data-cite-full]';

  function collectMarkers(slidesEl) {
    const markers = [];
    slidesEl.querySelectorAll('section').forEach(sec => {
      sec.querySelectorAll(CITE_SEL).forEach(el => markers.push(el));
      sec.querySelectorAll('template').forEach(t =>
        t.content.querySelectorAll(CITE_SEL).forEach(el => markers.push(el)));
    });
    return markers;
  }

  const keysOf = el =>
    (el.dataset.cite !== undefined ? el.dataset.cite : el.dataset.citeFull)
      .split(',').map(s => s.trim()).filter(Boolean);

  async function apply(slidesEl) {
    let entries = {};
    try {
      const res = await fetch(BIB_URL);
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      entries = parseBib(await res.text());
    } catch (err) {
      console.error('cite.js: failed to load ' + BIB_URL, err);
    }

    const markers = collectMarkers(slidesEl);

    /* number by first appearance */
    const number = {};
    const order = [];
    for (const el of markers) {
      for (const key of keysOf(el)) {
        if (!(key in number)) {
          number[key] = order.length + 1;
          order.push(key);
          if (!entries[key]) console.error('cite.js: key not in ' + BIB_URL + ':', key);
        }
      }
    }

    for (const el of markers) {
      const keys = keysOf(el);
      if (el.dataset.cite !== undefined) {
        el.textContent = '[' + keys.map(k => number[k] || '?').join(', ') + ']';
      } else {
        el.innerHTML = keys.map(k => {
          const n = number[k] ? '[' + number[k] + ']: ' : '';
          const body = entries[k] ? formatEntry(entries[k], true)
                                  : '<em>missing entry: ' + esc(k) + '</em>';
          return n + body;
        }).join('<br>');
      }
    }

    /* References slide: cited entries only, in number order */
    const refBox = slidesEl.querySelector('[data-references]');
    if (refBox) {
      refBox.innerHTML = order.map((key, i) => {
        const body = entries[key] ? formatEntry(entries[key]) : '<em>missing entry: ' + esc(key) + '</em>';
        return '<div class="ref"><span class="no">[' + (i + 1) + ']</span><span>' + body + '</span></div>';
      }).join('\n');
    }
  }

  /* ---- References pagination -------------------------------------------
     The cited list routinely outgrows one slide. Instead of shrinking the type,
     spill the overflow onto as many extra "References (cont.)" slides as it
     actually takes — none if everything already fits.

     Called from js/loader.js on Reveal's 'ready': only by then do the slides
     have their real geometry, and measuring beats guessing a per-slide count
     (entries wrap to 1-3 lines each). The slide is display:none until it is
     presented, so it is laid out invisibly for the measurement and restored.

     No re-run on resize: --deck-scale scales the type AND the box together,
     so which entries fit does not change. */
  function paginateReferences() {
    const box = document.querySelector('[data-references]');
    if (!box || !box.children.length) return;
    const section = box.closest('section');
    if (!section) return;

    section.style.display = 'flex';       /* reveal's `display` config value */
    section.style.visibility = 'hidden';

    const budget = box.clientHeight;      /* .frame-body is flex:1 => the free space */
    const pages = [[]];
    let used = 0;
    for (const row of Array.from(box.children)) {
      const h = row.offsetHeight + parseFloat(getComputedStyle(row).marginBottom) || 0;
      if (used + h > budget && pages[pages.length - 1].length) {
        pages.push([]);
        used = 0;
      }
      pages[pages.length - 1].push(row);
      used += h;
    }

    section.style.display = '';
    section.style.visibility = '';

    if (pages.length < 2) return;         /* one slide was enough */

    let anchor = section;
    for (let p = 1; p < pages.length; p++) {
      const sec = document.createElement('section');
      sec.id = 'references-' + (p + 1);
      sec.innerHTML =
        '<header class="frame-head"><h2 class="frame-title">References (cont.)</h2></header>' +
        '<div class="frame-body references"></div>';
      const body = sec.querySelector('.references');
      pages[p].forEach(row => body.appendChild(row));   /* moves them off slide 1 */
      anchor.parentNode.insertBefore(sec, anchor.nextSibling);
      anchor = sec;
    }
    if (window.Reveal && Reveal.isReady()) Reveal.sync();   /* register the new slides */
  }

  window.Cite = { apply, paginateReferences };
})();
