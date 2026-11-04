#!/usr/bin/env node
/* check.js — build the site and assert the things that must stay true. `npm test`. */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const matter = require('gray-matter');
const { marked } = require('marked');
const { preprocess } = require('./shortcodes');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
let failed = 0, passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Text a reader sees in an HTML string, minus code blocks/spans where backticks are legitimate.
const proseOf = (html) => html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code[\s\S]*?<\/code>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');

// ── unit: shortcodes ─────────────────────────────────────────────
console.log('shortcodes');
check('markdown after a terminal block with blank lines is rendered', () => {
  const src = '::: stage n=1 label="RECON" title="T"\n\n::: terminal title="shell"\n$ a\n\n$ b\n:::\n\nUse `curl` and **bold**.\n\n:::\n';
  const pre = preprocess(src);
  const html = pre.restore(marked.parse(pre.md));
  assert(html.includes('<code>curl</code>'), 'inline code not rendered: ' + html.slice(-200));
  assert(html.includes('<strong>bold</strong>'), 'bold not rendered');
  assert(html.includes('class="wp-term"') && html.includes('Stage 1 &middot; Recon'), 'blocks missing');
  assert(!/<!--sc:\d+-->/.test(html), 'placeholder left behind');
});
check('{red:...} spans still color text inside terminals', () => {
  const pre = preprocess('::: terminal title="t"\nroot {red:pwned}\n:::\n');
  assert(pre.restore(marked.parse(pre.md)).includes('<span class="hl-red">pwned</span>'), 'span missing');
});
check('stage titles render inline markdown', () => {
  const pre = preprocess('::: stage n=2 label="LFI" title="The `filename` param."\nx\n:::\n');
  const html = pre.restore(marked.parse(pre.md));
  assert(html.includes('<h2 class="wp-stage-title">The <code>filename</code> param.</h2>'), 'title not rendered: ' + html);
});
check('terminals and fenced code are highlighted at build time', () => {
  const pre = preprocess('::: terminal title="t" lang="python"\nimport os  # {red:pwned}\n:::\n\n```bash\necho hi\n```\n');
  const html = pre.restore(marked.parse(pre.md));
  assert(/<code class="hljs language-python">[\s\S]*<span class="hljs-keyword">import<\/span>/.test(html), 'terminal not highlighted: ' + html);
  assert(html.includes('<span class="hl-red">pwned</span>'), 'inline color lost inside highlighted terminal');
  assert(/<code class="hljs language-bash">/.test(html), 'fenced block not highlighted: ' + html);
});
check('pages do not load highlight.js in the browser', () => {
  assert(!/highlight(\.min)?\.js/.test(fs.readFileSync(path.join(ROOT, 'templates/page.hbs'), 'utf8')), 'page.hbs still loads highlight.js');
});
check('mixed-case callout titles keep their case', () => {
  const pre = preprocess('::: note title="Why BloodHound matters"\nx\n:::\n');
  assert(pre.restore(marked.parse(pre.md)).includes('Why BloodHound matters'), 'title was re-cased');
});

// ── build ────────────────────────────────────────────────────────
console.log('build');
let buildOut = '';
check('build exits 0', () => { buildOut = execFileSync('node', [path.join(ROOT, 'scripts/build.js')], { encoding: 'utf8' }); });

const sources = fs.readdirSync(path.join(ROOT, 'posts')).filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .map((f) => ({ file: f, fm: matter(read(`posts/${f}`)).data }));
const published = sources.filter((s) => !s.fm.draft);
const drafts = sources.filter((s) => s.fm.draft);
const fsJson = JSON.parse(read('assets/data/fs.json'));

