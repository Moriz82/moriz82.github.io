// games.js — the GNOME Games folder: Mines, Sudoku, Merge, Blocks, Lights Off, Four in a Row, Reversi.

import { OS, $, $$, esc, root, LS } from '../lib.js';

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const accent = () => getComputedStyle(root).getPropertyValue('--accent').trim() || '#c80000';
const seg = (opts, cur) => `<div class="seg">${opts.map((o) => `<button type="button" data-o="${o}"${o === cur ? ' class="on"' : ''}>${o}</button>`).join('')}</div>`;
const setSeg = (el, cur) => $$('button', el).forEach((b) => b.classList.toggle('on', b.dataset.o === cur));
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// a game-over / win card laid over the board
function overlay(w, title, sub, again) {
  const el = $('.gmsg', w.body);
  if (!title) { el.hidden = true; return; }
  el.innerHTML = `<div><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}<button type="button" class="btn sug">${esc(again || 'Play again')}</button></div>`;
  el.hidden = false;
}
function onAgain(w, fn) { $('.gmsg', w.body).addEventListener('click', (e) => { if (e.target.closest('button')) fn(); }); }

const FLAG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 14V2.5M4 3h8l-2 3 2 3H4" fill="#f66151" stroke="#f66151" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const MINE = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.2" fill="currentColor"/><path d="M8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="6.6" cy="6.6" r="1.2" fill="#fff"/></svg>';

/* ── Mines ─────────────────────────────────── */
export function minesApp(w) {
  const LV = { Small: [9, 9, 10], Medium: [16, 16, 40], Large: [30, 16, 99] };
  let lv = LV[LS.get('rc-mines-lv')] ? LS.get('rc-mines-lv') : 'Small';
  let C, R, M, mine, open, flag, adj, cells, started, over, t0, timer, flagMode = false;
  w.body.innerHTML = `<div class="gm mines"><div class="gbar">${seg(Object.keys(LV), lv)}<span class="gstat"><b class="ml"></b> mines left · <b class="tm">0:00</b></span><span class="gsp"></span><button type="button" class="btn fm" title="Flag mode: taps place flags" aria-pressed="false">${FLAG}</button><button type="button" class="btn rs">New game</button></div><div class="gwrap"><div class="mgrid" role="grid" aria-label="Minefield"></div></div><div class="gmsg" hidden></div></div>`;
  const grid = $('.mgrid', w.body);
  const nb = (i) => {
    const x = i % C, y = (i / C) | 0, out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy;
      if ((dx || dy) && X >= 0 && Y >= 0 && X < C && Y < R) out.push(Y * C + X);
    }
    return out;
  };
  const paint = () => {
    let f = 0;
    cells.forEach((c, i) => {
      if (flag[i]) f++;
      const shown = open[i] || (over && mine[i]);
      c.className = `mc${open[i] ? ' op' : ''}${flag[i] ? ' fl' : ''}${shown && mine[i] ? ' mn' : ''}${over && flag[i] && !mine[i] ? ' bad' : ''}${open[i] && adj[i] && !mine[i] ? ' n' + adj[i] : ''}`;
      c.innerHTML = flag[i] && !(over && !mine[i]) ? FLAG : shown && mine[i] ? MINE : open[i] && adj[i] ? adj[i] : '';
    });
    $('.ml', w.body).textContent = M - f;
  };
  const reset = () => {
    [C, R, M] = LV[lv];
    const n = C * R;
    mine = new Uint8Array(n); open = new Uint8Array(n); flag = new Uint8Array(n); adj = new Uint8Array(n);
    started = over = false; clearInterval(timer);
    $('.tm', w.body).textContent = '0:00';
    grid.style.setProperty('--c', C);
    grid.innerHTML = Array.from({ length: n }, (_, i) => `<button type="button" class="mc" data-i="${i}" aria-label="cell ${(i % C) + 1},${((i / C) | 0) + 1}"></button>`).join('');
    cells = $$('.mc', grid);
    overlay(w); paint();
  };
  const plant = (safe) => {
    const ban = new Set([safe, ...nb(safe)]);
    for (let k = 0; k < M;) { const i = (Math.random() * C * R) | 0; if (!mine[i] && !ban.has(i)) { mine[i] = 1; k++; } }
    for (let i = 0; i < C * R; i++) adj[i] = nb(i).filter((j) => mine[j]).length;
    started = true; t0 = Date.now();
    timer = setInterval(() => { $('.tm', w.body).textContent = fmt(Math.floor((Date.now() - t0) / 1000)); }, 500);
  };
  const end = (won) => {
    over = true; clearInterval(timer);
    const s = Math.floor((Date.now() - t0) / 1000);
    if (won) {
      mine.forEach((m, i) => { if (m) flag[i] = 1; });
      const k = 'rc-mines-' + lv, b = +LS.get(k) || 0, rec = !b || s < b;
      if (rec) LS.set(k, s);
      overlay(w, rec ? 'New best time' : 'Field cleared', `${fmt(s)} on ${lv}${!rec ? ` · best ${fmt(b)}` : ''}`);
    } else overlay(w, 'Boom', 'You stepped on a mine.', 'Try again');
  };
  const reveal = (i) => {
    if (over || flag[i]) return;
    if (open[i]) return chord(i);
    if (!started) plant(i);
    if (mine[i]) { open[i] = 1; cells[i].dataset.hit = '1'; return end(false); }
    const st = [i];
    while (st.length) {
      const j = st.pop();
      if (open[j] || flag[j]) continue;
      open[j] = 1;
      if (!adj[j]) nb(j).forEach((k) => { if (!open[k] && !mine[k]) st.push(k); });
    }
    if (open.reduce((a, b) => a + b, 0) === C * R - M) end(true);
  };
  const chord = (i) => {
    const ns = nb(i);
    if (!adj[i] || ns.filter((j) => flag[j]).length !== adj[i]) return;
    for (const j of ns) { if (!flag[j] && !open[j]) { reveal(j); if (over) return; } }
  };
  const toggleFlag = (i) => { if (!over && !open[i]) flag[i] ^= 1; };
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.mc'); if (!c) return;
    const i = +c.dataset.i;
    if (flagMode && !open[i]) toggleFlag(i); else reveal(i);
    paint();
  });
  grid.addEventListener('contextmenu', (e) => {
    const c = e.target.closest('.mc'); if (!c) return;
    e.preventDefault(); e.stopPropagation();
    toggleFlag(+c.dataset.i); paint();
  });
  $('.gbar .seg', w.body).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    lv = b.dataset.o; LS.set('rc-mines-lv', lv); setSeg(e.currentTarget, lv); reset();
  });
  $('.fm', w.body).addEventListener('click', (e) => { flagMode = !flagMode; e.currentTarget.classList.toggle('sug', flagMode); e.currentTarget.setAttribute('aria-pressed', flagMode); });
  $('.rs', w.body).addEventListener('click', reset);
  onAgain(w, reset);
  w.stop = () => clearInterval(timer);
  reset();
}

