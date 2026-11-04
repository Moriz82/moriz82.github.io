// editor.js — Text Editor: read-only view of a post's markdown source.

import { esc } from '../lib.js';
import { WM } from '../wm.js';

function hl(line) {
  const e = esc(line);
  if (/^---\s*$/.test(line)) return `<span class="c">${e}</span>`;
  if (/^:::/.test(line)) return `<span class="m">${e}</span>`;
  if (/^#{1,6}\s/.test(line)) return `<span class="h">${e}</span>`;
  if (/^\s*-?\s*[\w-]+:(\s|$)/.test(line)) return e.replace(/^(\s*-?\s*[\w-]+:)/, '<span class="k">$1</span>');
  return e.replace(/`([^`]+)`/g, '<span class="s">`$1`</span>');
}

export function editorApp(w, o) {
  const p = o.post;
  w.customTitle = true;
  w.ttlEl.innerHTML = `${esc(p.slug)}.md<small>~/${esc(p.sec)}${p.sub ? '/' + esc(p.sub) : ''}</small>`;
  w.title = `${p.slug}.md`;
  w.en.innerHTML = `<button class="hbtn" type="button" data-open="${p.url}">Open in Web</button>`;
  w.body.innerHTML = '<div class="loading">Loading…</div>';
  fetch(p.src).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then(({ md }) => {
    const lines = md.replace(/\n$/, '').split('\n');
    w.body.innerHTML = `<div class="ed"><div class="gut" aria-hidden="true">${lines.map((_, i) => i + 1).join('\n')}</div><pre>${lines.map(hl).join('\n')}</pre></div>`;
  }).catch(() => { w.body.innerHTML = '<div class="loading">Could not load the source.</div>'; });
  WM.changed();
}
