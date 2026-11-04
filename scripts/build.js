#!/usr/bin/env node
/* build.js — read posts/*.md, render the desktop shell around every page, emit HTML + fs.json. */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const Handlebars = require('handlebars');
const { preprocess, labelCase } = require('./shortcodes');

const ROOT = path.resolve(process.env.BUILD_ROOT || path.join(__dirname, '..'));
const POSTS_DIR = path.join(ROOT, 'posts');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const PARTIALS_DIR = path.join(TEMPLATES_DIR, 'partials');
const SITE_URL = 'https://blog.divineintellect.cc';

// type (front-matter) → section folder
const TYPE_TO_SECTION = { blog: 'blog', writeup: 'writeups', competition: 'competitions', project: 'projects' };

// ─── Handlebars ─────────────────────────────────────────────────
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('json', (v) => new Handlebars.SafeString(JSON.stringify(v).replace(/</g, '\\u003c')));
for (const file of fs.readdirSync(PARTIALS_DIR)) {
  if (!file.endsWith('.hbs')) continue;
  Handlebars.registerPartial(path.basename(file, '.hbs'), fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf8'));
}
const tpl = {};
for (const file of fs.readdirSync(TEMPLATES_DIR)) {
  if (!file.endsWith('.hbs')) continue;
  tpl[path.basename(file, '.hbs')] = Handlebars.compile(fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8'));
}

// ─── Data ───────────────────────────────────────────────────────
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const htbRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'htb.json'), 'utf8'));

