# EduPro — Project Overview & Architecture

> A practical, code-grounded description of how EduPro is built: the SaaS/multi-tenancy
> model, the database structure, authentication & RBAC, the feature modules, and how to
> run and deploy it. For the original product spec see [`CLAUDE.md`](./CLAUDE.md); this
> document reflects what is actually implemented.

_Last updated: 2026-06-14_

---

## 1. What EduPro is

EduPro is a **multi-tenant academic-management SaaS** — one deployment serves many
schools/colleges ("tenants"). It covers the lifecycle from admission → enrollment →
attendance → exams/results → fees → promotion → transfer, plus staff, parents,
front-office (visitors), communication and reporting. It also runs its own
**billing layer** (plans, trials, subscriptions, Razorpay) for charging the schools.

There are two faces to the system:

| Layer | Audience | Lives in |
|-------|----------|----------|
| **Platform / SaaS** | Superadmin (EduPro operators) + public marketing/signup | `master` DB, `modules/superadmin`, public pages |
| **Tenant app** | School owner/admin/staff/teacher/cashier (+ parent/student portal) | per-tenant schema in `data` DB, `modules/tenant/*` |

---

## 2. Tech stack

- **Backend:** Node 20, NestJS 10, TypeORM 0.3, PostgreSQL 16, Redis 7 + BullMQ, JWT auth,
  class-validator, Swagger. Port **3002**, API base `/api/v1`.
- **Frontend:** React 18 + Vite 5 + TypeScript, Zustand, TanStack Query/Table,
  React Hook Form + Zod, Tailwind, Axios, React Router v6. Port **5175**.
- **PDF/files:** Puppeteer (report cards, TCs, receipts) via system Chrome; local-disk
  storage served at `/uploads` (S3-swappable).
- **Infra:** two PostgreSQL databases (`edupro_master`, `edupro_data`) + Redis.
  Production runs natively (no Docker) under PM2 behind nginx.

---

## 3. Repository layout

```
edupro/
├── backend/                       NestJS API
│   └── src/
│       ├── database/
│       │   ├── master-datasource.ts      master DB (platform tables)
│       │   ├── data-datasource.ts        tenant DB (search_path routed)
│       │   ├── master/*.entity.ts        platform entities
│       │   └── tenant/*.entity.ts        per-school entities
│       ├── common/
│       │   ├── tenant/                    TenantMiddleware, TenantSchemaService,
│       │   │                              SchemaMigrationService (provisioning)
│       │   ├── guards/                    TenantJwtGuard, RolesGuard (perms+roles)
│       │   ├── rbac/                       PermissionsService + role constants
│       │   ├── storage/                    StorageService (/uploads)
│       │   ├── export/                     Excel/PDF export helper
│       │   └── import/                     Excel import helpers
│       └── modules/
│           ├── superadmin/                 platform admin
│           └── tenant/                     school-facing modules (see §7)
├── frontend/                      React SPA
│   └── src/{pages,components,services,stores,hooks,lib,routes}
├── shared/types/                  shared enums/interfaces
├── ecosystem.config.js            PM2 process config
├── nginx-edupro.conf              nginx site config
├── DEPLOYMENT.md                  production runbook
└── CLAUDE.md                      original product spec
```

---

## 4. SaaS / multi-tenancy model

### 4.1 Two databases

- **`edupro_master`** — platform-wide data: schools, plans, subscriptions, platform
  invoices, superadmins, schema-migration log, branches.
- **`edupro_data`** — all tenant data, isolated **per PostgreSQL schema**.

### 4.2 Schema-per-tenant via `search_path`

`data-datasource.ts` deliberately has **no fixed `schema`**. The connection defaults to
`shared_pool` (`extra.options: '-c search_path=shared_pool,public'`) and TypeORM emits
**unqualified** table names. Each request then routes to the right schema:

