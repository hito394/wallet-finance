# Cloud Deployment Order (Staging First)

This is the shortest sequence to connect cloud safely and verify end-to-end behavior.

## 1. Prepare repository and env values

1. Push current branch to GitHub.
2. Decide staging domains:
	- API: `https://<api-service>.onrender.com`
	- Frontend: `https://<frontend-service>.onrender.com`
3. Prepare backend env values:
	- `CORS_ORIGINS=https://<frontend-service>.onrender.com`
	- `TRUSTED_HOSTS=<api-service>.onrender.com`

## 2. Deploy backend + database on Render

1. In Render, create Blueprint from repository root.
2. Use `finance_mvp/infra/render.yaml`.
3. Confirm services:
	- `ai-finance-assistant-db` (managed PostgreSQL)
	- `ai-finance-assistant-api` (Docker)
4. Set backend env vars in Render:
	- `CORS_ORIGINS`
	- `TRUSTED_HOSTS`
5. Deploy and verify:
	- `GET https://<api-service>.onrender.com/health` returns `{"ok":true}`

## 3. Connect frontend to cloud API

1. In Render frontend service (`ai-finance-assistant-frontend`), confirm settings:
	- `Root Directory=finance_mvp/frontend`
	- `Build Command=npm ci && npm run build`
	- `Start Command=npm run start`
	- `Runtime=Node`
2. Set env var:
	- `NEXT_PUBLIC_API_BASE_URL=https://<api-service>.onrender.com/api/v1`
3. Trigger frontend deploy.
4. Validate frontend host:
	- Root should render Next app UI (not a static HTML landing template)
	- `/dashboard` must return `200` (not `404`)

### Troubleshooting: old static page is still shown

If `https://<frontend-service>.onrender.com` returns a static HTML page and `/dashboard` is `404`, the service is still pointing to an old app definition.

1. In Render dashboard, open `ai-finance-assistant-frontend`.
2. Re-save the service with the settings above (especially `Root Directory`).
3. If it still serves old content, recreate only the frontend web service from the same repo/branch using `finance_mvp/frontend` as root.
4. Redeploy and re-check root + `/dashboard`.

## 4. Run cloud smoke tests (must pass)

1. `GET /health`
2. `GET /api/v1/entities`
3. `GET /api/v1/review-queue`
4. Upload file to `POST /api/v1/imports/upload` and verify import created.

## 5. Connect mobile app to cloud API

1. For simulator/device run, pass API explicitly:

```bash
flutter run -d <device-id> -t lib/main_dev.dart --dart-define=API_BASE_URL=https://<api-service>.onrender.com/api/v1
```

2. Verify app behavior on physical device (no `127.0.0.1` usage).

## 6. Production hardening after staging passes

1. Add object storage (S3/GCS) for uploaded documents.
2. Add async worker/queue for ingestion.
3. Add auth, audit log, and role-based access before multi-user rollout.
