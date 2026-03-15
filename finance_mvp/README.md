# AI Finance Assistant MVP

Automation-first financial document intelligence MVP with entity-aware workflows for personal and business operations.

## Stack
- Frontend: Next.js + TypeScript + Recharts
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL
- OCR: Tesseract via pytesseract
- Matching: rapidfuzz

## Core capabilities
- Multi-entity model (`personal`, `freelancer`, `business`, `organization`) with header-based context (`x-entity-id`)
- Financial document intelligence pipeline (classification, metadata extraction, business relevance scoring)
- CSV/PDF statement ingestion with normalization, dedupe, and categorization
- Receipt OCR extraction and transaction matching
- Cross-validation rules between transactions and extracted documents
- Human-in-the-loop review queue and learning feedback endpoints
- Analytics endpoints and dashboard KPIs with entity switching

## Backend quick start
```bash
cd backend
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.db.bootstrap
uvicorn app.main:app --reload
```

## Frontend quick start
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## API flow
1. Upload statement/receipt via `POST /api/v1/imports/upload`
2. Pipeline creates `financial_documents` record and classifies document type
3. Extraction + relevance scoring + transaction linking run automatically
4. Rule engine creates `review_queue_items` where confidence is low or conflicts are detected
5. Dashboard surfaces spend KPIs, docs requiring review, and queue backlog

## Key endpoints
- `GET /api/v1/entities`
- `GET /api/v1/documents`
- `GET /api/v1/review-queue`
- `POST /api/v1/learning`
- `GET /api/v1/exports/accounting.csv`

## Production configuration
Set these values in `backend/.env` before deployment:

- `DATABASE_URL`: production PostgreSQL URL
- `CORS_ORIGINS`: comma-separated allowlist, e.g. `https://app.example.com,https://admin.example.com`
- `TRUSTED_HOSTS`: comma-separated hostnames, e.g. `api.example.com`
- `FILE_STORAGE_ROOT`: local mount path (or adapter mount when using object storage)
- `MAX_UPLOAD_MB`: upload limit enforced by API

Recommended deployment steps:

1. Run `python -m app.db.bootstrap` during release setup.
2. Point frontend `NEXT_PUBLIC_API_BASE_URL` to production API (`https://api.example.com/api/v1`).
3. Add object storage + worker queue for high-volume ingestion.
4. Add auth and audit logging before multi-user rollout.

## iPhone real-device stability notes
- Avoid `127.0.0.1` API URLs when testing on physical iPhone.
- For Flutter/mobile clients, pass API endpoint explicitly (`--dart-define=API_BASE_URL=https://...`).
- Keep backend CORS allowlist aligned with production client origins.

## Validation snapshot
- Backend bootstrap executed against PostgreSQL.
- Backend smoke-tested (`GET /health`, `GET /api/v1/entities`, `GET /api/v1/review-queue`).
- Frontend production build completed successfully (`next build`).
