#!/usr/bin/env node
/* migrate-posts.js — one-shot HTML→MD conversion for existing posts. */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POSTS = path.join(ROOT, 'posts');
const WRITEUPS_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/writeups.json'), 'utf8'));
const POSTS_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/posts.json'), 'utf8'));

function dedent(str) {
  const lines = str.split('\n');
  const indents = lines
    .filter((l) => l.trim() !== '')
    .map((l) => (l.match(/^(\s*)/) || [''])[0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join('\n');
}

function extractArticle(html) {
  const m = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
  if (!m) return null;
  let body = m[1];

  // Drop <header>, <figure class="post-hero">, wrapping <div class="post-body">
  body = body.replace(/<header[^>]*>[\s\S]*?<\/header>/, '');
  body = body.replace(/<figure[^>]*class="post-hero"[^>]*>[\s\S]*?<\/figure>/g, '');
  // Strip the outer post-body wrapper and keep inside
  const inner = body.match(/<div[^>]*class="post-body"[^>]*>([\s\S]*)<\/div>\s*$/);
  if (inner) body = inner[1];
  // Strip content-card divs — convert to plain headings + content
  body = body.replace(/<div[^>]*class="content-card"[^>]*>/g, '');
  body = body.replace(/<\/div>\s*(?=<div|<p|<h|<ul|<ol|<pre|<figure|<hr|<blockquote|$)/g, '');
  // Fix image srcs — stay relative-to-post
  body = dedent(body).trim();
  return body;
}

function inferDifficulty(slug, tags) {
  // From existing titles: Hard, Easy, Medium
  const map = {
    'htb-certificate-writeup': 'hard',
    'htb-escapetwo-writeup': 'easy',
    'htb-heal-writeup': 'medium',
    'htb-planning-writeup': 'easy',
  };
  return map[slug] || null;
}
function inferOs(slug) {
  const map = {
    'htb-certificate-writeup': 'windows',
    'htb-escapetwo-writeup': 'windows',
    'htb-heal-writeup': 'linux',
    'htb-planning-writeup': 'linux',
  };
  return map[slug] || null;
}

function writeMd(meta, type) {
  const htmlPath = path.join(POSTS, `${meta.slug}.html`);
  if (!fs.existsSync(htmlPath)) {
    console.warn(`[skip] ${meta.slug} — no html file`);
    return;
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const article = extractArticle(html);
  if (!article) {
    console.warn(`[skip] ${meta.slug} — no <article> found`);
    return;
  }

  const fm = {
    title: meta.title,
    slug: meta.slug,
    type,
    date: meta.date,
    readTime: meta.readTime,
    tags: meta.tags,
    summary: meta.summary,
  };
  if (type === 'writeup') {
    fm.difficulty = inferDifficulty(meta.slug, meta.tags);
    fm.os = inferOs(meta.slug);
  }

  const yaml = Object.entries(fm)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.map((s) => JSON.stringify(s)).join(', ')}]`;
      return `${k}: ${typeof v === 'string' && /[:#]/.test(v) ? JSON.stringify(v) : v}`;
    })
    .join('\n');

  const md = `---\n${yaml}\n---\n\n${article}\n`;
  const outPath = path.join(POSTS, `${meta.slug}.md`);
  fs.writeFileSync(outPath, md);
  console.log(`[ok] wrote ${meta.slug}.md`);
}

for (const meta of WRITEUPS_JSON) writeMd(meta, 'writeup');
for (const meta of POSTS_JSON) writeMd(meta, 'project');

console.log('\n[done] migration complete. old .html files can be deleted.');
