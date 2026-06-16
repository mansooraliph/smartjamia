# EduPro — Project Summary

> A consolidated description of what EduPro is, how it's built, the technology
> stack, the SaaS/multi-tenancy model, the architecture & design patterns, the
> major feature modules, and how it's run and deployed.
>
> Companion docs: [`CLAUDE.md`](./CLAUDE.md) (original product spec),
> [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) (architecture deep-dive),
> [`DEPLOYMENT.md`](./DEPLOYMENT.md) (production runbook).
>
> _Last updated: 2026-06-16_

---

## 1. What EduPro is

EduPro is a **multi-tenant Academic Management SaaS** — a single deployment
serves many schools/colleges ("tenants"). It covers the full lifecycle:

```
admission → enrollment → attendance → exams/results → fees → promotion → transfer
```

plus staff, parents, front-office (visitors), communication, biometric
attendance, and reporting. It also runs its own **billing layer** (plans,
trials, subscriptions, Razorpay) to charge the schools that use it.

There are two faces to the system:

| Layer | Audience | Lives in |
|-------|----------|----------|
| **Platform / SaaS** | Superadmin (EduPro operators) + public marketing/signup | `master` DB, `modules/superadmin`, public pages |
| **Tenant app** | School owner/admin/manager/teacher/staff/cashier (+ parent/student portal) | per-tenant schema in `data` DB, `modules/tenant/*` |

---

## 2. Technology stack

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** NestJS 10 (modular, DI, guards/interceptors/pipes)
- **ORM:** TypeORM 0.3 (two named DataSources: `master`, `data`)
- **Database:** PostgreSQL 16 (two instances — master + tenant data)
- **Cache / Queue:** Redis 7 + BullMQ
- **Auth:** JWT (access + refresh) + bcrypt + PIN login
- **Validation:** class-validator + class-transformer (DTOs)
- **API:** REST, versioned at `/api/v1`, response envelope `{ success, data, message }`
- **Docs:** Swagger at `/api/docs`
- **PDF:** Puppeteer via **system Chrome** (report cards, TCs, fee receipts)
- **Email:** Nodemailer + Handlebars templates
- **Port:** **3002**

### Frontend (Web SPA)
- **Framework:** React 18 + Vite 5 + TypeScript 5
- **Client state:** Zustand
- **Server state:** TanStack Query v5
- **Tables:** TanStack Table v8
- **Forms:** React Hook Form + Zod + `@hookform/resolvers`
- **HTTP:** Axios (shared instance, injects `Authorization` + `X-School-Slug`)
- **Routing:** React Router DOM v6
- **Styling:** TailwindCSS v3
- **Icons:** Lucide React · **Charts:** Recharts · **Dates:** Day.js
- **Port:** **5175**

### Infrastructure
- Two PostgreSQL databases (`edupro_master`, `edupro_data`) + Redis.
- Dev via Docker Compose; **production runs natively** under **PM2** behind
  **nginx**, no Docker.
- Local-disk file storage at `/uploads` (S3-swappable driver).

### Ports

| Service | Dev | Prod (native) |
|---------|-----|------|
| Backend API (`/api/v1`, Swagger `/api/docs`) | 3002 | 3002 |
| Frontend (Vite) | 5175 | served by nginx (`frontend/dist`) |
| PostgreSQL master | 5437 | 5432 |
| PostgreSQL data | 5438 | 5432 |
| Redis | 6381 | 6379 |

---

## 3. SaaS & multi-tenancy model

### 3.1 Two databases
- **`edupro_master`** — platform-wide data: schools, branches, plans,
  subscriptions, platform invoices, superadmins, schema-migration log, and the
  global **biometric device pool** (devices, command queue, traffic logs).
- **`edupro_data`** — all tenant data, isolated **per PostgreSQL schema**.

### 3.2 Schema-per-tenant via `search_path`
The `data` DataSource has **no fixed schema** — it defaults to `shared_pool`
and emits **unqualified** table names. Each request routes to the right schema:

