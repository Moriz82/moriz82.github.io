// term.js — Console: a small bash-like shell over the virtual filesystem.

import { OS, $, esc, isMobile, posts, fsPath } from '../lib.js';
import { WM } from '../wm.js';
import { calc } from './utils.js';

const ARCH_ASCII = ['                   -`', '                  .o+`', '                 `ooo/', '                `+oooo:', '               `+oooooo:', '               -+oooooo+:', '             `/:-:++oooo+:', '            `/++++/+++++++:', '           `/++++++++++++++:', '          `/+++ooooooooooooo/`', '         ./ooosssso++osssssso+`', '        .oossssso-````/ossssss+`', '       -osssssso.      :ssssssso.', '      :osssssss/        osssso+++.', '     /ossssssss/        +ssssooo/-', '   `/ossssso+/:-        -:/+osssso+-', '  `+sso+:-`                 `.-/+oso:', ' `++:.                           `-/+/', ' .`                                 `/'].join('\n');

export function neofetch() {
  const d = OS.data, h = d.htb;
  return `<div class="neo"><pre>${esc(ARCH_ASCII)}</pre><dl>
    <dt>${esc(d.site.user)}</dt><dd>@${esc(d.site.host)}</dd><dt>OS</dt><dd>BlackArch Linux x86_64</dd><dt>Kernel</dt><dd>6.17.7-arch1-1</dd><dt>DE</dt><dd>GNOME 49</dd><dt>Shell</dt><dd>bash 5.3</dd>
    <dt>Role</dt><dd>penetration tester · CPTC captain</dd><dt>Certs</dt><dd>${d.site.certs.map((c) => c.name).slice(0, 7).join(' · ')}</dd><dt>HTB</dt><dd>${h.owned} owned · top ${h.percent}%</dd><dt>Posts</dt><dd>${d.posts.length} published</dd>
  </dl></div><div class="swatch"><i style="background:#000"></i><i style="background:#1d1d20"></i><i style="background:#c80000"></i><i style="background:#57e389"></i><i style="background:#f6d32d"></i><i style="background:#ffa348"></i><i style="background:#f66151"></i><i style="background:#c061cb"></i></div>`;
}

