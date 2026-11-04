// web.js — the Web app: tabs, back/forward, real URLs in the address bar. Page bodies come
// from the server-rendered HTML of each URL (fetchPage), so there is one source of truth.

import { OS, $, $$, esc, fetchPage, posts, takeAdopted } from '../lib.js';
import { WM, hbtn } from '../wm.js';
import { Y } from '../icons.js';

const NEWTAB = 'about:newtab';

export function webApp(w, o) {
  w.tabs = []; w.ti = -1; w.customTitle = true;
  let token = 0;
  w.st.insertAdjacentHTML('beforeend', hbtn(Y.back, 'Back', 'nb') + hbtn(Y.fwd, 'Forward', 'nf') + hbtn(Y.reload, 'Reload', 'nr'));
  w.ttlEl.classList.add('wide');
  w.ttlEl.innerHTML = `<div class="url">${Y.lock}<span class="sch"></span><span class="p"></span></div>`;
  w.en.innerHTML = `<a class="hbtn ne" target="_blank" rel="noopener" aria-label="Open in a new browser tab" title="Open in a new browser tab">${Y.ext}</a>` + hbtn(Y.plus, 'New tab', 'nt');
  w.body.innerHTML = '<div class="bw"><div class="tabs" role="tablist" hidden></div><div class="page"></div></div>';
  const tabsEl = $('.tabs', w.body), page = $('.page', w.body);
  w.page = page;
  const cur = () => w.tabs[w.ti];
  const curPath = () => cur().hist[cur().i];

  function drawTabs() {
    tabsEl.hidden = w.tabs.length < 2;
    tabsEl.innerHTML = w.tabs.map((t, i) => `<div class="tab${i === w.ti ? ' on' : ''}" role="tab" aria-selected="${i === w.ti}"><button class="tt" type="button" data-tab="${i}">${esc(t.title || 'Loading')}</button><button class="tx" type="button" data-tx="${i}" aria-label="Close tab">${Y.x}</button></div>`).join('');
  }

  function newTabHtml() {
    const recent = posts().slice(0, 8);
    return `<div class="pg solo"><article class="art"><div class="art-k">New tab</div><h1>Recent posts</h1><ul class="idx">${recent.map((p) => `<li><a href="${p.url}"><b>${esc(p.title)}</b><span class="s">${esc(p.summary)}</span><span class="d">${p.sec} · ${p.date}</span></a></li>`).join('')}</ul></article></div>`;
  }

  async function render(push, anchor) {
    const path = curPath(), t = cur(), my = ++token;
    $('.url .sch', w.el).textContent = path === NEWTAB ? '' : location.host;
    $('.url .p', w.el).textContent = path === NEWTAB ? 'New tab' : path;
    $('.ne', w.el).href = path === NEWTAB ? '/' : path;
    $('.nb', w.el).disabled = t.i <= 0;
    $('.nf', w.el).disabled = t.i >= t.hist.length - 1;
    let html, title, docTitle;
    if (path === NEWTAB) { html = newTabHtml(); title = 'New tab'; docTitle = OS.data.site.name; }
    else {
      if (!OS.adopt) page.innerHTML = '<div class="loading">Loading…</div>';
      try { ({ html, title, docTitle } = await fetchPage(path)); }
      catch (e) {
        if (my !== token) return;
        html = `<div class="pg solo"><article class="art"><h1>Page not found</h1><p class="lede">Nothing lives at <code>${esc(path)}</code>.</p><p><a href="/">Go home</a></p></article></div>`;
        title = 'Not found'; docTitle = `Not found · ${OS.data.site.name}`;
      }
    }
    if (my !== token) return;
    const adopted = takeAdopted(path);
    if (adopted) { page.textContent = ''; page.appendChild(adopted); } else page.innerHTML = html;
    t.title = title;
    w.docTitle = docTitle;
    w.path = path === NEWTAB ? null : path;
    drawTabs();
    syncRail(true);
    scrollSpy();
    const target = anchor && page.querySelector('#' + CSS.escape(anchor));
    if (target) page.dataset.full = '1'; else delete page.dataset.full;
    page.scrollTop = target ? target.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop - 10 : 0;
    w.title = title;
    w.el.setAttribute('aria-label', title);
    WM.changed();
    if (w.path && WM.active === w) {
      if (push && location.pathname !== w.path) history.pushState({ web: w.path }, '', w.path);
      else if (location.pathname !== w.path) history.replaceState({ web: w.path }, '', w.path);
      document.title = docTitle;
    }
  }

  w.go = (path, opts = {}) => {
    const ex = w.tabs.findIndex((t) => t.hist[t.i] === path);
    if (ex >= 0 && !opts.sameTab) w.ti = ex;
    else if (opts.newTab || !w.tabs.length) { w.tabs.push({ hist: [path], i: 0 }); w.ti = w.tabs.length - 1; }
    else { const t = cur(); t.hist.splice(t.i + 1); t.hist.push(path); t.i = t.hist.length - 1; }
    render(opts.push !== false, opts.anchor);
  };
  w.nav = (path, anchor) => w.go(path, { sameTab: true, anchor });

  let wide = null;
  function syncRail(force) {
    const now = w.body.clientWidth > 880;
    if (force || now !== wide) { wide = now; $$('.rail', page).forEach((r) => { r.open = now; }); }
  }
  w.syncRail = () => syncRail();
  if (window.ResizeObserver) new ResizeObserver(() => syncRail()).observe(w.body);

  function scrollSpy() {
    const stages = $$('.wp-stage', page), items = $$('.kc li', page);
    if (!stages.length || !items.length) return;
    let on = 0;
    stages.forEach((el, i) => { if (el.offsetTop - 90 <= page.scrollTop) on = i; });
    items.forEach((li, i) => li.classList.toggle('on', i === on));
  }
  page.addEventListener('scroll', scrollSpy, { passive: true });

  tabsEl.addEventListener('click', (e) => {
    const x = e.target.closest('[data-tx]');
    if (x) {
      const i = +x.dataset.tx;
      w.tabs.splice(i, 1);
      if (!w.tabs.length) return WM.close(w);
      if (w.ti >= i && w.ti > 0) w.ti--;
      w.ti = Math.min(w.ti, w.tabs.length - 1);
      return render(true);
    }
    const t = e.target.closest('[data-tab]');
    if (t) { w.ti = +t.dataset.tab; render(true); }
  });
  $('.nb', w.el).addEventListener('click', () => { if (cur().i > 0) { cur().i--; render(true); } });
  $('.nf', w.el).addEventListener('click', () => { if (cur().i < cur().hist.length - 1) { cur().i++; render(true); } });
  $('.nr', w.el).addEventListener('click', () => render(false));
  $('.nt', w.el).addEventListener('click', () => w.go(NEWTAB, { newTab: true }));

  w.go(o.path || '/writeups/', { newTab: true, push: o.push !== false, anchor: o.anchor });
}

export function webOnFocus(w) {
  if (w.path && location.pathname !== w.path) {
    history.replaceState({ web: w.path }, '', w.path);
    if (w.docTitle) document.title = w.docTitle;
  }
}