```
Request ──▶ X-School-Slug (or X-School-Code) header
        ──▶ TenantMiddleware: look up school in master → resolve schemaName + schoolId
        ──▶ request.tenant = { schoolId, schoolSlug, schemaName }
        ──▶ services call TenantSchemaService.runInSchema(schemaName, em => …)
              → runs `SET LOCAL search_path TO <schema>` inside a transaction
```

So the **same entities serve every tenant**; only the active schema changes per
request.

### 3.3 Trial vs paid provisioning
- **Trial schools** share the `shared_pool` schema, isolated by a denormalized
  `school_id` column on every tenant row.
- **On upgrade**, `SchemaMigrationService.provisionSchema()` creates a dedicated
  `school_<slug>` schema (scoped DataSource → `synchronize(false)`), then flips
  `school.schema_name` / `is_schema_provisioned`.

### 3.4 No migration files — schema via `synchronize`
Tenant schema is materialized by `npm run db:setup` (synchronizes `shared_pool`
+ master) and, for paid tenants, by `provisionSchema`. **Consequence:** when a
new tenant entity/column is added, re-run `npm run db:setup` per environment
(dedicated schemas pick it up on next provision or a manual ALTER).

### 3.5 Billing (charging the schools)
Plans, per-school subscriptions, and platform invoices live in master. Status
flows `trial → active → grace_period → suspended → cancelled`. A public
marketing site + self-service trial signup + **Razorpay** checkout/verify/webhook
drive the lifecycle. **Monetary values are stored in paise** (smallest unit).

---

## 4. Architecture & design patterns

- **Modular NestJS** — one module per feature; **thin controllers, logic in
  services**, all guarded. DTOs validate every input with class-validator.
- **Two-DataSource design** — `@InjectDataSource('master' | 'data')`; tenant work
  always runs through `TenantSchemaService.runInSchema()`.
- **Guards/decorators** — `TenantJwtGuard` (verifies JWT scope + school match),
  `RolesGuard` (permissions + legacy role names), `SuperadminGuard`, plus
  feature guards (e.g. `BiometricPremiumGuard`). Decorators: `@Tenant()`,
  `@Roles()`, `@RequirePermissions()`, `@CurrentUser()`.
- **Response envelope + exception filter** — consistent `{ success, data,
  message }` / `{ success, error }` shapes.
- **Frontend mirrors the backend** — `lib/access.ts` (`canAccessPath`, `can`)
  gates the sidebar, routes and action buttons from the user's permission set;
  the backend guard remains the real boundary. API access is centralized in
  `services/*.api.ts`; domain state in Zustand stores; server state in TanStack
  Query.
- **Background work off the request path** — BullMQ queues for PDFs, emails,
  notifications and maintenance crons; `@nestjs/schedule` intervals/crons for
  time-based tasks (subscription expiry, device offline detection).

---

## 5. Database design

### 5.1 Master DB (`edupro_master`)

| Table | Purpose |
|-------|---------|
| `schools` | Each tenant: slug, contact, `plan_id`, `schema_name`, `is_schema_provisioned`, status, trial/subscription dates |
| `branches` | Optional sub-branches of a school |
| `plans` | Pricing tiers: price (paise), trial days, max users/students/staff, `features`/`limits` JSON |
| `subscriptions` | Per-school subscription: status, billing cycle, period, gateway IDs |
| `platform_invoices` | Invoices raised to schools (EDU-INV-…) |
| `superadmins` | EduPro operators (superadmin/support/finance) |
| `schema_migration_log` | Per-schema provisioning/migration runs |
| `biometric_devices` | Globally-unique-SN terminals; `school_id` NULL until assigned |
| `biometric_device_commands` | Command queue per device (polled by hardware); **numeric `seq`** id sent to devices |
| `biometric_device_logs` | Raw device↔server traffic audit (purgeable) |

### 5.2 Tenant DB (`edupro_data`, per schema)
Every tenant table carries a denormalized `school_id`. Grouped by domain:

- **Identity & structure:** `users`, `roles` (custom RBAC), `school_profile`
  (branding + `settings` JSON), `academic_years`, `courses` (college programs),
  `classes`, `sections`, `subjects`.
- **People:** `students` (+ `student_qualifications`, `student_documents`),
  `parents`, `student_enrollments`, `staff` (+ `staff_documents`).
