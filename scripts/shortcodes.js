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

function corners() {
  return '<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>';
}

function renderImg(a) {
  const src = escapeHtml(a.src || '');
  const alt = escapeHtml(a.alt || a.caption || '');
  const cap = a.caption ? `<figcaption>${escapeHtml(a.caption)}</figcaption>` : '';
  return `<figure class="wp-img">${corners()}<img src="${src}" alt="${alt}" loading="lazy">${cap}</figure>`;
}

function renderTerminal(a, content) {
  const title = escapeHtml(a.title || 'shell');
  const lang = (a.lang || 'bash').replace(/[^a-z0-9-]/gi, '');
  const tx = a.tx ? `<span class="t-tx">TX ${escapeHtml(a.tx)}</span>` : '';
  const rx = a.rx ? `<span class="t-rx">RX ${escapeHtml(a.rx)}</span>` : '';
  const meter = tx || rx ? `<span class="t-meter">${tx}${rx ? ' &middot; ' + rx : ''}</span>` : '';
  const body = escapeHtml(content);
  return `<div class="wp-term">${corners()}
<div class="wp-term-head"><span class="t-title"># ${title}</span>${meter}</div>
<pre class="wp-term-body"><code class="language-${lang}">${body}</code></pre>
</div>`;
}

function renderOpsec(a, content) {
  const title = escapeHtml(a.title || 'OPSEC NOTE');
  const inner = marked.parse(content.trim());
  return `<aside class="wp-opsec">${corners()}<div class="wp-opsec-head"># ${title}</div><div class="wp-opsec-body">${inner}</div></aside>`;
}

function renderStage(a, content) {
  const n = String(a.n || '?').padStart(2, '0');
  const label = escapeHtml(a.label || '');
  const title = escapeHtml(a.title || '');
  const anchor = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `stg-${n}`;
  const inner = marked.parse(content.trim());
  const heading = title ? `<h2 class="wp-stage-title">${title}</h2>` : '';
  return `<section class="wp-stage" id="${anchor}" data-stage="${n}">
<div class="wp-stage-lbl"># STG.${n} &middot; ${label}</div>
${heading}
<div class="wp-stage-body">${inner}</div>
</section>`;
}

function renderCallout(a, content, kind) {
  const title = escapeHtml(a.title || kind.toUpperCase());
  const inner = marked.parse(content.trim());
  return `<aside class="wp-callout wp-${kind}">${corners()}<div class="wp-callout-head"># ${title}</div><div class="wp-callout-body">${inner}</div></aside>`;
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

function preprocess(md) {
  md = md.replace(/^:::\s+img\s+([^\n]+)\s*$/gm, (_, attrs) => renderImg(parseAttrs(attrs)));

  const LEAF = /^:::\s+(terminal|opsec|note|warn|tip)([^\n]*)\n([\s\S]*?)\n:::\s*$/gm;
  md = md.replace(LEAF, (_, name, attrs, content) => renderBlock(name, parseAttrs(attrs), content));

  const STAGE = /^:::\s+stage([^\n]*)\n([\s\S]*?)\n:::\s*$/gm;
  md = md.replace(STAGE, (_, attrs, content) => renderStage(parseAttrs(attrs), content));

  md = md.replace(/\{(red|ok|warn|cool|dim|ink):([^}]+)\}/g, (_, color, text) =>
    `<span class="hl-${color}">${escapeHtml(text)}</span>`
  );

  md = md.replace(/==([^=]+)==/g, (_, text) => `<mark>${escapeHtml(text)}</mark>`);

  return md;
}

module.exports = { preprocess };
