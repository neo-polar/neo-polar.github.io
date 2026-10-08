/* 朔之玖溟 チャンネル紹介動画
   時刻 t（秒）から1フレームを決定的に描画します。
   - scene.html          … ブラウザーでそのまま再生（?t=秒 で途中から）
   - scene.html?render   … render.cjs が window.SCENE.render(t) を呼んで1フレームずつ書き出す
   - scene.html?thumb    … サムネイル用の静止画 */
(() => {
  'use strict';

  const W = 1920;
  const H = 1080;
  const HZ = 830; // 水平線
  const DURATION = 82;
  const TAU = Math.PI * 2;

  const query = new URLSearchParams(location.search);
  const mode = query.has('thumb') ? 'thumb' : query.has('render') ? 'render' : 'play';

  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (x) => x * x * (3 - 2 * x);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;

  function random(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(TAU * r());

  const stage = document.getElementById('stage');
  const sky = document.getElementById('sky');
  const ctx = sky.getContext('2d');
  const fadeEl = document.getElementById('fade');

  /* ---------- 背景の状態（新月の位置・大きさと、各層の明るさ） ---------- */
  // [時刻, 中心x, 中心y, 半径, 新月, 光の柱, 海, 星]
  const KEYS = [
    [0, 960, 440, 250, 0, 0, 0, 0],
    [1.6, 960, 440, 250, 0, 0, 0.35, 1],
    [3.8, 960, 440, 250, 1, 1, 1, 1],
    [6.6, 960, 440, 250, 1, 1, 1, 1],
    [8.2, 1340, 470, 210, 0.9, 0.7, 1, 1],
    [23.2, 1340, 470, 210, 0.9, 0.7, 1, 1],
    [24.6, 960, 400, 330, 0.07, 0, 0.6, 0.9],
    [38.6, 960, 400, 330, 0.07, 0, 0.6, 0.9],
    [39.6, 960, 420, 330, 0.06, 0, 0.45, 0.7],
    [46.2, 960, 420, 330, 0.06, 0, 0.45, 0.7],
    [47.2, 960, 430, 300, 0.12, 0.25, 0.85, 0.9],
    [55.6, 960, 430, 300, 0.12, 0.25, 0.85, 0.9],
    [56.6, 960, 420, 330, 0.05, 0, 0.5, 0.8],
    [66.2, 960, 420, 330, 0.05, 0, 0.5, 0.8],
    [67.4, 960, 470, 360, 0.22, 0.15, 0.8, 1],
    [73.2, 960, 470, 360, 0.22, 0.15, 0.8, 1],
    [74.8, 1380, 440, 230, 1, 1, 1, 1],
    [DURATION, 1380, 440, 230, 1, 1, 1, 1],
  ];
  const THUMB_STATE = { cx: 1470, cy: 440, R: 245, ring: 1, column: 1, sea: 1, stars: 1 };

  function stateAt(t) {
    let i = 0;
    while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const k = easeInOut(seg(t, a[0], b[0]));
    const v = a.map((x, j) => lerp(x, b[j], k));
    return { cx: v[1], cy: v[2], R: v[3], ring: v[4], column: v[5], sea: v[6], stars: v[7] };
  }

  /* ---------- 事前生成（星・星雲・コロナ・波） ---------- */
  const POLE = { x: 960, y: -320 }; // 星は天の極のまわりをゆっくり回る
  const OMEGA = 0.0022;

  const stars = [];
  {
    const r = random(7);
    for (let i = 0; i < 2300; i++) {
      const x = -900 + r() * 3700;
      const y = -1300 + r() * (HZ + 1500);
      const s = r();
      stars.push({
        a: Math.atan2(y - POLE.y, x - POLE.x),
        d: Math.hypot(x - POLE.x, y - POLE.y),
        size: 0.35 + Math.pow(s, 5) * 1.9,
        lum: 0.22 + Math.pow(r(), 2) * 0.78,
        tw: 0.5 + r() * 2.4,
        ph: r() * TAU,
      });
    }
  }

  // 天の川のような淡い帯（回転させて使う）
  const NEB = { x: -900, y: -1300, w: 3700, h: 2700 };
  const nebula = document.createElement('canvas');
  nebula.width = NEB.w;
  nebula.height = NEB.h;
  {
    const n = nebula.getContext('2d');
    const r = random(11);
    for (let i = 0; i < 220; i++) {
      const k = r();
      const bx = lerp(-400, 2700, k) - NEB.x;
      const by = lerp(1150, -700, k) - NEB.y + gauss(r) * 150;
      const rad = 70 + r() * 260;
      const g = n.createRadialGradient(bx, by, 0, bx, by, rad);
      const al = 0.018 + r() * 0.035;
      g.addColorStop(0, `rgba(150,176,204,${al})`);
      g.addColorStop(1, 'rgba(150,176,204,0)');
      n.fillStyle = g;
      n.fillRect(bx - rad, by - rad, rad * 2, rad * 2);
    }
  }

  const corona = [];
  {
    const r = random(23);
    for (let i = 0; i < 1500; i++) {
      const inward = r() < 0.22;
      corona.push({
        a: r() * TAU,
        o: (r() - 0.5) * 0.025,
        l: inward ? -(0.01 + r() * 0.07) : 0.012 + Math.pow(r(), 5) * 0.34,
        al: 0.04 + Math.pow(r(), 2) * 0.32,
        s: 0.5 + r() * 2,
        p: r() * TAU,
      });
    }
  }

  const spray = [];
  {
    const r = random(31);
    for (let i = 0; i < 46; i++) {
      spray.push({ a: -Math.PI / 2 + gauss(r) * 0.12, l: 0.08 + Math.pow(r(), 2) * 0.42, al: 0.08 + r() * 0.3, p: r() * TAU });
    }
  }

  const waves = [];
  {
    const r = random(41);
    const N = 46;
    for (let i = 0; i < N; i++) {
      const d = i / (N - 1);
      waves.push({
        d,
        y: HZ + 3 + (H - HZ + 40) * Math.pow(d, 1.75),
        amp: 0.5 + d * 8,
        f: (0.022 - 0.016 * d) * (0.8 + r() * 0.4),
        sp: (0.5 + r() * 0.8) * (r() < 0.5 ? -1 : 1),
        ph: r() * TAU,
        ph2: r() * TAU,
        ph3: r() * TAU,
        ph4: r() * TAU,
      });
    }
  }

  const glints = [];
  {
    const r = random(53);
    for (let i = 0; i < 90; i++) {
      const d = Math.pow(r(), 1.4);
      glints.push({ d, x: gauss(r) * (40 + d * 260), f: 1 + r() * 3, p: r() * TAU, s: 0.6 + r() * 1.2 });
    }
  }

  // 固定の粒子（ディザ）
  {
    const g = document.getElementById('grain').getContext('2d');
    const img = g.createImageData(W, H);
    const r = random(97);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.round(64 + r() * 128);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  /* ---------- 背景の描画 ---------- */
  const skyGradient = ctx.createLinearGradient(0, 0, 0, HZ);
  skyGradient.addColorStop(0, '#020509');
  skyGradient.addColorStop(0.62, '#07101a');
  skyGradient.addColorStop(1, '#132231');
  const seaGradient = ctx.createLinearGradient(0, HZ, 0, H);
  seaGradient.addColorStop(0, '#0b1520');
  seaGradient.addColorStop(0.3, '#060d14');
  seaGradient.addColorStop(1, '#020407');

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function drawStars(t, st) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, HZ);
    ctx.clip();
    if (st.stars > 0) {
      ctx.globalAlpha = st.stars;
      ctx.translate(POLE.x, POLE.y);
      ctx.rotate(OMEGA * t);
      ctx.drawImage(nebula, NEB.x - POLE.x, NEB.y - POLE.y);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      for (const s of stars) {
        const ang = s.a + OMEGA * t;
        const x = POLE.x + Math.cos(ang) * s.d;
        const y = POLE.y + Math.sin(ang) * s.d;
        if (x < -6 || x > W + 6 || y < -6 || y > HZ) continue;
        const tw = 0.7 + 0.3 * Math.sin(t * s.tw + s.ph);
        const al = s.lum * tw * st.stars * clamp((HZ - y) / 140);
        if (al < 0.01) continue;
        if (s.size > 1.5) {
          ctx.fillStyle = `rgba(214,226,240,${al * 0.14})`;
          circle(x, y, s.size * 4.5);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(238,242,248,${al})`;
        circle(x, y, s.size);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawRing(t, { cx, cy, R, ring: a }) {
    if (a < 0.003) return;
    const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 2.4);
    halo.addColorStop(0, `rgba(196,212,228,${0.2 * a})`);
    halo.addColorStop(0.35, `rgba(110,140,172,${0.07 * a})`);
    halo.addColorStop(1, 'rgba(110,140,172,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - R * 2.4, cy - R * 2.4, R * 4.8, R * 4.8);

    // 公転軌道と九つの点（玖）
    const O = R * 1.32;
    ctx.strokeStyle = `rgba(228,234,242,${0.34 * a})`;
    ctx.lineWidth = 1.2;
    circle(cx, cy, O);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = `rgba(240,244,248,${a})`;
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(250,248,242,${0.85 * a})`;
    for (let i = 0; i < 9; i++) {
      const ang = ((15 + (i * 150) / 8) * Math.PI) / 180 + Math.sin(t * 0.07) * 0.01;
      circle(cx + Math.cos(ang) * O, cy + Math.sin(ang) * O, 4);
      ctx.fill();
    }
    ctx.restore();

    // コロナの細い光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1;
    for (const f of corona) {
      const ang = f.a + t * 0.012;
      const flick = 0.65 + 0.35 * Math.sin(t * f.s + f.p);
      const r0 = R * (1 + f.o);
      const r1 = r0 + R * f.l;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      ctx.strokeStyle = `rgba(240,242,246,${f.al * flick * a})`;
      ctx.beginPath();
      ctx.moveTo(cx + c * r0, cy + s * r0);
      ctx.lineTo(cx + c * r1, cy + s * r1);
      ctx.stroke();
    }
    ctx.restore();

    // 新月（朔）の暗い円盤
    ctx.fillStyle = `rgba(2,4,7,${0.95 * a})`;
    circle(cx, cy, R * 0.985);
    ctx.fill();
    const inner = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R);
    inner.addColorStop(0, 'rgba(210,222,234,0)');
    inner.addColorStop(1, `rgba(210,222,234,${0.1 * a})`);
    ctx.fillStyle = inner;
    circle(cx, cy, R);
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = `rgba(255,251,244,${a})`;
    ctx.shadowColor = `rgba(232,238,246,${a})`;
    ctx.lineWidth = 2.4;
    ctx.shadowBlur = 38;
    circle(cx, cy, R);
    ctx.stroke();
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();
  }

  function drawColumn(t, { cx, cy, R, column: a }) {
    if (a < 0.003) return;
    const y0 = cy + R * 0.92;
    const y1 = HZ;
    if (y1 <= y0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, `rgba(244,246,250,${0.95 * a})`);
    g.addColorStop(0.55, `rgba(244,246,250,${0.55 * a})`);
    g.addColorStop(1, `rgba(244,246,250,${0.85 * a})`);
    ctx.fillStyle = g;
    ctx.shadowColor = `rgba(226,236,246,${0.9 * a})`;
    ctx.shadowBlur = 34;
    ctx.fillRect(cx - 1.6, y0, 3.2, y1 - y0);
    ctx.shadowBlur = 10;
    ctx.fillRect(cx - 1, y0, 2, y1 - y0);
    ctx.shadowBlur = 0;
    // 円盤の下端から立ちのぼる光
    ctx.lineWidth = 1;
    for (const f of spray) {
      const flick = 0.6 + 0.4 * Math.sin(t * 2.1 + f.p);
      const len = R * f.l * (0.85 + 0.15 * Math.sin(t * 1.3 + f.p));
      ctx.strokeStyle = `rgba(244,246,250,${f.al * flick * a})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy + R * 0.97);
      ctx.lineTo(cx + Math.cos(f.a) * len, cy + R * 0.97 + Math.sin(f.a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSea(t, st, horizonProgress) {
    const { cx, sea } = st;
    const light = Math.max(st.column, st.ring * 0.35) * sea;
    ctx.fillStyle = seaGradient;
    ctx.fillRect(0, HZ, W, H - HZ);

    // 水平線の照り返し
    ctx.save();
    ctx.translate(cx, HZ);
    ctx.scale(1, 0.22);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 900);
    glow.addColorStop(0, `rgba(150,182,214,${0.16 * Math.max(sea, 0.2) * horizonProgress})`);
    glow.addColorStop(1, 'rgba(150,182,214,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-900, -900, 1800, 1800);
    ctx.restore();

    // 波
    for (const w of waves) {
      const base = (0.045 + 0.12 * w.d) * sea;
      const hl = light * 0.55 * (1 - w.d * 0.45);
      const sigma = 70 + w.d * 380;
      if (base + hl < 0.004) continue;
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, `rgba(214,226,238,${base})`);
      for (let k = -3; k <= 3; k++) {
        const x = cx + k * sigma * 0.75;
        if (x <= 0 || x >= W) continue;
        g.addColorStop(x / W, `rgba(214,226,238,${base + hl * Math.exp(-((k * 0.75) ** 2))})`);
      }
      g.addColorStop(1, `rgba(214,226,238,${base})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 0.8 + w.d * 1.4;
      ctx.beginPath();
      let pen = false;
      for (let x = -10; x <= W + 10; x += 10) {
        const visible = Math.sin(x * w.f * 0.31 + w.ph3 + t * 0.21 * Math.sign(w.sp)) + 0.6 * Math.sin(x * w.f * 0.13 + w.ph4) > -0.35;
        if (!visible) {
          pen = false;
          continue;
        }
        const y = w.y + w.amp * Math.sin(x * w.f + t * w.sp + w.ph) + w.amp * 0.4 * Math.sin(x * w.f * 2.7 - t * w.sp * 1.3 + w.ph2);
        if (pen) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();
    }

    // 光の柱の映り込み
    if (st.column > 0.003) {
      const a = st.column * sea;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = `rgba(230,238,246,${a})`;
      ctx.shadowBlur = 16;
      for (let k = 0; k < 8; k++) {
        const y = HZ + 12 + k * (k + 4) * 3;
        const al = a * (0.9 - k * 0.1) * (0.7 + 0.3 * Math.sin(t * 1.7 + k * 1.3));
        ctx.fillStyle = `rgba(242,246,250,${al})`;
        ctx.beginPath();
        ctx.ellipse(cx + Math.sin(t * 1.1 + k) * k * 1.4, y, 20 + k * 7, 2.6 + k * 1.5, 0, 0, TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      for (const g of glints) {
        const al = a * 0.9 * Math.pow(Math.max(0, Math.sin(t * g.f + g.p)), 6);
        if (al < 0.01) continue;
        ctx.fillStyle = `rgba(246,248,252,${al})`;
        circle(cx + g.x, HZ + 8 + g.d * (H - HZ), g.s);
        ctx.fill();
      }
      ctx.restore();
    }

    // 水平線
    if (horizonProgress > 0) {
      const half = (W / 2 + 40) * horizonProgress;
      const g = ctx.createLinearGradient(960 - half, 0, 960 + half, 0);
      g.addColorStop(0, 'rgba(226,234,242,0.12)');
      g.addColorStop(0.5, 'rgba(236,242,248,0.6)');
      g.addColorStop(1, 'rgba(226,234,242,0.12)');
      ctx.fillStyle = g;
      ctx.fillRect(960 - half, HZ - 0.6, half * 2, 1.2);
    }
  }

  function drawBackground(t, st, horizonProgress) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, W, HZ);
    drawStars(t, st);
    drawRing(t, st);
    drawColumn(t, st);
    drawSea(t, st, horizonProgress);
  }

  /* ---------- 文字のアニメーション ---------- */
  function splitChars(el) {
    const out = [];
    const walk = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          for (const ch of child.textContent) {
            if (/\s/.test(ch)) {
              frag.append(ch);
              continue;
            }
            const span = document.createElement('span');
            span.textContent = ch;
            frag.append(span);
            out.push(span);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      }
    };
    walk(el);
    return out;
  }

  const scenes = [...document.querySelectorAll('.scene')].map((el) => ({ el, a: +el.dataset.in, b: +el.dataset.out }));
  const items = [...document.querySelectorAll('[data-fx]')].map((el) => {
    const d = el.dataset;
    const it = { el, fx: d.fx, at: +d.at || 0, dur: +(d.dur || 1), stagger: +(d.stagger || 0.06), speed: +(d.speed || 0) };
    if (it.fx === 'chars') it.chars = splitChars(el);
    return it;
  });

  function animate(it, t) {
    const { el } = it;
    const p = easeOut(seg(t, it.at, it.at + it.dur));
    switch (it.fx) {
      case 'fade':
        el.style.opacity = p;
        break;
      case 'rise':
        el.style.opacity = p;
        el.style.transform = `translateY(${(1 - p) * 26}px)`;
        el.style.filter = p < 1 ? `blur(${(1 - p) * 6}px)` : 'none';
        break;
      case 'lineX':
        el.style.transform = `scaleX(${easeInOut(seg(t, it.at, it.at + it.dur))})`;
        break;
      case 'marquee':
        el.style.opacity = smooth(seg(t, it.at, it.at + 1.6));
        el.style.transform = `translateX(${(t - it.at) * it.speed}px)`;
        break;
      case 'chars':
        it.chars.forEach((c, i) => {
          const s = it.at + i * it.stagger;
          const q = easeOut(seg(t, s, s + it.dur));
          c.style.opacity = q;
          c.style.filter = q < 1 ? `blur(${(1 - q) * 7}px)` : 'none';
        });
        break;
    }
  }

  function render(t) {
    drawBackground(t, stateAt(t), smooth(seg(t, 0.6, 2.6)));
    for (const s of scenes) {
      const o = smooth(seg(t, s.a, s.a + 0.7)) * (1 - smooth(seg(t, s.b - 0.8, s.b)));
      s.el.style.opacity = o;
      s.el.style.visibility = o > 0.001 ? 'visible' : 'hidden';
      if (o > 0.001) for (const it of items) if (s.el.contains(it.el)) animate(it, t);
    }
    fadeEl.style.opacity = Math.max(1 - smooth(seg(t, 0, 0.9)), smooth(seg(t, DURATION - 1.2, DURATION)));
  }

  function renderThumb() {
    document.body.classList.add('thumb-mode');
    for (const s of scenes) s.el.style.visibility = 'hidden';
    fadeEl.style.opacity = 0;
    drawBackground(5.2, THUMB_STATE, 1);
  }

  /* ---------- 準備（フォント読み込み） ---------- */
  const ready = (async () => {
    const text = stage.textContent;
    const faces = [
      '500 40px "Shippori Mincho"',
      '700 40px "Shippori Mincho"',
      '800 40px "Shippori Mincho"',
      '500 40px "Cormorant Garamond"',
      '600 40px "Cormorant Garamond"',
      'italic 500 40px "Cormorant Garamond"',
    ];
    await Promise.all(faces.map((f) => document.fonts.load(f, text)));
    await document.fonts.ready;
  })();

  window.SCENE = { ready, render, renderThumb, duration: DURATION, width: W, height: H };

  if (mode === 'thumb') {
    ready.then(renderThumb);
  } else if (mode === 'play') {
    const fit = () => {
      stage.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H)})`;
    };
    fit();
    addEventListener('resize', fit);
    ready.then(() => {
      const start = performance.now() - (+query.get('t') || 0) * 1000;
      const loop = (now) => {
        render(((now - start) / 1000) % DURATION);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  } else {
    render(0);
  }
})();
