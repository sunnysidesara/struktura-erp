# Deployment Guide

Free stack:

| Layer | Service | Notes |
| --- | --- | --- |
| Frontend (Next.js 16) | Vercel Hobby | free, automatic HTTPS/CDN |
| Backend (Laravel 12 / PHP 8.2) | Render Free Web Service (Docker) | free, sleeps after ~15 min idle |
| Database | Aiven MySQL | free 1 GB, TLS |

Vercel cannot host PHP, so the API lives on Render.

---

## 0. Prepare secrets (do this first)

1. Generate a production key:
   ```powershell
   cd backend
   php artisan key:generate --show
   ```
   Copy the `base64:...` value - it becomes `APP_KEY` on Render.
2. Rotate the Aiven database password (it has been stored in a local `.env`).
3. Decide whether production reuses the current Aiven service or gets a second
   free Aiven project. Either way, note host, port, database, user, password.
4. Never commit `.env` or `frontend/.env.local`.

---

## 1. Backend on Render

### Option A - Blueprint (recommended)

1. Push this branch (`struktura-phase-3`).
2. Render dashboard -> **New** -> **Blueprint** -> connect
   `sunnysidesara/struktura-erp` -> branch `struktura-phase-3`.
3. Render reads `render.yaml` (Docker, root `backend`, health check `/up`).
4. Fill the `sync: false` secrets:

| Key | Value |
| --- | --- |
| `APP_KEY` | `base64:...` from step 0 |
| `APP_URL` | `https://<service>.onrender.com` |
| `DB_HOST` | Aiven host |
| `DB_PORT` | Aiven port (e.g. `21804`) |
| `DB_DATABASE` | `defaultdb` |
| `DB_USERNAME` | Aiven user |
| `DB_PASSWORD` | Aiven password |
| `CORS_ALLOWED_ORIGINS` | `https://<app>.vercel.app` (set after step 3) |

Already set by the blueprint: `APP_ENV=production`, `APP_DEBUG=false`,
`APP_FORCE_HTTPS=true`, `LOG_CHANNEL=stderr`, `SESSION_DRIVER/CACHE_STORE/QUEUE_CONNECTION=database`,
`SANCTUM_EXPIRATION=480`, `SANCTUM_IDLE_TIMEOUT=30`, `TRUSTED_PROXIES=*`,
`MYSQL_ATTR_SSL_CA=/etc/ssl/certs/ca-certificates.crt`.

### Option B - Manual

1. **New** -> **Web Service** -> connect the repo.
2. Language: **Docker**, Root Directory: `backend`, Dockerfile: `./Dockerfile`.
3. Health Check Path: `/up`. Instance type: **Free**.
4. Add the environment variables from the table above (plus the defaults).

### Verify the API

Open `https://<service>.onrender.com/up` -> HTTP 200.
Then `https://<service>.onrender.com/api/v1/login` with a POST should answer JSON
(422 for missing fields), never HTML.

---

## 2. Run migrations against the production database

Free Render instances have no shell, but the Aiven database is reachable from
your machine:

```powershell
cd backend
# temporarily point .env at the production database
php artisan migrate --force
php artisan config:clear
```

Seed demo data only for a fresh database:

```powershell
php artisan db:seed --force
```

---

## 3. Frontend on Vercel

1. Vercel -> **Add New Project** -> import `sunnysidesara/struktura-erp`.
2. **Root Directory: `frontend`** (framework auto-detects Next.js).
3. Environment variable (Production + Preview):
   ```
   NEXT_PUBLIC_API_BASE_URL = https://<service>.onrender.com/api/v1
   ```
4. Deploy and copy the production URL (`https://<app>.vercel.app`).

`NEXT_PUBLIC_*` values are baked at build time - redeploy after changing it.

---
## 4. Close the loop - CORS

On Render set:

```
CORS_ALLOWED_ORIGINS = https://<app>.vercel.app
```

Exact origin, no trailing slash. Click **Manual Deploy** to restart. For preview
deployments add `CORS_ALLOWED_ORIGIN_PATTERNS = https://.*\.vercel\.app` only if
you really need them (it widens access).

---

## 5. Smoke test after deploying

1. Open the Vercel URL and sign in (`SYS010001` / `password`).
2. The spinner should appear, then the dashboard loads data.
3. Change the admin password immediately (12+ chars, mixed case, number, symbol).
4. Five bad logins in a row -> the sixth returns **429**.
5. Leave a tab idle for 30 minutes -> the next request returns **401
   `idle_timeout`** and the portal returns to the login page.
6. Inspect any API response headers: `X-Frame-Options: DENY`,
   `X-Content-Type-Options: nosniff`, `Content-Security-Policy`,
   `Cache-Control: no-store`.
7. `/api/v1/admin/dashboard` without a token -> **401**, not a redirect/HTML.

---

## 6. Security checklist before sharing the URL

- [ ] `APP_ENV=production`, `APP_DEBUG=false`
- [ ] Fresh `APP_KEY`, rotated DB password
- [ ] HTTPS only (Render + Vercel provide TLS; HSTS is sent by the middleware)
- [ ] `CORS_ALLOWED_ORIGINS` limited to the real frontend origin
- [ ] `TRUSTED_PROXIES=*` (Render is only reachable through its proxy)
- [ ] Demo accounts renamed, deactivated, or given strong passwords
- [ ] Aiven user limited to `SELECT, INSERT, UPDATE, DELETE` on app tables
- [ ] `php artisan migrate --force` completed; `php artisan config:cache` runs at boot
- [ ] Check `/up` and the login endpoint from a private/incognito window

---

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| 500 on every request | `APP_KEY` missing, or `storage`/`bootstrap/cache` not writable. Check Render logs (stderr). |
| `SQLSTATE[HY000] [2002]` | Wrong DB host/port, or Aiven firewall. Confirm the host ends with `aivencloud.com` and the port matches. |
| TLS / certificate error to MySQL | Keep `MYSQL_ATTR_SSL_CA=/etc/ssl/certs/ca-certificates.crt` (bundled in the image). |
| CORS error in the browser | `CORS_ALLOWED_ORIGINS` must match the exact origin (scheme + host, no slash). Redeploy after editing. |
| First request takes ~40 s | Render free instances sleep after idle; the first request wakes them. The loading screen covers it. |
| Login works locally but not online | `NEXT_PUBLIC_API_BASE_URL` must be the public Render URL ending in `/api/v1`; redeploy Vercel after changing it. |
| 419 / CSRF | This API is token based - make sure the client sends `Authorization: Bearer ...`, not cookies. |
| Migrations needed | Run them from your machine against the Aiven database (section 2). |

---

## 8. Alternatives (also free)

| Host | Notes |
| --- | --- |
| Koyeb (free) | One Docker web service, 512 MB, scales to zero. |
| Google Cloud Run | Generous always-free quota; needs a billing card. |
| Oracle Cloud Always Free VM | 4 ARM cores / 24 GB, always on; you run Nginx + PHP-FPM. |
| Railway / Fly.io | No longer genuinely free (trial credit / pay-as-you-go). |
| TiDB Cloud Starter | Free MySQL-compatible alternative if Aiven runs out of space. |
