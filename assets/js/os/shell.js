// shell.js — GNOME shell chrome: top bar + popovers, dock, Activities overview, app grid,
// desktop icons, context menus, notifications, link routing and keyboard shortcuts.

import { OS, $, $$, esc, root, LS, mq, isMobile, inOverview, posts, fsPath } from './lib.js';
import { WM } from './wm.js';
import { I, Y, AVATAR, postIcon, folderIcon } from './icons.js';
import { htbBars, htbLast } from './apps/misc.js';

const PINNED = ['files', 'term', 'web', 'editor', 'about', 'certs', 'htb'];

export function initShell() {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="ovl" id="ovl"><label class="ov-search">${Y.search}<input id="ov-q" placeholder="Type to search" autocomplete="off" spellcheck="false" aria-label="Search posts and apps"></label><div class="ov-res" id="ov-res"></div></div>
    <div class="grid-ov" id="grid-ov" aria-label="Applications"></div>
    <nav class="dock" id="dock" aria-label="Dash"></nav>
    <button class="homebar" id="homebar" type="button" aria-label="Home"><i></i></button>
    <div class="pop qs" id="qs" hidden></div>
    <div class="pop dm" id="dm" hidden></div>
    <div class="pop htbpop" id="htbpop" hidden></div>
    <div class="ctx" id="ctx" hidden role="menu"></div>
    <div class="banners" id="banners" aria-live="polite"></div>`);
  // overlay must sit under the window layer so windows stay clickable in the overview
  document.getElementById('layer').before(document.getElementById('ovl'));
  initTopbar();
  initDock();
  initOverview();
  initIcons();
  initRouting();
  initKeys();
  mq.mobile.addEventListener('change', syncMobile);
  syncMobile();
}

/* ── popovers ───────────────────────────────── */
const pop = (id) => document.getElementById(id);
function hidePops() {
  ['qs', 'dm', 'htbpop'].forEach((id) => { pop(id).hidden = true; });
  const c = $('#ctx'); if (c) c.hidden = true;
  $$('.topbar .tbp').forEach((b) => { if (b.id !== 'act-btn') b.classList.remove('on'); });
}
OS.hidePops = hidePops;
function togglePop(id, btn) {
  const was = !pop(id).hidden;
  hidePops(); exitOverview(true); closeGrid();
  if (was) return;
  if (id === 'dm') drawDateMenu();
  pop(id).hidden = false;
  btn.classList.add('on');
}

const notes = [];
let dnd = false;
function initTopbar() {
  const d = OS.data;
  $('#qs-btn').innerHTML = Y.net + Y.vol + Y.bat;
  $('#htb-btn .cube').innerHTML = I.cube;
  $('#act-btn').addEventListener('click', () => (inOverview() ? exitOverview() : enterOverview()));
  $('#qs-btn').addEventListener('click', (e) => { e.stopPropagation(); togglePop('qs', e.currentTarget); });
  $('#clock-btn').addEventListener('click', (e) => { e.stopPropagation(); togglePop('dm', e.currentTarget); });
  $('#htb-btn').addEventListener('click', (e) => { e.stopPropagation(); togglePop('htbpop', e.currentTarget); });

  pop('htbpop').innerHTML = `<div class="big">${d.htb.owned}</div><div class="sub">machines owned · top ${esc(d.htb.percent)}% global</div>${htbBars()}${d.htb.last ? `<div class="last">Last capture: ${htbLast()}</div>` : ''}<button class="btn" type="button" data-app="htb" style="width:100%">Open htb-mon</button>`;
  pop('qs').innerHTML = `<div class="qs-top"><span class="who">${AVATAR}${esc(d.site.user)}</span><span class="acts"><button class="rb" type="button" data-app="settings" title="Settings" aria-label="Settings">${Y.gear}</button><button class="rb" type="button" data-qs="lock" title="Lock" aria-label="Lock">${Y.lock}</button><button class="rb" type="button" data-qs="power" title="Power Off / Log Out" aria-label="Power Off / Log Out">${Y.power}</button></span></div>
    <label class="sl">${Y.vol}<input type="range" value="70" aria-label="Volume"></label><label class="sl">${Y.sun}<input type="range" value="85" aria-label="Brightness"></label>
    <div class="tg"><button class="tile on" type="button" data-tg="net">${Y.net}<span><b>Wired</b><span>Connected</span></span></button><button class="tile on" type="button" data-tg="dark">${Y.moon}<span><b>Dark Style</b></span></button><button class="tile" type="button" data-tg="night">${Y.sun}<span><b>Night Light</b></span></button><button class="tile" type="button" data-tg="dnd">${Y.bell}<span><b>Do Not Disturb</b></span></button></div>
    <div class="pw-menu" hidden><ul class="boxed"><li><button class="row" type="button" data-qs="reboot"><span class="tx"><b>Restart…</b></span></button></li><li><button class="row" type="button" data-qs="halt"><span class="tx"><b>Power Off…</b></span></button></li><li><button class="row" type="button" data-qs="logout"><span class="tx"><b>Log Out</b></span></button></li></ul></div>`;
  pop('qs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tg]');
    if (t && t.dataset.tg !== 'dark') { t.classList.toggle('on'); if (t.dataset.tg === 'dnd') dnd = t.classList.contains('on'); }
    const q = e.target.closest('[data-qs]'); if (!q) return;
    if (q.dataset.qs === 'power') { const m = $('.pw-menu', pop('qs')); m.hidden = !m.hidden; return; }
    hidePops();
    ({ lock: () => OS.lock(), reboot: () => OS.boot(), halt: () => OS.halt(), logout: () => OS.logout() })[q.dataset.qs]();
  });
  pop('dm').addEventListener('click', (e) => {
    if (e.target.closest('[data-clear]')) { notes.length = 0; drawDateMenu(); return; }
    const n = e.target.closest('[data-n]'); if (n) { const x = notes[+n.dataset.n]; hidePops(); if (x.go) x.go(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.pop,.tbp,.ctx')) hidePops(); });
  const tick = () => {
    const now = new Date(), hm = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const txt = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + '  ' + hm;
    $('#clk').textContent = txt;
    const g = $('#g-clk'); if (g) g.textContent = txt;
    $('#tb-l').dataset.time = hm;
  };
  tick(); setInterval(tick, 10000);
}
function drawDateMenu() {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), prev = new Date(y, m, 0).getDate();
  let cells = '';
  const total = Math.ceil((first + days) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const n = i - first + 1;
    cells += n < 1 ? `<span class="out">${prev + n}</span>` : n > days ? `<span class="out">${n - days}</span>` : `<span${n === d.getDate() ? ' class="today"' : ''}>${n}</span>`;
  }
  pop('dm').innerHTML = `<div class="dm-n"><h4>Notifications</h4>${notes.length ? notes.slice().reverse().map((n, i) => `<button class="note-row" type="button" data-n="${notes.length - 1 - i}">${n.icon || I.welcome}<span><b>${esc(n.title)}</b><span>${esc(n.body)}</span></span></button>`).join('') + '<button class="btn" type="button" data-clear style="align-self:flex-end;margin-top:auto">Clear</button>' : '<div class="dm-empty">No Notifications</div>'}</div>
    <div class="dm-c"><h4>${d.toLocaleDateString('en-US', { weekday: 'long' })}</h4><div class="day">${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div><div class="cal">${'SMTWTFS'.split('').map((x) => `<b>${x}</b>`).join('')}${cells}</div></div>`;
}

/* ── notifications + clipboard ──────────────── */
function banner(n) {
  if (!n.transient) notes.push(n);
  if (dnd && !n.transient) return;
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'ban';
  el.innerHTML = `${n.icon || I.welcome}<div><b>${esc(n.title)}</b><span>${esc(n.body)}</span></div>`;
  el.addEventListener('click', () => { el.remove(); if (n.go) n.go(); });
  $('#banners').appendChild(el);
  setTimeout(() => el.remove(), n.ms || 6000);
}
OS.banner = banner;
OS.copy = (t) => {
  const ok = () => banner({ icon: I.files, title: 'Copied to clipboard', body: t, ms: 3000, transient: true });
  const fail = () => banner({ icon: I.files, title: 'Copy this', body: t, ms: 6000, transient: true });
  try { navigator.clipboard.writeText(t).then(ok, fail); } catch (e) { fail(); }
};

/* ── context menu ───────────────────────────── */
function showCtx(x, y, items, above) {
  const ctx = $('#ctx');
  const list = items.filter(Boolean);
  ctx.innerHTML = list.map((it) => (it === '-' ? '<hr>' : `<button type="button" role="menuitem">${esc(it[0])}${it[2] ? `<kbd>${it[2]}</kbd>` : ''}</button>`)).join('');
  const fns = list.filter((it) => it !== '-');
  $$('button', ctx).forEach((b, i) => b.addEventListener('click', () => { hidePops(); fns[i][1](); }));
  ctx.hidden = false;
  const r = ctx.getBoundingClientRect();
  ctx.style.left = Math.max(6, Math.min(x - (above ? r.width / 2 : 0), innerWidth - r.width - 6)) + 'px';
  ctx.style.top = Math.max(6, above ? y - r.height : Math.min(y, innerHeight - r.height - 6)) + 'px';
  const first = $('button', ctx); if (first) first.focus({ preventScroll: true });
}
OS.showCtx = showCtx;

/* ── dock ───────────────────────────────────── */
function renderDock() {
  const running = [...new Set(WM.wins.map((w) => w.app))];
  const apps = [...PINNED, ...running.filter((a) => !PINNED.includes(a))];
  $('#dock').innerHTML = apps.map((a) => {
    const n = WM.wins.filter((w) => w.app === a).length;
    return `<button class="dk" type="button" data-dk="${a}" aria-label="${OS.APPS[a].title}"><span class="ico">${OS.APPS[a].icon()}</span><span class="tip">${OS.APPS[a].title}</span><span class="dots">${'<i></i>'.repeat(Math.min(n, 3))}</span></button>`;
  }).join('') + `<span class="dk-sep"></span><button class="dk" type="button" data-dk="__grid" aria-label="Show Apps"><span class="ico">${I.appgrid}</span><span class="tip">Show Apps</span></button>`;
}
OS.renderDock = renderDock;
function initDock() {
  renderDock();
  $('#dock').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dk]'); if (!b) return;
    const a = b.dataset.dk;
    if (a === '__grid') return toggleGrid();
    closeGrid();
    const ws = WM.wins.filter((w) => w.app === a).sort((x, y) => y.el.style.zIndex - x.el.style.zIndex);
    if (!ws.length) return OS.openApp(a);
    exitOverview(true);
    const t = ws[0];
    if (t === WM.active && !t.min && ws.length === 1) WM.minimize(t);
    else if (t === WM.active && !t.min) WM.focus(ws[ws.length - 1]);
    else WM.show(t);
  });
  $('#dock').addEventListener('contextmenu', (e) => {
    const b = e.target.closest('[data-dk]'); if (!b || b.dataset.dk === '__grid') return;
    e.preventDefault(); e.stopPropagation();
    const a = b.dataset.dk, ws = WM.wins.filter((w) => w.app === a), A = OS.APPS[a];
    showCtx(e.clientX, e.clientY - 10, [
      ...ws.map((w) => [w.title, () => WM.show(w)]),
      ws.length ? '-' : null,
      [A.single && ws.length ? 'Show' : 'New Window', () => (a === 'web' && ws.length ? ws[0].go('about:newtab', { newTab: true }) : a === 'files' ? WM.open('files', { path: '~' }) : OS.openApp(a))],
      ws.length ? ['Quit', () => ws.forEach((w) => WM.close(w))] : null,
    ], true);
  });
  $('#homebar').addEventListener('click', () => WM.wins.forEach((w) => WM.minimize(w)));
}

/* ── app grid ───────────────────────────────── */
function toggleGrid(on) {
  on = on == null ? !root.classList.contains('apps') : on;
  hidePops(); exitOverview(true);
  root.classList.toggle('apps', on);
  if (on) {
    renderGrid();
  }
}
const gaBtn = (a) => `<button class="ga" type="button" data-ga="${a}">${OS.APPS[a].icon()}<span>${OS.APPS[a].title}</span></button>`;
const inFolder = (f) => Object.keys(OS.APPS).filter((a) => OS.APPS[a].folder === f);
function renderGrid(folder) {
  const g = $('#grid-ov');
  g.classList.toggle('infold', !!folder);
  if (folder) {
    g.innerHTML = `<div class="gfold" role="dialog" aria-label="${OS.FOLDERS[folder]}"><h3>${OS.FOLDERS[folder]}</h3><div class="gfold-g">${inFolder(folder).map(gaBtn).join('')}</div></div>`;
    return;
  }
  g.innerHTML = [
    ...Object.keys(OS.APPS).filter((a) => a !== 'editor' && !OS.APPS[a].folder).map(gaBtn),
    ...Object.keys(OS.FOLDERS || {}).map((f) => `<button class="ga gf" type="button" data-gf="${f}"><span class="gfi">${inFolder(f).slice(0, 4).map((a) => OS.APPS[a].icon()).join('')}</span><span>${OS.FOLDERS[f]}</span></button>`),
    ...OS.data.sections.map((s) => `<button class="ga" type="button" data-gs="${s.id}">${folderIcon(s.id)}<span>${s.title}</span></button>`),
  ].join('');
}
function closeGrid() { root.classList.remove('apps'); }
OS.closeGrid = closeGrid;

/* ── activities overview ────────────────────── */
let labels = [], results = [], kb = 0;
function layoutOverview() {
  const ovl = $('#ovl');
  labels.forEach((l) => l.remove()); labels = [];
  $$('.ov-empty', ovl).forEach((x) => x.remove());
  const vis = WM.wins.filter((w) => !w.min).sort((a, b) => a.id - b.id);
  const ar = WM.area(), topPad = 80, pad = 30;
  if (!vis.length) { ovl.insertAdjacentHTML('beforeend', '<div class="ov-empty">No open windows. Type to search.</div>'); return; }
  const n = vis.length, cols = Math.max(1, Math.ceil(Math.sqrt(n * ar.width / (ar.height - topPad) / 1.4))), rows = Math.ceil(n / cols);
  const cw = (ar.width - pad * (cols + 1)) / cols, ch = (ar.height - topPad - pad * (rows + 1)) / rows;
  vis.forEach((w, i) => {
    const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols), off = (cols - inRow) * (cw + pad) / 2;
    const ww = w.max ? ar.width : w.el.offsetWidth, wh = w.max ? ar.height : w.el.offsetHeight;
    const s = Math.min(cw / ww, (ch - 26) / wh, 0.9);
    const cxT = pad + off + c * (cw + pad) + cw / 2, cyT = topPad + pad + r * (ch + pad) + (ch - 26) / 2;
    const cxN = (w.max ? 0 : w.el.offsetLeft) + ww / 2, cyN = (w.max ? 0 : w.el.offsetTop) + wh / 2;
    w.el.style.transform = `translate(${cxT - cxN}px, ${cyT - cyN}px) scale(${s})`;
    const lb = document.createElement('div');
    lb.className = 'ov-label'; lb.textContent = w.title;
    lb.style.left = cxT + 'px'; lb.style.top = (cyT + wh * s / 2 + 8) + 'px';
    ovl.appendChild(lb); labels.push(lb);
  });
}
function enterOverview(focusSearch) {
  if (isMobile()) return;
  hidePops(); closeGrid();
  root.classList.add('ov'); $('#act-btn').classList.add('on');
  $('#ov-q').value = ''; root.classList.remove('searching');
  layoutOverview();
  if (focusSearch !== false) setTimeout(() => $('#ov-q').focus(), 30);
}
function exitOverview() {
  if (!inOverview()) return;
  root.classList.remove('ov', 'searching'); $('#act-btn').classList.remove('on');
  WM.wins.forEach((w) => { w.el.style.transform = ''; });
  labels.forEach((l) => l.remove()); labels = [];
  $$('.ov-empty', $('#ovl')).forEach((x) => x.remove());
  $('#ov-q').blur();
}
OS.enterOverview = enterOverview;
OS.exitOverview = exitOverview;

function search(q) {
  q = q.toLowerCase();
  const apps = Object.keys(OS.APPS).filter((a) => a !== 'editor' && `${OS.APPS[a].title} ${OS.APPS[a].desc || ''}`.toLowerCase().includes(q));
  const secs = OS.data.sections.filter((s) => `${s.id} ${s.desc}`.toLowerCase().includes(q));
  const found = posts().filter((p) => `${p.title} ${p.slug} ${p.tags.join(' ')} ${p.summary}`.toLowerCase().includes(q));
  results = [...apps.map((a) => () => OS.openApp(a)), ...secs.map((s) => () => OS.openFiles(s.id)), ...found.map((p) => () => OS.openPost(p.url))];
  kb = 0;
  let k = 0;
  const appHtml = [...apps.map((a) => `<button class="res-app" type="button" data-r="${k++}">${OS.APPS[a].icon()}<span>${OS.APPS[a].title}</span></button>`), ...secs.map((s) => `<button class="res-app" type="button" data-r="${k++}">${folderIcon(s.id)}<span>${s.title}</span></button>`)].join('');
  const postHtml = found.map((p) => `<button class="res-row" type="button" data-r="${k++}">${postIcon(p)}<div><b>${esc(p.title)}</b><span>~/${esc(fsPath(p))}.md · ${esc(p.summary)}</span></div></button>`).join('');
  $('#ov-res').innerHTML = (appHtml ? `<div class="res-apps">${appHtml}</div>` : '') + (postHtml ? `<div class="res-box"><h5>Files</h5>${postHtml}</div>` : '') + (k ? '' : '<div class="res-box none">No results.</div>');
  markKb();
}
function markKb() { $$('[data-r]', $('#ov-res')).forEach((b) => b.classList.toggle('kb', +b.dataset.r === kb)); }
function initOverview() {
  const q = $('#ov-q');
  $('#ovl').addEventListener('click', (e) => { if (e.target.id === 'ovl' || e.target.classList.contains('ov-empty')) exitOverview(); });
  q.addEventListener('input', () => { const v = q.value.trim(); root.classList.toggle('searching', !!v); if (v) search(v); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); if (q.value) { q.value = ''; root.classList.remove('searching'); } else exitOverview(); return; }
    if (!root.classList.contains('searching')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); kb = Math.min(kb + 1, results.length - 1); markKb(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); kb = Math.max(kb - 1, 0); markKb(); }
    if (e.key === 'Enter' && results[kb]) { const f = results[kb]; exitOverview(); f(); }
  });
  $('#ov-res').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { const f = results[+b.dataset.r]; exitOverview(); f(); } });
  $('#grid-ov').addEventListener('click', (e) => {
    const a = e.target.closest('[data-ga]'), s = e.target.closest('[data-gs]'), f = e.target.closest('[data-gf]');
    if (f) return renderGrid(f.dataset.gf);
    // clicking beside an open folder closes the folder, not the grid
    if (!a && $('#grid-ov').classList.contains('infold')) { if (!e.target.closest('.gfold')) renderGrid(); return; }
    closeGrid();
    if (a) OS.openApp(a.dataset.ga);
    if (s) OS.openFiles(s.dataset.gs);
  });
  let hot = 0;
  document.addEventListener('pointermove', (e) => {
    if (e.clientX <= 1 && e.clientY <= 1 && Date.now() - hot > 800 && !isMobile() && !OS.sessionLocked) {
      hot = Date.now();
      if (inOverview()) exitOverview(); else enterOverview();
    }
  }, { passive: true });
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layoutIcons(); if (inOverview()) layoutOverview(); }, 80); });
}

/* ── desktop icons ──────────────────────────── */
const ICON_DEF = {
  home: { icon: () => folderIcon('home'), open: () => OS.openFiles('~') },
  term: { icon: () => I.term, open: () => WM.open('term') },
  web: { icon: () => I.web, open: () => OS.openApp('web') },
  about: { icon: () => I.about, open: () => WM.open('about') },
  certs: { icon: () => I.certs, open: () => WM.open('certs') },
  contacts: { icon: () => I.contacts, open: () => WM.open('contacts') },
  trash: { icon: () => I.trash, open: () => OS.openFiles('trash') },
};
const iconDef = (id) => ICON_DEF[id] || { icon: () => folderIcon(id), open: () => OS.openFiles(id), dir: id };
const CELL = { w: 100, h: 104, x0: 14, y0: 14 };
let iconPos = {};
function layoutIcons() {
  const el = $('#icons');
  const rows = Math.max(1, Math.floor((el.clientHeight - CELL.y0) / CELL.h));
  const icons = $$('.dicon', el);
  const taken = new Set(icons.map((d) => iconPos[d.dataset.id]).filter(Boolean).map((p) => `${p.c},${p.r}`));
  let k = 0;
  icons.forEach((d) => {
    let p = iconPos[d.dataset.id];
    if (!p) {
      while (taken.has(`${Math.floor(k / rows)},${k % rows}`)) k++;
      p = { c: Math.floor(k / rows), r: k % rows }; taken.add(`${p.c},${p.r}`); k++;
    }
    d.style.left = (CELL.x0 + p.c * CELL.w) + 'px';
    d.style.top = (CELL.y0 + Math.min(p.r, rows - 1) * CELL.h) + 'px';
    d._pos = p;
  });
}
function initIcons() {
  const el = $('#icons');
  try { iconPos = JSON.parse(LS.get('rc-icons') || '{}') || {}; } catch (e) { iconPos = {}; }
  $$('.dicon', el).forEach((d) => { $('.g', d).innerHTML = iconDef(d.dataset.id).icon(); d.draggable = false; });
  layoutIcons();
  let drag = null;
  const openIcon = (d) => iconDef(d.dataset.id).open();
  el.addEventListener('pointerdown', (e) => {
    hidePops();
    const ic = e.target.closest('.dicon');
    if (!ic) {
      if (e.button !== 0 || isMobile()) return;
      $$('.dicon.sel', el).forEach((x) => x.classList.remove('sel'));
      const r0 = el.getBoundingClientRect(), sx = e.clientX - r0.left, sy = e.clientY - r0.top;
      const band = document.createElement('div'); band.className = 'band'; el.appendChild(band);
      el.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const x = ev.clientX - r0.left, y = ev.clientY - r0.top, L = Math.min(sx, x), T = Math.min(sy, y), W = Math.abs(x - sx), H = Math.abs(y - sy);
        Object.assign(band.style, { left: L + 'px', top: T + 'px', width: W + 'px', height: H + 'px' });
        $$('.dicon', el).forEach((d) => { const a = d.offsetLeft, b = d.offsetTop; d.classList.toggle('sel', a < L + W && a + d.offsetWidth > L && b < T + H && b + d.offsetHeight > T); });
      };
      const up = () => { band.remove(); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
      return;
    }
    if (e.button !== 0) return;
    if (!e.ctrlKey && !ic.classList.contains('sel')) $$('.dicon.sel', el).forEach((x) => x.classList.remove('sel'));
    ic.classList.add('sel');
    if (isMobile() || e.pointerType === 'touch') return;
    drag = { el: ic, sx: e.clientX, sy: e.clientY, ox: ic.offsetLeft, oy: ic.offsetTop, moved: false, id: e.pointerId };
    ic.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true; drag.el.classList.add('drag');
    drag.el.style.left = (drag.ox + dx) + 'px'; drag.el.style.top = (drag.oy + dy) + 'px';
  });
  el.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; d.el.classList.remove('drag');
    if (!d.moved) return;
    const rows = Math.max(1, Math.floor((el.clientHeight - CELL.y0) / CELL.h));
    const c = Math.max(0, Math.round((d.el.offsetLeft - CELL.x0) / CELL.w)), r = Math.max(0, Math.min(rows - 1, Math.round((d.el.offsetTop - CELL.y0) / CELL.h)));
    const occ = $$('.dicon', el).find((x) => x !== d.el && x._pos && x._pos.c === c && x._pos.r === r);
    if (occ) iconPos[occ.dataset.id] = d.el._pos;
    iconPos[d.el.dataset.id] = { c, r };
    $$('.dicon', el).forEach((x) => { if (!iconPos[x.dataset.id]) iconPos[x.dataset.id] = x._pos; });
    LS.set('rc-icons', JSON.stringify(iconPos));
    layoutIcons();
    d.el.dataset.jd = '1'; setTimeout(() => { delete d.el.dataset.jd; }, 60);
  });
  // links stay real links for no-JS; with JS a desktop icon opens on double-click (single tap on touch, Enter on keyboard)
  el.addEventListener('click', (e) => {
    const ic = e.target.closest('.dicon'); if (!ic) return;
    e.preventDefault();
    if (ic.dataset.jd) return;
    if (e.detail === 0 || mq.coarse.matches || isMobile()) openIcon(ic);
  });
  el.addEventListener('dblclick', (e) => { const ic = e.target.closest('.dicon'); if (ic) { e.preventDefault(); openIcon(ic); } });
  el.addEventListener('contextmenu', (e) => {
    const ic = e.target.closest('.dicon'); if (!ic) return;
    e.preventDefault(); e.stopPropagation();
    const def = iconDef(ic.dataset.id);
    showCtx(e.clientX, e.clientY, [['Open', () => openIcon(ic)], def.dir ? ['Open in Console', () => WM.open('term', { cwd: def.dir })] : null, def.dir ? ['Open in Web', () => OS.openPost(`/${def.dir}/`)] : null]);
  });
}

/* ── link routing + desktop context menu ───── */
function initRouting() {
  document.addEventListener('click', (e) => {
    if (inOverview() || e.defaultPrevented) return;
    const t = e.target.closest('[data-files],[data-app],[data-open],a[href]');
    if (!t || t.closest('#icons')) return;
    if (t.dataset.files) { e.preventDefault(); hidePops(); OS.openFiles(t.dataset.files); return; }
    if (t.dataset.app) { e.preventDefault(); hidePops(); OS.openApp(t.dataset.app); return; }
    const webWin = (() => { const el = t.closest('.win'); return el && WM.wins.find((w) => w.el === el && w.app === 'web'); })();
    if (t.dataset.open) { e.preventDefault(); hidePops(); if (webWin) webWin.nav(t.dataset.open); else OS.route(t.dataset.open); return; }
    if (t.tagName !== 'A' || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    if ((t.target && t.target !== '_self') || t.hasAttribute('download')) return;
    const href = t.getAttribute('href') || '';
    if (href.startsWith('#')) {
      const page = t.closest('.page');
      if (page && href.length > 1) {
        e.preventDefault();
        const target = page.querySelector('#' + CSS.escape(decodeURIComponent(href.slice(1))));
        if (target) page.dataset.full = '1';
        if (target) page.scrollTo({ top: target.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop - 10, behavior: mq.reduced.matches ? 'auto' : 'smooth' });
      }
      return;
    }
    let url;
    try { url = new URL(href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) { t.target = '_blank'; t.rel = 'noopener'; return; }
    if (/\.(png|jpe?g|gif|webp|svg|pdf|json)$/i.test(url.pathname)) { t.target = '_blank'; return; }
    e.preventDefault();
    if (webWin && !['/', '/index.html', '/about.html', '/contact.html'].includes(url.pathname)) webWin.nav(url.pathname, url.hash.slice(1));
    else OS.route(url.pathname);
  });
  window.addEventListener('popstate', (e) => {
    if (WM.popMobile(e.state)) return;
    const p = location.pathname;
    const web = WM.wins.find((w) => w.app === 'web');
    if (p === '/' || p === '/index.html') { if (web && web.path) WM.minimize(web); return; }
    OS.route(p, { push: false, anchor: decodeURIComponent(location.hash.slice(1)) });
  });
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('input,textarea,.pop,.win,.topbar,.dock,.grid-ov,.ovl,.ctx,.dicon')) return;
    e.preventDefault();
    showCtx(e.clientX, e.clientY, [
      ['Open in Console', () => WM.open('term'), 'Alt+Enter'], ['Show Desktop in Files', () => OS.openFiles('~')], '-',
      ['Arrange Icons', () => { iconPos = {}; LS.set('rc-icons', '{}'); layoutIcons(); }], ['Tile Windows', () => WM.tile()], ['Show Desktop', () => WM.showDesktop()], '-',
      ['Settings', () => WM.open('settings')], ['About This System', () => WM.open('about')],
    ]);
  });
}

/* ── keyboard ───────────────────────────────── */
function initKeys() {
  let metaUsed = false;
  document.addEventListener('keydown', (e) => {
    if (OS.sessionLocked) return;
    const typing = document.activeElement && /INPUT|TEXTAREA|CANVAS/.test(document.activeElement.tagName);
    if (e.key === 'Escape') { if ($('#grid-ov').classList.contains('infold')) { renderGrid(); return; } hidePops(); closeGrid(); exitOverview(); return; }
    if (e.key === 'Meta' || e.key === 'OS') { metaUsed = false; return; }
    if (e.metaKey) metaUsed = true;
    if (!typing && !e.altKey && !e.ctrlKey && !e.metaKey && e.key === '/') { e.preventDefault(); enterOverview(); return; }
    // Only Alt combos browsers don't use (Alt+Arrows is Back/Forward, Alt+D/F/T open browser UI),
    // and never while typing, where Alt/Option+Arrow moves by word.
    if (!e.altKey || e.ctrlKey || e.metaKey || typing) return;
    const k = e.key.toLowerCase(), act = WM.active;
    const map = {
      f1: () => (inOverview() ? exitOverview() : enterOverview()), enter: () => WM.open('term'),
      q: () => act && WM.close(act), m: () => act && WM.minimize(act), a: () => toggleGrid(),
    };
    if (map[k]) { e.preventDefault(); map[k](); }
  });
  document.addEventListener('keyup', (e) => {
    if ((e.key === 'Meta' || e.key === 'OS') && !metaUsed && !e.ctrlKey && !e.altKey && !OS.sessionLocked && !isMobile()) {
      if (inOverview()) exitOverview(); else enterOverview();
    }
  });
}

function syncMobile() {
  root.classList.toggle('mobile', mq.mobile.matches);
  if (mq.mobile.matches) exitOverview();
  layoutIcons();
  WM.wins.forEach((w) => WM.resized(w));
}
