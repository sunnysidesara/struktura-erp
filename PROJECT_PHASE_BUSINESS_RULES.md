# Project and Phase Business Rules

**Status:** Safe enforcement implemented; policy approval items remain pending  
**Applies to:** Struktura ERP — Admin, Project Manager, and Site Supervisor consoles  
**Database target:** Current MySQL schema (`backend/database/schema/struktura_erp_schema.sql`) plus applied migrations  
**Last system audit:** 2026-10-25  
**Implementation state:** Partially enforced. Rules marked **[Enforced]**, **[Partial]**, or **[Gap]** describe the current code. The target rule is stated separately where it is not yet enforced.

## 1. Purpose

This document is the single source of truth for how projects and project phases are created, read, updated, deleted, budgeted, scheduled, completed, and scoped for each user role.

It answers four questions for every rule:

1. What is the intended business rule?
2. Which role may perform the action?
3. What validation is required?
4. Is the rule currently enforced by the API, by the UI only, or not at all?

### 1.1 Document precedence

| Subject | Authoritative document |
|---|---|
| Project and phase definition, ownership, dates, budgets, progress, deletion, role scope | **This document** |
| Project and phase status transitions, phase completion lifecycle | `STATUS_BUSINESS_RULES.md` |
| Workforce assignments, task workers, assignment removal | `WORKFORCE_BUSINESS_RULES.md` |
| Material and equipment usage, stock, usage costs | `MATERIALS_EQUIPMENT_BUSINESS_RULES.md` |

Status transitions are summarized in this document for completeness, but `STATUS_BUSINESS_RULES.md` remains authoritative for the transition tables. This document must not introduce a conflicting status path.

Where a rule is marked **[Gap]**, the current system does **not** enforce the target behavior. The gap must be fixed or the target rule must be changed before the rule is treated as implemented.

## 2. Canonical terms

| Business term | Database representation | Meaning |
|---|---|---|
| Project / Site | `projects` | One construction site managed under one Project Manager. The UI uses “project” and “site” interchangeably. |
| Project Manager owner | `projects.user_id` | The PM accountable for the project. Ownership is set at creation and cannot be transferred through the current UI or API. |
| Site Supervisor assignment | `projects.site_supervisor_id` | The SS account allowed to see the site and request phase completion. One SS can supervise many projects. |
| Phase | `project_phases` | A sequenced stage belonging to exactly one project. |
| Phase name | `project_phases.project_name` | The phase's display name. Despite the column name, it is **not** the parent project name. |
| Phase sequence | `project_phases.sequence_no` | Display/order number for the phase within its project. |
| Phase budget | `project_phases.project_cost` | Planning value for the phase. It is **not** the sum of actual material, equipment, or labor costs. |
| Project resource allocation | `projects.materials_budget`, `projects.equipment_budget` | Portions of the approved project budget reserved for materials and equipment. Labor has no dedicated allocation column and is the residual amount. |
| Actual project spend | `projects.remaining_budget` and usage rows | `remaining_budget` is reduced by database triggers as labor, material, and equipment usage is posted. |
| Completion request | `project_phases.completion_requested_at`, `completion_requested_by` | A Site Supervisor's request for the PM to sign a phase off. The phase remains `In Progress` while the request is pending. |
| Project progress | Derived value | PM project progress is the percentage of phases with status `Completed`. |
| Phase progress | Derived value | SS phase progress is based on completed site tasks while the phase is `In Progress`. |
| Target end | `projects.end_date` | Operational target completion date entered by the PM. |
| Deadline | `projects.deadline` | Separate, legacy/contract deadline column. Current PM create/edit screens do **not** write it. |

### 2.1 Source-of-truth map

```text
projects (site)
  ├── user_id              → Project Manager owner
  ├── site_supervisor_id   → Site Supervisor access
  └── project_phases (phase)
        ├── workforce_assignment → worker ↔ phase
        │     └── labor_hour_log
        ├── material_usage
        ├── equipment_usage
        └── site_task
```

Workforce assignments, material usage, and equipment usage derive their project through `project_phases.project_id`. `site_task` also carries `project_id` because a task may be project-level; when a task has a phase, its `project_id` must match that phase's project.

## 3. Effective data model

The base ERD file and the applied migrations combine into the current effective schema.

### 3.1 `projects`

Key columns and constraints:

| Column | Type / nullability | Business meaning |
|---|---|---|
| `project_id` | `BIGINT UNSIGNED`, primary key | Stable project identifier; UI code is derived as `PRJ-####`. |
| `project_name` | `VARCHAR(255) NOT NULL` | Required display name. No database uniqueness rule. |
| `client_id` | `BIGINT UNSIGNED NULL` | Logical client reference only; no client table and no FK. Not written by the PM API. |
| `user_id` | `BIGINT UNSIGNED NOT NULL` | PM owner. FK to `users`; delete restricted. |
| `site_supervisor_id` | `BIGINT UNSIGNED NULL` | Assigned SS. FK to `users`; deleting the user sets this to null. |
| `client_name` | `VARCHAR(255) NULL` | Free-text client name used by the UI. |
| `location` | `VARCHAR(255) NULL` | Site address or location description. |
| `latitude`, `longitude` | `DECIMAL(10,7) NULL` | Coordinates. Not written by the current PM project form. |
| `start_date`, `end_date` | `DATE NULL` | Operational project timeline. |
| `approved_budget` | `DECIMAL(15,2) NOT NULL DEFAULT 0.00` | Approved project budget ceiling. |
| `materials_budget` | `DECIMAL(15,2) NOT NULL DEFAULT 0.00` | Project-level materials allocation. Added by migration. |
| `equipment_budget` | `DECIMAL(15,2) NOT NULL DEFAULT 0.00` | Project-level equipment allocation. Added by migration. |
| `remaining_budget` | `DECIMAL(15,2) NOT NULL DEFAULT 0.00` | Budget remaining after posted usage costs. Maintained by cost-posting triggers. |
| `deadline` | `DATE NULL` | Separate legacy/contract date; not written by current PM project create/edit. |
| `status` | `VARCHAR(50) NULL` | Application-controlled status; no database `CHECK` constraint. |
| `created_by`, `updated_by` | `BIGINT UNSIGNED NULL` | Audit actor references. |

### 3.2 `project_phases`

| Column | Type / nullability | Business meaning |
|---|---|---|
| `phase_id` | `BIGINT UNSIGNED`, primary key | Stable phase identifier. |
| `project_id` | `BIGINT UNSIGNED NOT NULL` | Parent project. FK to `projects` with `ON DELETE CASCADE`. |
| `project_name` | `VARCHAR(255) NULL` | Phase display name. Required by the application even though the column is nullable. |
| `description` | `VARCHAR(255) NULL` | Optional phase description. |
| `sequence_no` | `INT UNSIGNED NULL` | Display/order number. No uniqueness constraint per project. |
| `required_skill_id` | `BIGINT UNSIGNED NULL` | Optional skill. FK to `skill`; deleting the skill sets this to null. |
| `project_cost` | `DECIMAL(15,2) NULL` | Planning budget for the phase. |
| `materials_budget` | `DECIMAL(15,2) NOT NULL DEFAULT 0.00` | Phase-level materials allocation. Added by migration with no backfill. |
| `equipment_budget` | `DECIMAL(15,2) NOT NULL DEFAULT 0.00` | Phase-level equipment allocation. Added by migration with no backfill. |
| `planned_start`, `planned_end` | `DATE NULL` | Planned phase dates. |
| `status` | `ENUM('Not Started','In Progress','Completed') NULL` | Phase lifecycle status. Application initializes new rows to `Not Started`. |
| `completion_requested_at` | `TIMESTAMP NULL` | Time the SS requested completion; null when no request is pending. |
| `completion_requested_by` | `BIGINT UNSIGNED NULL` | User ID of the requesting SS. No FK is declared. |
| `created_by`, `updated_by` | `BIGINT UNSIGNED NULL` | Audit actor references. |

