# 家計簿アプリ (Personal Finance App)

銀行明細・レシートから自動で家計を管理するプロダクション構造のMVPアプリです。

## アーキテクチャ概要

```
┌──────────────────────────────────────────────────┐
│  Next.js 14 Frontend (TypeScript + Tailwind CSS) │
│  - ダッシュボード / 取引一覧 / レシート / インポート  │
└──────────────────┬───────────────────────────────┘
                   │ HTTP REST API (/api/*)
┌──────────────────▼───────────────────────────────┐
│  FastAPI Backend (Python)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Parsers  │ │Services  │ │   Routers (API)  │ │
│  │ CSV/PDF  │ │ Import   │ │  /imports        │ │
│  │ OCR      │ │ Categ.   │ │  /transactions   │ │
│  │          │ │ Matching │ │  /receipts       │ │
│  └──────────┘ └──────────┘ │  /analytics      │ │
│                             └──────────────────┘ │
│  SQLAlchemy ORM ──► SQLite (MVP / PostgreSQL可)  │
└──────────────────────────────────────────────────┘
```

## フォルダ構造

```
finance-app/
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py            # FastAPIエントリポイント
│   │   ├── config.py          # 設定（.env対応）
│   │   ├── database.py        # SQLAlchemy非同期エンジン
│   │   ├── models/            # SQLAlchemyモデル
│   │   │   ├── user.py
│   │   │   ├── transaction.py
│   │   │   ├── receipt.py
│   │   │   ├── import_record.py
│   │   │   ├── category.py
│   │   │   └── transaction_match.py
│   │   ├── schemas/           # Pydantic入出力スキーマ
│   │   ├── routers/           # FastAPIルーター（薄い層）
│   │   ├── services/          # ビジネスロジック
│   │   │   ├── import_service.py       # オーケストレーター
│   │   │   ├── transaction_service.py
│   │   │   ├── receipt_service.py
│   │   │   ├── analytics_service.py
│   │   │   ├── categorization_service.py
│   │   │   └── matching_service.py
│   │   ├── parsers/           # ドキュメントパーサー
│   │   │   ├── base.py                 # 抽象基底クラス
│   │   │   ├── csv_parser.py           # CSV銀行明細パーサー
│   │   │   ├── pdf_statement_parser.py # PDF銀行明細パーサー
│   │   │   └── receipt_ocr_parser.py   # レシートOCRパーサー
│   │   └── utils/
│   │       ├── merchant_normalizer.py  # 店名正規化
│   │       └── duplicate_detector.py  # 重複検出ハッシュ
│   ├── tests/
│   │   └── test_parsers.py
│   └── uploads/               # アップロードファイル保存先
└── frontend/
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    └── src/
        ├── app/               # Next.js App Router
        │   ├── page.tsx           # ダッシュボード
        │   ├── transactions/page.tsx
        │   ├── receipts/page.tsx
        │   ├── imports/page.tsx
        │   └── settings/page.tsx
        ├── components/
        │   ├── layout/Sidebar.tsx
        │   ├── dashboard/         # チャート・KPIカード
        │   └── ui/FileUpload.tsx
        ├── lib/api.ts         # APIクライアント + 型変換
        └── types/index.ts     # 型定義
```

## クイックスタート

### 前提条件

- Python 3.11+
- Node.js 18+
- tesseract-ocr（レシートOCR用）
- poppler（PDF→画像変換用）

```bash
# macOS
brew install tesseract tesseract-lang poppler

# Ubuntu
sudo apt install tesseract-ocr tesseract-ocr-jpn tesseract-ocr-eng poppler-utils
```

### バックエンド起動

```bash
cd ~/finance-app/backend

# 仮想環境の作成
python -m venv .venv
source .venv/bin/activate

# 依存パッケージのインストール
pip install -r requirements.txt

# 起動（DBは初回起動時に自動作成）
uvicorn app.main:app --reload --port 8000
```

APIドキュメント: http://localhost:8000/docs

### フロントエンド起動

```bash
cd ~/finance-app/frontend

# 依存パッケージのインストール
npm install

# 開発サーバー起動
npm run dev
```

アプリURL: http://localhost:3000

## iPhoneでXcode不要で安定利用する方法

このアプリはネイティブアプリ化せず、`HTTPS公開Webアプリ + ホーム画面追加` で安定運用できます。

### 推奨構成（本番）

1. バックエンドを常時稼働環境にデプロイ（Render / Railway / Fly.io / VPS など）
2. フロントエンドをVercel等にデプロイ
3. 独自ドメイン + HTTPSを有効化
4. iPhoneのSafariで開いて「ホーム画面に追加」

### 本番環境変数

`backend/.env`

```env
DEBUG=False
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/finance

# 公開フロントエンドURLを許可
CORS_ALLOW_ORIGINS=https://finance.example.com

# APIの正規ホスト名
TRUSTED_HOSTS=finance-api.example.com
```

`frontend/.env`

