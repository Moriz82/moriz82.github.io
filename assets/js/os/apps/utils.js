// utils.js — the GNOME Utilities folder: Calculator, Clocks, Calendar, System Monitor, Image Viewer.

import { OS, $, $$, esc, root, LS, posts } from '../lib.js';
import { WM } from '../wm.js';
import { I } from '../icons.js';

/* ── Calculator ────────────────────────────── */
// Small recursive-descent parser. No eval.
export function calc(src) {
  const t = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi').replace(/\s+/g, '');
  let i = 0;
  const peek = () => t[i], eat = (c) => (t[i] === c ? (i++, true) : false);
  const fail = () => { throw new Error('Malformed expression'); };
  const prim = () => {
    if (eat('(')) { const v = expr(); if (!eat(')')) fail(); return v; }
    for (const [name, fn] of [['sqrt', Math.sqrt], ['√', Math.sqrt], ['sin', Math.sin], ['cos', Math.cos], ['tan', Math.tan], ['ln', Math.log], ['log', Math.log10]]) {
      if (t.startsWith(name, i)) { i += name.length; return fn(prim()); }
    }
    if (t.startsWith('pi', i)) { i += 2; return Math.PI; }
    if (t[i] === 'e' && !/[a-z]/.test(t[i + 1] || '')) { i++; return Math.E; }
    const m = /^(0x[0-9a-f]+|0b[01]+|\d*\.?\d+(e[+-]?\d+)?)/i.exec(t.slice(i));
    if (!m) fail();
    i += m[0].length;
    return /^0[xb]/i.test(m[0]) ? parseInt(m[0].slice(2), m[0][1].toLowerCase() === 'x' ? 16 : 2) : parseFloat(m[0]);
  };
  const post = () => { let v = prim(); for (;;) { if (eat('!')) { if (v < 0 || v > 170 || v % 1) fail(); let f = 1; for (let k = 2; k <= v; k++) f *= k; v = f; } else if (eat('²')) v *= v; else if (eat('%')) v /= 100; else return v; } };
  const unary = () => (eat('-') ? -unary() : eat('+') ? unary() : post());
  const pow = () => { const b = unary(); return eat('^') ? Math.pow(b, pow()) : b; };
  const term = () => { let v = pow(); for (;;) { if (eat('*')) v *= pow(); else if (eat('/')) v /= pow(); else if (peek() === '(' || (peek() && /[a-zπ√]/i.test(peek()))) v *= pow(); else return v; } };
  const expr = () => { let v = term(); for (;;) { if (eat('+')) v += term(); else if (eat('-')) v -= term(); else return v; } };
  const v = expr();
  if (i < t.length) fail();
  return v;
}
const num = (v) => (!isFinite(v) ? (isNaN(v) ? 'Error' : '∞') : Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-9 && v) ? v.toExponential(8).replace(/\.?0+e/, 'e') : String(+v.toPrecision(12)));