### 3.3 Foreign-key consequences

- Deleting a project directly would cascade-delete its phases, assignments, material usage, and equipment usage. There is no project-delete endpoint, so this must not be used as normal business behavior.
- Deleting a phase cascades its workforce assignments and material/equipment usage. Current code blocks deletion when those rows exist.
- `site_task.phase_id` uses `ON DELETE SET NULL`. Deleting a phase therefore does not delete its tasks; their phase link becomes null.
- `users` deletion behavior is restricted for project owners and set-null for supervisor/author references.

## 4. Role and permission matrix

Three system roles are in scope: **Admin**, **Project Manager**, and **Site Supervisor**.

| Capability | Admin | Project Manager | Site Supervisor |
|---|---|---|---|
| View all projects | Yes | No — own projects only | No — assigned sites only |
| View one project | Yes, read-only | Yes, own | Yes, assigned |
| Create project | No | Yes; owner becomes self | No |
| Edit project fields | No | Yes, own only | No |
| Change project status | No | Yes, own only | No |
| Delete project | No | No | No |
| View phases | Yes, all | Yes, own projects | Yes, assigned sites |
| Create phase | No | Yes, own projects | No |
| Edit phase definition | No | Yes, own projects | No |
| Delete phase | No | Yes, own projects, subject to guards | No |
| Start phase | No | Yes, own projects | No |
| Request phase completion | No | No | Yes, assigned sites, strict conditions |
| Approve phase completion | No | Yes, own projects | No |
| Reject phase completion | No | Yes, own projects | No |
| Read project budget/spend | Yes | Yes, own | Yes, currently exposed in SS site data |
| Add task | No | Yes, own projects (API only; current UI gap) | No |
| Update task status | No | No | Yes, assigned sites |
| View audit trail | Yes | No | No |

### 4.1 Authorization rules

1. PM mutation routes are protected by `role:Project Manager`. Admin GET access to PM routes is read-only oversight.
2. PM project mutations re-check `projects.user_id` against the signed-in PM. Ownership is not inferred from the selected project in the header.
3. PM phase mutations derive scope through `project_id → projects.user_id`.
4. SS access is derived only from `projects.site_supervisor_id`. A supervisor with no assignment has no site scope.
5. SS completion requests are nested under `role:Site Supervisor`; Admin cannot submit them.
6. A PM cannot read or mutate another PM's project or phase.
7. An Admin can read all project/phase rows through the Admin APIs and the PM read APIs, but has no project/phase write endpoint.
8. Role checks must be duplicated in the UI as a usability rule. Hiding a button is not authorization; the API remains authoritative.

### 4.2 Session and scope rules

- A PM's project list is filtered by `projects.user_id`; the selected project in the header can only narrow that list.
- An SS's project list is filtered by `projects.site_supervisor_id`; the site switcher can only narrow that list.
- Admin scope is unfiltered because the Admin role is intended for oversight.
- If a project has no `site_supervisor_id`, no SS may see it until a PM assigns one.
- Admin/PM/SS cannot change their own effective project scope through a query-string `project_id`; an out-of-scope ID must be ignored or rejected.
- No role may set `projects.user_id`, `created_by`, or `updated_by` from the project form.

## 5. Project business rules

| ID | Rule | Current enforcement |
|---|---|---|
| **BR-PRJ-01** | A project is a site. It has exactly one PM owner (`user_id`) and zero or one assigned Site Supervisor (`site_supervisor_id`). | **[Enforced]** by schema and API. |
| **BR-PRJ-02** | The PM who creates a project becomes its owner. Ownership cannot be changed from the project form. | **[Enforced]** — `user_id` is set from the signed-in PM; no owner field is accepted. |
| **BR-PRJ-03** | Only the owning PM may edit the project or change its status. Admin and SS are read-only. | **[Enforced]** at route and controller level. |
| **BR-PRJ-04** | A new project must have an active Site Supervisor. The supervisor must hold the Site Supervisor role and be active. | **[Enforced]** on create. |
| **BR-PRJ-05** | A project must always have one active Site Supervisor while operational. A supervisor may be replaced by another active supervisor, but must not be cleared to null. | **[Partial]** — create requires it; update cannot clear it because null falls back to the current ID. A deactivated current supervisor can still remain on the project. |
| **BR-PRJ-06** | `project_name` is required, 1–255 characters, and identifies the site. Names need not be globally unique. | **[Enforced]** by API and `NOT NULL` column; no uniqueness rule. |
| **BR-PRJ-07** | `client_name` and `location` are optional, maximum 255 characters. `client_id` and coordinates are not part of the current PM form. | **[Enforced]** in the PM API; unused fields are ignored. |
| **BR-PRJ-08** | `start_date` and `end_date` are optional. If both are supplied, `end_date` must not be earlier than `start_date`. | **[Enforced]** — enforced in the PM modal and API. |
| **BR-PRJ-09** | `end_date` is the operational target completion date. `deadline` is a separate legacy/contract date and is not written by current project create/edit. | **[Gap]** — the UI shows both dates, but the API never writes `deadline`; new projects have no deadline. |
| **BR-PRJ-10** | Project status starts at `Not Started` and follows only the transitions in `STATUS_BUSINESS_RULES.md`. `Completed` is terminal. | **[Enforced]** by `PmController` and audited through Eloquent. |
| **BR-PRJ-11** | Ordinary project create/edit does not accept a status, owner, or completion field. Status changes use the explicit transition endpoint only. | **[Enforced]** — status is not in project validation. |
| **BR-PRJ-12** | A project may be marked `Completed` without all phases being `Completed`; completion is a PM responsibility, not inferred from phases. | **[Enforced by approved status rule]**. This is intentional in the current status document but can leave progress below 100% on a completed project. |
| **BR-PRJ-13** | A `Completed` project is terminal for status, but current edit endpoints still allow its fields and budgets to change. The target immutability policy is not yet decided. | **[Gap]** — no edit lock after completion. |
| **BR-PRJ-14** | There is no project deletion. Projects and their history are retained. | **[Enforced]** — no route or UI action exists. |
| **BR-PRJ-15** | Every project create, update, delete, and status transition is audited. | **[Enforced]** by `AuditObserver` on `Project`. |

### 5.1 Project lifecycle

```text
[create]
   ↓
Not Started ──Start Project──→ On Track
                                  ├──Mark Delayed──→ Delayed
                                  ├──Put on Hold───→ On Hold
                                  └──Complete──────→ Completed (terminal)
Delayed ──Resume──→ On Track
Delayed ──Put on Hold──→ On Hold
Delayed ──Complete──→ Completed
On Hold ──Resume──→ On Track
On Hold ──Mark Delayed──→ Delayed
On Hold ──Complete──→ Completed
```

Rules:

