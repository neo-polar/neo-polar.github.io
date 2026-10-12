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

1. `news/` 配下に記事ページを作成する（既存の記事を複製すると、検索用のタグもそろいます）
2. `<head>` の `title`・`description`・`canonical`・`og:*`・`twitter:*` と、末尾の構造化データ（`application/ld+json`）の見出し・日付・URLを新しい記事に合わせて書き換える
3. `sitemap.xml` に記事のURLを追加する
4. `news.html` に新しい記事リンクを追加する
5. 必要に応じて `index.html` の最新ニュース一覧にも反映する

`canonical` を複製元の記事のまま残すと、新しい記事が検索結果に出なくなります。`check_site.py` が `canonical` / `og:url` / `sitemap.xml` の漏れを検出し、公開を止めます。

## メンバー追加方法

メンバーを追加する場合は、次の流れで管理します。

1. `members/` 配下にプロフィール用HTMLを作成する（`canonical` などの書き換えはお知らせと同じ）
2. `images/` にプロフィール画像を配置する（表示は最大120pxなので、360px四方程度に縮小する）
3. `sitemap.xml` にURLを追加する
4. 必要に応じて `index.html` の Members セクションからリンクする

## ギャラリーへのリンク追加方法

Gallery セクションには、note の活動マガジンと Polar 深海文献庫（クトゥルフ神話アーカイブ）へのカードを並べています。

1. `index.html` の `.gallery-links` 内にある `.note-card` を1つ複製する
2. リンク先・ラベル・タイトル・URL表示を書き換える（日本語 / 英語は `data-ja` / `data-en`）
3. アイコン画像を `images/` に配置して差し替える

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
- `css/design.css`: サイト全体のデザインシステム（配色トークン、書体、ナビ、見出し、ボタン、カード、フッター、記事ページ）。基礎スタイルと記事用CSSの後に読み込みます。
- `css/polar-motion.css`: 星・オーロラ・極地の装飾、ジャンルのリボン、スクロール表示、ページ遷移などのモーション。`design.css` の後に読み込みます。
- `css/home.css`: ホーム画面専用の構図（表紙のオープニング、番号付きセクション、About / News / Gallery / Members / Contact のレイアウト）。`index.html` だけで読み込みます。
- 書体は Google Fonts の1リクエストで読み込みます。本文は Noto Sans JP、見出しは Shippori Mincho、欧文の大見出し・数字・ラベルは Cormorant Garamond です（英語表示では見出しも Cormorant Garamond）。書体を変える場合は全ページの `fonts.googleapis.com` のURLをそろえて更新してください。
- 日本語書体は太さ1つにつき約120個の `@font-face` が読み込み前のCSSに加わるため、URLには実際に使う太さだけを書きます（Noto Sans JP 400/500/700、Shippori Mincho 600、Cormorant Garamond 500/600）。太さを追加する前に、本当に使われるか確認してください。
- 表紙・記事ページの見出し帯・フッターは「極夜」の濃紺（`--night-*` トークン）、本文は氷白と淡い青で構成します。記事ページの見出し帯は `.article-header` / `.member-header` / `.news-page-header` の `border-image` で全幅に描いており、追加のHTMLは不要です。
- ナビは濃紺の見出しの上では透明・白文字になり、スクロールすると白（不透明度96%）に切り替わります（`main.js` / `news.js` が `#nav` に `is-top` を付け外しします）。JSがない場合は常に白いナビです。背景のぼかし（`backdrop-filter`）はスクロール中に毎フレーム描き直しが発生して低性能なPCで重いため、使いません。
- 文字の視認性: 明るい背景の文字は WCAG AAA（7:1）以上、濃紺の上の文字は 5.5:1 以上を目安にしています。本文以外の小さな文字も 13px 以上です。日本語の見出し・短い文は `word-break: auto-phrase` と `text-wrap` で文節単位の自然な改行にしています（未対応ブラウザーでは通常の改行）。色を変える場合はコントラストを再確認してください。
- `design.css` 冒頭の CSS 変数で色・書体・本文幅・ナビ高さを調整できます。モバイルナビの境界は CSS / JS ともに 960px です。印刷時は明るい配色に切り替わります。モーション低減、キーボードフォーカス、Escape によるメニュー閉鎖にも対応します。
- 自動アニメーションの生成と停止・再開は `js/polar-motion.js`、ポインターへの反応は `js/main.js` で管理します。`images/polar-stars.svg` はJSがない場合の静止画です。氷とペンギンのSVGも `images/` にあります。
- 表紙の星図は「天体観測儀」をイメージした4枚のSVGで構成します。`polar-sky-chart.svg`（赤緯円・時角線・南十字星などの星図。天の極を中心にゆっくり回転）、`polar-sky-dial.svg`（固定の目盛りと時角の外枠）、`polar-aurora.svg`（ぼかしたオーロラ）、`polar-pole-star.svg`（中心の極星）。`python3 scripts/make_sky.py` で再生成できます。マウスに合わせて層ごとに異なる量だけ動き、奥行きが出ます。
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

### モーション

- 表紙: 雪の稜線がせり上がり、「Polar」が1文字ずつ浮かび、タグライン・ボタン・星図の順に現れます（CSSのみ）。文字にカーソルを乗せると跳ねます。スクロールすると表紙の文字がゆっくり沈みます（スクロール連動アニメーション対応ブラウザーのみ）。
- 表紙の下に、音楽・映像・イラスト・文章・プログラミングを英語で流すリボンがあります（`polar-motion.js` が生成、装飾扱いで読み上げ対象外）。
- 最初の画面より下にある見出し・カード・お知らせなどは、画面に入ったときに一度だけ下から浮かび上がります。同時に入った要素は少しずつ遅れて表示されます。最初の画面にある本文、IntersectionObserver 非対応環境、モーション低減設定では最初から表示されたままです。
- 記事ページは見出し帯の文字が開いた瞬間にせり上がります（CSSのみ）。ナビの下端に読了位置のバーがあり、対応ブラウザーではページ間をクロスフェードで移動します（View Transitions）。
- ボタンは左から色が満ちるホバー、お知らせ行は左端のライン、メンバーは写真のズーム、カードは浮き上がりで反応します。
- フッターの夜空では星がまたたき、流れ星が通ります。Gallery の極地の場面には雪が降ります。

