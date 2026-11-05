// misc.js — Certificates, htb-mon, Settings, Snake.

import { OS, $, $$, esc, root, LS } from '../lib.js';
import { WM } from '../wm.js';
import { Y } from '../icons.js';

const badge = (name, c) => `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 3l25 14v30L32 61 7 47V17z" fill="${c}"/><path d="M32 9l20 11.5v23L32 55 12 43.5v-23z" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.5"/><text x="32" y="${name.length > 5 ? 36 : 38}" text-anchor="middle" font-family="Cantarell, sans-serif" font-weight="700" font-size="${name.length > 6 ? 8 : name.length > 4 ? 10 : 12}" fill="#fff">${esc(name)}</text></svg>`;

export function certsApp(w) {
  w.body.innerHTML = `<div class="certs">${OS.data.site.certs.map((c) => `<div class="cert">${c.logo ? `<span class="cert-art"><img src="${esc(c.logo)}" alt="" width="72" height="72" loading="lazy"></span>` : badge(c.name, c.color || '#3d3846')}<b>${esc(c.full)}</b><span>${esc(c.issuer)}</span></div>`).join('')}</div>`;
}

const COLORS = { Easy: 'var(--green)', Medium: 'var(--orange)', Hard: 'var(--red)', Insane: 'var(--purple)' };
export const htbBars = () => OS.data.htb.bars.map((b) => `<div class="mon-row"><span>${b.label}</span><span class="track"><span class="fill" style="width:${b.pct}%;background:${COLORS[b.label]}"></span></span><span>${String(b.value).padStart(2, '0')}</span></div>`).join('');
export const htbLast = () => { const l = OS.data.htb.last; return l ? `${esc(l.name)} · ${esc(l.difficulty)} · ${esc(l.os)}` : ''; };

export function htbApp(w) {
  const h = OS.data.htb;
  w.body.innerHTML = `<div class="htbapp"><div><div class="big">${h.owned}</div><div class="c-d">machines owned · top ${esc(h.percent)}% global</div></div><div>${htbBars()}</div>
    <ul class="boxed">${h.last ? `<li class="row"><span class="tx"><b>Last capture</b><span>${htbLast()}</span></span></li>` : ''}<li><a class="row" href="${h.profileUrl}" target="_blank" rel="noopener"><span class="tx"><b>Profile</b><span>app.hackthebox.com/users/${esc(OS.data.site.links.htb.split('/').pop())}</span></span><span class="chev" aria-hidden="true">↗</span></a></li></ul></div>`;
}

