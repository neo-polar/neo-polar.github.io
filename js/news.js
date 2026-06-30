/* ============================================================
   Polar — news.js
   news.html 専用：ナビ・言語切替・メール難読化のみ
============================================================ */
'use strict';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─── 日英切り替え ─── */
let currentLang = localStorage.getItem('polar-lang') || 'ja';

function applyLang(lang) {
  const TEXT_TAGS = new Set(['P','SPAN','H1','H2','H3','H4','LABEL','BUTTON','A','LI','TIME']);
  document.querySelectorAll('[data-ja]').forEach(el => {
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
  const btn = document.getElementById('langBtn');
  btn.textContent = lang === 'ja' ? 'EN' : 'JA';
  btn.setAttribute('aria-label', lang === 'ja' ? 'Switch to English' : '日本語に切り替える');
  document.documentElement.lang = lang === 'ja' ? 'ja' : 'en';
    document.querySelectorAll('img[data-src-ja]').forEach(img => {
    const src = lang === 'ja' ? img.dataset.srcJa : img.dataset.srcEn;
    if (src) img.src = src;
  });
  localStorage.setItem('polar-lang', lang);
  currentLang = lang;
}

// ページ読み込み時に復元
if (currentLang !== 'ja') applyLang(currentLang);

document.getElementById('langBtn').addEventListener('click', () => {
  applyLang(currentLang === 'ja' ? 'en' : 'ja');
});

/* ─── ハンバーガーメニュー ─── */
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
  }
}, { passive: true });

/* ─── ナビ スクロール強調 ─── */
const nav = document.getElementById('nav');
let scrollTick = false;
window.addEventListener('scroll', () => {
  if (!scrollTick) {
    requestAnimationFrame(() => {
      nav.style.boxShadow = window.scrollY > 20 ? '0 2px 20px rgba(0,0,0,0.07)' : 'none';
      scrollTick = false;
    });
    scrollTick = true;
  }
}, { passive: true });

/* ─── メールアドレス難読化 ─── */
(function buildEmail() {
  const link = document.getElementById('footerEmail');
  if (!link) return;
  const address = `${'Polar22651'}@${'gmail'}.${'com'}`;
  link.href = `mailto:${address}`;
  link.textContent = 'Email';
})();

/* ─── ニュースレター二重送信防止 ─── */
// 変更後
const newsletterForm = document.querySelector('.newsletter-form');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', function (e) {
    const input = this.querySelector('input[type="email"]');
    const errorEl = document.getElementById('newsletter-email-error');
    if (!input.value.trim()) {
      e.preventDefault();
      if (errorEl) errorEl.textContent = currentLang === 'ja' ? 'この項目は必須です。' : 'This field is required.';
      input.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
      e.preventDefault();
      if (errorEl) errorEl.textContent = currentLang === 'ja' ? '有効なメールアドレスを入力してください。' : 'Please enter a valid email address.';
      input.focus();
      return;
    }
    if (errorEl) errorEl.textContent = '';
    const btn = this.querySelector('[type="submit"]');
    if (!btn) return;
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = currentLang === 'ja' ? '送信中…' : 'Sending…';
    setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 8000);
  });
}

/* ─── ニュースリストのフェードイン ─── */
if (!prefersReduced && 'IntersectionObserver' in window) {
  const fadeObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); fadeObs.unobserve(entry.target); }
    });
  }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });

  document.querySelectorAll('.news-item').forEach((el, i) => {
    el.classList.add('will-fade', 'fade-up');
    el.style.transitionDelay = `${i * 0.05}s`;
    fadeObs.observe(el);
  });
} else {
  document.querySelectorAll('.news-item').forEach(el => el.classList.add('is-visible'));
}