/* ── Sudoku ────────────────────────────────── */
const sCand = (g, i) => {
  const r = (i / 9) | 0, c = i % 9, br = r - (r % 3), bc = c - (c % 3);
  let used = 0;
  for (let k = 0; k < 9; k++) used |= (1 << g[r * 9 + k]) | (1 << g[k * 9 + c]) | (1 << g[(br + ((k / 3) | 0)) * 9 + bc + (k % 3)]);
  return ~used & 0x3fe;
};
const bits = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
function sSolve(g, lim, rand) {
  let best = -1, bm = 0, bc = 10;
  for (let i = 0; i < 81; i++) if (!g[i]) { const m = sCand(g, i), c = bits(m); if (c < bc) { bc = c; best = i; bm = m; if (!c) return 0; } }
  if (best < 0) return 1;
  let n = 0;
  const vs = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const v of rand ? shuffle(vs) : vs) {
    if (!(bm & (1 << v))) continue;
    g[best] = v;
    n += sSolve(g, lim - n, rand);
    if (n >= lim) return n; // leave g filled when we only wanted one solution
  }
  g[best] = 0;
  return n;
}
function sMake(givens) {
  const sol = new Array(81).fill(0);
  sSolve(sol, 1, true);
  const puz = sol.slice();
  let left = 81;
  for (const i of shuffle([...Array(81).keys()])) {
    if (left <= givens) break;
    const v = puz[i]; puz[i] = 0;
    if (sSolve(puz.slice(), 2) !== 1) puz[i] = v; else left--;
  }
  return { sol, puz };
}
export function sudokuApp(w) {
  const LV = { Easy: 40, Medium: 32, Hard: 26 };
  let lv = LV[LS.get('rc-sudoku-lv')] ? LS.get('rc-sudoku-lv') : 'Easy';
  let sol, puz, cur, sel = -1, t0, timer, done;
  w.body.innerHTML = `<div class="gm sudoku"><div class="gbar">${seg(Object.keys(LV), lv)}<span class="gstat"><b class="tm">0:00</b></span><span class="gsp"></span><button type="button" class="btn hint">Hint</button><button type="button" class="btn rs">New game</button></div>
    <div class="gwrap"><div class="sgrid" tabindex="0" role="grid" aria-label="Sudoku board"></div></div>
    <div class="spad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('')}<button type="button" data-n="0" aria-label="Erase">⌫</button></div><div class="gmsg" hidden></div></div>`;
  const grid = $('.sgrid', w.body);
  grid.innerHTML = Array.from({ length: 81 }, (_, i) => `<button type="button" class="sq" data-i="${i}" tabindex="-1"></button>`).join('');
  const cells = $$('.sq', grid);
  const peer = (a, b) => { const ra = (a / 9) | 0, ca = a % 9, rb = (b / 9) | 0, cb = b % 9; return ra === rb || ca === cb || ((ra / 3) | 0) === ((rb / 3) | 0) && ((ca / 3) | 0) === ((cb / 3) | 0); };
  const paint = () => {
    const sv = sel >= 0 ? cur[sel] : 0;
    cells.forEach((c, i) => {
      const v = cur[i];
      const bad = v && cells.some((_, j) => j !== i && cur[j] === v && peer(i, j));
      c.textContent = v || '';
      c.className = `sq${puz[i] ? ' gv' : v ? ' us' : ''}${i === sel ? ' sel' : sel >= 0 && peer(i, sel) ? ' pr' : ''}${sv && v === sv && i !== sel ? ' same' : ''}${bad && !puz[i] ? ' bad' : ''}${(i % 9) % 3 === 2 && i % 9 !== 8 ? ' br' : ''}${((i / 9) | 0) % 3 === 2 && i < 72 ? ' bb' : ''}`;
    });
    $$('.spad [data-n]', w.body).forEach((b) => { const n = +b.dataset.n; b.disabled = n > 0 && cur.filter((x) => x === n).length >= 9; });
  };
  const reset = () => {
    overlay(w);
    grid.classList.add('busy');
    // generation can take a moment on Hard; let the window paint first
    setTimeout(() => {
      ({ sol, puz } = sMake(LV[lv]));
      cur = puz.slice(); sel = -1; done = false; grid.classList.remove('busy');
      clearInterval(timer); t0 = Date.now();
      timer = setInterval(() => { if (!done) $('.tm', w.body).textContent = fmt(Math.floor((Date.now() - t0) / 1000)); }, 500);
      paint();
    }, 30);
  };
  const put = (n) => {
    if (done || sel < 0 || puz[sel]) return;
    cur[sel] = n; paint();
    if (cur.every((v, i) => v === sol[i])) {
      done = true; clearInterval(timer);
      const s = Math.floor((Date.now() - t0) / 1000), k = 'rc-sudoku-' + lv, b = +LS.get(k) || 0;
      if (!b || s < b) LS.set(k, s);
      overlay(w, 'Solved', `${fmt(s)} on ${lv}${b && s >= b ? ` · best ${fmt(b)}` : ''}`);
    }
  };
  grid.addEventListener('click', (e) => { const c = e.target.closest('.sq'); if (!c) return; sel = +c.dataset.i; grid.focus({ preventScroll: true }); paint(); });
  grid.addEventListener('keydown', (e) => {
    if (/^[1-9]$/.test(e.key)) return put(+e.key);
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') return put(0);
    const d = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (d) { e.preventDefault(); sel = sel < 0 ? 40 : (sel + d + 81) % 81; paint(); }
  });
  $('.spad', w.body).addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (b) put(+b.dataset.n); });
  $('.hint', w.body).addEventListener('click', () => {
    if (done || !cur) return;
    if (sel < 0 || puz[sel] || cur[sel] === sol[sel]) { const e = cur.map((v, i) => (v !== sol[i] ? i : -1)).filter((i) => i >= 0); if (!e.length) return; sel = e[(Math.random() * e.length) | 0]; }
    put(sol[sel]);
  });
  $('.gbar .seg', w.body).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; lv = b.dataset.o; LS.set('rc-sudoku-lv', lv); setSeg(e.currentTarget, lv); reset(); });
  $('.rs', w.body).addEventListener('click', reset);
  onAgain(w, reset);
  w.stop = () => clearInterval(timer);
  w.focusGame = () => grid.focus({ preventScroll: true });
  reset();
}