- **Operations:** `attendance`, `exams`, `exam_schedules`, `marks`,
  `report_cards`, `promotions`, `transfer_certificates`, fees
  (`fee_heads`, `fee_structures`, `concessions`, `fee_collections`, `payments`),
  `timetable`, `leaves`, `announcements`, `notifications`,
  library (`library_books`, `book_issues`), `transport_routes`, `hostel_rooms`,
  `hostel_allocations`, `inventory_items`.
- **Front office & biometrics:** `visitors`, `visits`,
  `biometric_transactions` (resolved punches), `biometric_enrollments`
  (FP/FACE/PALM/photo templates), `user_invitations`.

Conventions: UUID PKs, `created_at`/`updated_at` via decorators, soft deletes on
students/users/staff, money in paise, sensitive columns (`password_hash`,
`pin_hash`, `refresh_token_hash`) marked `select:false`.

---

## 6. Authentication & RBAC

### 6.1 Auth flows
- **Standard JWT login** (`email + password + schoolCode`) → `{ accessToken
  (15m), refreshToken (7d) }`; refresh rotates tokens. The JWT carries
  `scope:'tenant'`, `schoolId`, `schoolSlug`, `role`.
- **PIN login** — short-lived token for cashier-type quick login; parents/
  students use a PIN for the portal.
- Role (and any custom `roleKey`) is baked into the JWT at login, so role
  changes require re-login.

### 6.2 Permission model (two layers in `RolesGuard`)
1. **`@RequirePermissions('/module:action')`** — authoritative; resolved against
   the user's effective permission set (built-in role constants **or** a custom
   role's stored permissions). Permission keys are `<module>:<action>` where
   action ∈ `list | create | delete`.
2. **`@Roles(...)`** — legacy role-name check for endpoints not yet mapped to
   permissions; custom roles are denied here.

System roles: `owner, admin, manager` (full) and `teacher, staff, cashier`
(least-privilege subsets). Custom roles live in the tenant `roles` table.

---

## 7. Feature modules (`modules/tenant`)

Each is a guarded NestJS module (thin controller, logic in service). Highlights:

- **academic-years** — CRUD, set-current, lock/unlock, **copy-structure** (clone
  courses→classes→sections from another year).
- **courses** — college programs; creating a course **auto-generates its classes**
  from `term_system × duration_years`.
- **classes / sections** — course-grouped, disambiguated class lists across all
  dropdowns.
- **students / student-profile** — admission (single atomic transaction with
  inline parents), optional enrollment (section nullable), portal PIN, Excel
  import/export, qualifications + documents.
- **parents, staff (+ staff-documents)** — CRUD, portal PINs, import/export.
- **uploads** — generic image/PDF upload (8 MB, type-checked) → public `/uploads`
  URL.
- **academics** — bulk-enroll and the **promotion engine** (atomic; validates
  then writes).
- **attendance, exams, results/report-cards, timetable, fees/payments,
  communication, library, transport, hostel, inventory, reports** — domain ops.
- **settings** — school profile + terminology (school vs college labels) +
  per-module menu access + **biometric device settings**.
- **roles** — custom RBAC roles. **portal** — parent/student read views.
  **stats** — dashboard counters.
- **biometric-devices** — premium device integration (see §8).
- **superadmin** (platform side) — manage schools, branches, plans, school
  admins/passwords, subscriptions, and the global device pool.

---

## 8. Biometric device integration (premium)

Integrates push-protocol fingerprint/face/palm terminals — **ZKTeco "iclock"**
and **ESSL** (same protocol; ESSL appends `.aspx` to each route). Gated behind
the `biometric_devices` plan feature (Professional + Enterprise) via
`BiometricPremiumGuard` (returns 403 → frontend shows an upgrade prompt).

### 8.1 Why devices live in master
A terminal registers **globally by serial number** the first time it contacts
the server, before being assigned to a school. So devices, their command queue,
and traffic logs live in **master**; only resulting punches and biometric
templates live in the **tenant schema**.

