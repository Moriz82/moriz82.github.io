// lib.js — shared helpers and the runtime registry (OS) the modules use to reach each other.

export const OS = {};
export const root = document.documentElement;
export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const SS = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };
export const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
export const mq = {
  mobile: matchMedia('(max-width: 767px)'),
  coarse: matchMedia('(pointer: coarse)'),
  reduced: matchMedia('(prefers-reduced-motion: reduce)'),
};
export const isMobile = () => root.classList.contains('mobile');
export const inOverview = () => root.classList.contains('ov');

export async function loadData() {
  const res = await fetch('/assets/data/fs.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`fs.json ${res.status}`);
  OS.data = await res.json();
  return OS.data;
}

// Pages are server-rendered; apps pull the window body out of the built HTML.
const pages = new Map();
export function cachePage(path, html, title, docTitle) { pages.set(path, { html, title, docTitle }); }
export async function fetchPage(path) {
  if (pages.has(path)) return pages.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const win = doc.getElementById('boot-win');
  if (!win) throw new Error(`${path}: no window content`);
  const out = { html: win.querySelector('.wb').innerHTML, title: win.getAttribute('aria-label') || doc.title, docTitle: doc.title };
  pages.set(path, out);
  return out;
}

// The first window to show the page the browser loaded takes its DOM nodes as-is.
export function takeAdopted(path) {
  if (!OS.adopt || OS.adopt.path !== path) return null;
  const nodes = OS.adopt.nodes;
  OS.adopt = null;
  return nodes;
}

export const posts = () => (OS.data ? OS.data.posts : []);
export const postByUrl = (url) => posts().find((p) => p.url === url);
// virtual filesystem path: writeups/htb-heal-writeup, projects/homelab/cyber-range-homelab
export const fsPath = (p) => `${p.sec}/${p.sub ? p.sub + '/' : ''}${p.slug}`;
export const mail = () => { const m = OS.data.site.emailParts; return `${m[2]}${String.fromCharCode(64)}${m[1]}.${m[0]}`; };


export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