/* ── Merge (slide-and-double tiles) ────────── */
export function mergeApp(w) {
  let b, score, best = +LS.get('rc-merge') || 0, won, fresh, merged;
  w.body.innerHTML = `<div class="gm merge"><div class="gbar"><span class="gstat">score <b class="sc">0</b> · best <b class="bs">${best}</b></span><span class="gsp"></span><button type="button" class="btn rs">New game</button></div><div class="gwrap"><div class="mboard" tabindex="0" aria-label="Merge board. Arrow keys slide tiles."></div></div><div class="gmsg" hidden></div></div>`;
  const board = $('.mboard', w.body);
  const add = () => { const e = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0); if (!e.length) return; const i = e[(Math.random() * e.length) | 0]; b[i] = Math.random() < 0.9 ? 2 : 4; fresh = i; };
  const paint = () => {
    board.innerHTML = b.map((v, i) => `<div class="mt${v ? ' v' + Math.min(v, 4096) : ''}${i === fresh ? ' t-new' : ''}${merged.has(i) ? ' t-pop' : ''}">${v || ''}</div>`).join('');
    $('.sc', w.body).textContent = score; $('.bs', w.body).textContent = best;
  };
  const lines = { left: [], right: [], up: [], down: [] };
  for (let k = 0; k < 4; k++) {
    const row = [0, 1, 2, 3].map((j) => k * 4 + j), col = [0, 1, 2, 3].map((j) => j * 4 + k);
    lines.left.push(row); lines.right.push(row.slice().reverse()); lines.up.push(col); lines.down.push(col.slice().reverse());
  }
  const canMove = () => b.some((v, i) => !v || (i % 4 < 3 && b[i + 1] === v) || (i < 12 && b[i + 4] === v));
  const move = (dir) => {
    if (!canMove()) return;
    let moved = false; merged = new Set(); fresh = -1;
    for (const ln of lines[dir]) {
      const vals = ln.map((i) => b[i]).filter(Boolean), out = [];
      for (let k = 0; k < vals.length; k++) {
        if (vals[k] === vals[k + 1]) { out.push(vals[k] * 2); score += vals[k] * 2; merged.add(ln[out.length - 1]); k++; } else out.push(vals[k]);
      }
      ln.forEach((i, k) => { const v = out[k] || 0; if (b[i] !== v) moved = true; b[i] = v; });
    }
    if (!moved) return;
    add();
    if (score > best) { best = score; LS.set('rc-merge', best); }
    paint();
    if (!won && b.includes(2048)) { won = true; overlay(w, '2048 tile', 'Keep going for 4096.', 'Keep going'); }
    else if (!canMove()) overlay(w, 'No moves left', `Final score ${score}`);
  };
  const reset = () => { b = new Array(16).fill(0); score = 0; won = false; merged = new Set(); add(); add(); overlay(w); paint(); };
  board.addEventListener('keydown', (e) => {
    const d = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' }[e.key.toLowerCase()];
    if (d) { e.preventDefault(); move(d); }
  });
  let sx, sy;
  board.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  board.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  $('.rs', w.body).addEventListener('click', () => { reset(); board.focus(); });
  $('.gmsg', w.body).addEventListener('click', (e) => { if (!e.target.closest('button')) return; if (won && canMove()) overlay(w); else reset(); board.focus(); });
  w.focusGame = () => board.focus({ preventScroll: true });
  reset();
}