### 8.2 Device push protocol (`modules/biometric`)
`IclockController` + `IclockService`. These routes are **plain-text** (devices
reject JSON), **bypass the `/api/v1` prefix** and **TenantMiddleware**, and read
the **raw request body**. Both bare and `.aspx` variants are registered. Every
handler is wrapped so a failure logs (with the raw body) and returns a
device-safe response instead of a 500.

| Route | Purpose |
|-------|---------|
| `GET /iclock/cdata` · `registry` | Handshake; **auto-registers** an unknown SN (unapproved, unassigned, online) |
| `GET /iclock/getrequest` | Device polls for commands; returns up to 20 pending as `C:<seq>:<command>` lines, else `OK`. Also the **heartbeat** (updates `last_activity`) |
| `POST /iclock/devicecmd` | Device reports command results; parsed as a query string (`ID=<seq>&Return=<code>&CMD=…`), matched back by `seq`, batched status updates |
| `POST /iclock/cdata?table=…` | Device pushes data: `ATTLOG` (punches), `OPERLOG`, `BIODATA`, `BIOPHOTO`, `options` |

**Key design decisions / fixes made:**
- **Numeric command id.** Commands are sent as `C:<seq>:<cmd>` where `seq` is a
  short auto-increment integer — devices reject the long 36-char UUID on long
  commands (DATA USER / ENROLL), so they were silently dropped. The ack maps
  back to the row by `seq`.
- **Add-user before enroll.** Enrollment queues a `DATA USER PIN=…\tName=…\tPri=0\tCard=\tPasswd=`
  (add/update user, with the Card/Passwd fields the firmware expects) **before**
  the `ENROLL_FP/FACE/PALM` command, with deterministic ordering.
- **devicecmd robustness.** Acks parsed as `&`/tab-tolerant query strings;
  malformed lines (missing ID/Return) skipped; raw acks audited to
  `biometric_device_logs`.
- **Offline detection.** A 15s `@Interval` marks a device offline (`state='0'`)
  when no heartbeat for 40s; the device list refetches every 20s so the UI stays
  live.

### 8.3 Configurable PIN prefix scheme
Every enrolled user gets a **type-prefixed device PIN** so PINs don't collide
across user types and a punch decodes back to its user type:

| Type | Default prefix | Example |
|------|----------------|---------|
| Student | `S` + admission_number | `SADM2026001` |
| Teacher | `T` + employee_id | `TEMP001` |
| Other staff | `E` + employee_id | `EEMP005` |
| Visitor | `V` + short visitor id | `Va1b2c3d4` |

- Prefixes are **configurable per school** (Device Settings UI →
  `school_profile.settings.biometricPrefixes`), validated so no prefix is a
  leading substring of another (unambiguous parsing).
- Teachers vs other staff are classified by **login role** (`user.role ===
  'teacher'`).
- The **attendance resolver** decodes the prefix back to the right
  student/teacher/staff/visitor (with a raw-code fallback for legacy data) and
  records `user_type` + the resolved id on each transaction.

### 8.4 Management APIs & UI
- **Superadmin** (`/api/v1/superadmin/biometric-devices`): list/filter, approve,
  assign-to-school (requires the plan feature), unassign,
  deactivate/reactivate, restart, read-info, bulk restart/read-info, command log,
  delete.
- **School** (`/api/v1/school/biometric-devices`, admin roles + premium guard):
  list devices, transactions, enrollments, stats; rename; restart, read-info,
  set-duplicate-punch, enroll, and **bulk** variants; sync-users; clear-data;
  **clear pending commands**; **manual raw command runner**; **multi-type user
  enrollment** (`/enroll/users`, `/enrollments`); device settings (`GET/PUT
  /settings`).
- **Frontend** — a card-based device page with checkbox multi-select, a sticky
  **bulk action bar**, a **device detail drawer** (Overview / Transactions /
  Commands tabs), and modals for **Enroll User** (type → user search → biometric
  type/finger → device multi-select), Set Punch Gap, Device Settings, Run
  Command, and confirmations. A toast notification system surfaces results.

---

## 9. Background jobs & scheduling

- **BullMQ (Redis):** notifications (SMS/push), emails (welcome, fee reminders),
  reports (report-card & TC PDFs via Puppeteer). PDFs are generated in jobs,
  never blocking HTTP.
