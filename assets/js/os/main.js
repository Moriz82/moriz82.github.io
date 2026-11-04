// main.js — boots the desktop around the server-rendered page.

import { OS, loadData, cachePage, root } from './lib.js';
import './wm.js';
import './apps/index.js';
import { restoreAccent } from './apps/misc.js';
import { initShell } from './shell.js';
import { startSession } from './session.js';

(async () => {
  const bw = document.getElementById('boot-win');
  try {
    await loadData();
  } catch (e) {
    // Leave the server-rendered page readable if the desktop can't start.
    console.error('desktop failed to start:', e);
    root.classList.remove('booting', 'js');
    root.classList.add('nojs');
    return;
  }
  let initial = null;
  if (bw) {
    initial = { app: bw.dataset.app, path: bw.dataset.path, max: bw.classList.contains('max') };
    cachePage(initial.path, bw.querySelector('.wb').innerHTML, bw.getAttribute('aria-label'), document.title);
    bw.remove();
  }
  restoreAccent();
  initShell();
  startSession(initial);
  OS.ready = true;
})();
