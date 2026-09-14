/* Polar's decorative motion. No frame loop, timers, scrolling handlers or libraries.
   Each scene runs only while visible. All added content is non-interactive artwork. */
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
    const sky = scene('polar-sky', hero);
    decoration('polar-aurora aurora-one', sky);
    decoration('polar-aurora aurora-two', sky);
    decoration('sky-guide guide-outer', sky);
    decoration('sky-guide guide-inner', sky);
    const outer = decoration('star-orbit orbit-outer', sky);
    decoration('orbit-star', outer);
    decoration('orbit-star star-opposite', outer);
    const inner = decoration('star-orbit orbit-inner', sky);
    decoration('orbit-star', inner);
    decoration('north-star', sky);
    decoration('shooting-star meteor-one', sky);
    decoration('shooting-star meteor-two', sky);
    decoration('snow-drift snow-one', sky);
    decoration('snow-drift snow-two', sky);
    decoration('sky-starfield', sky);
    const chartA = decoration('constellation constellation-a', sky);
    decoration('constellation-line line-a1', chartA);
    decoration('constellation-line line-a2', chartA);
    decoration('constellation-line line-a3', chartA);
    decoration('constellation-nodes nodes-a', chartA);
    const chartB = decoration('constellation constellation-b', sky);
    decoration('constellation-line line-b1', chartB);
    decoration('constellation-line line-b2', chartB);
    decoration('constellation-nodes nodes-b', chartB);
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
  }

  document.querySelectorAll('.section-label').forEach(label => {
    const compass = scene('section-compass', label);
    decoration('compass-star', compass);
  });

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
