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

## バージョン

v1.1 — 静的サイト構成・GitHub Pages 自動デプロイ対応