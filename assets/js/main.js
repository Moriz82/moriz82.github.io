/* main.js — nav, contact form, reveal animations, TOC active section, theme toggle. */

// ─── Theme toggle — set early so there is no flash ─────────────
(function initTheme() {
  try {
    const saved = localStorage.getItem('theme');
    const systemLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = saved || (systemLight ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  // ─── Theme toggle button ─────────────────────────────────
  const themeBtn = document.querySelector('.theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }
  // ─── Mobile nav ────────────────────────────────────────────
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ─── Reveal on scroll ────────────────────────────────────
  if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealTargets = document.querySelectorAll(
      '.wp-hero > *, .wp-killchain, .wp-kc-card, .wp-stage, .wp-side-card, .wp-toc, ' +
      '.post-grid .card, .grid-top > *, .grid-bottom > *, .block, .stats-strip > *'
    );
    revealTargets.forEach((el) => el.classList.add('reveal'));

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
              setTimeout(() => entry.target.classList.add('is-in'), i * 40);
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
      );
      revealTargets.forEach((el) => io.observe(el));
    } else {
      revealTargets.forEach((el) => el.classList.add('is-in'));
    }
  }

  // ─── Writeup TOC — highlight current stage while scrolling ─
  const tocRows = document.querySelectorAll('.wp-toc-row');
  const stages = document.querySelectorAll('.wp-stage');
  if (tocRows.length && stages.length && 'IntersectionObserver' in window) {
    const setActive = (id) => {
      tocRows.forEach((r) => {
        const isActive = r.getAttribute('href') === `#${id}`;
        r.classList.toggle('is-active', isActive);
      });
    };
    const stageObs = new IntersectionObserver(
      (entries) => {
        const inView = entries.filter((e) => e.isIntersecting).sort(
          (a, b) => a.target.offsetTop - b.target.offsetTop
        );
        if (inView.length) setActive(inView[0].target.id);
      },
      { rootMargin: '-30% 0px -50% 0px' }
    );
    stages.forEach((s) => stageObs.observe(s));
  }
});
