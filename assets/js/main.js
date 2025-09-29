document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.getElementById('site-nav');
  const navLinks = siteNav ? Array.from(siteNav.querySelectorAll('a[href^="#"]')) : [];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      const newState = !expanded;
      navToggle.setAttribute('aria-expanded', String(newState));
      siteNav.setAttribute('aria-expanded', String(newState));
      navToggle.classList.toggle('is-open', newState);
    });

    navLinks.forEach((link) =>
      link.addEventListener('click', () => {
        navToggle.setAttribute('aria-expanded', 'false');
        siteNav.setAttribute('aria-expanded', 'false');
        navToggle.classList.remove('is-open');
      })
    );
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const index = sections.indexOf(entry.target);
        if (index === -1) return;

        const navLink = navLinks[index];
        if (entry.isIntersecting) {
          navLinks.forEach((link) => link.classList.remove('is-active'));
          navLink.classList.add('is-active');
        }
      });
    },
    {
      threshold: 0.5,
    }
  );

  sections.forEach((section) => {
    if (section) observer.observe(section);
  });

  const terminalCode = document.querySelector('.typewriter');
  if (terminalCode) {
    try {
      const lines = JSON.parse(terminalCode.getAttribute('data-lines') || '[]');
      if (Array.isArray(lines) && lines.length) {
        const typingDelay = 120;
        const lineDelay = 700;
        let lineIndex = 0;
        let charIndex = 0;
        let buffer = '';

        const type = () => {
          if (lineIndex >= lines.length) {
            lineIndex = 0;
            charIndex = 0;
            buffer = '';
            terminalCode.textContent = '';
            setTimeout(type, lineDelay);
            return;
          }

          const line = lines[lineIndex];

          if (charIndex < line.length) {
            buffer += line.charAt(charIndex);
            charIndex += 1;
            terminalCode.textContent = buffer;
            setTimeout(type, typingDelay);
          } else {
            buffer += '\n';
            terminalCode.textContent = buffer;
            charIndex = 0;
            lineIndex += 1;
            setTimeout(type, lineDelay);
          }
        };

        type();
      }
    } catch (err) {
      console.error('Failed to parse terminal lines', err);
    }
  }

  const yearEl = document.getElementById('copyright-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