export function calcApp(w) {
  const KEYS = ['7', '8', '9', '÷', '(', ')', '4', '5', '6', '×', 'x²', '√', '1', '2', '3', '−', '%', 'π', '0', '.', '⌫', '+', 'C', '='];
  let ex = '', res = '', ans = 0, hist = [];
  w.body.innerHTML = `<div class="calc"><div class="cdisp"><div class="chist"></div><input class="cin" spellcheck="false" autocomplete="off" aria-label="Expression"><div class="cres">0</div><div class="cbase"></div></div>
    <div class="ckeys">${KEYS.map((k) => `<button type="button" data-k="${k}" class="${/[0-9.π]/.test(k) ? 'nk' : k === '=' ? 'eq' : k === 'C' ? 'cl' : 'op'}">${k}</button>`).join('')}</div></div>`;
  const inp = $('.cin', w.body);
  const show = () => {
    $('.cres', w.body).textContent = res || '0';
    const v = Number(res);
    $('.cbase', w.body).innerHTML = res && Number.isInteger(v) && Math.abs(v) < 2 ** 53
      ? `<span>HEX</span>${(v < 0 ? '-' : '') + Math.abs(v).toString(16).toUpperCase()}<span>BIN</span>${(v < 0 ? '-' : '') + Math.abs(v).toString(2).replace(/\B(?=(\d{4})+(?!\d))/g, ' ')}` : '';
    $('.chist', w.body).innerHTML = hist.slice(-3).map((h) => `<div><span>${esc(h[0])}</span> = <b>${esc(h[1])}</b></div>`).join('');
  };
  const live = () => { ex = inp.value; try { res = ex.trim() ? num(calc(ex.replace(/ans/g, `(${ans})`))) : ''; } catch (e) { res = ''; } show(); };
  const commit = () => {
    if (!inp.value.trim()) return;
    try { const v = calc(inp.value.replace(/ans/g, `(${ans})`)); ans = v; res = num(v); hist.push([inp.value, res]); inp.value = res === 'Error' ? '' : res; }
    catch (e) { res = 'Error'; }
    ex = inp.value; show();
  };
  const ins = (s) => { const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a; inp.value = inp.value.slice(0, a) + s + inp.value.slice(b); inp.setSelectionRange(a + s.length, a + s.length); live(); };
  $('.ckeys', w.body).addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k;
    if (k === '=') commit();
    else if (k === 'C') { inp.value = ''; live(); }
    else if (k === '⌫') { const a = inp.selectionStart ?? inp.value.length; if (a) { inp.value = inp.value.slice(0, a - 1) + inp.value.slice(a); inp.setSelectionRange(a - 1, a - 1); } live(); }
    else ins(k === 'x²' ? '²' : k === '√' ? '√(' : k);
    inp.focus({ preventScroll: true });
  });
  inp.addEventListener('input', live);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); commit(); } if (e.key === 'Escape') { inp.value = ''; live(); } });
  w.focusGame = () => inp.focus({ preventScroll: true });
  show();
}