- The initial status is always `Not Started`.
- No transition may skip through an unlisted state.
- `Completed` has no outgoing transition.
- The PM must use the status action buttons; no project form has a status dropdown.
- A project's phases are **not** automatically changed when the project status changes.
- The system does not auto-start, auto-hold, auto-delay, or auto-complete a project.
- The current API does not require phases to be complete before the project can be completed. This follows `STATUS_BUSINESS_RULES.md` and is a business responsibility of the PM.

### 5.2 Project editing rules

| Rule | Current behavior |
|---|---|
| Only owner PM may edit | **[Enforced]** |
| Project name cannot be blank | **[Enforced]** |
| Client/location are optional | **[Enforced]** |
| Start/end dates are optional | **[Enforced]** |
| End date not before start date | **[Enforced — UI and API]** |
| Active supervisor required | **[Partial]** — create requires it; update accepts null but retains current |
| Budget allocations cannot exceed total | **[Enforced]** |
| Status cannot be edited | **[Enforced]** |
| Owner cannot be edited | **[Enforced]** |
| Completed project cannot be edited | **[Gap]** — currently editable |
| `deadline` can be edited | **[Gap]** — no UI/API write path |
| `client_id`, latitude, longitude can be edited | **[Gap / unused]** — not exposed by current form |

### 5.3 Project creation defaults

- `approved_budget` defaults to `0` when omitted.
- `materials_budget` defaults to **50% of approved budget** when omitted.
- `equipment_budget` defaults to **15% of approved budget** when omitted.
- `remaining_budget` starts equal to `approved_budget`.
- `status` starts as `Not Started`.
- `created_by` and `updated_by` are the creating PM.
- `user_id` is the creating PM.
- The current PM form sends all three budget values explicitly, so the 50/15 defaults mainly protect direct API calls or older clients.

### 5.4 Project budget rules

| ID | Rule | Current enforcement |
|---|---|---|
| **BR-PRJ-B01** | `approved_budget`, `materials_budget`, and `equipment_budget` must be numeric and cannot be negative. | **[Enforced]** |
| **BR-PRJ-B02** | `materials_budget + equipment_budget` must not exceed `approved_budget`. | **[Enforced]** in API and PM modal. |
| **BR-PRJ-B03** | Labor has no separate allocation column. Current reporting treats labor allocation as `approved_budget - materials_budget - equipment_budget`. | **[Enforced by calculation]** |
| **BR-PRJ-B04** | `remaining_budget` is system-maintained. It starts at the approved budget and is reduced/refunded by usage-cost triggers. | **[Enforced]** via triggers. |
| **BR-PRJ-B05** | Updating the approved budget preserves already-posted spend: spend is inferred as `old approved - old remaining`, then `remaining = max(0, new approved - spend)`. | **[Enforced]** |
| **BR-PRJ-B06** | A PM should not be able to reduce the approved budget below spend already posted. | **[Gap]** — the API clamps remaining to zero instead of rejecting the edit. |
| **BR-PRJ-B07** | A PM should not be able to reduce a resource allocation below spend already posted against that resource. | **[Gap]** — no check exists; resource remaining can become negative in reporting. |
| **BR-PRJ-B08** | Phase budgets are planning values and do not by themselves post cost or reduce `remaining_budget`. | **[Enforced]** |
| **BR-PRJ-B09** | The sum of phase budgets should not exceed the corresponding project allocation. | **[Gap / decision required]** — no phase-budget cap exists. |
| **BR-PRJ-B10** | `remaining_budget` may become negative when usage costs exceed the approved budget. Reporting clamps displayed spend to zero/approved-relative values in some screens. | **[Known behavior]** — the trigger itself does not prevent overspend. |

Budget calculations currently in use:

```text
project spent     = approved_budget - remaining_budget
project remaining = remaining_budget
project utilization = spent / approved_budget × 100  (0 when approved_budget = 0)
labor allocation  = approved_budget - materials_budget - equipment_budget
phase actual cost = sum(labor_hour_log.computed_cost)
                  + sum(material_usage.computed_cost)
                  + sum(equipment_usage.computed_cost)
```

`project_cost` is **not** included in the phase actual-cost formula.

### 5.5 Project progress

**[Enforced]**

```text
PM project progress =
    completed phases / total phases × 100
    (0 when the project has no phases)
```

- A phase counts as completed only when `project_phases.status = 'Completed'`.
- Progress is not weighted by phase budget, actual cost, or task count.
- The PM project list returns `phase_count`, `worker_count`, and `progress`.
- Admin project data returns `phase_count` and budget summaries, but does not expose project progress.
- SS project/site progress uses a different, task-based formula. See §8.

### 5.6 Project status and phase lifecycle interaction

- Project status does not automatically change phase status.
- Phase status does not automatically change project status.
- A project may be `On Hold` while a phase remains `In Progress`.
- A project may be `Completed` while phases remain `Not Started` or `In Progress`.
- Current phase start, assignment, task, material, and equipment endpoints do not check project status. **[Gap]**
- Target decision: define whether `Completed` and `On Hold` projects must block phase starts and operational writes. See §14.

### 5.7 Project deletion and archival

- No role may delete a project through the UI or API.
- There is no archive flag. Historical projects remain in lists and reports.
- Direct database deletion would cascade through phases, assignments, and usage rows; this is outside the business API and must not be used as an application operation.
- If a project is no longer active, the approved mechanism is its status (`Completed`, `On Hold`, or `Delayed`), not deletion.

## 6. Phase business rules

| ID | Rule | Current enforcement |
|---|---|---|
| **BR-PHS-01** | A phase belongs to exactly one project. `project_id` is required on create and cannot be changed by an update. | **[Enforced]** |
| **BR-PHS-02** | Phase names are stored in `project_phases.project_name`. `phase_name` is the API/UI term. A phase name is required, 1–255 characters. | **[Enforced]** by API and UI. |
| **BR-PHS-03** | `description` is optional and limited to 255 characters. | **[Enforced]** by API. |
| **BR-PHS-04** | `sequence_no` is optional in the current API and is at least 1 when supplied. It controls display order; it does not enforce execution order. | **[Enforced]** as an input rule; **[Gap]** for uniqueness and lifecycle ordering. |
| **BR-PHS-05** | `planned_start` and `planned_end` are optional. If both are supplied, `planned_end` must not be earlier than `planned_start`. | **[Enforced]** — API and PM modal. |
| **BR-PHS-06** | Phase planned dates must fall within the parent project’s `start_date` and `end_date` when those project dates exist. | **[Enforced]** — API and PM modal. |
| **BR-PHS-07** | `required_skill_id` is optional and must reference an existing skill. Skill match is advisory; assigning a worker does not require that skill. | **[Enforced]** — API, FK, and PM phase modal. |
| **BR-PHS-08** | `project_cost`, `materials_budget`, and `equipment_budget` are optional planning amounts and cannot be negative. New phase resource allocations default to 0. | **[Enforced]** |
| **BR-PHS-09** | Phase budgets are planning data. They do not post costs; actual cost comes from usage rows. | **[Enforced by calculation]** |
| **BR-PHS-10** | A phase begins as `Not Started`. Ordinary create/edit does not accept a status value. | **[Enforced]** on create; status is not in phase validation. |
| **BR-PHS-11** | Only the owning PM may start a phase, and only from `Not Started` to `In Progress`. | **[Enforced]** for current status; **[Gap]** for project-status and sequence prerequisites. |
| **BR-PHS-12** | Only an assigned SS may request completion, and only for an `In Progress` phase on their site. | **[Enforced]** |
| **BR-PHS-13** | A completion request requires at least one phase task and every phase task must be `Done`. | **[Enforced]** |
| **BR-PHS-14** | A pending request records `completion_requested_at` and `completion_requested_by`; the phase remains `In Progress`. | **[Enforced]** |
| **BR-PHS-15** | Only the owning PM may approve a pending request. Approval requires `In Progress`, a pending request, at least one task, and no open task. | **[Enforced]** |
| **BR-PHS-16** | A PM may reject a pending request. Rejection returns the phase to ordinary `In Progress`, clears the request fields, and does not complete the phase. | **[Enforced]** |
| **BR-PHS-17** | `Completed` is terminal for phase status. There is no reopen endpoint. | **[Enforced]** for status transitions. |
| **BR-PHS-18** | A completed phase should not accept new definition edits, assignments, tasks, or usage without an explicit correction policy. | **[Gap]** — current endpoints allow these actions. |
| **BR-PHS-19** | A phase can be deleted only by its owning PM, only when it is `Not Started`, and only when it has no tasks, assignment, usage, labor history, or pending request. | **[Enforced]** |
| **BR-PHS-20** | Every phase create, update, delete, status transition, and completion-request change is audited. | **[Enforced]** by `AuditObserver` on `ProjectPhase`. |