const ACCENTS = [['#c80000', 'BlackArch'], ['#3584e4', 'Blue'], ['#2190a4', 'Teal'], ['#3a944a', 'Green'], ['#c88800', 'Yellow'], ['#ed5b00', 'Orange'], ['#d56199', 'Pink'], ['#9141ac', 'Purple'], ['#6f8396', 'Slate']];
export function setAccent(c) {
  const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const lift = (v) => Math.min(255, Math.round(v + (255 - v) * 0.36));
  root.style.setProperty('--accent', c);
  root.style.setProperty('--accent-2', `rgb(${lift(r)},${lift(g)},${lift(b)})`);
  root.style.setProperty('--accent-bg', `rgba(${r},${g},${b},.2)`);
}
export function restoreAccent() { const a = LS.get('rc-accent'); if (a && /^#[0-9a-f]{6}$/i.test(a)) setAccent(a); setWall(LS.get('rc-wall')); }
export function setWall(v) { if (v === 'penguin') root.dataset.wall = v; else delete root.dataset.wall; }

function loadSansFont() {
  if (document.getElementById('font-sans')) return;
  const l = document.createElement('link');
  l.id = 'font-sans'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&display=swap';
  document.head.appendChild(l);
}

export function settingsApp(w) {
  w.body.innerHTML = `<div class="pref">
    <div><h3>Accent color</h3><div class="boxed"><div class="acc">${ACCENTS.map(([c, n]) => `<button type="button" data-acc="${c}" title="${n}" aria-label="${n}" style="background:${c}"></button>`).join('')}</div></div></div>
    <div><h3>Reading</h3><ul class="boxed"><li class="row"><span class="tx"><b>Article font</b><span>Body text in the Web app</span></span><div class="seg"><button type="button" data-v="serif">Serif</button><button type="button" data-v="sans">Sans</button></div></li></ul></div>
    <div><h3>Desktop</h3><ul class="boxed"><li class="row"><span class="tx"><b>Background</b><span>Wallpaper behind the icons</span></span><div class="seg"><button type="button" data-wall="blackarch">BlackArch</button><button type="button" data-wall="penguin">Penguin</button></div></li><li class="row"><span class="tx"><b>Desktop penguin</b><span>Wanders the desktop, naps, types along in the Console</span></span><div class="seg pet-seg"><button type="button" data-pet="on">On</button><button type="button" data-pet="off">Off</button></div></li></ul></div>
    <div><h3>Session</h3><ul class="boxed">
      <li><button class="row" type="button" data-do="reboot"><span class="tx"><b>Replay boot</b><span>GRUB, systemd and the login screen</span></span><span class="chev" aria-hidden="true">›</span></button></li>
      <li><button class="row" type="button" data-do="lock"><span class="tx"><b>Lock screen</b></span><span class="chev" aria-hidden="true">›</span></button></li>
      <li><button class="row" type="button" data-do="tile"><span class="tx"><b>Tile windows</b><span>Master and stack, for the tiling crowd</span></span><span class="chev" aria-hidden="true">›</span></button></li>
    </ul></div></div>`;
  const sync = () => {
    $$('[data-acc]', w.body).forEach((b) => b.classList.toggle('on', b.dataset.acc === (LS.get('rc-accent') || '#c80000')));
    $$('.seg button[data-v]', w.body).forEach((b) => b.classList.toggle('on', b.dataset.v === (root.dataset.body || 'serif')));
    $$('[data-wall]', w.body).forEach((b) => b.classList.toggle('on', b.dataset.wall === (root.dataset.wall || 'blackarch')));
    $$('[data-pet]', w.body).forEach((b) => b.classList.toggle('on', b.dataset.pet === (LS.get('rc-pet') === 'off' ? 'off' : 'on')));
  };
  w.body.addEventListener('click', (e) => {
    const a = e.target.closest('[data-acc]');
    if (a) { LS.set('rc-accent', a.dataset.acc); setAccent(a.dataset.acc); }
    const wl = e.target.closest('[data-wall]');
    if (wl) { LS.set('rc-wall', wl.dataset.wall); setWall(wl.dataset.wall); }
    const pt = e.target.closest('[data-pet]');
    if (pt && OS.setPet) OS.setPet(pt.dataset.pet === 'on');
    const s = e.target.closest('.seg button[data-v]');
    if (s) {
      if (s.dataset.v === 'serif') delete root.dataset.body;
      else { loadSansFont(); root.dataset.body = s.dataset.v; }
      LS.set('rc-body', s.dataset.v);
    }
    const d = e.target.closest('[data-do]');
    if (d) ({ reboot: () => OS.boot(), lock: () => OS.lock(), tile: () => WM.tile() })[d.dataset.do]();
    sync();
  });
  sync();
}

export function snakeApp(w) {
  w.body.innerHTML = `<div class="snake"><div class="hud"><span>score <b class="sc">0</b> · best <b class="bs">${esc(LS.get('rc-snake') || 0)}</b></span><span>arrows or wasd · space restarts</span></div><canvas width="400" height="400" tabindex="0" aria-label="Snake game"></canvas></div>`;
  const cv = $('canvas', w.body), cx = cv.getContext('2d'), N = 20, CS = 20;
  let sn, dir, nd, food, alive, sc;
  const place = () => { do { food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (sn.some((s) => s[0] === food[0] && s[1] === food[1])); };
  const reset = () => { sn = [[9, 10], [8, 10], [7, 10]]; dir = nd = [1, 0]; alive = true; sc = 0; $('.sc', w.body).textContent = 0; place(); };
  const draw = () => {
    const acc = getComputedStyle(root).getPropertyValue('--accent').trim() || '#c80000';
    cx.fillStyle = '#050506'; cx.fillRect(0, 0, 400, 400);
    cx.fillStyle = '#0f0f12';
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) cx.fillRect(i * CS, j * CS, CS, CS);
    cx.fillStyle = '#f2f2f2'; cx.beginPath(); cx.arc(food[0] * CS + 10, food[1] * CS + 10, 6, 0, 7); cx.fill();
    sn.forEach((s, i) => { cx.fillStyle = i ? acc : '#f2f2f2'; cx.fillRect(s[0] * CS + 1, s[1] * CS + 1, CS - 2, CS - 2); });
    if (!alive) {
      cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(0, 0, 400, 400);
      cx.fillStyle = '#fff'; cx.textAlign = 'center';
      cx.font = '700 22px Cantarell, sans-serif'; cx.fillText('Game over', 200, 192);
      cx.font = '14px Fira Code, monospace'; cx.fillText('space to restart', 200, 222);
    }
  };
  const step = () => {
    if (!alive || w.min) return;
    dir = nd;
    const h = [sn[0][0] + dir[0], sn[0][1] + dir[1]];
    if (h[0] < 0 || h[1] < 0 || h[0] >= N || h[1] >= N || sn.some((s) => s[0] === h[0] && s[1] === h[1])) {
      alive = false;
      const b = Math.max(sc, +(LS.get('rc-snake') || 0)); LS.set('rc-snake', b); $('.bs', w.body).textContent = b;
      return draw();
    }
    sn.unshift(h);
    if (h[0] === food[0] && h[1] === food[1]) { sc++; $('.sc', w.body).textContent = sc; place(); } else sn.pop();
    draw();
  };
  const turn = (m) => { if (m[0] !== -dir[0] || m[1] !== -dir[1]) nd = m; };
  cv.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const m = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] }[k];
    if (m) { e.preventDefault(); turn(m); }
    if (k === ' ') { e.preventDefault(); reset(); }
  });
  let sx, sy;
  cv.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  cv.addEventListener('touchend', (e) => {
    if (!alive) return reset();
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
  });
  reset(); draw();
  const timer = setInterval(step, 110);
  w.stop = () => clearInterval(timer);
  w.focusGame = () => cv.focus({ preventScroll: true });
}
