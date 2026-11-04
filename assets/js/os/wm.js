// wm.js — floating window manager: open/focus/minimize/maximize/close, drag, resize, edge snapping, tiling.

import { OS, $, $$, esc, root, mq, isMobile, inOverview } from './lib.js';
import { Y } from './icons.js';

const layer = () => document.getElementById('layer');
let snapEl = null;

function snapPreview(kind) {
  if (!kind) { if (snapEl) { snapEl.remove(); snapEl = null; } return; }
  if (!snapEl) { snapEl = document.createElement('div'); snapEl.className = 'snap'; layer().appendChild(snapEl); }
  const ar = WM.area(), g = 8;
  const r = kind === 'max' ? [g, g, ar.width - g * 2, ar.height - g * 2]
    : kind === 'left' ? [g, g, ar.width / 2 - g * 1.5, ar.height - g * 2]
    : [ar.width / 2 + g / 2, g, ar.width / 2 - g * 1.5, ar.height - g * 2];
  Object.assign(snapEl.style, { left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px' });
}

export const hbtn = (icon, label, cls) => `<button class="hbtn ${cls || ''}" type="button" aria-label="${label}" title="${label}">${icon}</button>`;

// Window ids opened on a phone, each with its own history entry (newest last).
const mstack = [];

export const WM = {
  wins: [], z: 100, seq: 0, active: null,
  area() { return layer().getBoundingClientRect(); },

  open(app, o = {}) {
    const A = OS.APPS[app];
    if (!A) return null;
    if (A.single) {
      const ex = this.wins.find((w) => w.app === app);
      if (ex) { this.show(ex); if (A.reopen) A.reopen(ex, o); return ex; }
    }
    OS.exitOverview && OS.exitOverview(true);
    OS.hidePops && OS.hidePops();
    const el = document.createElement('section');
    el.className = 'win opening';
    el.setAttribute('role', 'dialog');
    el.innerHTML = `<header class="hb"><div class="st"><button class="hbtn back" type="button" aria-label="Close">${Y.x}</button></div><div class="ttl"></div><div class="en"><span class="x-en" style="display:flex;gap:4px"></span><div class="wbtns"><button class="m" type="button" aria-label="Minimize">${Y.minus}</button><button class="M" type="button" aria-label="Maximize">${Y.maxi}</button><button class="x" type="button" aria-label="Close">${Y.x}</button></div></div></header><div class="wb"></div><i class="rz rz-e"></i><i class="rz rz-w"></i><i class="rz rz-s"></i><i class="rz rz-se"></i><i class="rz rz-sw"></i>`;
    const w = { id: ++this.seq, app, el, body: $('.wb', el), st: $('.hb .st', el), en: $('.x-en', el), ttlEl: $('.ttl', el), max: false, min: false, snapped: null, prev: null, title: A.title, path: o.path || null };
    el.setAttribute('aria-label', A.title);
    const ar = this.area(), n = this.wins.filter((x) => !x.min).length;
    const W = Math.min(A.w, ar.width - 30), H = Math.min(A.h, ar.height - 20);
    let X = (ar.width - W) / 2 + (A.center ? 0 : (n % 5) * 28 - 40);
    let Y0 = (ar.height - H) / 2 - 10 + (A.center ? 0 : (n % 5) * 24 - 30);
    X = Math.max(A.center ? 0 : Math.min(230, ar.width - W), Math.min(X, ar.width - W - 10));
    Object.assign(el.style, { left: Math.max(0, X) + 'px', top: Math.max(0, Y0) + 'px', width: W + 'px', height: H + 'px' });
    layer().appendChild(el);
    el.addEventListener('animationend', () => el.classList.remove('opening'), { once: true });
    this.wins.push(w);
    this.bind(w);
    A.render(w, o);
    if (!w.customTitle) this.setTitle(w, w.title);
    if (o.max || A.max) this.maximize(w, true);
    this.focus(w);
    if (isMobile() && app !== 'web' && o.push !== false) {
      mstack.push(w.id);
      history.pushState({ m: w.id }, '', location.href);
    }
    return w;
  },

  setTitle(w, t, sub) {
    w.title = t;
    w.el.setAttribute('aria-label', t);
    if (!w.customTitle) w.ttlEl.innerHTML = esc(t) + (sub ? `<small>${esc(sub)}</small>` : '');
    this.changed();
  },
  changed() { OS.renderDock && OS.renderDock(); },
  focus(w) {
    if (!w) return;
    this.wins.forEach((x) => x.el.classList.toggle('focus', x === w));
    w.el.style.zIndex = ++this.z;
    this.active = w;
    this.changed();
    const A = OS.APPS[w.app];
    if (A.onfocus) A.onfocus(w);
  },
  show(w) { w.min = false; w.el.classList.remove('min'); OS.exitOverview && OS.exitOverview(true); this.focus(w); },
  top() { return this.wins.filter((x) => !x.min).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0] || null; },
  minimize(w) {
    w.min = true; w.el.classList.add('min');
    if (this.active === w) { this.active = null; w.el.classList.remove('focus'); const t = this.top(); if (t) this.focus(t); }
    this.changed();
  },
  geom(w) { const s = w.el.style; return { left: s.left, top: s.top, width: s.width, height: s.height }; },
  animate(w) { if (mq.reduced.matches) return; w.el.classList.add('geo'); setTimeout(() => w.el.classList.remove('geo'), 220); },
  resized(w) { const A = OS.APPS[w.app]; if (A.onresize) A.onresize(w); },
  maximize(w, on) {
    on = on == null ? !w.max : on;
    if (on === w.max) return;
    this.animate(w);
    if (on) { if (!w.snapped) w.prev = this.geom(w); w.max = true; w.el.classList.add('max'); }
    else { w.max = false; w.snapped = null; w.el.classList.remove('max'); if (w.prev) Object.assign(w.el.style, w.prev); }
    this.resized(w);
  },
  place(w, x, y, W, H, tag) {
    if (!w.snapped && !w.max) w.prev = this.geom(w);
    w.max = false; w.el.classList.remove('max'); w.snapped = tag || 'snap';
    this.animate(w);
    Object.assign(w.el.style, { left: x + 'px', top: y + 'px', width: W + 'px', height: H + 'px' });
    this.resized(w);
  },
  snapHalf(w, side) { const ar = this.area(); this.place(w, side === 'left' ? 0 : ar.width / 2, 0, ar.width / 2, ar.height, side); },
  close(w) {
    const mi = mstack.indexOf(w.id);
    if (mi !== -1 && !w.popping) {
      // let Back do the closing so the history entry goes away with the window
      if (mi === mstack.length - 1 && history.state && history.state.m === w.id) { history.back(); return; }
      mstack.splice(mi, 1);
    }
    const A = OS.APPS[w.app];
    if (A.onclose) A.onclose(w);
    w.el.remove();
    this.wins = this.wins.filter((x) => x !== w);
    if (this.active === w) { this.active = null; const t = this.top(); if (t) this.focus(t); }
    // closing the window the URL points at sends the URL back home
    if (w.path && w.path === location.pathname && w.path !== '/') {
      history.replaceState(null, '', '/');
      document.title = OS.data.site.name;
    }
    this.changed();
  },
  // popstate on a phone: close the newest app if its entry was just popped.
  popMobile(state) {
    if (state && state.m && !mstack.includes(state.m)) return true; // forward into a closed app: ignore
    if (!mstack.length) return false;
    const top = mstack[mstack.length - 1];
    if (state && state.m === top) return false;
    mstack.pop();
    const w = this.wins.find((x) => x.id === top);
    if (w) { w.popping = true; this.close(w); }
    return true;
  },
  tile() {
    const vis = this.wins.filter((w) => !w.min).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
    if (!vis.length) return;
    if (vis.length === 1) return this.maximize(vis[0], true);
    const ar = this.area(), g = 8, mw = Math.round((ar.width - g * 3) * 0.58);
    this.place(vis[0], g, g, mw, ar.height - g * 2, 'tile');
    const rest = vis.slice(1), sh = (ar.height - g * (rest.length + 1)) / rest.length;
    rest.forEach((w, i) => this.place(w, g * 2 + mw, g + i * (sh + g), ar.width - mw - g * 3, sh, 'tile'));
  },
  showDesktop() {
    const vis = this.wins.filter((w) => !w.min);
    if (vis.length) vis.forEach((w) => this.minimize(w));
    else this.wins.forEach((w) => this.show(w));
  },

  bind(w) {
    const el = w.el, hb = $('.hb', el);
    el.addEventListener('pointerdown', () => { if (!inOverview() && this.active !== w) this.focus(w); }, true);
    el.addEventListener('click', (e) => { if (inOverview()) { e.preventDefault(); e.stopPropagation(); this.show(w); } }, true);
    $('.m', el).addEventListener('click', () => this.minimize(w));
    $('.M', el).addEventListener('click', () => this.maximize(w));
    $('.x', el).addEventListener('click', () => this.close(w));
    $('.back', el).addEventListener('click', () => this.close(w));
    hb.addEventListener('dblclick', (e) => { if (!e.target.closest('button,input,a,.url,.pathbar')) this.maximize(w); });

    hb.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button,input,a,.url,.pathbar') || isMobile() || inOverview()) return;
      const ar = this.area(), sx = e.clientX, sy = e.clientY, r = el.getBoundingClientRect();
      let ox = sx - r.left, oy = sy - r.top, moved = false, snap = null;
      hb.setPointerCapture(e.pointerId);
      const move = (ev) => {
        if (!moved) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
          moved = true;
          if (w.max || w.snapped) {
            const pw = w.prev ? parseFloat(w.prev.width) : r.width, ratio = (sx - r.left) / r.width;
            w.max = false; w.snapped = null; el.classList.remove('max');
            if (w.prev) { el.style.width = w.prev.width; el.style.height = w.prev.height; }
            ox = pw * ratio; oy = 20;
          }
        }
        el.style.left = Math.max(-el.offsetWidth + 100, Math.min(ev.clientX - ar.left - ox, ar.width - 100)) + 'px';
        el.style.top = Math.max(0, Math.min(ev.clientY - ar.top - oy, ar.height - 46)) + 'px';
        const px = ev.clientX - ar.left, py = ev.clientY - ar.top;
        snap = py <= 2 ? 'max' : px <= 2 ? 'left' : px >= ar.width - 2 ? 'right' : null;
        snapPreview(snap);
      };
      const up = () => {
        hb.removeEventListener('pointermove', move); hb.removeEventListener('pointerup', up); hb.removeEventListener('pointercancel', up);
        snapPreview(null);
        if (snap === 'max') { w.prev = { ...this.geom(w), top: '30px' }; w.snapped = 'pre'; this.maximize(w, true); }
        else if (snap) this.snapHalf(w, snap);
        else if (moved) this.resized(w);
      };
      hb.addEventListener('pointermove', move); hb.addEventListener('pointerup', up); hb.addEventListener('pointercancel', up);
    });

    $$('.rz', el).forEach((h) => h.addEventListener('pointerdown', (e) => {
      if (isMobile() || w.max) return;
      e.preventDefault(); e.stopPropagation(); this.focus(w);
      const dir = h.className.match(/rz-(\w+)/)[1], sx = e.clientX, sy = e.clientY, sw = el.offsetWidth, sh = el.offsetHeight, sl = el.offsetLeft;
      h.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (dir.includes('e')) el.style.width = Math.max(320, sw + dx) + 'px';
        if (dir.includes('w')) { const nw = Math.max(320, sw - dx); el.style.width = nw + 'px'; el.style.left = (sl + sw - nw) + 'px'; }
        if (dir.includes('s')) el.style.height = Math.max(200, sh + dy) + 'px';
        w.snapped = null;
      };
      const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); this.resized(w); };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up);
    }));
  },
};

OS.WM = WM;