/* ── Blocks (falling blocks) ───────────────── */
const PIECES = {
  I: { m: ['....', '####', '....', '....'], c: '#62a0ea' }, O: { m: ['##', '##'], c: '#f6d32d' }, T: { m: ['.#.', '###', '...'], c: '#c061cb' },
  S: { m: ['.##', '##.', '...'], c: '#57e389' }, Z: { m: ['##.', '.##', '...'], c: '#f66151' }, J: { m: ['#..', '###', '...'], c: '#3584e4' }, L: { m: ['..#', '###', '...'], c: '#ffa348' },
};
const rot = (m) => m[0].map((_, j) => m.map((r) => r[j]).reverse());
export function blocksApp(w) {
  const COLS = 10, ROWS = 20, CS = 24;
  w.body.innerHTML = `<div class="gm blocks"><canvas class="bcv" width="${COLS * CS}" height="${ROWS * CS}" tabindex="0" aria-label="Blocks game"></canvas>
    <aside class="bside"><div><h4>Next</h4><canvas class="nx" width="96" height="72"></canvas></div><div><h4>Score</h4><b class="sc">0</b></div><div><h4>Lines</h4><b class="ln">0</b></div><div><h4>Level</h4><b class="lv">1</b></div><div><h4>Best</h4><b class="bs">${+LS.get('rc-blocks') || 0}</b></div>
    <p class="keys"><kbd>←</kbd><kbd>→</kbd> move<br><kbd>↑</kbd> rotate<br><kbd>↓</kbd> soft drop<br><kbd>Space</kbd> drop<br><kbd>P</kbd> pause</p></aside></div>`;
  const cv = $('.bcv', w.body), cx = cv.getContext('2d'), nx = $('.nx', w.body).getContext('2d');
  let well, cur, next, bag = [], score, lines, level, over, paused, acc, last, raf;
  const draw1 = (c, x, y, col, s = CS, a = 1) => { c.globalAlpha = a; c.fillStyle = col; c.fillRect(x * s + 1, y * s + 1, s - 2, s - 2); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x * s + 1, y * s + 1, s - 2, 3); c.globalAlpha = 1; };
  const take = () => { if (!bag.length) bag = shuffle(Object.keys(PIECES)); const k = bag.pop(); return { k, m: PIECES[k].m.map((r) => r.split('').map((ch) => ch === '#')), x: 0, y: 0 }; };
  const fits = (p, m = p.m, x = p.x, y = p.y) => m.every((r, j) => r.every((on, i) => !on || (x + i >= 0 && x + i < COLS && y + j < ROWS && (y + j < 0 || !well[y + j][x + i]))));
  const spawn = () => { cur = next || take(); next = take(); cur.x = ((COLS - cur.m[0].length) / 2) | 0; cur.y = cur.k === 'I' ? -1 : 0; if (!fits(cur)) gameOver(); drawNext(); };
  const drawNext = () => {
    nx.clearRect(0, 0, 96, 72);
    const m = next.m, s = 18, rows = m.filter((r) => r.some(Boolean)), ox = (96 - m[0].length * s) / 2, oy = (72 - rows.length * s) / 2;
    nx.save(); nx.translate(ox, oy); rows.forEach((r, j) => r.forEach((on, i) => { if (on) draw1(nx, i, j, PIECES[next.k].c, s); })); nx.restore();
  };
  const hud = () => { $('.sc', w.body).textContent = score; $('.ln', w.body).textContent = lines; $('.lv', w.body).textContent = level; };
  const lock = () => {
    cur.m.forEach((r, j) => r.forEach((on, i) => { if (on && cur.y + j >= 0) well[cur.y + j][cur.x + i] = PIECES[cur.k].c; }));
    if (cur.y < 0 && cur.m.some((r, j) => cur.y + j < 0 && r.some(Boolean))) return gameOver();
    let n = 0;
    for (let y = ROWS - 1; y >= 0; y--) if (well[y].every(Boolean)) { well.splice(y, 1); well.unshift(new Array(COLS).fill(0)); n++; y++; }
    if (n) { lines += n; score += [0, 100, 300, 500, 800][n] * level; level = 1 + Math.floor(lines / 10); }
    hud(); spawn();
  };
  const gameOver = () => {
    over = true;
    const b = Math.max(score, +LS.get('rc-blocks') || 0); LS.set('rc-blocks', b); $('.bs', w.body).textContent = b;
  };
  const drop = () => { if (fits(cur, cur.m, cur.x, cur.y + 1)) cur.y++; else lock(); };
  const draw = () => {
    cx.fillStyle = '#050506'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.strokeStyle = 'rgba(255,255,255,.04)';
    for (let x = 1; x < COLS; x++) { cx.beginPath(); cx.moveTo(x * CS, 0); cx.lineTo(x * CS, ROWS * CS); cx.stroke(); }
    well.forEach((r, y) => r.forEach((c, x) => { if (c) draw1(cx, x, y, c); }));
    if (cur && !over) {
      let gy = cur.y; while (fits(cur, cur.m, cur.x, gy + 1)) gy++;
      cur.m.forEach((r, j) => r.forEach((on, i) => { if (on) { draw1(cx, cur.x + i, gy + j, PIECES[cur.k].c, CS, 0.18); draw1(cx, cur.x + i, cur.y + j, PIECES[cur.k].c); } }));
    }
    if (over || paused) {
      cx.fillStyle = 'rgba(0,0,0,.65)'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.fillStyle = '#fff'; cx.textAlign = 'center';
      cx.font = '700 22px Cantarell, sans-serif'; cx.fillText(over ? 'Game over' : 'Paused', cv.width / 2, cv.height / 2 - 8);
      cx.font = '13px Fira Code, monospace'; cx.fillText(over ? 'enter to restart' : 'p to resume', cv.width / 2, cv.height / 2 + 20);
    }
  };
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (w.min) { last = t; return; }
    const dt = Math.min(100, t - (last || t)); last = t;
    if (!over && !paused) { acc += dt; const iv = Math.max(70, 800 - (level - 1) * 70); while (acc >= iv) { acc -= iv; drop(); if (over) break; } }
    draw();
  };
  const reset = () => { well = Array.from({ length: ROWS }, () => new Array(COLS).fill(0)); score = lines = 0; level = 1; over = paused = false; acc = 0; next = null; bag = []; hud(); spawn(); };
  const act = (k) => {
    if (over) { if (k === 'enter' || k === ' ') reset(); return; }
    if (k === 'p' || k === 'escape') { paused = !paused; return; }
    if (paused) return;
    if (k === 'arrowleft' || k === 'a') { if (fits(cur, cur.m, cur.x - 1)) cur.x--; }
    else if (k === 'arrowright' || k === 'd') { if (fits(cur, cur.m, cur.x + 1)) cur.x++; }
    else if (k === 'arrowdown' || k === 's') { if (fits(cur, cur.m, cur.x, cur.y + 1)) { cur.y++; score++; hud(); } else lock(); acc = 0; }
    else if (k === 'arrowup' || k === 'w' || k === 'x') { const m = rot(cur.m); for (const dx of [0, -1, 1, -2, 2]) if (fits(cur, m, cur.x + dx)) { cur.m = m; cur.x += dx; break; } }
    else if (k === ' ') { while (fits(cur, cur.m, cur.x, cur.y + 1)) { cur.y++; score += 2; } lock(); acc = 0; }
    else return false;
    return true;
  };
  cv.addEventListener('keydown', (e) => { if (act(e.key.toLowerCase()) !== false) e.preventDefault(); });
  let sx, sy, st;
  cv.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }, { passive: true });
  cv.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return act(over ? 'enter' : 'arrowup');
    if (Math.abs(dx) > Math.abs(dy)) { for (let n = Math.max(1, Math.round(Math.abs(dx) / 30)); n--;) act(dx > 0 ? 'arrowright' : 'arrowleft'); }
    else act(dy > 0 ? ' ' : 'p');
  });
  reset();
  raf = requestAnimationFrame(loop);
  w.stop = () => cancelAnimationFrame(raf);
  w.focusGame = () => cv.focus({ preventScroll: true });
}

