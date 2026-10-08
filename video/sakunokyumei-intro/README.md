# 朔之玖溟 チャンネル紹介動画

YouTube の朔之玖溟公式チャンネル用の紹介動画（1分22秒）です。
内容は公式サイトと Polar のプロフィールから構成しています。
投稿用のタイトル・説明・タグは [`youtube.md`](youtube.md) にあります。

| ファイル | 内容 |
| --- | --- |
| `sakunokyumei-channel-intro.mp4` | YouTube へのアップロード用（1920×1080 / 30fps / H.264 + AAC 320kbps / -16 LUFS・約85MB）。容量が大きいためリポジトリには含めていません（`node render.cjs` で作り直せます） |
| `sakunokyumei-channel-intro-720p.mp4` | 公式サイトでの再生用（1280×720・約9MB） |
| `thumbnail.jpg` | サムネイル（1280×720） |
| `scene.html` / `scene.css` / `scene.js` | 映像の本体。文字の差し替えは `scene.html` で行います |
| `music.py` | BGM の合成（numpy のみ・オリジナル） |
| `render.cjs` | Chromium で1フレームずつ撮影し、ffmpeg で MP4 に書き出し |

## 構成

| 時間 | 場面 |
| --- | --- |
| 0:00 | オープニング（新月と海、縦書きの「朔之玖溟」） |
| 0:07 | ことばから、まだ見ぬ景色へ。 |
| 0:14 | 01 Profile |
| 0:24 | 02 Writing（『アウトサイダー』『心理遺伝』『人間という騙し絵』の抜粋） |
| 0:39 | 創作論「書く」ということ |
| 0:47 | 03 Reading（H・P・ラヴクラフトほか） |
| 0:56 | 04 Works & Activities |
| 1:07 | チャンネルについて |
| 1:14 | エンドカード（各リンク） |

背景の新月（朔）と暗い海（溟）、軌道上の九つの点（玖）は名前から作ったモチーフです。

## 公式サイトでの掲載

トップページの「02 — Movie」（`index.html` の `#movie`）で、720p 版とサムネイルを表示しています。
YouTube に公開したら、`index.html` の `<div class="movie-frame" data-youtube-id="">` に動画ID（`watch?v=` の後ろの11文字）を入れると、サイト内の MP4 の代わりに YouTube の埋め込み（youtube-nocookie.com）に切り替わります。
あわせて、`index.html` の構造化データ `sameAs` と SNS 欄にチャンネルの URL を追加すると、検索結果でも結び付きます。

## 作り直す

Node.js・Playwright・ffmpeg・Python 3（numpy）が必要です。フォントは Google Fonts から読み込みます。

```bash
cd video/sakunokyumei-intro
python3 music.py              # build/music.wav
node render.cjs               # 1080p と 720p の MP4（約15分）
node render.cjs --thumb       # thumbnail.jpg
node render.cjs --stills 5,20 # 指定秒の静止画を build/ に保存（確認用）
```

`scene.html` をブラウザーで開くとその場で再生できます（`scene.html?t=24` で 0:24 から）。
場面の長さを変えるときは、`scene.html` の `data-in` / `data-out` / `data-at`、`scene.js` の `KEYS`（背景）、`music.py` の `CHORDS` などの秒数をそろえて変更してください。
