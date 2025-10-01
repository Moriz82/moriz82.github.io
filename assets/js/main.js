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
        const pinnedEndpoint = `https://pinned.berrysauce.dev/get/${username}`;

        const renderRepos = (repos, sourceLabel) => {
            const fragment = document.createDocumentFragment();
            repos.forEach((repo) => {
                const card = document.createElement('article');
                card.className = 'repo-card';

                const title = document.createElement('h3');
                const link = document.createElement('a');
                link.href = `https://github.com/${repo.author}/${repo.name}`;
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
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 
          9.19 8.62 2 9.24l5.46 4.73L5.82 21Z"></path>
        </svg>
        ${repo.stars || 0}`.trim();
                meta.append(stars);

                if (repo.language) {
                    const language = document.createElement('span');
                    language.textContent = repo.language;
                    meta.append(language);
                }

                card.append(meta);
                fragment.append(card);
            });

            githubGrid.innerHTML = '';
            githubGrid.append(fragment);
            if (githubStatus) githubStatus.textContent = sourceLabel;
        };

        try {
            const response = await fetch(pinnedEndpoint, { headers: { Accept: 'application/json' } });
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length) {
                    renderRepos(data, 'Pinned repositories pulled from berrysauce.dev');
                    return;
                }
            }
            if (githubStatus) githubStatus.textContent = 'No pinned repositories found.';
        } catch (err) {
            console.warn('Pinned repo service unavailable.', err);
            if (githubStatus) githubStatus.textContent = 'Unable to fetch pinned repos right now.';
        }
    }

    loadGitHubRepos();



    const blogCarouselEl = document.querySelector('[data-blog-carousel]');
  if (blogCarouselEl) {
    const track = blogCarouselEl.querySelector('[data-carousel-track]');
    const prevBtn = blogCarouselEl.querySelector('[data-carousel-prev]');
    const nextBtn = blogCarouselEl.querySelector('[data-carousel-next]');
    const dotsEl = blogCarouselEl.querySelector('[data-carousel-dots]');
    const statusEl = blogCarouselEl.closest('section')?.querySelector('[data-carousel-status]') || null;
    const sourcePath = blogCarouselEl.getAttribute('data-post-source');

    let posts = [];
    let perView = 1;
    let currentPage = 0;
    let maxPage = 0;

    const setStatus = (message) => {
      if (!statusEl) return;
      statusEl.hidden = !message;
      statusEl.textContent = message || '';
    };

    const getPerView = () => {
      const width = window.innerWidth;
      if (width >= 1200) return 3;
      if (width >= 768) return 2;
      return 1;
    };

    const formatDate = (input) => {
      if (!input) return '';
      const date = new Date(input);
      if (Number.isNaN(date.getTime())) return input;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const createTagList = (tags = []) => {
      const list = document.createElement('ul');
      list.className = 'tag-list blog-card-tags';
      tags.slice(0, 4).forEach((tag) => {
        const item = document.createElement('li');
        item.textContent = tag;
        list.append(item);
      });
      return list;
    };

    const createCard = (post) => {
      const { slug, title, summary, hero, heroAlt, date, readTime, tags = [] } = post;
      const link = slug ? `posts/${slug}.html` : '#';

      const card = document.createElement('article');
      card.className = 'blog-card';

      const anchor = document.createElement('a');
      anchor.className = 'blog-card-link';
      anchor.href = link;

      const media = document.createElement('div');
      media.className = 'blog-card-media';
      if (hero) {
        const img = document.createElement('img');
        img.src = hero;
        img.alt = heroAlt || title || 'Blog hero image';
        img.loading = 'lazy';
        media.append(img);
      }

      const body = document.createElement('div');
      body.className = 'blog-card-body';

      const meta = document.createElement('div');
      meta.className = 'blog-card-meta';
      if (date) {
        const dateEl = document.createElement('time');
        dateEl.dateTime = new Date(date).toISOString().split('T')[0];
        dateEl.textContent = formatDate(date);
        meta.append(dateEl);
      }
      if (readTime) {
        const readEl = document.createElement('span');
        readEl.textContent = `${readTime} read`;
        meta.append(readEl);
      }

      const heading = document.createElement('h3');
      heading.textContent = title || 'Untitled Post';

      const description = document.createElement('p');
      description.textContent = summary || '';

      body.append(meta, heading, description);
      if (tags.length) {
        body.append(createTagList(tags));
      }

      anchor.append(media, body);
      card.append(anchor);
      return card;
    };

    const calculateMaxPage = () => {
      if (!posts.length) return 0;
      return Math.max(Math.ceil(posts.length / perView) - 1, 0);
    };

    const updateDots = () => {
      if (!dotsEl) return;
      dotsEl.innerHTML = '';
      for (let page = 0; page <= maxPage; page += 1) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = `carousel-dot${page === currentPage ? ' is-active' : ''}`;
        const startIndex = page * perView + 1;
        const endIndex = Math.min(startIndex + perView - 1, posts.length);
        dot.setAttribute('aria-label', `Show posts ${startIndex} through ${endIndex}`);
        dot.addEventListener('click', () => {
          currentPage = page;
          updateCarousel();
        });
        dotsEl.append(dot);
      }
    };

    const updateNavButtons = () => {
      if (prevBtn) prevBtn.disabled = currentPage <= 0;
      if (nextBtn) nextBtn.disabled = currentPage >= maxPage;
    };

    const updateStatus = () => {
      if (!posts.length) {
        setStatus('No posts available yet.');
        return;
      }
      const start = currentPage * perView + 1;
      const end = Math.min(start + perView - 1, posts.length);
      const currentTitles = posts.slice(start - 1, end).map((post) => post.title).filter(Boolean);
      const titleSummary = currentTitles.length ? `Featuring ${currentTitles.join(' · ')}.` : '';
      setStatus(`Showing posts ${start}–${end} of ${posts.length}. ${titleSummary}`.trim());
    };

    const updateTrackPosition = () => {
      if (!track || !track.children.length) return;
      const card = track.querySelector('.blog-card');
      if (!card) return;
      const style = window.getComputedStyle(track);
      const gap = parseFloat(style.columnGap || style.gap || '0');
      const cardRect = card.getBoundingClientRect();
      const pageWidth = perView * cardRect.width + Math.max(perView - 1, 0) * gap;
      const offset = currentPage * pageWidth;
      track.style.transform = `translateX(-${offset}px)`;
    };

    const updateCarousel = () => {
      maxPage = calculateMaxPage();
      if (currentPage > maxPage) currentPage = maxPage;
      blogCarouselEl.style.setProperty('--cards-per-view', String(perView));
      updateTrackPosition();
      updateNavButtons();
      updateDots();
      updateStatus();
    };

    const handleResize = () => {
      const nextPerView = getPerView();
      if (nextPerView !== perView) {
        perView = nextPerView;
        updateCarousel();
      } else {
        updateTrackPosition();
      }
    };

    const renderPosts = (replaceExisting = true) => {
      if (!track) return;
      if (replaceExisting) {
        track.innerHTML = '';
        posts.forEach((post) => {
          const card = createCard(post);
          track.append(card);
        });
      }
      perView = getPerView();
      currentPage = 0;
      updateCarousel();
    };

    const hydratePostsFromDOM = () => {
      if (!track) return [];
      const cards = Array.from(track.querySelectorAll('.blog-card'));
      if (!cards.length) return [];
      return cards.map((card) => {
        const link = card.querySelector('.blog-card-link');
        const titleEl = card.querySelector('h3');
        const summaryEl = card.querySelector('p');
        const imgEl = card.querySelector('img');
        const timeEl = card.querySelector('time');
        const readEl = card.querySelector('.blog-card-meta span');
        return {
          slug: card.getAttribute('data-slug') || '',
          title: card.getAttribute('data-title') || (titleEl ? titleEl.textContent.trim() : ''),
          summary: card.getAttribute('data-summary') || (summaryEl ? summaryEl.textContent.trim() : ''),
          hero: imgEl ? imgEl.getAttribute('src') : '',
          heroAlt: imgEl ? imgEl.getAttribute('alt') : '',
          date: card.getAttribute('data-date') || (timeEl ? timeEl.getAttribute('datetime') || timeEl.textContent.trim() : ''),
          readTime: card.getAttribute('data-read') || (readEl ? readEl.textContent.trim() : ''),
          tags: Array.from(card.querySelectorAll('.tag-list li')).map((tag) => tag.textContent.trim()),
          href: link ? link.getAttribute('href') : '#'
        };
      });
    };

    const parsePosts = (data) => {
      if (!Array.isArray(data)) return [];
      return data
        .filter((item) => item && item.slug && item.title)
        .map((item) => ({
          slug: String(item.slug).trim(),
          title: String(item.title || 'Untitled Post').trim(),
          summary: String(item.summary || item.excerpt || '').trim(),
          hero: item.hero || item.image || '',
          heroAlt: item.heroAlt || item.hero_alt || item.imageAlt || '',
          date: item.date || item.published || '',
          readTime: item.readTime || item.read_time || item.read || '',
          tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : []
        }))
        .sort((a, b) => {
          const aDate = a.date ? new Date(a.date).getTime() : 0;
          const bDate = b.date ? new Date(b.date).getTime() : 0;
          return bDate - aDate;
        });
    };

    const fetchPosts = async () => {
      if (!sourcePath) {
        setStatus('Blog data source missing.');
        return;
      }

      try {
        const response = await fetch(sourcePath, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const parsed = parsePosts(data);
        if (!parsed.length) {
          if (!posts.length) {
            posts = hydratePostsFromDOM();
            if (posts.length) {
              renderPosts(false);
              window.addEventListener('resize', handleResize);
              setStatus('No posts have been published yet in the feed. Showing local entries.');
            } else if (statusEl) {
              setStatus('No posts have been published yet.');
            }
          } else {
            setStatus('No new posts in the feed yet.');
          }
          return;
        }
        posts = parsed;
        renderPosts(true);
        window.addEventListener('resize', handleResize);
      } catch (error) {
        console.error('Failed to load blog posts', error);
        if (!posts.length) {
          posts = hydratePostsFromDOM();
          if (posts.length) {
            renderPosts(false);
            window.addEventListener('resize', handleResize);
          }
        }
        setStatus('Unable to load posts right now. Showing cached entries.');
      }
    };

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage <= 0) return;
        currentPage -= 1;
        updateCarousel();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage >= maxPage) return;
        currentPage += 1;
        updateCarousel();
      });
    }

    posts = hydratePostsFromDOM();
    if (posts.length) {
      perView = getPerView();
      updateCarousel();
      window.addEventListener('resize', handleResize);
    }

    fetchPosts();
  }

    // --- HackTheBox static JSON loader ---
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

    const normaliseLabel = (value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

    const normaliseDifficulty = (label, value, color) => ({
        label: normaliseLabel(label),
        value: Number(value) || 0,
        color: color || difficultyColors[label?.toLowerCase?.()] || '#8d4cff'
    });

    const normaliseBoxes = (boxes = []) =>
        boxes.map((box) => ({
            name: box.name || box.title || 'Unknown Box',
            difficulty: normaliseLabel(box.difficulty || box.level || ''),
            date: box.date || '',
            summary: box.summary || 'No summary provided.'
        })).filter((box) => box.name && box.summary);

    const normaliseDifficulties = (input) =>
        Array.isArray(input)
            ? input.map((item) =>
                normaliseDifficulty(item.label || item.name, item.value ?? item.count ?? item.total, item.color)
            ).filter((item) => item.value > 0)
            : [];

    const normaliseHTBData = (raw) => {
        if (!raw) return null;
        const difficulties = normaliseDifficulties(raw.difficulties);
        const boxes = normaliseBoxes(raw.boxes);
        if (!difficulties.length && !boxes.length) return null;
        return {
            difficulties: difficulties.length ? difficulties : fallbackHTBData.difficulties,
            boxes: boxes.length ? boxes : fallbackHTBData.boxes
        };
    };

    const renderHTBData = (dataset) => {
        if (!dataset) return;
        const { difficulties = [], boxes = [] } = dataset;

        // Pie chart
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

        // Timeline
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
                    const parts = [];
                    if (box.date) parts.push(box.date);
                    if (box.difficulty) parts.push(box.difficulty);
                    meta.textContent = parts.join(' · ');
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

// Load JSON written by GitHub Action
    (async () => {
        try {
            const resp = await fetch('/data/htb.json', { cache: 'no-store' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const raw = await resp.json();
            renderHTBData(normaliseHTBData(raw) || fallbackHTBData);
        } catch (err) {
            console.warn('Failed to load HTB JSON, using fallback', err);
            renderHTBData(fallbackHTBData);
        }
    })();


    const yearEl = document.getElementById('copyright-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
