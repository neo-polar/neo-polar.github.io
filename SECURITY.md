# Security Policy

## Reporting a Vulnerability

Polar 公式サイト（`https://neo-polar.github.io/`）またはこのリポジトリに関するセキュリティ上の問題を発見した場合は、公開 Issue には記載せず、以下のいずれかの方法で非公開にご連絡ください。

- GitHub Security Advisories（このリポジトリの **Security → Report a vulnerability**）
- 公式サイトのお問い合わせフォーム（`https://neo-polar.github.io/#contact`）

報告を受けた後、内容を確認のうえ速やかに対応します。

## Implemented Security Controls

このサイトでは以下のセキュリティ対策を適用し、CI（`scripts/check_site.py`）で継続的に検証しています。

- **Content Security Policy (CSP)**: 全公開ページで `'unsafe-inline'` / `'unsafe-eval'` を排除し、`default-src 'self'`、`script-src 'self'`、`img-src 'self' data:`、`base-uri 'self'`、`object-src 'none'`、`frame-src 'none'`、`form-action https://ssgform.com`、`upgrade-insecure-requests` を適用
- **Referrer Policy**: 全公開ページで `strict-origin-when-cross-origin` を設定
- **外部リンク保護**: すべての `target="_blank"` リンクに `rel="noopener noreferrer"` を付与
- **フォーム入力保護**: `maxlength` 制限および ReDoS 耐性のあるメールアドレス検証、二重送信防止を実装
- **CI / CD サプライチェーン保護**: GitHub Actions の全アクションをコミット SHA でピン留め、`permissions` をジョブ単位で最小化、`persist-credentials: false` を設定し、公開成果物から開発用ファイル（`scripts/`、`README.md`、`SECURITY.md` 等）を除外
