/* Polar's decorative motion. No frame loop, timers, scrolling handlers or libraries.
   Each scene runs only while visible. Added decorations are non-interactive artwork;
   content blocks only receive one-time reveal classes. */
(() => {
  'use strict';
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = [];

  function decoration(className, parent) {
    const element = document.createElement('span');
    element.className = className;
    element.setAttribute('aria-hidden', 'true');
    parent.appendChild(element);
    return element;
  }

  function scene(className, parent) {
    const element = decoration(`motion-scene ${className}`, parent);
    scenes.push(element);
    return element;
  }

  const hero = document.getElementById('hero');
  if (hero) {
    // A celestial instrument: aurora, a slowly turning star chart inside a fixed dial,
    // orbiting markers and the pole star with its halo and light streaks.
    const sky = scene('polar-sky', hero);
    decoration('polar-aurora aurora-one', sky);
    decoration('polar-aurora aurora-two', sky);
    decoration('sky-chart', sky);
    decoration('sky-dial', sky);
    const outer = decoration('star-orbit orbit-outer', sky);
    decoration('orbit-star', outer);
    decoration('orbit-star star-opposite', outer);
    const inner = decoration('star-orbit orbit-inner', sky);
    decoration('orbit-star', inner);
    decoration('star-halo', sky);
    decoration('star-flare', sky);
    decoration('north-star', sky);
    decoration('shooting-star meteor-one', sky);
    decoration('shooting-star meteor-two', sky);
    decoration('sky-twinkle twinkle-a', sky);
    decoration('sky-twinkle twinkle-b', sky);
    decoration('sky-twinkle twinkle-c', sky);
    hero.classList.add('has-polar-sky');
  }

  const gallery = document.querySelector('#gallery > .container');
  if (gallery) {
    const arctic = scene('arctic-scene', gallery);
    decoration('arctic-moon', arctic);
    decoration('arctic-star star-a', arctic);
    decoration('arctic-star star-b', arctic);
    decoration('arctic-mountains', arctic);
    decoration('arctic-water water-back', arctic);
    decoration('arctic-water water-front', arctic);
    decoration('bear-floe', arctic);
    decoration('snow-drift arctic-snow', arctic);
    decoration('snow-drift arctic-snow snow-two', arctic);
  }

  // A slow ribbon of the genres Polar brings together, between the cover and About.
  const about = document.getElementById('about');
  if (about) {
    const ticker = scene('genre-ticker', about);
    about.insertBefore(ticker, about.firstChild);
    about.classList.add('has-ticker');
    const genres = ['Music', 'Video', 'Illustration', 'Writing', 'Programming'];
    for (let copy = 0; copy < 2; copy++) {
      const track = decoration('ticker-track', ticker);
      genres.concat(genres).forEach((genre, index) => {
        decoration(index % 2 ? 'ticker-word is-outline' : 'ticker-word', track).textContent = genre;
        decoration('ticker-star', track);
      });
    }
  }

  // Stars and a meteor over the footer's night sky.
  const footer = document.getElementById('footer');
  if (footer) {
    const night = scene('footer-sky', footer);
    decoration('footer-stars', night);
    decoration('footer-stars stars-two', night);
    decoration('shooting-star footer-meteor', night);
  }

  // Letters of the cover title rise one by one; the heading keeps its accessible name.
  const title = document.querySelector('.hero-title');
  if (title && !title.children.length) {
    const text = title.textContent.trim();
    title.setAttribute('aria-label', text);
    title.textContent = '';
    Array.from(text).forEach(letter => {
      decoration('hero-char', title).textContent = letter;
    });
  }

  document.querySelectorAll('.section-label').forEach(label => {
    const compass = scene('section-compass', label);
    decoration('compass-star', compass);
  });

  // Content below the first screen rises in once as it is reached. Anything already
  // on screen, and every page without IntersectionObserver or with reduced motion,
  // stays visible as authored; the classes are removed again after the reveal.
  const revealSelector = [
    '.section-label', '.section-title', '.about-text', '.about-card', '.news-item', '.news-footer',
    '.gallery-desc', '.note-card', '.arctic-scene', '.member-card', '.contact-desc', '.contact-form',
    '.article-body > *', '.article-footer',
  ].join(', ');
  const pending = 'IntersectionObserver' in window && !preference.matches
    ? Array.from(document.querySelectorAll(revealSelector))
      .filter(element => element.getBoundingClientRect().top > window.innerHeight)
    : [];
  if (pending.length) {
    const reveal = new IntersectionObserver(entries => {
      let order = 0;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        // Items reached together are staggered; later arrivals start at once.
        element.style.setProperty('--reveal-delay', `${Math.min(order++, 6) * 90}ms`);
        element.classList.add('is-revealed');
        element.addEventListener('transitionend', () => {
          element.classList.remove('reveal', 'is-revealed');
          element.style.removeProperty('--reveal-delay');
        }, { once: true });
        reveal.unobserve(element);
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    pending.forEach(element => {
      element.classList.add('reveal');
      reveal.observe(element);
    });
  }

  // Stay static on browsers without visibility observation instead of wasting work
  // on an offscreen scene. CSS is also static if this script does not run.
  if (!scenes.length || !('IntersectionObserver' in window)) return;

  const visible = new Set();
  const refresh = () => {
    const running = !document.hidden && !preference.matches;
    scenes.forEach(element => {
      element.classList.toggle('is-motion-active', running && visible.has(element));
    });
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    });
    refresh();
  }, { threshold: 0, rootMargin: '0px' });
  scenes.forEach(element => observer.observe(element));
  document.addEventListener('visibilitychange', refresh);
  if (preference.addEventListener) preference.addEventListener('change', refresh);
  else if (preference.addListener) preference.addListener(refresh);
  // BFCache restoration must honor the current tab and motion preferences.
  window.addEventListener('pageshow', refresh);
})();