- **`@nestjs/schedule`:** daily crons (lock overdue subscriptions, attendance
  summaries) and short intervals (biometric device offline marker).

---

## 10. File storage & uploads
`StorageService` writes under `STORAGE_LOCAL_PATH` (default `./uploads`) and
returns `/uploads/<schoolId>/<uuid>.<ext>`, served statically and proxied by the
Vite dev server / nginx. Swap to S3 by replacing the driver.

---

## 11. Conventions
- UUID PKs; `created_at`/`updated_at` via decorators; soft deletes on
  students/users/staff.
- Money always in **paise**.
- Every tenant query is scoped by `school_id` and runs inside `runInSchema`.
- Sensitive columns use `select:false`.
- DTOs validate with class-validator; responses use the `{ success, data,
  message }` envelope.
- Shared enums/types in `shared/types`; the frontend never redefines API types.
- Import/export columns use matching field names so **export → edit → re-import**
  round-trips.

---

## 12. Running locally

```bash
npm install                 # root tooling
# install backend + frontend deps (see CLAUDE.md §20)
npm run db:up               # dev: start Postgres ×2 + Redis (Docker)
npm run db:setup            # create extensions + shared_pool schema + synchronize
npm run seed                # seed plans + superadmin
npm run dev                 # backend (3002) + frontend (5175)
```

Default superadmin: `admin@edupro.app` / `Admin@123456`.

---

## 13. Deployment (production, native)

See [`DEPLOYMENT.md`](./DEPLOYMENT.md). In short:

1. `git pull`
2. `npm run db:setup` — **required whenever new tables/columns were added.**
3. `npm run build:backend && npm run build:frontend`
4. `pm2 restart edupro --update-env` (config in `ecosystem.config.js`, cwd =
   `backend`, loads root `.env`; `--update-env` so changed env vars take effect)
5. nginx (`nginx-edupro.conf`) serves `frontend/dist` and proxies `/api/`,
   `/uploads/` and `/iclock/` (biometric devices, with
   `proxy_request_buffering off` + `gzip off`) to `127.0.0.1:3002`.

Production URL is configured **on the server** (`.env` → `APP_URL` /
`FRONTEND_URL`; nginx → `server_name` + SSL), not in the repo.

---

## 14. Notable features delivered

- **College mode** — institution-type toggle; Courses as an optional parent of
  classes with term-system auto-generating classes, and "copy structure from
  another year".
- **Dedicated student admission page** — student + enrollment + multiple
  guardians in one atomic transaction.
- **Student & staff profile pages** — photo upload + tabbed sub-records.
- **Mobile + WhatsApp with country code** across students/parents/staff (forms,
  profiles, and Excel import/export).
- **Custom RBAC roles** + per-module menu access.
- **Self-service SaaS billing** — public site, trial signup, Razorpay.
- **Biometric device integration** (premium) — ZKTeco/ESSL push protocol;
  superadmin device pool; per-school live attendance; configurable numeric/
  prefixed PIN scheme; multi-type user enrollment (students, teachers, staff,
  visitors); offline detection; manual command runner; template sync across a
  school's devices.

---

## 15. Where to look first

| To understand… | Read |
|----------------|------|
| Tenant request routing | `common/tenant/tenant.middleware.ts`, `tenant-schema.service.ts` |
| Tenant provisioning | `common/tenant/schema-migration.service.ts` |
| Permissions | `common/guards/roles.guard.ts`, `common/rbac/*`, frontend `lib/access.ts` |
| All tenant tables | `database/data-datasource.ts` (`TENANT_ENTITIES`) |
| A clean CRUD module example | `modules/tenant/courses/` or `modules/tenant/visitors/` |
| Biometric device protocol | `modules/biometric/iclock.service.ts`, `user-code.util.ts` |
| Biometric management APIs | `modules/tenant/biometric-devices/`, `modules/superadmin/biometric-devices/` |
| Frontend API surface | `frontend/src/services/*.api.ts` |
| Routes & guards (web) | `frontend/src/routes/index.tsx` |
```
