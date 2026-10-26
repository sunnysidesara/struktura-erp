# Struktura ERP - Security Hardening

This document records the threats reviewed, the controls that are now in
place, and the operational steps required before the system is exposed to a
network. It applies to the Laravel API (`backend/`) and the Next.js portal
(`frontend/`).

---

## 1. Threat model

| Threat | Attack example | Control |
| --- | --- | --- |
| SQL injection | `?q=' OR 1=1 --` in search, login or a URL id | Eloquent/query-builder bindings everywhere; the one interpolated `IN (...)` in `PmController::equipment()` now uses `?` placeholders |
| Insecure Direct Object Reference ("possession ID") | Changing `/pm/phases/7` or `?project_id=2` to another team''s record | Every PM/SS mutation re-checks `projects.user_id` / `projects.site_supervisor_id`; `?project_id=` is validated against the caller''s allowed ids; void/update endpoints re-check phase ownership |
| Credential brute force | Scripted login attempts against `SUP030001` | `throttle:login` = 5 attempts/minute and 30/hour per account id + IP |
| API abuse | Scraping every endpoint | `throttle:api` = 120 requests/minute per account (or IP) |
| Token theft / session hijack | Copying a bearer token from devtools, a shared PC, or a Wireshark capture | Tokens expire after 8 hours (`SANCTUM_EXPIRATION=480`) **and** are revoked after 30 minutes of inactivity (`SANCTUM_IDLE_TIMEOUT=30`); `logout-all` and password change revoke every other token; API responses are `Cache-Control: no-store` |
| Network sniffing (Wireshark) | Capturing the bearer token on plain HTTP | HTTPS is forced in production (`URL::forceScheme`), HSTS is sent, referrer policy is `no-referrer`; deployment must terminate TLS |
| XSS / script injection | Injected script reading `localStorage` | CSP (API + Next.js), `nosniff`, `frame-ancestors ''none''`, `object-src ''none''` |
| Clickjacking | Framing the portal and stealing clicks | `X-Frame-Options: DENY` + CSP `frame-ancestors ''none''` |
| Account enumeration | Distinguishing valid/inactive ids from login errors | One generic "credentials are incorrect" message for every failure |
| Weak passwords | `password123` | 12+ characters, upper + lower case, number and symbol (`Password::defaults`) |
| Error leakage | Stack traces returned as HTML | API exceptions render as JSON; production must run with `APP_DEBUG=false` |
| Over-permissive CORS | Any method/header from any origin | Explicit origin list, methods and headers, `supports_credentials=false` |

---

## 2. Files that implement the controls

- `backend/app/Http/Middleware/SecurityHeaders.php` - headers + `no-store` + HSTS.
- `backend/bootstrap/app.php` - global middleware, trusted proxies, JSON errors.
- `backend/app/Providers/AppServiceProvider.php` - rate limiters, password policy, HTTPS force.
- `backend/routes/api.php` - `throttle:login`, `throttle:api`, password-change throttle.
- `backend/config/sanctum.php` - token lifetime.
- `backend/config/cors.php` - allowed origins/methods/headers.
- `backend/app/Http/Middleware/EnforceIdleTimeout.php` - sliding idle revocation (global stack, before route auth).
- `backend/app/Http/Requests/**` - password policy and input normalisation.
- `frontend/next.config.ts` - page-level CSP and hardening headers.

---

## 3. Production checklist (before going live)

1. **TLS only.** Put the API behind Nginx/Apache/Cloudflare with a valid
   certificate and redirect all HTTP to HTTPS. Set `APP_FORCE_HTTPS=true`
   (or `APP_ENV=production`, which forces it automatically).
2. **Debug off.** `APP_ENV=production`, `APP_DEBUG=false`, `LOG_LEVEL=warning`.
3. **Secure cookies.** `SESSION_SECURE_COOKIE=true`, `SESSION_ENCRYPT=true`.
4. **Trusted proxies.** Set `TRUSTED_PROXIES` to the load balancer IPs so
   `$request->ip()` (used by the login limiter) is the real client address.
5. **CORS.** Set `CORS_ALLOWED_ORIGINS=https://your-portal.example` and leave
   `CORS_ALLOWED_ORIGIN_PATTERNS` empty in production.
6. **Database least privilege.** The app user needs `SELECT, INSERT, UPDATE,
   DELETE` on the application tables only - no `GRANT`, `FILE`, `DROP`, or
   access to other schemas. Keep the Aiven connection on TLS.
7. **Secrets.** Rotate `APP_KEY`, the DB password and any API tokens if a
   `.env` was ever shared or committed. Never commit `.env`.
8. **Token lifetime + idle timeout.** Tune `SANCTUM_EXPIRATION` (default
   480 minutes, absolute) and `SANCTUM_IDLE_TIMEOUT` (default 30 minutes,
   sliding). Set the idle timeout to 0 only if you deliberately want
   sessions that never expire while the tab is closed.
9. **Backups.** Schedule `mysqldump`/Aiven backups and test a restore; the
   audit trail (`audit_logs`, `login_history`) is part of the evidence.
10. **Dependencies.** Run `composer audit` and `npm audit` before every
    deployment.

---

## 4. Rules for future code

- Never build SQL with string interpolation. Use `where()`, `whereIn()`,
  `whereIntegerInRaw()` or `selectRaw($sql, $bindings)`.
- Every endpoint that accepts an `{id}` must verify the record belongs to the
  caller (project owner or site supervisor) before reading or writing.
- Validate every query string / body field with a `FormRequest` or
  `$request->validate()`; never pass `$request->all()` into `update()`.
- Never return `password_hash`, tokens, or full user rows from an endpoint.
- Log security-relevant changes (the existing `AuditObserver` already covers
  projects, phases, assignments, labor/material/equipment usage, tasks and
  users).

---

## 5. Known / accepted limitations

- **Bearer token in `localStorage`.** CSP mitigates script injection, but a
  successful XSS could still read the token. The next step is Sanctum SPA
  mode with an `HttpOnly`, `Secure`, `SameSite=Strict` cookie
  (`supports_credentials=true` + CSRF cookie), which makes the token
  unreadable from JavaScript.
- **Shared laborer master data.** Laborers are system-wide records by design;
  any Project Manager can maintain them. If per-project ownership is required,
  add a project scope to `LaborerController`.
- **No MFA.** Consider TOTP for Admin accounts.
- **No WAF.** A reverse-proxy WAF (Cloudflare/ModSecurity) adds rate limiting
  and OWASP rule coverage in front of Laravel.

---

## 6. If a token is suspected stolen

1. The user changes their password (revokes every other token) or uses
   "Sign out of all devices".
2. An Admin deactivates the account if compromise is confirmed.
3. Review `login_history` (IP/user-agent) and `audit_logs` for the window.
4. Rotate `APP_KEY` only if the application key itself leaked.