check('every published post has a server-rendered page', () => {
  for (const s of published) {
    const rel = `posts/${s.fm.slug}.html`;
    assert(exists(rel), `${rel} missing`);
    const html = read(rel);
    assert(html.includes('id="boot-win"') && html.includes('<article class="art">'), `${rel} lacks the article window`);
    assert(html.includes(`<title>${s.fm.title.replace(/&/g, '&amp;')} · Will DeDominico</title>`), `${rel} has the wrong <title>`);
  }
});
check('drafts are never emitted', () => {
  for (const d of drafts) {
    assert(!fsJson.posts.some((p) => p.slug === d.fm.slug), `draft ${d.fm.slug} is in fs.json`);
    assert(!exists(`assets/src/${d.fm.slug}.json`), `draft ${d.fm.slug} source emitted`);
    // a draft may have an old .html from before it was locked; it must not be linked anywhere
    for (const page of ['index.html', 'blog/index.html', 'writeups/index.html', 'competitions/index.html', 'projects/index.html']) {
      assert(!read(page).includes(`/posts/${d.fm.slug}.html`), `draft ${d.fm.slug} linked from ${page}`);
    }
  }
});
check('fs.json lists exactly the published posts, each with its source', () => {
  assert(fsJson.posts.length === published.length, `fs.json has ${fsJson.posts.length}, expected ${published.length}`);
  for (const p of fsJson.posts) assert(exists(p.src.slice(1)), `${p.src} missing`);
});
check('section indexes exist, empty ones say so', () => {
  for (const s of fsJson.sections) {
    const html = read(`${s.id}/index.html`);
    const n = fsJson.posts.filter((p) => p.sec === s.id).length;
    assert(n ? html.includes('class="idx"') : html.includes('Nothing published here yet.'), `${s.id}/index.html wrong for ${n} posts`);
  }
});
check('no raw markdown leaks into rendered prose', () => {
  for (const p of fsJson.posts) {
    const prose = proseOf(read(`posts/${p.slug}.html`).split('<div class="body">')[1] || '');
    const m = prose.match(/`[^`<]{1,60}`|\*\*[^*<]{1,60}\*\*/);
    assert(!m, `${p.slug}: raw markdown "${m && m[0]}"`);
  }
});
check('post assets use root-relative paths', () => {
  for (const p of fsJson.posts) assert(!/(src|href)="\.\.\//.test(read(`posts/${p.slug}.html`)), `${p.slug} has ../ paths`);
});
check('email and phone never appear in generated HTML or JSON', () => {
  const files = ['index.html', 'about.html', 'contact.html', 'assets/data/fs.json', ...fsJson.posts.map((p) => `posts/${p.slug}.html`)];
  for (const f of files) {
    const t = read(f);
    assert(!/willdedominico@|proton\.me/i.test(t), `${f} exposes the email`);
    assert(!/512[-. ]?803[-. ]?2115/.test(t), `${f} exposes the phone number`);
  }
});
check('every page loads the desktop and works without it', () => {
  for (const f of ['index.html', 'about.html', 'contact.html', 'writeups/index.html']) {
    const t = read(f);
    assert(t.includes('class="nojs"') && t.includes('/assets/js/os/main.js'), `${f} missing shell`);
  }
});

check('calendar OAuth pages keep their URLs and policy text', () => {
  for (const [f, needle] of [['calendar-sync.html', 'does not sell, advertise with, or share Google user data'], ['calendar-sync-privacy.html', 'Google user data is not sold, rented, used for advertising, or shared with third parties'], ['calendar-sync-terms.html', 'The utility is provided as is, without warranties']]) {
    assert(exists(f), `${f} missing`);
    const t = read(f);
    assert(t.includes(needle), `${f} lost its policy text`);
    const link = f === 'calendar-sync-privacy.html' ? '/calendar-sync.html' : '/calendar-sync-privacy.html';
    assert(t.includes(`href="${link}"`), `${f} does not link to ${link}`);
  }
});

console.log('publishing');
check('Jekyll on GitHub Pages excludes markdown sources and build inputs', () => {
  assert(exists('_config.yml'), '_config.yml missing: Pages would turn every posts/*.md (drafts included) into a page');
  const cfg = read('_config.yml');
  for (const pat of ['posts/*.md', '*.md', 'drafts', 'scripts', 'templates', 'data', 'node_modules']) {
    assert(cfg.includes(`"${pat}"`), `_config.yml does not exclude ${pat}`);
  }
});
check('re-drafting a published post removes its page', () => {
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  for (const d of ['posts', 'templates', 'data']) fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'assets/img/writeups/avatars'), { recursive: true });
  const src = path.join(tmp, 'posts/htb-heal-writeup.md');
  fs.writeFileSync(src, fs.readFileSync(src, 'utf8').replace(/^type: writeup$/m, 'type: writeup\ndraft: true'));
  execFileSync('node', [path.join(ROOT, 'scripts/build.js')], { env: { ...process.env, BUILD_ROOT: tmp }, stdio: 'ignore' });
  const left = fs.existsSync(path.join(tmp, 'posts/htb-heal-writeup.html'));
  fs.rmSync(tmp, { recursive: true, force: true });
  assert(!left, 'posts/htb-heal-writeup.html still exists after the post became a draft');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
