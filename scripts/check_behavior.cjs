// Small DOM fixture: executes the actual scripts, without a browser or network.
// Run: node scripts/check_behavior.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function node() {
  const classes = new Set();
  return {
    events: {}, attrs: {}, dataset: {}, style: {setProperty(key, value) { this[key] = value; }}, children: [], tagName: 'P',
    textContent: '', value: '',
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force = !classes.has(name)) {
        if (force) classes.add(name); else classes.delete(name);
        return force;
      },
    },
    setAttribute(key, value) { this.attrs[key] = value; },
    removeAttribute(key) { delete this.attrs[key]; },
    getAttribute(key) { return this.attrs[key]; },
    appendChild(child) { this.children.push(child); return child; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return {left: 0, top: 0, width: 1000, height: 600}; },
    addEventListener(type, callback) { (this.events[type] ??= []).push(callback); },
    emit(type, event = {}) { for (const callback of this.events[type] ?? []) callback.call(this, event); },
    click() { this.emit('click'); },
    focus() { this.focused = true; },
  };
}

let scenarios = 0;
for (const file of ['main.js', 'news.js']) {
  for (const lang of ['ja', 'en']) {
    for (const reduced of [false, true]) {
      for (const storageMode of ['normal', 'blocked', 'invalid']) {
      const ids = Object.fromEntries(['langBtn', 'hamburger', 'navLinks', 'nav', 'hero'].map(id => [id, node()]));
      const copy = node();
      copy.dataset = {ja: '日本語の本文', en: 'English copy'};
      copy.textContent = copy.dataset.ja;
      const hero = node();
      hero.dataset = {ja: '熱意で知を研ぎ澄ます', en: 'Curiosity, shaped by passion.'};
      hero.textContent = hero.dataset.ja;
      const document = node();
      document.documentElement = {dataset: {titleJa: 'Polar', titleEn: 'Polar'}, lang: 'ja'};
      document.getElementById = id => ids[id] ?? null;
      const form = node();
      const submit = node();
      submit.textContent = '送信する';
      const fields = ['name', 'email', 'message'].map(id => {
        const field = node();
        field.id = id;
        field.type = id === 'email' ? 'email' : 'text';
        ids[`${id}-error`] = node();
        return field;
      });
      form.querySelectorAll = () => fields;
      form.querySelector = selector => selector === '[type="submit"]' ? submit : fields.find(field => field.classList.contains('is-invalid'));
      document.querySelector = selector => selector === '.hero-sub' ? hero : selector === '.contact-form' ? form : null;
      document.querySelectorAll = selector => selector === '[data-ja]' ? [copy, hero] : [];
      const window = node();
      const media = {};
      window.matchMedia = query => {
        if (!media[query]) {
          media[query] = node();
          media[query].matches = query.includes('reduced-motion') ? reduced : true;
          if (storageMode === 'invalid') {
            media[query].addListener = callback => { (media[query].events.change ??= []).push(callback); };
            media[query].addEventListener = undefined;
          }
        }
        return media[query];
      };
      window.innerWidth = 390;
      const storage = {'polar-lang': storageMode === 'invalid' ? 'invalid-value' : lang};
      const initialLang = storageMode === 'normal' ? lang : 'ja';
      const context = {
        document, window, Node: {TEXT_NODE: 3},
        localStorage: {
          getItem(key) { if (storageMode === 'blocked') throw new Error('Storage access denied'); return storage[key]; },
          setItem(key, value) { if (storageMode === 'blocked') throw new Error('Storage access denied'); storage[key] = value; },
        },
        setTimeout() { return 1; }, clearTimeout() {}, requestAnimationFrame(callback) { callback(); },
      };
      const source = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
      vm.runInNewContext(source, context, {filename: file});
      assert.equal(hero.textContent, hero.dataset[initialLang], `${file}: saved language`);
      ids.langBtn.click();
      const switched = initialLang === 'ja' ? 'en' : 'ja';
      assert.equal(copy.textContent, copy.dataset[switched]);
      assert.equal(hero.textContent, hero.dataset[switched]);
      assert.equal(document.documentElement.lang, switched);
      if (storageMode !== 'blocked') assert.equal(storage['polar-lang'], switched);
      ids.langBtn.click();
      assert.equal(hero.textContent, hero.dataset[initialLang]);
      ids.hamburger.click();
      assert.equal(ids.hamburger.attrs['aria-expanded'], 'true');
      assert.equal(ids.navLinks.classList.contains('open'), true);
      document.emit('keydown', {key: 'Escape'});
      assert.equal(ids.navLinks.classList.contains('open'), false);
      assert.equal(ids.hamburger.attrs['aria-expanded'], 'false');
      assert.equal(ids.hamburger.focused, true);
      ids.hamburger.click();
      window.innerWidth = 960;
      window.emit('resize');
      assert.equal(ids.navLinks.classList.contains('open'), false);
      assert.equal(ids.hamburger.attrs['aria-label'], 'メニューを開く', 'Resize resets the accessible label');
      if (file === 'main.js') {
        ids.hero.emit('pointermove', {clientX: 1000, clientY: 600});
        assert.equal(ids.hero.style['--star-x'], reduced ? undefined : '10.0px');
        assert.equal(ids.hero.style['--star-y'], reduced ? undefined : '8.0px');
        ids.hero.emit('pointerleave');
        assert.equal(ids.hero.style['--star-x'], '0px');
        const preference = media['(prefers-reduced-motion: reduce)'];
        preference.matches = true;
        preference.emit('change');
        ids.hero.emit('pointermove', {clientX: 1000, clientY: 600});
        assert.equal(ids.hero.style['--star-x'], '0px');
        let prevented = false;
        const event = {preventDefault() { prevented = true; }};
        form.emit('submit', event);
        assert.equal(prevented, true, 'Empty form must not submit');
        assert.equal(fields[0].focused, true);
        assert.equal(fields[0].attrs['aria-invalid'], 'true');
        fields[0].value = 'Test'; fields[1].value = 'invalid-email'; fields[2].value = 'Test message';
        prevented = false;
        form.emit('submit', event);
        assert.equal(prevented, true, 'Invalid email must not submit');
        fields[1].value = 'test@example.com';
        fields.forEach(field => field.emit('input'));
        assert.ok(fields.every(field => !field.attrs['aria-invalid']));
        prevented = false;
        form.emit('submit', event);
        assert.equal(prevented, false);
        assert.equal(submit.disabled, true);
        prevented = false;
        form.emit('submit', event);
        assert.equal(prevented, true, 'Duplicate submit must be prevented');
        window.emit('pageshow');
        assert.equal(submit.disabled, false, 'Back navigation restores the form');
        assert.equal(submit.textContent, '送信する');
      }
      scenarios++;
      }
    }
  }
}
// Verify the actual animation controller's lifecycle, not just CSS class names.
let motionScenarios = 0;
for (const observerAvailable of [false, true]) {
  for (const initiallyReduced of [false, true]) {
    const hero = node();
    const gallery = node();
    const labels = Array.from({length: 6}, node);
    const document = node();
    document.hidden = false;
    document.getElementById = id => id === 'hero' ? hero : null;
    document.querySelector = selector => selector === '#gallery > .container' ? gallery : null;
    document.querySelectorAll = selector => selector === '.section-label' ? labels : [];
    document.createElement = () => node();
    const window = node();
    const preference = node();
    preference.matches = initiallyReduced;
    window.matchMedia = () => preference;
    let observer;
    class VisibilityObserver {
      constructor(callback) { this.callback = callback; this.targets = []; observer = this; }
      observe(target) { this.targets.push(target); }
      report(target, isIntersecting) { this.callback([{target, isIntersecting}]); }
    }
    if (observerAvailable) window.IntersectionObserver = VisibilityObserver;
    const context = {document, window, IntersectionObserver: VisibilityObserver};
    // Deliberately provide no timers or requestAnimationFrame: perpetual JS work fails.
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'polar-motion.js'), 'utf8'), context);
    const scenes = [hero.children[0], gallery.children[0], ...labels.map(label => label.children[0])];
    assert.equal(scenes.length, 8);
    scenes.forEach(scene => assert.equal(scene.attrs['aria-hidden'], 'true'));
    assert.ok(hero.children[0].children.length <= 24, 'Fixed-size sky DOM budget');
    const active = scene => scene.classList.contains('is-motion-active');
    assert.ok(scenes.every(scene => !active(scene)), 'Starts paused, before observation');
    if (observerAvailable) {
      assert.equal(observer.targets.length, 8);
      observer.report(scenes[0], true);
      assert.equal(active(scenes[0]), !initiallyReduced);
      assert.equal(active(scenes[1]), false, 'Offscreen arctic scene stays paused');
      preference.matches = false;
      preference.emit('change');
      assert.equal(active(scenes[0]), true);
      document.hidden = true;
      document.emit('visibilitychange');
      assert.ok(scenes.every(scene => !active(scene)), 'Hidden tab stops every scene');
      document.hidden = false;
      document.emit('visibilitychange');
      assert.equal(active(scenes[0]), true);
      observer.report(scenes[0], false);
      observer.report(scenes[1], true);
      assert.equal(active(scenes[0]), false, 'Scrolling past sky stops it');
      assert.equal(active(scenes[1]), true);
      preference.matches = true;
      preference.emit('change');
      assert.ok(scenes.every(scene => !active(scene)), 'Live reduced-motion change stops all');
      window.emit('pageshow');
      assert.ok(scenes.every(scene => !active(scene)), 'BFCache restore respects reduced motion');
      preference.matches = false;
      window.emit('pageshow');
      assert.equal(active(scenes[0]), false);
      assert.equal(active(scenes[1]), true);
    }
    motionScenarios++;
  }
}
// Guard against accidentally adding layout/paint-heavy animated properties later.
const motionCSS = ['polar-motion.css', 'home.css'].map(file =>
  fs.readFileSync(path.join(__dirname, '..', 'css', file), 'utf8')
).join('\n');
const keyframes = /@keyframes\s+[\w-]+\s*\{/g;
let match;
let keyframeCount = 0;
while ((match = keyframes.exec(motionCSS))) {
  let cursor = keyframes.lastIndex;
  let depth = 1;
  const start = cursor;
  while (depth && cursor < motionCSS.length) {
    if (motionCSS[cursor] === '{') depth++;
    if (motionCSS[cursor] === '}') depth--;
    cursor++;
  }
  assert.equal(depth, 0, 'Keyframes must be balanced');
  for (const declaration of motionCSS.slice(start, cursor).matchAll(/([\w-]+)\s*:/g)) {
    assert.ok(['transform', 'opacity'].includes(declaration[1]), `Avoid animating ${declaration[1]}`);
  }
  keyframeCount++;
  keyframes.lastIndex = cursor;
}
assert.ok(keyframeCount > 0);
const motionFiles = ['css/polar-motion.css', 'css/home.css', 'js/polar-motion.js', 'images/polar-bear.svg', 'images/polar-ridge.svg'];
const motionBytes = motionFiles.reduce((total, file) => total + fs.statSync(path.join(__dirname, '..', file)).size, 0);
assert.ok(motionBytes < 32 * 1024, 'Keep the additional motion assets under 32 KiB, uncompressed');
console.log(`PASS: ${scenarios} behavior, ${motionScenarios} lifecycle scenarios, ${keyframeCount} transform/opacity animations; ${motionBytes} bytes.`);
module.exports = {scenarios, motionScenarios, keyframeCount, motionBytes};