```
Request ──▶ X-School-Slug header
        ──▶ TenantMiddleware: look up school in master DB → resolve schema_name + schoolId
        ──▶ request.tenant = { schoolId, schoolSlug, schemaName }
        ──▶ services call TenantSchemaService.runInSchema(schemaName, em => …)
              which runs `SET LOCAL search_path TO <schema>` inside a transaction
```

So the **same entities** serve every tenant; only the active schema changes per request.

### 4.3 Trial vs paid provisioning

- **Trial schools** share the `shared_pool` schema, isolated by a denormalized
  `school_id` column on every tenant row.
- **On upgrade**, `SchemaMigrationService.provisionSchema()` creates a dedicated
  `school_<slug>` schema by spinning up a scoped DataSource and calling
  `synchronize(false)` (creates all tenant tables), then flips
  `school.schema_name` / `is_schema_provisioned`.

### 4.4 No migration files — schema via `synchronize`

The project does **not** use TypeORM migration files for tenant tables. Schema is
materialized by `npm run db:setup` (synchronizes `shared_pool` + master) and, for paid
tenants, by `provisionSchema`. **Consequence:** whenever a new tenant entity/column is
added, you must re-run `npm run db:setup` on each environment (and existing dedicated
tenant schemas get the change on next provision / a manual ALTER). New-table additions
in this codebase follow exactly this pattern.

### 4.5 Billing (charging the schools)

Plans (`plans`), per-school `subscriptions`, and `platform_invoices` live in master.
Status flows `trial → active → grace_period → suspended → cancelled`. Self-service trial
signup + Razorpay checkout/verify/webhook drive the lifecycle; monetary values are stored
in **paise**.

---

## 5. Authentication & RBAC

### 5.1 Auth flows

- **Standard JWT login** (`email + password + schoolCode`) → `{ accessToken (15m),
  refreshToken (7d) }`; refresh rotates tokens.
- **PIN login** — short-lived token for cashier-type quick login; parents/students use a
  PIN for the portal.
- The role (and any custom `roleKey`) is baked into the JWT at login, so role changes
  require re-login to take effect.

### 5.2 Permission model (`RolesGuard`)

Two layers, evaluated per endpoint:

1. **`@RequirePermissions('/module:action')`** — authoritative. Resolved against the
   user's effective permission set: built-in role constants (owner/admin/manager = full;
   teacher/staff/cashier = subsets) **or** a custom role's stored permissions.
2. **`@Roles(...)`** — legacy role-name check for endpoints not yet mapped to permissions;
   custom roles are denied here.

The frontend mirrors this in `lib/access.ts` (`canAccessPath`, `can`) to gate the
sidebar, routes and action buttons; the backend guard is the real boundary.
System roles: `owner, admin, manager, teacher, staff, cashier`.

---

## 6. Database structure

### 6.1 Master DB (`edupro_master`)

| Table | Purpose |
|-------|---------|
| `schools` | Each tenant: slug, name, contact, `plan_id`, `schema_name`, `is_schema_provisioned`, status, trial/subscription dates |
| `branches` | Optional sub-branches of a school |
| `plans` | Pricing tiers: price (paise), trial days, max users/students/staff, `features`/`limits` JSON |
| `subscriptions` | Per-school subscription: status, billing cycle, period, gateway IDs |
| `platform_invoices` | Invoices raised to schools (EDU-INV-…) |
| `superadmins` | EduPro operators (superadmin/support/finance) |
| `schema_migration_log` | Records per-schema provisioning/migration runs |
| `biometric_devices` | Globally-unique-SN terminals; assigned to one school at a time (see §10) |
| `biometric_device_commands` | Commands queued for a device (polled by hardware) |
| `biometric_device_logs` | Raw device↔server traffic audit (purgeable) |

### 6.2 Tenant DB (`edupro_data`, per schema)

Every tenant table carries a denormalized `school_id`. Registered in
`data-datasource.ts → TENANT_ENTITIES`. Grouped by domain:

**Identity & structure**
- `users` — login accounts (role, roleKey, password/pin/refresh hashes — `select:false`)
- `roles` — custom roles + permission sets
- `school_profile` — branding + `settings` JSON (incl. terminology / institution type)
- `academic_years` — `is_current`, `is_locked`
- `courses` — **college programs** (level UG/PG/…, `term_system`, `duration_years`)
- `classes` — class/grade; optional `course_id` parent (college mode)
- `sections` — divisions of a class (capacity, class teacher)
- `subjects`

**People**
- `students` — admission #, demographics, **mobile/whatsapp (+ country codes)**,
  religion/caste/Aadhaar, photo, soft-deletable
- `student_qualifications` — prior education (10th/HSC/diploma/degree…) + certificate file
- `student_documents` — uploaded proofs/certificates (typed)
- `parents` — guardians: relation, **phone + whatsapp (+ country codes)**, occupation, income
- `student_enrollments` — student ↔ (year, class, **section nullable**), roll #, status
- `staff` — employment, salary (paise), bank/KYC, **mobile/whatsapp (+ country codes)**, photo
- `staff_documents` — uploaded staff documents (typed)

**Operations**
- `attendance` (unique per student/day)
- `exams`, `exam_schedules`, `marks`, `report_cards`
- `promotions`, `transfer_certificates`
- `fee_heads`, `fee_structures`, `concessions`, `fee_collections`, `payments`
- `timetable`, `leaves`
- `announcements`, `notifications`
- `library_books`, `book_issues`
- `transport_routes`, `hostel_rooms`, `hostel_allocations`, `inventory_items`
- `visitors`, `visits` — front-office gate pass
- `biometric_transactions` — device attendance punches (resolved to student/staff, deduped)
- `biometric_enrollments` — FP/FACE/PALM/photo templates
- `user_invitations`

---

## 7. Feature modules (`modules/tenant`)

Each is a NestJS module (controller = thin, service = logic, all guarded). Highlights:

- **academic-years** — CRUD, set-current, lock/unlock, and **copy-structure** (clone
  courses→classes→sections from another year).
- **courses** — college programs; creating a course **auto-generates its classes** from
  `term_system × duration_years` (e.g. Semester 1…6); update fills in any missing.
- **classes / sections** — class list returns a resolved `courseName` and is **grouped &
  ordered by course** so reused names (Semester 1…) aren't ambiguous in dropdowns.
- **students** — admission, optional enrollment (section optional), portal PIN, Excel
  import/export, next-admission-number, single-transaction create with inline parents.
- **student-profile** — qualifications + documents CRUD (under `/students:*` perms).
- **parents** — guardians CRUD, portal PIN, import/export.
- **staff** — staff+user creation, import/export; **staff-documents** CRUD.
- **uploads** — generic `POST /school/uploads` (images/PDF, 8 MB, type-checked) →
  returns a public `/uploads/...` URL; used for photos, documents, certificates.
- **academics** — bulk-enroll and the **promotion engine** (atomic, validates then writes).
- **attendance, exams, results/report-cards, timetable, fees/payments, communication,
  library, transport, hostel, inventory, reports** — domain operations.
- **settings** — school profile + terminology (school vs college labels).
- **roles** — custom RBAC roles.
- **portal** — parent/student read views.
- **stats** — dashboard counters.
- **biometric-devices** — premium device integration (push protocol, superadmin
  device pool, school device view + live attendance). Full detail in §10.
- **superadmin** (platform side) — manage schools, plans, school admins/passwords.

---

## 8. File storage & uploads

`StorageService` writes under `STORAGE_LOCAL_PATH` (default `./uploads`) and returns
`/uploads/<schoolId>/<uuid>.<ext>`. `main.ts` serves that folder statically at `/uploads/`;
the Vite dev server and nginx both proxy `/uploads` to the API. Document deletes are
best-effort cleaned from disk. Swap to S3 by replacing the driver.

---

## 9. Background jobs (BullMQ / Redis)

Queues for notifications (SMS/push), emails (welcome, fee reminders), reports (report-card
& TC PDF generation via Puppeteer), and maintenance crons (lock overdue subscriptions,
attendance summaries). PDFs are generated in background jobs, never blocking HTTP.

