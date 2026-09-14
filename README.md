# Polar

複数ジャンル横断型クリエイティブ組織 Polar の公式Webサイトです。
このリポジトリは、GitHub Pages へ公開するための静的サイトのソース一式です。

## 現在の構成

このサイトは、以下のような構成で運用しています。

- 静的HTML/CSS/JSのみで構成
- 日本語 / 英語の切り替え対応
- トップページ、ニュース一覧、Vision & Mission、プライバシーポリシー、利用規約、送信完了ページを用意
- お知らせ記事は `news/` 配下のHTMLとして管理
- メンバープロフィールは `members/` 配下のHTMLとして管理
- 問い合わせフォームは SSGForm を利用
- GitHub Actions で GitHub Pages へ自動デプロイ

## 主要ファイル

```text
.
├── .github/workflows/static.yml   GitHub Pages へ自動デプロイするワークフロー
├── css/                            スタイルシート
├── images/                         画像・OGP・ロゴ・メンバー写真
├── js/                             メインページ / ニュースページ用スクリプト
├── members/                        メンバープロフィールページ
├── news/                           お知らせ記事ページ
├── index.html                      トップページ
├── news.html                       お知らせ一覧ページ
├── vision_mission.html            Vision & Mission
├── privacy-policy.html            プライバシーポリシー
├── terms.html                     利用規約
├── thanks.html                    問い合わせ送信完了ページ
├── .nojekyll                       GitHub Pages 用設定ファイル
└── README.md                       このファイル
```

## 主要ページ

- `index.html`
  - ヒーロー、About、News、Gallery、Members、Contact を含むランディングページ
- `news.html`
  - お知らせ一覧のアーカイブページ
- `news/*.html`
  - 個別のお知らせ記事ページ
- `members/*.html`
  - メンバープロフィールページ
- `vision_mission.html`
  - Vision / Mission の説明ページ
- `privacy-policy.html`, `terms.html`
  - 法的ページ

## 開発・更新手順

このサイトはビルドステップを持たず、HTML/CSS/JS を直接更新します。

1. 変更したいファイルを編集する
2. ローカルで表示確認する
3. Git でコミットする
4. `main` ブランチへ push すると GitHub Actions がデプロイを実行する

## お知らせの追加方法

お知らせを追加する場合は、次の流れが基本です。

1. `news/` 配下に記事ページを作成する
2. `news.html` に新しい記事リンクを追加する
3. 必要に応じて `index.html` の最新ニュース一覧にも反映する

## メンバー追加方法

メンバーを追加する場合は、次の流れで管理します。

1. `members/` 配下にプロフィール用HTMLを作成する
2. `images/` にプロフィール画像を配置する
3. 必要に応じて `index.html` の Members セクションからリンクする

## デプロイ

GitHub Actions により、`main` ブランチへの push で自動的に GitHub Pages に公開されます。

- ワークフロー: `.github/workflows/static.yml`
- 公開URL: https://neo-polar.github.io/

## 公開前に確認したいポイント

- OGP / Twitter Card の URL と画像が正しいか
- 問い合わせフォーム先（SSGForm）が意図したものか
- `privacy-policy.html` / `terms.html` の内容が最新か
- 追加した画像やリンクに破損がないか

## セキュリティについて

以下のような基本的なセキュリティ設定は実装済みです。

- CSP（Content Security Policy）を適用
- Referrer Policy を `strict-origin-when-cross-origin` に設定
- メールアドレスを JavaScript で難読化して表示

## 変更・公開コマンド例

```bash
git add .
git commit -m "update: 〇〇を更新"
git push origin main
```

## デザインの保守

