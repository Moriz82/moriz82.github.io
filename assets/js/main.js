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
      syncNavState();
    });

    navLinks.forEach((link) =>
      link.addEventListener('click', () => {
        navToggle.setAttribute('aria-expanded', 'false');
        siteNav.setAttribute('aria-expanded', 'false');
        navToggle.classList.remove('is-open');
        setTimeout(syncNavState, 200);
      })
    );
  }

  function syncNavState() {
    if (!sections.length) return;

    const offset = window.innerHeight * 0.35;
    const scrollPosition = window.scrollY + offset;
    let currentSection = sections[0];

    sections.forEach((section) => {
      if (section.offsetTop <= scrollPosition) {
        currentSection = section;
      }
    });

    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      const targetId = href.startsWith('#') ? href.slice(1) : href;
      const isActive = currentSection && currentSection.id === targetId;
      link.classList.toggle('is-active', Boolean(isActive));
    });
  }

  syncNavState();
  window.addEventListener('scroll', syncNavState, { passive: true });
  window.addEventListener('resize', syncNavState);

  const terminalCode = document.querySelector('.typewriter');
  if (terminalCode) {
    const prompt = terminalCode.getAttribute('data-prompt') || '$';
    let entries = [];

    try {
      entries = JSON.parse(terminalCode.getAttribute('data-terminal') || '[]');
    } catch (err) {
      console.error('Failed to parse terminal entries', err);
    }

    if (Array.isArray(entries) && entries.length) {
      const cursor = document.createElement('span');
      cursor.className = 'typewriter-cursor';
      const textNode = document.createTextNode('');
      terminalCode.textContent = '';
      terminalCode.append(textNode, cursor);

      const typingDelay = 200;
      const commandDelay = 1050;
      let entryIndex = 0;
      let charIndex = 0;
      let commandText = '';
      let currentEntry = null;

      textNode.nodeValue = `${prompt} `;

      const getOutputs = (entry) => {
        if (!entry) return [];
        if (Array.isArray(entry.output)) return entry.output;
        if (Array.isArray(entry.outputs)) return entry.outputs;
        if (typeof entry.output === 'string') return [entry.output];
        if (entry.output && typeof entry.output === 'object') return Object.values(entry.output);
        return [];
      };

      const typeCommand = () => {
        if (!currentEntry) return;
        if (charIndex < commandText.length) {
          textNode.nodeValue += commandText.charAt(charIndex);
          charIndex += 1;
          setTimeout(typeCommand, typingDelay);
        } else {
          showOutputs();
        }
      };

      const showOutputs = () => {
        const outputs = getOutputs(currentEntry);
        textNode.nodeValue += '\n';
        if (outputs.length) {
          textNode.nodeValue += outputs.join('\n');
          textNode.nodeValue += '\n';
        }

          entryIndex += 1;
          currentEntry = null;
          if (entryIndex < entries.length) {
              // print prompt immediately
              if (textNode.nodeValue && !textNode.nodeValue.endsWith('\n')) {
                  textNode.nodeValue += '\n';
              }
              textNode.nodeValue += `${prompt} `;

              // wait before typing command
              setTimeout(startNextEntry, commandDelay);
          } else {
              if (!textNode.nodeValue.endsWith('\n')) {
                  textNode.nodeValue += '\n';
              }
              textNode.nodeValue += `${prompt} `;
          }
      };

        const startNextEntry = () => {
            if (entryIndex >= entries.length) return;
            currentEntry = entries[entryIndex];
            const commandValue = currentEntry && currentEntry.command != null ? String(currentEntry.command) : '';

            commandText = commandValue; // only type the command
            charIndex = 0;
            typeCommand();
        };


        startNextEntry();
    }
  }

  const mailtoForm = document.querySelector('[data-mailto]');
  if (mailtoForm) {
    const targetEmail = mailtoForm.getAttribute('data-mailto');
    const statusEl = mailtoForm.querySelector('[data-mailto-status]');

    mailtoForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!targetEmail) return;

      const formData = new FormData(mailtoForm);
      const alias = (formData.get('contact-name') || 'Operator').trim();
      const replyTo = (formData.get('contact-email') || '').trim();
      const message = (formData.get('contact-message') || '').trim();

      const subject = encodeURIComponent(`Inbound from ${alias}`);
      const lines = [];
      if (message) lines.push(message);
      if (replyTo) {
        lines.push('', `Reply-to: ${replyTo}`);
      }
      const body = encodeURIComponent(lines.join('\n'));

      const mailtoUrl = `mailto:${targetEmail}?subject=${subject}&body=${body}`;
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = 'Launching email client…';
      }

      window.location.href = mailtoUrl;
    });
  }

  const githubGrid = document.querySelector('[data-github-grid]');
  const githubStatus = document.querySelector('[data-github-status]');

  async function loadGitHubRepos() {
    if (!githubGrid) {
      if (githubStatus) githubStatus.textContent = 'GitHub section disabled.';
      return;
    }

    const username = githubGrid.getAttribute('data-github-user') || 'moriz82';
    const pinnedEndpoint = `https://gh-pinned-repos.egoist.dev/?username=${username}`;

    const renderRepos = (repos, sourceLabel) => {
      const fragment = document.createDocumentFragment();
      repos.forEach((repo) => {
        const card = document.createElement('article');
        card.className = 'repo-card';

        const title = document.createElement('h3');
        const link = document.createElement('a');
        link.href = repo.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = repo.name;
        title.append(link);
        card.append(title);

        const description = document.createElement('p');
        description.className = 'repo-description';
        description.textContent = repo.description || 'No description provided.';
        card.append(description);

        const meta = document.createElement('div');
        meta.className = 'repo-meta';

        const stars = document.createElement('span');
        stars.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21Z"></path></svg>
          ${repo.stars}`.trim();
        meta.append(stars);

        if (repo.language) {
          const language = document.createElement('span');
          language.textContent = repo.language;
          meta.append(language);
        }

        if (repo.updated) {
          const updated = document.createElement('span');
          updated.textContent = repo.updated;
          meta.append(updated);
        }

        card.append(meta);
        fragment.append(card);
      });

      githubGrid.innerHTML = '';
      githubGrid.append(fragment);
      if (githubStatus) githubStatus.textContent = sourceLabel;
    };

    try {
      const pinnedResponse = await fetch(pinnedEndpoint, { headers: { Accept: 'application/json' } });
      if (pinnedResponse.ok) {
        const pinnedData = await pinnedResponse.json();
        if (Array.isArray(pinnedData) && pinnedData.length) {
          const repos = pinnedData.slice(0, 6).map((repo) => {
            const updatedRaw = repo.pushed_at || repo.updated_at || repo.last_updated;
            return {
              name: repo.repo,
              description: repo.description,
              url: repo.link,
              language: repo.language,
              stars: repo.stars || 0,
              updated: updatedRaw
                ? `Updated ${new Date(updatedRaw).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
                : null
            };
          });
          renderRepos(repos, 'Pinned repositories pulled from GitHub.');
          return;
        }
      }
    } catch (err) {
      console.warn('Pinned repo service unavailable, falling back to API.', err);
    }

    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'moriz82-portfolio'
        },
        signal: controller.signal
      });
      clearTimeout(fetchTimeout);
      if (!response.ok) {
        throw new Error(`GitHub API responded with ${response.status}`);
      }
      const repos = await response.json();
      const filtered = (Array.isArray(repos) ? repos : []).filter((repo) => !repo.fork && !repo.archived);

      if (!filtered.length) {
        if (githubStatus) githubStatus.textContent = 'No public repositories to display yet.';
        return;
      }

      const ranked = filtered
        .map((repo) => ({
          name: repo.name,
          description: repo.description,
          url: repo.html_url,
          language: repo.language,
          stars: repo.stargazers_count || 0,
          updated: repo.pushed_at
            ? `Updated ${new Date(repo.pushed_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
            : null,
          score: repo.stargazers_count * 2 + repo.forks_count + repo.watchers_count
        }))
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 6);

      renderRepos(ranked, 'Top repositories pulled directly from GitHub.');
    } catch (error) {
      clearTimeout(fetchTimeout);
      console.error('Failed to load GitHub repos', error);
      if (githubStatus) {
        githubStatus.textContent = 'Unable to reach GitHub right now. Try again later or head to github.com/moriz82.';
      }
    }
  }

  loadGitHubRepos();

  const pieEl = document.querySelector('[data-htb-pie]');
  const legendEl = document.querySelector('[data-htb-legend]');
  const timelineEl = document.querySelector('[data-htb-timeline]');

  const difficultyColors = {
    veryeasy: '#4ac1ff',
    easy: '#3ddc84',
    medium: '#f7b733',
    hard: '#ef5350',
    insane: '#8d4cff',
    guru: '#ff6bd6'
  };

  const fallbackHTBData = {
    difficulties: [
      { label: 'Easy', value: 18, color: difficultyColors.easy },
      { label: 'Medium', value: 9, color: difficultyColors.medium },
      { label: 'Hard', value: 4, color: difficultyColors.hard },
      { label: 'Insane', value: 1, color: difficultyColors.insane }
    ],
    boxes: [
      { name: 'Synced', difficulty: 'Medium', date: 'Mar 2025', summary: 'Pivoted through misconfig APIs to land RCE and escalate via custom DLL payload.' },
      { name: 'Hawk', difficulty: 'Hard', date: 'Feb 2025', summary: 'Abused AD CS mis-issuance and crafted custom Kerberos tickets to seize domain control.' },
      { name: 'MonitorsTwo', difficulty: 'Easy', date: 'Jan 2025', summary: 'Chained SSTI to local privesc with service binary hijack; documented detection notes.' }
    ],
  };

  const normaliseLabel = (value) => {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const normaliseDifficulty = (label, value, color) => ({
    label: normaliseLabel(label),
    value: Number(value) || 0,
    color: color || difficultyColors[label?.toLowerCase?.()] || '#8d4cff'
  });

  const normaliseBoxes = (boxes = []) =>
    boxes
      .map((box) => ({
        name: box.name || box.title || 'Unknown Box',
        difficulty: normaliseLabel(box.difficulty || box.level || ''),
        date: box.date || box.completed_at || box.solved_at || box.firstBloodDate || '',
        summary: box.summary || box.notes || box.description || 'No summary provided.'
      }))
      .filter((box) => box.name && box.summary);

  const normaliseDifficulties = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input
        .map((item) => normaliseDifficulty(item.label || item.name, item.value ?? item.count ?? item.total, item.color))
        .filter((item) => item.value > 0);
    }
    if (typeof input === 'object') {
      return Object.entries(input)
        .map(([key, value]) => normaliseDifficulty(key, value))
        .filter((item) => item.value > 0);
    }
    return [];
  };

  const normaliseHTBData = (raw) => {
    if (!raw) return null;
    const difficultiesSource = raw.difficulties || raw.machine_difficulties || raw.machines?.difficulties || raw.stats?.machines?.difficulties;
    const boxesSource = raw.boxes || raw.recentBoxes || raw.machines?.recent || raw.stats?.machines?.recent;

    const difficulties = normaliseDifficulties(difficultiesSource);
    const boxes = normaliseBoxes(boxesSource);

    if (!difficulties.length && !boxes.length) return null;
    return {
      difficulties: difficulties.length ? difficulties : fallbackHTBData.difficulties,
      boxes: boxes.length ? boxes : fallbackHTBData.boxes
    };
  };

  const fetchCustomHTBStats = async () => {
    const url = localStorage.getItem('htbStatsUrl');
    if (!url) return null;
    const headers = {};
    const token = localStorage.getItem('htbStatsToken');
    if (token) headers.Authorization = token;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`HTB stats request failed with ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('HTB stats fetch failed', error);
      return null;
    }
  };

  const renderHTBData = (dataset) => {
    if (!dataset) return;
    const { difficulties = [], boxes = [] } = dataset;

    if (pieEl && difficulties.length) {
      const total = difficulties.reduce((sum, item) => sum + item.value, 0);
      if (total > 0) {
        let cumulative = 0;
        const segments = difficulties.map((item) => {
          const start = (cumulative / total) * 100;
          cumulative += item.value;
          const end = (cumulative / total) * 100;
          return `${item.color} ${start}% ${end}%`;
        });
        pieEl.style.setProperty('--pie-gradient', `conic-gradient(${segments.join(', ')})`);
      }

      if (legendEl) {
        legendEl.innerHTML = '';
        difficulties.forEach((item) => {
          const li = document.createElement('li');
          const swatch = document.createElement('span');
          swatch.style.background = item.color;
          li.append(swatch, document.createTextNode(`${item.label} · ${item.value}`));
          legendEl.append(li);
        });
      }
    }

    if (timelineEl) {
      timelineEl.innerHTML = '';
      (boxes.length ? boxes.slice(0, 3) : fallbackHTBData.boxes).forEach((box) => {
        const item = document.createElement('div');
        item.className = 'htb-timeline-item';

        const heading = document.createElement('h4');
        heading.textContent = box.name;
        item.append(heading);

        if (box.date || box.difficulty) {
          const meta = document.createElement('div');
          meta.className = 'htb-meta';
          const metaParts = [];
          if (box.date) metaParts.push(box.date);
          if (box.difficulty) metaParts.push(box.difficulty);
          meta.textContent = metaParts.join(' · ');
          item.append(meta);
        }

        if (box.summary) {
          const summary = document.createElement('p');
          summary.textContent = box.summary;
          item.append(summary);
        }

        timelineEl.append(item);
      });
    }
  };

  (async () => {
    const remoteData = await fetchCustomHTBStats();
    const normalised = normaliseHTBData(remoteData) || fallbackHTBData;
    renderHTBData(normalised);
  })();

  const yearEl = document.getElementById('copyright-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
