/* Polar promotion film.
 * Every frame is a pure function of the time t (seconds): nothing depends on the
 * previous frame, so render.cjs can capture frames in parallel and out of order.
 * Timing is written in bars of a 75 BPM score shared with music.py. */
(() => {
  'use strict';

  const W = 1920, H = 1080, TAU = Math.PI * 2, DEG = Math.PI / 180;
  const BEAT = 0.8, BAR = BEAT * 4;
  const bar = n => (n - 1) * BAR;
  const DURATION = bar(17); // 16 bars, 51.2 s
  const T = {
    orbit: bar(3), genres: bar(5), passion: bar(7), values: bar(9),
    trajectory: bar(11), logo: bar(13), join: bar(15),
  };

  /* ---------- Math ---------- */
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, start, dur) => clamp((t - start) / dur);
  const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
  const E = {
    inQuad: k => k * k,
    inCubic: k => k * k * k,
    outCubic: k => 1 - (1 - k) ** 3,
    outQuart: k => 1 - (1 - k) ** 4,
    outQuint: k => 1 - (1 - k) ** 5,
    outExpo: k => (k >= 1 ? 1 : 1 - 2 ** (-10 * k)),
    inOutCubic: k => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
    inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2,
  };
  // Visible window: eases in over [a, a + fin] and out over [b - fout, b].
  const win = (t, a, b, fin, fout) => Math.min(E.outCubic(prog(t, a, fin)), 1 - E.inOutSine(prog(t, b - fout, fout)));
  // Keyframes [[time, value, ease?], ...]; each segment eases into its own key.
  function keys(t, list) {
    if (t <= list[0][0]) return list[0][1];
    for (let i = 1; i < list.length; i++) {
      const [t1, v1, ease = E.inOutSine] = list[i];
      if (t < t1) {
        const [t0, v0] = list[i - 1];
        return lerp(v0, v1, ease((t - t0) / (t1 - t0)));
      }
    }
    return list[list.length - 1][1];
  }
  function mulberry32(seed) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let r = Math.imul(a ^ (a >>> 15), 1 | a);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

  /* ---------- Sky rotation: integral of a keyed angular speed (deg/s) ---------- */
  const OMEGA = [[0, 1.2], [6.4, 1.6], [9.6, 6], [18.2, 7], [19.15, 16], [19.2, 2], [31.8, 2], [33.4, 3], [38.4, 3], [40, 1.2], [DURATION, 1.2]];
  const omega = t => {
    for (let i = 1; i < OMEGA.length; i++) {
      if (t < OMEGA[i][0]) return lerp(OMEGA[i - 1][1], OMEGA[i][1], (t - OMEGA[i - 1][0]) / (OMEGA[i][0] - OMEGA[i - 1][0]));
    }
    return OMEGA[OMEGA.length - 1][1];
  };
  const ROT_DT = 1 / 480;
  const rotTable = new Float64Array(Math.ceil(DURATION / ROT_DT) + 2);
  for (let i = 1; i < rotTable.length; i++) rotTable[i] = rotTable[i - 1] + omega((i - 0.5) * ROT_DT) * DEG * ROT_DT;
  const rotation = t => {
    const x = clamp(t, 0, DURATION) / ROT_DT, i = Math.floor(x);
    return lerp(rotTable[i], rotTable[Math.min(i + 1, rotTable.length - 1)], x - i);
  };

  /* ---------- Logo geometry (promo/assets/logo-*.png, 1870×446 each) ---------- */
  const LOGO = {
    w: 1870, h: 446,
    ring: { cx: 240.015, cy: 242.806, rx: 222.025, ry: 72.408, angle: 159.0716 * DEG },
    dot: { x: 312.5, y: 126 },
    barTop: { y0: 19, y1: 323 }, barBottom: { y0: 350, y1: 428 },
    letters: ['P', 'O', 'L', 'A', 'R'],
  };
  const images = {};
  const imageReady = Promise.all(['ring', 'dot', 'bar-top', 'bar-bottom', ...LOGO.letters].map(name => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`missing assets/logo-${name}.png`));
    img.src = `assets/logo-${name}.png`;
    images[name] = img;
  })));

  // Camera for the orbit/logo group: screen = (x, y) + s * (logo - ring centre).
  const G_ORBIT = { s: 3.2, x: 980, y: 560 };
  const G_LOGO = { s: 0.56, x: 570.5, y: 511 };
  const G_JOIN = { s: 0.36, x: 709.8, y: 307.2 };
  // Zoom that keeps one screen point fixed, interpolating scale logarithmically.
  function zoomBetween(a, b, k) {
    const s = Math.exp(lerp(Math.log(a.s), Math.log(b.s), k));
    const wx = (b.x - a.x) / (a.s - b.s), wy = (b.y - a.y) / (a.s - b.s);
    return { s, x: a.x + a.s * wx - s * wx, y: a.y + a.s * wy - s * wy };
  }
  const orbitCamera = t => ({ ...G_ORBIT, s: G_ORBIT.s + 0.1 * E.inOutSine(prog(t, T.trajectory, T.logo - T.trajectory)) });
  function group(t) {
    if (t < T.logo) return orbitCamera(t);
    if (t < T.join) return zoomBetween(orbitCamera(T.logo), G_LOGO, E.outQuint(prog(t, T.logo, 2.1)));
    return zoomBetween(G_LOGO, G_JOIN, E.inOutCubic(prog(t, T.join, 1.5)));
  }
  const toScreen = (g, x, y) => ({ x: g.x + g.s * (x - LOGO.ring.cx), y: g.y + g.s * (y - LOGO.ring.cy) });
  function ringPoint(g, phi) {
    const R = LOGO.ring, c = Math.cos(R.angle), s = Math.sin(R.angle);
    const ux = R.rx * Math.cos(phi), uy = R.ry * Math.sin(phi);
    return toScreen(g, R.cx + ux * c - uy * s, R.cy + ux * s + uy * c);
  }

  /* ---------- Celestial pole: where the sky turns, later the dot of the logo ---------- */
  const starPos = t => toScreen(group(t), LOGO.dot.x, LOGO.dot.y);
  function pole(t) {
    if (t < T.passion) return { x: 960, y: 540 };
    const above = { x: lerp(960, 920, prog(t, T.passion, 12.6)), y: -430 };
    if (t < 31.8) return above;
    const k = E.inOutCubic(prog(t, 31.8, 1.8));
    const p = starPos(t);
    return { x: lerp(above.x, p.x, k), y: lerp(above.y, p.y, k) };
  }
  // The sky lags behind the logo during the final zoom, for depth.
  function skyPole(t) {
    if (t < T.logo) return pole(t);
    const a = pole(T.logo), b = pole(t);
    return { x: lerp(a.x, b.x, 0.45), y: lerp(a.y, b.y, 0.45) };
  }

  /* ---------- Stars ---------- */
  const TINTS = [[232, 246, 255], [164, 223, 235], [255, 214, 176], [206, 202, 255]];
  const stars = [];
  {
    const rand = mulberry32(20261008);
    for (let i = 0; i < 2300; i++) {
      const u = rand(), m = rand() ** 2.4;
      stars.push({
        r: 18 + 1880 * Math.sqrt(rand()),
        a: rand() * TAU,
        size: 0.6 + m * 2.2,
        bright: 0.2 + m * 0.8,
        tint: u < 0.72 ? 0 : u < 0.87 ? 1 : u < 0.94 ? 2 : 3,
        tw: rand() * TAU,
        twf: 0.7 + rand() * 1.9,
        delay: rand(),
      });
    }
  }
  const starSprites = TINTS.map(([r, g, b]) => {
    const c = canvas(64, 64), x = c.getContext('2d');
    const rg = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.1, `rgba(${r},${g},${b},0.95)`);
    rg.addColorStop(0.22, `rgba(${r},${g},${b},0.35)`);
    rg.addColorStop(0.5, `rgba(${r},${g},${b},0.07)`);
    rg.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = rg;
    x.fillRect(0, 0, 64, 64);
    return c;
  });

  function arcOnScreen(cx, cy, r, a0, span) {
    const nx = clamp(cx, 0, W), ny = clamp(cy, 0, H);
    if (r < Math.hypot(cx - nx, cy - ny) - 10) return false;
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(cx - W, cy), Math.hypot(cx, cy - H), Math.hypot(cx - W, cy - H));
    if (r > far + 10) return false;
    const step = Math.min(0.25, 240 / r), n = Math.max(1, Math.ceil(span / step));
    for (let i = 0; i <= n; i++) {
      const a = a0 + (span * i) / n, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (x > -24 && x < W + 24 && y > -24 && y < H + 24) return true;
    }
    return false;
  }

  const trailSpan = t => keys(t, [
    [T.orbit, 0], [12.4, 52 * DEG], [T.passion - 0.001, 52 * DEG], [T.passion, 34 * DEG, E.outCubic],
    [31.8, 34 * DEG], [33.6, 18 * DEG], [T.logo, 18 * DEG], [40.2, 0.7 * DEG],
  ]);
  const starLevel = t => keys(t, [
    [0, 1], [T.passion, 1], [T.values, 0.9], [26.4, 0.62], [31.8, 0.62], [33.6, 0.85], [T.logo, 0.85], [40.2, 0.55], [T.join, 0.55], [46.4, 0.45],
  ]);

  function drawStars(ctx, t, P, rot, zoom) {
    const span = trailSpan(t), level = starLevel(t), still = 1 - clamp(span / (20 * DEG));
    ctx.lineCap = 'round';
    for (const s of stars) {
      const appear = smooth(0, 1, (t - (1.2 + (s.r / 1900) * 2.6 + s.delay * 0.6)) / 1.4);
      if (appear <= 0) continue;
      const r = s.r * zoom, head = s.a - rot;
      if (!arcOnScreen(P.x, P.y, r, head, Math.max(span, 0.01))) continue;
      const twinkle = 1 + 0.28 * still * Math.sin(t * s.twf * 2.2 + s.tw);
      const alpha = clamp(s.bright * level * appear * twinkle);
      if (alpha < 0.012) continue;
      const [cr, cg, cb] = TINTS[s.tint];
      if (span > 0.003) {
        const grad = ctx.createConicGradient(head, P.x, P.y);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${(alpha * 0.85).toFixed(3)})`);
        grad.addColorStop(Math.min(span / TAU, 0.99), `rgba(${cr},${cg},${cb},0)`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.size * 0.85;
        ctx.beginPath();
        ctx.arc(P.x, P.y, r, head, head + span);
        ctx.stroke();
      }
      const d = s.size * 7;
      ctx.globalAlpha = alpha;
      ctx.drawImage(starSprites[s.tint], P.x + Math.cos(head) * r - d / 2, P.y + Math.sin(head) * r - d / 2, d, d);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- Nebula haze, rotating with the sky ---------- */
  const nebula = (() => {
    const c = canvas(900, 900), x = c.getContext('2d'), rand = mulberry32(90);
    x.filter = 'blur(26px)';
    for (let i = 0; i < 70; i++) {
      const k = rand(), along = (k - 0.5) * 900, across = (rand() - 0.5) * 160 * (1 - Math.abs(k - 0.5));
      const px = 450 + along * 0.8 + across * 0.6, py = 450 + along * 0.6 - across * 0.8;
      const rr = 40 + rand() * 110, warm = rand() < 0.18;
      const col = warm ? '74,72,140' : rand() < 0.5 ? '40,108,128' : '36,74,118';
      const rg = x.createRadialGradient(px, py, 0, px, py, rr);
      rg.addColorStop(0, `rgba(${col},${0.16 + rand() * 0.14})`);
      rg.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = rg;
      x.beginPath();
      x.arc(px, py, rr, 0, TAU);
      x.fill();
    }
    return c;
  })();

  /* ---------- Pole star ---------- */
  const poleStar = (() => {
    const c = canvas(512, 512), g = c.getContext('2d'), m = 256;
    let rg = g.createRadialGradient(m, m, 0, m, m, 256);
    rg.addColorStop(0, 'rgba(196,238,248,0.5)');
    rg.addColorStop(0.07, 'rgba(164,223,235,0.2)');
    rg.addColorStop(0.3, 'rgba(110,184,210,0.05)');
    rg.addColorStop(1, 'rgba(110,184,210,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 512, 512);
    const ray = (len, wid, alpha, angle) => {
      g.save();
      g.translate(m, m);
      g.rotate(angle);
      const lg = g.createLinearGradient(0, 0, len, 0);
      lg.addColorStop(0, `rgba(244,253,255,${alpha})`);
      lg.addColorStop(0.45, `rgba(214,244,252,${alpha * 0.35})`);
      lg.addColorStop(1, 'rgba(200,240,250,0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(0, -wid);
      g.lineTo(len, 0);
      g.lineTo(0, wid);
      g.closePath();
      g.fill();
      g.restore();
    };
    for (let i = 0; i < 4; i++) ray(252, 4.5, 0.95, (i * Math.PI) / 2);
    for (let i = 0; i < 4; i++) ray(64, 2.6, 0.55, Math.PI / 4 + (i * Math.PI) / 2);
    rg = g.createRadialGradient(m, m, 0, m, m, 20);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.4, 'rgba(255,255,255,0.85)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(m, m, 20, 0, TAU);
    g.fill();
    return c;
  })();
  function drawPoleStar(ctx, x, y, size, alpha) {
    if (alpha <= 0.002 || size <= 0.5) return;
    ctx.save();
    ctx.globalAlpha = clamp(alpha);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(poleStar, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  /* ---------- Aurora curtains (half resolution, upscaled for softness) ---------- */
  const AW = 960, AH = 540;
  const aurora = canvas(AW, AH);
  const auroraGlow = canvas(240, 135);
  const auroraStrip = (() => {
    const c = canvas(1, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(143,164,244,0)');
    g.addColorStop(0.3, 'rgba(143,164,244,0.18)');
    g.addColorStop(0.6, 'rgba(73,198,214,0.5)');
    g.addColorStop(0.88, 'rgba(110,236,200,0.95)');
    g.addColorStop(0.95, 'rgba(172,255,226,1)');
    g.addColorStop(1, 'rgba(172,255,226,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 1, 256);
    return c;
  })();
  const AURORA_LAYERS = [
    { y: 0.5, amp: 0.035, h: 0.26, alpha: 0.22, f1: 2.7, f2: 7.3, s1: -0.14, s2: 0.22, ph: 2.1 },
    { y: 0.63, amp: 0.085, h: 0.46, alpha: 0.5, f1: 3.6, f2: 9.1, s1: 0.2, s2: -0.3, ph: 0 },
  ];
  function drawAurora(ctx, t, level, dy) {
    if (level <= 0.003) return;
    const a = aurora.getContext('2d');
    a.globalCompositeOperation = 'source-over';
    a.clearRect(0, 0, AW, AH);
    a.globalCompositeOperation = 'lighter';
    for (const L of AURORA_LAYERS) {
      for (let x = -2; x < AW + 2; x++) {
        const u = x / AW;
        const yb = (L.y + L.amp * Math.sin(u * L.f1 + t * L.s1 + L.ph) + 0.02 * Math.sin(u * L.f2 + t * L.s2)) * AH;
        const r1 = 0.5 + 0.5 * Math.sin(u * 230 + 5 * Math.sin(u * 11 + t * 0.35 + L.ph) + t * 0.9);
        const r2 = 0.5 + 0.5 * Math.sin(u * 520 + 3 * Math.sin(u * 23 - t * 0.5) - t * 1.3);
        const ray = 0.3 + 0.7 * (r1 * 0.65 + r2 * 0.35) ** 2;
        const fold = 0.5 + 0.5 * Math.sin(u * 7.3 - t * 0.4 + L.ph);
        const frame = smooth(0, 0.14, u) * smooth(1, 0.86, u) * (1 - 0.62 * Math.exp(-(((u - 0.5) / 0.13) ** 2)));
        const h = L.h * AH * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(u * 17 + t * 0.6 + L.ph)));
        a.globalAlpha = clamp(L.alpha * (0.3 + 0.7 * fold) * ray * frame * level);
        a.drawImage(auroraStrip, 0, 0, 1, 256, x, yb - h, 1.3, h);
      }
    }
    const g = auroraGlow.getContext('2d');
    g.clearRect(0, 0, 240, 135);
    g.drawImage(aurora, 0, 0, 240, 135);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(auroraGlow, 0, dy, W, H);
    ctx.globalAlpha = 1;
    ctx.drawImage(aurora, 0, dy, W, H);
    ctx.restore();
  }

  /* ---------- Ice ridge on the horizon ---------- */
  const RIDGE_BACK = [[0, 0.84], [0.06, 0.8], [0.13, 0.82], [0.2, 0.765], [0.26, 0.79], [0.33, 0.748], [0.4, 0.776], [0.47, 0.762], [0.53, 0.79], [0.6, 0.752], [0.66, 0.786], [0.74, 0.738], [0.8, 0.77], [0.87, 0.742], [0.93, 0.768], [1, 0.75]];
  const RIDGE_FRONT = [[0, 0.885], [0.05, 0.862], [0.1, 0.876], [0.16, 0.832], [0.22, 0.856], [0.27, 0.822], [0.31, 0.836], [0.37, 0.804], [0.43, 0.846], [0.5, 0.872], [0.56, 0.842], [0.61, 0.856], [0.67, 0.816], [0.72, 0.832], [0.78, 0.792], [0.83, 0.822], [0.88, 0.802], [0.94, 0.836], [1, 0.812]];
  function ridgePath(ctx, pts, dy) {
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    for (const [u, v] of pts) ctx.lineTo(u * W, v * H + dy);
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
  }
  function drawRidge(ctx, dy) {
    if (dy >= H * 0.3) return;
    let g = ctx.createLinearGradient(0, 0.74 * H + dy, 0, H + dy);
    g.addColorStop(0, '#0e2635');
    g.addColorStop(1, '#06121a');
    ctx.fillStyle = g;
    ridgePath(ctx, RIDGE_BACK, dy * 0.8);
    ctx.fill();
    g = ctx.createLinearGradient(0, 0.7 * H + dy, 0, 0.84 * H + dy);
    g.addColorStop(0, 'rgba(80,170,190,0)');
    g.addColorStop(1, 'rgba(80,170,190,0.09)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0.7 * H + dy, W, 0.16 * H);
    g = ctx.createLinearGradient(0, 0.79 * H + dy, 0, H + dy);
    g.addColorStop(0, '#08151d');
    g.addColorStop(1, '#020508');
    ctx.fillStyle = g;
    ridgePath(ctx, RIDGE_FRONT, dy);
    ctx.fill();
    const rim = ctx.createLinearGradient(0, 0, W, 0);
    rim.addColorStop(0, 'rgba(200,236,245,0)');
    rim.addColorStop(0.3, 'rgba(200,236,245,0.3)');
    rim.addColorStop(0.7, 'rgba(200,236,245,0.3)');
    rim.addColorStop(1, 'rgba(200,236,245,0)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    RIDGE_FRONT.forEach(([u, v], i) => (i ? ctx.lineTo(u * W, v * H + dy) : ctx.moveTo(u * W, v * H + dy)));
    ctx.stroke();
  }
  const ridgeOffset = t => keys(t, [
    [T.passion - 0.001, 520], [T.passion, 70], [22.6, 0, E.outCubic], [31.8, -14, E.inOutSine], [33.4, 560, E.inOutCubic],
  ]);

  /* ---------- Star chart lines of the prologue ---------- */
  function drawChart(ctx, t, P, rot) {
    const k = win(t, 1, 12.6, 1.6, 2.6);
    if (k <= 0) return;
    ctx.save();
    ctx.translate(P.x, P.y);
    const grow = E.outExpo(prog(t, 1, 2.4));
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2, L = 1180 * grow;
      const g = ctx.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
      g.addColorStop(0, `rgba(200,234,243,${0.3 * k})`);
      g.addColorStop(1, 'rgba(200,234,243,0)');
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
      ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L);
      ctx.stroke();
    }
    ctx.rotate(-rot * 0.35);
    const c1 = E.inOutCubic(prog(t, 1.4, 1.8)), c2 = E.inOutCubic(prog(t, 1.75, 2.2));
    ctx.strokeStyle = `rgba(200,234,243,${0.2 * k})`;
    ctx.beginPath();
    ctx.arc(0, 0, 118, -Math.PI / 2, -Math.PI / 2 + TAU * c1);
    ctx.stroke();
    ctx.strokeStyle = `rgba(200,234,243,${0.26 * k})`;
    ctx.beginPath();
    ctx.arc(0, 0, 262, -Math.PI / 2, -Math.PI / 2 + TAU * c2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(214,242,248,${0.32 * k})`;
    for (let i = 0; i < 72; i++) {
      const a = -Math.PI / 2 + (i / 72) * TAU;
      if (i / 72 > c2) break;
      const len = i % 6 === 0 ? 12 : 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 262, Math.sin(a) * 262);
      ctx.lineTo(Math.cos(a) * (262 + len), Math.sin(a) * (262 + len));
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(214,242,248,${0.55 * k * E.outCubic(prog(t, 3, 1))})`;
    ctx.font = '400 11px "IBM Plex Mono"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ['0h', '6h', '12h', '18h'].forEach((label, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 2;
      ctx.fillText(label, Math.cos(a) * 296, Math.sin(a) * 296);
    });
    ctx.restore();
  }

  /* ---------- Genres on orbits ---------- */
  const GENRES = [
    { en: 'Music', ja: '音楽', r: 250, a: -62 },
    { en: 'Video', ja: '映像', r: 360, a: -160 },
    { en: 'Illustration', ja: 'イラスト', r: 470, a: -136 },
    { en: 'Writing', ja: '執筆', r: 580, a: 24 },
    { en: 'Programming', ja: 'プログラミング', r: 690, a: 2 },
  ];
  const EN_FONT = 'italic 500 56px "Cormorant Garamond"';
  const JA_FONT = '500 15px "Noto Sans JP"';
  function textOnArc(ctx, text, P, r, center, upper, spacing, alpha, reveal) {
    // Advance from kerned prefix widths so Latin keeps its kerning.
    const widths = [];
    for (let i = 0; i <= text.length; i++) widths.push(ctx.measureText(text.slice(0, i)).width + spacing * i);
    const total = widths[text.length], dir = upper ? 1 : -1, start = center - (dir * total) / r / 2;
    for (let i = 0; i < text.length; i++) {
      const k = reveal(i);
      if (k <= 0) continue;
      const mid = (widths[i] + widths[i + 1] - spacing) / 2, a = start + (dir * mid) / r;
      const rr = r + (1 - k) * 22;
      ctx.save();
      ctx.translate(P.x + Math.cos(a) * rr, P.y + Math.sin(a) * rr);
      ctx.rotate(a + (dir * Math.PI) / 2);
      ctx.globalAlpha = alpha * k;
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
    return total / r;
  }
  function sparkle(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#d8f4fb';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? size * 0.28 : size;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawGenres(ctx, t, P, rot, zoom) {
    if (t < T.genres - 0.2 || t > T.passion) return;
    const out = 1 - E.inOutSine(prog(t, 18.5, 0.65));
    const turn = (rotation(t) - rotation(T.genres)) * 0.42;
    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-P.x, -P.y);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    GENRES.forEach((word, i) => {
      const t0 = T.genres + i * BEAT;
      if (t < t0 - 0.15) return;
      const center = word.a * DEG - turn;
      const upper = Math.sin(word.a * DEG - 0.25) < 0;
      // orbit ring
      const ring = E.outCubic(prog(t, t0 - 0.12, 1.3));
      ctx.lineWidth = 1 / zoom;
      ctx.strokeStyle = `rgba(200,234,243,${0.16 * out})`;
      ctx.beginPath();
      ctx.arc(P.x, P.y, word.r, center - Math.PI, center - Math.PI + TAU * ring);
      ctx.stroke();
      // word
      const textR = word.r + (upper ? 30 : 30);
      ctx.font = EN_FONT;
      ctx.fillStyle = '#eef8fb';
      const reveal = j => E.outCubic(prog(t, t0 + 0.04 + j * 0.035, 0.75));
      const sweep = textOnArc(ctx, word.en, P, textR, center, upper, 0, 0.94 * out, reveal);
      // star marker before, Japanese label after
      const dir = upper ? 1 : -1;
      const ka = E.outCubic(prog(t, t0, 0.5));
      const ma = center - dir * (sweep / 2 + 22 / textR);
      sparkle(ctx, P.x + Math.cos(ma) * textR, P.y + Math.sin(ma) * textR, 9 * (0.6 + 0.4 * ka), ka * out);
      ctx.font = JA_FONT;
      ctx.fillStyle = '#a4dfeb';
      const jaW = ctx.measureText(word.ja).width + 4 * word.ja.length;
      const ja = center + dir * (sweep / 2 + (20 + jaW / 2) / textR);
      textOnArc(ctx, word.ja, P, textR, ja, upper, 4, 0.82 * out, j => E.outCubic(prog(t, t0 + 0.32 + j * 0.03, 0.6)));
    });
    ctx.restore();
  }

  /* ---------- Trajectory orbit and milestones ---------- */
  const PHI_START = 50 * DEG;
  const MILESTONE_PHI = [20, -40, -100, -160].map(d => d * DEG);
  const PHI_END = -220 * DEG;
  const msTime = i => 33.6 + i * BEAT;
  const orbitHead = t => keys(t, [
    [32.8, PHI_START], [msTime(0), MILESTONE_PHI[0]], [msTime(1), MILESTONE_PHI[1]], [msTime(2), MILESTONE_PHI[2]],
    [msTime(3), MILESTONE_PHI[3]], [msTime(4), PHI_END],
  ]);
  function drawOrbit(ctx, t, g, alpha, guideAlpha) {
    if (t < 32.2 || alpha <= 0.003) return;
    // faint guide of the whole orbit
    const guide = E.inOutCubic(prog(t, 32.2, 1.4));
    ctx.save();
    ctx.setLineDash([2, 7]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(200,234,243,${0.2 * guideAlpha})`;
    ctx.beginPath();
    for (let i = 0; i <= 160 * guide; i++) {
      const p = ringPoint(g, PHI_START - (i / 160) * TAU);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // travelled path
    const head = orbitHead(t), n = Math.max(2, Math.ceil(((PHI_START - head) / DEG) * 1.5));
    const path = new Path2D();
    for (let i = 0; i <= n; i++) {
      const p = ringPoint(g, lerp(PHI_START, head, i / n));
      i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(164,223,235,${0.16 * alpha})`;
    ctx.lineWidth = 7;
    ctx.stroke(path);
    ctx.strokeStyle = `rgba(232,247,251,${0.92 * alpha})`;
    ctx.lineWidth = 1.8;
    ctx.stroke(path);
    // moving head
    if (t > 32.8 && t < msTime(4) + 0.4) {
      const p = ringPoint(g, head);
      ctx.globalAlpha = alpha * (1 - prog(t, msTime(4), 0.4));
      ctx.drawImage(starSprites[0], p.x - 18, p.y - 18, 36, 36);
      ctx.globalAlpha = 1;
    }
    // milestone markers
    MILESTONE_PHI.forEach((phi, i) => {
      const k = prog(t, msTime(i), 1.2);
      if (k <= 0) return;
      const p = ringPoint(g, phi);
      ctx.strokeStyle = `rgba(164,223,235,${0.55 * (1 - k) * alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 + 40 * E.outCubic(k), 0, TAU);
      ctx.stroke();
      const pop = E.outCubic(prog(t, msTime(i), 0.35));
      ctx.fillStyle = `rgba(3,12,18,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8 * pop, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(232,247,251,${0.95 * alpha})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = `rgba(232,247,251,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2 * pop, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  }

  /* ---------- Logo assembly ---------- */
  const logoLayer = canvas(W, H);
  const bloomLayer = canvas(W / 4, H / 4);
  function drawLogo(ctx, t, g) {
    if (t < T.logo) return 0;
    const L = logoLayer.getContext('2d');
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, W, H);
    const zoom = E.outQuint(prog(t, T.logo, 2.1));
    const x0 = g.x - g.s * LOGO.ring.cx, y0 = g.y - g.s * LOGO.ring.cy, w = LOGO.w * g.s, h = LOGO.h * g.s;
    const clipY = (top, bottom) => {
      L.beginPath();
      L.rect(0, y0 + top * g.s, W, (bottom - top) * g.s);
      L.clip();
    };
    // ring: the orbit line hands over to the brush-drawn ring
    L.globalAlpha = smooth(0.55, 0.86, zoom);
    L.drawImage(images.ring, x0, y0, w, h);
    // dot: the pole star condenses into it
    const dotK = smooth(0.55, 0.92, zoom);
    if (dotK > 0) {
      const c = toScreen(g, LOGO.dot.x, LOGO.dot.y), sc = lerp(1.25, 1, E.outCubic(dotK));
      L.globalAlpha = dotK;
      L.drawImage(images.dot, c.x - (c.x - x0) * sc, c.y - (c.y - y0) * sc, w * sc, h * sc);
    }
    // bar rises through the ring
    const b1 = E.inOutCubic(prog(t, 39.3, 0.45)), b2 = E.outCubic(prog(t, 39.62, 0.7));
    L.globalAlpha = 1;
    if (b1 > 0) {
      L.save();
      clipY(LOGO.barBottom.y1 - (LOGO.barBottom.y1 - LOGO.barBottom.y0 + 4) * b1, LOGO.barBottom.y1 + 4);
      L.drawImage(images['bar-bottom'], x0, y0, w, h);
      L.restore();
    }
    if (b2 > 0) {
      L.save();
      clipY(LOGO.barTop.y1 - (LOGO.barTop.y1 - LOGO.barTop.y0 + 6) * b2, LOGO.barTop.y1 + 4);
      L.drawImage(images['bar-top'], x0, y0, w, h);
      L.restore();
    }
    // wordmark rises out of a baseline slot, letter by letter
    LOGO.letters.forEach((name, i) => {
      const k = E.outQuart(prog(t, 39.95 + i * 0.09, 1.05));
      if (k <= 0) return;
      L.save();
      clipY(96, 392);
      L.globalAlpha = E.outCubic(prog(t, 39.95 + i * 0.09, 0.6));
      L.drawImage(images[name], x0, y0 + (1 - k) * 300 * g.s, w, h);
      L.restore();
    });
    // tint to ice white, then a single light sweep
    L.globalAlpha = 1;
    L.globalCompositeOperation = 'source-atop';
    L.fillStyle = '#dcedf3';
    L.fillRect(0, 0, W, H);
    const sweep = prog(t, 42.1, 1.25);
    if (sweep > 0 && sweep < 1) {
      const cx = lerp(x0 - 260, x0 + w + 260, E.inOutSine(sweep));
      const sg = L.createLinearGradient(cx - 150, y0 - 60, cx + 150, y0 + h + 60);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,1)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      L.fillStyle = sg;
      L.fillRect(cx - 260, 0, 520, H);
    }
    L.globalCompositeOperation = 'source-over';
    // bloom
    const B = bloomLayer.getContext('2d');
    B.clearRect(0, 0, W / 4, H / 4);
    B.filter = 'blur(6px)';
    B.drawImage(logoLayer, 0, 0, W / 4, H / 4);
    B.filter = 'none';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.13 + 0.2 * Math.sin(Math.PI * sweep);
    ctx.drawImage(bloomLayer, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(logoLayer, 0, 0);
    ctx.restore();
    return zoom;
  }

  /* ---------- Background ---------- */
  function drawBackground(ctx, t, P) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#040a10');
    g.addColorStop(0.55, '#07161f');
    g.addColorStop(1, '#0b212e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, 980);
    const glowLevel = keys(t, [[T.logo, 1], [40.4, 0.6]]);
    glow.addColorStop(0, `rgba(30,84,104,${0.3 * glowLevel})`);
    glow.addColorStop(0.5, `rgba(22,60,80,${0.1 * glowLevel})`);
    glow.addColorStop(1, 'rgba(26,70,92,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    const horizon = win(t, T.passion, 33.2, 0.4, 1.6);
    if (horizon > 0) {
      const hg = ctx.createRadialGradient(W / 2, H * 0.92, 0, W / 2, H * 0.92, 1100);
      hg.addColorStop(0, `rgba(44,128,140,${0.34 * horizon})`);
      hg.addColorStop(1, 'rgba(44,128,140,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, W, H);
    }
    // the night itself fades up from black during the prologue
    const dark = 1 - E.inOutSine(prog(t, 0.4, 4.2));
    if (dark > 0) {
      ctx.fillStyle = `rgba(2,5,8,${0.92 * dark})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------- DOM helpers ---------- */
  const $ = id => document.getElementById(id);
  function splitChars(root) {
    const chars = [];
    const walk = node => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          for (const ch of child.textContent.replace(/\s*\n\s*/g, '')) {
            const span = document.createElement('span');
            span.className = 'c';
            span.textContent = ch;
            frag.appendChild(span);
            chars.push(span);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      }
    };
    walk(root);
    return chars;
  }
  const px = v => `${v.toFixed(2)}px`;
  function show(el, k, { dy = 16, dx = 0, blur = 8, scale = 0 } = {}) {
    const s = el.style;
    s.opacity = k.toFixed(4);
    s.visibility = k <= 0.001 ? 'hidden' : '';
    s.transform = `translate3d(${px((1 - k) * dx)}, ${px((1 - k) * dy)}, 0)${scale ? ` scale(${(1 + (1 - k) * scale).toFixed(4)})` : ''}`;
    s.filter = k >= 0.999 || !blur ? 'none' : `blur(${px((1 - k) * blur)})`;
  }
  // Per-character entrance: opacity eases gently, position settles with an expo curve.
  function charsIn(chars, t, start, { stagger = 0.05, dur = 1, dy = 16, blur = 10, scale = 0 } = {}) {
    chars.forEach((c, i) => {
      const p = prog(t, start + i * stagger, dur), a = E.outCubic(p), m = E.outExpo(p), s = c.style;
      s.opacity = a.toFixed(4);
      s.visibility = a <= 0.001 ? 'hidden' : '';
      s.transform = `translate3d(0, ${px((1 - m) * dy)}, 0)${scale ? ` scale(${(1 + (1 - m) * scale).toFixed(4)})` : ''}`;
      s.filter = a >= 0.999 ? 'none' : `blur(${px((1 - a) * blur)})`;
    });
  }
  // Group exit: fade with a slight lift and blur.
  function exit(el, k, lift = -12) {
    const s = el.style;
    s.opacity = (1 - k).toFixed(4);
    s.visibility = k >= 0.999 ? 'hidden' : '';
    s.transform = k > 0 ? `translate3d(0, ${px(k * lift)}, 0)` : 'none';
    s.filter = k > 0.001 ? `blur(${px(k * 6)})` : 'none';
  }

  let dom = null;
  function setupDom() {
    const q = (sel, root = document) => root.querySelector(sel);
    const captions = ['cap1', 'cap2', 'cap3'].map(id => ({ el: $(id), jp: splitChars(q('.jp', $(id))), en: q('.en', $(id)) }));
    const values = [...document.querySelectorAll('#values .value')].map(article => {
      const rule = document.createElement('span');
      rule.className = 'vrule';
      article.prepend(rule);
      return {
        rule, num: q('.num', article), glyph: q('.glyph', article),
        title: splitChars(q('h3', article)), en: q('.en', article), body: q('.body', article),
      };
    });
    dom = {
      hud: $('hud'), hudNo: $('hudNo'), hudName: $('hudName'), hudCoord: $('hudCoord'), hudChapter: q('.hud-chapter'),
      captions,
      tagline: $('tagline'), tagCols: [...document.querySelectorAll('#tagline .col')].map(splitChars), tagEn: q('#tagline .en'),
      values: $('values'), valuesEyebrow: q('#values .eyebrow'), valueCols: values,
      trajectory: $('trajectory'), trajMono: q('.traj-title .mono'), trajTitle: splitChars(q('.traj-title h2')), trajEn: q('.traj-title .en'),
      milestones: [0, 1, 2, 3, 4].map(i => $(`ms${i}`)),
      logoSub: $('logoSub'), logoSubJp: splitChars(q('#logoSub .jp')), logoSubMono: q('#logoSub .mono'),
      join: $('join'), joinTitle: splitChars(q('#join h2')), joinEn: q('#join .en'), joinRule: q('#join .rule'),
      joinItems: [...document.querySelectorAll('#join .join-item')],
      flash: $('flash'), fade: $('fade'),
    };
  }

  const CHAPTERS = [
    [0, '01', 'PROLOGUE'], [T.orbit, '02', 'ORBIT'], [T.genres, '03', 'GENRES'], [T.passion, '04', 'PASSION'],
    [T.values, '05', 'VALUES'], [T.trajectory, '06', 'TRAJECTORY'], [T.logo, '07', 'POLAR'],
  ];
  function updateHud(t, rot) {
    const vis = win(t, 1.4, 38.7, 1.4, 0.7);
    dom.hud.style.opacity = vis.toFixed(4);
    let i = 0;
    while (i + 1 < CHAPTERS.length && t >= CHAPTERS[i + 1][0]) i++;
    const start = CHAPTERS[i][0], end = i + 1 < CHAPTERS.length ? CHAPTERS[i + 1][0] : DURATION;
    dom.hudNo.textContent = CHAPTERS[i][1];
    dom.hudName.textContent = CHAPTERS[i][2];
    const k = Math.min(E.outCubic(prog(t, start + 0.05, 0.5)), 1 - prog(t, end - 0.25, 0.25));
    show(dom.hudChapter, k, { dy: 0, dx: -10, blur: 0 });
    const ra = (((2.53 + (rot / TAU) * 24) % 24) + 24) % 24;
    const hh = Math.floor(ra), mm = Math.floor((ra - hh) * 60), ss = Math.floor(((ra - hh) * 60 - mm) * 60);
    const pad = n => String(n).padStart(2, '0');
    dom.hudCoord.textContent = `RA ${pad(hh)}h ${pad(mm)}m ${pad(ss)}s · DEC +89° 15′ 51″`;
  }

  function updateText(t) {
    // Prologue captions
    const CAP = [[2.3, 3.25, 6.3], [7.0, 7.95, 12.5], [16.0, 16.85, 18.95]];
    dom.captions.forEach((cap, i) => {
      const [tin, ten, tout] = CAP[i];
      const visible = t > tin - 0.1 && t < tout + 0.05;
      cap.el.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) return;
      charsIn(cap.jp, t, tin, { stagger: i === 2 ? 0.045 : 0.06, dur: 1.1, dy: 14, blur: 9 });
      show(cap.en, E.outCubic(prog(t, ten, 1.1)), { dy: 10, blur: 6 });
      exit(cap.el, E.inOutSine(prog(t, tout - 0.6, 0.6)));
    });

    // Tagline
    {
      const visible = t > T.passion && t < T.values + 0.05;
      dom.tagline.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) {
        charsIn(dom.tagCols[0], t, 19.65, { stagger: 0.11, dur: 1.2, dy: -26, blur: 16, scale: 0.12 });
        charsIn(dom.tagCols[1], t, 20.3, { stagger: 0.11, dur: 1.2, dy: -26, blur: 16, scale: 0.12 });
        const en = E.outCubic(prog(t, 21.3, 1.6));
        show(dom.tagEn, en, { dy: 10, blur: 6 });
        dom.tagEn.style.letterSpacing = `${lerp(0.3, 0.06, E.outExpo(prog(t, 21.3, 2.2))).toFixed(4)}em`;
        exit(dom.tagline, E.inOutSine(prog(t, 24.95, 0.6)), -18);
      }
    }

    // Values
    {
      const visible = t > 25.6 && t < 32.05;
      dom.values.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) {
        show(dom.valuesEyebrow, E.outCubic(prog(t, 25.85, 0.9)), { dy: 0, dx: -18, blur: 4 });
        dom.valueCols.forEach((col, i) => {
          const t0 = 26.4 + i * BEAT;
          const r = E.outExpo(prog(t, t0 - 0.15, 1.2));
          col.rule.style.transform = `scaleY(${r.toFixed(4)})`;
          col.rule.style.opacity = r > 0 ? '1' : '0';
          show(col.num, E.outCubic(prog(t, t0, 1)), { dy: 34, blur: 10 });
          show(col.glyph, E.outCubic(prog(t, t0 + 0.14, 0.7)), { dy: 0, blur: 0, scale: 1.4 });
          charsIn(col.title, t, t0 + 0.18, { stagger: 0.045, dur: 0.9, dy: 16, blur: 8 });
          show(col.en, E.outCubic(prog(t, t0 + 0.5, 0.9)), { dy: 10, blur: 5 });
          show(col.body, E.outCubic(prog(t, t0 + 0.66, 1)), { dy: 12, blur: 6 });
        });
        exit(dom.values, E.inOutSine(prog(t, 31.35, 0.6)), -14);
      }
    }

    // Trajectory
    {
      const visible = t > 32.1 && t < 38.95;
      dom.trajectory.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) {
        show(dom.trajMono, E.outCubic(prog(t, 32.3, 0.8)), { dy: 0, dx: -16, blur: 3 });
        charsIn(dom.trajTitle, t, 32.45, { stagger: 0.05, dur: 1, dy: 16, blur: 9 });
        show(dom.trajEn, E.outCubic(prog(t, 33.3, 1)), { dy: 10, blur: 5 });
        const g = group(t);
        const anchors = [
          ...MILESTONE_PHI.map(phi => ringPoint(g, phi)),
          toScreen(g, LOGO.dot.x, LOGO.dot.y),
        ];
        // [dx, dy, right-aligned]
        const OFFSETS = [[30, 16, false], [-12, 26, false], [28, 16, false], [-26, 16, true], [-56, -28, true]];
        dom.milestones.forEach((el, i) => {
          const [ox, oy, right] = OFFSETS[i], p = anchors[i];
          el.classList.toggle('right', right);
          const width = right ? el.offsetWidth : 0;
          el.style.left = px(p.x + ox - width);
          el.style.top = px(p.y + oy);
          show(el, E.outCubic(prog(t, msTime(i) + 0.06, 0.8)), { dy: 0, dx: right ? 16 : -16, blur: 6 });
        });
        exit(dom.trajectory, E.inOutSine(prog(t, 38.25, 0.6)), 0);
      }
    }

    // Logo subtitle
    {
      const visible = t > 40.9 && t < 45.3;
      dom.logoSub.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) {
        charsIn(dom.logoSubJp, t, 41.0, { stagger: 0.035, dur: 0.9, dy: 0, blur: 8 });
        show(dom.logoSubMono, E.outCubic(prog(t, 41.7, 1.1)), { dy: 0, blur: 4 });
        dom.logoSubMono.style.letterSpacing = `${lerp(0.7, 0.36, E.outExpo(prog(t, 41.7, 2))).toFixed(4)}em`;
        exit(dom.logoSub, E.inOutSine(prog(t, 44.7, 0.5)), -8);
      }
    }

    // Call to action
    {
      const visible = t > 45.5;
      dom.join.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) {
        charsIn(dom.joinTitle, t, 45.7, { stagger: 0.05, dur: 1.1, dy: 18, blur: 10 });
        show(dom.joinEn, E.outCubic(prog(t, 46.6, 1.1)), { dy: 10, blur: 5 });
        const r = E.outExpo(prog(t, 46.95, 1.4));
        dom.joinRule.style.transform = `scaleX(${r.toFixed(4)})`;
        dom.joinItems.forEach((el, i) => show(el, E.outCubic(prog(t, 47.25 + i * 0.16, 0.9)), { dy: 14, blur: 6 }));
      }
    }

    // Flash and fade
    let flash = 0;
    if (t > 0.55) flash = Math.max(flash, 0.12 * Math.exp(-(t - 0.55) / 0.3));
    if (t > 18.85 && t < T.passion) flash = Math.max(flash, 0.6 * E.inCubic(prog(t, 18.85, 0.35)));
    if (t >= T.passion) flash = Math.max(flash, 0.95 * Math.exp(-(t - T.passion) / 0.18));
    if (t >= T.logo) flash = Math.max(flash, 0.32 * Math.exp(-(t - T.logo) / 0.3));
    dom.flash.style.opacity = flash.toFixed(4);
    dom.fade.style.opacity = E.inOutSine(prog(t, 50.35, 0.85)).toFixed(4);
  }

  /* ---------- Film grain ---------- */
  let grainFrames = null;
  function setupGrain() {
    const ctx = $('grain').getContext('2d'), rand = mulberry32(7);
    grainFrames = [0, 1, 2, 3].map(() => {
      const img = ctx.createImageData(960, 540), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (rand() + rand() + rand() - 1.5) * 52;
        d[i] = d[i + 1] = d[i + 2] = 128 + n;
        d[i + 3] = 255;
      }
      return img;
    });
  }
  function updateGrain(t) {
    $('grain').getContext('2d').putImageData(grainFrames[Math.floor(t * 24) % 4], 0, 0);
  }

  /* ---------- Frame ---------- */
  const sky = $('sky').getContext('2d');
  function render(t) {
    t = clamp(t, 0, DURATION);
    const ctx = sky, rot = rotation(t), P = pole(t), SP = skyPole(t);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    drawBackground(ctx, t, SP);

    // nebula haze, turning with the sky
    ctx.save();
    ctx.translate(SP.x, SP.y);
    ctx.rotate(-rot);
    ctx.globalAlpha = 0.42 * E.inOutSine(prog(t, 1, 4));
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(nebula, -1800, -1800, 3600, 3600);
    ctx.restore();

    const push = t < T.passion ? 1 + 0.5 * E.inCubic(prog(t, 18.4, 0.8)) : 1;
    drawStars(ctx, t, SP, rot, push);
    drawChart(ctx, t, P, rot);

    // pole star
    let starSize = 0, starAlpha = 0;
    if (t < T.passion) {
      const ignite = E.outExpo(prog(t, 0.55, 0.7));
      const settle = E.inOutSine(prog(t, 1.2, 1.6));
      starSize = 300 * lerp(ignite * 1.5, 1, settle) * (1 + 0.035 * Math.sin(t * 2.1)) * push ** 1.6;
      starAlpha = ignite * (1 + 0.6 * E.inCubic(prog(t, 18.4, 0.8)));
    } else if (t > 31.8) {
      const zoom = t > T.logo ? E.outQuint(prog(t, T.logo, 2.1)) : 0;
      starSize = lerp(260, 150, zoom) * (t > T.logo ? Math.min(1, group(t).s / G_LOGO.s) : 1);
      starAlpha = E.outCubic(prog(t, 32.6, 1.2)) * lerp(1, 0.4, zoom) * (t > T.join ? lerp(1, 0.7, prog(t, T.join, 1.5)) : 1);
    }
    drawPoleStar(ctx, P.x, P.y, starSize, starAlpha);

    // anamorphic streak at ignition
    const streak = t > 0.55 ? Math.exp(-(t - 0.75) / 1.6) * E.outExpo(prog(t, 0.55, 0.4)) : 0;
    if (streak > 0.003 && t < T.orbit) {
      const len = 1300 * E.outExpo(prog(t, 0.55, 0.9));
      const g = ctx.createLinearGradient(P.x - len, 0, P.x + len, 0);
      g.addColorStop(0, 'rgba(164,223,235,0)');
      g.addColorStop(0.5, `rgba(226,248,253,${0.55 * streak})`);
      g.addColorStop(1, 'rgba(164,223,235,0)');
      ctx.fillStyle = g;
      ctx.fillRect(P.x - len, P.y - 0.8, len * 2, 1.6);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(P.x - len, P.y - 4, len * 2, 8);
      ctx.globalAlpha = 1;
      const ring = prog(t, 0.55, 1.4);
      if (ring < 1) {
        ctx.strokeStyle = `rgba(200,236,245,${0.35 * (1 - ring)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(P.x, P.y, 12 + 420 * E.outCubic(ring), 0, TAU);
        ctx.stroke();
      }
    }

    drawGenres(ctx, t, P, rot, push);

    // aurora and the horizon
    const ridgeDy = ridgeOffset(t);
    const auroraLevel = keys(t, [[T.passion - 0.001, 0], [T.passion, 0.35], [21.2, 1, E.outCubic], [T.values, 1], [26.4, 0.7], [31.8, 0.7], [33.4, 0, E.inOutCubic]]);
    drawAurora(ctx, t, auroraLevel, Math.max(0, ridgeDy) * 0.55);
    drawRidge(ctx, ridgeDy);

    // legibility veils for the tagline and the values
    const tagVeil = win(t, T.passion, 25.6, 1, 0.6);
    if (tagVeil > 0) {
      const vg = ctx.createRadialGradient(960, 520, 0, 960, 520, 560);
      vg.addColorStop(0, `rgba(2,8,13,${0.42 * tagVeil})`);
      vg.addColorStop(1, 'rgba(2,8,13,0)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
    const valuesVeil = win(t, 25.4, 32.2, 1, 1);
    if (valuesVeil > 0) {
      ctx.fillStyle = `rgba(2,8,13,${0.38 * valuesVeil})`;
      ctx.fillRect(0, 0, W, H);
    }

    // trajectory orbit, then the logo
    const g = group(t);
    const zoom = t > T.logo ? E.outQuint(prog(t, T.logo, 2.1)) : 0;
    const orbitAlpha = (1 - smooth(0.5, 0.82, zoom)) * win(t, 32.2, DURATION, 0.4, 0.01);
    drawOrbit(ctx, t, g, orbitAlpha, orbitAlpha * (1 - smooth(0, 0.3, zoom)));
    drawLogo(ctx, t, g);
    ctx.restore();

    updateHud(t, rot);
    updateText(t);
    updateGrain(t);
  }

  /* ---------- Boot ---------- */
  const params = new URLSearchParams(location.search);
  const renderMode = params.has('render');
  if (renderMode) document.documentElement.classList.add('is-render');
  setupDom();
  setupGrain();
  if (params.has('nograin')) $('grain').style.display = 'none';

  const fontsReady = (async () => {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load(EN_FONT, GENRES.map(g => g.en).join('')),
      document.fonts.load(JA_FONT, GENRES.map(g => g.ja).join('')),
      document.fonts.load('400 11px "IBM Plex Mono"', '0h6h12h18h'),
    ]);
    await document.fonts.ready;
  })();
  const ready = Promise.all([fontsReady, imageReady]);

  function fit() {
    const stage = $('stage');
    if (renderMode) { stage.style.transform = 'none'; return; }
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  }
  addEventListener('resize', fit);
  fit();

  window.__polar = { duration: DURATION, ready, render };

  ready.then(() => {
    render(Number(params.get('t')) || 0);
    if (renderMode) return;
    $('play').addEventListener('click', () => {
      document.documentElement.classList.add('is-playing');
      const audio = new Audio('assets/score.m4a');
      const startedAt = performance.now();
      let audioOk = true;
      audio.play().catch(() => { audioOk = false; });
      const tick = () => {
        const t = audioOk && audio.currentTime > 0 ? audio.currentTime : (performance.now() - startedAt) / 1000;
        render(t);
        if (t < DURATION) requestAnimationFrame(tick);
        else document.documentElement.classList.remove('is-playing');
      };
      requestAnimationFrame(tick);
    });
  });
})();