### 6.1 Phase lifecycle

```text
[create]
   ↓
Not Started ──Start Phase (PM)──→ In Progress
                                      │
                                      ├──Request Completion (SS)
                                      │      status stays In Progress
                                      │      request timestamp/by recorded
                                      │
                                      ├──Approve Completion (PM)
                                      │      → Completed (terminal)
                                      │
                                      └──Reject Request (PM)
                                             → In Progress
                                                request cleared
```

- `Not Started` phases are created by the PM.
- SS cannot start a phase.
- A `Completed` phase has no status action.
- A completion request is not a status value. It is a pair of request fields on an `In Progress` phase.
- No phase can move directly from `Not Started` to `Completed`.
- No phase can move from `Completed` back to `In Progress`.

### 6.2 Phase creation rules

A PM may create a phase only when:

1. The signed-in user has the Project Manager role.
2. The target project belongs to that PM.
3. The phase name is present and no longer than 255 characters.
4. Sequence, dates, skill, and budgets are valid when supplied.

The API performs the project-access check after validating the phase payload. A phase create request for a project outside the PM’s scope is rejected with `403`. The phase is initialized with `status = Not Started`, `created_by`, and `updated_by`.

The PM phase form now includes the required-skill picker and phase date validation. The API also enforces the same date rules.

### 6.3 Phase update rules

A PM may update a phase only when the phase belongs to one of their projects. The update endpoint:

- Does not accept `project_id`; a phase cannot be moved to another project.
- Does not accept `status`; status actions must use the dedicated endpoints.
- Preserves omitted editable fields instead of resetting them.
- Enforces planned date order and project-date containment.
- Enforces non-negative budgets.
- Does not enforce a phase-budget cap against the project.
- Does not block edits after `Completed`.
- Exposes `required_skill_id` in the PM modal; omitted values are preserved by the API.
- Preserves `materials_budget`, `equipment_budget`, and `project_cost` when omitted by a direct API client.

### 6.4 Phase completion request rules

The SS request endpoint `POST /api/v1/ss/phases/{id}/request-completion` must satisfy all of the following:

| Condition | Failure |
|---|---|
| Phase exists within the SS's assigned projects | `404` |
| Phase is not already `Completed` | `422` |
| Phase is `In Progress` | `422` |
| Phase has at least one task | `422` |
| Every phase task is `Done` | `422` |
| SS role and site assignment | `403` at route/scope level |

On success:

- `completion_requested_at` is set to the current server time.
- `completion_requested_by` is set to the SS user ID.
- Phase status remains `In Progress`.
- The PM sees a pending request in the phase list.
- The UI hides the request button while a request is pending.

**[Enforced]** A second request while one is already pending is rejected with `422`. The original timestamp and requester are not overwritten.

### 6.5 Phase approval and rejection rules

PM approval `PATCH /api/v1/pm/phases/{phase}/approve-completion` requires:

1. PM ownership of the phase's project.
2. Phase status `In Progress`.
3. A pending `completion_requested_at`.
4. At least one phase task.
5. Zero open tasks (`status != 'Done'`).

On approval:

- Status becomes `Completed`.
- `completion_requested_at` and `completion_requested_by` are cleared.
- `updated_by` records the PM.
- The phase is terminal for status.

PM rejection `PATCH /api/v1/pm/phases/{phase}/reject-completion` requires:

1. PM ownership.
2. Phase status `In Progress`.
3. A pending request.

On rejection:

- Status remains `In Progress`.
- Request fields are cleared.
- The phase can be worked on and requested again.

### 6.6 Phase deletion rules

Deletion is allowed only for the owning PM and only when all of the following are true:

1. Phase status is `Not Started`.
2. No completion request is pending.
3. No workforce assignment of any status exists for the phase.
4. No site task references the phase.
5. No labor-hour history exists through a phase assignment.
6. No material usage and no equipment usage exists for the phase.

The API returns `422` when any condition fails. This prevents tasks from being orphaned by the `site_task.phase_id ON DELETE SET NULL` foreign key and preserves completed work as history.

### 6.7 Phase status interaction with other modules

Current behavior:

| Related action | Checks phase status? |
|---|---|
| Create/edit workforce assignment | No |
| Create/edit task linked to phase | No |
| Log material usage | No |
| Log equipment usage | No |
| Request completion | Yes — must be `In Progress` |
| Approve/reject completion | Yes — must be `In Progress` |
| Edit phase definition | No |
| Delete phase | Yes — only `Not Started` and unused phases |

This means a `Completed` phase can still receive new workers, tasks, material usage, and equipment usage. It can no longer be deleted. The materials document already records the usage-status question as an open decision. The same decision must be applied consistently to assignments and tasks.

## 7. Field-level validation contract

### 7.1 Project create/update fields

| Field | Required | API rule | UI rule | Database rule / note |
|---|---|---|---|---|
| `project_name` | Yes | `required`, `string`, `max:255` | Required; trimmed | `NOT NULL`; no unique constraint |
| `client_name` | No | `nullable`, `string`, `max:255` | Optional | Nullable |
| `location` | No | `nullable`, `string`, `max:255` | Optional | Nullable |
| `start_date` | No | `nullable`, `date` | Optional date input | Nullable |
| `end_date` | No | `nullable`, `date`; controller rejects end < start | Optional; modal checks end ≥ start | Nullable; no DB check |
| `approved_budget` | No | `nullable`, `numeric`, `min:0` | Optional; empty means 0 | `NOT NULL DEFAULT 0`; `DECIMAL(15,2)` |
| `materials_budget` | No | `nullable`, `numeric`, `min:0` | Optional; empty means 0 | `NOT NULL DEFAULT 0`; create defaults to 50% if omitted |
| `equipment_budget` | No | `nullable`, `numeric`, `min:0` | Optional; empty means 0 | `NOT NULL DEFAULT 0`; create defaults to 15% if omitted |
| `site_supervisor_id` | Yes on create | `required` on create; `nullable` on update; integer; active user with Site Supervisor role | Required select | FK; nullable on update and legacy rows |
| `status` | No | Not in validation; ignored if sent | Not shown | App-only value; no DB constraint |
| `user_id` | No | Not in validation; ignored if sent | Not shown | Set from signed-in PM |
| `deadline` | No | Not in validation; ignored if sent | Displayed, not editable | Legacy/contract date |
| `client_id` | No | Not in validation; ignored if sent | Not shown | Unused logical reference |
| `latitude`, `longitude` | No | Not in validation; ignored if sent | Not shown | Unused by current form |
| `remaining_budget` | No | Not in validation; ignored if sent | Display only | Trigger-maintained |

