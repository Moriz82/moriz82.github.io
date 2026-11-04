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
    const wb = bw.querySelector('.wb');
    initial = { app: bw.dataset.app, path: bw.dataset.path, max: bw.classList.contains('max') };
    cachePage(initial.path, wb.innerHTML, bw.getAttribute('aria-label'), document.title);
    // hand the already-laid-out nodes to the first window so the article isn't rendered twice
    OS.adopt = { path: initial.path, nodes: document.createDocumentFragment() };
    while (wb.firstChild) OS.adopt.nodes.appendChild(wb.firstChild);
    bw.remove();
  }
  restoreAccent();
  initShell();
  startSession(initial);
  OS.ready = true;
})();