// ─── Helpers ────────────────────────────────────────────────────
function isoDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt) ? String(d) : dt.toISOString().slice(0, 10);
}
function longDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase() : '');
function write(rel, content) {
  const fp = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content);
  console.log(`[ok] ${rel}`);
}
// Post bodies are authored with ../assets/ paths (relative to /posts/). Pages and
// the Web app inject them at other URLs, so make them root-relative.
const absolutize = (html) => html.replace(/(src|href)="\.\.\//g, '$1="/');

// ─── Read posts ─────────────────────────────────────────────────
const posts = [];
for (const file of fs.readdirSync(POSTS_DIR).sort()) {
  if (!file.endsWith('.md') || file.startsWith('_')) continue;
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
  let parsed;
  try { parsed = matter(raw); } catch (e) {
    console.error(`[error] ${file} — front-matter is not valid YAML: ${e.reason || e.message} (line ${e.mark ? e.mark.line + 1 : '?'})`);
    process.exitCode = 1;
    continue;
  }
  const { data: fm, content } = parsed;
  if (!fm.slug || !fm.title || !fm.type) {
    console.warn(`[skip] ${file} — missing front-matter (slug/title/type)`);
    continue;
  }
  if (fm.draft) {
    console.warn(`[draft] ${file} — skipping (draft: true)`);
    continue;
  }
  const sec = TYPE_TO_SECTION[fm.type];
  if (!sec) {
    console.warn(`[skip] ${file} — unknown type "${fm.type}" (use blog | writeup | competition | project)`);
    continue;
  }
  posts.push({
    fm,
    file,
    raw,
    sec,
    sub: fm.sub || '',
    slug: fm.slug,
    title: fm.title,
    date: isoDate(fm.date),
    dateLong: longDate(fm.date),
    summary: String(fm.summary || '').replace(/`/g, ''),
    summaryHtml: marked.parseInline(String(fm.summary || '')),
    tags: (fm.tags || []).map((t) => String(t).toLowerCase()),
    url: `/posts/${fm.slug}.html`,
    body: (() => { const pre = preprocess(content); return absolutize(pre.restore(marked.parse(pre.md, { mangle: false, headerIds: true }))); })(),
  });
}
posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

const sectionById = Object.fromEntries(site.sections.map((s) => [s.id, s]));
const bySection = (id) => posts.filter((p) => p.sec === id);

// ─── HTB stats ──────────────────────────────────────────────────
const ORDER = ['Easy', 'Medium', 'Hard', 'Insane'];
const diffMap = Object.fromEntries((htbRaw.difficulties || []).map((d) => [d.label, d.value]));
const owned = ORDER.reduce((s, k) => s + (diffMap[k] || 0), 0);
const last = htbRaw.boxes && htbRaw.boxes[0] ? htbRaw.boxes[0] : null;
const htb = {
  owned,
  percent: site.htb.percent,
  profileUrl: site.htb.profileUrl,
  bars: ORDER.map((k) => ({ label: k, value: diffMap[k] || 0, pct: owned ? Math.max(3, Math.round(((diffMap[k] || 0) / owned) * 100)) : 0 })),
  last: last ? { name: last.name, difficulty: last.difficulty, os: last.summary, date: isoDate(last.date) } : null,
};

// ─── Shared page context ────────────────────────────────────────
const buildTime = new Date().toISOString();
const desktop = {
  sections: site.sections,
  links: site.links,
  user: site.user,
  host: site.host,
  htbOwned: owned,
};
function page(view, { title, description, canonical, win }) {
  return tpl.page({
    title: title ? `${title} · ${site.name}` : site.name,
    description: description || site.description,
    canonical: SITE_URL + canonical,
    view,
    desktop,
    win,
    year: new Date().getFullYear(),
  });
}

// ─── Posts ──────────────────────────────────────────────────────
function railFor(p) {
  const fm = p.fm;
  const isWriteup = p.sec === 'writeups';
  const eng = fm.engagement || {};
  const rows = [];
  if (eng.platform) rows.push({ k: 'platform', v: eng.platform });
  if (eng.target) rows.push({ k: 'target', v: eng.target });
  if (eng.ref) rows.push({ k: isWriteup ? 'address' : 'ref', v: eng.ref });
  if (isWriteup && fm.os) rows.push({ k: 'os', v: cap(fm.os) });
  if (isWriteup && fm.difficulty) rows.push({ k: 'difficulty', v: cap(fm.difficulty), cls: `d-${String(fm.difficulty).toLowerCase()}` });
  const kc = (fm.killchain || []).map((s, i, a) => ({
    n: i + 1,
    stage: labelCase(s.stage),
    sub: s.sub || '',
    anchor: String(s.stage || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    goal: i === a.length - 1,
  }));
  const loadout = (fm.loadout || []).map((l) => ({ tool: l.tool, purpose: l.purpose }));
  const remediation = (fm.remediation || []).map((r) => marked.parseInline(String(r)));
  const has = rows.length || kc.length || loadout.length || remediation.length;
  return has ? { rows, kc, kcTitle: isWriteup ? 'Kill chain' : 'Stages', loadout, remediation } : null;
}

for (const sec of site.sections) {
  const list = bySection(sec.id);
  const older = [...list].reverse(); // oldest first
  for (const p of list) {
    const i = older.indexOf(p);
    const prev = i > 0 ? older[i - 1] : null;
    const next = i < older.length - 1 ? older[i + 1] : null;
    const fm = p.fm;
    const meta = [];
    if (fm.difficulty) meta.push({ text: cap(fm.difficulty), cls: `d-${String(fm.difficulty).toLowerCase()}` });
    if (fm.os) meta.push({ text: cap(fm.os) });
    if (fm.points) meta.push({ text: `${fm.points} points` });
    if (fm.readTime) meta.push({ text: fm.readTime });
    if (p.tags.length) meta.push({ text: p.tags.join(', ') });
    const inner = tpl['win-post']({
      p,
      section: sec,
      meta,
      avatar: fm.avatar && fs.existsSync(path.join(ROOT, 'assets/img/writeups/avatars', fm.avatar)) ? `/assets/img/writeups/avatars/${fm.avatar}` : '',
      repo: fm.repo || '',
      rail: railFor(p),
      prev: prev && { title: prev.title, url: prev.url },
      next: next && { title: next.title, url: next.url },
    });
    write(`posts/${p.slug}.html`, page('post', {
      title: p.title,
      description: p.summary || p.title,
      canonical: p.url,
      win: { app: 'web', path: p.url, title: p.title, max: true, inner },
    }));
  }
}

// ─── Section indexes ────────────────────────────────────────────
for (const sec of site.sections) {
  const list = bySection(sec.id).map((p) => ({
    title: p.title, url: p.url, date: p.date, summary: p.summary, sub: p.sub,
    diff: p.fm.difficulty ? cap(p.fm.difficulty) : '', diffCls: p.fm.difficulty ? `d-${String(p.fm.difficulty).toLowerCase()}` : '',
  }));
  const groups = [{ title: '', posts: list.filter((p) => !p.sub) }];
  for (const sub of [...new Set(list.filter((p) => p.sub).map((p) => p.sub))]) {
    groups.push({ title: sub === 'homelab' ? 'homelab shenanigans' : sub, posts: list.filter((p) => p.sub === sub) });
  }
  const inner = tpl['win-section']({ section: sec, count: list.length, groups: groups.filter((g) => g.posts.length) });
  write(`${sec.id}/index.html`, page('section', {
    title: sec.title,
    description: `${sec.desc}. ${site.name}.`,
    canonical: `/${sec.id}/`,
    win: { app: 'web', path: `/${sec.id}/`, title: sec.title, max: false, inner },
  }));
}

// ─── Welcome / about / contact ──────────────────────────────────
write('index.html', page('welcome', {
  title: '',
  canonical: '/',
  win: {
    app: 'welcome', path: '/', title: 'Welcome', max: false,
    inner: tpl['win-welcome']({ site, recent: posts.slice(0, 3) }),
  },
}));
write('about.html', page('about', {
  title: 'whoami',
  description: `About ${site.name}: experience, competitions, certifications and education.`,
  canonical: '/about.html',
  win: { app: 'about', path: '/about.html', title: 'whoami', max: false, inner: tpl['win-about']({ site, htb }) },
}));
write('contact.html', page('contact', {
  title: 'Contact',
  description: `Contact ${site.name}: email, GitHub, LinkedIn, Hack The Box.`,
  canonical: '/contact.html',
  win: { app: 'contacts', path: '/contact.html', title: 'Contacts', max: false, inner: tpl['win-contact']({ site }) },
}));

// ─── fs.json + raw sources ──────────────────────────────────────
const fsJson = {
  built: buildTime,
  sections: site.sections,
  posts: posts.map((p) => ({
    title: p.title, slug: p.slug, sec: p.sec, sub: p.sub || undefined, date: p.date, summary: p.summary,
    tags: p.tags, url: p.url, src: `/assets/src/${p.slug}.json`, file: p.file,
    diff: p.fm.difficulty ? String(p.fm.difficulty).toLowerCase() : undefined,
    os: p.fm.os ? String(p.fm.os).toLowerCase() : undefined,
    readTime: p.fm.readTime || undefined,
  })),
  htb,
  site: {
    name: site.name, user: site.user, host: site.host, location: site.location, intro: site.intro, bio: site.bio,
    links: site.links, emailParts: site.emailParts, certs: site.certs,
  },
};
write('assets/data/fs.json', JSON.stringify(fsJson, null, 2));

const SRC_DIR = path.join(ROOT, 'assets', 'src');
fs.rmSync(SRC_DIR, { recursive: true, force: true });
for (const p of posts) write(`assets/src/${p.slug}.json`, JSON.stringify({ file: p.file, md: p.raw }));

const counts = site.sections.map((s) => `${bySection(s.id).length} ${s.id}`).join(' · ');
console.log(`\n[done] ${posts.length} posts · ${counts}`);
