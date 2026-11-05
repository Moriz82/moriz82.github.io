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
import { minesApp, sudokuApp, mergeApp, blocksApp, lightsApp, fourApp, reversiApp } from './games.js';
import { calcApp, clocksApp, calendarApp, sysmonApp, viewerApp } from './utils.js';

const stop = (w) => w.stop && w.stop();
const focusGame = (w) => w.focusGame && w.focusGame();

export const APPS = {
  welcome: { title: 'Welcome', icon: () => I.welcome, w: 820, h: 600, center: true, single: true, render: welcomeApp, desc: 'Start here' },
  files: { title: 'Files', icon: () => I.files, w: 900, h: 560, render: filesApp, desc: 'Browse posts', reopen: (w, o) => o.path && w.nav(o.path) },
  term: { title: 'Console', icon: () => I.term, w: 760, h: 460, render: termApp, onfocus: termFocus, desc: 'will@archlinux shell' },
  web: { title: 'Web', icon: () => I.web, w: 1200, h: 800, center: true, single: true, render: webApp, desc: 'Read posts',
    reopen: (w, o) => o.path && w.go(o.path, { newTab: !!o.newTab, push: o.push !== false, anchor: o.anchor }), onresize: (w) => w.syncRail && w.syncRail(), onfocus: webOnFocus },
  editor: { title: 'Text Editor', icon: () => I.editor, w: 780, h: 560, render: editorApp, desc: 'View post source' },
  about: { title: 'whoami', icon: () => I.about, w: 900, h: 620, center: true, single: true, render: aboutApp, desc: 'Experience, competitions, certifications', reopen: (w, o) => o.sec && w.sec(o.sec) },
  certs: { title: 'Certificates', icon: () => I.certs, w: 860, h: 560, center: true, single: true, render: certsApp, desc: 'Certifications' },
  htb: { title: 'htb-mon', icon: () => I.htb, w: 460, h: 400, single: true, render: htbApp, desc: 'Hack The Box stats' },
  contacts: { title: 'Contacts', icon: () => I.contacts, w: 600, h: 540, center: true, single: true, render: contactsApp, desc: 'Email, GitHub, LinkedIn' },
  settings: { title: 'Settings', icon: () => I.settings, w: 640, h: 560, center: true, single: true, render: settingsApp, desc: 'Appearance' },
  snake: { title: 'Snake', icon: () => I.snake, w: 520, h: 540, center: true, single: true, render: snakeApp, desc: 'Game', folder: 'games', onclose: stop, onfocus: focusGame },
  mines: { title: 'Mines', icon: () => I.mines, w: 560, h: 620, center: true, single: true, render: minesApp, desc: 'Clear the minefield', folder: 'games', onclose: stop },
  sudoku: { title: 'Sudoku', icon: () => I.sudoku, w: 520, h: 680, center: true, single: true, render: sudokuApp, desc: 'Number puzzle', folder: 'games', onclose: stop, onfocus: focusGame },
  merge: { title: 'Merge', icon: () => I.merge, w: 460, h: 560, center: true, single: true, render: mergeApp, desc: 'Slide and double tiles to 2048', folder: 'games', onfocus: focusGame },
  blocks: { title: 'Blocks', icon: () => I.blocks, w: 480, h: 600, center: true, single: true, render: blocksApp, desc: 'Falling blocks', folder: 'games', onclose: stop, onfocus: focusGame },
  lights: { title: 'Lights Off', icon: () => I.lights, w: 440, h: 560, center: true, single: true, render: lightsApp, desc: 'Turn every light off', folder: 'games' },
  four: { title: 'Four in a Row', icon: () => I.four, w: 560, h: 600, center: true, single: true, render: fourApp, desc: 'Connect four against the computer', folder: 'games' },
  reversi: { title: 'Reversi', icon: () => I.reversi, w: 540, h: 620, center: true, single: true, render: reversiApp, desc: 'Flip discs against the computer', folder: 'games' },
  calc: { title: 'Calculator', icon: () => I.calc, w: 380, h: 560, single: true, render: calcApp, desc: 'Math, plus hex and binary', folder: 'utils', onfocus: focusGame },
  clocks: { title: 'Clocks', icon: () => I.clocks, w: 520, h: 560, single: true, render: clocksApp, desc: 'World clock, stopwatch, timer', folder: 'utils', onclose: stop },
  calendar: { title: 'Calendar', icon: () => I.calendar, w: 920, h: 620, center: true, single: true, render: calendarApp, desc: 'Posts by date', folder: 'utils' },
  sysmon: { title: 'System Monitor', icon: () => I.sysmon, w: 760, h: 560, single: true, render: sysmonApp, desc: 'Processes and resources', folder: 'utils', onclose: stop },
  viewer: { title: 'Image Viewer', icon: () => I.viewer, w: 900, h: 640, center: true, single: true, render: viewerApp, desc: 'Screenshots and photos', folder: 'utils', reopen: (w, o) => o.src && w.open(o.src) },
};
// GNOME's app-grid folders
export const FOLDERS = { games: 'Games', utils: 'Utilities' };
OS.FOLDERS = FOLDERS;
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
