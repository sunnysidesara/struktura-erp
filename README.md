# Struktura ERP: Construction Resource & Cost Management System

A construction resource and project cost management system that centralizes workforce allocation, skill management, project phases, equipment resources, material usage, and operational costs.

## Overview

Struktura ERP centralizes and automates workforce resource allocation, trade skill management, project phase tracking, and operational cost calculations across active construction sites.

Rather than relying on client-side application scripts or manual spreadsheet entries, Struktura ERP moves core business logic into the database layer using server-side automation:

- **Automated Cost Deduction** — When daily labor hours are logged by site supervisors, an automated database trigger calculates total labor cost (`hours_worked × hourly_rate`) and immediately deducts that amount from the corresponding project's remaining budget in real time.
- **Skill & Resource Mapping** — Manages complex assignment constraints by linking laborers with specialized trade skills and assigning them to active project phases via junction tables.
- **Data Integrity & Access Control** — Enforces 3rd Normal Form (3NF) relational constraints, foreign key cascades, and role-based data isolation across all system operations.

## The Problem It Solves

Construction firms often rely on spreadsheets and separate records to manage workers, skills, project phases, resources, and project costs. This makes resource allocation difficult and causes delays in detecting changes in project costs.

Struktura ERP centralizes these operations and uses database-level automation to record resource usage, calculate operational costs, update project budgets, and maintain data integrity.

## Running Locally

Two processes are required: the Laravel API (`/backend`) and the Next.js app (`/frontend`).

```powershell
# Terminal 1 — Laravel API on 0.0.0.0:8000
cd backend
php artisan serve --host=0.0.0.0 --port=8000

# Terminal 2 — Next.js on 0.0.0.0:3000
cd frontend
npm run dev
```

`--host=0.0.0.0` is required for the app to work from another device (phone/tablet) or
through the machine's LAN address. `php artisan serve` alone binds to `127.0.0.1`
only, so `http://<lan-ip>:8000` refuses the connection and the frontend reports
"Cannot reach the server".

The frontend derives the API URL from the browser host (`lib/api.ts`), so
`http://localhost:3000` calls `http://localhost:8000/api/v1` and
`http://172.16.0.2:3000` calls `http://172.16.0.2:8000/api/v1`. To pin a fixed URL,
set `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local` (include the `/api/v1` suffix).

When opening the app over the LAN, allow it on the backend too:

- `CORS_ALLOWED_ORIGINS` / `CORS_ALLOWED_ORIGIN_PATTERNS` in `backend/.env`
- `allowedDevOrigins` in `frontend/next.config.ts`
- Windows Firewall must permit inbound TCP on ports 3000 and 8000

