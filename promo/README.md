# Polar プロモーション映像

Polar 公式アカウントで告知に使うプロモーション映像の制作ソースです。

- 書き出し: `dist/polar-promo-1080p60.mp4`（1920×1080 / 60fps / H.264 + AAC / 51.2秒）
- YouTube サムネイル: `dist/polar-promo-thumbnail.png`（1280×720、2MB未満。`.jpg` も同じ絵柄）
- 映像・音楽ともにこのフォルダのコードから生成しています。音楽もオリジナルなので、権利関係を気にせず投稿できます。

## コンセプト

「すべての星は、ひとつの点を中心に巡る」。

ジャンルの違う人たちが集まる Polar を、北極星とそのまわりを巡る星になぞらえました。
冒頭で灯る北極星が、最後にロゴのドットになり、軌跡を描いた軌道がロゴのリングになる、という一本の流れで構成しています。
色はサイトと同じ極夜の濃紺と氷の白で、「熱意」の文字だけに暖色を差しています。

## 構成（75 BPM・1小節 3.2秒）

| 時間 | シーン | 内容 |
| --- | --- | --- |
| 0.0–6.4 | 01 PROLOGUE | 北極星が灯り、星図の線が広がる。「夜空のすべての星は、」 |
| 6.4–12.8 | 02 ORBIT | 星が巡り、光跡が伸びる。「ひとつの点を中心に、巡っている。」 |
| 12.8–19.2 | 03 GENRES | Music / Video / Illustration / Writing / Programming が拍ごとに軌道へ。「ジャンルの違う光が、ひとつの場所に集う。」 |
| 19.2–25.6 | 04 PASSION | フラッシュで極地の地平線へ。オーロラと縦組みのタグライン「熱意で知を研ぎ澄ます」 |
| 25.6–32.0 | 05 VALUES | 行動指針 01 ジャンルを越える / 02 熱意を形にする / 03 小さな実績を積む |
| 32.0–38.4 | 06 TRAJECTORY | 軌道上に歩み（2026.07 サイト公開 → 08 サークルコンテスト → 09 受賞作品決定 → 10 リニューアル → NEXT） |
| 38.4–44.8 | 07 POLAR | 軌道が縮んでロゴのリングに、北極星がドットに。POLAR の文字がせり上がる |
| 44.8–51.2 | 08 JOIN | 「あなたの「好き」を、ここで形に。」 neo-polar.github.io / @polar_universe |

音楽の鐘の音・インパクトは、すべて上の切り替わりと同じ拍に合わせています。

## ファイル

```text
promo/
├── index.html          映像の舞台（1920×1080）。テロップの文言はここ
├── promo.css           テロップのレイアウト
├── promo.js            全フレームの描画。時間 t だけで画面が決まる
├── music.py            BGM の合成（numpy のみ）
├── render.cjs          Chromium でフレームを書き出し ffmpeg へ渡す
├── build.sh            音楽 → フレーム → mp4 を一括で作る
├── thumbnail.html/.css/.js  YouTube サムネイル（ロゴのドットを中心に星が巡る構図）
├── tools/split_logo.py images/Polar_logo.png をアニメーション用パーツに分解
├── assets/             ロゴのパーツ、プレビュー用の音声
└── dist/               完成した映像
```

## プレビュー

ローカルサーバーで開くと、ブラウザ上で音付きで再生できます。

```bash
python3 -m http.server 8000
# http://localhost:8000/promo/ を開き、右下の Play を押す
# 静止画で確認する場合: http://localhost:8000/promo/?t=23.5
```

## 書き出し

必要なもの: Python 3 + numpy、Node.js + Playwright（Chromium）、ffmpeg（libx264）。
テロップの書体は Google Fonts から読み込むため、書き出し時もネットワーク接続が必要です。

```bash
npm i -g playwright && npx playwright install chromium   # 初回のみ
NODE_PATH="$(npm root -g)" promo/build.sh                # → promo/dist/polar-promo-1080p60.mp4
```

4並列でおよそ10〜15分かかります。サムネイルは `NODE_PATH="$(npm root -g)" node promo/render.cjs thumbnail` で作り直せます。静止画だけ確認したいときは
`NODE_PATH="$(npm root -g)" node promo/render.cjs stills 2.5 21 42` で `promo/build/stills/` に出力されます。

## 修正するときは

- **文言**: `index.html` のテロップを書き換えます。ジャンル名だけは `promo.js` の `GENRES` にあります。
- **タイミング**: `promo.js` の各シーンは小節（`bar()`）と拍（`BEAT`）で指定しています。音楽とずらさないよう、`music.py` も同じ小節で変更してください。
- **ロゴ**: ロゴを差し替えたら `python3 promo/tools/split_logo.py` でパーツを作り直し、表示されたリングの楕円の値を `promo.js` の `LOGO.ring` に反映します。
