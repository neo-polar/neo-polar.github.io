/* ============================================================
   Polar — main.js  v1.1
   対応: Chrome / Firefox / Safari / Edge / iOS / Android
============================================================ */
'use strict';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─────────────────────────────────────────
   1. ヒーロー Canvas パーティクル
───────────────────────────────────────── */
(function initParticles() {
  if (prefersReduced) return;
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let W, H, particles;
  const COUNT    = window.innerWidth < 600 ? 40 : 80;
  const MAX_DIST = 150;
  const SPEED    = 0.5;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function createParticles() {
    particles = Array.from({ length: COUNT }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      r:  Math.random() * 2.5 + 1,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MAX_DIST * MAX_DIST) {
          const d = Math.sqrt(d2); // 透明度計算にのみ使用
          ctx.beginPath();
          ctx.strokeStyle = `rgba(8,145,178,${(1 - d / MAX_DIST) * 0.3})`;
          ctx.lineWidth = 1;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8,145,178,0.6)';
      ctx.fill();
    });
  }

  function update() {
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });
  }

  let last = 0;
  const FPS_INTERVAL = 1000 / 30;
  let raf;

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (ts - last < FPS_INTERVAL) return;
    last = ts; update(); draw();
  }

  resize(); createParticles(); raf = requestAnimationFrame(loop);

  let resizeTick = false;
  window.addEventListener('resize', () => {
    if (resizeTick) return;
    resizeTick = true;
    requestAnimationFrame(() => { resize(); createParticles(); resizeTick = false; });
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); }
    else { last = 0; raf = requestAnimationFrame(loop); }
  });
})();

/* ─────────────────────────────────────────
   2. タイプライター（言語切替対応）
───────────────────────────────────────── */
let typewriterTimer = null;

function runTypewriter(lang) {
  if (prefersReduced) return;
  const el = document.querySelector('.hero-sub');
  if (!el) return;
  if (typewriterTimer !== null) { clearTimeout(typewriterTimer); typewriterTimer = null; }
  const text = lang === 'en' ? (el.dataset.en || '') : (el.dataset.ja || '');
  if (!text) return;
  el.textContent = '';
  let i = 0;
  function type() {
    if (i <= text.length) { el.textContent = text.slice(0, i); i++; typewriterTimer = setTimeout(type, 60); }
    else { typewriterTimer = null; }
  }
  typewriterTimer = setTimeout(type, 600);
}

/* ─────────────────────────────────────────
   3. 日英切り替え
───────────────────────────────────────── */
let currentLang = 'ja';

function applyLang(lang) {
  const heroSub = document.querySelector('.hero-sub');
  const TEXT_TAGS = new Set(['P','SPAN','H1','H2','H3','H4','LABEL','BUTTON','A','LI','TIME']);
  document.querySelectorAll('[data-ja]').forEach(el => {
    if (el === heroSub) return;
    if (!TEXT_TAGS.has(el.tagName) || !el.dataset[lang]) return;
    if (el.children.length === 0) {
      el.textContent = el.dataset[lang];
    } else {
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          node.textContent = el.dataset[lang]; break;
        }
      }
    }
  });
  document.querySelectorAll('[data-placeholder-ja]').forEach(el => {
    el.placeholder = lang === 'ja' ? el.dataset.placeholderJa : el.dataset.placeholderEn;
  });
  const btn = document.getElementById('langBtn');
  btn.textContent = lang === 'ja' ? 'EN' : 'JA';
  btn.setAttribute('aria-label', lang === 'ja' ? 'Switch to English' : '日本語に切り替える');
  document.documentElement.lang = lang === 'ja' ? 'ja' : 'en';
  localStorage.setItem('polar-lang', lang);
  currentLang = lang;
  runTypewriter(lang);
}
const savedLang = localStorage.getItem('polar-lang') || 'ja';
if (savedLang !== 'ja') {
  applyLang(savedLang);   // 英語保存時: 言語適用 → タイプライターも起動
} else {
  runTypewriter('ja');    // 日本語デフォルト時: タイプライターだけ起動
}
document.getElementById('langBtn').addEventListener('click', () => {
  applyLang(currentLang === 'ja' ? 'en' : 'ja');
});

