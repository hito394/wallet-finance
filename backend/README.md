# Backend Setup

This backend is scaffolded to be deployment-friendly for Render, Railway, Fly.io, AWS, or GCP.

## 1. Install and configure

```bash
cd backend
cp .env.example .env
npm install
```

## 2. Run local development

```bash
docker compose up -d postgres
npm run migrate
npm run dev
```

If Docker is not installed, use a managed PostgreSQL instance and set `DATABASE_URL` in `.env`.

Example:

```bash
DATABASE_URL=postgres://<user>:<password>@<host>:5432/<database>
```

Then run:

```bash
npm run migrate
npm run dev
```

## 2.1 Troubleshooting migration failures

- `ECONNREFUSED 127.0.0.1:5432`: PostgreSQL is not running or `DATABASE_URL` points to an unavailable host.
- Confirm local DB is up: `docker compose ps`
- Confirm env: `cat .env | grep DATABASE_URL`
- Retry migration: `npm run migrate`

## 3. Production deployment checklist

- Set environment variables from `.env.production.example`
- Set `NODE_ENV=production`
- Use managed Postgres and run `npm run migrate` during deploy
- Set `STORAGE_DRIVER=s3` for hosted file storage
- Restrict `CORS_ORIGINS` to known frontend/app origins

## 4. Health endpoint

`GET /health`

## 5. Upload endpoint

`POST /upload` with multipart `file`

Use HTTPS in production and do not expose localhost-only endpoints to mobile clients.