---

## 10. Biometric device integration (premium)

Integrates push-protocol fingerprint/face/palm terminals (**ZKTeco "iclock"** and
**ESSL** — same protocol, ESSL just appends `.aspx` to each route). Gated behind the
`biometric_devices` plan feature (Professional + Enterprise).

### 10.1 Why devices live in master

A terminal registers **globally by serial number** the first time it contacts the
server — before anyone has assigned it to a school. So devices and their command queue
live in the **master DB**; only the resulting attendance punches and biometric templates
live in the **tenant schema**.

| Table | DB | Role |
|-------|----|----|
| `biometric_devices` | master | device record; `school_id` NULL until assigned; `is_approved`, `state`, counts |
| `biometric_device_commands` | master | queued commands; `(sn, status)` indexed for fast polling |
| `biometric_device_logs` | master | fire-and-forget traffic audit (purgeable) |
| `biometric_transactions` | tenant | punches (unique per `sn+time+user`), resolved to student/staff |
| `biometric_enrollments` | tenant | FP/FACE/PALM/photo templates (unique per user+type+index) |

### 10.2 Device push protocol (public, no auth)

`IclockController` + `IclockService` (`modules/biometric/`). These routes are **plain-text**
(devices reject JSON), **bypass the `/api/v1` prefix** (`setGlobalPrefix` exclude) and
**TenantMiddleware** (middleware exclude), and read the **raw request body**
(`express.raw({ type: () => true })` in `main.ts`, since devices POST non-JSON bodies).
Both bare and `.aspx` variants are registered.

| Route | Purpose |
|-------|---------|
| `GET /iclock/cdata` · `registry` | Handshake — returns device options; **auto-registers** an unknown SN (unapproved, unassigned, online) |
| `GET /iclock/getrequest` | Device polls for commands; raw SQL returns `C:{id}:{command}` lines, or `OK` |
| `POST /iclock/devicecmd` | Device reports command results — batched status updates (one UPDATE per return code) |
| `POST /iclock/cdata?table=…` | Device pushes data: `ATTLOG` (punches, bulk insert-or-ignore + student/staff resolution), `OPERLOG`, `BIODATA`, `BIOPHOTO`, `options` |

Hot paths avoid ORM hydration; logging is `setImmediate` fire-and-forget. When a template
is enrolled on one device it is **queued to the school's other devices** so biometrics
sync across terminals. PIN/user-code resolution maps to `student.admission_number` or
`staff.employee_id` within the tenant schema.

### 10.3 Management APIs