Cross-field API validation currently enforced:

```text
approved_budget >= 0
materials_budget >= 0
equipment_budget >= 0
materials_budget + equipment_budget <= approved_budget
site_supervisor_id exists in users
site_supervisor.role_id = Site Supervisor role
site_supervisor.is_active = true
```

Cross-field validation still missing from the API (deferred policy):

```text
if approved_budget is reduced:
    approved_budget >= already-posted spend
```

### 7.2 Phase create/update fields

| Field | Required | API rule | UI rule | Database rule / note |
|---|---|---|---|---|
| `project_id` | Yes on create | `required`, `integer`; must be one of the PM's projects | Read-only selected project | FK to `projects`; immutable on update |
| `phase_name` | Yes | `required`, `string`, `max:255` | Required; trimmed | Stored in `project_name`; nullable DB but required by app |
| `description` | No | `nullable`, `string`, `max:255` | Optional | Nullable |
| `sequence_no` | No | `nullable`, `integer`, `min:1` | Optional, min 1 | Nullable; no unique constraint |
| `project_cost` | No | `nullable`, `numeric`, `min:0` | Optional, min 0 | `DECIMAL(15,2) NULL` |
| `materials_budget` | No | `nullable`, `numeric`, `min:0` | Optional; empty means 0 | `NOT NULL DEFAULT 0`; no backfill for existing phases |
| `equipment_budget` | No | `nullable`, `numeric`, `min:0` | Optional; empty means 0 | `NOT NULL DEFAULT 0`; no backfill for existing phases |
| `planned_start` | No | `nullable`, `date` | Optional date input | Nullable |
| `planned_end` | No | `nullable`, `date`; controller rejects end < start and dates outside project | Optional date input; modal mirrors both checks | Nullable |
| `required_skill_id` | No | `nullable`, `integer`, exists in `skill` | Skill picker; optional | FK to `skill`; omitted values are preserved |
| `status` | No | Not in validation; ignored if sent | Not shown | Enum; app sets `Not Started` |
| `completion_requested_at` | No | Not in validation; ignored if sent | Displayed | Set by SS request |
| `completion_requested_by` | No | Not in validation; ignored if sent | Not shown | Set by SS request |
| `project_id` on update | No | Ignored by validator | Read-only | Parent cannot be changed |

Cross-field phase validation currently enforced:

```text
if planned_start and planned_end:
    planned_end >= planned_start

if project.start_date and planned_start:
    planned_start >= project.start_date

if project.end_date and planned_end:
    planned_end <= project.end_date
```

Phase budget-cap validation is still pending approval:

```text
if phase budget caps are approved:
    sum(project_cost) <= project.approved_budget
    sum(materials_budget) <= project.materials_budget
    sum(equipment_budget) <= project.equipment_budget
```

### 7.3 Status fields are never ordinary form fields

- `projects.status` is not accepted by project create/update.
- `project_phases.status` is not accepted by phase create/update.
- Status changes use the dedicated action endpoints.
- The UI uses badges and action buttons, not a status dropdown.
- The backend re-checks role, ownership, current status, target status, and preconditions.

### 7.4 API error conventions

| Situation | Expected response |
|---|---|
| Wrong role at route level | `403` |
| PM accesses another PM's project/phase | `403` for project/phase update-delete; current phase start/approval uses `404` |
| SS requests completion for another site | `404` |
| Unknown project ID in route binding | `404` |
| Missing/invalid field | `422` with field errors |
| Invalid status transition | `422` with a clear message |
| Lifecycle condition not met (tasks open, no request, no supervisor) | `422` |
| Successful create | `201` |
| Successful read/update/action | `200` |

The mixed `403`/`404` behavior for cross-project phase access is a consistency gap. The target rule should standardize authorization failures without revealing whether an out-of-scope record exists.

## 8. Progress and completion dependency rules

### 8.1 Phase progress

The SS phase payload calculates progress as follows:

```text
if phase.status = Completed:      progress = 100
else if phase.status = Not Started: progress = 0
else if phase.status = In Progress:
    progress = done phase tasks / total phase tasks × 100
    (0 when the phase has no tasks)
```

Consequences:

- A phase with all tasks `Done` but no PM approval shows **100% progress** while its status is still `In Progress`.
- A phase with no tasks shows 0% and cannot be requested complete.
- A phase with an open task is below 100%.
- The progress percentage is not stored; it is derived on every read.
- Project-level tasks (`phase_id = null`) do not count toward any phase.

### 8.2 Project progress by role

| Role/screen | Formula | Source |
|---|---|---|
| PM project list | `completed phases / total phases × 100` | `PmController::projectsFor()` |
| PM dashboard | Aggregates project budgets and phase counts | `PmController::dashboard()` |
| SS site/page | Average of the task-based phase progress values | `SsController::projectProgress()` / `phasesPayload()` |
| Admin project table | No project progress field; phase count only | `AdminController::projects()` |

These formulas can disagree:

- A project with two phases, one `Completed` and one `In Progress` at 0% tasks has PM progress **50%**.
- SS site progress for the same project could be **(100 + 0) / 2 = 50%** if the in-progress phase has no tasks, or a different value if it has tasks.
- A project marked `Completed` with unfinished phases can show less than 100% in both PM and SS views.

### 8.3 Completion dependency on tasks

The following are current business dependencies, not optional UI hints:

1. A phase must have at least one `site_task` row.
2. Every phase task must be `Done`.
3. Only then can the SS request completion.
4. Only then can the PM approve completion.

This creates a cross-feature dependency:

- Phase completion depends on task authoring.
- The PM Phases page renders `TasksPanel` below the phase table.
- `TaskModal` uses the existing PM task APIs (`POST/PUT/DELETE /pm/tasks`).
- The SS schedule can update task status but cannot create tasks.

Task authoring is therefore available again in the PM workflow. The task panel does not create assignments automatically; the existing workforce and task-worker rules still apply.

### 8.4 Task changes after completion

Current code allows:

- Creating a new task on a `Completed` phase.
- Moving an existing task to a `Completed` phase.
- Deleting a task from a `Completed` phase.
- Reopening a task? No: task statuses are terminal at `Done`, so status cannot move backward.

Because phase status is already `Completed`, adding an open task does not reopen it. This produces a completed phase with open tasks and invalidates the historical completion snapshot. Target: block task create/move/delete after phase completion, or explicitly define a post-completion correction workflow.

### 8.5 Completion request freshness

- The request is considered pending while `completion_requested_at` is non-null.
- The PM UI shows a “Completion Requested” badge.
- The PM can approve or reject only while the phase is `In Progress` and the request is pending.
- If tasks change after the request, PM approval re-checks tasks and fails if any are open.
- Rejection clears the request and allows the SS to request again.
- A second SS request does not create a second request record; it updates the same fields. This is a gap described in §6.4.