```env
# Next.jsサーバーコンポーネントが参照するAPI
NEXT_SERVER_API_ORIGIN=https://finance-api.example.com

# /api リライト先
BACKEND_API_ORIGIN=https://finance-api.example.com

# 通常は空でOK。クライアントから直接APIに行きたい場合のみ設定
NEXT_PUBLIC_API_BASE_URL=
```

### iPhoneでの運用ポイント

- ブラウザ運用のためXcode起動は不要
- 本番URLにアクセスするだけで利用可能
- ホーム画面追加でフルスクリーンに近いUXで利用可能
- `localhost` / `127.0.0.1` 固定を排除したため、外出先でも同一URLで利用可能

### テスト実行

```bash
cd ~/finance-app/backend
source .venv/bin/activate
pytest tests/ -v
```

## 使い方

### 1. 銀行明細のインポート

1. ブラウザで http://localhost:3000/imports を開く
2. 銀行からダウンロードしたCSVまたはPDFをドロップ
3. 処理完了後、取引一覧に反映される
4. 自動カテゴリ分類が適用される

### 2. レシートのインポート

1. インポートページでレシート画像（JPG/PNG/PDF）をドロップ
2. OCRで店名・日付・金額を自動抽出
3. 既存取引との自動マッチングを試みる
4. 未マッチの場合はレシートページで手動紐付け可能

### 3. 取引管理

- 取引ページでカテゴリ・メモを編集
- 不要な取引は「無視」フラグで集計から除外
- 月・カテゴリ・フリーワードでフィルタリング

## 対応銀行明細フォーマット

### CSVフォーマット

| 銀行 | 対応 | 備考 |
|------|------|------|
| 三菱UFJ銀行 | ✅ | Shift-JIS, UTF-8両対応 |
| 三井住友銀行 | ✅ | |
| みずほ銀行 | ✅ | |
| 楽天銀行 | ✅ | |
| その他 | 🔧 | カラム自動検出で多くの場合対応可能 |

### PDFフォーマット
- テーブル構造PDFは高精度
- スキャンPDFはOCRにフォールバック（精度低め）

## 環境変数設定

バックエンドルートに `.env` ファイルを作成することで設定変更可能:

```env
# PostgreSQLへの切り替え例
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/finance

# アップロードディレクトリ
UPLOAD_DIR=/var/data/uploads

# OCR言語設定
TESSERACT_LANG=jpn+eng
```

## 実装ロードマップ

### MVP（現在）
- [x] CSV銀行明細インポート
- [x] PDF銀行明細インポート（テキスト抽出）
- [x] レシートOCR（pytesseract）
- [x] ルールベース自動カテゴリ分類
- [x] レシート↔取引自動マッチング
- [x] 重複取引検出
- [x] ダッシュボード（月次集計・カテゴリ円グラフ・トレンドチャート）
- [x] 取引編集（カテゴリ・メモ・無視フラグ）

### Phase 2（次のステップ）
- [ ] AI分類フォールバック（OpenAI / ローカルLLM）
  - `categorization_service.py` の `classify_with_ai()` を実装するだけ
- [ ] 銀行API連携（MoneyForward Connect / Plaid）
- [x] スマホ向けPWA対応（manifest + ホーム画面追加対応）
- [ ] レポートPDFエクスポート
- [ ] 予算設定とアラート
- [ ] マルチユーザー対応（JWT認証追加）

### Phase 3（将来）
- [ ] PostgreSQL移行（`DATABASE_URL` 変更のみ）
- [ ] S3ファイルストレージ移行
- [ ] モバイルアプリ（Flutter / React Native）
- [ ] 家族共有機能

## 技術スタック選定理由

| 要素 | 選択 | 理由 |
|------|------|------|
| バックエンド | FastAPI | Pythonエコシステムの充実（OCR・PDF・データ処理） |
| DB | SQLite→PostgreSQL | MVPはファイルベースで手軽、将来は1行変更で移行可能 |
| ORM | SQLAlchemy 2.0 async | 型安全・非同期対応・Alembicマイグレーション |
| フロントエンド | Next.js 14 | App Router・サーバーコンポーネント・SEO不要のため軽量 |
| スタイル | Tailwind CSS | 高速プロトタイプ・保守性・デザイン一貫性 |
| チャート | Recharts | React統合・カスタマイズ容易 |
| OCR | pytesseract | ローカル実行・プライバシー保護・日本語対応 |
| PDF解析 | pdfplumber | テーブル構造抽出が優秀 |
| Fuzzy Match | rapidfuzz | fuzzywuzzyより高速・Rust実装 |

## 本番運用（VPS + Docker Compose）

`docker-compose.yml` と `infra/Caddyfile` を同梱しているため、以下で常時運用できます。

```bash
cp .env.compose.example .env
# DOMAIN / LETSENCRYPT_EMAIL / POSTGRES_PASSWORD を編集

docker-compose build --no-cache
docker-compose up -d
```

確認:

- `https://<DOMAIN>`
- `https://<DOMAIN>/api/health`

詳細手順は `DEPLOY_VPS.md` を参照してください。