export function termApp(w, o) {
  let cwd = o.cwd || '';
  const hist = []; let hi = 0;
  const sections = () => OS.data.sections.map((s) => s.id);
  w.body.innerHTML = '<div class="term"><div class="out" aria-live="polite"></div><div class="t-row"><label class="t-ps"></label><input class="t-in" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Command"></div></div>';
  const box = $('.term', w.body), out = $('.out', w.body), inp = $('.t-in', w.body), psEl = $('.t-ps', w.body);
  w.input = inp;
  const ps = () => `[${OS.data.site.user}@${OS.data.site.host} ${cwd ? cwd.split('/').pop() : '~'}]$`;
  const setPs = () => { psEl.textContent = ps(); WM.setTitle(w, `${OS.data.site.user}@${OS.data.site.host}:${cwd ? '~/' + cwd : '~'}`); };
  const print = (html, cls) => { const d = document.createElement('div'); d.className = 'ln ' + (cls || ''); d.innerHTML = html; out.appendChild(d); box.scrollTop = box.scrollHeight; };
  const norm = (a) => (a || '').replace(/^~\/?/, '').replace(/^\/home\/will\/?/, '').replace(/^\//, '').replace(/\/$/, '').replace(/\.md$/, '');
  const isDir = (d) => { const [s, sub] = d.split('/'); return sections().includes(s) && (!sub || posts().some((p) => p.sec === s && p.sub === sub)); };
  const join = (d) => (cwd && !sections().includes(d.split('/')[0]) ? `${cwd}/${d}` : d);
  const resolve = (a) => {
    const n = norm(a); if (!n) return null;
    const full = join(n);
    return posts().find((p) => fsPath(p) === full) || posts().find((p) => p.slug === n.split('/').pop()) || posts().find((p) => p.slug === n.split('/').pop() + '-writeup') || null;
  };
  const listing = (d) => {
    const [sec, sub] = d.split('/');
    const subs = sub ? [] : [...new Set(posts().filter((p) => p.sec === sec && p.sub).map((p) => p.sub))];
    const files = posts().filter((p) => p.sec === sec && (sub ? p.sub === sub : !p.sub));
    return [...subs.map((s) => `<span class="c-a">${s}/</span>`), ...files.map((p) => `<span class="c-d">${p.date}</span>  <a class="lnk" href="${p.url}" data-open="${p.url}">${p.slug}.md</a>${p.diff ? `  <span class="${p.diff === 'hard' || p.diff === 'insane' ? 'c-r' : p.diff === 'easy' ? 'c-ok' : 'c-w'}">${p.diff}</span>` : ''}`)].join('\n');
  };

  const C = {
    help() {
      print(`<span class="c-a">navigate</span>  ls [dir] · cd &lt;dir&gt; · pwd · open|cat|xdg-open &lt;post&gt; · nautilus [dir] · gedit &lt;post&gt;
<span class="c-a">search</span>    grep &lt;term&gt;
<span class="c-a">about</span>     whoami · neofetch · certs · htb · contact
<span class="c-a">apps</span>      htop · bc · cal · eog · gnome-clocks
<span class="c-a">games</span>     snake · mines · sudoku · merge · blocks · lightsoff · four · reversi
<span class="c-a">other</span>     tux [off] · clear · history · exit
<span class="c-d">Tab completes. Up and down walk history.</span>`);
    },
    ls(a) {
      const d = norm(a.find((x) => !x.startsWith('-')) || '') ? join(norm(a.find((x) => !x.startsWith('-')))) : cwd;
      if (!d) return print(sections().map((x) => `<span class="c-a">${x}/</span>`).join('  '));
      if (!isDir(d)) return print(`ls: cannot access '${esc(d)}': No such file or directory`, 'c-r');
      print(listing(d) || '<span class="c-d">(empty)</span>');
    },
    cd(a) {
      const d = norm(a[0]);
      if (!d) { cwd = ''; return setPs(); }
      if (d === '..') { cwd = cwd.split('/').slice(0, -1).join('/'); return setPs(); }
      const full = join(d);
      if (!isDir(full)) return print(`bash: cd: ${esc(a[0])}: No such file or directory`, 'c-r');
      cwd = full; setPs();
    },
    pwd() { print('/home/will' + (cwd ? '/' + cwd : '')); },
    open(a) {
      const p = resolve(a[0]);
      if (!p) {
        const d = join(norm(a[0]));
        if (d && isDir(d)) return OS.openFiles(d);
        return print(`${esc(a[0] || '')}: No such file or directory`, 'c-r');
      }
      OS.openPost(p.url);
    },
    gedit(a) { const p = resolve(a[0]); if (!p) return print('usage: gedit &lt;post&gt;', 'c-d'); WM.open('editor', { post: p }); },
    nautilus(a) { OS.openFiles(join(norm(a[0] || '')) || cwd || '~'); },
    grep(a) {
      const q = a.filter((x) => !x.startsWith('-')).join(' ').toLowerCase();
      if (!q) return print('usage: grep &lt;term&gt;', 'c-d');
      const hits = posts().filter((p) => `${p.title} ${p.slug} ${p.tags.join(' ')} ${p.summary}`.toLowerCase().includes(q));
      hits.forEach((p) => print(`<span class="c-a">${p.sec}/</span><a class="lnk" href="${p.url}" data-open="${p.url}">${p.slug}.md</a>  <span class="c-d">${esc(p.title)}</span>`));
      if (!hits.length) print(`no matches for '${esc(q)}'`, 'c-d');
    },
    whoami() { print(esc(OS.data.site.user)); WM.open('about'); },
    neofetch() { print(neofetch()); },
    certs() { print(OS.data.site.certs.map((c) => c.name).join(' · ')); WM.open('certs'); },
    htb() { const h = OS.data.htb; print(`${h.owned} owned · top ${h.percent}% · ` + h.bars.map((b) => `${b.label.toLowerCase()} ${b.value}`).join(' · ')); },
    contact() { WM.open('contacts'); },
    snake() { WM.open('snake'); },
    tux(a) { const off = a[0] === 'off'; if (OS.setPet) OS.setPet(!off); print(off ? 'penguin sent to bed.' : 'penguin is out on the desktop. `tux off` to put it away.', 'c-d'); },
    penguin(a) { C.tux(a); },
    mines() { WM.open('mines'); },
    sudoku() { WM.open('sudoku'); },
    merge() { WM.open('merge'); },
    2048() { WM.open('merge'); },
    blocks() { WM.open('blocks'); },
    lightsoff() { WM.open('lights'); },
    four() { WM.open('four'); },
    reversi() { WM.open('reversi'); },
    htop() { print('htop: opening System Monitor (no curses in a browser, sorry)', 'c-d'); WM.open('sysmon'); },
    top() { WM.open('sysmon'); },
    'gnome-system-monitor'() { WM.open('sysmon'); },
    'gnome-calculator'() { WM.open('calc'); },
    'gnome-clocks'() { WM.open('clocks'); },
    'gnome-calendar'() { WM.open('calendar'); },
    eog() { WM.open('viewer'); },
    loupe() { WM.open('viewer'); },
    cal() { WM.open('calendar'); },
    bc(a) {
      if (!a.length) return WM.open('calc');
      try { print(String(+calc(a.join(' ')).toPrecision(12))); } catch (e) { print('(standard_in) 1: syntax error', 'c-r'); }
    },
    clear() { out.innerHTML = ''; },
    history() { print(hist.map((h, i) => `${String(i + 1).padStart(4)}  ${esc(h)}`).join('\n')); },
    exit() { WM.close(w); },
    uname(a) { print(a.includes('-a') ? 'Linux archlinux 6.17.7-arch1-1 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux' : 'Linux'); },
    date() { print(esc(new Date().toString())); },
    echo(a) { print(esc(a.join(' '))); },
    sudo(a) { print(a[0] === 'pacman' ? 'error: you cannot perform this operation unless you are root.' : `[sudo] password for will:\nwill is not in the sudoers file.`, 'c-r'); },
    pacman(a) { print(a[0] === '-Syu' ? ':: Synchronizing package databases...\n core is up to date\n extra is up to date\n blackarch is up to date\n:: Starting full system upgrade...\n there is nothing to do' : 'error: no operation specified (use -h for help)'); },
    rm(a) { print(a.join(' ').includes('-rf') ? "rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe" : 'rm: missing operand', 'c-r'); },
    nmap(a) {
      if (a.join(' ').match(/localhost|127\.0\.0\.1/)) print('Starting Nmap 7.98 ( https://nmap.org )\nPORT    STATE SERVICE\n443/tcp open  https\nNmap done: 1 IP address (1 host up)');
      else print(`Failed to resolve "${esc(a.join(' '))}". Only localhost is in scope.`, 'c-d');
    },
  };
  C.cat = C.open; C['xdg-open'] = C.open; C.less = C.open; C.search = C.grep; C.files = C.nautilus; C.vim = C.gedit; C.nano = C.gedit; C.nvim = C.gedit;

  const run = (line) => {
    print(`<span class="ps">${esc(ps())}</span> ${esc(line)}`, 'cmd');
    const parts = line.trim().split(/\s+/); const c = parts.shift();
    if (!c) return;
    hist.push(line); hi = hist.length;
    if (Object.prototype.hasOwnProperty.call(C, c)) C[c](parts); else print(`bash: ${esc(c)}: command not found`, 'c-r');
  };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = inp.value; inp.value = ''; run(v); }
    else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; inp.value = hist[hi]; } e.preventDefault(); }
    else if (e.key === 'ArrowDown') { if (hi < hist.length) { hi++; inp.value = hist[hi] || ''; } e.preventDefault(); }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = inp.value.split(' '); const last = parts[parts.length - 1];
      const subs = [...new Set(posts().filter((p) => p.sub).map((p) => `${p.sec}/${p.sub}/`))];
      const pool = parts.length === 1 ? Object.keys(C) : [...sections().map((d) => d + '/'), ...subs, ...posts().map((p) => p.slug), ...posts().map(fsPath)];
      const m = [...new Set(pool.filter((x) => x.startsWith(last)))];
      if (m.length === 1) { parts[parts.length - 1] = m[0]; inp.value = parts.join(' ') + (m[0].endsWith('/') ? '' : ' '); }
      else if (m.length > 1) print(m.join('  '), 'c-d');
    }
  });
  box.addEventListener('click', (e) => { if (!e.target.closest('a') && !String(window.getSelection())) inp.focus({ preventScroll: true }); });
  setPs();
  if (o.boot !== false) print(neofetch());
}

export const termFocus = (w) => { if (!isMobile() && w.input) w.input.focus({ preventScroll: true }); };
