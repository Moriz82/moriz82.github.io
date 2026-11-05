// session.js — GRUB → systemd → GDM login → desktop; lock, log out, power off.

import { OS, $, esc, root, SS, mq, isMobile } from './lib.js';
import { WM } from './wm.js';
import { Y } from './icons.js';

let timers = [], autoT = null, firstLogin = true, bootWin = null;
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
let bootEl, gdm, halt;

function mount() {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="gdm" id="gdm" hidden>
      <div class="gbar"><span></span><span id="g-clk"></span><span class="r">${Y.net}${Y.vol}${Y.bat}${Y.power}</span></div>
      <div class="g-card">
        <img src="/assets/img/penguin/avatar.png" alt="">
        <div class="nm">${esc(OS.data.site.user)}</div>
        <form class="g-pw" id="g-form"><input id="g-in" type="password" value="guestguestguest" aria-label="Password" readonly><button id="g-go" type="submit" aria-label="Log in">${Y.arrow}</button></form>
        <div class="g-hint" id="g-hint"></div>
      </div>
    </div>
    <div class="boot" id="boot" hidden></div>
    <div class="halt" id="halt" hidden>System halted. Click to power on.</div>`);
  bootEl = $('#boot'); gdm = $('#gdm'); halt = $('#halt');
  $('#g-form').addEventListener('submit', (e) => { e.preventDefault(); enter(); });
  halt.addEventListener('click', () => { halt.hidden = true; boot(); });
  bootEl.addEventListener('pointerdown', () => { clearTimers(); showLogin(); });
  document.addEventListener('keydown', (e) => {
    if (!bootEl.hidden) {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      e.preventDefault(); clearTimers(); showLogin(); return;
    }
    if (!gdm.hidden && (e.key === 'Enter' || e.key === ' ') && document.activeElement !== $('#g-go')) { e.preventDefault(); enter(); }
  }, true);
}

function locked(on) { OS.sessionLocked = on; }

function boot() {
  clearTimers(); OS.hidePops(); OS.exitOverview(); OS.closeGrid();
  locked(true);
  bootEl.hidden = false; gdm.hidden = true;
  root.classList.remove('booting');
  bootEl.innerHTML = '<div class="grub"><div class="hd">GNU GRUB  version 2.12</div><ul><li class="on">*BlackArch Linux</li><li>Advanced options for BlackArch Linux</li><li>UEFI Firmware Settings</li></ul><div class="ft">Use the ↑ and ↓ keys to select which entry is highlighted.<br>Press enter to boot the selected OS. Any key skips.<br>The highlighted entry will be executed automatically in 1s.</div></div>';
  later(kernel, 800);
}
function kernel() {
  bootEl.innerHTML = '<div class="klog"></div>';
  const lines = [
    ['', ':: running early hook [udev]'], ['', 'Starting systemd-udevd version 258.1-1-arch'],
    ...OS.data.sections.map((s) => ['ok', `Mounted /home/will/${s.id}`]),
    ['ok', 'Started Network Manager'], ['ok', 'Started htb-mon.service'], ['ok', 'Reached target Graphical Interface'], ['ok', 'Started GNOME Display Manager'],
  ];
  const k = $('.klog', bootEl);
  lines.forEach(([c, t], i) => later(() => k.insertAdjacentHTML('beforeend', c === 'ok' ? `<div>[  <span class="okk">OK</span>  ] ${esc(t)}</div>` : `<div>${esc(t)}</div>`), i * 85));
  later(() => showLogin(), lines.length * 85 + 250);
}
function showLogin(isLock) {
  clearTimers();
  locked(true);
  root.classList.remove('booting');
  bootEl.hidden = true; gdm.hidden = false;
  OS.hidePops(); OS.exitOverview(); OS.closeGrid();
  clearInterval(autoT);
  if (isLock) $('#g-hint').textContent = 'Locked. Press Enter to unlock.';
  else {
    let n = 3;
    const tickHint = () => { $('#g-hint').textContent = `Logging in as guest in ${n}s`; };
    tickHint();
    autoT = setInterval(() => { n--; if (n <= 0) { clearInterval(autoT); enter(); } else tickHint(); }, 1000);
  }
  setTimeout(() => $('#g-go').focus(), 30);
}
function openInitial() {
  if (!bootWin || bootWin.app === 'welcome') { WM.open('welcome'); return; }
  OS.route(bootWin.path, { max: bootWin.max, push: false, anchor: bootWin.anchor });
}
function enter() {
  clearInterval(autoT); clearTimers();
  bootEl.hidden = true; gdm.hidden = true; locked(false);
  root.classList.remove('booting');
  SS.set('rc-booted', '1');
  if (firstLogin) { firstLogin = false; if (!WM.wins.length) openInitial(); }
}
function logout() { WM.wins.slice().forEach((w) => WM.close(w)); firstLogin = true; bootWin = null; showLogin(); }

OS.boot = boot;
OS.lock = () => showLogin(true);
OS.logout = logout;
OS.halt = () => { OS.hidePops(); locked(true); halt.hidden = false; };

export function startSession(initial) {
  bootWin = initial;
  mount();
  const atRoot = !initial || initial.app === 'welcome';
  if (atRoot && !SS.get('rc-booted') && !mq.reduced.matches) boot();
  else enter();
}