/* ─────────────────────────────────────────
   4. ハンバーガーメニュー
───────────────────────────────────────── */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-expanded', String(isOpen));
  hamburger.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
});
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open'); hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'メニューを開く');
  });
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    navLinks.classList.remove('open'); hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'メニューを開く');
  }
}, { passive: true });

/* ─────────────────────────────────────────
   5. スムーズスクロール（JS 実装）
───────────────────────────────────────── */
function smoothScrollTo(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const navHeight = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || '64', 10
  );
  const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
  window.scrollTo({ top, behavior: prefersReduced ? 'instant' : 'smooth' });
}
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const targetId = link.getAttribute('href').slice(1);
    if (!targetId || !document.getElementById(targetId)) return;
    e.preventDefault();
    smoothScrollTo(targetId);
  });
});

/* ─────────────────────────────────────────
   6. ナビ スクロール強調 + アクティブ + back-to-top
───────────────────────────────────────── */
const nav    = document.getElementById('nav');
const bttBtn = document.getElementById('backToTop'); // スクロール毎に取得しないよう上部で1回だけ
let scrollTick = false;

window.addEventListener('scroll', () => {
  if (!scrollTick) {
    requestAnimationFrame(() => {
      const y = window.scrollY;
      nav.style.boxShadow = y > 20 ? '0 2px 20px rgba(0,0,0,0.07)' : 'none';
      if (bttBtn) bttBtn.classList.toggle('visible', y > 400);
      scrollTick = false;
    });
    scrollTick = true;
  }
}, { passive: true });

if (bttBtn) {
  bttBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'instant' : 'smooth' });
  });
}

