# Biometric Device Module — Implementation Guide

> Portable specification for the EduPro biometric (ZKTeco / ESSL push-protocol) integration.
> This document describes **what to build and how it behaves** so the module can be re-implemented
> in another project. It is implementation-focused (data model, protocol, endpoints, actions) — **not UI/design**.

---

## 1. What This Module Does

Integrates network biometric terminals (fingerprint / face / palm) using the **ZKTeco "iclock" push protocol** (ESSL-compatible).

- Devices **self-register** the first time they contact the server (by serial number).
- A **Super Admin** approves each device and assigns it to a company/tenant ("school" in EduPro).
- A **Company/Tenant Admin** enrolls its own users, pushes them to devices, reads attendance punches, and runs device commands.
- Attendance punches and biometric templates flow **from device → server** continuously.
- Commands flow **from server → device** via a polled command queue.

### Architectural model
| Layer | Scope | Owns |
|-------|-------|------|
| **Master / global** | All devices across all tenants | Device registry, command queue, raw traffic logs |
| **Tenant / per-company** | One company's data | Enrollments (templates), attendance transactions, PIN-prefix settings |
| **Protocol layer** | Public, unauthenticated | The `/iclock/*` endpoints the devices talk to |

Devices live in the **master** scope (they register before they belong to anyone). Templates and punches live in the **tenant** scope (per company). The controller filters master devices by `tenantId` so a company only sees its own.

---

## 2. Data Model

### 2.1 Master (global) tables

#### `biometric_devices` — device registry
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `sn` | varchar(100) UNIQUE | Serial number — the device's global identity |
| `alias` | varchar | Friendly name |
| `device_type` | varchar | `iclock` (ZKTeco) \| `essl`, default `iclock` |
| `device_model`, `ip_address`, `fw_ver`, `push_ver` | varchar | Reported metadata |
| `state` | char(1) | `'1'` online / `'0'` offline (set on each poll) |
| `terminal_tz` | int | Device timezone offset (minutes) |
| `user_count`, `fp_count`, `face_count`, `palm_count`, `transaction_count` | int | Device-reported stats |
| `push_time`, `last_activity` | ISO string | Last poll time (string so comparison is chronological) |
| `transfer_time`, `transfer_interval` | | Transfer scheduling |
| `is_attendance`, `area`, `area_id` | | Attendance config |
| `tenant_id` (`school_id`) | UUID NULL | **NULL = unassigned**; else assigned company |
| `is_approved` | bool default false | Super-admin approval gate (see §5) |
| `assigned_at/by`, `approved_at/by` | | Audit |
| `deactivated_at/by`, `deactivation_reason` | | Soft deactivation |
| `last_sync_at` | | Last info-sync |
| `created_at`, `updated_at`, `deleted_at` | | Soft delete |

Indexes: `tenant_id`, `is_approved`, unique `sn`.

#### `biometric_device_commands` — outbound command queue
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `seq` | int AUTO-INCREMENT UNIQUE | **Short numeric command id.** Devices receive `C:<seq>:<command>`. A UUID here overflows the device buffer on long commands (e.g. `DATA USER`), so a compact integer is required. Only rows with a non-null `seq` are delivered. |
| `sn` | varchar(100) | Target device serial |
| `tenant_id` | UUID NULL | Context (may be null if queued pre-assignment) |
| `command` | text | Raw command string (see §4) |
| `status` | smallint default 0 | `0` pending, `1` success, `2` error |
| `device_return_code` | int NULL | Code reported back by device |
| `created_by_user_id` | UUID NULL | Who queued it |
| `created_at`, `updated_at` | | |

Indexes: `sn`, `tenant_id`, `status`, composite `(sn, status)` (hot path for the poll).

#### `biometric_device_logs` — raw traffic audit (debug)
`id`, `sn`, `url`, `method`, `table_name`, `data` (truncated ~10 KB), `created_at`. Fire-and-forget insert, never awaited, purge periodically. Indexes `sn`, `(sn, created_at)`.

