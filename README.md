# Walleca

サブスク・レシート支出管理アプリケーション。レシートをアップロードして OCR で自動読み取り、取引・サブスク・通知・カレンダーをまとめて管理できる個人向け支出管理システム。

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | Next.js 16 (App Router), TanStack Query, Tailwind CSS |
| バックエンド | Node.js + Express + TypeScript |
| ORM | Prisma |
| DB | PostgreSQL |
| キュー / ワーカー | Redis + BullMQ |
| OCR | Tesseract.js |
| 認証 | JWT（アクセストークン + リフレッシュトークン） |

## クイックスタート

```bash
# 1. Docker で PostgreSQL と Redis を起動
docker-compose up -d

# 2. API の依存関係インストール・マイグレーション
cd api && npm install && npm run db:migrate && cd ..

# 3. Web の依存関係インストール
cd web && npm install && cd ..

# 4. API サーバー起動（ターミナル 1）
cd api && npm run dev
# → http://localhost:3001

# 5. Web サーバー起動（ターミナル 2）
cd web && npm run dev
# → http://localhost:3000
```

詳細は [docs/使い方.md](docs/使い方.md) を参照してください。

## ドキュメント

- [使い方・環境構築](docs/使い方.md)
- [要件定義書](docs/要件定義書.md)
- [設計書](docs/設計書.md)
- [設計詳細](docs/設計/)