/* ── Clocks ────────────────────────────────── */
const ZONES = [['Local', null], ['UTC', 'UTC'], ['San Antonio', 'America/Chicago'], ['New York', 'America/New_York'], ['Los Angeles', 'America/Los_Angeles'], ['London', 'Europe/London'], ['Moscow', 'Europe/Moscow'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney']];
const dur = (ms, cs) => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}${cs ? '.' + String(Math.floor((ms % 1000) / 10)).padStart(2, '0') : ''}`; };
export function clocksApp(w) {
  let tab = 'World', swOn = false, swT = 0, swStart = 0, laps = [], tmLeft = 0, tmEnd = 0, tmOn = false, tmSet = 300000;
  w.body.innerHTML = `<div class="clocks"><div class="cltabs"><div class="seg">${['World', 'Stopwatch', 'Timer'].map((t) => `<button type="button" data-o="${t}">${t}</button>`).join('')}</div></div><div class="clbody"></div></div>`;
  const body = $('.clbody', w.body);
  const render = () => {
    $$('.cltabs button', w.body).forEach((b) => b.classList.toggle('on', b.dataset.o === tab));
    if (tab === 'World') body.innerHTML = `<ul class="boxed clw">${ZONES.map(([n, z]) => `<li class="row"><span class="tx"><b>${n}</b><span class="zd" data-z="${z || ''}"></span></span><span class="zt" data-z="${z || ''}"></span></li>`).join('')}</ul>`;
    else if (tab === 'Stopwatch') body.innerHTML = `<div class="clsw"><div class="big swv">00:00.00</div><div class="clbtns"><button type="button" class="btn sug sws">${swOn ? 'Pause' : swT ? 'Resume' : 'Start'}</button><button type="button" class="btn swl"${swOn || swT ? '' : ' disabled'}>${swOn ? 'Lap' : 'Reset'}</button></div><ol class="laps">${laps.map((l, i) => `<li><span>Lap ${i + 1}</span><b>${dur(l, true)}</b></li>`).reverse().join('')}</ol></div>`;
    else body.innerHTML = `<div class="clsw"><div class="big tmv"></div><div class="clpre">${[1, 3, 5, 10, 15, 30].map((m) => `<button type="button" class="btn" data-m="${m}">${m} min</button>`).join('')}</div><div class="clbtns"><button type="button" class="btn sug tms">${tmOn ? 'Pause' : tmLeft ? 'Resume' : 'Start'}</button><button type="button" class="btn tmr"${tmLeft || tmOn ? '' : ' disabled'}>Reset</button></div></div>`;
    tick();
  };
  const tick = () => {
    const now = new Date();
    if (tab === 'World') {
      $$('.zt', body).forEach((el) => { el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: el.dataset.z || undefined }); });
      $$('.zd', body).forEach((el) => {
        const o = { weekday: 'short', month: 'short', day: 'numeric', timeZone: el.dataset.z || undefined };
        const h = +now.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: el.dataset.z || undefined }).replace(/\D/g, '') % 24;
        el.textContent = `${now.toLocaleDateString('en-US', o)} · ${h >= 6 && h < 19 ? 'day' : 'night'}`;
      });
    } else if (tab === 'Stopwatch') { const v = $('.swv', body); if (v) v.textContent = dur(swT + (swOn ? Date.now() - swStart : 0), true); }
    else { const v = $('.tmv', body); if (v) v.textContent = dur(tmOn ? Math.max(0, tmEnd - Date.now()) : tmLeft || tmSet); }
    if (tmOn && Date.now() >= tmEnd) {
      tmOn = false; tmLeft = 0;
      OS.banner({ title: 'Timer finished', body: `${dur(tmSet)} is up.`, icon: I.clocks, go: () => WM.open('clocks') });
      if (tab === 'Timer') render();
    }
  };
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('sws')) { if (swOn) { swT += Date.now() - swStart; swOn = false; } else { swStart = Date.now(); swOn = true; } }
    else if (b.classList.contains('swl')) { if (swOn) { const tot = swT + Date.now() - swStart; laps.push(tot - laps.reduce((a, x) => a + x, 0)); } else { swT = 0; laps = []; } }
    else if (b.dataset.m) { tmSet = +b.dataset.m * 60000; tmOn = false; tmLeft = 0; }
    else if (b.classList.contains('tms')) { if (tmOn) { tmLeft = tmEnd - Date.now(); tmOn = false; } else { tmEnd = Date.now() + (tmLeft || tmSet); tmOn = true; } }
    else if (b.classList.contains('tmr')) { tmOn = false; tmLeft = 0; }
    render();
  });
  $('.cltabs', w.body).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { tab = b.dataset.o; render(); } });
  const timer = setInterval(tick, 50);
  w.stop = () => clearInterval(timer);
  render();
}

/* ── Calendar (post dates are the events) ──── */
export function calendarApp(w) {
  const t = new Date();
  let y = t.getFullYear(), m = t.getMonth(), sel = null;
  const byDay = new Map();
  posts().forEach((p) => { if (!p.date) return; if (!byDay.has(p.date)) byDay.set(p.date, []); byDay.get(p.date).push(p); });
  const key = (Y, M, D) => `${Y}-${String(M + 1).padStart(2, '0')}-${String(D).padStart(2, '0')}`;
  w.body.innerHTML = `<div class="calapp"><div class="calmain"><div class="calhd"><button type="button" class="btn" data-nav="-1" aria-label="Previous month">‹</button><b class="calt"></b><button type="button" class="btn" data-nav="1" aria-label="Next month">›</button><button type="button" class="btn" data-nav="0">Today</button></div><div class="calg"></div></div><aside class="calside"></aside></div>`;
  const side = () => {
    const ev = sel ? byDay.get(sel) || [] : [...byDay.entries()].filter(([d]) => d.startsWith(key(y, m, 1).slice(0, 7))).flatMap(([, v]) => v);
    const label = sel ? new Date(sel + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'This month';
    $('.calside', w.body).innerHTML = `<h4>${esc(label)}</h4>${ev.length ? `<ul class="boxed">${ev.map((p) => `<li><button type="button" class="row" data-url="${esc(p.url)}"><span class="tx"><b>${esc(p.title)}</b><span>${esc(p.sec)} · ${esc(p.date)}</span></span><span class="chev" aria-hidden="true">›</span></button></li>`).join('')}</ul>` : '<p class="c-d">No posts.</p>'}`;
  };
  const render = () => {
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    $('.calt', w.body).textContent = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    let h = 'Sun Mon Tue Wed Thu Fri Sat'.split(' ').map((d) => `<b>${d}</b>`).join('');
    for (let i = 0; i < first; i++) h += '<span class="out"></span>';
    for (let d = 1; d <= days; d++) {
      const k = key(y, m, d), ev = byDay.get(k) || [];
      const today = y === t.getFullYear() && m === t.getMonth() && d === t.getDate();
      h += `<button type="button" class="cd${today ? ' today' : ''}${sel === k ? ' sel' : ''}" data-d="${k}"><i>${d}</i>${ev.slice(0, 2).map((p) => `<em class="ev ${esc(p.sec)}">${esc(p.title)}</em>`).join('')}${ev.length > 2 ? `<em class="ev more">+${ev.length - 2}</em>` : ''}</button>`;
    }
    for (let i = (first + days) % 7; i && i < 7; i++) h += '<span class="out"></span>';
    $('.calg', w.body).innerHTML = h;
    side();
  };
  w.body.addEventListener('click', (e) => {
    const n = e.target.closest('[data-nav]'), d = e.target.closest('[data-d]'), u = e.target.closest('[data-url]');
    if (n) { const v = +n.dataset.nav; if (!v) { y = t.getFullYear(); m = t.getMonth(); } else { m += v; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } } sel = null; render(); }
    if (d) { sel = sel === d.dataset.d ? null : d.dataset.d; render(); }
    if (u) OS.openPost(u.dataset.url);
  });
  render();
}

/* ── System Monitor ────────────────────────── */
const SYS = [['systemd', 'root', 0.0, 12], ['systemd-journald', 'root', 0.1, 28], ['NetworkManager', 'root', 0.1, 19], ['sshd', 'root', 0, 9], ['dockerd', 'root', 0.4, 88], ['containerd', 'root', 0.2, 46], ['tailscaled', 'root', 0.1, 31], ['pipewire', 'will', 0.3, 22], ['wireplumber', 'will', 0.1, 18], ['gnome-shell', 'will', 3.2, 410], ['Xwayland', 'will', 0.6, 96], ['gnome-keyring-daemon', 'will', 0, 8], ['tmux: server', 'will', 0.1, 6], ['zsh', 'will', 0, 5], ['nvim', 'will', 0.2, 64], ['neo4j', 'will', 1.1, 920], ['burpsuite', 'will', 2.4, 1340], ['msfrpcd', 'will', 0.3, 280], ['openvpn', 'root', 0.2, 14], ['ollama', 'will', 0.8, 2100]];
export function sysmonApp(w) {
  let tab = 'Processes', sort = 'cpu', hist = [[], [], [], []], mem = [], net = [], pidMap = new Map(), killed = new Set();
  const pid = (name) => { if (!pidMap.has(name)) pidMap.set(name, 300 + ((Math.random() * 60000) | 0)); return pidMap.get(name); };
  w.body.innerHTML = `<div class="sysmon"><div class="cltabs"><div class="seg">${['Processes', 'Resources', 'File Systems'].map((t) => `<button type="button" data-o="${t}">${t}</button>`).join('')}</div></div><div class="smb"></div></div>`;
  const body = $('.smb', w.body);
  const procs = () => {
    const wins = WM.wins.map((x) => [x.app === 'web' ? 'firefox' : x.app === 'term' ? 'kgx' : x.app === 'files' ? 'nautilus' : 'gnome-' + x.app, 'will', 0.5 + Math.random() * (x === WM.active ? 6 : 1.5), 60 + (x.app === 'web' ? 380 : 40), x]);
    return [...SYS.filter((p) => !killed.has(p[0])).map((p) => [p[0], p[1], Math.max(0, p[2] + (Math.random() - 0.5) * p[2]), p[3] + ((Math.random() * 4) | 0), null]), ...wins];
  };
  const paint = () => {
    $$('.cltabs button', w.body).forEach((b) => b.classList.toggle('on', b.dataset.o === tab));
    if (tab === 'Processes') {
      const ps = procs().sort((a, b) => (sort === 'cpu' ? b[2] - a[2] : sort === 'mem' ? b[3] - a[3] : a[0].localeCompare(b[0])));
      const keep = body.querySelector('.ptab') ? body.querySelector('.ptab').scrollTop : 0;
      body.innerHTML = `<div class="ptab"><table><thead><tr><th data-s="name">Process Name</th><th>User</th><th data-s="cpu">% CPU</th><th data-s="mem">Memory</th><th>ID</th><th></th></tr></thead><tbody>${ps.map((p) => `<tr><td>${esc(p[0])}</td><td>${p[1]}</td><td>${p[2].toFixed(1)}</td><td>${p[3] >= 1000 ? (p[3] / 1024).toFixed(1) + ' GB' : p[3] + ' MB'}</td><td>${pid(p[0] + (p[4] ? p[4].id : ''))}</td><td>${p[4] || p[1] === 'will' ? `<button type="button" class="kill" data-k="${p[4] ? 'w' + p[4].id : esc(p[0])}" title="End process">End</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
      body.querySelector('.ptab').scrollTop = keep;
      $$('th[data-s]', body).forEach((th) => th.classList.toggle('on', th.dataset.s === sort));
    } else if (tab === 'Resources') {
      if (!$('.rs-cpu', body)) body.innerHTML = `<div class="res"><h4>CPU</h4><canvas class="rs-cpu" width="600" height="140"></canvas><div class="lg cpu-lg"></div><h4>Memory and Swap</h4><canvas class="rs-mem" width="600" height="100"></canvas><div class="lg mem-lg"></div><h4>Network</h4><canvas class="rs-net" width="600" height="100"></canvas><div class="lg net-lg"></div></div>`;
      const COL = ['#f66151', '#62a0ea', '#57e389', '#f6d32d'];
      graph($('.rs-cpu', body), hist, COL, 100);
      graph($('.rs-mem', body), [mem], [getComputedStyle(root).getPropertyValue('--accent-2').trim() || '#ff5c5c'], 32);
      graph($('.rs-net', body), [net.map((n) => n[0]), net.map((n) => n[1])], ['#62a0ea', '#c061cb'], Math.max(400, ...net.flat()));
      $('.cpu-lg', body).innerHTML = hist.map((h, i) => `<span><i style="background:${COL[i]}"></i>CPU${i + 1} ${(h[h.length - 1] || 0).toFixed(1)}%</span>`).join('');
      const mu = mem[mem.length - 1] || 0;
      $('.mem-lg', body).innerHTML = `<span><i style="background:var(--accent-2)"></i>Memory ${mu.toFixed(1)} GiB (${((mu / 32) * 100).toFixed(1)}%) of 31.3 GiB</span><span>Swap 0 bytes of 8.0 GiB</span>`;
      const nl = net[net.length - 1] || [0, 0];
      $('.net-lg', body).innerHTML = `<span><i style="background:#62a0ea"></i>Receiving ${nl[0].toFixed(1)} KiB/s</span><span><i style="background:#c061cb"></i>Sending ${nl[1].toFixed(1)} KiB/s</span>`;
    } else {
      body.innerHTML = `<ul class="boxed fsl">${[['/', 'btrfs', 'nvme0n1p2', 412, 931], ['/boot', 'vfat', 'nvme0n1p1', 0.3, 1], ['/home', 'btrfs', 'nvme0n1p2', 412, 931], ['/mnt/lab', 'ext4', 'sda1', 1340, 1863]].map(([mp, ty, dev, u, t]) => `<li class="row"><span class="tx"><b>${mp}</b><span>/dev/${dev} · ${ty} · ${u} of ${t} GB</span></span><span class="track"><span class="fill" style="width:${(u / t) * 100}%"></span></span></li>`).join('')}</ul>`;
    }
  };
  function graph(cv, series, cols, max) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, N = 60;
    c.clearRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
    for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(0, (H * k) / 4); c.lineTo(W, (H * k) / 4); c.stroke(); }
    series.forEach((s, j) => {
      c.strokeStyle = cols[j]; c.lineWidth = 2; c.beginPath();
      s.slice(-N).forEach((v, i, a) => { const x = W - (a.length - 1 - i) * (W / (N - 1)), yy = H - (v / max) * (H - 4) - 2; i ? c.lineTo(x, yy) : c.moveTo(x, yy); });
      c.stroke();
    });
  }
  const sample = (draw = true) => {
    const busy = WM.wins.filter((x) => !x.min).length;
    hist = hist.map((h, i) => { const p = h[h.length - 1] ?? 8; h.push(Math.max(1, Math.min(100, p + (Math.random() - 0.5) * 14 + (busy * 2 + 6 - p) * 0.15 + (i === 0 ? 3 : 0)))); return h.slice(-60); });
    const m0 = mem[mem.length - 1] ?? 9.4 + WM.wins.length * 0.25;
    mem.push(Math.max(6, Math.min(30, m0 + (Math.random() - 0.5) * 0.12 + (9.4 + WM.wins.length * 0.25 - m0) * 0.1))); mem = mem.slice(-60);
    const n0 = net[net.length - 1] || [20, 5];
    net.push([Math.max(0, n0[0] * 0.7 + Math.random() * (Math.random() < 0.1 ? 900 : 60)), Math.max(0, n0[1] * 0.7 + Math.random() * 25)]); net = net.slice(-60);
    if (draw && !w.min) paint();
  };
  body.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]'), th = e.target.closest('th[data-s]');
    if (th) { sort = th.dataset.s; paint(); }
    if (!k) return;
    const id = k.dataset.k;
    if (id[0] === 'w') { const x = WM.wins.find((v) => 'w' + v.id === id); if (x) WM.close(x); }
    else { killed.add(id); OS.banner({ title: 'Process ended', body: `${id} received SIGTERM`, icon: I.sysmon, transient: true, ms: 3000 }); }
    paint();
  });
  $('.cltabs', w.body).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { tab = b.dataset.o; body.innerHTML = ''; paint(); } });
  for (let k = 0; k < 60; k++) sample(false);
  paint();
  const timer = setInterval(sample, 1000);
  w.stop = () => clearInterval(timer);
}