### 2.2 Tenant (per-company) tables

#### `biometric_enrollments` — biometric templates
| Column | Notes |
|--------|-------|
| `id` UUID PK | |
| `tenant_id`, `user_code` | Identity components |
| `student_id` / `staff_id` / `visitor_id` UUID NULL | Resolved subject (adapt to your domain) |
| `user_type` | `student` \| `teacher` \| `staff` \| `visitor` |
| `name` | Display name at enrollment |
| `status` | `pending` (admin queued) \| `enrolled` (template received) |
| `device_sn` | Source device |
| `type` | `FP` \| `FACE` \| `PALM` \| `USERPIC` \| `BIOPHOTO` |
| `f_id`, `face_id` | Device-side biometric ids |
| `index` | Finger/slot index (`0`–`9` for FP, `0` otherwise) |
| `tmp` | Template payload |
| `image` | Image data / filename |
| `valid`, `duress`, `size`, `format`, `type_raw`, `major_ver`, `minor_ver` | Device metadata |
| `created_at`, `updated_at` | |

Unique index `(tenant_id, user_code, type, index)` → re-enrollment **refreshes** the template instead of duplicating.

#### `biometric_transactions` — attendance punches
| Column | Notes |
|--------|-------|
| `id` UUID PK | |
| `tenant_id`, `device_sn`, `user_code`, `actual_punch_time` | Unique key components |
| `user_id` / `student_id` / `staff_id` / `visitor_id` | Resolved subject (NULL if unresolved) |
| `user_type` | as above |
| `actual_punch_time` | Raw device time |
| `punch_time` | Adjusted time (shift logic); defaults to actual |
| `punch_state` smallint | `0` check-in, `1` check-out |
| `punch_state_display` | Human label |
| `area`, `area_id`, `terminal_sn`, `upload_time`, `source` (`Device`), `remarks` | |
| `created_at`, `updated_at` | |

Unique index `(device_sn, actual_punch_time, user_code)` prevents duplicate ingestion. Also index by `(tenant_id, punch_time)`, `(student_id, punch_time)`, `(staff_id, punch_time)`.

---

## 3. Device Push Protocol (the `/iclock/*` endpoints)

These endpoints are **public** — no auth, no tenant middleware, **plain-text** responses. Register **both** the bare path and the `.aspx` variant (ESSL devices use `.aspx`). Never return 5xx to a device — it will retry-storm; always answer `OK`.

| Route (and `.aspx`) | Method | Purpose |
|---------------------|--------|---------|
| `/iclock/registry` | GET | First contact / handshake. Auto-creates the device row (`tenant_id=NULL`, `is_approved=false`, online). Returns config block. |
| `/iclock/cdata` | GET | Device polls for options/config. Returns key=value config block. Marks online. |
| `/iclock/cdata?table=X` | POST | Device **pushes data**. Routed by `table`: `ATTLOG`, `BIODATA`, `BIOPHOTO`, `OPERLOG`, `OPTIONS`. |
| `/iclock/getrequest` | GET | **Hot path.** Device heartbeat; returns pending commands. |
| `/iclock/devicecmd` | POST | Device reports command results (ACKs). |

### 3.1 Config block (returned by `cdata` GET / `registry`)
Plain text, one `key=value` per line:
```
GET OPTION FROM: <sn>
Stamp=9999
OpStamp=<unix_ts>
ErrorDelay=30
Delay=30
TransTimes=00:00;23:59
TransInterval=2
TransFlag=111111111111
TimeZone=<device_tz_minutes>
Realtime=1
Encrypt=0
FaceFunOn=1
FaceOnlyOn=0
FaceTransOn=1
FaceAlgorithm=3
FaceThreshold=60
```

