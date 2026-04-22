#!/usr/bin/env node
/* build.js — read posts/*.md, apply Handlebars templates, emit HTML. */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const Handlebars = require('handlebars');
const { preprocess } = require('./shortcodes');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const PARTIALS_DIR = path.join(TEMPLATES_DIR, 'partials');
const OUT = {
  home: path.join(ROOT, 'index.html'),
  about: path.join(ROOT, 'about.html'),
  contact: path.join(ROOT, 'contact.html'),
  writeupsIndex: path.join(ROOT, 'writeups', 'index.html'),
  projectsIndex: path.join(ROOT, 'projects', 'index.html'),
};

// ─── Handlebars helpers ─────────────────────────────────────────
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('upper', (s) => (s == null ? '' : String(s).toUpperCase()));
Handlebars.registerHelper('padVal', (n) => {
  if (n == null) return '00';
  const s = String(n);
  return s.length === 1 ? '0' + s : s;
});
Handlebars.registerHelper('first', (arr) => (Array.isArray(arr) && arr.length ? arr[0] : ''));
Handlebars.registerHelper('inc', (n) => Number(n) + 1);
Handlebars.registerHelper('ifeq', function (a, b, opts) { return a === b ? opts.fn(this) : opts.inverse(this); });
Handlebars.registerHelper('anchor', (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
Handlebars.registerHelper('outcome', (arr) => {
  if (!Array.isArray(arr) || !arr.length) return '';
  return String(arr[arr.length - 1].stage || '').toUpperCase();
});

// ─── Load partials ──────────────────────────────────────────────
for (const file of fs.readdirSync(PARTIALS_DIR)) {
  if (!file.endsWith('.hbs')) continue;
  const name = path.basename(file, '.hbs');
  Handlebars.registerPartial(name, fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf8'));
}

// ─── Load templates ─────────────────────────────────────────────
const tpl = {};
for (const file of fs.readdirSync(TEMPLATES_DIR)) {
  if (!file.endsWith('.hbs') || file.startsWith('partials')) continue;
  const name = path.basename(file, '.hbs');
  tpl[name] = Handlebars.compile(fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8'));
}

// ─── Load data ──────────────────────────────────────────────────
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const htbStats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'htb.json'), 'utf8'));

// ─── Read posts ─────────────────────────────────────────────────
const posts = [];
if (fs.existsSync(POSTS_DIR)) {
  for (const file of fs.readdirSync(POSTS_DIR)) {
    if (!file.endsWith('.md') || file.startsWith('_')) continue;
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const parsed = matter(raw);
    const fm = parsed.data;
    if (!fm.slug || !fm.title || !fm.type) {
      console.warn(`[skip] ${file} — missing front-matter (slug/title/type)`);
      continue;
    }
    const rawBody = preprocess(parsed.content);
    posts.push({
      ...fm,
      sourceFile: file,
      body: marked.parse(rawBody, { mangle: false, headerIds: true }),
      dateObj: fm.date ? new Date(fm.date) : new Date(0),
    });
  }
}
posts.sort((a, b) => b.dateObj - a.dateObj);
const writeups = posts.filter((p) => p.type === 'writeup');
const projects = posts.filter((p) => p.type === 'project');

// ─── Helpers ────────────────────────────────────────────────────
function longDate(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function shortAgo(dateStr) {
  const dt = new Date(dateStr);
  if (isNaN(dt)) return '';
  const diff = Date.now() - dt.getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (d < 1) return 'TODAY';
  if (d < 7) return `${d}D AGO`;
  if (d < 30) return `${Math.floor(d / 7)}W AGO`;
  if (d < 365) return `${Math.floor(d / 30)}MO AGO`;
  return `${Math.floor(d / 365)}Y AGO`;
}
function ensureDir(fp) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
}

// ─── HTB stats shaping ──────────────────────────────────────────
const order = ['Easy', 'Medium', 'Hard', 'Insane'];
const diffMap = Object.fromEntries((htbStats.difficulties || []).map((d) => [d.label, d.value]));
const total = order.reduce((s, k) => s + (diffMap[k] || 0), 0);
const clsMap = { Easy: 'ok', Medium: 'cool', Hard: 'warn', Insane: 'hot' };
const bars = order.map((k) => {
  const value = diffMap[k] || 0;
  const pct = total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 0;
  return { label: k.toUpperCase(), value, pct, cls: clsMap[k] };
});
const recent = htbStats.boxes && htbStats.boxes[0]
  ? { ...htbStats.boxes[0], ago: shortAgo(htbStats.boxes[0].date) }
  : null;

const htbCtx = {
  profileId: site.htb.profileId,
  profileUrl: site.htb.profileUrl,
  updatedAgo: '04H AGO',
  total,
  percent: site.htb.percent,
  bars,
  recent,
};

const footerCtx = {
  htbUrl: site.htb.profileUrl,
  htbTotal: total,
  ctfCount: site.ctfs.count,
  buildTime: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
};

// ─── Latest writeup for home ────────────────────────────────────
const latest = writeups[0]
  ? {
      href: `posts/${writeups[0].slug}.html`,
      title: writeups[0].title,
      category: `HTB · ${writeups[0].difficulty || ''} · ${writeups[0].os || ''}`.replace(/\s+·\s*$/,''),
      summary: writeups[0].summary || '',
      tags: (writeups[0].tags || []).slice(0, 4),
      ago: shortAgo(writeups[0].date),
    }
  : null;

// ─── Render pages ───────────────────────────────────────────────
const baseCtx = (active, root = '') => ({
  root,
  active,
  year: new Date().getFullYear(),
  footer: footerCtx,
});

// Home
fs.writeFileSync(
  OUT.home,
  tpl.home({
    ...baseCtx('home', ''),
    description: 'Will DeDominico — student security researcher at UTSA. Writeups, projects, HTB, CTFs.',
    title: "Will DeDominico · Student Security Researcher",
    htb: htbCtx,
    ctfs: site.ctfs,
    experience: site.experience,
    certs: site.certs,
    latest,
  })
);
console.log('[ok] index.html');

// About
fs.writeFileSync(
  OUT.about,
  tpl.about({
    ...baseCtx('about', ''),
    description: 'About Will DeDominico — education, experience, CTFs, certs, clubs at UTSA.',
    title: 'About · Will DeDominico',
    education: site.education,
    experience: site.experience,
    ctfs: site.ctfs,
    certs: site.certs,
    clubs: site.clubs,
  })
);
console.log('[ok] about.html');

// Contact
fs.writeFileSync(
  OUT.contact,
  tpl.contact({
    ...baseCtx('contact', ''),
    description: 'Contact Will DeDominico — mailto form and direct links.',
    title: 'Contact · Will DeDominico',
  })
);
console.log('[ok] contact.html');

// Writeups index (grouped by category)
ensureDir(OUT.writeupsIndex);
const WRITEUP_GROUPS = [
  { slug: 'htb',     label: 'Hack The Box' },
  { slug: 'cit-ctf', label: 'CIT@CTF' },
  { slug: 'other',   label: 'Other / Research' },
];
const writeupsForIndex = writeups.map((p) => ({
  title: p.title,
  summary: p.summary,
  tags: p.tags || [],
  difficulty: (p.difficulty || '').toLowerCase(),
  os: p.os || '',
  category: (p.category || 'htb').toLowerCase(),
  typeLabel: 'writeup',
  href: `../posts/${p.slug}.html`,
  dateLong: longDate(p.date),
  readTime: p.readTime || '',
}));
const writeupGroups = WRITEUP_GROUPS.map((g) => ({
  slug: g.slug,
  label: g.label,
  posts: writeupsForIndex.filter((p) => p.category === g.slug),
}));
fs.writeFileSync(
  OUT.writeupsIndex,
  tpl['writeups-index']({
    ...baseCtx('writeups', '../'),
    description: 'Writeups by Will DeDominico — HTB, CTF, and research walkthroughs.',
    title: 'Writeups · Will DeDominico',
    count: writeups.length,
    groupCount: writeupGroups.filter((g) => g.posts.length > 0).length || writeupGroups.length,
    groups: writeupGroups,
  })
);
console.log(`[ok] writeups/index.html (${writeups.length})`);

// Projects index
ensureDir(OUT.projectsIndex);
const projectsForIndex = projects.map((p) => ({
  title: p.title,
  summary: p.summary,
  tags: p.tags || [],
  typeLabel: 'project',
  href: `../posts/${p.slug}.html`,
  dateLong: longDate(p.date),
  readTime: p.readTime || '',
}));
fs.writeFileSync(
  OUT.projectsIndex,
  tpl['projects-index']({
    ...baseCtx('projects', '../'),
    description: 'Projects by Will DeDominico — homelab, SDR, apps.',
    title: 'Projects · Will DeDominico',
    count: projects.length,
    posts: projectsForIndex,
  })
);
console.log(`[ok] projects/index.html (${projects.length})`);

// Build prev/next navigation map within each type
function prevNext(list, slug) {
  const idx = list.findIndex((p) => p.slug === slug);
  return {
    prev: idx > 0 ? list[idx - 1] : null,
    next: idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null,
  };
}
// Newest first already; for prev/next we invert so "prev" = older, "next" = newer
const writeupsOldestFirst = [...writeups].reverse();
const projectsOldestFirst = [...projects].reverse();

// Individual posts
for (const p of posts) {
  const isWriteup = p.type === 'writeup';
  const outPath = path.join(POSTS_DIR, `${p.slug}.html`);
  const list = isWriteup ? writeupsOldestFirst : projectsOldestFirst;
  const { prev, next } = prevNext(list, p.slug);
  const engNumber = (list.findIndex((x) => x.slug === p.slug) + 1);
  const engLabel = `ENG#${String(engNumber).padStart(2, '0')}`;

  const baseData = {
    ...baseCtx(isWriteup ? 'writeups' : 'projects', '../'),
    description: p.summary || p.title,
    title: `${p.title} · Will DeDominico`,
    postTitle: p.title,
    typeLabel: p.type,
    difficulty: p.difficulty || '',
    os: p.os || '',
    points: p.points || '',
    dateLong: longDate(p.date),
    dateCode: p.date ? new Date(p.date).toISOString().slice(2, 10).replace(/-/g, '.') : '',
    readTime: p.readTime || '',
    tags: p.tags || [],
    summary: p.summary || '',
    body: p.body,
    navActive: isWriteup ? 'writeups' : 'projects',
    indexHref: isWriteup ? 'writeups/index.html' : 'projects/index.html',
    engLabel,
    engSlug: engLabel.toLowerCase().replace('#', ''),
    engBreadcrumbCategory: isWriteup ? 'HTB' : 'BUILDS',
    engBreadcrumbName: (p.slug || '').replace(/-writeup$/, '').toUpperCase(),
    prev: prev ? { title: prev.title.replace(/\s*Writeup$/i, '').toUpperCase(), slug: prev.slug, label: `ENG#${String(list.findIndex(x => x.slug === prev.slug) + 1).padStart(2,'0')}` } : null,
    next: next ? { title: next.title.replace(/\s*Writeup$/i, '').toUpperCase(), slug: next.slug, label: `ENG#${String(list.findIndex(x => x.slug === next.slug) + 1).padStart(2,'0')}` } : null,
    engagement: p.engagement || null,
    killchain: p.killchain || [],
    loadout: p.loadout || [],
    remediation: p.remediation || [],
    classification: p.classification || 'CLASSIFIED-WHITE',
  };

  // Use ops.log writeup template for any post that declares a killchain
  // or engagement block; fall back to basic post.hbs for plain prose.
  const useWriteupTpl = (p.killchain && p.killchain.length) || p.engagement;
  const chosenTpl = useWriteupTpl && tpl.writeup ? tpl.writeup : tpl.post;
  const html = chosenTpl(baseData);
  fs.writeFileSync(outPath, html);
  console.log(`[ok] posts/${p.slug}.html`);
}

// Emit aggregate JSON (for legacy carousel if still used)
fs.writeFileSync(
  path.join(ROOT, 'assets', 'data', 'writeups.json'),
  JSON.stringify(writeupsForIndex.map((p) => ({
    slug: p.href.replace('../posts/', '').replace('.html', ''),
    title: p.title,
    summary: p.summary,
    date: writeups.find((w) => w.slug === p.href.replace('../posts/', '').replace('.html', ''))?.date,
    readTime: p.readTime,
    tags: p.tags,
    difficulty: p.difficulty,
    os: p.os,
  })), null, 2)
);
fs.writeFileSync(
  path.join(ROOT, 'assets', 'data', 'posts.json'),
  JSON.stringify(projectsForIndex.map((p) => ({
    slug: p.href.replace('../posts/', '').replace('.html', ''),
    title: p.title,
    summary: p.summary,
    date: projects.find((w) => w.slug === p.href.replace('../posts/', '').replace('.html', ''))?.date,
    readTime: p.readTime,
    tags: p.tags,
  })), null, 2)
);

console.log(`\n[done] ${posts.length} posts · ${writeups.length} writeups · ${projects.length} projects`);