## 9. Status contract summary

This section is a summary only. `STATUS_BUSINESS_RULES.md` is authoritative.

### 9.1 Project statuses

| Current | Allowed next | Actor | Action |
|---|---|---|---|
| `Not Started` | `On Track` | Owning PM | Start Project |
| `On Track` | `Delayed`, `On Hold`, `Completed` | Owning PM | Mark Delayed / Put on Hold / Complete Project |
| `Delayed` | `On Track`, `On Hold`, `Completed` | Owning PM | Resume / Put on Hold / Complete Project |
| `On Hold` | `On Track`, `Delayed`, `Completed` | Owning PM | Resume / Mark Delayed / Complete Project |
| `Completed` | None | — | Terminal |

### 9.2 Phase statuses

| Current | Allowed next | Actor | Action |
|---|---|---|---|
| `Not Started` | `In Progress` | Owning PM | Start Phase |
| `In Progress`, no request | `In Progress` + request fields set | Assigned SS | Request Completion |
| `In Progress`, request pending | `Completed` | Owning PM | Approve Completion |
| `In Progress`, request pending | `In Progress`, request cleared | Owning PM | Reject Request |
| `Completed` | None | — | Terminal |

### 9.3 Status invariants

1. No ordinary project or phase form accepts a status field.
2. No bulk status update exists.
3. Every transition is an explicit action.
4. Every transition is audited.
5. Invalid transitions return `422`.
6. Authorization is re-checked on every transition.
7. A phase cannot be completed without a pending SS request.
8. A phase cannot be requested complete without at least one task and all tasks `Done`.
9. A completed project or phase cannot be reopened through the current UI/API.
10. Existing valid legacy statuses are preserved; no bulk status rewrite is performed.

## 10. API contract

All routes are under `/api/v1` and require Sanctum authentication.

### 10.1 Project Manager and Admin read routes

| Method | Path | Who may call | Purpose |
|---|---|---|---|
| `GET` | `/pm/projects` | Admin, PM | List projects in scope; PM sees own, Admin sees all |
| `GET` | `/pm/phases` | Admin, PM | List phases in scope; optionally filtered by `project_id` |
| `GET` | `/pm/dashboard` | Admin, PM | Project metrics, costs, upcoming deadlines |
| `GET` | `/pm/budgets` | Admin, PM | Project resource budgets and usage |
| `GET` | `/pm/cost-report` | Admin, PM | Category cost totals |
| `GET` | `/pm/phase-costs` | Admin, PM | Per-phase actual costs |
| `GET` | `/pm/balance` | Admin, PM | Project balance rows |
| `GET` | `/pm/site-supervisors` | Admin, PM | Active SS directory; `include_inactive=1` for all |

### 10.2 Project Manager mutation routes

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/pm/projects` | Create a project owned by the signed-in PM |
| `PUT` | `/pm/projects/{project}` | Update own project metadata, timeline, supervisor, budgets |
| `PATCH` | `/pm/projects/{project}/status` | Apply an allowed project status transition |
| `POST` | `/pm/phases` | Create a phase in an owned project |
| `PUT` | `/pm/phases/{phase}` | Update an owned phase definition |
| `DELETE` | `/pm/phases/{phase}` | Delete an unused owned phase |
| `PATCH` | `/pm/phases/{phase}/start` | `Not Started` → `In Progress` |
| `PATCH` | `/pm/phases/{phase}/approve-completion` | Complete a phase with a pending SS request |
| `PATCH` | `/pm/phases/{phase}/reject-completion` | Clear a pending request without completing |

There is no `DELETE /pm/projects/{project}` route.

### 10.3 Admin read routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/projects` | All projects with manager, budget, phase count |
| `GET` | `/admin/phases` | All phases across projects |
| `GET` | `/admin/assignments` | All workforce assignments |
| `GET` | `/admin/resources` | Material/equipment catalogue and usage summary |
| `GET` | `/admin/search` | Admin-wide project/phase search |

Admin has no project/phase create, update, status, or delete route.

### 10.4 Site Supervisor routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/ss/site` | Selected assigned site and phases |
| `GET` | `/ss/site/info` | Site details and phase list |
| `GET` | `/ss/phases` | Assigned-site phase list with task progress |
| `POST` | `/ss/phases/{id}/request-completion` | Request PM sign-off |
| `GET` | `/ss/schedule` | Site tasks |
| `PUT` | `/ss/tasks/{task}/status` | Update task status on an assigned site |

An SS cannot call PM project/phase mutation routes. An SS cannot request completion for a site they are not assigned to.

### 10.5 Request payload expectations

Project create/update:

```json
{
  "project_name": "Riverside Condominium",
  "client_name": "Client or company",
  "location": "City / site",
  "site_supervisor_id": 24,
  "start_date": "2026-01-10",
  "end_date": "2026-12-15",
  "approved_budget": 2400000,
  "materials_budget": 1200000,
  "equipment_budget": 360000
}
```

Phase create/update:

```json
{
  "phase_name": "Foundation Works",
  "description": "Footings and pile caps",
  "sequence_no": 2,
  "project_cost": 800000,
  "materials_budget": 250000,
  "equipment_budget": 50000,
  "planned_start": "2026-02-11",
  "planned_end": "2026-06-30",
  "required_skill_id": 9
}
```

Status actions send only the target status where applicable:

```json
{ "status": "On Track" }
```

Phase start, approve, and reject send no status body; the action is encoded in the endpoint.

### 10.6 Response expectations

- Project/phase list endpoints return `{ "data": [...] }` with numeric IDs and computed display fields.
- PM project rows include `code`, `phase_count`, `worker_count`, `progress`, budget, supervisor, and owner fields.
- PM phase rows include `phase_name`, `project`, `sequence_no`, dates, budget fields, status, completion request, and required skill.
- Admin project rows include manager, phase count, approved/remaining budget, and budget summary.
- Admin phase rows are a reduced projection and do not include phase material/equipment budgets, required skill, or completion request.
- SS phase rows include `name`, `sequence`, `progress`, `status`, `workers`, planned dates, and `completionRequestedAt`; they do not include phase budgets.

## 11. UI rules

### 11.1 PM — All Projects

Current controls:

- `+ New Project` opens the create modal.
- `View` opens the read-only project detail popup.
- `Edit` opens the same modal with existing values.
- Status cell shows the badge plus permitted action buttons.
- `Select` sets the project scope for phase/resource screens.
- No Delete action exists.

Project modal fields:

- Project Name (required)
- Client (optional)
- Location (optional)
- Site Supervisor (required, active list)
- Start Date
- Target End
- Total Budget
- Materials Budget Allocation
- Equipment Budget Allocation

The modal does not contain status, owner, deadline, client ID, latitude, or longitude.

### 11.2 PM — Phases

Current controls:

- `+ Add Phase`
- `View`
- `Edit`
- `Delete` only for `Not Started`
- `Start Phase` only for `Not Started`
- `Approve Completion` and `Reject Request` only for `In Progress` with a pending request
- Completion Requested badge
- No status dropdown

Phase modal fields:

- Project (read-only)
- Phase Name (required)
- Description
- Sequence
- Phase Budget
- Materials Budget
- Equipment Budget
- Planned Start
- Planned End
- Required Skill (optional)

