// pet.js — the desktop penguin. Walks along the bottom of the desktop, naps when you go quiet,
// waves when clicked, and types along while a Console window has focus.

import { OS, $, root, LS, mq, isMobile } from './lib.js';

const BASE = '/assets/img/penguin/';
let el, man, anim = '', frame = 0, ft = 0, x = 120, dir = 1, goal = null, until = 0, last = 0, raf = 0, idleSince = Date.now(), waving = 0;

const size = () => (isMobile() ? 52 : 72);
function set(a) {
  if (a === anim || !man.anims[a]) return;
  anim = a; frame = 0; ft = 0;
  const A = man.anims[a];
  el.style.backgroundImage = `url(${BASE}${A.src})`;
  el.style.backgroundSize = `${A.frames * 100}% 100%`;
  el.style.backgroundPosition = '0 0';
  el.dataset.anim = a;
}
function pick(now) {
  const r = Math.random(), W = innerWidth - size();
  if (r < 0.45 && !mq.reduced.matches) { goal = Math.max(8, Math.min(W - 8, x + (Math.random() - 0.5) * W * 0.8)); set('walk'); }
  else { goal = null; set('idle'); until = now + 2500 + Math.random() * 5000; }
}
function tick(now) {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(64, now - (last || now)); last = now;
  if (!el.isConnected || root.classList.contains('ov') || OS.sessionLocked) return;
  const termFocused = OS.WM && OS.WM.active && OS.WM.active.app === 'term' && !OS.WM.active.min;
  if (now < waving) set('wave');
  else if (termFocused) { goal = null; set('typing'); }
  else if (Date.now() - idleSince > 45000) { goal = null; set('sleep'); }
  else if (anim === 'wave' || anim === 'typing' || anim === 'sleep') pick(now);
  else if (goal != null) {
    const step = (dt / 1000) * 46 * (isMobile() ? 0.7 : 1);
    dir = goal > x ? 1 : -1;
    x += dir * Math.min(step, Math.abs(goal - x));
    if (Math.abs(goal - x) < 0.5) pick(now);
  } else if (now > until) pick(now);
  const A = man.anims[anim];
  ft += dt;
  if (ft >= 1000 / A.fps) { ft = 0; frame = (frame + 1) % A.frames; el.style.backgroundPosition = `${A.frames > 1 ? (frame / (A.frames - 1)) * 100 : 0}% 0`; }
  el.style.transform = `translateX(${Math.round(x)}px) scaleX(${dir})`;
}

export async function initPet() {
  if (LS.get('rc-pet') === 'off' || el) return;
  try { man = await (await fetch(BASE + 'manifest.json')).json(); } catch (e) { return; }
  el = document.createElement('button');
  el.type = 'button'; el.className = 'pet'; el.title = 'Penguin'; el.setAttribute('aria-label', 'Desktop penguin');
  el.style.setProperty('--ps', size() + 'px');
  // in front of the wallpaper and icons, behind windows
  document.getElementById('layer').before(el);
  x = Math.min(innerWidth * 0.62, innerWidth - 100);
  set('idle'); until = performance.now() + 3000;
  el.addEventListener('click', () => {
    idleSince = Date.now(); waving = performance.now() + 1800; goal = null;
    const lines = ['sudo pacman -Syu? bold move.', 'did you check the writeups folder?', 'nmap only localhost. rules are rules.', 'try `mines` in the Console.', 'I also run BlackArch, btw.'];
    if (OS.banner && Math.random() < 0.5) OS.banner({ title: 'Penguin', body: lines[(Math.random() * lines.length) | 0], icon: `<img src="${BASE}icon-64.png" alt="" style="width:36px;height:36px">`, transient: true, ms: 3500 });
  });
  const wake = () => { idleSince = Date.now(); };
  ['pointerdown', 'keydown', 'wheel'].forEach((t) => addEventListener(t, wake, { passive: true }));
  mq.mobile.addEventListener('change', () => el && el.style.setProperty('--ps', size() + 'px'));
  raf = requestAnimationFrame(tick);
}
export function stopPet() { cancelAnimationFrame(raf); if (el) el.remove(); el = null; anim = ''; }
export function setPet(on) { LS.set('rc-pet', on ? 'on' : 'off'); if (on) initPet(); else stopPet(); }
export const petOn = () => LS.get('rc-pet') !== 'off';
OS.setPet = setPet;