### 3.2 `getrequest` — delivering commands
On each call: update `last_activity` and set `state='1'`. Fetch pending commands (`sn=? AND status=0`, non-null `seq`) and return:
```
C:<seq>:<command>
C:<seq>:<command>
```
If none → return `OK`. **Only deliver commands for devices that are assigned + approved** (the approval gate).

Example response:
```
C:1:DATA USER PIN=S101	Name=John Doe	Pri=0	Card=	Passwd=
C:2:ENROLL_FP	PIN=S101	FID=6	RETRY=3	OVERWRITE=1
C:3:REBOOT
```

### 3.3 `cdata` POST — ingesting pushed data
Route by `table` query param:

- **ATTLOG** → attendance. Tab-separated lines: `PIN \t datetime \t state \t …`. Col0 = PIN (user code), Col1 = datetime (device-local), Col2 = punch state (0 in / 1 out). Resolve PIN → subject (§6), bulk-insert as `biometric_transactions`.
- **BIODATA** → templates. `key=value` tab-separated: `Pin`, `No`/`Index`, `Valid`, `Type`, `Tmp`, … Type map `0→FP`, `2→FACE`, `9→PALM`. Upsert into `biometric_enrollments`.
- **BIOPHOTO / USERPIC** → store as `USERPIC`/`BIOPHOTO` enrollment (Pin, Size, Format, Content).
- **OPERLOG** → mixed audit; extract any biometric lines.
- **OPTIONS** → refresh device stats (`user_count`, counts, fw, etc.).

Return `OK: <count>` (or `ERROR: <count>`).

### 3.4 `devicecmd` POST — command ACKs
Device posts one URL-encoded line per command:
```
ID=<seq>&Return=0&CMD=DATA
ID=<seq>&Return=1&CMD=ENROLL_FP
```
Match `ID` → `seq`. `Return=0` → `status=1`; non-zero → `status=2, device_return_code=<code>`. Batch successes into one update; handle `INFO` specially by refreshing device info. Always return `OK`.

### 3.5 Offline detection
Background sweep every ~15 s: set `state='0'` for any device whose `last_activity` is older than ~40 s. (`last_activity` is an ISO string so lexical comparison is chronological.)

---

## 4. Device Command Catalog

All commands are queued in `biometric_device_commands` and delivered as `C:<seq>:<command>`. Fields are **tab-separated** `key=value`.

| Command | Format | Notes |
|---------|--------|-------|
| Reboot | `REBOOT` | |
| Read info | `INFO` | Device reports stats via `devicecmd`/OPTIONS |
| Add/update user | `DATA USER PIN=<code>\tName=<name>\tPri=0\tCard=\tPasswd=` | **`Card` and `Passwd` must be present even if empty** or some firmware rejects the record |
| Enroll fingerprint | `ENROLL_FP\tPIN=<code>\tFID=<0-9>\tRETRY=3\tOVERWRITE=1` | `FID` default 6 (left index) |
| Enroll face | `ENROLL_FACE\tPIN=<code>\tRETRY=3\tOVERWRITE=1` | |
| Enroll palm | `ENROLL_PALM\tPIN=<code>\tRETRY=3\tOVERWRITE=1` | |
| Duplicate-punch interval | `SET OPTION AlarmReRec=<seconds>` | Re-record window (0–3600) |
| Clear attendance logs | `CLEAR LOG` | Keeps users |
| Manual / raw | any string (≤2000 chars) | Convert literal `\t` → real tab, strip CR/LF |

**Why `seq` matters:** a 36-char UUID prepended to a long `DATA USER` line overflows the device's per-command buffer and the command is silently dropped. A short auto-increment integer keeps `C:<id>:` compact.

---

## 5. Super Admin Actions (global scope)

Guarded by a **super-admin guard**. Base route `e.g. /superadmin/biometric-devices`.