/* ── Lights Off ────────────────────────────── */
export function lightsApp(w) {
  const N = 5;
  let lvl = Math.max(1, +LS.get('rc-lights') || 1), b, moves;
  w.body.innerHTML = `<div class="gm lights"><div class="gbar"><span class="gstat">level <b class="lv"></b> · <b class="mv">0</b> moves</span><span class="gsp"></span><button type="button" class="btn prev" aria-label="Previous level">‹</button><button type="button" class="btn next" aria-label="Next level">›</button><button type="button" class="btn rs">Restart</button></div><div class="gwrap"><div class="lgrid">${Array.from({ length: N * N }, (_, i) => `<button type="button" class="lc" data-i="${i}" aria-label="light ${i + 1}"></button>`).join('')}</div></div><p class="ghelp">Turn every light off. Each press flips the light and its neighbours.</p><div class="gmsg" hidden></div></div>`;
  const cells = $$('.lc', w.body);
  const flip = (i) => { const x = i % N, y = (i / N) | 0; [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < N && Y < N) b[Y * N + X] ^= 1; }); };
  const paint = () => { cells.forEach((c, i) => c.classList.toggle('on', !!b[i])); $('.lv', w.body).textContent = lvl; $('.mv', w.body).textContent = moves; };
  const load = () => {
    b = new Array(N * N).fill(0); moves = 0;
    // seed from the level so each level is the same puzzle every time
    let s = lvl * 2654435761 >>> 0;
    const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    const presses = new Set();
    while (presses.size < Math.min(3 + lvl, 18)) presses.add((rnd() * N * N) | 0);
    presses.forEach(flip);
    if (!b.some(Boolean)) flip(12);
    overlay(w); paint();
  };
  $('.lgrid', w.body).addEventListener('click', (e) => {
    const c = e.target.closest('.lc'); if (!c || !b.some(Boolean)) return;
    flip(+c.dataset.i); moves++; paint();
    if (!b.some(Boolean)) { LS.set('rc-lights', lvl + 1); overlay(w, `Level ${lvl} done`, `${moves} moves`, 'Next level'); }
  });
  $('.gmsg', w.body).addEventListener('click', (e) => { if (e.target.closest('button')) { lvl++; load(); } });
  $('.prev', w.body).addEventListener('click', () => { if (lvl > 1) { lvl--; load(); } });
  $('.next', w.body).addEventListener('click', () => { lvl++; load(); });
  $('.rs', w.body).addEventListener('click', load);
  load();
}

