// apps/index.js — the app registry and URL routing.

import { OS } from '../lib.js';
import { WM } from '../wm.js';
import { I } from '../icons.js';
import { webApp, webOnFocus } from './web.js';
import { filesApp } from './files.js';
import { termApp, termFocus } from './term.js';
import { editorApp } from './editor.js';
import { welcomeApp, aboutApp, contactsApp } from './pages.js';
import { certsApp, htbApp, settingsApp, snakeApp } from './misc.js';

export const APPS = {
  welcome: { title: 'Welcome', icon: () => I.welcome, w: 820, h: 600, center: true, single: true, render: welcomeApp, desc: 'Start here' },
  files: { title: 'Files', icon: () => I.files, w: 900, h: 560, render: filesApp, desc: 'Browse posts', reopen: (w, o) => o.path && w.nav(o.path) },
  term: { title: 'Console', icon: () => I.term, w: 760, h: 460, render: termApp, onfocus: termFocus, desc: 'will@archlinux shell' },
  web: { title: 'Web', icon: () => I.web, w: 1200, h: 800, center: true, single: true, render: webApp, desc: 'Read posts',
    reopen: (w, o) => o.path && w.go(o.path, { newTab: !!o.newTab, push: o.push !== false }), onresize: (w) => w.syncRail && w.syncRail(), onfocus: webOnFocus },
  editor: { title: 'Text Editor', icon: () => I.editor, w: 780, h: 560, render: editorApp, desc: 'View post source' },
  about: { title: 'whoami', icon: () => I.about, w: 900, h: 620, center: true, single: true, render: aboutApp, desc: 'Experience, competitions, certifications', reopen: (w, o) => o.sec && w.sec(o.sec) },
  certs: { title: 'Certificates', icon: () => I.certs, w: 860, h: 560, center: true, single: true, render: certsApp, desc: 'Certifications' },
  htb: { title: 'htb-mon', icon: () => I.htb, w: 460, h: 400, single: true, render: htbApp, desc: 'Hack The Box stats' },
  contacts: { title: 'Contacts', icon: () => I.contacts, w: 600, h: 540, center: true, single: true, render: contactsApp, desc: 'Email, GitHub, LinkedIn' },
  settings: { title: 'Settings', icon: () => I.settings, w: 640, h: 560, center: true, single: true, render: settingsApp, desc: 'Appearance' },
  snake: { title: 'Snake', icon: () => I.snake, w: 520, h: 540, center: true, single: true, render: snakeApp, desc: 'Game', onclose: (w) => w.stop && w.stop(), onfocus: (w) => w.focusGame && w.focusGame() },
};
OS.APPS = APPS;

// Which app owns a URL path.
export function appForPath(path) {
  if (path === '/' || path === '/index.html') return { app: 'welcome' };
  if (path === '/about.html') return { app: 'about' };
  if (path === '/contact.html') return { app: 'contacts' };
  return { app: 'web', path };
}

OS.openPost = (url, o = {}) => WM.open('web', { path: url, ...o });
OS.openFiles = (path) => {
  const w = WM.wins.find((x) => x.app === 'files' && !x.min);
  if (w && !OS.newFilesWindow) { WM.show(w); w.nav(path || '~'); return w; }
  return WM.open('files', { path: path || '~' });
};
OS.route = (path, o = {}) => {
  const r = appForPath(path);
  return r.app === 'web' ? OS.openPost(path, o) : WM.open(r.app, o);
};
OS.openApp = (id) => (id === 'web' ? OS.openPost(OS.data.posts[0] ? OS.data.posts[0].url : '/writeups/') : id === 'files' ? OS.openFiles('~') : WM.open(id));
