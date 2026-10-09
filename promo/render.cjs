#!/usr/bin/env node
// Renders the Polar promotion film (promo/index.html) frame by frame with headless
// Chromium and encodes it with ffmpeg.
//
//   node promo/render.cjs stills 2.5 9 21 ...        PNG stills → promo/build/stills/
//   node promo/render.cjs video [--fps 60] [--workers 4] [--from 0] [--to 51.2]
//                                                   → promo/build/frames-*.mkv (lossless chunks)
//   node promo/render.cjs thumbnail                  → promo/dist/polar-promo-thumbnail.{png,jpg}
//
// Needs Playwright (npm i -g playwright, or NODE_PATH pointing at it) and ffmpeg.
// The page loads its typefaces from Google Fonts; HTTPS_PROXY is honoured when set.
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const ROOT = __dirname;
const BUILD = path.join(ROOT, 'build');
const PAGE = pathToFileURL(path.join(ROOT, 'index.html')).href;

function option(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

async function openPage(extra = '') {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({
    proxy: proxy ? { server: proxy } : undefined,
    args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => console.error('page error:', error.message));
  await page.goto(`${PAGE}?render${extra}`, { waitUntil: 'load' });
  await page.evaluate(() => window.__polar.ready);
  const cdp = await page.context().newCDPSession(page);
  const capture = async t => {
    await page.evaluate(time => new Promise(resolve => {
      window.__polar.render(time);
      requestAnimationFrame(() => resolve());
    }), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
    return Buffer.from(data, 'base64');
  };
  const duration = await page.evaluate(() => window.__polar.duration);
  return { browser, capture, duration };
}

async function stills(times, extra) {
  const dir = path.join(BUILD, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  const { browser, capture } = await openPage(extra);
  for (const t of times) {
    const file = path.join(dir, `t${Number(t).toFixed(2).padStart(6, '0')}.png`);
    fs.writeFileSync(file, await capture(Number(t)));
    console.log(file);
  }
  await browser.close();
}

function encoder(file, fps) {
  const ff = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264rgb', '-qp', '0', '-preset', 'ultrafast', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', code => (code ? reject(new Error(`ffmpeg exited ${code}`)) : resolve())));
  return { ff, done };
}

async function video(args, extra) {
  const fps = Number(option(args, 'fps', 60));
  const workers = Number(option(args, 'workers', 4));
  fs.mkdirSync(BUILD, { recursive: true });
  const probe = await openPage(extra);
  const duration = probe.duration;
  await probe.browser.close();
  const from = Math.round(Number(option(args, 'from', 0)) * fps);
  const to = Math.round(Number(option(args, 'to', duration)) * fps);
  const total = to - from, per = Math.ceil(total / workers);
  const started = Date.now();
  let rendered = 0;
  const chunks = [];
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const first = from + w * per, last = Math.min(to, first + per);
    if (first >= last) return;
    const file = path.join(BUILD, `frames-${String(w).padStart(2, '0')}.mkv`);
    chunks[w] = file;
    const { browser, capture } = await openPage(extra);
    const { ff, done } = encoder(file, fps);
    for (let f = first; f < last; f++) {
      const png = await capture(f / fps);
      if (!ff.stdin.write(png)) await new Promise(resolve => ff.stdin.once('drain', resolve));
      rendered++;
      if (rendered % 60 === 0) {
        const s = (Date.now() - started) / 1000;
        console.log(`${rendered}/${total} frames  ${(rendered / s).toFixed(1)} fps  eta ${((total - rendered) / (rendered / s)).toFixed(0)} s`);
      }
    }
    ff.stdin.end();
    await done;
    await browser.close();
  }));
  fs.writeFileSync(path.join(BUILD, 'frames.txt'), chunks.filter(Boolean).map(f => `file '${path.basename(f)}'`).join('\n') + '\n');
  console.log(`rendered ${total} frames in ${((Date.now() - started) / 1000).toFixed(0)} s → ${path.join(BUILD, 'frames.txt')}`);
}

// YouTube thumbnail: drawn at 2× and downsampled for clean edges, 1280×720 and under 2 MB.
async function thumbnail() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ proxy: proxy ? { server: proxy } : undefined, args: ['--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  page.on('pageerror', error => console.error('page error:', error.message));
  await page.goto(pathToFileURL(path.join(ROOT, 'thumbnail.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => window.__thumb.ready);
  fs.mkdirSync(BUILD, { recursive: true });
  const raw = path.join(BUILD, 'thumbnail@2x.png');
  await page.screenshot({ path: raw });
  await browser.close();
  const dist = path.join(ROOT, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  for (const [file, quality] of [['polar-promo-thumbnail.png', []], ['polar-promo-thumbnail.jpg', ['-q:v', '2']]]) {
    await new Promise((resolve, reject) => spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw,
      '-vf', 'scale=1280:720:flags=lanczos', ...quality, path.join(dist, file)], { stdio: 'inherit' })
      .on('close', code => (code ? reject(new Error(`ffmpeg exited ${code}`)) : resolve())));
    console.log(path.join(dist, file));
  }
}

(async () => {
  const [mode, ...args] = process.argv.slice(2);
  const extra = args.includes('--nograin') ? '&nograin' : '';
  const rest = args.filter(a => a !== '--nograin');
  if (mode === 'stills') await stills(rest, extra);
  else if (mode === 'video') await video(rest, extra);
  else if (mode === 'thumbnail') await thumbnail();
  else {
    console.error('usage: render.cjs stills <t...> | video [--fps 60] [--workers 4] [--from s] [--to s] [--nograin] | thumbnail');
    process.exit(2);
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