- `css/style.css`: 既存コンポーネントと機能の基礎スタイル。
- `css/article.css`: 記事・プロフィール固有の構造。
- `css/design.css`: サイト全体の配色・余白・レイアウト。基礎スタイルと記事用CSSの後に読み込みます。
- `css/polar-motion.css`: 星・オーロラ・北極の装飾と自動アニメーション。`design.css` の後に読み込みます。
- `css/home.css`: 参照ビジュアルに合わせたホーム画面専用の構図・文字組み・星図。`index.html` だけで読み込みます。
- `design.css` 冒頭の CSS 変数で色・本文幅・ナビ高さを調整できます。モバイルナビの境界は CSS / JS ともに 960px です。
- OSの配色設定にかかわらず、深いネイビーのダークテーマを標準にします。フォームなどの標準UIにも `color-scheme: dark` を適用します。印刷時は明るい配色に切り替わります。モーション低減、キーボードフォーカス、Escape によるメニュー閉鎖にも対応します。
- 自動アニメーションの生成と停止・再開は `js/polar-motion.js`、ポインターへの反応は `js/main.js` で管理します。`images/polar-stars.svg` はJSがない場合の静止画です。氷とシロクマのSVGも `images/` にあります。動かすのは装飾だけで、本文は最初から全文を表示します。
- 本文・翻訳・URL は HTML に維持しています。新規ページにも既存ページと同じ順序で共通 CSS を読み込んでください。ビルドツールや追加の JavaScript ライブラリは不要です。

### ローカル確認

このディレクトリで実行します（Python 3、追加パッケージ不要）。

```bash
python -m http.server 8000 --bind 127.0.0.1
python scripts/check_site.py
```

`http://127.0.0.1:8000` をブラウザーで開きます。内部リンク・画像・アンカーを検査できます。デザインのみの変更時は、変更前コミットとの本文・翻訳・既存参照の比較も実行できます。

GitHub Pages の公開ワークフローでも内部リンクと JavaScript の動作を検査し、失敗した場合は公開を停止します。動作検査をローカルで実行する場合は Node.js を使用します（追加パッケージ不要）。

```bash
node scripts/check_behavior.cjs
```

この検査は簡易 DOM 上で実際のスクリプトを実行し、日本語・英語、モーション低減の有無、メニュー、Escape、画面幅変更、星のポインター反応を確認します。さらに、画面外・別タブ・モーション設定変更時の自動アニメーション停止と復帰を検査します。実ブラウザーの表示・クリック検証を置き換えるものではありません。

### アニメーションの負荷を増やさないために

- アニメーションで変えるのは `transform` と `opacity` のみ。`filter`、ぼかし、サイズ・座標指定の連続更新は追加しないでください。
- 自動装飾にフレームごとのJS、タイマー、スクロールイベントはありません。
- `.motion-scene` 内へ装飾を追加すると、子要素は停止状態を継承します。新しい場面は `polar-motion.js` の `scene()` で登録します。
- 599px以下、またはホバーのないタッチ端末では表紙を5つのアニメーション層に削減します。横向きのスマートフォンでも追加層は動かしません。オーロラ・周回・流れ星・雪の追加層は表示もアニメーションも停止します。
- `IntersectionObserver` 非対応、モーション低減、低速更新ディスプレイでは静止表示へ切り替えます。
- `check_behavior.cjs` は動作制御を検査しますが、実機のFPSや消費電力は測定しません。公開前に実際のスマートフォンでスクロールの滑らかさも確認してください。

### OG画像

共有用画像は `images/og-polar-stars.png`（1730 × 909、PNG）です。10ページの `og:image` と `twitter:image` がこの画像を参照します。更新時には `og:image:width` / `height` / `type` / `alt` も確認してください。`check_site.py` はローカルの実ファイルと寸法を検証します。旧 `og-image.png` と公開当時の記事画像は互換性と記録を維持するため残しています。

```bash
python scripts/check_site.py --compare HEAD
```

コミット後は `HEAD` の代わりに変更前のコミット ID を指定してください。外部サイトの稼働状況やフォームの実送信はこの検査には含まれません。公開前に日本語・英語、390px / 768px / デスクトップ幅、問い合わせの必須入力、記事ページを確認してください。

### 検索結果のfavicon

Google検索用の安定URLは `/favicon-polar.png`（96 × 96、PNG）です。ホーム画面の `rel="icon"` からルート相対URLで参照し、今後はファイル名を変えずに維持します。`robots.txt` はクローラーを許可して `sitemap.xml` を通知します。

公開後はGoogle Search Consoleで `https://neo-polar.github.io/` をURL検査し、「公開URLをテスト」後に「インデックス登録をリクエスト」を実行してください。サイトマップには `https://neo-polar.github.io/sitemap.xml` を登録します。Google側の再クロールと反映には数日から数週間かかる場合があります。

## バージョン

v1.1 — 静的サイト構成・GitHub Pages 自動デプロイ対応
