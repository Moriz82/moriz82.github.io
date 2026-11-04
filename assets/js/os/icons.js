// icons.js — inline SVG icon set (Adwaita-ish, recolored for BlackArch).

const S = (inner, vb) => `<svg viewBox="${vb || '0 0 64 64'}" aria-hidden="true" focusable="false">${inner}</svg>`;
const sq = (bg, inner) => S(`<rect x="4" y="4" width="56" height="56" rx="14" fill="${bg}"/>${inner}`);

export const EMB = {
  home: '<path d="M24 46v-9l8-7 8 7v9z"/>',
  blog: '<path d="M25 45l3-9 10-10 6 6-10 10z"/><path d="M35 29l6 6"/>',
  writeups: '<path d="M26 47V31h13l-2.6 4 2.6 4H26"/>',
  competitions: '<path d="M26 30h12v5a6 6 0 0 1-12 0z"/><path d="M32 41v5M27 47h10M26 32h-4a3 3 0 0 0 4 4M38 32h4a3 3 0 0 1-4 4"/>',
  projects: '<path d="M27 32l-5 5 5 5M37 32l5 5-5 5"/>',
  homelab: '<rect x="23" y="30" width="18" height="6" rx="1.5"/><rect x="23" y="39" width="18" height="6" rx="1.5"/>',
};
export const FOLD = (emb) => S(`<path d="M6 16a5 5 0 0 1 5-5h14l5 5h23a5 5 0 0 1 5 5v28a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5z" fill="#2e2e33"/><path d="M6 24a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v25a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5z" fill="#4a4a51"/>${emb ? `<g fill="none" stroke="#e01b1b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${emb}</g>` : ''}`);
export const DOC = (label, c) => S(`<path d="M14 4h26l12 12v44H14z" fill="#f2f2f2"/><path d="M40 4v12h12" fill="#bdbdbd"/><path d="M20 24h24M20 30h26M20 36h18" stroke="#9a9a9a" stroke-width="2.5" stroke-linecap="round"/><rect x="10" y="44" width="${label.length * 8 + 12}" height="13" rx="3" fill="${c}"/><text x="16" y="54" font-family="Fira Code, monospace" font-weight="700" font-size="10" fill="#fff">${label}</text>`);
export const AVATAR = '<img src="/assets/img/avatar.svg" alt="">';

export const I = {
  term: sq('#1a1a1c', '<rect x="4.5" y="4.5" width="55" height="55" rx="13.5" fill="none" stroke="#3a3a3f"/><path d="M17 26l8 6-8 6" fill="none" stroke="#ff5c5c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M29 40h16" stroke="#f2f2f2" stroke-width="4" stroke-linecap="round"/>'),
  files: S('<path d="M6 16a5 5 0 0 1 5-5h14l5 5h23a5 5 0 0 1 5 5v28a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5z" fill="#2e2e33"/><path d="M6 24a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v25a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5z" fill="#5a5a62"/><rect x="18" y="31" width="28" height="4" rx="2" fill="#d6d6d6"/>'),
  web: S('<circle cx="32" cy="32" r="27" fill="#2b2b30"/><path d="M5 32h54M32 5c10 8 10 46 0 54M32 5c-10 8-10 46 0 54M10 18h44M10 46h44" fill="none" stroke="#bdbdc4" stroke-width="2"/><circle cx="32" cy="32" r="27" fill="none" stroke="#5a5a62" stroke-width="2"/>'),
  editor: S('<path d="M12 4h30l10 10v46H12z" fill="#f2f2f2"/><path d="M42 4v10h10" fill="#cfcfcf"/><path d="M19 22h20M19 29h26M19 36h14" stroke="#9a9a9a" stroke-width="2.5" stroke-linecap="round"/><path d="M30 54l3-9 17-17 6 6-17 17z" fill="#f6d32d" stroke="#986a0d" stroke-width="1.5"/>'),
  about: S('<clipPath id="ic-av"><circle cx="32" cy="32" r="28"/></clipPath><image href="/assets/img/avatar.svg" x="4" y="4" width="56" height="56" clip-path="url(#ic-av)"/><circle cx="32" cy="32" r="28" fill="none" stroke="#4a4a51" stroke-width="1.5"/>'),
  certs: S('<path d="M22 38l-6 20 8-4 5 7 5-17zM42 38l6 20-8-4-5 7-5-17z" fill="#a30000"/><circle cx="32" cy="27" r="20" fill="#f6d32d"/><circle cx="32" cy="27" r="14" fill="none" stroke="#986a0d" stroke-width="2.5"/><path d="M25 27l5 5 9-10" fill="none" stroke="#986a0d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'),
  htb: sq('#111a14', '<path d="M32 13l17 10v18L32 51 15 41V23z" fill="none" stroke="#57e389" stroke-width="3.5" stroke-linejoin="round"/><path d="M15 23l17 10 17-10M32 33v18" fill="none" stroke="#57e389" stroke-width="3" stroke-linejoin="round"/>'),
  contacts: sq('#3a3a40', '<circle cx="32" cy="26" r="9" fill="#f2f2f2"/><path d="M16 50c2-9 9-13 16-13s14 4 16 13z" fill="#f2f2f2"/>'),
  settings: S('<circle cx="32" cy="32" r="22" fill="none" stroke="#9a9a9a" stroke-width="10" stroke-dasharray="7.6 6"/><circle cx="32" cy="32" r="18" fill="#2b2b30" stroke="#9a9a9a" stroke-width="4"/><circle cx="32" cy="32" r="6" fill="#c80000"/>'),
  snake: sq('#0d1b12', '<path d="M16 44h12a6 6 0 0 0 0-12h-8a6 6 0 0 1 0-12h24" fill="none" stroke="#57e389" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="46" cy="20" r="3.5" fill="#f66151"/>'),
  welcome: sq('#0b0b0d', '<use href="#ba" x="17" y="10" width="30" height="38"/>'),
  trash: S('<path d="M16 18h32l-3 40H19z" fill="#2b2b30" stroke="#9a9a9a" stroke-width="2.5" stroke-linejoin="round"/><path d="M11 17h42M25 17v-6h14v6M27 26v24M37 26v24" fill="none" stroke="#9a9a9a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  appgrid: S(`<g fill="#f2f2f2">${[0, 1, 2].map((r) => [0, 1, 2].map((c) => `<rect x="${12 + c * 15}" y="${12 + r * 15}" width="10" height="10" rx="3"/>`).join('')).join('')}</g>`),
  cube: S('<path d="M32 6l23 13v26L32 58 9 45V19z" fill="none" stroke="#57e389" stroke-width="6" stroke-linejoin="round"/><path d="M9 19l23 13 23-13M32 32v26" fill="none" stroke="#57e389" stroke-width="5" stroke-linejoin="round"/>'),
};

// 16px symbolic icons
const sym = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${d}</svg>`;
const st = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
export const Y = {
  x: `<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  minus: `<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  maxi: `<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1.5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  back: sym(`<path d="M10 3L5 8l5 5" ${st}/>`),
  fwd: sym(`<path d="M6 3l5 5-5 5" ${st}/>`),
  reload: sym(`<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2v3h-3" ${st}/>`),
  ext: sym(`<path d="M9 3h4v4M13 3L7 9M11 10v3H3V5h3" ${st}/>`),
  grid: sym('<g fill="currentColor"><rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/></g>'),
  list: sym(`<path d="M2 4h12M2 8h12M2 12h12" ${st}/>`),
  plus: sym(`<path d="M8 3v10M3 8h10" ${st}/>`),
  search: sym(`<circle cx="7" cy="7" r="4.5" ${st}/><path d="M10.5 10.5L14 14" ${st}/>`),
  net: sym(`<rect x="2" y="9" width="12" height="5" rx="1.2" ${st}/><path d="M8 9V5M5 5h6M8 2v3" ${st}/>`),
  vol: sym(`<path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" ${st}/>`),
  bat: sym('<rect x="1.5" y="4.5" width="11.5" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="3" y="6" width="8.5" height="4" rx=".6" fill="currentColor"/><path d="M14.5 7v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  power: sym(`<path d="M8 1.5v6M4.4 4a5.5 5.5 0 1 0 7.2 0" ${st}/>`),
  lock: sym('<rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
  gear: sym('<circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-dasharray="2.2 1.9"/><circle cx="8" cy="8" r="2" fill="currentColor"/>'),
  moon: sym('<path d="M13 10A6 6 0 0 1 6 3a6 6 0 1 0 7 7z" fill="currentColor"/>'),
  bell: sym(`<path d="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11zM6.5 14h3" ${st}/>`),
  sun: sym('<circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'),
  copy: sym('<rect x="5" y="5" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" fill="none" stroke="currentColor" stroke-width="1.4"/>'),
  arrow: sym(`<path d="M3 8h10M9 4l4 4-4 4" ${st}/>`),
  person: sym('<circle cx="8" cy="5.5" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 14c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'),
  brief: sym('<rect x="1.5" y="4.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>'),
  trophy: sym('<path d="M5 2h6v4a3 3 0 0 1-6 0zM8 9v3M5 14h6M5 3H2.5a2 2 0 0 0 2.5 3M11 3h2.5A2 2 0 0 1 11 6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'),
  medal: sym('<circle cx="8" cy="10" r="4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 1.5l2 5M11 1.5l-2 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'),
  cap: sym('<path d="M1 6l7-3.5L15 6 8 9.5zM4 7.5V11c1 1 2.5 1.5 4 1.5s3-.5 4-1.5V7.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'),
  code: sym(`<path d="M5.5 4L2 8l3.5 4M10.5 4L14 8l-3.5 4" ${st}/>`),
  pen: sym(`<path d="M3 13l1-3.5 7-7 2.5 2.5-7 7z" ${st}/>`),
  folder: sym(`<path d="M1.5 4a1 1 0 0 1 1-1h4l1.5 1.5h5.5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" ${st}/>`),
  trash: sym(`<path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 9h5.6l.7-9" ${st}/>`),
};

export const SECTION_SYM = { blog: Y.pen, writeups: Y.list, competitions: Y.trophy, projects: Y.code };
const DOC_COLORS = { writeups: ['HTB', '#26a269'], blog: ['MD', '#c80000'], competitions: ['MD', '#9141ac'], projects: ['MD', '#c64600'] };
export const postIcon = (p) => { const [l, c] = DOC_COLORS[p.sec] || ['MD', '#5e5c64']; return DOC(l, c); };
export const folderIcon = (id) => FOLD(EMB[id] || EMB.projects);
