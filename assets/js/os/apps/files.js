// files.js — Nautilus-style file manager over the virtual filesystem built from fs.json.

import { OS, $, $$, esc, LS, mq, isMobile, posts } from '../lib.js';
import { WM, hbtn } from '../wm.js';
import { I, Y, postIcon, folderIcon, SECTION_SYM } from '../icons.js';

export function filesApp(w, o) {
  let path = o.path || '~', view = LS.get('rc-view') || 'grid';
  const hist = [path]; let hi = 0;
  const sections = OS.data.sections;
  w.customTitle = true;
  w.st.insertAdjacentHTML('beforeend', hbtn(Y.back, 'Back', 'fb') + hbtn(Y.fwd, 'Forward', 'ff'));
  w.ttlEl.classList.add('wide');
  w.ttlEl.innerHTML = '<div class="pathbar"></div>';
  w.en.innerHTML = hbtn(Y.search, 'Search', 'fs') + hbtn(Y.grid, 'Grid view', 'fvg') + hbtn(Y.list, 'List view', 'fvl');
  w.body.innerHTML = '<div class="fm"><nav class="fm-side" aria-label="Places"></nav><div class="fm-main"><div class="fm-view"></div><div class="fm-status"><span class="st"></span><span class="pp"></span></div></div></div>';
  const side = $('.fm-side', w.body), viewEl = $('.fm-view', w.body), bar = $('.pathbar', w.el);
  const label = (p) => (p === '~' ? 'Home' : p === 'trash' ? 'Trash' : p.split('/').pop());

  function items() {
    if (path === '~') return [...sections.map((s) => ({ kind: 'dir', name: s.id, path: s.id, icon: folderIcon(s.id) })), { kind: 'app', name: 'whoami', app: 'about', icon: I.about }];
    if (path === 'trash') return [];
    const [sec, sub] = path.split('/');
    const subs = sub ? [] : [...new Set(posts().filter((p) => p.sec === sec && p.sub).map((p) => p.sub))]
      .map((s) => ({ kind: 'dir', name: s, path: `${sec}/${s}`, icon: folderIcon(s) }));
    const files = posts().filter((p) => p.sec === sec && (sub ? p.sub === sub : !p.sub)).map((p) => ({ kind: 'post', name: `${p.slug}.md`, post: p, icon: postIcon(p) }));
    return [...subs, ...files];
  }
  const act = (it) => {
    if (it.kind === 'dir') nav(it.path);
    else if (it.kind === 'app') WM.open(it.app);
    else OS.openPost(it.post.url);
  };
  function nav(p, push = true) {
    path = p;
    if (push) { hist.splice(hi + 1); hist.push(p); hi = hist.length - 1; }
    draw();
  }
  function draw() {
    const place = (p, name, ic) => `<button type="button" data-p="${p}" class="${p === path || path.startsWith(p + '/') ? 'on' : ''}">${ic}<span>${esc(name)}</span></button>`;
    side.innerHTML = place('~', 'Home', Y.person) + sections.map((s) => place(s.id, s.title, SECTION_SYM[s.id] || Y.folder)).join('') + place('trash', 'Trash', Y.trash)
      + `<h6>Other Locations</h6><button type="button" data-url="github">${Y.ext}<span>github.com/Moriz82</span></button><button type="button" data-url="htb">${Y.ext}<span>Hack The Box</span></button>`;
    const crumbs = path === '~' ? [['~', 'Home']] : path === 'trash' ? [['trash', 'Trash']] : [['~', 'Home'], ...path.split('/').map((s, i, a) => [a.slice(0, i + 1).join('/'), s])];
    bar.innerHTML = crumbs.map(([p, n], i) => `${i ? Y.fwd : ''}<button type="button" data-p="${p}">${esc(n)}</button>`).join('');
    $('.fb', w.el).disabled = hi <= 0;
    $('.ff', w.el).disabled = hi >= hist.length - 1;
    $('.fvg', w.el).classList.toggle('on', view === 'grid');
    $('.fvl', w.el).classList.toggle('on', view === 'list');
    const its = items();
    w.items = its;
    if (!its.length) {
      viewEl.className = 'fm-view fm-grid';
      viewEl.innerHTML = `<div class="fm-empty">${path === 'trash' ? I.trash : folderIcon()}<b>${path === 'trash' ? 'Trash is Empty' : 'Folder is Empty'}</b>${path !== 'trash' ? '<span>Nothing published here yet.</span>' : ''}</div>`;
    } else if (view === 'grid') {
      viewEl.className = 'fm-view fm-grid';
      viewEl.innerHTML = its.map((it, i) => `<button type="button" class="fi" data-i="${i}" title="${esc(it.post ? it.post.title : it.name)}"><span class="g">${it.icon}</span><span>${esc(it.name)}</span></button>`).join('');
    } else {
      viewEl.className = 'fm-view fm-list';
      viewEl.innerHTML = `<table><thead><tr><th>Name</th><th>Title</th><th>Modified</th><th>Tags</th></tr></thead><tbody>${its.map((it, i) => `<tr class="row" data-i="${i}" tabindex="0"><td>${it.icon}${esc(it.name)}</td><td>${esc(it.post ? it.post.title : '')}</td><td class="c-d">${it.post ? it.post.date : ''}</td><td class="c-d">${it.post ? esc(it.post.tags.join(', ')) : 'folder'}</td></tr>`).join('')}</tbody></table>`;
    }
    $('.st', w.body).textContent = `${its.length} item${its.length === 1 ? '' : 's'}`;
    $('.pp', w.body).textContent = path === '~' ? '/home/will' : path === 'trash' ? 'trash:///' : `/home/will/${path}`;
    w.title = label(path);
    w.el.setAttribute('aria-label', w.title);
    WM.changed();
  }
  w.nav = nav;

  w.el.addEventListener('click', (e) => {
    if (document.documentElement.classList.contains('ov')) return;
    const p = e.target.closest('[data-p]'); if (p && w.el.contains(p)) return nav(p.dataset.p);
    const u = e.target.closest('[data-url]'); if (u) return window.open(OS.data.site.links[u.dataset.url], '_blank', 'noopener');
    const it = e.target.closest('[data-i]');
    $$('[data-i]', w.body).forEach((x) => x.classList.toggle('sel', x === it));
    if (it && (mq.coarse.matches || isMobile())) act(w.items[+it.dataset.i]);
  });
  w.body.addEventListener('dblclick', (e) => { const it = e.target.closest('[data-i]'); if (it) act(w.items[+it.dataset.i]); });
  w.body.addEventListener('keydown', (e) => { const it = e.target.closest('[data-i]'); if (it && e.key === 'Enter') { e.preventDefault(); act(w.items[+it.dataset.i]); } });
  w.body.addEventListener('contextmenu', (e) => {
    const it = e.target.closest('[data-i]'); if (!it) return;
    e.preventDefault(); e.stopPropagation();
    const x = w.items[+it.dataset.i];
    OS.showCtx(e.clientX, e.clientY, [
      ['Open', () => act(x)],
      x.kind === 'dir' ? ['Open in Console', () => WM.open('term', { cwd: x.path })] : null,
      x.post ? ['Open With Text Editor', () => WM.open('editor', { post: x.post })] : null,
      x.post ? ['Copy Link', () => OS.copy(location.origin + x.post.url)] : null,
    ]);
  });
  $('.fb', w.el).addEventListener('click', () => { if (hi > 0) { hi--; nav(hist[hi], false); } });
  $('.ff', w.el).addEventListener('click', () => { if (hi < hist.length - 1) { hi++; nav(hist[hi], false); } });
  $('.fvg', w.el).addEventListener('click', () => { view = 'grid'; LS.set('rc-view', view); draw(); });
  $('.fvl', w.el).addEventListener('click', () => { view = 'list'; LS.set('rc-view', view); draw(); });
  $('.fs', w.el).addEventListener('click', () => OS.enterOverview(true));
  draw();
}
