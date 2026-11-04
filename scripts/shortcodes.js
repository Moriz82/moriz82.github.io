/* shortcodes.js — preprocess custom writeup shortcodes before marked.
 *
 * Block form:
 *   ::: name key="val" key2="val2"
 *   ...inner content (markdown OK)...
 *   :::
 *
 * Single-line form (img):
 *   ::: img src="..." caption="..." alt="..."
 */

const { marked } = require('marked');
const hljs = require('highlight.js');

// Syntax highlighting happens at build time so pages ship no highlighter and
// code blocks don't repaint after load.
function highlightCode(code, lang) {
  const l = String(lang || '').toLowerCase();
  if (l && hljs.getLanguage(l)) {
    try { return { html: hljs.highlight(code, { language: l, ignoreIllegals: true }).value, lang: l }; } catch (e) { /* fall through */ }
  }
  if (!l) {
    const auto = hljs.highlightAuto(code);
    return { html: auto.value, lang: auto.language || 'plaintext' };
  }
  return { html: escapeHtml(code), lang: l };
}

marked.use({
  renderer: {
    code(code, infostring) {
      const h = highlightCode(code, String(infostring || '').trim().split(/\s+/)[0]);
      return `<pre><code class="hljs language-${h.lang}">${h.html}</code></pre>\n`;
    },
  },
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function parseAttrs(s) {
  const out = {};
  if (!s) return out;
  // Matches: key="quoted val", key='quoted', or key=unquoted (stops at whitespace)
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;
  let m;
  while ((m = re.exec(s))) out[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

// Stage labels arrive uppercase in front-matter ("RECON"); show them in
// sentence case unless they're short acronyms ("LFI", "RCE").
function labelCase(s) {
  const t = String(s || '').trim();
  if (t !== t.toUpperCase()) return t;
  if (t.length <= 3) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function renderImg(a) {
  const src = escapeHtml(a.src || '');
  const alt = escapeHtml(a.alt || a.caption || '');
  const cap = a.caption ? `<figcaption>${escapeHtml(a.caption)}</figcaption>` : '';
  return `<figure class="wp-img"><img src="${src}" alt="${alt}" loading="lazy">${cap}</figure>`;
}

function renderTerminal(a, content) {
  const title = escapeHtml(a.title || 'shell');
  const lang = (a.lang || 'bash').replace(/[^a-z0-9-]/gi, '');
  const tx = a.tx ? `<span class="t-tx">TX ${escapeHtml(a.tx)}</span>` : '';
  const rx = a.rx ? `<span class="t-rx">RX ${escapeHtml(a.rx)}</span>` : '';
  const meter = tx || rx ? `<span class="t-meter">${tx}${rx ? ' &middot; ' + rx : ''}</span>` : '';
  // keep {red:...} marks intact through the highlighter
  const marks = [];
  const raw = content.replace(/\{(red|ok|warn|cool|dim|ink):([^}]+)\}/g, (_, color, text) => {
    marks.push(`<span class="hl-${color}">${escapeHtml(text)}</span>`);
    return `RCMARK${marks.length - 1}X`;
  });
  const h = highlightCode(raw, lang);
  const body = h.html.replace(/RCMARK(\d+)X/g, (_, i) => marks[+i]);
  return `<div class="wp-term">
<div class="wp-term-head"><span class="t-title">${title}</span>${meter}</div>
<pre class="wp-term-body"><code class="hljs language-${h.lang}">${body}</code></pre>
</div>`;
}

function renderOpsec(a, content) {
  const title = escapeHtml(a.title || 'OPSEC note');
  const inner = marked.parse(content.trim());
  return `<aside class="wp-opsec"><div class="wp-opsec-head">${title}</div><div class="wp-opsec-body">${inner}</div></aside>`;
}

function renderStage(a, content, inline) {
  const n = String(a.n || '?');
  const label = escapeHtml(labelCase(a.label || ''));
  const title = a.title ? marked.parseInline(a.title) : '';
  const anchor = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `stg-${n}`;
  const inner = marked.parse(inline(content.trim()));
  const heading = title ? `<h2 class="wp-stage-title">${title}</h2>` : '';
  return `<section class="wp-stage" id="${anchor}" data-stage="${n}">
<div class="wp-stage-lbl">Stage ${n} &middot; ${label}</div>
${heading}
<div class="wp-stage-body">${inner}</div>
</section>`;
}

function renderCallout(a, content, kind) {
  const defaults = { note: 'Note', warn: 'Warning', tip: 'Tip' };
  const title = escapeHtml(labelCase(a.title || defaults[kind] || kind));
  const inner = marked.parse(content.trim());
  return `<aside class="wp-callout wp-${kind}"><div class="wp-callout-head">${title}</div><div class="wp-callout-body">${inner}</div></aside>`;
}

function renderBlock(name, attrs, content) {
  switch (name) {
    case 'terminal':    return renderTerminal(attrs, content);
    case 'opsec':       return renderOpsec(attrs, content);
    case 'stage':       return renderStage(attrs, content);
    case 'note':        return renderCallout(attrs, content, 'note');
    case 'warn':        return renderCallout(attrs, content, 'warn');
    case 'tip':         return renderCallout(attrs, content, 'tip');
    default:
      return `<!-- unknown shortcode: ${name} -->\n${content}`;
  }
}

// Rendered blocks are parked behind HTML-comment placeholders while marked runs.
// Terminal output contains blank lines, and a blank line ends a CommonMark HTML
// block, which used to leave the markdown that followed a terminal unrendered.
function inlineMarks(s) {
  return s
    .replace(/\{(red|ok|warn|cool|dim|ink):([^}]+)\}/g, (_, color, text) => `<span class="hl-${color}">${escapeHtml(text)}</span>`)
    .replace(/==([^=\n]+)==/g, (_, text) => `<mark>${escapeHtml(text)}</mark>`);
}

function preprocess(md) {
  const store = [];
  const keep = (html) => { store.push(html); return `\n\n<!--sc:${store.length - 1}-->\n\n`; };

  md = md.replace(/^:::\s+img\s+([^\n]+)\s*$/gm, (_, attrs) => keep(renderImg(parseAttrs(attrs))));

  const LEAF = /^:::\s+(terminal|opsec|note|warn|tip)([^\n]*)\n([\s\S]*?)\n:::\s*$/gm;
  md = md.replace(LEAF, (_, name, attrs, content) => keep(inlineMarks(renderBlock(name, parseAttrs(attrs), content))));

  const STAGE = /^:::\s+stage([^\n]*)\n([\s\S]*?)\n:::\s*$/gm;
  md = md.replace(STAGE, (_, attrs, content) => keep(renderStage(parseAttrs(attrs), content, inlineMarks)));

  const restoreOne = (html) => html.replace(/<!--sc:(\d+)-->/g, (_, i) => restoreOne(store[+i]));
  return { md: inlineMarks(md), restore: restoreOne };
}

module.exports = { preprocess, labelCase };