const sections   = document.querySelectorAll('section[id]');
const navAnchors = navLinks.querySelectorAll('a[href^="#"]');
if ('IntersectionObserver' in window) {
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navAnchors.forEach(a =>
        a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`)
      );
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
  sections.forEach(s => secObs.observe(s));
}

/* ─────────────────────────────────────────
   7. スクロール フェードイン
───────────────────────────────────────── */
if (!prefersReduced && 'IntersectionObserver' in window) {
  const fadeMap = [
    { sel: '.hero-inner > *',  cls: 'fade-up',    stagger: true  },
    { sel: '.about-card',      cls: 'fade-up',    stagger: true  },
    { sel: '.about-text p',    cls: 'fade-left',  stagger: false },
    { sel: '.news-item',       cls: 'fade-up',    stagger: true  },
    { sel: '.gallery-item',    cls: 'fade-scale', stagger: true  },
    { sel: '.member-card',     cls: 'fade-up',    stagger: true  },
    { sel: '.section-label',   cls: 'fade-left',  stagger: false },
    { sel: '.section-title',   cls: 'fade-up',    stagger: false },
    { sel: '.contact-desc',    cls: 'fade-up',    stagger: false },
    { sel: '.form-group',      cls: 'fade-up',    stagger: true  },
  ];
  const fadeObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); fadeObs.unobserve(entry.target); }
    });
  }, { rootMargin: '0px 0px -60px 0px', threshold: 0.08 });
  fadeMap.forEach(({ sel, cls, stagger }) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add('will-fade', cls);
      if (stagger) el.style.transitionDelay = `${i * 0.07}s`;
      fadeObs.observe(el);
    });
  });
} else {
  document.querySelectorAll([
    '.hero-inner > *','.about-card','.about-text p','.news-item',
    '.gallery-item','.member-card','.section-label','.section-title',
    '.contact-desc','.form-group',
  ].join(', ')).forEach(el => el.classList.add('is-visible'));
}

/* ─────────────────────────────────────────
   8. フォーム カスタムバリデーション + 二重送信防止
───────────────────────────────────────── */
const MESSAGES = {
  ja: { required: 'この項目は必須です。', email: '有効なメールアドレスを入力してください。', sending: '送信中…' },
  en: { required: 'This field is required.', email: 'Please enter a valid email address.', sending: 'Sending…' },
};
function getMsg(key) { return (MESSAGES[currentLang] || MESSAGES.ja)[key]; }

function setError(input, msg) {
  const el = document.getElementById(`${input.id}-error`);
  input.classList.add('is-invalid');
  input.setAttribute('aria-describedby', `${input.id}-error`);
  if (el) el.textContent = msg;
}
function clearError(input) {
  const el = document.getElementById(`${input.id}-error`);
  input.classList.remove('is-invalid');
  input.removeAttribute('aria-describedby');
  if (el) el.textContent = '';
}
function validateField(input) {
  if (!input.value.trim()) { setError(input, getMsg('required')); return false; }
  if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
    setError(input, getMsg('email')); return false;
  }
  clearError(input); return true;
}
function setupValidation(form) {
  const fields = form.querySelectorAll('input[required], textarea[required]');
  fields.forEach(field => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => { if (field.classList.contains('is-invalid')) validateField(field); });
  });
  form.addEventListener('submit', function (e) {
    let valid = true;
    fields.forEach(f => { if (!validateField(f)) valid = false; });
    if (!valid) { e.preventDefault(); const first = form.querySelector('.is-invalid'); if (first) first.focus(); return; }
    const btn = this.querySelector('[type="submit"]');
    if (!btn) return;
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = getMsg('sending');
    // SSGForm は POST 後にページ遷移するためタイムアウトはフォールバック用
    // 将来 Fetch に切り替える場合はレスポンス受信後に disabled を解除してください
    setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 8000);
  });
}

const contactForm    = document.querySelector('.contact-form');
const newsletterForm = document.querySelector('.newsletter-form');
if (contactForm) setupValidation(contactForm);
if (newsletterForm) {
  newsletterForm.addEventListener('submit', function (e) {
    const input = this.querySelector('input[type="email"]');
    const errorEl = document.getElementById('newsletter-email-error');
    if (!input.value.trim()) {
      e.preventDefault();
      if (errorEl) errorEl.textContent = getMsg('required');
      input.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
      e.preventDefault();
      if (errorEl) errorEl.textContent = getMsg('email');
      input.focus();
      return;
    }
    if (errorEl) errorEl.textContent = '';
    const btn = this.querySelector('[type="submit"]');
    if (!btn) return;
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = getMsg('sending');
    setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 8000);
  });
}

/* ─────────────────────────────────────────
   9. アバター画像フォールバック（読み込み失敗時に頭文字を表示）
───────────────────────────────────────── */
document.querySelectorAll('.member-avatar img').forEach(img => {
  img.addEventListener('error', function () {
    this.classList.add('is-broken');
    const avatar = this.parentElement;
    if (!avatar) return;
    const nameEl = avatar.closest('.member-card')?.querySelector('.member-name');
    if (!nameEl) return;
    const span = document.createElement('span');
    span.textContent = nameEl.textContent.trim().charAt(0);
    span.setAttribute('aria-hidden', 'true');
    avatar.appendChild(span);
  });
});

/* ─────────────────────────────────────────
   10. メールアドレス難読化（スパムボット対策）
   HTMLにアドレスを直書きせず JS で組み立てる
───────────────────────────────────────── */
(function buildEmail() {
  const link = document.getElementById('footerEmail');
  if (!link) return;
  // アドレスを分割して bot の単純なスクレイピングを回避
  const user   = 'Polar22651';
  const domain = 'gmail';
  const tld    = 'com';
  const address = `${user}@${domain}.${tld}`;
  link.href = `mailto:${address}`;
  link.textContent = 'Email';
})();