| Action | Endpoint | Effect |
|--------|----------|--------|
| List all devices | `GET /` | Paginated; filter by tenant, approval, assignment, search |
| List unassigned | `GET /unassigned` | `tenant_id IS NULL` |
| Global command log | `GET /commands` | All commands across tenants |
| Device detail | `GET /:id` | With tenant relation |
| Device commands | `GET /:id/commands` | |
| **Assign to company** | `PATCH /:id/assign` `{tenantId}` | Sets `tenant_id`; verify the company's plan includes the biometric feature |
| **Unassign** | `PATCH /:id/unassign` | Clears `tenant_id` |
| **Approve** | `PATCH /:id/approve` | `is_approved=true` → enables command delivery in `getrequest` |
| **Deactivate** | `PATCH /:id/deactivate` `{reason}` | Soft deactivate + reason |
| **Reactivate** | `PATCH /:id/reactivate` | Clears deactivation |
| Restart | `POST /:id/restart` | Queue `REBOOT` |
| Read info | `POST /:id/read-info` | Queue `INFO` |
| Sync info | `POST /:id/sync` | Queue info-sync |
| Bulk restart / read-info | `POST /bulk/restart`, `/bulk/read-info` | |
| Delete device | `DELETE /:id` | Soft delete |

**Approval gate:** a freshly registered device is unassigned + unapproved and receives **no commands**. Super admin must assign it to a company and approve it before it becomes operational.

---

## 6. Company / Tenant Admin Actions (per-company scope)

Guarded by **tenant-auth + roles + feature/plan guard** (biometric is a premium feature → 403 if the plan lacks it). All queries are filtered by `tenant_id`; the company only sees its own devices, punches, and enrollments. Base route `e.g. /school/biometric-devices`.