The modal does not contain status or completion fields. The required skill is preserved when editing.

### 11.3 PM — task authoring

- `TasksPanel` is rendered below the phase table.
- `TaskModal` is used by `TasksPanel` to create and edit project tasks.
- Task creation still requires a phase and an actively assigned worker when a worker is selected.
- The API still requires at least one `Done` task before phase completion can be requested or approved.

### 11.4 Admin

- Admin Projects is read-only.
- Admin Phases is read-only.
- Admin can see project budgets and phase cost, but the phase table does not currently show phase material/equipment allocations or required skill.
- Admin cannot change project status, edit phases, or request completion.

### 11.5 Site Supervisor

- SS sees only assigned sites in the site switcher.
- SS sees phase name, sequence, workers, progress, status, planned dates, and completion request state.
- SS can request completion only when the phase is `In Progress`, has tasks, all tasks are `Done`, and no request is already pending.
- SS sees project budget/spend on the site detail screen. This conflicts with the original scope matrix, which described budgets as Admin/PM only. The product decision must be recorded before this is changed.

## 12. Audit and historical integrity

### 12.1 Audited models

`Project` and `ProjectPhase` are registered with `AuditObserver` in `AppServiceProvider`.

Every create, update, and delete writes an `audit_logs` row with:

- `project_id` — the owning project.
- `table_name` — `projects` or `project_phases`.
- `record_id` — the project/phase primary key.
- `action_type` — `INSERT`, `UPDATE`, or `DELETE`.
- `old_value` / `new_value` — changed fields only for updates.
- `changed_by` — authenticated actor.
- `charge_at` — timestamp.

### 12.2 Status and completion audit

- Project status changes use Eloquent, not raw SQL, so the observer fires.
- Phase start/approve/reject use Eloquent `update()`, so status and request-field changes are audited.
- SS completion requests use `ProjectPhase::update()`, so request fields are audited.
- Ordinary project and phase updates are audited.
- Phase deletion records the deleted attributes before the row is removed.

### 12.3 Historical integrity rules

1. Project deletion is prohibited; history remains available.
2. Phase deletion must not be used to erase history. See the deletion policy in §6.6.
3. Completed phase status is not reversed through the API.
4. Audit records must not be deleted as part of a project/phase correction.
5. `updated_by` must be set to the acting PM for PM writes and to the acting SS for completion requests.
6. Phase cost history comes from usage rows, not from edits to `project_cost`.
7. Cost posting changes `projects.remaining_budget` via triggers; those changes may update `updated_at` without a project audit event. Usage rows themselves are audited.

## 13. Known implementation gaps

The following gaps were identified during the audit. Items marked **Resolved** are enforced in the current safe scope; the remaining items require product approval.

| ID | Severity | Gap | Current behavior | Required decision / fix |
|---|---|---|---|---|
| **G-01** | Resolved | PM task authoring | `TasksPanel` is rendered below the PM phase table. | Resolved in the safe enforcement pass. |
| **G-02** | Resolved | Project date order was UI-only | API now rejects `end < start`. | Resolved with the project date guard. |
| **G-03** | Resolved | Phase dates were unvalidated | API and modal now enforce phase order and project-date containment. | Resolved with the phase date guard. |
| **G-04** | High | Completed project/phase not immutable | A PM can edit a completed project/phase; phases can be added, started, assigned, or used after completion. | Decide freeze policy; block disallowed mutations consistently. |
| **G-05** | Resolved | Phase deletion ignored tasks/status/request | Deletion now requires `Not Started`, no tasks, no request, no assignment, no labor history, and no usage. | Resolved with deletion guards. |
| **G-06** | Resolved | Duplicate completion requests overwrote | A second SS request now returns `422` while one is pending. | Resolved with the duplicate-request guard. |
| **G-07** | Resolved | Phase edit wiped required skill | Phase modal now exposes a skill picker; omitted updates preserve the existing skill. | Resolved. |
| **G-08** | Resolved | Phase PUT was destructive for omitted fields | Omitted phase fields are now preserved by the API. | Resolved. |
| **G-09** | High | No phase budget cap or backfill | Phase budgets default 0; migration adds columns without backfilling; phase totals can exceed project allocations. | Approve cap policy; backfill existing phases or treat 0 as “unallocated.” |
| **G-10** | High | Budget can be reduced below spent | Approved budget can be lowered below posted spend; remaining clamps to 0; resource allocations can fall below spend. | Reject or require explicit override with audit. |
| **G-11** | Medium | `deadline` is orphaned | PM creates/updates only `end_date`; `deadline` is displayed but never written; dashboard deadline logic uses the legacy field. | Define one authoritative date or make `deadline` derived from `end_date`. |
| **G-12** | Policy | SS can see project budgets/spend | SS site payload includes budgets, spend, and resource usage. The scope audit says budgets are Admin/PM only. | Decide whether SS should see financials; if not, remove from SS payload/UI. |
| **G-13** | Medium | Supervisor deactivation/unassignment | A deactivated SS remains linked to projects; editing the project may fail unless a new active SS is selected; update cannot clear the field. | Define reassignment policy and validate active supervisor consistently. |
| **G-14** | Medium | Sequence is not unique or enforced | Duplicate `sequence_no` values are allowed; phase order is display-only; no previous-phase completion gate. | Decide whether sequence must be unique and whether phases may overlap. |
| **G-15** | Medium | Cross-project phase errors are inconsistent | Update/delete return 403; start/approve/reject return 404. | Standardize authorization responses while avoiding ID disclosure. |
| **G-16** | Partially resolved | Project/phase CRUD tests | `ProjectPhaseManagementTest` now covers the safe validation/deletion scope; deferred policy behavior remains untested. | Add tests when policy items are approved. |
| **G-17** | Low | Project/phase name uniqueness undefined | No unique constraints or duplicate checks exist. | Decide whether duplicates are allowed. |
| **G-18** | Low | No owner transfer | `projects.user_id` cannot be changed. | Keep no-transfer policy or add an explicit audited transfer workflow. |

### 13.1 Current data notes

- Existing phases were created before the phase-budget migration; those new columns default to `0` and were not backfilled.
- Existing projects may have a `deadline` that differs from `end_date`.
- Existing projects may have no assigned Site Supervisor, which intentionally prevents SS access.
- Existing phases may have `required_skill_id` values; they are now editable from the PM phase modal and preserved when omitted from an update.
- The live status snapshot in `STATUS_BUSINESS_RULES.md` remains the reference for status counts; this document does not replace that snapshot.

## 14. Approval points before implementation

The following decisions were not settled by the original code. Items marked **Resolved** were implemented in the approved safe scope. The remaining items still require product approval before schema or behavior changes.