- **Superadmin** (`/api/v1/superadmin/biometric-devices`, `SuperadminGuard`): list/filter,
  approve, assign-to-school (requires the school's plan to include the feature),
  unassign, deactivate(reason)/reactivate, restart, sync, delete, command log.
- **School** (`/api/v1/school/biometric-devices`, admin roles + `BiometricPremiumGuard`):
  list assigned devices, transactions, enrollments, stats, rename, restart, clear-logs,
  **sync-users** (push active students+staff as `DATA USER` commands), delete a punch.
  The premium guard checks the tenant plan's `features` and returns **403** otherwise.

### 10.4 Frontend

- School page `/biometric-devices` (Operations menu) — stats + Devices / Attendance /
  Enrollments tabs; shows an upgrade prompt on the 403.
- Superadmin page `/superadmin/biometric-devices` (Devices menu) — device table with
  filters, assign/approve/deactivate, and command-log modal.

### 10.5 Deploy notes

- Run `npm run db:setup` (5 new tables) and `npm run seed` (adds the plan feature).
- Point each terminal's server URL at the host **root** (`/iclock/…`, not under `/api`).
- nginx forwards `/iclock/` to the API with `proxy_request_buffering off` + `gzip off`
  so the raw device payload passes through unchanged (see `nginx-edupro.conf`).

---

## 11. Conventions

- UUID PKs; `created_at`/`updated_at` via decorators; soft deletes on students/users/staff.
- Money always in **paise**.
- Every tenant query is scoped by `school_id` and runs inside `runInSchema`.
- Sensitive columns (`password_hash`, `pin_hash`, `refresh_token_hash`) use `select:false`.
- DTOs validate with class-validator; responses use a `{ success, data, message }` envelope.
- Shared enums/types in `shared/types`; frontend never redefines API types.
- Import/export columns use matching field names so **export → edit → re-import** round-trips.

---

## 12. Ports & environment

| Service | Port |
|---------|------|
| Backend API | 3002 (`/api/v1`, Swagger at `/api/docs`) |
| Frontend (Vite) | 5175 |
| PostgreSQL master | 5437 (dev) / 5432 (prod native) |
| PostgreSQL data | 5438 (dev) / 5432 (prod native) |
| Redis | 6381 (dev) / 6379 (prod) |

Config via root `.env` (see `.env.example`). Note: values containing `#` must be quoted
(dotenv treats unquoted `#` as a comment).

---

## 13. Running locally

```bash
npm install                 # root tooling
# install backend + frontend deps (see CLAUDE.md §20)
npm run db:setup            # create extensions, shared_pool schema, synchronize
npm run seed                # seed plans + superadmin
npm run dev                 # backend (3002) + frontend (5175) concurrently
```

Default superadmin: `admin@edupro.app` / `Admin@123456`.

---

## 14. Deployment (production, native)

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full runbook. In short:

1. `git pull`
2. `npm run db:setup` — **required whenever new tables/columns were added**.
3. `npm run build:backend && npm run build:frontend`
4. `pm2 restart edupro` (config in `ecosystem.config.js`, cwd = `backend`, loads root `.env`)
5. nginx (`nginx-edupro.conf`) serves `frontend/dist` and proxies `/api/`, `/uploads/`
   and `/iclock/` (biometric devices) to `127.0.0.1:3002`. The `uploads/` dir must be
   writable by the PM2 process.

> `.gitignore` ignores the runtime `/uploads` and `backend/uploads` storage dirs but
> **whitelists** `backend/src/modules/tenant/uploads/` (the source module of the same name).

---

## 15. Notable features delivered

- **College mode** — institution type toggle; Courses (PG/UG/diploma…) as an optional
  parent of classes, with term-system (annual/semester/trimester) **auto-generating
  classes**, and a **"copy structure from another year"** action.
- **Optional section on enrollment** — classes that aren't split into groups enroll
  students directly (nullable `section_id`).
- **Course-grouped, disambiguated class lists** across every dropdown/filter.
- **Dedicated student admission page** (replaces the modal) capturing student +
  enrollment + multiple guardians in **one atomic transaction**.
- **Student & staff profile pages** — photo upload + tabs
  (Overview / Parents / Qualifications / Documents for students; Overview /
  Employment & Bank / Documents for staff).
- **Mobile + WhatsApp with country code** for students, parents and staff — in forms,
  profiles, **and Excel import/export** (with a "WhatsApp same as mobile" convenience).
- **Superadmin** can change a school's admin account & password.
- **Biometric device integration** (premium) — ZKTeco/ESSL push protocol, superadmin
  device pool + per-school live attendance and template sync (see §10).

---

## 16. Where to look first (for new contributors)

| To understand… | Read |
|----------------|------|
| Tenant request routing | `common/tenant/tenant.middleware.ts`, `tenant-schema.service.ts` |
| Tenant provisioning | `common/tenant/schema-migration.service.ts` |
| Permissions | `common/guards/roles.guard.ts`, `common/rbac/*`, frontend `lib/access.ts` |
| All tenant tables | `database/data-datasource.ts` (`TENANT_ENTITIES`) |
| A clean CRUD module example | `modules/tenant/courses/` or `modules/tenant/visitors/` |
| Biometric device protocol | `modules/biometric/iclock.service.ts` (+ `main.ts` raw-body / prefix exclude) |
| Frontend API surface | `frontend/src/services/school.api.ts` |
| Routes & guards (web) | `frontend/src/routes/index.tsx` |
```
