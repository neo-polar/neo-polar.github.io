/* Polar promotion film — YouTube thumbnail.
 * The same night as the film, framed for a small screen: star trails turn around the
 * dot of the logo, an aurora rises over the ice ridge on the right. Deterministic. */
(() => {
  'use strict';

  const W = 1280, H = 720, TAU = Math.PI * 2, DEG = Math.PI / 180;
  const DPR = window.devicePixelRatio || 1;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
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

  // Logo: 1870×446 parts from promo/assets, drawn 800 px wide; the dot is the celestial pole.
  const LOGO = { w: 1870, h: 446, scale: 800 / 1870, x: 240, y: 146, dot: { x: 312.5, y: 126 } };
  const PARTS = ['ring', 'dot', 'bar-top', 'bar-bottom', 'P', 'O', 'L', 'A', 'R'];
  const POLE = { x: LOGO.x + LOGO.dot.x * LOGO.scale, y: LOGO.y + LOGO.dot.y * LOGO.scale };
  const images = {};
  const imagesReady = Promise.all(PARTS.map(name => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = () => reject(new Error(`missing assets/logo-${name}.png`));
    img.src = `assets/logo-${name}.png`;
    images[name] = img;
  })));

  const sky = document.getElementById('sky');
  sky.width = W * DPR;
  sky.height = H * DPR;
  const ctx = sky.getContext('2d');
  ctx.scale(DPR, DPR);

  function background() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#040a11');
    g.addColorStop(0.6, '#071824');
    g.addColorStop(1, '#0c2633');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(POLE.x, POLE.y, 0, POLE.x, POLE.y, 760);
    glow.addColorStop(0, 'rgba(46,118,142,0.5)');
    glow.addColorStop(0.45, 'rgba(26,74,96,0.18)');
    glow.addColorStop(1, 'rgba(26,74,96,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    // milky haze along a band through the pole
    const rand = mulberry32(90);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'blur(18px)';
    for (let i = 0; i < 46; i++) {
      const k = rand() - 0.5, along = k * 1500, across = (rand() - 0.5) * 140 * (1 - Math.abs(k));
      const px = POLE.x + along * 0.86 + across * 0.5, py = POLE.y + along * 0.5 - across * 0.86;
      const rr = 30 + rand() * 90, col = rand() < 0.2 ? '74,72,140' : rand() < 0.5 ? '40,108,128' : '36,74,118';
      const rg = ctx.createRadialGradient(px, py, 0, px, py, rr);
      rg.addColorStop(0, `rgba(${col},${0.08 + rand() * 0.08})`);
      rg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = rg;
      ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  }

  const TINTS = [[232, 246, 255], [164, 223, 235], [255, 214, 176], [206, 202, 255]];
  const sprites = TINTS.map(([r, g, b]) => {
    const c = canvas(64, 64), x = c.getContext('2d'), rg = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.1, `rgba(${r},${g},${b},0.95)`);
    rg.addColorStop(0.22, `rgba(${r},${g},${b},0.35)`);
    rg.addColorStop(0.5, `rgba(${r},${g},${b},0.07)`);
    rg.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = rg;
    x.fillRect(0, 0, 64, 64);
    return c;
  });

  function starTrails() {
    const rand = mulberry32(20261008), span = 64 * DEG;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2100; i++) {
      const u = rand(), m = rand() ** 2.4;
      const r = 26 + 1150 * Math.sqrt(rand()), head = rand() * TAU;
      const size = 0.7 + m * 2.2, alpha = clamp((0.24 + m * 0.76) * smooth(20, 90, r));
      const [cr, cg, cb] = TINTS[u < 0.72 ? 0 : u < 0.87 ? 1 : u < 0.94 ? 2 : 3];
      const grad = ctx.createConicGradient(head, POLE.x, POLE.y);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${(alpha * 0.9).toFixed(3)})`);
      grad.addColorStop(span / TAU, `rgba(${cr},${cg},${cb},0)`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = size * 0.85;
      ctx.beginPath();
      ctx.arc(POLE.x, POLE.y, r, head, head + span);
      ctx.stroke();
      const d = size * 7;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprites[u < 0.72 ? 0 : u < 0.87 ? 1 : u < 0.94 ? 2 : 3], POLE.x + Math.cos(head) * r - d / 2, POLE.y + Math.sin(head) * r - d / 2, d, d);
      ctx.globalAlpha = 1;
    }
  }

  function aurora() {
    const AW = 640, AH = 360, a = canvas(AW, AH), x = a.getContext('2d');
    const strip = canvas(1, 256), s = strip.getContext('2d'), g = s.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(143,164,244,0)');
    g.addColorStop(0.3, 'rgba(143,164,244,0.18)');
    g.addColorStop(0.6, 'rgba(73,198,214,0.5)');
    g.addColorStop(0.88, 'rgba(110,236,200,0.95)');
    g.addColorStop(0.95, 'rgba(172,255,226,1)');
    g.addColorStop(1, 'rgba(172,255,226,0)');
    s.fillStyle = g;
    s.fillRect(0, 0, 1, 256);
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < AW; i++) {
      const u = i / AW, t = 3.1;
      const yb = (0.8 - 0.07 * u + 0.035 * Math.sin(u * 5.3 + 1.2) + 0.012 * Math.sin(u * 13 + t)) * AH;
      const r1 = 0.5 + 0.5 * Math.sin(u * 160 + 5 * Math.sin(u * 9 + t));
      const r2 = 0.5 + 0.5 * Math.sin(u * 370 + 3 * Math.sin(u * 19 - t));
      const ray = 0.3 + 0.7 * (r1 * 0.65 + r2 * 0.35) ** 2;
      const fold = 0.5 + 0.5 * Math.sin(u * 6.1 + 0.7);
      const h = AH * 0.34 * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(u * 12 + 1.9)));
      x.globalAlpha = clamp(0.95 * (0.3 + 0.7 * fold) * ray * smooth(0.38, 0.78, u));
      x.drawImage(strip, 0, 0, 1, 256, i, yb - h, 1.3, h);
    }
    const glow = canvas(160, 90);
    glow.getContext('2d').drawImage(a, 0, 0, 160, 90);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(glow, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.drawImage(a, 0, 0, W, H);
    ctx.restore();
  }

  function ridge() {
    const back = [[0, 0.87], [0.07, 0.84], [0.14, 0.855], [0.21, 0.81], [0.28, 0.835], [0.36, 0.8], [0.44, 0.83], [0.52, 0.815], [0.6, 0.84], [0.68, 0.8], [0.76, 0.825], [0.84, 0.785], [0.92, 0.815], [1, 0.79]];
    const front = [[0, 0.915], [0.06, 0.895], [0.12, 0.905], [0.19, 0.87], [0.26, 0.89], [0.33, 0.862], [0.41, 0.892], [0.5, 0.91], [0.58, 0.885], [0.66, 0.898], [0.74, 0.858], [0.81, 0.878], [0.88, 0.85], [0.95, 0.875], [1, 0.86]];
    const path = pts => {
      ctx.beginPath();
      ctx.moveTo(-10, H + 10);
      for (const [u, v] of pts) ctx.lineTo(u * W, v * H);
      ctx.lineTo(W + 10, H + 10);
      ctx.closePath();
    };
    let g = ctx.createLinearGradient(0, 0.78 * H, 0, H);
    g.addColorStop(0, '#0f2837');
    g.addColorStop(1, '#06121a');
    ctx.fillStyle = g;
    path(back);
    ctx.fill();
    g = ctx.createLinearGradient(0, 0.84 * H, 0, H);
    g.addColorStop(0, '#08151d');
    g.addColorStop(1, '#020508');
    ctx.fillStyle = g;
    path(front);
    ctx.fill();
    const rim = ctx.createLinearGradient(0, 0, W, 0);
    rim.addColorStop(0, 'rgba(200,236,245,0)');
    rim.addColorStop(0.3, 'rgba(200,236,245,0.32)');
    rim.addColorStop(0.75, 'rgba(200,236,245,0.32)');
    rim.addColorStop(1, 'rgba(200,236,245,0)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    front.forEach(([u, v], i) => (i ? ctx.lineTo(u * W, v * H) : ctx.moveTo(u * W, v * H)));
    ctx.stroke();
  }

  function veil() {
    // keeps the tagline legible over the brightest trails
    ctx.save();
    ctx.translate(W / 2, 470);
    ctx.scale(1, 0.26);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 640);
    g.addColorStop(0, 'rgba(2,8,13,0.62)');
    g.addColorStop(0.6, 'rgba(2,8,13,0.34)');
    g.addColorStop(1, 'rgba(2,8,13,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-640, -640, 1280, 1280);
    ctx.restore();
  }

  function logo() {
    const L = canvas(W * DPR, H * DPR), l = L.getContext('2d');
    l.scale(DPR, DPR);
    const w = LOGO.w * LOGO.scale, h = LOGO.h * LOGO.scale;
    for (const name of PARTS) l.drawImage(images[name], LOGO.x, LOGO.y, w, h);
    l.globalCompositeOperation = 'source-atop';
    const tint = l.createLinearGradient(0, LOGO.y, 0, LOGO.y + h);
    tint.addColorStop(0, '#f4fbfd');
    tint.addColorStop(1, '#d6eaf1');
    l.fillStyle = tint;
    l.fillRect(0, 0, W, H);
    // the pole star shining behind its dot
    const halo = ctx.createRadialGradient(POLE.x, POLE.y, 0, POLE.x, POLE.y, 150);
    halo.addColorStop(0, 'rgba(220,246,252,0.55)');
    halo.addColorStop(0.25, 'rgba(164,223,235,0.22)');
    halo.addColorStop(1, 'rgba(164,223,235,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = halo;
    ctx.fillRect(POLE.x - 150, POLE.y - 150, 300, 300);
    ctx.restore();
    // soft bloom, then the crisp mark
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.32;
    ctx.filter = 'blur(16px)';
    ctx.drawImage(L, 0, 0, W, H);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = 'rgba(2,8,13,0.55)';
    ctx.shadowBlur = 24;
    ctx.drawImage(L, 0, 0, W, H);
    ctx.restore();
  }

  function vignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, 'rgba(0,3,6,0)');
    g.addColorStop(1, 'rgba(0,3,6,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const ready = (async () => {
    await document.fonts.ready;
    await imagesReady;
    background();
    starTrails();
    aurora();
    ridge();
    vignette();
    veil();
    logo();
    await document.fonts.ready;
  })();
  window.__thumb = { ready };
})();
