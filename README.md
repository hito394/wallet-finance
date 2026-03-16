# WALLET

This workspace is prepared for reliable iPhone real-device usage.

- `docs/iphone-production-readiness-ja.md`: Japanese production-readiness guide
- `mobile/`: Flutter app skeleton with dev/prod environment separation
- `backend/`: Deployment-friendly API skeleton (env vars, CORS, storage abstraction, migrations)

## Repository scope

This folder is now an independent Git repository.

```bash
cd /Users/shimazakihitoshi/WALLET
git status
```

## Recommended next command sequence

```bash
# Mobile
cd mobile
flutter create .
flutter pub get

# Backend
cd ../backend
cp .env.example .env
npm install

# Option A: local DB via Docker (if available)
docker compose up -d postgres

# Option B: managed Postgres (Neon/Supabase/Railway)
# 1) create DB
# 2) set DATABASE_URL in backend/.env

npm run migrate
npm run dev
```