### アニメーションの負荷を増やさないために

- アニメーションで変えるのは `transform` と `opacity` のみ。`filter`、ぼかし、サイズ・座標指定の連続更新は追加しないでください。
- 自動装飾にフレームごとのJS、タイマー、スクロールイベントはありません。スクロール連動の演出は CSS の `animation-timeline` と IntersectionObserver だけで動かします。
- `.motion-scene` 内へ装飾を追加すると、子要素は停止状態を継承します。新しい場面は `polar-motion.js` の `scene()` で登録します（表紙の星図、リボン、Gallery、フッターの夜空、見出しの星）。
- 599px以下、またはホバーのないタッチ端末では表紙を5つのアニメーション層に削減します。横向きのスマートフォンでも追加層は動かしません。オーロラ・周回・流れ星・雪・フッターの2つ目の星群の追加層は表示もアニメーションも停止します。
- `IntersectionObserver` 非対応、モーション低減、低速更新ディスプレイでは静止表示へ切り替えます。モーション低減の設定では、オープニング・スクロール表示・ページ遷移もすべて止まります。
- 表紙のポインター追従は、`main.js` が星図（`.polar-sky`）だけに `--star-x` / `--star-y` を最大50ミリ秒に1回書き込みます。表紙全体に書くと毎回すべての文字のスタイルが再計算されます。各層は約1秒かけて追従するため、間引いても動きは変わりません。
- 追従のずれ（`translate`）は奥行きごとのラッパー（`.sky-depth`）に付け、自身の `transform` アニメーションを持つ絵柄には付けません。同じ要素に両方があるとブラウザーがGPUで処理できず、メインスレッドで毎フレーム計算します。
- 画像は表示サイズの3倍程度までに縮小し、最初の画面より下の画像には `loading="lazy" decoding="async"` を付けます。
- `check_behavior.cjs` は動作制御を検査しますが、実機のFPSや消費電力は測定しません。モーション関連ファイル（ページが実際に読み込むもの）の合計は 48 KiB 未満に保ちます。公開前に実際のスマートフォンでスクロールの滑らかさも確認してください。

### OG画像

共有用画像は `images/og-polar-home-20261003.png`（1245 × 699、PNG）です。10ページの `og:image` と `twitter:image` がこの画像を参照します。更新時には `og:image:width` / `height` / `type` / `alt` も確認してください。`check_site.py` はローカルの実ファイルと寸法を検証します。旧 `og-image.png` と公開当時の記事画像は互換性と記録を維持するため残しています。

```bash
python scripts/check_site.py --compare HEAD
```

コミット後は `HEAD` の代わりに変更前のコミット ID を指定してください。外部サイトの稼働状況やフォームの実送信はこの検査には含まれません。公開前に日本語・英語、390px / 768px / デスクトップ幅、問い合わせの必須入力、記事ページを確認してください。

### 検索結果のfavicon

Google検索用の安定URLは `/favicon-polar.png`（96 × 96、PNG）です。ホーム画面の `rel="icon"` からルート相対URLで参照し、今後はファイル名を変えずに維持します。`robots.txt` はクローラーを許可して `sitemap.xml` を通知します。

公開後はGoogle Search Consoleで `https://neo-polar.github.io/` をURL検査し、「公開URLをテスト」後に「インデックス登録をリクエスト」を実行してください。サイトマップには `https://neo-polar.github.io/sitemap.xml` を登録します。Google側の再クロールと反映には数日から数週間かかる場合があります。

### 検索エンジン対策（SEO）

- 全ての公開ページに、固有の `title`・`description`・`canonical`・OGP / Twitter Card を設定しています。ホームの `title` は「Polar 公式サイト｜複数ジャンル横断型クリエイティブ組織」です（「Polar」だけでは同名の企業・製品に埋もれるため）。
- 構造化データ（schema.org の JSON-LD）: ホームに `WebSite` / `Organization`、記事に `NewsArticle`、メンバーに `ProfilePage`、各ページに `BreadcrumbList` を記述しています。JSON-LD はスクリプトとして実行されないため、CSP の `script-src 'self'` の影響を受けません。SNSアカウントを増やしたら、ホームの `Organization` の `sameAs` に追加してください。
- Bing（Microsoft Edge の検索）・Yandex などへは IndexNow で更新を通知します。`main` への push でデプロイが成功すると、`scripts/indexnow.py` が変更されたHTMLのURLだけを送ります（Actions の画面から手動実行した場合は全ページ）。ルートの `585517fe13ba384ab345eeb9f322977c.txt` は IndexNow の所有確認用キーなので、削除・改名しないでください。通知に失敗してもデプロイ自体は失敗扱いになりません。
- `sitemap.xml` の `lastmod` は、本文・構造化データ・リンクを変えたときに更新してください。

## バージョン

v1.1 — 静的サイト構成・GitHub Pages 自動デプロイ対応

### 南極と独創性の配色

本文は氷白と淡い青、文字は濃い青で統一します。OSのダークモードでも本文は明るいままです。表紙・記事ページの見出し帯・フッターは南極の薄明と極夜をイメージした濃紺で、オーロラ・星図・非対称の雪の稜線と山並みで構成します。作品欄にはペンギンのSVGを使います。
