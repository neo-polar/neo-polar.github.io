/* ============================================================
   Polar — main.js  v1.1
   対応: Chrome / Firefox / Safari / Edge / iOS / Android
============================================================ */
'use strict';

// Language persistence is optional; blocked or invalid storage must not stop UI setup.
function readSavedLang() {
  try {
    const saved = localStorage.getItem('polar-lang');
    return saved === 'en' ? 'en' : 'ja';
  } catch { return 'ja'; }
}

// Decorative parallax only on fine pointers; no animation loop or text movement.
// React to preference changes as well as the preference at page load.
(function setupStarMotion() {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reset = () => {
    hero.style.setProperty('--star-x', '0px');
    hero.style.setProperty('--star-y', '0px');
  };
  hero.addEventListener('pointermove', event => {
    if (motion.matches || !pointer.matches) return;
    const bounds = hero.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    hero.style.setProperty('--star-x', `${(x * 20).toFixed(1)}px`);
    hero.style.setProperty('--star-y', `${(y * 16).toFixed(1)}px`);
  }, { passive: true });
  hero.addEventListener('pointerleave', reset);
  [motion, pointer].forEach(media => {
    if (media.addEventListener) media.addEventListener('change', reset);
    else if (media.addListener) media.addListener(reset);
  });
})();

// Show the complete tagline immediately, including after a language switch.
function updateHeroText(lang) {
  const el = document.querySelector('.hero-sub');
  if (el && el.dataset[lang]) el.textContent = el.dataset[lang];
}

let currentLang = 'ja';

function applyLang(lang) {
  lang = lang === 'en' ? 'en' : 'ja';
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
  try { localStorage.setItem('polar-lang', lang); } catch { /* Continue without persistence. */ }
  currentLang = lang;
  // タイトル切り替え
  const titleJa = document.documentElement.dataset.titleJa;
  const titleEn = document.documentElement.dataset.titleEn;
  if (lang === 'en' && titleEn) document.title = titleEn;
  else if (lang === 'ja' && titleJa) document.title = titleJa;
  updateHeroText(lang);
}
const savedLang = readSavedLang();
if (savedLang !== 'ja') {
  applyLang(savedLang);
} else {
  updateHeroText('ja');
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
  if (window.innerWidth >= 960) {
    navLinks.classList.remove('open'); hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'メニューを開く');
  }
}, { passive: true });

/* ─────────────────────────────────────────
   5. ページ内リンク（ブラウザー標準）
───────────────────────────────────────── */
// Native anchor navigation preserves URL fragments, focus and browser history.
// CSS scroll-padding-top accounts for the fixed navigation.

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
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
   7. 本文の即時表示
───────────────────────────────────────── */
// Text stays visible: reading never waits for an intersection or animation.

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
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', `${input.id}-error`);
  if (el) el.textContent = msg;
}
function clearError(input) {
  const el = document.getElementById(`${input.id}-error`);
  input.classList.remove('is-invalid');
  input.removeAttribute('aria-invalid');
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
  const btn = form.querySelector('[type="submit"]');
  const originalLabel = btn ? btn.textContent : '';
  let submitting = false;
  let resetTimer = null;
  function resetSubmission() {
    if (resetTimer !== null) clearTimeout(resetTimer);
    resetTimer = null;
    submitting = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset[currentLang] || originalLabel;
    }
  }
  window.addEventListener('pageshow', resetSubmission);
  fields.forEach(field => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => { if (field.classList.contains('is-invalid')) validateField(field); });
  });
  form.addEventListener('submit', function (e) {
    if (submitting) { e.preventDefault(); return; }
    let valid = true;
    fields.forEach(f => { if (!validateField(f)) valid = false; });
    if (!valid) { e.preventDefault(); const first = form.querySelector('.is-invalid'); if (first) first.focus(); return; }
    if (!btn) return;
    submitting = true;
    btn.disabled = true;
    btn.textContent = getMsg('sending');
    // SSGForm は POST 後にページ遷移するためタイムアウトはフォールバック用
    // 将来 Fetch に切り替える場合はレスポンス受信後に disabled を解除してください
    resetTimer = setTimeout(resetSubmission, 8000);
  });
}

const contactForm = document.querySelector('.contact-form');
if (contactForm) setupValidation(contactForm);

/* Newsletter submission handling temporarily disabled.
const newsletterForm = document.querySelector('.newsletter-form');
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
*/

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
function updateDocumentTitles(lang) {
  // lang は 'ja' または 'en'
  const titleEl = document.querySelector('title');
  if (titleEl) {
    const txt = titleEl.dataset && titleEl.dataset[lang === 'en' ? 'en' : 'ja'];
    if (txt) document.title = txt;
  }

  // OG / Twitter meta 更新（あれば）
  const og = document.querySelector('meta[property="og:title"]');
  const tw = document.querySelector('meta[name="twitter:title"]');
  const metaTxt = (titleEl && titleEl.dataset) ? (titleEl.dataset[lang === 'en' ? 'en' : 'ja']) : document.title;
  if (og) og.setAttribute('content', metaTxt);
  if (tw) tw.setAttribute('content', metaTxt);
}
// 例: 言語切替ボタンで呼ぶ
// document.getElementById('langBtn').addEventListener('click', () => {
//   const newLang = (document.documentElement.lang === 'ja') ? 'en' : 'ja';
//   document.documentElement.lang = newLang;
//   updateDocumentTitles(newLang);
//   // 既存のテキスト置換処理があればそちらも呼ぶ
// });

// Dismiss the mobile navigation and return focus to its trigger.
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navLinks.classList.contains('open')) {
    hamburger.click();
    hamburger.focus();
  }
});
