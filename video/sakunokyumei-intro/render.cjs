#!/usr/bin/env node
/* scene.html を Chromium（Playwright）で1フレームずつ撮影し、ffmpeg で MP4 にします。
 *
 *   node render.cjs                    動画（build/music.wav があれば音声も合成）
 *   node render.cjs --stills 5,20,40   指定秒の静止画を build/still-*.png に保存
 *   node render.cjs --thumb            サムネイル（1280×720 JPEG）
 *
 * 必要なもの: Node.js、Playwright（グローバル導入でも可）、ffmpeg。
 * フォントは Google Fonts から読み込むため、ネットワーク接続が必要です。 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  }
}

const DIR = __dirname;
const BUILD = path.join(DIR, 'build');
const FPS = 30;
const OUT = path.join(DIR, 'sakunokyumei-channel-intro.mp4');
const THUMB = path.join(DIR, 'thumbnail.jpg');

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : args[i + 1] ?? '';
};

function run(cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

async function openScene(browser, search) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => console.error('page error:', error.message));
  await page.goto('file://' + path.join(DIR, 'scene.html') + search);
  await page.evaluate(() => window.SCENE.ready);
  return page;
}

async function capture(client) {
  const { data } = await client.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

async function renderVideo(browser) {
  const page = await openScene(browser, '?render');
  const client = await page.context().newCDPSession(page);
  const duration = await page.evaluate(() => window.SCENE.duration);
  const frames = Math.round(duration * FPS);
  const silent = path.join(BUILD, 'video.mp4');

  const ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.2',
    '-g', String(FPS), '-bf', '2',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    silent,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });

  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.SCENE.render(t), f / FPS);
    const png = await capture(client);
    if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
    if (f % FPS === 0) {
      const s = (Date.now() - started) / 1000;
      process.stdout.write(`\rframe ${f}/${frames}  ${s.toFixed(0)}s`);
    }
  }
  ffmpeg.stdin.end();
  await done;
  process.stdout.write('\n');

  const music = path.join(BUILD, 'music.wav');
  if (fs.existsSync(music)) {
    await run('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', silent, '-i', music,
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2',
      '-shortest', '-movflags', '+faststart', OUT,
    ]);
  } else {
    console.warn('build/music.wav がないため無音で書き出します（python3 music.py で生成）。');
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-c', 'copy', '-movflags', '+faststart', OUT]);
  }
  console.log('wrote', path.relative(process.cwd(), OUT));
}

async function renderStills(browser, times) {
  const page = await openScene(browser, '?render');
  for (const t of times) {
    await page.evaluate((s) => window.SCENE.render(s), t);
    const file = path.join(BUILD, `still-${String(t).replace('.', '_')}.png`);
    await page.screenshot({ path: file });
    console.log('wrote', path.relative(process.cwd(), file));
  }
}

async function renderThumb(browser) {
  const page = await openScene(browser, '?thumb');
  await page.evaluate(() => window.SCENE.renderThumb());
  const png = path.join(BUILD, 'thumbnail-1920.png');
  await page.screenshot({ path: png });
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', THUMB]);
  console.log('wrote', path.relative(process.cwd(), THUMB));
}

(async () => {
  fs.mkdirSync(BUILD, { recursive: true });
  const { chromium } = loadPlaywright();
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  try {
    if (args.includes('--thumb')) await renderThumb(browser);
    else if (option('--stills') !== null) await renderStills(browser, option('--stills').split(',').map(Number));
    else await renderVideo(browser);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