| ID | Decision | Current behavior | Recommended default |
|---|---|---|---|
| **AP-01** | Where should PM task authoring live? | **Resolved:** `TasksPanel` restored under PM Phases | Keep task authoring in the PM phase workflow. |
| **AP-02** | May phases overlap, or must phase N be completed before phase N+1 starts? | Any phase can be started; sequence is display-only | Keep overlap allowed unless construction policy requires strict sequencing. |
| **AP-03** | Must a project be `On Track` or `Delayed` before a phase can start? | Any phase can start regardless of project status | Block phase start when project is `Not Started`, `On Hold`, or `Completed`. |
| **AP-04** | Are `Completed` projects and phases fully immutable? | No; most writes still work | Freeze phase definitions and new work; allow only explicit, audited corrections. |
| **AP-05** | Do phase budget totals need to fit inside project allocations? | No cap; legacy phase budgets are 0 | Warn first, then enforce after a backfill; do not block legacy phases with zero allocations. |
| **AP-06** | May an approved budget be reduced below posted spend? | Yes; remaining clamps to 0 | Reject the edit unless an explicit audited override is supplied. |
| **AP-07** | Which date is authoritative: `end_date` or `deadline`? | Both exist; only `end_date` is written | Use `end_date` as operational target and make `deadline` read-only/derived, or remove it from active UI. |
| **AP-08** | How should supervisor reassignment/deactivation work? | Cannot clear; deactivated supervisor can remain linked | Require an active supervisor for operational projects; on deactivation, flag projects for reassignment. |
| **AP-09** | May a phase be deleted after it has tasks or a completion request? | **Resolved:** only `Not Started` phases with no tasks/request/assignment/usage/labor history | Keep the guarded deletion rule. |
| **AP-10** | Should duplicate sequence numbers be allowed? | Yes | Enforce unique `sequence_no` per project after cleaning legacy duplicates. |
| **AP-11** | Should duplicate completion requests be rejected or idempotent? | **Resolved:** duplicate request returns `422` | Keep the rejection behavior. |
| **AP-12** | Should Site Supervisors see project budgets and spend? | Yes, on site details | Keep if field operations need it; otherwise remove from SS payload and UI. |
| **AP-13** | Should project/phase names be unique? | No uniqueness | Keep non-unique display names; use project/phase IDs for identity. |
| **AP-14** | Should project ownership ever transfer between PMs? | No | Keep no-transfer unless an explicit audited transfer workflow is requested. |
| **AP-15** | Should tasks be allowed to exist on a phase in any status? | Yes | Allow `Pending`/`In Progress` tasks only while phase is `In Progress`; block new work after completion. |

## 15. Acceptance criteria and test scenarios

### 15.1 Project acceptance criteria

1. A PM can create a project with a derived project code and `Not Started` status.
2. A project cannot be created without an active Site Supervisor.
3. The signed-in PM becomes `user_id`, `created_by`, and `updated_by`.
4. A project cannot be created or edited with a negative budget.
5. Materials plus equipment allocation cannot exceed the approved budget.
6. A project cannot be edited by another PM, an Admin, or an SS.
7. `end_date` cannot be before `start_date` at the API boundary.
8. Project status follows only the approved transitions.
9. `Completed` project status is terminal.
10. A project cannot be deleted by any role.
11. Project mutations and status changes appear in the audit trail.
12. Admin can read all projects but cannot mutate them.
13. SS can read only projects where they are the assigned supervisor.
14. A project with no assigned SS is invisible to SS users.

### 15.2 Phase acceptance criteria

1. A PM can create a phase only inside an owned project.
2. A phase created through the API starts as `Not Started`.
3. A phase cannot be moved to another project.
4. A phase cannot be created with a negative phase budget.
5. If phase dates are supplied, `planned_end >= planned_start`.
6. Phase dates must fall inside project dates when both boundaries exist.
7. A phase cannot be started by an Admin or SS.
8. A phase can be started only from `Not Started`.
9. Starting a phase does not change project status.
10. SS cannot request completion for a phase they cannot access.
11. SS cannot request completion for a `Not Started` or `Completed` phase.
12. SS cannot request completion when the phase has no tasks or has open tasks.
13. A duplicate pending request is rejected or safely idempotent.
14. PM cannot approve completion without a pending request.
15. PM cannot approve completion while any phase task is open.
16. Approval sets `Completed` and clears request fields.
17. Rejection keeps `In Progress` and clears request fields.
18. Completed phase status cannot be reopened through the API.
19. An unused phase can be deleted by its owning PM.
20. A phase with tasks, assignments, usage, or a pending request cannot be deleted.
21. Admin can read all phases but cannot mutate them.
22. SS can read only phases on assigned sites.
23. All phase mutations appear in the audit trail.

### 15.3 Required test cases

| Test | Expected result |
|---|---|
| PM creates project without name | `422` |
| PM creates project without supervisor | `422` |
| PM creates project with inactive supervisor | `422` |
| PM creates project with materials + equipment > approved | `422` |
| Direct API project with end before start | `422` |
| PM edits another PM's project | `403` |
| Admin calls project update | `403` at route |
| SS calls project update | `403` at route |
| PM creates phase in another PM's project | `403` |
| Phase create with blank name | `422` |
| Phase create with negative budget | `422` |
| Phase update with end before start | `422` |
| Phase update outside project dates | `422` |
| Phase update omits skill and budgets | Existing values remain |
| PM starts another PM's phase | `404` / standardized denial |
| PM starts phase from `In Progress` | `422` |
| SS requests completion with no tasks | `422` |
| SS requests completion with an open task | `422` |
| SS requests completion for another site | `404` |
| PM approves without request | `422` |
| PM approves with an open task | `422` |
| PM approves valid request | `200`, status `Completed`, request cleared |
| PM rejects valid request | `200`, status `In Progress`, request cleared |
| Duplicate SS request while pending | `422` |
| Delete phase with assignment | `422` |
| Delete phase with material/equipment usage | `422` |
| Delete phase with tasks only | `422` |
| Delete phase with no downstream records | `200` |
| Project progress with 1 of 2 phases completed | `50` |
| SS phase progress with 2 of 4 tasks done | `50` |
| SS phase progress with all tasks done but no approval | `100`, status still `In Progress` |
| Audit after project/phase update | One `UPDATE` audit row with changed fields |
| Audit after phase completion | `UPDATE` row for status and request fields |

### 15.4 Verification sequence after fixes

1. Run focused project/phase feature tests.
2. Run the existing `StatusTransitionTest` to ensure no status regression.
3. Run the existing material, equipment, workforce, and task tests because phase state affects them.
4. Run the frontend lint/build for PM, Admin, and SS screens.
5. Verify a PM can create a project, add phases, add tasks through `TasksPanel`, and guide a phase through completion.
6. Verify Admin sees the same project/phase records without mutation controls.
7. Verify SS sees only assigned sites and can request completion only under the approved conditions.

## 16. Out of scope for this document

- Adding a separate `sites` table.
- Adding a redundant `project_id` to `workforce_assignment`, `material_usage`, or `equipment_usage`; those rows derive the project through the phase.
- Automatic project-wide status inference from phases.
- Database-level enforcement of project status values.
- A project delete/archive system.
- Multi-PM ownership.
- Cost formula changes for labor, material, or equipment.
- Replacing the existing cost-posting triggers.
- Reworking workforce assignment rules.
- Reworking material/equipment usage rules beyond the phase-status interaction.

## 17. Document maintenance

When any project/phase rule changes:

1. Update the rule ID and enforcement status in this document.
2. Update `STATUS_BUSINESS_RULES.md` if a status transition changes.
3. Update `WORKFORCE_BUSINESS_RULES.md` if assignment/task behavior changes.
4. Update `MATERIALS_EQUIPMENT_BUSINESS_RULES.md` if phase-status usage behavior changes.
5. Add or update the corresponding feature test.
6. Verify that Admin, PM, and SS role behavior still matches §4.