/* ── Four in a Row ─────────────────────────── */
const F_ORDER = [3, 2, 4, 1, 5, 0, 6];
const fRow = (b, c) => { for (let r = 5; r >= 0; r--) if (!b[r * 7 + c]) return r; return -1; };
function fWon(b, r, c) {
  const p = b[r * 7 + c];
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const run = [[r, c]];
    for (const s of [1, -1]) { let rr = r + dr * s, cc = c + dc * s; while (rr >= 0 && rr < 6 && cc >= 0 && cc < 7 && b[rr * 7 + cc] === p) { run.push([rr, cc]); rr += dr * s; cc += dc * s; } }
    if (run.length >= 4) return run;
  }
  return null;
}
function fEval(b, p) {
  let s = 0;
  const o = 3 - p;
  for (let r = 0; r < 6; r++) s += (b[r * 7 + 3] === p) * 3 - (b[r * 7 + 3] === o) * 3;
  const win = (cells) => {
    let a = 0, z = 0;
    for (const i of cells) { if (b[i] === p) a++; else if (b[i] === o) z++; }
    if (a && z) return 0;
    return a === 3 ? 5 : a === 2 ? 2 : z === 3 ? -4 : z === 2 ? -1 : 0;
  };
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const er = r + dr * 3, ec = c + dc * 3;
    if (er < 0 || er > 5 || ec < 0 || ec > 6) continue;
    s += win([0, 1, 2, 3].map((k) => (r + dr * k) * 7 + c + dc * k));
  }
  return s;
}
function fNega(b, d, a, be, p) {
  if (d === 0) return fEval(b, p);
  let best = -Infinity, any = false;
  for (const c of F_ORDER) {
    const r = fRow(b, c); if (r < 0) continue;
    any = true; b[r * 7 + c] = p;
    const s = fWon(b, r, c) ? 1e6 + d : -fNega(b, d - 1, -be, -a, 3 - p);
    b[r * 7 + c] = 0;
    if (s > best) best = s;
    if (best > a) a = best;
    if (a >= be) break;
  }
  return any ? best : 0;
}
export function fourApp(w) {
  const LV = { Easy: 1, Medium: 4, Hard: 6 };
  let lv = LV[LS.get('rc-four-lv')] ? LS.get('rc-four-lv') : 'Medium';
  let b, turn, over, last, first = 1, wins = +LS.get('rc-four-w') || 0, losses = +LS.get('rc-four-l') || 0;
  w.body.innerHTML = `<div class="gm four"><div class="gbar">${seg(Object.keys(LV), lv)}<span class="gstat fst"></span><span class="gsp"></span><span class="gstat">you <b class="fw">${wins}</b> · cpu <b class="fl">${losses}</b></span><button type="button" class="btn rs">New game</button></div><div class="gwrap"><div class="fboard" role="grid" aria-label="Four in a Row board"></div></div><div class="gmsg" hidden></div></div>`;
  const board = $('.fboard', w.body);
  board.innerHTML = Array.from({ length: 42 }, (_, i) => `<button type="button" class="fc" data-c="${i % 7}" aria-label="column ${(i % 7) + 1}"><i></i></button>`).join('');
  const cells = $$('.fc', board);
  const status = (t) => { $('.fst', w.body).textContent = t; };
  const paint = (hl) => {
    const win = new Set((hl || []).map(([r, c]) => r * 7 + c));
    cells.forEach((el, i) => { el.className = `fc${b[i] ? ' p' + b[i] : ''}${i === last ? ' drop' : ''}${win.has(i) ? ' win' : ''}`; el.style.setProperty('--r', (i / 7) | 0); });
  };
  const play = (c, p) => {
    const r = fRow(b, c); if (r < 0) return false;
    b[r * 7 + c] = p; last = r * 7 + c;
    const run = fWon(b, r, c);
    paint(run);
    if (run) {
      over = true;
      if (p === 1) { wins++; LS.set('rc-four-w', wins); overlay(w, 'You win', 'Four in a row.'); }
      else { losses++; LS.set('rc-four-l', losses); overlay(w, 'Computer wins', 'Better luck next round.'); }
      $('.fw', w.body).textContent = wins; $('.fl', w.body).textContent = losses;
    } else if (!b.includes(0)) { over = true; overlay(w, 'Draw', 'The board is full.'); }
    return true;
  };
  const cpu = () => {
    turn = 2; status('Computer is thinking…');
    setTimeout(() => {
      if (over) return;
      let best = -Infinity, pick = 3;
      for (const c of F_ORDER) {
        const r = fRow(b, c); if (r < 0) continue;
        b[r * 7 + c] = 2;
        let s = fWon(b, r, c) ? 1e7 : -fNega(b, LV[lv] - 1, -Infinity, lv === 'Easy' || best === -Infinity ? Infinity : -best, 1);
        b[r * 7 + c] = 0;
        if (lv === 'Easy') s += Math.random() * 6;
        if (s > best) { best = s; pick = c; }
      }
      play(pick, 2);
      turn = 1; if (!over) status('Your move');
    }, 260);
  };
  const reset = () => {
    b = new Array(42).fill(0); over = false; last = -1; overlay(w); paint();
    if (first === 2) cpu(); else { turn = 1; status('Your move'); }
    first = 3 - first;
  };
  board.addEventListener('click', (e) => { const el = e.target.closest('.fc'); if (!el || over || turn !== 1) return; if (play(+el.dataset.c, 1) && !over) cpu(); });
  board.addEventListener('pointerover', (e) => { const el = e.target.closest('.fc'); cells.forEach((x) => x.classList.toggle('hov', !!el && x.dataset.c === el.dataset.c)); });
  board.addEventListener('pointerleave', () => cells.forEach((x) => x.classList.remove('hov')));
  $('.gbar .seg', w.body).addEventListener('click', (e) => { const x = e.target.closest('button'); if (!x) return; lv = x.dataset.o; LS.set('rc-four-lv', lv); setSeg(e.currentTarget, lv); });
  $('.rs', w.body).addEventListener('click', reset);
  onAgain(w, reset);
  reset();
}