### Read
| Action | Endpoint |
|--------|----------|
| List assigned devices | `GET /` |
| Summary stats (total/online/offline, today's punches, enrolled users) | `GET /stats` |
| Device detail | `GET /:id` |
| Recent commands (≤50) | `GET /:id/commands` |
| Attendance punches (paginated, filter date/user/state) | `GET /transactions` |
| Enrolled templates (paginated, filter type/userCode) | `GET /enrollments` |
| Enrollable users search | `GET /enroll/users?type=&search=` |
| PIN-prefix settings | `GET /settings` |

### Device actions (single)
| Action | Endpoint | Command queued |
|--------|----------|----------------|
| Rename | `PATCH /:id/alias` | — |
| Restart | `POST /:id/restart` | `REBOOT` |
| Read info | `POST /:id/read-info` | `INFO` |
| Set duplicate-punch interval | `POST /:id/set-duplicate-punch {seconds}` | `SET OPTION AlarmReRec=` + updates `transfer_interval` |
| Remote enroll on this device | `POST /:id/enroll {userCode, biometricType, fingerId?}` | `DATA USER` + `ENROLL_*` |
| Sync all users to device | `POST /:id/sync-users` | one `DATA USER` per active user |
| Clear device attendance logs | `POST /:id/clear-data` | `CLEAR LOG` |
| Clear pending commands | `POST /:id/clear-commands` | deletes queued `status=0` rows |
| Run raw command | `POST /:id/command {command}` | arbitrary (≤2000 chars) |
| Delete a punch (correction) | `DELETE /transactions/:id` | — |

### Device actions (bulk, `deviceIds[]` 1–50)
`POST /bulk/restart`, `POST /bulk/read-info`, `POST /bulk/set-duplicate-punch {seconds}`, `POST /bulk/enroll {userCode, biometricType, fingerId?}`. A failure on one device must not stop the rest; return a per-device result summary.

### User enrollment (across devices)
`POST /enrollments {userType, userId, biometricType, fingerId?, deviceIds[]}`:
1. Resolve the user to a prefixed PIN (§7).
2. Queue `DATA USER` then `ENROLL_*` on each device.
3. Insert a `pending` `biometric_enrollments` row.
4. When the device later pushes `BIODATA`, flip it to `enrolled` and store the template.

### Settings
`PUT /settings {prefixes}` — update the per-company PIN prefixes (validated, §7).

---

## 7. User Code (PIN) Encoding & Resolution

Device PINs must round-trip to a typed subject. Same numeric id could be a student or a staff member, so each **user type gets a prefix**.

**Default scheme** (per-company configurable):
| Type | PIN |
|------|-----|
| Student | `S` + admission number → `S101` |
| Teacher | `T` + employee id → `T42` |
| Staff (non-teaching) | `E` + employee id → `E99` |
| Visitor | `V` + short id (first 8 hex of UUID) → `Vab34cd5f` |

**Prefix rules (validate on save):**
1. Each prefix is 1–8 alphanumeric chars.
2. No prefix may be a leading substring of another (e.g. `S` and `ST` are ambiguous for `ST101`).

**Storage:** per-company under `settings.biometricPrefixes` (load on demand).

**Parsing (`ATTLOG` resolution):** longest matching prefix wins → decode type + base id → look up subject. Fallback to raw match (no recognized prefix) for legacy codes. If nothing matches, store the punch with a NULL subject (unresolved).

---

## 8. End-to-End Flows

### Device onboarding
1. Device powered on → hits `/iclock/registry` → row auto-created (`tenant_id=NULL`, `is_approved=false`, online).
2. Super admin assigns it to a company (plan checked) and approves it.
3. `getrequest` now delivers commands for that device.

### Remote enrollment
1. Company admin picks user + biometric type + target devices.
2. Server resolves PIN, queues `DATA USER` + `ENROLL_*`, writes a `pending` enrollment.
3. Device polls `getrequest`, adds the user, enters enrollment mode.
4. User scans → device pushes `BIODATA` → server stores template, enrollment → `enrolled`.

### Attendance capture
1. User punches → device pushes `ATTLOG` to `/iclock/cdata?table=ATTLOG`.
2. Server parses PIN (e.g. `S101`), resolves to student, inserts `biometric_transactions`.
3. Unique key dedupes repeated pushes; unresolved PINs stored with NULL subject.

---

## 9. Implementation Notes / Gotchas

- **Register both `/iclock/x` and `/iclock/x.aspx`** routes.
- **Never 5xx to a device.** Always plain-text `OK`; failures are logged, not surfaced.
- **`seq` must be a short integer**, not a UUID — long commands silently drop otherwise.
- **`DATA USER` must include empty `Card=` and `Passwd=`** fields.
- **Command delivery is gated by assignment + approval.**
- **Tenant isolation:** filter master `biometric_devices` by `tenant_id` in every company-scoped query; keep templates/punches in the tenant schema/scope.
- **Logging is fire-and-forget** (don't await on the device response path; it's the hot path).
- **Offline sweep** every ~15 s, threshold ~40 s.
- **No biometric-specific env vars** are required beyond the server base URL the devices POST to; ensure your reverse proxy forwards `/iclock/` to the API.

---

## 10. Component Checklist (to port)

- [ ] Master entities: `biometric_devices`, `biometric_device_commands` (with `seq` auto-increment), `biometric_device_logs`.
- [ ] Tenant entities: `biometric_enrollments`, `biometric_transactions` (with unique indexes).
- [ ] Public protocol controller/service: `registry`, `cdata` GET+POST, `getrequest`, `devicecmd` (both bare and `.aspx`).
- [ ] Command queue helper + command builders (`DATA USER`, `ENROLL_*`, `REBOOT`, `INFO`, `SET OPTION`, `CLEAR LOG`).
- [ ] User-code util: encode/decode + prefix validation + per-company prefix storage.
- [ ] User resolution from PIN → typed subject.
- [ ] Offline-sweep background job.
- [ ] Super-admin module: list/assign/unassign/approve/deactivate/reactivate/commands/delete.
- [ ] Tenant module: list/stats/detail/commands/transactions/enrollments/enroll/sync/clear/raw-command/settings + bulk.
- [ ] Premium/feature guard for tenant access.
