# How Struktura ERP Works — A Folder-by-Folder Walkthrough

This report explains **what every folder and file in the project does**, in simple words,
and then follows **one complete Create → Read → Update → Delete cycle** from the browser,
through the server, into the database, and back.

It is written for someone who knows a little about web apps but has never opened this
codebase.

---

## Contents

1. [The big picture — three boxes](#1-the-big-picture--three-boxes)
2. [The life of one click](#2-the-life-of-one-click)
3. [Frontend — what each folder is for](#3-frontend--what-each-folder-is-for)
4. [Backend — what each folder is for](#4-backend--what-each-folder-is-for)
5. [The database — tables and the money triggers](#5-the-database--tables-and-the-money-triggers)
6. [Full CRUD walkthrough: Phases](#6-full-crud-walkthrough-phases)
7. [Second example: a supervisor logs material usage](#7-second-example-a-supervisor-logs-material-usage)
8. [Login — how the browser proves who it is](#8-login--how-the-browser-proves-who-it-is)
9. [Cloud — what runs where](#9-cloud--what-runs-where)
10. [Something is broken — which folder to open](#10-something-is-broken--which-folder-to-open)
11. [Complete file cheat-sheet](#11-complete-file-cheat-sheet)
12. [Tiny glossary](#12-tiny-glossary)

---

## 1. The big picture — three boxes

The system is three separate programs that talk over the internet.

```
   ┌─────────────────────────┐        HTTPS         ┌──────────────────────────┐
   │  1. THE BROWSER         │  ───────────────►    │  2. THE API SERVER       │
   │  frontend/              │   JSON + token       │  backend/                │
   │  (Next.js + React)      │  ◄───────────────    │  (Laravel + PHP)         │
   └─────────────────────────┘                      └────────────┬─────────────┘
                                                                │ MySQL over TLS
                                                                ▼
                                                   ┌──────────────────────────┐
                                                   │  3. THE DATABASE         │
                                                   │  Aiven MySQL             │
                                                   │  tables + triggers       │
                                                   └──────────────────────────┘
```

**Box 1 — the browser (frontend).** Draws the screens, holds the user's login token,
and asks the API for data. It has **no** business rules and **no** database access. It
cannot be trusted; anyone can edit what runs in their own browser.

**Box 2 — the API server (backend).** The only part that is trusted. It checks who is
calling, decides what they may see, validates every field, writes to the database, and
records an audit trail.

**Box 3 — the database.** Stores the rows. It also does two jobs on its own:
it computes cost columns, and it moves money (`remaining_budget`) when usage rows are
written, using **triggers**.

### The three roles

| Role (as stored) | Short code used in the UI | What they do |
|---|---|---|
| `Admin` | `SA` (System Administrator) | Manage users, roles, skills, materials, equipment; read every project; read the audit trail |
| `Project Manager` | `PM` | Own projects: create projects, phases, tasks, assignments, log usage |
| `Site Supervisor` | `SS` | Work on the site assigned to them: log worker hours, materials, equipment; update task status |

The role decides which folder of screens the user lands in:
`/portal/dashboard/sa`, `/pm`, or `/ss`.

---

## 2. The life of one click

Here is the whole journey, using the example **"a Project Manager clicks + New Phase"**.
Keep this list next to you — every later section is a zoom-in on one of these steps.

| # | Where | Plain-English explanation |
|---|---|---|
| 1 | Browser | The user is on `/portal/dashboard/pm/phases`. That URL is a **file**: `frontend/app/portal/dashboard/pm/phases/page.tsx`. |
| 2 | Browser | They press **+ New Phase**. The page sets a flag (`modalOpen = true`) and a popup component appears: `phases/PhaseModal.tsx`. |
| 3 | Browser | They fill the form and press **Save**. The popup runs a few quick checks (is the name empty? is the date backwards?) and then calls a helper: `createPmPhase(...)` in `frontend/lib/api.ts`. |
| 4 | Browser → internet | `lib/api.ts` turns that call into `POST https://<server>/api/v1/pm/phases` with a JSON body and a header `Authorization: Bearer <token>`. The token was saved in `localStorage` at login. |
| 5 | Vercel / Render | The request leaves the browser and arrives at the **API server** (Render). TLS (the padlock) encrypts it the whole way. |
| 6 | Backend | Apache hands the request to `backend/public/index.php`, which boots Laravel through `bootstrap/app.php`. |
| 7 | Backend | Global "gatekeeper" checks run first: `SecurityHeaders` (wraps every answer) and `EnforceIdleTimeout` (has this token been unused for 30+ minutes?). |
| 8 | Backend | `routes/api.php` looks up the URL. `POST /pm/phases` exists, but only inside groups that require: a valid token → a request budget → the role `Project Manager`. |
| 9 | Backend | `EnsureRole` confirms the role. Then `PmController::storePhase()` runs. |
| 10 | Backend | The controller asks "which projects does this PM own?" (`projectIds()`), then refuses if the `project_id` in the request is not one of them. |
| 11 | Backend | Validation rules run (`validatePhase()`), then business rules: dates must be in order, phase budgets must fit the project budget. |
| 12 | Backend → database | `ProjectPhase::create([...])` becomes `INSERT INTO project_phases ...`. |
| 13 | Database | MySQL saves the row and hands back the new ID. |
| 14 | Backend | `AuditObserver` notices the insert and writes a second row into `audit_logs` with **who** did it and **what** was inserted. |
| 15 | Backend → browser | The controller answers `201 Created` with `{"message": "...", "data": {...}}`. `SecurityHeaders` adds the safety headers on the way out. |
| 16 | Browser | The popup closes, a green "saved" note appears, and the page calls `load()` again — which re-runs step 4 with `GET /pm/phases`, and the table shows the new row. |

Two things to notice:

- **Every write is checked twice**: once by the route (are you a Project Manager?) and once
  by the controller (is this *your* project?).
- **The browser never talks to MySQL.** It only ever talks to `/api/v1/...`.

---

## 3. Frontend — what each folder is for

**Folder:** `frontend/` — the website. Built with **Next.js 16** (a React framework) and
**TypeScript**. In Next.js the **folder structure *is* the URL structure**: a file called
`page.tsx` inside a folder becomes a web page at that folder's path.

```
frontend/
├─ app/          ← every screen (URLs)
├─ lib/          ← 4 helper files (the API client lives here)
├─ public/       ← images, videos, icons served as-is
├─ package.json  ← the list of libraries + the dev/build commands
├─ next.config.ts← security headers for the pages
├─ tsconfig.json ← TypeScript settings
├─ postcss.config.mjs / eslint.config.mjs ← styling + code-lint settings
└─ .env.local    ← local settings (API address)
```

### 3.1 `frontend/app/` — the pages

| File / folder | URL | What it is |
|---|---|---|
| `layout.tsx` | every page | The outer shell: sets the page title "STRUKTURA", loads the two fonts, wraps all pages in `<html><body>` |
| `globals.css` | every page | Global CSS (Tailwind import, resets, colours) |
| `page.tsx` + `page.module.css` | `/` | The **marketing landing page** (banner, services, "Log In" button) |
| `home/page.tsx` | `/home` | A second, longer version of the landing page |
| `not-found.tsx` | any bad URL | The "page not found" screen |
| `favicon.ico` | — | The little icon in the browser tab |
| `portal/` | `/portal...` | Everything behind the login (see 3.2) |

**Why `page.tsx` and `*.module.css` sit together:** the `.module.css` file is *scoped* — the
class names only apply to that one page, so two pages can both have a `.card` class without
clashing. This pattern repeats ~40 times in the project.

### 3.2 `frontend/app/portal/` — login and account

| File | URL | What it does |
|---|---|---|
| `page.tsx` | `/portal` | The **login screen**. Calls `login()` from `lib/api.ts`, saves the token, then sends the user to their role's dashboard. Shows "Your session expired" if it was redirected by a 401. |
| `page.module.css` | — | Styling for the login card and the background video |
| `change-password/page.tsx` | `/portal/change-password` | Standalone change-password screen — "Set a new password to continue" |
| `_components/SpinnerRing.tsx` | — | The small spinning circle used while a button is busy |

The login screen is the only page that talks to the API **without** a token
(`auth: false` in `lib/api.ts:235`).

### 3.3 `frontend/app/portal/dashboard/` — the shell around every screen

Everything after login shares one shell: a left sidebar, a top header, notifications, and
the project/site switcher. It lives here once instead of on every page.

| File | What it does |
|---|---|
| `layout.tsx` | The **guard + shell**. On load it reads the token and user from `localStorage`; if either is missing it sends the user back to `/portal`. It also checks the URL matches the user's role (a PM cannot open `/sa/...`) and redirects if not. Then it draws the sidebar, header, search box, bell menu, profile menu and logout button. |
| `layout.module.css` | Shell styling (sidebar width, header height, mobile drawer) |
| `sidebarData.ts` | The menu itself, as data. Three lists (`saSidebar`, `pmSidebar`, `ssSidebar`) of links and collapsible groups, plus `getSidebarData(role)` which returns the right one. |
| `not-found.tsx` | "Screen not found" *inside* the dashboard (so the user keeps the sidebar) |
| `_components/AppBootScreen.tsx` | Full-screen "starting up" screen shown before the user is loaded |
| `_components/AppLoadingScreen.tsx` | Full-screen spinner shown while page data is loading |
| `_components/projectScope.ts` | The shared "which project am I looking at?" store. Saves the choice in `localStorage`, notifies every screen when it changes, and can list the projects to choose from. |
| `_components/ProjectSwitcher.tsx` | The dropdown in the header that changes that selection |
| `_components/RecordDetails.tsx` | A reusable read-only "View" popup: title + a list of label/value rows. Every "View" button on every table uses it. |
| `_components/StatusActions.tsx` | A reusable set of "change status" buttons (Start, Approve, etc.) with confirmation |

**What the `_components` underscore means:** folders starting with `_` are **not** URLs.
`_components/RecordDetails.tsx` is a shared piece, not a page at `/portal/dashboard/_components`.

**How the "selected project" works (important):** the Project Manager picks one project in
the header. That choice is stored once, and every PM page reads it to decide what to load.
Same idea for the Site Supervisor, but with a *site* (`ss/_components/siteSelection.ts`).

### 3.4 `frontend/app/portal/dashboard/pm/` — the Project Manager console

| File | URL | What it does |
|---|---|---|
| `page.tsx` | `/pm` | Overview: counts, budget cards, quick lists |
| `projects/page.tsx` | `/pm/projects` | Table of the PM's projects: search, status filter, View / Edit / Select, + New Project |
| `projects/ProjectModal.tsx` | — | Create/edit form for a project (name, client, location, supervisor, dates, budgets) |
| `phases/page.tsx` | `/pm/phases` | Table of phases for the selected project |
| `phases/PhaseModal.tsx` | — | Create/edit form for a phase |
| `phases/PhasesDetail.tsx` | — | Detail panel: phases + progress |
| `phases/TasksPanel.tsx` | — | The task list inside a phase |
| `phases/TaskModal.tsx` | — | Create/edit form for a task |
| `workforce/page.tsx` | `/pm/workforce` | Labourers and who is assigned where |
| `workforce/LaborerModal.tsx` | — | Create/edit a labourer (name, skill, rate, status) |
| `workforce/AssignModal.tsx` | — | Assign a labourer to a phase |
| `workforce/WorkforceDetail.tsx` | — | Labourer detail view |
| `supervisors/page.tsx` | `/pm/supervisors` | Directory of Site Supervisors (used when assigning a project) |
| `finance/page.tsx` | `/pm/finance` | Budget vs spend, remaining budget |
| `materials/page.tsx` | `/pm/materials` | Material usage for the selected project |
| `equipment/page.tsx` | `/pm/equipment` | Equipment usage for the selected project |
| `search/page.tsx` | `/pm/search` | Search across the PM's own data only |
| `_components/CataloguePanel.tsx` | — | Shared material/equipment catalogue panel |
| `_components/DetailModal.tsx` | — | Generic "record details" popup |
| `_components/FormModal.tsx` | — | The shared form shell (backdrop, Escape to close, Save/Cancel buttons, error line) |
| `_components/PmProjectGate.tsx` | — | "Pick a project first" wall shown on pages that need a selection |
| `_components/PmProjectSwitcher.tsx` | — | The project dropdown in the header |
| `_components/projectSelection.ts` | — | PM-flavoured wrapper around `projectScope.ts` (`usePmProject`, `selectPmProject`, `resetPmSelection`) |
| `_components/ProjectMaster.tsx` | — | The reusable project table |
| `_components/UsageDetail.tsx` | — | Size of the material/equipment usage tables |
| `page.module.css` | — | PM-only styles |

**Pattern to remember:** every one of these pages does only three things —
**(1)** call an API function on load, **(2)** keep the returned rows in `useState`,
**(3)** draw them with the shared `SaPage` + `SaTable` components. When you understand one
page, you understand all of them.

### 3.5 `frontend/app/portal/dashboard/sa/` — the Admin console

| File | URL | What it does |
|---|---|---|
| `page.tsx` | `/sa` | Admin overview: user counts, project health, recent activity |
| `users/page.tsx` | `/sa/users` | Directory of accounts; activate/deactivate; open the create form |
| `users/CreateUserModal.tsx` | — | Form to create an account (role, name, email, password) |
| `users/create/page.tsx` | `/sa/users/create` | Full-page version of that form |
| `users/roles/page.tsx` | `/sa/users/roles` | The three roles and what they mean (read-only) |
| `skills/page.tsx` + `skills/SkillModal.tsx` | `/sa/skills` | The trade-skill catalogue: add, edit, delete |
| `projects/page.tsx` | `/sa/projects` | **Every** project (Admin is not limited to one owner) |
| `phases/page.tsx` | `/sa/phases` | Every phase |
| `assignments/page.tsx` | `/sa/assignments` | Every worker assignment |
| `resources/page.tsx` + `resources/CatalogueModal.tsx` | `/sa/resources` | Materials and equipment stock: create, edit, delete, change equipment status |
| `usage/page.tsx` | `/sa/usage` | Material and equipment usage across projects |
| `labor-logs/page.tsx` | `/sa/labor-logs` | Worker hour logs across projects |
| `finance/page.tsx` | `/sa/finance` | Budget vs spend per project |
| `audit/page.tsx` | `/sa/audit` | The audit trail (who changed what) and login history |
| `search/page.tsx` | `/sa/search` | Global search (users, skills, projects, phases, assignments, materials, equipment) |
| `_components/SaPage.tsx` | — | **The most reused file in the app** — exports `SaPage` (page frame), `SaPanel` (card), `Tabs`, `SaTable` (table with loading/empty/error states), `StatusBadge`, `MetricCard`, `money()`, `formatDate()`, `useApiData()` |
| `page.module.css`, `audit/page.module.css` | — | Admin styling |

The PM and SS screens **also** import `sa/_components/SaPage.tsx`. It is named after the
Admin console because that is where it started, but it is the shared UI kit.

### 3.6 `frontend/app/portal/dashboard/ss/` — the Site Supervisor console

| File | URL | What it does |
|---|---|---|
| `layout.tsx` | `/ss/*` | Extra wrapper for supervisor screens (keeps the chosen site) |
| `page.tsx` | `/ss` | Site overview: today's workers, materials, equipment, progress |
| `site/page.tsx` + `site/SiteDetail.tsx` | `/ss/site` | Details of the assigned site |
| `schedule/page.tsx` | `/ss/schedule` | Today / this week / all tasks |
| `phases/page.tsx` + `phases/PhasesDetail.tsx` | `/ss/phases` | Phases of the site, with "request completion" |
| `logs/page.tsx` | `/ss/logs` | Tabbed log screen (workers / materials / equipment) |
| `logs/LaborTab.tsx` | — | Worker-hours form + list |
| `logs/MaterialsTab.tsx` | — | Material-usage form + list |
| `logs/EquipmentTab.tsx` | — | Equipment-usage form + list |
| `logs/workers/page.tsx` | `/ss/logs/workers` | Same worker log as its own page (sidebar link) |
| `logs/materials/page.tsx` | `/ss/logs/materials` | Same material log as its own page |
| `logs/equipment/page.tsx` | `/ss/logs/equipment` | Same equipment log as its own page |
| `search/page.tsx` | `/ss/search` | Search **within the selected site only** |
| `_components/siteSelection.ts` | — | "Which site am I on?" store (same idea as the PM one) |
| `_components/SsSiteSwitcher.tsx` | — | The site dropdown |
| `_components/SsSiteGate.tsx` | — | "Choose a site first" wall |
| `_components/SsReport.tsx` | — | Printable/downloadable site report |
| `_components/useSsResource.ts` | — | Hook that loads a site-scoped API resource and reloads it on demand |
| `ss.module.css` | — | Supervisor styling |

### 3.7 Shared account screens

| File | URL | What it does |
|---|---|---|
| `profile/page.tsx` | `/portal/dashboard/profile` | "My Profile": account details, **recent login activity** (IP + device), sign out |
| `settings/page.tsx` | `/portal/dashboard/settings` | "Settings": edit profile, change password, log out, notification preferences |

Both are reachable by **all three roles** — that is why `layout.tsx` treats them as
"account routes" and does not force a role-specific redirect.

### 3.8 `frontend/lib/` — four helper files

| File | What it does |
|---|---|
| `api.ts` | **The API client.** ~1,090 lines. Holds the token helpers (`getToken`, `saveSession`, `clearSession`), the one low-level `request()` function, and about 200 small exported functions — one per backend endpoint (`listPmProjects`, `createPmPhase`, `deleteSsMaterialUsage`, …). Every screen imports from here; no screen calls `fetch` directly. |
| `loading.ts` | A tiny counter of "requests in flight". `request()` adds 1 before and subtracts 1 after, so the UI can show one global spinner instead of each page inventing its own. |
| `confirmDelete.ts` | One shared `confirmDelete(message)` → the browser's yes/no warning used before every delete/void button. |
| `device.ts` | `describeDevice(userAgent)` turns a long user-agent string into "Chrome / Windows" for the login-history list. |

**The one function that matters most — `request()`** (`lib/api.ts:160-223`), in plain words:

1. count the request as "busy" (spinner),
2. build the URL: API base + path,
3. add `Accept: application/json`, plus `Content-Type: application/json` if there is a body,
4. add `Authorization: Bearer <token>` unless the call is public (login),
5. `fetch(...)`,
6. if the answer is `401`, wipe the saved session and jump to `/portal?reason=session-expired`,
7. if the answer is an error, throw an `ApiError` carrying the server's message and field errors,
8. otherwise return the parsed JSON.

Because of that one function, "expired token" and "the server said no" behave the same way on
every screen.

### 3.9 `frontend/public/` and the config files

| File / folder | What it does |
|---|---|
| `public/assets/*.png`, `*.jpg`, `login-vid.mp4` | Images and the login background video, served exactly as-is at `/assets/...` |
| `public/*.svg` | Small placeholder icons that came with Next.js |
| `package.json` | Libraries (next 16.3.6, react 19.2.8) and commands: `npm run dev`, `build`, `start`, `lint` |
| `next.config.ts` | Adds security headers to **every page** (CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS in production) and allows the LAN addresses used in development |
| `tsconfig.json` | TypeScript rules + the `@/` shortcut, so `@/lib/api` means `frontend/lib/api` |
| `postcss.config.mjs` | Enables Tailwind CSS v4 |
| `eslint.config.mjs` | Code-quality rules |
| `.env.local` | Local setting `NEXT_PUBLIC_API_BASE_URL` (the API address). On Vercel the same value is set in the dashboard. |
| `next-env.d.ts`, `tsconfig.tsbuildinfo` | Generated files — never edit |
| `README.md`, `AGENTS.md`, `CLAUDE.md` | Notes for developers / AI assistants |

---

## 4. Backend — what each folder is for

**Folder:** `backend/` — the trusted server. Built with **Laravel 12** (PHP 8.2).

```
backend/
├─ public/       ← the front door: only this folder is reachable from the web
├─ routes/       ← the URL map (which URL runs which function)
├─ bootstrap/    ← startup file + middleware order
├─ app/          ← the actual application code
│   ├─ Http/Controllers/Api/  ← 9 controllers (the "workers")
│   ├─ Http/Middleware/       ← 3 gatekeepers
│   ├─ Http/Requests/         ← input-checking form classes
│   ├─ Models/                ← 16 classes, one per table
│   ├─ Observers/             ← the audit note-taker
│   ├─ Providers/             ← glue + settings
│   └─ Support/               ← two small helper classes
├─ config/       ← 12 settings files (database, cors, sanctum, …)
├─ database/     ← migrations, SQL schema, seeders, factories, demo data
├─ docker/       ← Apache config, Aiven certificate, start-up script
├─ resources/    ← leftover Blade/CSS/JS (not used by the API)
├─ storage/      ← logs, compiled views, cache, uploaded files
├─ tests/        ← automated tests
├─ vendor/       ← downloaded libraries (never edit)
├─ artisan       ← command-line tool: `php artisan serve`, `migrate`, …
├─ composer.json ← PHP libraries
├─ Dockerfile    ← how the server image is built
├─ phpunit.xml   ← test settings
└─ .env          ← secret settings (never commit)
```

### 4.1 `backend/public/` — the front door

| File | What it does |
|---|---|
| `index.php` | The **only** PHP file the web server runs directly. It loads `vendor/autoload.php`, boots Laravel from `bootstrap/app.php`, and hands over the request. 22 lines, never needs editing. |
| `.htaccess` | Apache rules: no folder listings (`-Indexes`), pass the `Authorization` header through to PHP, and send unknown URLs to `index.php`. |
| `robots.txt`, `favicon.ico` | Search-engine hint and icon |

**Why this matters:** the web root is `public/`, not the project root. So a visitor cannot
download `backend/.env`, `backend/config/database.php` or any source file by guessing a URL.

### 4.2 `backend/routes/` — the URL map

| File | What it does |
|---|---|
| `api.php` | **The whole API.** 220 lines. Every URL the frontend calls is declared here, grouped by who may use it. |
| `web.php` | The browser (non-API) route: `/` returns a simple welcome page. The React app does not use it. |
| `console.php` | Command-line routes/schedules (nothing scheduled today) |

How `api.php` is organised, top to bottom:

| Lines | Content |
|---|---|
| 37-81 | A temporary diagnostic route `/_diag` (explains database connection problems) |
| 83 | `Route::prefix('v1')` → every URL starts `/api/v1` |
| 85 | `POST /login` — the only public write, with a brute-force throttle |
| 88-220 | Big group: `auth:sanctum` + `throttle:api` → a token is required |
| 89-96 | `/me`, profile update, password change, logout, logout-all, my logins, notifications |
| 99 | `GET /roles` — any signed-in user may read the three roles |
| 102-132 | **Admin only** (`role:Admin`): users, materials/equipment, audit, search, skills |
| 135-157 | **Admin + PM** read access to the PM console data |
| 161-187 | **PM only** writes: projects, phases, tasks, assignments, labourers, usage |
| 192-203 | **Admin + SS** read access to the supervisor console |
| 205-217 | **SS only** writes: daily logs, task status, completion request |

The nesting is deliberate: a PM route sits inside the Admin+PM group *and* inside a PM-only
group, so an Admin can look but not touch.

### 4.3 `backend/bootstrap/` — startup

| File | What it does |
|---|---|
| `app.php` | 45 lines that assemble the app: which route files to load, which middleware to run and in what order (`SecurityHeaders` first, `EnforceIdleTimeout` last), whether to trust proxy headers, and "always answer `/api/*` with JSON". |
| `providers.php` | The list of service providers (just `AppServiceProvider`) |
| `cache/` | Generated files: `config.php`, `routes-v7.php`, `packages.php`. Created by `php artisan config:cache`; not hand-edited. |

The order in `app.php` matters more than it looks:

1. `SecurityHeaders` is **prepended** → it wraps everything, so even an error response gets
   the safety headers.
2. `EnforceIdleTimeout` is **appended** → it runs before route authentication, so it still
   sees the *old* "last used" time.

### 4.4 `backend/app/Http/Middleware/` — the three gatekeepers

| File | What it does, in plain words |
|---|---|
| `SecurityHeaders.php` | On the way out it stamps every answer with "don't guess my file type" (`nosniff`), "don't put me in a frame" (`X-Frame-Options: DENY`), "don't remember this" (`Cache-Control: no-store`), a strict script policy, and — only over HTTPS in production — "always use HTTPS from now on" (HSTS). It also hides the PHP version. |
| `EnforceIdleTimeout.php` | Reads the login token from the `Authorization` header, looks it up, and checks when it was last used. If that was more than 30 minutes ago it **deletes** the token and answers `401` with `reason: idle_timeout`. |
| `EnsureRole.php` | Checks the signed-in user's role name against the list the route asked for (`role:Admin`, `role:Admin,Project Manager`, …). Wrong role → `403`. |

### 4.5 `backend/app/Http/Requests/` — the input-checking forms

A **FormRequest** is a class that runs *before* the controller and answers one question:
"is this request even allowed to continue?"

| Folder / file | Used by | What it checks |
|---|---|---|
| `Auth/LoginRequest.php` | login | `id_number` required, string, max 20; `password` required, string |
| `Auth/ChangePasswordRequest.php` | change password | current password required; new password confirmed, must pass the global policy, must differ from the old one |
| `User/StoreUserRequest.php` | Admin creates a user | trims names, lower-cases the email, `role_id` must be one of the three real roles, name/phone character rules, unique email, strong password |
| `User/UpdateUserRequest.php` | Admin edits a user | same rules but all optional; uniqueness ignores the row being edited |
| `User/UpdateProfileRequest.php` | a user edits themselves | name + email + phone; strips `+63 917-123-4567` down to digits |

If a rule fails, Laravel stops immediately and returns `422` with a list of field errors —
the controller never runs.

### 4.6 `backend/app/Http/Controllers/Api/` — the nine workers

A controller is where the actual work happens: read input → check permission → query or
write → return JSON.

| File | Lines | Responsible for |
|---|---|---|
| `AuthController.php` | 264 | Login, logout, logout-all, `/me`, profile update, password change, my login history, notifications |
| `UserController.php` | 202 | Admin's user list, create, update, activate, deactivate |
| `RoleController.php` | 21 | The read-only list of the three roles |
| `SkillController.php` | 72 | Admin's skill catalogue (list/create/update/delete) |
| `LaborerController.php` | 230 | PM's labourers: list, view, create, update, delete, attach/detach skills, change status |
| `TaskController.php` | 354 | Site tasks: list for the right projects, create, edit, delete, change status |
| `PmController.php` | 1,778 | The **biggest** one. Project Manager console: projects, phases, assignments, workforce, budgets, costs, search, material/equipment usage |
| `SsController.php` | 2,026 | The other **biggest** one. Site Supervisor console: dashboard, site, schedule, workers, phases, logs (labour/material/equipment), search |
| `AdminController.php` | 510 | Admin console: dashboard, all projects/phases/assignments, materials + equipment CRUD, audit events, audit logins, global search |

`Controller.php` (6 lines) is an empty parent class they all extend — it exists so Laravel
recognises them as controllers.

**The two helper methods you will see everywhere** (in `PmController` and `SsController`):

```php
allowedProjectIds($request)  // "which projects does this user own?" (Admin: all of them)
projectIds($request)         // "...and of those, which one did they pick in the header?"
```

Every query is then filtered by the returned list. That is how the system stops Project A's
manager from reading Project B's data.

**Inside a typical controller method, the order is always:**

1. `$request->validate([...])` or a FormRequest → shape of the input,
2. permission/ownership check → `in_array($id, $ids, true)` or `phaseFor(...)`,
3. business rules → dates, budgets, stock, status transitions,
4. write with a **Model** (`ProjectPhase::create`, `$model->update`, `$model->delete`),
5. `response()->json([...], 201 | 200 | 422 | 403)`.

### 4.7 `backend/app/Models/` — one class per table

A **model** is a PHP class that represents one table. `Project::find(5)` means
`SELECT * FROM projects WHERE project_id = 5`. Models also declare which columns may be
written (`$fillable`) and how values are converted (`casts`).

| Model file | Table | What one row means |
|---|---|---|
| `User.php` | `users` | An account. The password column is `password_hash`; the `'hashed'` cast hashes it automatically and `$hidden` keeps it out of JSON. |
| `Role.php` | `role` | One of the three roles (`Admin`, `Project Manager`, `Site Supervisor`) |
| `LoginHistory.php` | `login_history` | One login attempt: who, from which IP, which browser, success/fail |
| `AuditLog.php` | `audit_logs` | One change: table, record id, INSERT/UPDATE/DELETE, old value, new value, who, when |
| `Skill.php` | `skill` | A trade (mason, electrician, …) |
| `Laborer.php` | `laborer` | A worker: name, contact, `hourly_rate`, status |
| `LaborerSkill.php` | `laborer_skill` | Link row: this worker has this skill |
| `Project.php` | `projects` | A project: name, client, location, **owner** (`user_id`), **supervisor** (`site_supervisor_id`), three budgets, `remaining_budget`, status |
| `ProjectPhase.php` | `project_phases` | One stage of a project (its own cost, budgets, dates, status) |
| `WorkforceAssignment.php` | `workforce_assignment` | This worker is assigned to this phase, at this rate |
| `SiteTask.php` | `site_task` | A task on a date, optionally inside a phase and assigned to a worker |
| `Material.php` | `materials` | Material catalogue: name, unit, unit cost, stock on hand |
| `MaterialUsage.php` | `material_usage` | Quantity of a material used on a phase on a date (cost is generated) |
| `Equipment.php` | `equipment` | Equipment catalogue: name, type, hourly rate, status |
| `EquipmentUsage.php` | `equipment_usage` | Hours a machine was used on a phase on a date (cost is generated) |
| `LaborHourLog.php` | `labor_hour_log` | Hours a worker worked on a phase on a date (cost is generated) |

Two conventions worth knowing:

- **`$primaryKey`** is set to `user_id`, `project_id`, `phase_id`, etc. — the project does
  not use the default `id`.
- **Writes go through models, not raw SQL**, because the audit observer only sees model
  events (see 4.8).

### 4.8 `backend/app/Observers/` — the note-taker

`AuditObserver.php` (148 lines) listens to every create/update/delete on 13 of those models
and writes a row into `audit_logs`:

| What happens | What the observer records |
|---|---|
| New row created | `INSERT` + all the new values |
| Row changed | `UPDATE` + only the fields that changed (old → new) |
| Row deleted | `DELETE` + a full snapshot of what was removed |

It also **removes secrets** before saving: `password`, `password_hash`,
`password_confirmation`, `remember_token`, `token`.

And if the audit write fails, it logs the error and lets the business operation succeed —
a broken audit table must not take the whole ERP down.

### 4.9 `backend/app/Providers/` and `backend/app/Support/`

| File | What it does |
|---|---|
| `Providers/AppServiceProvider.php` | Runs at start-up. Sets the **rate limits** (5 login tries per minute, 30 per hour, 120 API calls per minute), the **password policy** (12+ chars, upper/lower, number, symbol), forces **HTTPS** in production, and registers the audit observer on all 13 models. |
| `Support/CostPostingTriggers.php` | Holds the SQL text for the nine database triggers that move money (see section 5). A migration installs them. |
| `Support/ProjectBudget.php` | Tiny calculator: given approved/remaining/recorded, returns `spent_budget`, `utilization` %, and `recorded_costs` so the Admin table and the PM finance screen agree. |

### 4.10 `backend/config/` — settings files

Every file returns a PHP array. Values come from `.env` (environment variables), so the same
code runs locally and in production with different settings.

| File | Controls |
|---|---|
| `app.php` | App name, timezone (`Asia/Manila`), debug on/off, `APP_KEY` + AES-256-CBC cipher |
| `auth.php` | The `web` guard and the `users` provider (Eloquent → `App\Models\User`) |
| `sanctum.php` | Token lifetime (**480 min**), idle timeout (**30 min**), token prefix, Sanctum middleware |
| `cors.php` | Which website origins may call the API (default `localhost:3000`), which methods/headers, `supports_credentials = false` |
| `database.php` | The MySQL connection (host/port/user/password from `.env`), TLS certificate option, `strict` mode |
| `session.php` | Session driver/lifetime, cookie flags (`httpOnly`, `secure`, `sameSite`) |
| `cache.php` | Where cached values live (database by default) |
| `queue.php` | Background jobs (database) |
| `logging.php` | Where logs go (single file locally, `stderr` in production) |
| `filesystems.php` | Local disk paths (nothing sensitive is uploaded today) |
| `mail.php` | Mail settings (not used — the app sends no email) |
| `services.php` | Third-party keys (empty) |

### 4.11 `backend/database/` — how the database is built and filled

| Folder | What is inside | What it is for |
|---|---|---|
| `migrations/` | 19 files | Versioned database changes. `php artisan migrate` runs them in filename order. They create the framework tables (`role`, `users`, `cache`, `jobs`, `personal_access_tokens`, `login_history`) and then **alter** the ERP tables (add contact number, budgets, shift/times, completion tracking), install the cost triggers, and make the cost columns generated. |
| `schema/` | `struktura_erp_schema.sql`, `laravel_framework_tables.sql` | The **full table definitions** for the ERP itself (projects, phases, labourers, usage, audit…). These are imported once with a SQL client; the migrations then keep them up to date. |
| `seed/` | `pm_demo_data.sql`, `ss_demo_data.sql`, `sa_demo_data.sql` | Ready-made demo rows per role, so a fresh database has something to show |
| `seeders/` | `DatabaseSeeder.php`, `RoleSeeder.php`, `AdminUserSeeder.php`, `ExampleUsersSeeder.php` | PHP seeders: `php artisan db:seed` creates the three roles and the demo accounts (`SYS010001`, `PM020001`, `SUP030001`) |
| `factories/` | `RoleFactory.php`, `UserFactory.php` | Generates fake rows for automated tests |

**The order that actually builds a database:**

1. import `database/schema/struktura_erp_schema.sql` (creates the ERP tables),
2. `php artisan migrate` (framework tables + column changes + triggers),
3. `php artisan db:seed` (roles + demo accounts),
4. optionally run the `database/seed/*.sql` demo data.

### 4.12 `backend/docker/` and the `Dockerfile`

| File | What it does |
|---|---|
| `Dockerfile` | Builds the server image: PHP 8.2 + Apache, installs the PHP extensions Laravel needs, copies the Aiven certificate into the system trust store, runs `composer install --no-dev`, copies the code, points Apache at `/var/www/html/public`. |
| `docker/apache-vhost.conf` | Apache site config: document root = `public/`, allow `.htaccess`, send unknown paths to `index.php`. |
| `docker/entrypoint.sh` | Runs when the container starts: creates the writable folders, fixes permissions, switches Apache to the port the host gives it, then runs `config:cache` and `route:cache` so Laravel starts fast with the real environment values. |
| `docker/ca.pem` | Aiven's certificate. Copied into the OS trust store so the MySQL TLS connection can be verified. Also kept at `storage/ca.pem` for local use. |

### 4.13 The remaining backend folders

| Folder / file | What it is |
|---|---|
| `storage/` | Runtime files: `logs/laravel.log`, `framework/cache`, `framework/sessions`, `framework/views`, plus `ca.pem`. Must be writable by the web user. |
| `tests/` | 19 files (18 test classes). `Feature/` tests call the real HTTP API (login, users, projects, phases, tasks, workforce, materials, statuses, audit); `Unit/` tests the budget calculator. Run with `php artisan test`. |
| `vendor/` | Every PHP library downloaded by Composer (Laravel, Symfony, etc.). Huge, auto-generated — **never edit**. |
| `resources/` | `views/welcome.blade.php`, `css/app.css`, `js/*` — the default Laravel leftovers. The API does not use them. |
| `artisan` | The command-line tool: `php artisan serve`, `migrate`, `db:seed`, `test`, `config:cache`. |
| `composer.json` / `composer.lock` | The PHP dependency list / the exact locked versions. |
| `phpunit.xml` | Test settings: SQLite in memory, `BCRYPT_ROUNDS=4` (fast hashing for tests). |
| `package.json` + `vite.config.js` | Asset build settings for the unused Blade page. |
| `.env` / `.env.example` | Real secrets (never committed) / a documented template. |
| `README.md` | Short backend readme. |

---

## 5. The database — tables and the money triggers

### 5.1 How the tables relate

Read `→` as "one row points to many rows in".

```
role ──► users ──┬──► projects (user_id           = the Project Manager who owns it)
                 ├──► projects (site_supervisor_id = the Site Supervisor on site)
                 ├──► login_history
                 └──► personal_access_tokens   (login tokens)

projects ──► project_phases ──┬──► workforce_assignment ──► labor_hour_log
                              ├──► material_usage
                              ├──► equipment_usage
                              └──► site_task ──► laborer (optional worker)

laborer ──► laborer_skill ──► skill          (a worker's trades)
materials ──► material_usage                 (catalogue → what was used)
equipment ──► equipment_usage                (catalogue → what was used)
audit_logs                                   (points at any table by name + id)
```

### 5.2 The tables in plain words

| Group | Tables | What they hold |
|---|---|---|
| **Identity** | `role`, `users`, `login_history`, `personal_access_tokens` | Who can log in, what they may do, and every attempt (successful or not) |
| **Projects** | `projects`, `project_phases`, `site_task`, `workforce_assignment` | The work: a project has phases, a phase has workers and tasks |
| **Catalogues** | `skill`, `laborer`, `laborer_skill`, `materials`, `equipment` | The reusable "master data": workers, trades, materials, machines |
| **Money** | `labor_hour_log`, `material_usage`, `equipment_usage` | Daily records of what was consumed. Each row has a **cost** |
| **Audit** | `audit_logs` | Every insert/update/delete, with old and new values |

### 5.3 The part that makes this ERP unusual: costs are computed by the database

Two mechanisms, both installed by migrations:

**(a) Generated columns.** `computed_cost` on the three usage tables is a
**generated column** — the database calculates it from the snapshot rate and the quantity.
It cannot be typed in by a user, and it cannot drift out of sync.

```
labor_hour_log.computed_cost  = (regular_hours + overtime_hours) × rate_at_use
material_usage.computed_cost  = quantity_used × unit_cost_at_use
equipment_usage.computed_cost = hours_used × hourly_rate_at_use
```

The `*_at_use` columns matter: they store the price **on the day of use**, so changing a
material's price next month does not rewrite last month's costs.

**(b) Triggers.** Nine triggers — insert / update / delete on each of the three usage
tables — move the money:

| Event | What the trigger does |
|---|---|
| Insert a usage row | `projects.remaining_budget = remaining_budget − computed_cost` |
| Update a usage row | adds back the old cost, subtracts the new one (delta) |
| Delete / void a usage row | adds the cost back (a refund) |

Because the trigger runs inside the same transaction as the insert, either **both** the
usage row and the budget change happen, or neither does. A bug in the application cannot
silently spend money without a record, and voiding a log gives the money back.

**Why the code still checks budgets**: the trigger only *posts* what it is given. The
controllers refuse to create a usage row that would exceed the phase/project allocation, so
the business rule ("you cannot spend more than you have") and the bookkeeping (posting the
cost) are separate layers.

### 5.4 Constraints that protect the data

| Constraint | Example |
|---|---|
| Primary keys | `project_id`, `phase_id`, `user_id`, `material_id`, … |
| Foreign keys | `project_phases.project_id → projects.project_id`; deleting a phase's parent is blocked or cascades by design |
| Unique keys | `users.id_number`, `users.email`, `materials.material_name`, `equipment.equipment_name` |
| Enums / allowed values | status columns (`Not Started`, `In Progress`, `Completed`), `login_history.status` (`success`, `failed`) |
| Strict mode | MySQL rejects invalid/oversized values instead of trimming them silently |

---

## 6. Full CRUD walkthrough: Phases

We follow **one phase** through Create, Read, Update and Delete. Everything you learn here
applies to projects, tasks, labourers, materials, equipment and assignments — they use the
same chain with different names.

**The files involved**

| Layer | File | Role |
|---|---|---|
| Page | `frontend/app/portal/dashboard/pm/phases/page.tsx` | 26 lines: draws the frame, insists a project is selected, then renders the panel |
| Panel | `frontend/app/portal/dashboard/pm/phases/PhasesDetail.tsx` | The real screen: loads data, holds it in state, handles status/delete |
| Form | `frontend/app/portal/dashboard/pm/phases/PhaseModal.tsx` | The create/edit popup |
| API client | `frontend/lib/api.ts` | `listPmPhases` (535), `createPmPhase` (560), `updatePmPhase` (563), `deletePmPhase` (579) |
| Routes | `backend/routes/api.php` | `GET /pm/phases` (138), `POST /pm/phases` (171), `PUT /pm/phases/{phase}` (172), `DELETE /pm/phases/{phase}` (176) |
| Controller | `backend/app/Http/Controllers/Api/PmController.php` | `phases()` (316), `storePhase()` (744), `updatePhase()` (1096), `destroyPhase()` (1150) |
| Model | `backend/app/Models/ProjectPhase.php` | The `project_phases` table |
| Audit | `backend/app/Observers/AuditObserver.php` | Writes the history row |

### 6.1 CREATE — "add a phase to my project"

| # | Layer | File | What happens |
|---|---|---|---|
| 1 | Screen | `pm/phases/page.tsx` | Page loads. `usePmProject()` tells it which project is selected. If none → `<PmProjectGate>` shows "pick a project first". |
| 2 | Screen | `pm/phases/PhasesDetail.tsx:44-55` | `load()` runs `listPmPhases(project.project_id)` and stores the array in `useState` (`setPhases`). |
| 3 | Screen | `PhasesDetail.tsx:294` | The **+ New Phase** button opens `<PhaseModal open={...} phase={null} />`. `phase={null}` means "create", not "edit". |
| 4 | Form | `PhaseModal.tsx` | User types name, description, cost, budgets, dates, required skill. **Client-side checks** run first: empty name, end date before start date, phase cost above what is left for the project. These checks are for speed only — the server checks again. |
| 5 | Form | `PhaseModal.tsx:205-223` | Builds the payload (`phase_name`, `project_cost`, `materials_budget`, …) and calls `createPmPhase({ ...payload, project_id })`. |
| 6 | API client | `lib/api.ts:560` | `request("/pm/phases", { method: "POST", body })`. |
| 7 | API client | `lib/api.ts:173-199` | Adds `Authorization: Bearer <token>`, `Content-Type: application/json`, sends `fetch`. |
| 8 | Cloud | Vercel → Render | The JSON body travels over HTTPS to the API server. |
| 9 | Server | `public/index.php` → `bootstrap/app.php` | Laravel boots, loads cached config and routes. |
| 10 | Middleware | `SecurityHeaders`, `EnforceIdleTimeout` | Sets up outgoing headers; rejects an expired token with `401 idle_timeout`. |
| 11 | Router | `routes/api.php:171` | URL + method matched. Before the controller runs, three gates: `auth:sanctum` (valid token?) → `throttle:api` (under 120/min?) → `role:Project Manager`. |
| 12 | Middleware | `EnsureRole.php` | Role is `Project Manager` → continue. (An Admin would be stopped here: the Admin+PM group is read-only.) |
| 13 | Controller | `PmController::storePhase():744-750` | `projectIds()` returns the PM's own project IDs; `$request->validate(['project_id' => integer])` reads the id from the body. |
| 14 | Controller | `:754-756` | `in_array($projectId, $ids, true)` → if the id is not one of theirs: `403 "You cannot add phases to that project."` |
| 15 | Controller | `validatePhase()` | Field rules: name required/max 255, numbers ≥ 0, dates valid, `required_skill_id` must exist. |
| 16 | Controller | `assertPhaseDates()` + `assertPhaseAllocations()` | End date not before start; phase dates inside the project window; the sum of all phase costs must not exceed the project budget. |
| 17 | Controller | `ProjectPhase::create([...])` | Eloquent builds `INSERT INTO project_phases (…) VALUES (…)` with bound parameters. |
| 18 | Observer | `AuditObserver::created()` | A second `INSERT INTO audit_logs` records `INSERT`, the new values, and `changed_by = the PM`. |
| 19 | Database | MySQL | Saves both rows, returns the new `phase_id`. |
| 20 | Controller | `:779-782` | `response()->json(['message' => 'Phase created successfully.', 'data' => $phase], 201)`. |
| 21 | Middleware | `SecurityHeaders` | Adds CSP, `no-store`, `nosniff` to the outgoing JSON. |
| 22 | Screen | `PhaseModal.tsx` → `onSaved()` | Popup closes, green notice shows, `load()` runs again → the new phase appears in the table. |

### 6.2 READ — "show me my phases"

| # | Layer | File | What happens |
|---|---|---|---|
| 1 | Screen | `PhasesDetail.tsx:57-60` | `useEffect` runs `load()` once when the page opens (and again whenever the selected project changes). |
| 2 | API client | `lib/api.ts:535` | `GET /pm/phases?project_id=<id>` (the query string is added by `pmQuery`). |
| 3 | Router | `routes/api.php:138` | Inside the **Admin + Project Manager** read group. |
| 4 | Controller | `PmController::phases():316` | `projectIds()` → the PM's own projects (or all, for an Admin), narrowed to the header selection. |
| 5 | Controller | same | Builds one query joining `project_phases` to `projects`, filtered by `whereIn('ph.project_id', $ids)`, and maps each row to a small JSON object (id, name, status, dates, cost, progress). |
| 6 | Database | MySQL | Runs the `SELECT`. Because the filter is server-side, a PM literally cannot receive another PM's phases — even if they tamper with `?project_id=` in the URL, the id is ignored unless it is in their list. |
| 7 | Screen | `PhasesDetail.tsx:47-50` | `setPhases(list)` stores the rows. |
| 8 | Screen | `SaTable` in `sa/_components/SaPage.tsx` | Renders the table: loading spinner, or an empty message, or the rows with status badges and action buttons. |

### 6.3 UPDATE — "change the phase"

| # | Layer | File | What happens |
|---|---|---|---|
| 1 | Screen | `PhasesDetail.tsx` | The **Edit** button does `setEditing(phase); setModalOpen(true)`. |
| 2 | Form | `PhaseModal.tsx:63-90` | Because `phase` is not null, the form **pre-fills** every field from that row. |
| 3 | Form | `PhaseModal.tsx:220` | On save it calls `updatePmPhase(phase.phase_id, payload)`. |
| 4 | API client | `lib/api.ts:563` | `PUT /pm/phases/<id>` with the changed fields. |
| 5 | Router | `routes/api.php:172` | PM-only write group. |
| 6 | Controller | `PmController::updatePhase():1096-1104` | Loads the row, then `in_array((int) $row->project_id, $this->projectIds($request), true)` → the phase must belong to one of this PM's projects, else `403 "You can only edit phases in your own projects."` This is the **ownership re-check on the id in the URL**. |
| 7 | Controller | same | `validatePhase()`; `assertPhaseDates($data, $project, $phase)`; `assertPhaseAllocations($project, $data, $phase)` — this last one **excludes the phase being edited** when it sums the sibling phases, so a phase is not compared with itself. |
| 8 | Controller | same | `$model->update([...])`. |
| 9 | Observer | `AuditObserver::updated()` | Compares before/after, keeps only what changed (minus `updated_at`), and writes `UPDATE` with `old_value` and `new_value`. |
| 10 | Database | MySQL | `UPDATE project_phases SET ... WHERE phase_id = ?`. |
| 11 | Screen | `onSaved()` | Popup closes, notice appears, `load()` refreshes the table. |

**Why the audit row matters here:** if a PM lowers a phase's cost, the audit log keeps both
numbers. Nobody can claim "it was always that amount".

### 6.4 DELETE — "remove the phase"

Delete is intentionally strict. The screen asks first, then the server applies six rules.

| # | Layer | File | What happens |
|---|---|---|---|
| 1 | Screen | `PhasesDetail.tsx:130` | `confirmDelete("Delete phase …?")` → the browser's yes/no box. Cancel stops everything. |
| 2 | API client | `lib/api.ts:579` → `PhasesDetail.tsx:138` | `deletePmPhase(phase.phase_id)` → `DELETE /pm/phases/<id>`. |
| 3 | Router | `routes/api.php:176` | PM-only write group. |
| 4 | Controller | `PmController::destroyPhase():1150` | Rule 1: the row must exist **and** belong to one of the PM's projects → else `403`. |
| 5 | Controller | same | Rule 2: `status` must be **`Not Started`** → else `422 "Only a Not Started phase can be deleted."` |
| 6 | Controller | same | Rule 3: no pending completion request. |
| 7 | Controller | same | Rule 4: no labourers still assigned (`workforce_assignment`). |
| 8 | Controller | same | Rule 5: no site tasks. |
| 9 | Controller | same | Rule 6: no labour-hour, material or equipment history. |
| 10 | Controller | same | `$model->delete()` → `DELETE FROM project_phases WHERE phase_id = ?`. |
| 11 | Observer | `AuditObserver::deleted()` | Writes `DELETE` with a **snapshot of the row** as `old_value`. The evidence survives the deletion. |
| 12 | Screen | `load()` | Table refreshes without the row. |

**The takeaway:** "delete" in this system means "delete only if nothing else depends on it".
In practice that pushes users to *void* the real records (usage logs), which refunds money
via the trigger, rather than deleting history.

### 6.5 The other CRUD endpoints follow exactly this shape

| Entity | Created by | Read by | Updated by | Deleted by |
|---|---|---|---|---|
| Project | `POST /pm/projects` (`PmController:372`) | `GET /pm/projects` (`:313`) | `PUT /pm/projects/{id}` (`:418`) | *no delete route* — projects are status-driven |
| Task | `POST /pm/tasks` (`TaskController:46`) | `GET /pm/tasks` (`:26`) | `PUT /pm/tasks/{id}` (`:82`) | `DELETE /pm/tasks/{id}` (`:122`) |
| Labourer | `POST /pm/laborers` (`LaborerController`) | `GET /pm/laborers` | `PUT /pm/laborers/{id}` | `DELETE /pm/laborers/{id}` |
| Material | `POST /admin/materials` (`AdminController`) | `GET /admin/resources` | `PUT /admin/materials/{id}` | `DELETE /admin/materials/{id}` |
| Equipment | `POST /admin/equipment` | `GET /admin/resources` | `PUT /admin/equipment/{id}` | `DELETE /admin/equipment/{id}` |
| Usage log | `POST /ss/materials` (`SsController`) | `GET /ss/materials` | `PUT /ss/materials/{id}` | `DELETE /ss/materials/{id}` (a "void", refunds money) |

---

## 7. Second example: a supervisor logs material usage

This is the write path that **moves money**, so it shows one extra player: the database
trigger.

**Where it starts:** `/portal/dashboard/ss/logs/materials` →
`frontend/app/portal/dashboard/ss/logs/MaterialsTab.tsx`.

| # | Layer | File | What happens |
|---|---|---|---|
| 1 | Screen | `MaterialsTab.tsx:139` | The supervisor picks a phase, a material, a date and a quantity, then presses **Log** → `createSsMaterialUsage({...})`. |
| 2 | API client | `lib/api.ts:1062` | `createSsMaterialUsage({ material_id, phase_id, usage_date, quantity_used })` → `POST /ss/materials`. |
| 3 | Router | `routes/api.php:209` | Group: token → `throttle:api` → `role:Admin,Site Supervisor` → **`role:Site Supervisor`**. An Admin can read this screen but cannot post a log. |
| 4 | Controller | `SsController::storeMaterialUsage():1664` | `$request->validate([...])`: ids are integers, `usage_date` must be today or earlier, quantity > 0. |
| 5 | Controller | same | `projectIds()` → the supervisor's own sites. `phaseFor($ids, $phaseId)` → the phase must belong to one of them, else `403 "That phase does not belong to your site."` |
| 6 | Controller | `:1694` | `budgetViolation(project, 'material', cost)` → if this usage would push the project past its materials allocation: `422 "Invalid: The set budget exceeds the allocated budget limit."` |
| 7 | Controller | `:1704` | `DB::transaction(function () { ... })` — everything below is one atomic unit. |
| 8 | Controller | `:1719` | `MaterialUsage::create([...])` with `unit_cost_at_use` copied from the catalogue **right now**. |
| 9 | **Database** | trigger `trg_material_usage_cost_insert` | MySQL computes `computed_cost = quantity × unit_cost_at_use`, then runs `UPDATE projects SET remaining_budget = remaining_budget − computed_cost`. |
| 10 | Controller | `:1729` | `adjustMaterialStock($id, -$quantity)` → locks the material row (`lockForUpdate`) and subtracts the stock, using the model so the change is audited. |
| 11 | Observer | `AuditObserver` | Two more audit rows: one for the usage insert, one for the stock change. |
| 12 | Database | — | The transaction commits: usage row + budget change + stock change all land together, or none of them do. |
| 13 | Controller | same | Returns `201` with the created id. |
| 14 | Screen | `MaterialsTab.tsx` | Reloads: the new row appears, and the project's remaining budget is already lower. |

**What happens on "Void" (delete):** `DELETE /ss/materials/{id}` →
`SsController::destroyMaterialUsage()`. Inside a transaction it deletes the usage row
(trigger adds the money **back**), then `adjustMaterialStock(+quantity)` puts the stock back.
The audit log keeps a snapshot.

**Why this design is safe:** the browser never sends a cost. It sends *quantity*. The rate
comes from the catalogue at that moment, the cost is computed by the database, and the
budget is adjusted by the database. A tampered request can only ask for a different
quantity — which the budget check and the stock check will catch.

---

## 8. Login — how the browser proves who it is

**Where it starts:** `/portal` → `frontend/app/portal/page.tsx`.

| # | Layer | File | What happens |
|---|---|---|---|
| 1 | Screen | `portal/page.tsx:46-91` | The user types an **account ID** (`SYS010001`, `PM020001`, `SUP030001`) and a password. The form trims both and refuses empty values. |
| 2 | API client | `lib/api.ts:227-237` | `login(idNumber, password)` → `POST /login` with `auth: false` (there is no token yet). |
| 3 | Router | `routes/api.php:85` | The only public route. It carries `throttle:login` (5 tries/minute, 30/hour per account + IP). |
| 4 | Request class | `Auth/LoginRequest.php` | `id_number` required, string, max 20; `password` required, string. |
| 5 | Controller | `AuthController::login():26-61` | Looks up the account by `id_number`, then `Hash::check(password, password_hash)`. |
| 6 | Controller | same | Wrong password **or** unknown account **or** inactive account → the same message (*"The provided credentials are incorrect."*) and a `failed` row in `login_history`. |
| 7 | Controller | `:52` | Success → `createToken('api')`. Sanctum stores a **hash** of the token in `personal_access_tokens` and returns the plain text **once**. |
| 8 | Controller | `:54` | Records a `success` row in `login_history` (IP + browser). |
| 9 | Controller | `:56-60` | Returns `{ message, token, user }` — the user object is hand-built, so the password hash can never appear. |
| 10 | Screen | `portal/page.tsx:62-80` | `toSessionUser(user)` converts the backend role name to `SA`/`PM`/`SS`; `saveSession(token, user)` writes both into `localStorage`; the router pushes to that role's dashboard. |
| 11 | Screen | `dashboard/layout.tsx:282-300` | The dashboard shell reads `localStorage` again. Missing token/user → back to `/portal`. Wrong role for the URL → redirected to the correct dashboard. |
| 12 | Every later request | `lib/api.ts:182-185` | Adds `Authorization: Bearer <token>`. |

### 8.1 Expiry has two clocks

| Clock | Setting | What happens |
|---|---|---|
| Absolute | `SANCTUM_EXPIRATION=480` minutes (8 hours) | The token dies 8 hours after it was issued |
| Idle | `SANCTUM_IDLE_TIMEOUT=30` minutes | `EnforceIdleTimeout` deletes the token if it was not used for 30 minutes |

When either clock expires the API answers `401`. `lib/api.ts:126-134` sees it, wipes
`localStorage`, and sends the user to `/portal?reason=session-expired`, which shows
"Your session expired. Please sign in again."

### 8.2 Four ways a session ends

| Action | Endpoint | Effect |
|---|---|---|
| Sign out (this device) | `POST /logout` | Deletes **this** token only |
| Sign out everywhere | `POST /me/logout-all` | Deletes **all** tokens for the account |
| Change password | `POST /me/password` | Deletes every **other** token, keeps the current tab signed in |
| Admin deactivates the account | `PATCH /users/{id}/deactivate` | Deletes every token; login also refuses inactive accounts |

### 8.3 Why the token is not a password

The token is stored in `personal_access_tokens` as a SHA-256 hash. Even if someone reads the
whole database, they cannot reconstruct a usable token. The plain text exists only in the
browser's `localStorage`.

That is also the one weakness of this design: **script running on the page could read
`localStorage`**. That is why the API sends a strict Content-Security-Policy and
`no-store` on every response, and why the frontend ships its own CSP in
`frontend/next.config.ts`.

---

## 9. Cloud — what runs where

### 9.1 The four services

| Service | What it hosts | Cost tier | Where it is configured |
|---|---|---|---|
| **GitHub** | the source code | free | the repository itself |
| **Vercel** | the Next.js frontend (the website) | Hobby (free) | Vercel dashboard → project → Settings → Environment Variables |
| **Render** | the Laravel API, as a **Docker** web service | free (sleeps when idle) | `render.yaml` + Render dashboard secrets |
| **Aiven** | the MySQL database | free 1 GB, TLS | Aiven console |

Vercel cannot run PHP, which is exactly why the API lives on Render and the site lives on
Vercel. See `DEPLOYMENT.md` for the step-by-step setup.

### 9.2 How the three boxes find each other

```
Browser
  │  1. loads the site from Vercel
  ▼
Vercel (frontend)
  │  2. calls the API at NEXT_PUBLIC_API_BASE_URL  (e.g. https://struktura-api.onrender.com/api/v1)
  ▼
Render (backend, Docker → Apache → PHP)
  │  3. connects to MySQL using DB_HOST / DB_PORT / DB_DATABASE / DB_USERNAME / DB_PASSWORD
  │     with MYSQL_ATTR_SSL_CA = /etc/ssl/certs/ca-certificates.crt
  ▼
Aiven (MySQL)
```

Three settings make that chain work:

| Setting | Lives in | Why it matters |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Vercel env vars (also `frontend/.env.local` locally) | Tells the browser where the API is. `NEXT_PUBLIC_` values are **baked in at build time**, so changing it requires a redeploy. |
| `CORS_ALLOWED_ORIGINS` | Render env vars (`backend/.env` locally) | The API only answers browser requests from that exact origin. Must be `https://<app>.vercel.app` with no trailing slash. |
| `DB_*` + `MYSQL_ATTR_SSL_CA` | Render env vars (`sync: false` = secret, typed into the dashboard) | The API cannot start without them; the CA path is what makes the TLS connection trusted. |

### 9.3 Local development (two terminals)

| Terminal | Command | Address |
|---|---|---|
| 1 — API | `cd backend` → `php artisan serve --host=0.0.0.0 --port=8000` | `http://localhost:8000` |
| 2 — site | `cd frontend` → `npm run dev` | `http://localhost:3000` |

Why `--host=0.0.0.0` matters: without it the API listens on `127.0.0.1` only, so a phone or
another laptop on the same Wi-Fi gets "Cannot reach the server".

Working from a LAN address needs three extra allowances:

1. `CORS_ALLOWED_ORIGINS` / `CORS_ALLOWED_ORIGIN_PATTERNS` in `backend/.env`,
2. `allowedDevOrigins` in `frontend/next.config.ts`,
3. Windows Firewall inbound rules for TCP 3000 and 8000.

The frontend derives the API host automatically (`lib/api.ts:16-18`), so opening
`http://192.168.1.6:3000` calls `http://192.168.1.6:8000/api/v1` without any code change.

### 9.4 What `render.yaml` sets for the API

`render.yaml` is the "recipe" Render reads. It says: Docker, root folder `backend`,
health check `/up`, auto-deploy on push, and these environment variables:

| Variable | Value | Meaning |
|---|---|---|
| `APP_ENV` | `production` | Turns on HSTS + forced HTTPS |
| `APP_DEBUG` | `false` | No stack traces in responses |
| `APP_FORCE_HTTPS` | `true` | Every generated URL is `https://` |
| `APP_KEY` | *(secret)* | Encryption key |
| `LOG_CHANNEL` / `LOG_LEVEL` | `stderr` / `warning` | Logs go to the platform, not a file in the web root |
| `DB_*` | *(secret)* | Aiven connection |
| `MYSQL_ATTR_SSL_CA` | `/etc/ssl/certs/ca-certificates.crt` | Verified TLS to MySQL |
| `BCRYPT_ROUNDS` | `12` | Password-hash cost |
| `SANCTUM_EXPIRATION` / `SANCTUM_IDLE_TIMEOUT` | `480` / `30` | Token lifetimes |
| `CORS_ALLOWED_ORIGINS` | *(secret)* | The Vercel origin |
| `TRUSTED_PROXIES` | `*` | Render is only reachable through its proxy |

Variables marked `sync: false` are **not stored in Git** — you type them into the Render
dashboard once.

### 9.5 What happens when you push code

```
git push
   │
   ├─► GitHub  ──►  Render sees the push (autoDeploy)
   │                  → builds backend/Dockerfile
   │                  → starts the container
   │                  → entrypoint.sh: config:cache + route:cache
   │                  → Apache serves /var/www/html/public
   │
   └─► GitHub  ──►  Vercel sees the push
                      → runs `next build`
                      → publishes the static/CDN pages + server pieces
```

### 9.6 Render's free tier "sleep"

A free Render web service stops after roughly 15 minutes with no traffic. The next request
wakes it, and that first request can take ~40 seconds. The frontend hides this behind
`AppBootScreen` / `AppLoadingScreen`, so users see a spinner instead of a broken page.

### 9.7 Database access and TLS

- The API connects on the MySQL port Aiven gives you (e.g. `21804`), not the default `3306`.
- Aiven uses its **own certificate authority**, which is not in the public trust store.
  `backend/docker/ca.pem` is copied into the container's trust store at build time, and
  `MYSQL_ATTR_SSL_CA` points at the resulting bundle. Without that, the connection fails
  with a certificate error.
- On Aiven, the Render IPs must be allowed (free plan: allow `0.0.0.0/0` for the demo).
- Migrations are run from a developer machine against the Aiven database
  (`php artisan migrate --force`), because the free Render service has no shell.

---

## 10. Something is broken — which folder to open

| What you see | Most likely cause | Where to look |
|---|---|---|
| "Cannot reach the server. Please make sure the backend is running." | API not started, or started without `--host=0.0.0.0` | `backend/` → run `php artisan serve --host=0.0.0.0 --port=8000` |
| Login works, then everything 401s | Token idle-expired (30 min) or the password changed elsewhere | `EnforceIdleTimeout.php`, `config/sanctum.php` |
| 6th quick login returns 429 | Login rate limiter | `AppServiceProvider.php:53-60` |
| Any screen 429s after heavy clicking | API rate limiter (120/min) | `AppServiceProvider.php:64-68` |
| Browser console: "blocked by CORS policy" | Origin not in the list | `backend/config/cors.php` + `CORS_ALLOWED_ORIGINS` |
| Blank screen after login | Role not recognised, or API base URL wrong | `lib/api.ts` (`roleCodeFromName`, `getApiBaseUrl`), `frontend/.env.local` |
| PM/SS page says "select a project/site" | By design — the sidebar is locked until something is selected | `PmProjectGate.tsx`, `SsSiteGate.tsx` |
| A row you just saved is missing | The list reloaded with a different project selected | `projectSelection.ts`, `siteSelection.ts` |
| "You cannot edit/delete this" | Ownership or dependency guard | `PmController`, `SsController`, `TaskController` |
| Two budget screens disagree | Spend is computed from `remaining_budget`, recorded costs from the three usage tables | `Support/ProjectBudget.php` |
| 500 on every request | Missing `APP_KEY`, or `storage/` not writable | Render logs (`stderr`), `backend/.env` |
| "SQLSTATE[HY000] [2002]" / timeout | Wrong DB host/port or Aiven firewall | `backend/.env`, Aiven → Trusted IPs |
| MySQL certificate error | Aiven CA not trusted | `backend/docker/ca.pem`, `Dockerfile:18-23` |
| Deployed site still calls `localhost:8000` | `NEXT_PUBLIC_API_BASE_URL` missing at build time | Vercel env vars → redeploy |
| First visit takes ~40 s | Render free tier woke up | `AppBootScreen.tsx` (the spinner you see) |
| A page 404s inside the dashboard | Route folder name ≠ sidebar `href` | `sidebarData.ts` vs `app/portal/dashboard/**/page.tsx` |
| Cost looks wrong after editing a price | Prices are snapshotted per usage row by design | `*_at_use` columns, `CostPostingTriggers.php` |

---

## 11. Complete file cheat-sheet

### 11.1 Repository root

| File | What it is |
|---|---|
| `README.md` | What the product is, what problem it solves, how to run it locally |
| `DEPLOYMENT.md` | The full Vercel + Render + Aiven deployment guide and smoke tests |
| `SECURITY.md` | Threat model, production checklist, accepted limitations |
| `HOW_IT_WORKS.md` | **This document** |
| `render.yaml` | Render blueprint: Docker service, health check, environment variables |
| `.gitignore`, `.gitattributes` | What Git ignores / line-ending rules |
| `.vscode/settings.json` | Editor settings (SQLTools connection to the Aiven database) |

### 11.2 `frontend/app/` — page files

| File | URL | One-line purpose |
|---|---|---|
| `layout.tsx` | all | Root HTML shell, fonts, page title |
| `globals.css` | all | Global CSS + Tailwind |
| `page.tsx` / `page.module.css` | `/` | Landing page |
| `not-found.tsx` / `.module.css` | bad URL | 404 page |
| `home/page.tsx` | `/home` | Long landing variant |
| `portal/page.tsx` / `.module.css` | `/portal` | Login |
| `portal/change-password/page.tsx` / `.module.css` | `/portal/change-password` | Change password screen |
| `portal/_components/SpinnerRing.tsx` / `.module.css` | — | Button spinner |
| `dashboard/layout.tsx` / `.module.css` | `/portal/dashboard/*` | Auth guard + sidebar + header |
| `dashboard/not-found.tsx` / `.module.css` | — | 404 inside the shell |
| `dashboard/sidebarData.ts` | — | Menu definitions per role |
| `dashboard/_components/AppBootScreen.tsx` / `.module.css` | — | "Starting up" screen |
| `dashboard/_components/AppLoadingScreen.tsx` / `.module.css` | — | Data-loading screen |
| `dashboard/_components/projectScope.ts` | — | Shared "selected project" store |
| `dashboard/_components/ProjectSwitcher.tsx` / `.module.css` | — | Header project dropdown |
| `dashboard/_components/RecordDetails.tsx` / `.module.css` | — | Reusable "View" popup |
| `dashboard/_components/StatusActions.tsx` | — | Reusable status buttons |
| `dashboard/profile/page.tsx` / `.module.css` | `/…/profile` | My Profile: account details + recent logins |
| `dashboard/settings/page.tsx` / `.module.css` | `/…/settings` | Settings: profile, password, log out, notifications |

### 11.3 `frontend/app/portal/dashboard/pm/` — Project Manager

| File | Purpose |
|---|---|
| `page.tsx` / `page.module.css` | PM overview screen |
| `projects/page.tsx` | Project table page |
| `projects/ProjectModal.tsx` | Project create/edit form |
| `phases/page.tsx` | Phase page (thin wrapper) |
| `phases/PhasesDetail.tsx` | Phase + task panel: load, status actions, delete |
| `phases/PhaseModal.tsx` | Phase create/edit form |
| `phases/TasksPanel.tsx` | Task list per phase |
| `phases/TaskModal.tsx` | Task create/edit form |
| `workforce/page.tsx` | Labourers + assignments |
| `workforce/LaborerModal.tsx` / `.module.css` | Labourer create/edit form |
| `workforce/AssignModal.tsx` | Assign a worker to a phase |
| `workforce/WorkforceDetail.tsx` | Worker detail view |
| `supervisors/page.tsx` | Site Supervisor directory |
| `finance/page.tsx` | Budget vs spend |
| `materials/page.tsx` | Material usage |
| `equipment/page.tsx` | Equipment usage |
| `search/page.tsx` | PM-scoped search |
| `_components/CataloguePanel.tsx` | Shared catalogue panel |
| `_components/DetailModal.tsx` / `.module.css` | Generic detail popup |
| `_components/FormModal.tsx` / `.module.css` | Shared form shell |
| `_components/PmProjectGate.tsx` | "Pick a project" wall |
| `_components/PmProjectSwitcher.tsx` | Header project switcher |
| `_components/projectSelection.ts` | PM selection store |
| `_components/ProjectMaster.tsx` | Reusable project table |
| `_components/UsageDetail.tsx` | Usage table sizing/details |

### 11.4 `frontend/app/portal/dashboard/sa/` — Admin

| File | Purpose |
|---|---|
| `page.tsx` / `page.module.css` | Admin overview |
| `users/page.tsx` | User directory (activate/deactivate) |
| `users/CreateUserModal.tsx` / `.module.css` | Create-user form |
| `users/create/page.tsx` | Full-page create-user form |
| `users/roles/page.tsx` | Role reference page |
| `skills/page.tsx` | Skill catalogue page |
| `skills/SkillModal.tsx` / `.module.css` | Skill create/edit form |
| `projects/page.tsx` | All projects |
| `phases/page.tsx` | All phases |
| `assignments/page.tsx` | All assignments |
| `resources/page.tsx` | Materials + equipment page |
| `resources/CatalogueModal.tsx` | Material/equipment create/edit form |
| `usage/page.tsx` | Usage across projects |
| `labor-logs/page.tsx` | Labour logs across projects |
| `finance/page.tsx` | Finance across projects |
| `audit/page.tsx` / `.module.css` | Audit events + login history |
| `search/page.tsx` | Global search |
| `_components/SaPage.tsx` | Shared page/table/UI kit |

### 11.5 `frontend/app/portal/dashboard/ss/` — Site Supervisor

| File | Purpose |
|---|---|
| `layout.tsx` | Supervisor layout wrapper |
| `page.tsx` / `ss.module.css` | Site overview |
| `site/page.tsx` | Site details page |
| `site/SiteDetail.tsx` | Site details panel |
| `schedule/page.tsx` | Task schedule (today/week/all) |
| `phases/page.tsx` | Site phases |
| `phases/PhasesDetail.tsx` | Phase detail + completion request |
| `logs/page.tsx` | Tabbed logs |
| `logs/LaborTab.tsx` | Worker-hours form/list |
| `logs/MaterialsTab.tsx` | Material form/list |
| `logs/EquipmentTab.tsx` | Equipment form/list |
| `logs/workers/page.tsx` | Worker log page |
| `logs/materials/page.tsx` | Material log page |
| `logs/equipment/page.tsx` | Equipment log page |
| `search/page.tsx` | Site-scoped search |
| `_components/siteSelection.ts` | Site selection store |
| `_components/SsSiteSwitcher.tsx` | Header site switcher |
| `_components/SsSiteGate.tsx` | "Pick a site" wall |
| `_components/SsReport.tsx` | Site report export |
| `_components/useSsResource.ts` | Site-scoped data hook |

### 11.6 `frontend/lib/`, `frontend/public/` and config

| File | Purpose |
|---|---|
| `lib/api.ts` | The only API client: token helpers, `request()`, ~200 endpoint functions |
| `lib/loading.ts` | In-flight request counter for the global spinner |
| `lib/confirmDelete.ts` | Shared delete confirmation |
| `lib/device.ts` | User-agent → readable device name |
| `public/assets/*` | Logo, banners, photos, `login-vid.mp4` |
| `public/*.svg` | Default Next.js icons |
| `package.json`, `package-lock.json` | Dependencies + scripts |
| `next.config.ts` | Page-level security headers + dev origins |
| `tsconfig.json`, `next-env.d.ts` | TypeScript config (generated file included) |
| `postcss.config.mjs`, `eslint.config.mjs` | Tailwind + lint config |
| `.env.local` | `NEXT_PUBLIC_API_BASE_URL` |
| `.gitignore` | Ignore `node_modules`, `.next`, `.env*.local` |
| `README.md`, `AGENTS.md`, `CLAUDE.md` | Developer/AI notes |

### 11.7 `backend/app/` — every application file

| File | Purpose |
|---|---|
| `Http/Controllers/Controller.php` | Empty base class for all controllers |
| `Http/Controllers/Api/AuthController.php` | Login, logout, logout-all, me, profile, password, logins, notifications |
| `Http/Controllers/Api/UserController.php` | Admin user CRUD + activate/deactivate |
| `Http/Controllers/Api/RoleController.php` | List the three roles |
| `Http/Controllers/Api/SkillController.php` | Skill CRUD |
| `Http/Controllers/Api/LaborerController.php` | Labourer CRUD, skills, status |
| `Http/Controllers/Api/TaskController.php` | Task CRUD + status |
| `Http/Controllers/Api/PmController.php` | PM console (projects, phases, assignments, budgets, usage) |
| `Http/Controllers/Api/SsController.php` | SS console (site, schedule, logs, search) |
| `Http/Controllers/Api/AdminController.php` | Admin console (users overview, resources, audit, search) |
| `Http/Middleware/SecurityHeaders.php` | Adds CSP / no-store / HSTS / nosniff to every response |
| `Http/Middleware/EnforceIdleTimeout.php` | Deletes tokens unused for 30 minutes |
| `Http/Middleware/EnsureRole.php` | Role gate (`role:Admin`, …) |
| `Http/Requests/Auth/LoginRequest.php` | Login field rules |
| `Http/Requests/Auth/ChangePasswordRequest.php` | Password-change rules |
| `Http/Requests/User/StoreUserRequest.php` | Create-user rules + normalisation |
| `Http/Requests/User/UpdateUserRequest.php` | Edit-user rules |
| `Http/Requests/User/UpdateProfileRequest.php` | Self-profile rules + phone cleanup |
| `Models/User.php` | `users` — accounts, hash hiding, roles |
| `Models/Role.php` | `role` — role names as constants |
| `Models/LoginHistory.php` | `login_history` — attempts |
| `Models/AuditLog.php` | `audit_logs` — change history |
| `Models/Skill.php` | `skill` — trades |
| `Models/Laborer.php` | `laborer` — workers |
| `Models/LaborerSkill.php` | `laborer_skill` — worker↔skill |
| `Models/Project.php` | `projects` — the main record |
| `Models/ProjectPhase.php` | `project_phases` |
| `Models/WorkforceAssignment.php` | `workforce_assignment` |
| `Models/SiteTask.php` | `site_task` |
| `Models/Material.php` | `materials` |
| `Models/MaterialUsage.php` | `material_usage` |
| `Models/Equipment.php` | `equipment` |
| `Models/EquipmentUsage.php` | `equipment_usage` |
| `Models/LaborHourLog.php` | `labor_hour_log` |
| `Observers/AuditObserver.php` | Writes `audit_logs` for 13 models |
| `Providers/AppServiceProvider.php` | Rate limits, password policy, HTTPS, observer registration |
| `Support/CostPostingTriggers.php` | SQL text of the 9 money triggers |
| `Support/ProjectBudget.php` | Spend/utilization calculator |

### 11.8 `backend/bootstrap/`, `backend/routes/`, `backend/public/`

| File | Purpose |
|---|---|
| `bootstrap/app.php` | App assembly: routes, middleware order, proxies, JSON errors |
| `bootstrap/providers.php` | Provider list |
| `bootstrap/cache/*` | Generated config/route/package caches |
| `routes/api.php` | All `/api/v1/*` endpoints and their gates |
| `routes/web.php` | `/` → `welcome.blade.php` (unused by the React app) |
| `routes/console.php` | Console route definitions |
| `public/index.php` | Front controller — the only directly executed PHP file |
| `public/.htaccess` | Rewrite rules, `-Indexes`, pass `Authorization` header |
| `public/robots.txt`, `public/favicon.ico` | Static files |

### 11.9 `backend/database/` — all 19 migrations and the seeding files

| Migration | What it changes |
|---|---|
| `0000_01_01_000000_create_role_table.php` | Creates `role` (the three roles) |
| `0001_01_01_000000_create_users_table.php` | Creates `users`, `password_reset_tokens`, `sessions` |
| `0001_01_01_000001_create_cache_table.php` | Creates `cache`, `cache_locks` |
| `0001_01_01_000002_create_jobs_table.php` | Creates `jobs`, `job_batches`, `failed_jobs` |
| `2026_09_30_093905_create_personal_access_tokens_table.php` | Creates the Sanctum token table |
| `2026_10_24_000000_add_contact_number_to_users_table.php` | Adds the phone column |
| `2026_10_24_100000_add_department_to_users_table.php` | Adds a department column |
| `2026_10_24_100100_create_login_history_table.php` | Creates `login_history` |
| `2026_10_24_110000_drop_department_from_users_table.php` | Removes it again (feature dropped) |
| `2026_10_24_120000_make_audit_logs_project_id_nullable.php` | Audit rows may have no project (users/skills) |
| `2026_10_24_120100_add_category_to_skill_table.php` | Adds a skill category |
| `2026_10_25_000000_add_ss_site_financials_and_completion_tracking.php` | Site financial fields + `completion_requested_at/by` |
| `2026_10_25_010000_add_shift_to_labor_hour_log.php` | Morning/Afternoon shift |
| `2026_10_25_020000_add_times_to_labor_hour_log.php` | `time_in` / `time_out` |
| `2026_10_25_030000_add_budgets_to_project_phases.php` | Per-phase materials/equipment budgets |
| `2026_10_25_040000_create_cost_posting_triggers.php` | Installs the 9 money triggers |
| `2026_10_25_050000_make_usage_costs_generated.php` | Turns `computed_cost` into generated columns |
| `2026_10_25_060000_backfill_open_task_assignments.php` | One-off data fix for open tasks |
| `2026_10_26_000000_drop_supplier_tables.php` | Removes the old supplier tables |

| Other file | Purpose |
|---|---|
| `schema/struktura_erp_schema.sql` | Full definitions of the ERP tables (import once) |
| `schema/laravel_framework_tables.sql` | Framework tables reference |
| `seed/pm_demo_data.sql`, `ss_demo_data.sql`, `sa_demo_data.sql` | Demo rows per role |
| `seeders/DatabaseSeeder.php` | Runs the three seeders below |
| `seeders/RoleSeeder.php` | Inserts Admin / Project Manager / Site Supervisor |
| `seeders/AdminUserSeeder.php` | Creates `SYS010001` |
| `seeders/ExampleUsersSeeder.php` | Creates the PM and SS demo accounts |
| `factories/RoleFactory.php`, `factories/UserFactory.php` | Fake data for tests |

### 11.10 `backend/config/`, `backend/docker/`, `backend/tests/` and root files

Config files are described in [4.10](#410-backendconfig--settings-files); Docker files in
[4.12](#412-backenddocker-and-the-dockerfile). The rest:

| File | Purpose |
|---|---|
| `tests/TestCase.php` | Base test class |
| `tests/Feature/Auth/LoginTest.php` | Login, wrong password, inactive account, logout |
| `tests/Feature/User/UserManagementTest.php` | Admin user CRUD + guards |
| `tests/Feature/Pm/ProjectPhaseManagementTest.php` | Project/phase rules + ownership |
| `tests/Feature/Pm/TaskManagementTest.php` | Tasks + worker rules |
| `tests/Feature/Pm/LaborerManagementTest.php` | Labourers, skills, delete guards |
| `tests/Feature/Pm/WorkforceAvailabilityTest.php` | Who may be assigned where |
| `tests/Feature/Pm/HourlyRateTest.php` | Rate overrides and fallbacks |
| `tests/Feature/Pm/PmMaterialTest.php` | PM material endpoint |
| `tests/Feature/Pm/SiteSupervisorDirectoryTest.php` | Supervisor list |
| `tests/Feature/Ss/SsWorkersVisibilityTest.php` | Supervisor sees only active workers |
| `tests/Feature/Resources/MaterialEquipmentUsageTest.php` | Usage limits, stock, future dates |
| `tests/Feature/Status/StatusTransitionTest.php` | Allowed status changes |
| `tests/Feature/Finance/CostPostingTriggerTest.php` | Trigger maths (deduct / refund / move) |
| `tests/Feature/Admin/AdminCatalogueTest.php` | Material/equipment CRUD + delete guards |
| `tests/Feature/Admin/AdminSearchTest.php` | Global search + 20-row cap |
| `tests/Unit/ProjectBudgetTest.php` | Budget calculator |
| `tests/Feature/ExampleTest.php`, `tests/Unit/ExampleTest.php` | Framework sanity tests |
| `artisan` | CLI entry point |
| `composer.json` / `composer.lock` | PHP dependencies (Laravel 12, Sanctum 4.3, tinker) |
| `Dockerfile` | Image recipe (PHP 8.2 + Apache + extensions + CA + composer) |
| `phpunit.xml` | Test configuration (SQLite memory, bcrypt cost 4) |
| `package.json`, `vite.config.js` | Asset build for the unused Blade page |
| `.env`, `.env.example` | Real secrets / documented template |
| `.dockerignore` | Keeps `.env`, `vendor`, logs out of the image |
| `.gitignore` | Keeps `.env`, `vendor`, caches out of Git |
| `.editorconfig`, `.gitattributes` | Formatting / line-ending rules |
| `.phpunit.result.cache` | Test-run cache (generated) |
| `README.md` | Short backend readme |
| `storage/` | Logs, cache, sessions, compiled views (writable) |
| `vendor/` | Installed PHP libraries (never edit) |

---

## 12. Tiny glossary

| Word | Plain meaning |
|---|---|
| **API** | The set of URLs the server offers, e.g. `/api/v1/pm/projects` |
| **Endpoint** | One URL + one method, e.g. `POST /api/v1/login` |
| **GET / POST / PUT / PATCH / DELETE** | Read / create / replace / partially update / delete |
| **200, 201** | OK / created |
| **401** | You are not signed in (or your token expired) |
| **403** | You are signed in, but not allowed to do this |
| **404** | The record or page does not exist |
| **422** | The data you sent failed validation (usually a form field) |
| **429** | Too many requests (rate limit) |
| **500** | The server crashed — read the logs |
| **JSON** | The text format used to send data: `{"name": "Phase 1"}` |
| **Token / Bearer token** | A long random string that proves who you are, sent in the `Authorization` header |
| **`localStorage`** | A small storage box inside the browser where the token is kept |
| **Middleware** | A checkpoint the request passes through before/after the controller |
| **Route** | A line that says "this URL runs this controller method" |
| **Controller** | The function that does the work for one endpoint |
| **FormRequest** | A class that validates the request before the controller |
| **Model** | A PHP class that represents one database table |
| **Eloquent / ORM** | The layer that turns PHP objects into SQL |
| **Migration** | A versioned database change, run by `php artisan migrate` |
| **Seeder** | A script that inserts starting data (roles, demo accounts) |
| **Factory** | A script that generates fake rows for tests |
| **Trigger** | SQL that the database runs automatically when a row changes (here: budget maths) |
| **Generated column** | A column the database computes itself (here: `computed_cost`) |
| **Foreign key** | A column that points at another table's row |
| **Index** | A lookup shortcut that makes queries fast |
| **CORS** | The browser rule that decides which site may call the API |
| **CSP** | A list of what a page is allowed to load/run |
| **HSTS** | "Always use HTTPS for this site" instruction to the browser |
| **TLS / HTTPS** | The encryption that puts the padlock in the address bar |
| **Env var (`APP_KEY`, `DB_HOST`, …)** | A setting stored outside the code, per environment |
| **Component** | A reusable piece of UI (a file exporting a function that returns JSX) |
| **Props** | The inputs a component receives |
| **State (`useState`)** | Values a component remembers between renders |
| **Hook (`useEffect`, `useMemo`, `useCallback`)** | A function that adds behaviour to a component (load data, memoise, subscribe) |
| **`"use client"`** | Marks a file as browser-side code (needed for state and events) |
| **CSS module** | A stylesheet whose class names are scoped to one component |
| **Build** | Turning source code into something the host can run (`next build`, Docker build) |
| **Cold start** | Waking a sleeping free server; the first request is slow |

---

## The five things to remember

1. **The browser is dumb on purpose.** It draws and it asks. It never holds business rules
   and never touches MySQL.
2. **Two gates, not one.** The *route* checks your role; the *controller* checks that the
   record is yours. Both must pass before any data is read or written.
3. **Every write is recorded.** Models fire the audit observer, so `audit_logs` gets an
   INSERT/UPDATE/DELETE row with the actor and the before/after values.
4. **Money is posted by the database.** Usage rows carry a snapshot price; a generated
   column computes the cost; nine triggers move `remaining_budget`. Deleting a log refunds.
5. **Three places, three jobs.** Vercel runs the website, Render runs the API, Aiven holds
   the data. `NEXT_PUBLIC_API_BASE_URL` and `CORS_ALLOWED_ORIGINS` are the two strings that
   tie them together.

---

*Related documents: `README.md` (what the product is), `DEPLOYMENT.md` (how to ship it),
`SECURITY.md` (threat model + production checklist),
`backend/BACKEND_SECURITY.md` (security controls with exact line numbers).*