/* ── Reversi ───────────────────────────────── */
const R_W = [100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2, 1, 1, 1, 1, -2, 10, 5, -2, 1, 0, 0, 1, -2, 5, 5, -2, 1, 0, 0, 1, -2, 5, 10, -2, 1, 1, 1, 1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20, 100, -20, 10, 5, 5, 10, -20, 100];
const R_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function rFlips(b, i, p) {
  if (b[i]) return [];
  const x = i % 8, y = (i / 8) | 0, o = 3 - p, out = [];
  for (const [dx, dy] of R_DIRS) {
    const run = []; let X = x + dx, Y = y + dy;
    while (X >= 0 && Y >= 0 && X < 8 && Y < 8 && b[Y * 8 + X] === o) { run.push(Y * 8 + X); X += dx; Y += dy; }
    if (run.length && X >= 0 && Y >= 0 && X < 8 && Y < 8 && b[Y * 8 + X] === p) out.push(...run);
  }
  return out;
}
const rMoves = (b, p) => { const m = []; for (let i = 0; i < 64; i++) { const f = rFlips(b, i, p); if (f.length) m.push([i, f]); } return m; };
function rScore(b, p) { let s = 0; for (let i = 0; i < 64; i++) s += b[i] === p ? R_W[i] : b[i] ? -R_W[i] : 0; return s + (rMoves(b, p).length - rMoves(b, 3 - p).length) * 4; }
function rNega(b, d, a, be, p) {
  const ms = rMoves(b, p);
  if (!d) return rScore(b, p);
  if (!ms.length) { if (!rMoves(b, 3 - p).length) { const n = b.filter((v) => v === p).length - b.filter((v) => v === 3 - p).length; return n * 1000; } return -rNega(b, d - 1, -be, -a, 3 - p); }
  let best = -Infinity;
  for (const [i, f] of ms) {
    const nb = b.slice(); nb[i] = p; f.forEach((j) => { nb[j] = p; });
    const s = -rNega(nb, d - 1, -be, -a, 3 - p);
    if (s > best) best = s;
    if (best > a) a = best;
    if (a >= be) break;
  }
  return best;
}
export function reversiApp(w) {
  let b, turn, over, lastI = -1, flipped = new Set();
  w.body.innerHTML = `<div class="gm reversi"><div class="gbar"><span class="gstat"><i class="rd d"></i> <b class="nd">2</b> · <i class="rd l"></i> <b class="nl">2</b></span><span class="gstat rst"></span><span class="gsp"></span><button type="button" class="btn rs">New game</button></div><div class="gwrap"><div class="rboard" role="grid" aria-label="Reversi board">${Array.from({ length: 64 }, (_, i) => `<button type="button" class="rv" data-i="${i}" aria-label="square ${'abcdefgh'[i % 8]}${((i / 8) | 0) + 1}"><i></i></button>`).join('')}</div></div><div class="gmsg" hidden></div></div>`;
  const cells = $$('.rv', w.body);
  const status = (t) => { $('.rst', w.body).textContent = t; };
  const paint = () => {
    const hints = turn === 1 && !over ? new Set(rMoves(b, 1).map(([i]) => i)) : new Set();
    cells.forEach((c, i) => { c.className = `rv${b[i] === 1 ? ' d' : b[i] === 2 ? ' l' : ''}${hints.has(i) ? ' hint' : ''}${i === lastI ? ' last' : ''}${flipped.has(i) ? ' flip' : ''}`; });
    $('.nd', w.body).textContent = b.filter((v) => v === 1).length; $('.nl', w.body).textContent = b.filter((v) => v === 2).length;
  };
  const apply = (i, f, p) => { b[i] = p; f.forEach((j) => { b[j] = p; }); lastI = i; flipped = new Set(f); };
  const finish = () => {
    over = true; paint();
    const d = b.filter((v) => v === 1).length, l = b.filter((v) => v === 2).length;
    overlay(w, d > l ? 'You win' : d < l ? 'Computer wins' : 'Draw', `${d} to ${l}`);
    status('');
  };
  const next = () => {
    const mine = rMoves(b, 1), theirs = rMoves(b, 2);
    if (!mine.length && !theirs.length) return finish();
    if (turn === 2) {
      if (!theirs.length) { turn = 1; status('Computer passes. Your move'); return paint(); }
      status('Computer is thinking…'); paint();
      setTimeout(() => {
        let best = -Infinity, pick = theirs[0];
        for (const m of theirs) {
          const nb = b.slice(); nb[m[0]] = 2; m[1].forEach((j) => { nb[j] = 2; });
          const s = -rNega(nb, 3, -Infinity, Infinity, 1) + Math.random();
          if (s > best) { best = s; pick = m; }
        }
        apply(pick[0], pick[1], 2); turn = 1; next();
      }, 380);
    } else {
      if (!mine.length) { status('No moves for you. Passing.'); turn = 2; paint(); return setTimeout(next, 700); }
      status('Your move (dark)'); paint();
    }
  };
  const reset = () => { b = new Array(64).fill(0); b[27] = b[36] = 2; b[28] = b[35] = 1; turn = 1; over = false; lastI = -1; flipped = new Set(); overlay(w); next(); };
  $('.rboard', w.body).addEventListener('click', (e) => {
    const c = e.target.closest('.rv'); if (!c || over || turn !== 1) return;
    const i = +c.dataset.i, f = rFlips(b, i, 1); if (!f.length) return;
    apply(i, f, 1); turn = 2; next();
  });
  $('.rs', w.body).addEventListener('click', reset);
  onAgain(w, reset);
  reset();
}