/* ── Image Viewer ──────────────────────────── */
const EXTRA_IMGS = ['/assets/img/homelab.jpg', '/assets/img/antenna.jpg', '/assets/img/melody.jpg', '/assets/img/blackarch.svg', '/assets/img/penguin/avatar.png', '/assets/img/penguin/icon.png', '/assets/img/penguin/wallpaper-penguin.webp'];
export const imageList = () => {
  const fromPosts = posts().filter((p) => p.sec === 'writeups').map((p) => `/assets/img/writeups/${p.slug.replace(/-writeup$/, '')}.png`);
  const extra = (OS.data.images || []).concat(EXTRA_IMGS);
  return [...new Set([...fromPosts, ...extra])];
};
export function viewerApp(w, o = {}) {
  let list = imageList(), cur = -1, zoom = false;
  w.body.innerHTML = `<div class="viewer"><div class="vgrid"></div><div class="vone" hidden><img alt=""><div class="vbar"><button type="button" class="btn" data-v="back">All images</button><span class="vname"></span><span class="gsp"></span><button type="button" class="btn" data-v="prev" aria-label="Previous">‹</button><button type="button" class="btn" data-v="next" aria-label="Next">›</button><a class="btn" data-v="orig" target="_blank" rel="noopener">Open original</a></div></div></div>`;
  const grid = $('.vgrid', w.body), one = $('.vone', w.body), img = $('img', one);
  grid.innerHTML = list.map((src, i) => `<button type="button" class="vt" data-i="${i}"><img src="${esc(src)}" alt="" loading="lazy"><span>${esc(src.split('/').pop())}</span></button>`).join('');
  // drop thumbnails whose file is missing
  $$('.vt img', grid).forEach((im) => im.addEventListener('error', () => im.closest('.vt').remove(), { once: true }));
  const showAt = (i) => {
    const ok = $$('.vt', grid).map((b) => +b.dataset.i);
    if (!ok.length) return;
    const k = ok.indexOf(i);
    cur = ok[(k + ok.length) % ok.length];
    zoom = false; img.classList.remove('z');
    img.src = list[cur]; $('.vname', one).textContent = list[cur].split('/').pop(); $('[data-v="orig"]', one).href = list[cur];
    grid.hidden = true; one.hidden = false;
    WM.setTitle(w, 'Image Viewer', list[cur].split('/').pop());
  };
  const step = (d) => { const ok = $$('.vt', grid).map((b) => +b.dataset.i); const k = ok.indexOf(cur); showAt(ok[(k + d + ok.length) % ok.length]); };
  const back = () => { grid.hidden = false; one.hidden = true; cur = -1; WM.setTitle(w, 'Image Viewer'); };
  grid.addEventListener('click', (e) => { const b = e.target.closest('.vt'); if (b) showAt(+b.dataset.i); });
  one.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (b) { if (b.dataset.v === 'back') back(); if (b.dataset.v === 'prev') step(-1); if (b.dataset.v === 'next') step(1); return; }
    if (e.target === img) { zoom = !zoom; img.classList.toggle('z', zoom); }
  });
  w.el.addEventListener('keydown', (e) => {
    if (cur < 0) return;
    if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'Escape') back();
  });
  w.el.tabIndex = -1;
  w.open = (src) => { const i = list.indexOf(src); if (i >= 0) showAt(i); else { list.push(src); grid.insertAdjacentHTML('beforeend', `<button type="button" class="vt" data-i="${list.length - 1}"><img src="${esc(src)}" alt=""><span>${esc(src.split('/').pop())}</span></button>`); showAt(list.length - 1); } };
  if (o.src) setTimeout(() => w.open(o.src), 0);
}
