# Polar

複数ジャンル横断型クリエイティブ組織 Polar の公式Webサイト

## 構成

```
Polar/
├── index.html                メインページ（最新3件のNewsを掲載）
├── news.html                 お知らせ一覧ページ（全件アーカイブ）
├── vision_mission.html       Vision & Mission ページ
├── privacy-policy.html       プライバシーポリシー
├── terms.html                利用規約
├── news/                     ← 個別記事フォルダ
│   ├── 2026-06-DD.html
│   ├── 2026-06-01.html
│   └── 2026-05-14.html
├── README.md                 このファイル
├── .nojekyll                 GitHub Pages 用（空ファイル）
├── css/
│   ├── style.css             メインスタイルシート
│   └── article.css           記事ページ用スタイルシート
├── js/
│   ├── main.js               index.html 用スクリプト
│   └── news.js               news.html / 記事ページ用スクリプト
└── images/
    ├── Polar_logo.png        ロゴ
    ├── logo-black.png        X ロゴ
    ├── gallery/              ギャラリー画像
    └── avatar_*.png          メンバー写真
```

## セクション

| セクションID | 内容 |
|---|---|
| `#nav` | ナビゲーション（固定ヘッダー） |
| `#hero` | キャッチコピー・第一印象 |
| `#about` | 組織紹介 |
| `#news` | お知らせ（最新3件） |
| `#gallery` | ギャラリー |
| `#members` | メンバー紹介 |
| `#contact` | コンタクトフォーム |
| `#footer` | SNS・ニュースレター・コピーライト |

## 今後の対応が必要な箇所

- [ ] `css/style.css` の `--clr-accent` をアクセントカラー確定後に変更
- [ ] メンバーの一言コメントを記入
- [ ] ギャラリー画像を `images/` に配置してHTMLを更新
- [ ] メンバー写真を `images/avatar_*.png` に配置してHTMLを更新
- [ ] SNS（Discord等）のURLを差し替え（現在コメントアウト済み）
- [ ] Google Analytics の設定（公開後）

## 📰 News 更新ルール

> ⚠️ お知らせを追加するときは必ず2ファイルを更新してください。

| ファイル | 役割 | 更新タイミング |
|---|---|---|
| `index.html` | トップページ（最新3件のみ掲載） | 新着追加・古い記事を削除して常に3件に保つ |
| `news.html` | 全件アーカイブ | すべての記事を追加・削除しない |

**手順**
1. `news.html` の `<ul class="news-list">` 先頭に新しい記事を追加する
2. `index.html` の `<ul class="news-list">` 先頭にも同じ記事を追加する
3. `index.html` の記事が4件以上になったら、一番古い `<li class="news-item">` を削除して3件に戻す

## ⚠️ 公開前に必ず確認するチェックリスト

- [ ] `index.html` の `og:url` を実際のGitHub Pages URLに差し替える
  ```
  https://[ユーザー名].github.io/Polar/
  ```
- [ ] `index.html` の `og:image` / `twitter:image` を差し替える
  ```
  https://[ユーザー名].github.io/Polar/images/og-image.png
  ```
- [ ] OGP用の画像 `images/og-image.png` を作成・配置する（推奨: 1200×630px）
- [ ] Discord URLが決まったら `index.html` のコメントアウトを外す
- [ ] メンバーアバター画像（`images/avatar_*.png`）を配置する

## 🔒 セキュリティチェックリスト

### 設定済み（コードに反映）
- [x] CSP（Content Security Policy）を `<head>` に追加済み
- [x] Referrer Policy を `strict-origin-when-cross-origin` に設定済み
- [x] フッターのメールアドレスをJSで組み立てる難読化を実装済み

### 要確認（設定画面での作業）
- [ ] **GitHub Pages**: Settings → Pages → "Enforce HTTPS" にチェックが入っているか確認
- [ ] **SSGForm**: 無料プランの月間送信上限件数を確認（超過時の挙動を把握しておく）

### 任意
- [ ] GitHub の Dependabot アラートをオンにする（Settings → Security → Dependabot alerts）

## GitHub Pages 公開手順

```bash
# 初回
git clone https://github.com/[ユーザー名]/Polar.git
cd Polar

# 作業開始時
git pull origin main

# 変更後
git add .
git commit -m "add: ○○を追加"
git push origin main
```

Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save

公開URL: `https://[ユーザー名].github.io/Polar/`

## バージョン

v1.0 — 初回公開（Phase A: シングルページ構成）
