// pages.js — apps whose content is a server-rendered page: Welcome (/), whoami (/about.html), Contacts (/contact.html).

import { OS, $, $$, esc, fetchPage, mail, takeAdopted } from '../lib.js';
import { WM } from '../wm.js';
import { I, Y, folderIcon } from '../icons.js';

async function load(w, path, then) {
  w.path = path;
  const adopted = takeAdopted(path);
  if (adopted) { w.body.appendChild(adopted); then && then(); return; }
  w.body.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const { html } = await fetchPage(path);
    w.body.innerHTML = html;
    then && then();
  } catch (e) {
    w.body.innerHTML = '<div class="loading">Could not load this page.</div>';
  }
}

export function welcomeApp(w) {
  load(w, '/', () => {
    $$('[data-icon]', w.body).forEach((el) => {
      const [kind, id] = el.dataset.icon.split(':');
      el.innerHTML = kind === 'folder' ? folderIcon(id) : I[id] || '';
    });
  });
}

const SEC_ICONS = { person: Y.person, brief: Y.brief, trophy: Y.trophy, medal: Y.medal, code: Y.code, cap: Y.cap };
export function aboutApp(w, o) {
  w.sec = () => {};
  load(w, '/about.html', () => {
    const secs = $$('.ab-sec', w.body);
    $('.ab-side', w.body).innerHTML = secs.map((s) => `<button type="button" data-sec="${s.dataset.sec}">${SEC_ICONS[s.dataset.icon] || ''}<span>${esc(s.dataset.title)}</span></button>`).join('');
    w.sec = (k) => {
      const sec = secs.find((s) => s.dataset.sec === k) || secs[0];
      secs.forEach((s) => s.classList.toggle('on', s === sec));
      $$('[data-sec]', $('.ab-side', w.body)).forEach((b) => b.classList.toggle('on', b.dataset.sec === sec.dataset.sec));
      $('.ab-main', w.body).scrollTop = 0;
      WM.setTitle(w, sec.dataset.title, 'whoami');
    };
    $('.ab-side', w.body).addEventListener('click', (e) => { const b = e.target.closest('[data-sec]'); if (b) w.sec(b.dataset.sec); });
    w.sec(o.sec || 'profile');
  });
}

export function contactsApp(w) {
  load(w, '/contact.html', () => {
    const btn = $('[data-mail-show]', w.body), v = $('[data-mail]', w.body);
    if (!btn) return;
    v.textContent = 'Hidden from scrapers';
    btn.addEventListener('click', () => {
      if (btn.dataset.on) return OS.copy(mail());
      btn.dataset.on = '1';
      v.innerHTML = `<a class="lnk" href="mailto:${mail()}">${mail()}</a>`;
      btn.innerHTML = `${Y.copy} Copy`;
      btn.classList.remove('sug');
    });
  });
}
