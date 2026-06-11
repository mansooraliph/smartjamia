# CLAUDE.md — EduPro Academic Management SaaS

> Read this file completely before writing a single line of code.
> This is the single source of truth for the entire project.

---

## 1. PROJECT OVERVIEW

**Product:** EduPro — Multi-tenant Academic Management SaaS  
**Purpose:** End-to-end school/college management from online admission to student promotion  
**Architecture:** Multi-tenant, schema-per-tenant on PostgreSQL  
**Version:** 1.0.0

### Key User Roles
| Role | Platform | Auth |
|------|----------|------|
| Superadmin | Web (React) | JWT |
| School Admin | Web + Desktop (Electron) | JWT |
| Teacher | Web + Mobile (Expo) | JWT |
| Parent | Mobile (Expo) | JWT + PIN |
| Student | Mobile (Expo) | JWT + PIN |
| Cashier/Fee Clerk | Web (React) | PIN login (short-lived JWT) |

---

## 2. TECH STACK

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** NestJS 10
- **ORM:** TypeORM 0.3
- **Database:** PostgreSQL 16 (two instances — master + data)
- **Cache / Queue:** Redis 7 + BullMQ
- **Auth:** JWT (access + refresh tokens) + bcrypt + PIN login
- **Validation:** class-validator + class-transformer
- **API:** REST, versioned at `/api/v1/`
- **Docs:** Swagger at `/api/docs`
- **File Storage:** Local (dev) → S3-compatible (prod)
- **Email:** Nodemailer + Handlebars templates
- **PDF Gen:** Puppeteer (report cards, fee receipts, TC)
- **Port:** **3002** (avoids conflicts)

### Frontend (Web)
- **Framework:** React 18 + Vite 5
- **Language:** TypeScript 5
- **State:** Zustand
- **Server state:** TanStack Query v5
- **Table:** TanStack Table v8
- **Forms:** React Hook Form + Zod + @hookform/resolvers
- **HTTP:** Axios
- **Routing:** React Router DOM v6
- **Styling:** TailwindCSS v3
- **Icons:** Lucide React
- **Charts:** Recharts
- **Date:** Day.js
- **Port:** **5175**

### Desktop
- **Framework:** Electron 30
- **Renderer:** React (shared with frontend)
- **Port:** N/A (loads frontend build)

### Mobile
- **Framework:** React Native + Expo SDK 51
- **Navigation:** Expo Router
- **State:** Zustand (shared logic)
- **HTTP:** Axios

### Infrastructure
- **Containerisation:** Docker + Docker Compose
- **Master DB port:** 5437
- **Data DB port:** 5438
- **Redis port:** 6381

> **Port allocation designed to avoid conflicts with other local projects.**

---

## 3. REPOSITORY STRUCTURE

```
edupro/
├── CLAUDE.md                         ← YOU ARE HERE
├── package.json                      ← root scripts only
├── docker-compose.yml
├── .env.example
├── .gitignore
│
├── backend/                          ← NestJS API
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   │
│   │   ├── database/
│   │   │   ├── master-datasource.ts
│   │   │   ├── data-datasource.ts
│   │   │   ├── master/               ← master DB entities
│   │   │   │   ├── school.entity.ts
│   │   │   │   ├── plan.entity.ts
│   │   │   │   ├── subscription.entity.ts
│   │   │   │   ├── platform-invoice.entity.ts
│   │   │   │   ├── superadmin.entity.ts
│   │   │   │   └── schema-migration-log.entity.ts
│   │   │   └── tenant/               ← per-school entities
│   │   │       ├── user.entity.ts
│   │   │       ├── school-profile.entity.ts
│   │   │       ├── academic-year.entity.ts
│   │   │       ├── class.entity.ts
│   │   │       ├── section.entity.ts
│   │   │       ├── subject.entity.ts
│   │   │       ├── student.entity.ts
│   │   │       ├── parent.entity.ts
│   │   │       ├── student-enrollment.entity.ts
│   │   │       ├── attendance.entity.ts
│   │   │       ├── exam.entity.ts
│   │   │       ├── exam-schedule.entity.ts
│   │   │       ├── mark.entity.ts
│   │   │       ├── grade.entity.ts
│   │   │       ├── report-card.entity.ts
│   │   │       ├── promotion.entity.ts
│   │   │       ├── transfer-certificate.entity.ts
│   │   │       ├── fee-structure.entity.ts
│   │   │       ├── fee-head.entity.ts
│   │   │       ├── fee-collection.entity.ts
│   │   │       ├── concession.entity.ts
│   │   │       ├── payment.entity.ts
│   │   │       ├── staff.entity.ts
│   │   │       ├── timetable.entity.ts
│   │   │       ├── leave.entity.ts
│   │   │       ├── announcement.entity.ts
│   │   │       ├── notification.entity.ts
│   │   │       ├── library-book.entity.ts
│   │   │       ├── book-issue.entity.ts
│   │   │       ├── transport-route.entity.ts
│   │   │       ├── vehicle.entity.ts
│   │   │       ├── hostel-room.entity.ts
│   │   │       ├── hostel-allocation.entity.ts
│   │   │       ├── inventory-item.entity.ts
│   │   │       └── user-invitation.entity.ts
│   │   │
│   │   ├── common/
│   │   │   ├── tenant/
│   │   │   │   ├── tenant-resolver.service.ts
│   │   │   │   ├── tenant-schema.service.ts
│   │   │   │   ├── tenant.middleware.ts
│   │   │   │   └── schema-migration.service.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── pin-auth.guard.ts
│   │   │   ├── decorators/
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   └── tenant.decorator.ts
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   ├── interceptors/
│   │   │   │   └── response.interceptor.ts
│   │   │   └── dto/
│   │   │       ├── pagination.dto.ts
│   │   │       └── api-response.dto.ts
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── superadmin/
│   │   │   ├── school-onboarding/
│   │   │   ├── academic-year/
│   │   │   ├── class-management/
│   │   │   ├── admission/
│   │   │   ├── students/
│   │   │   ├── parents/
│   │   │   ├── attendance/
│   │   │   ├── exams/
│   │   │   ├── results/
│   │   │   ├── promotion/
│   │   │   ├── fees/
│   │   │   ├── payments/
│   │   │   ├── staff/
│   │   │   ├── timetable/
│   │   │   ├── communication/
│   │   │   ├── library/
│   │   │   ├── transport/
│   │   │   ├── hostel/
│   │   │   ├── inventory/
│   │   │   └── reports/
│   │   │
│   │   └── jobs/
│   │       ├── attendance-reminder.job.ts
│   │       ├── fee-reminder.job.ts
│   │       └── report-card-generator.job.ts
│   │
│   ├── scripts/
│   │   ├── setup-databases.ts
│   │   ├── seed-plans.ts
│   │   └── seed-superadmin.ts
│   │
│   ├── test/
│   ├── nest-cli.json
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/                         ← React Web App
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── admission/
│   │   │   ├── students/
│   │   │   ├── classes/
│   │   │   ├── attendance/
│   │   │   ├── exams/
│   │   │   ├── fees/
│   │   │   ├── staff/
│   │   │   ├── library/
│   │   │   ├── transport/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   └── shared/
│   │   ├── stores/           ← Zustand stores
│   │   ├── hooks/
│   │   ├── services/         ← API calls
│   │   ├── types/            ← re-exports from shared/
│   │   └── utils/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── shared/
│   └── types/
│       └── index.ts           ← shared TypeScript types/enums
│
├── electron/                  ← Desktop app (future)
│   └── .gitkeep
│
└── mobile/                    ← Expo app (future)
    └── .gitkeep
```

---

## 4. ENVIRONMENT VARIABLES

Copy `.env.example` to `.env` and fill in all values.

```env
# ─── App ────────────────────────────────────────────────
NODE_ENV=development
APP_NAME=EduPro
APP_URL=http://localhost:3002
FRONTEND_URL=http://localhost:5175

# ─── Master DB (schools, plans, superadmins) ────────────
MASTER_DB_HOST=localhost
MASTER_DB_PORT=5437
MASTER_DB_NAME=edupro_master
MASTER_DB_USER=edupro_user
MASTER_DB_PASS=edupro_master_pass

# ─── Data DB (tenant schemas) ────────────────────────────
DATA_DB_HOST=localhost
DATA_DB_PORT=5438
DATA_DB_NAME=edupro_data
DATA_DB_USER=edupro_user
DATA_DB_PASS=edupro_data_pass

# ─── Redis ───────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6381
REDIS_PASSWORD=

# ─── JWT ─────────────────────────────────────────────────
JWT_SECRET=change_this_to_a_strong_random_secret_256bit
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change_this_refresh_secret_256bit
JWT_REFRESH_EXPIRES_IN=7d
PIN_JWT_SECRET=change_this_pin_secret
PIN_JWT_EXPIRES_IN=8h

# ─── Bcrypt ──────────────────────────────────────────────
BCRYPT_ROUNDS=12

# ─── Email (SMTP) ────────────────────────────────────────
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=EduPro
SMTP_FROM_EMAIL=no-reply@edupro.app

# ─── File Storage ────────────────────────────────────────
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./uploads
# S3-compatible (for prod)
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=ap-south-1

# ─── SMS (MSG91 / Twilio) ────────────────────────────────
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=
MSG91_SENDER_ID=EDUPRO
MSG91_TEMPLATE_ID=

# ─── Payment Gateway ─────────────────────────────────────
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# ─── Superadmin Seed ─────────────────────────────────────
SEED_SUPERADMIN_EMAIL=admin@edupro.app
SEED_SUPERADMIN_PASSWORD=Admin@123456

# ─── Throttle ────────────────────────────────────────────
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

---

## 5. DOCKER COMPOSE SPEC

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres-master:
    image: postgres:16-alpine
    container_name: edupro_master
    restart: unless-stopped
    environment:
      POSTGRES_DB: edupro_master
      POSTGRES_USER: edupro_user
      POSTGRES_PASSWORD: edupro_master_pass
    ports:
      - "5437:5432"
    volumes:
      - edupro_master_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U edupro_user -d edupro_master"]
      interval: 10s
      timeout: 5s
      retries: 5

  postgres-data:
    image: postgres:16-alpine
    container_name: edupro_data
    restart: unless-stopped
    environment:
      POSTGRES_DB: edupro_data
      POSTGRES_USER: edupro_user
      POSTGRES_PASSWORD: edupro_data_pass
    ports:
      - "5438:5432"
    volumes:
      - edupro_data_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U edupro_user -d edupro_data"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: edupro_redis
    restart: unless-stopped
    ports:
      - "6381:6379"
    volumes:
      - edupro_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  edupro_master_data:
  edupro_data_data:
  edupro_redis_data:
```

---

## 6. PORT ALLOCATION

| Service | Port | Notes |
|---------|------|-------|
| Backend API | **3002** | `/api/v1/` |
| Frontend (Vite) | **5175** | React SPA |
| PostgreSQL Master | **5437** | Schools, plans, superadmins |
| PostgreSQL Data | **5438** | All tenant schemas |
| Redis | **6381** | Cache + BullMQ queues |
| Swagger UI | **3002/api/docs** | Dev only |

> These ports are intentionally non-standard to avoid conflicts with other local dev projects.

---

## 7. BACKEND DEPENDENCIES

### Production
```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/platform-express": "^10.0.0",
  "@nestjs/config": "^3.0.0",
  "@nestjs/typeorm": "^10.0.0",
  "@nestjs/swagger": "^7.0.0",
  "@nestjs/jwt": "^10.0.0",
  "@nestjs/passport": "^10.0.0",
  "@nestjs/bull": "^10.0.0",
  "@nestjs/throttler": "^5.0.0",
  "@nestjs/schedule": "^4.0.0",
  "@nestjs/serve-static": "^4.0.0",
  "typeorm": "^0.3.17",
  "pg": "^8.11.0",
  "passport": "^0.7.0",
  "passport-jwt": "^4.0.0",
  "passport-local": "^1.0.0",
  "bcrypt": "^5.1.0",
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.1",
  "swagger-ui-express": "^5.0.0",
  "bull": "^4.12.0",
  "ioredis": "^5.3.2",
  "cache-manager": "^5.4.0",
  "cache-manager-ioredis-yet": "^2.1.0",
  "uuid": "^9.0.0",
  "slugify": "^1.6.6",
  "dayjs": "^1.11.10",
  "nodemailer": "^6.9.7",
  "handlebars": "^4.7.8",
  "puppeteer": "^21.0.0",
  "multer": "^1.4.5",
  "sharp": "^0.33.0",
  "rxjs": "^7.8.0"
}
```

### Dev
```json
{
  "@nestjs/cli": "^10.0.0",
  "@nestjs/schematics": "^10.0.0",
  "@nestjs/testing": "^10.0.0",
  "@types/bcrypt": "^5.0.0",
  "@types/multer": "^1.4.7",
  "@types/nodemailer": "^6.4.14",
  "@types/passport-jwt": "^4.0.0",
  "@types/passport-local": "^1.0.35",
  "@types/uuid": "^9.0.0",
  "@types/node": "^20.0.0",
  "@types/express": "^4.17.0",
  "ts-node": "^10.9.0",
  "ts-jest": "^29.0.0",
  "typescript": "^5.2.0",
  "concurrently": "^8.0.0"
}
```

---

## 8. FRONTEND DEPENDENCIES

### Production
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "zustand": "^4.4.0",
  "@tanstack/react-query": "^5.0.0",
  "@tanstack/react-table": "^8.10.0",
  "react-hook-form": "^7.48.0",
  "zod": "^3.22.0",
  "@hookform/resolvers": "^3.3.0",
  "axios": "^1.6.0",
  "dayjs": "^1.11.10",
  "recharts": "^2.10.0",
  "lucide-react": "^0.298.0",
  "clsx": "^2.0.0",
  "tailwind-merge": "^2.0.0"
}
```

### Dev
```json
{
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "@vitejs/plugin-react": "^4.2.0",
  "vite": "^5.0.0",
  "tailwindcss": "^3.3.0",
  "postcss": "^8.4.0",
  "autoprefixer": "^10.4.0",
  "typescript": "^5.2.0"
}
```

---

## 9. ROOT PACKAGE.JSON SCRIPTS

```json
{
  "name": "edupro",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "npm --prefix backend run start:dev",
    "dev:frontend": "npm --prefix frontend run dev",
    "build:backend": "npm --prefix backend run build",
    "build:frontend": "npm --prefix frontend run build",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:reset": "docker compose down -v && docker compose up -d",
    "db:setup": "ts-node backend/scripts/setup-databases.ts",
    "seed": "ts-node backend/scripts/seed-plans.ts && ts-node backend/scripts/seed-superadmin.ts",
    "migration:generate": "npm --prefix backend run migration:generate",
    "migration:run": "npm --prefix backend run migration:run",
    "migration:revert": "npm --prefix backend run migration:revert",
    "test:backend": "npm --prefix backend run test",
    "test:frontend": "npm --prefix frontend run test"
  },
  "devDependencies": {
    "concurrently": "^8.0.0",
    "ts-node": "^10.9.0"
  }
}
```

---

## 10. MASTER DB ENTITIES

All in `backend/src/database/master/`

### `school.entity.ts`
```typescript
// Represents each school/institution (tenant)
id: UUID PK
slug: VARCHAR(100) UNIQUE              // e.g. "sunrise-public-school"
name: VARCHAR(255)
email: VARCHAR(255) UNIQUE
phone: VARCHAR(20)
logo_url: VARCHAR(500)
plan_id: UUID FK → plans
schema_name: VARCHAR(100)              // "shared_pool" | "school_{slug}"
is_schema_provisioned: BOOLEAN DEFAULT false
status: ENUM('trial','active','grace_period','suspended','cancelled') DEFAULT 'trial'
trial_starts_at: TIMESTAMP
trial_ends_at: TIMESTAMP
subscription_starts_at: TIMESTAMP
subscription_ends_at: TIMESTAMP
created_at, updated_at, deleted_at
```

### `plan.entity.ts`
```typescript
id: UUID PK
name: VARCHAR(100)                     // Starter, Growth, Professional, Enterprise
slug: VARCHAR(100) UNIQUE
description: TEXT
price_monthly: INTEGER                 // paise (₹999 = 99900)
price_yearly: INTEGER                  // paise
trial_days: INTEGER DEFAULT 14
max_users: INTEGER DEFAULT 1           // -1 = unlimited
max_students: INTEGER DEFAULT 100      // -1 = unlimited
max_staff: INTEGER DEFAULT 5           // -1 = unlimited
features: JSONB DEFAULT '[]'           // ["sms_alerts","online_payments","hostel",...]
limits: JSONB DEFAULT '{}'             // {"storage_gb": 5, "sms_per_month": 500}
is_active: BOOLEAN DEFAULT true
is_featured: BOOLEAN DEFAULT false
is_custom: BOOLEAN DEFAULT false       // Enterprise custom pricing
display_order: INTEGER DEFAULT 0
created_at, updated_at
```

### `subscription.entity.ts`
```typescript
id: UUID PK
school_id: UUID FK → schools
plan_id: UUID FK → plans
status: ENUM('trial','active','grace_period','cancelled','expired') DEFAULT 'trial'
billing_cycle: ENUM('monthly','yearly') DEFAULT 'monthly'
amount: INTEGER                        // paise, locked at subscription time
currency: VARCHAR(10) DEFAULT 'INR'
trial_ends_at: TIMESTAMP
current_period_start: TIMESTAMP
current_period_end: TIMESTAMP
cancel_at_period_end: BOOLEAN DEFAULT false
cancelled_at: TIMESTAMP
payment_gateway: ENUM('razorpay','stripe','manual')
gateway_subscription_id: VARCHAR(255)
gateway_customer_id: VARCHAR(255)
created_at, updated_at
```

### `platform_invoice.entity.ts`
```typescript
id: UUID PK
school_id: UUID FK
subscription_id: UUID FK
invoice_number: VARCHAR(50)            // EDU-INV-000001
amount: INTEGER
currency: VARCHAR(10)
status: ENUM('draft','sent','paid','failed','void')
due_date: DATE
paid_at: TIMESTAMP
payment_gateway: VARCHAR(50)
gateway_payment_id: VARCHAR(255)
invoice_pdf_url: VARCHAR(500)
created_at, updated_at
```

### `superadmin.entity.ts`
```typescript
id: UUID PK
name: VARCHAR(255)
email: VARCHAR(255) UNIQUE
password_hash: VARCHAR(255)            // select: false
role: ENUM('superadmin','support','finance')
is_active: BOOLEAN DEFAULT true
last_login_at: TIMESTAMP
created_at, updated_at
```

### `schema_migration_log.entity.ts`
```typescript
id: UUID PK
schema_name: VARCHAR(100)
migration_name: VARCHAR(255)
status: ENUM('success','failed')
error_message: TEXT
executed_at: TIMESTAMP
UNIQUE(schema_name, migration_name)
```

---

## 11. TENANT DB ENTITIES

All in `backend/src/database/tenant/`  
Each school gets its own schema (`school_{slug}`) or shares `shared_pool` on trial.

### Core Entities

#### `user.entity.ts`
```typescript
id: UUID PK
school_id: UUID                        // denormalized for query speed
name: VARCHAR(255)
email: VARCHAR(255)
password_hash: VARCHAR(255)            // select: false
pin_hash: VARCHAR(10)                  // select: false — 4-6 digit PIN
role: ENUM('owner','admin','manager','teacher','staff','cashier')
is_active: BOOLEAN DEFAULT true
avatar_url: VARCHAR(500)
refresh_token_hash: VARCHAR(255)       // select: false
last_login_at: TIMESTAMP
created_at, updated_at, deleted_at
```

#### `academic_year.entity.ts`
```typescript
id: UUID PK
school_id: UUID
name: VARCHAR(50)                      // "2024-25"
start_date: DATE
end_date: DATE
is_current: BOOLEAN DEFAULT false
is_locked: BOOLEAN DEFAULT false       // locked after promotion
created_at, updated_at
```

#### `class.entity.ts`
```typescript
id: UUID PK
school_id: UUID
academic_year_id: UUID FK
name: VARCHAR(50)                      // "Class 10", "Grade 5"
order_index: INTEGER                   // for sorting
created_at, updated_at
```

#### `section.entity.ts`
```typescript
id: UUID PK
school_id: UUID
class_id: UUID FK
name: VARCHAR(10)                      // "A", "B", "C"
capacity: INTEGER DEFAULT 40
class_teacher_id: UUID FK → users
created_at, updated_at
```

#### `subject.entity.ts`
```typescript
id: UUID PK
school_id: UUID
name: VARCHAR(100)
code: VARCHAR(20)
class_id: UUID FK
is_optional: BOOLEAN DEFAULT false
max_marks: INTEGER DEFAULT 100
pass_marks: INTEGER DEFAULT 35
created_at, updated_at
```

#### `student.entity.ts`
```typescript
id: UUID PK
school_id: UUID
admission_number: VARCHAR(50) UNIQUE
user_id: UUID FK → users             // null until portal access granted
first_name: VARCHAR(100)
last_name: VARCHAR(100)
date_of_birth: DATE
gender: ENUM('male','female','other')
blood_group: VARCHAR(5)
religion: VARCHAR(50)
caste: VARCHAR(50)
aadhar_number: VARCHAR(12)
photo_url: VARCHAR(500)
address: TEXT
city: VARCHAR(100)
state: VARCHAR(100)
pincode: VARCHAR(10)
previous_school: VARCHAR(255)
admission_date: DATE
status: ENUM('active','inactive','transferred','alumni') DEFAULT 'active'
created_at, updated_at, deleted_at
```

#### `parent.entity.ts`
```typescript
id: UUID PK
school_id: UUID
user_id: UUID FK → users             // for app login
student_id: UUID FK → students
relation: ENUM('father','mother','guardian')
name: VARCHAR(255)
phone: VARCHAR(20)
email: VARCHAR(255)
occupation: VARCHAR(100)
annual_income: INTEGER
aadhar_number: VARCHAR(12)
photo_url: VARCHAR(500)
is_primary: BOOLEAN DEFAULT false
created_at, updated_at
```

#### `student_enrollment.entity.ts`
```typescript
id: UUID PK
school_id: UUID
student_id: UUID FK
academic_year_id: UUID FK
class_id: UUID FK
section_id: UUID FK
roll_number: VARCHAR(20)
enrollment_date: DATE
status: ENUM('active','transferred','promoted','detained') DEFAULT 'active'
created_at, updated_at
```

### Attendance

#### `attendance.entity.ts`
```typescript
id: UUID PK
school_id: UUID
student_id: UUID FK
section_id: UUID FK
academic_year_id: UUID FK
date: DATE
status: ENUM('present','absent','late','holiday','half_day')
marked_by: UUID FK → users
note: TEXT
created_at
UNIQUE(student_id, date)
```

### Exams & Results

#### `exam.entity.ts`
```typescript
id: UUID PK
school_id: UUID
academic_year_id: UUID FK
name: VARCHAR(100)                     // "Mid-Term 1", "Final Exam"
exam_type: ENUM('unit_test','mid_term','final','quarterly','half_yearly')
class_id: UUID FK
start_date: DATE
end_date: DATE
status: ENUM('draft','scheduled','ongoing','completed')
created_at, updated_at
```

#### `exam_schedule.entity.ts`
```typescript
id: UUID PK
exam_id: UUID FK
subject_id: UUID FK
date: DATE
start_time: TIME
end_time: TIME
max_marks: INTEGER
pass_marks: INTEGER
hall_ticket_url: VARCHAR(500)
created_at, updated_at
```

#### `mark.entity.ts`
```typescript
id: UUID PK
school_id: UUID
student_id: UUID FK
exam_id: UUID FK
subject_id: UUID FK
marks_obtained: DECIMAL(5,2)
max_marks: INTEGER
is_absent: BOOLEAN DEFAULT false
grade: VARCHAR(5)                      // A+, A, B...
remarks: TEXT
entered_by: UUID FK → users
created_at, updated_at
UNIQUE(student_id, exam_id, subject_id)
```

#### `report_card.entity.ts`
```typescript
id: UUID PK
school_id: UUID
student_id: UUID FK
academic_year_id: UUID FK
exam_id: UUID FK
total_marks: DECIMAL(8,2)
max_total_marks: DECIMAL(8,2)
percentage: DECIMAL(5,2)
grade: VARCHAR(5)
rank: INTEGER
is_passed: BOOLEAN
pdf_url: VARCHAR(500)
generated_at: TIMESTAMP
created_at, updated_at
```

### Promotion

#### `promotion.entity.ts`
```typescript
id: UUID PK
school_id: UUID
from_academic_year_id: UUID FK
to_academic_year_id: UUID FK
from_class_id: UUID FK
to_class_id: UUID FK
student_id: UUID FK
enrollment_id: UUID FK
status: ENUM('promoted','detained','transferred')
remarks: TEXT
promoted_by: UUID FK → users
promoted_at: TIMESTAMP
created_at
```

#### `transfer_certificate.entity.ts`
```typescript
id: UUID PK
school_id: UUID
student_id: UUID FK
tc_number: VARCHAR(50) UNIQUE          // TC-2024-000001
issue_date: DATE
reason: ENUM('transfer','completion','expulsion','withdrawal','other')
last_class: VARCHAR(50)
conduct: ENUM('excellent','good','satisfactory','poor')
fees_cleared: BOOLEAN DEFAULT false
pdf_url: VARCHAR(500)
issued_by: UUID FK → users
created_at
```

### Fees

#### `fee_head.entity.ts`
```typescript
id: UUID PK
school_id: UUID
name: VARCHAR(100)                     // "Tuition Fee","Transport Fee","Lab Fee"
type: ENUM('tuition','transport','hostel','library','lab','other')
is_recurring: BOOLEAN DEFAULT true
is_optional: BOOLEAN DEFAULT false
created_at, updated_at
```

#### `fee_structure.entity.ts`
```typescript
id: UUID PK
school_id: UUID
academic_year_id: UUID FK
class_id: UUID FK
fee_head_id: UUID FK
amount: INTEGER                        // paise
frequency: ENUM('monthly','quarterly','half_yearly','yearly','one_time')
due_day: INTEGER                       // day of month
late_fee_per_day: INTEGER DEFAULT 0
created_at, updated_at
```

#### `concession.entity.ts`
```typescript
id: UUID PK
school_id: UUID
student_id: UUID FK
fee_head_id: UUID FK
academic_year_id: UUID FK
type: ENUM('percentage','fixed')
value: INTEGER
reason: TEXT
approved_by: UUID FK → users
created_at, updated_at
```

#### `fee_collection.entity.ts`
```typescript
id: UUID PK
school_id: UUID
student_id: UUID FK
academic_year_id: UUID FK
fee_head_id: UUID FK
amount_due: INTEGER
amount_paid: INTEGER DEFAULT 0
amount_waived: INTEGER DEFAULT 0
due_date: DATE
status: ENUM('pending','partial','paid','overdue','waived')
created_at, updated_at
```

#### `payment.entity.ts`
```typescript
id: UUID PK
school_id: UUID
student_id: UUID FK
receipt_number: VARCHAR(50) UNIQUE     // REC-2024-000001
total_amount: INTEGER
payment_mode: ENUM('cash','upi','card','netbanking','cheque','dd','online')
payment_date: DATE
collected_by: UUID FK → users
gateway_order_id: VARCHAR(255)
gateway_payment_id: VARCHAR(255)
gateway_signature: VARCHAR(500)
status: ENUM('pending','success','failed','refunded')
receipt_pdf_url: VARCHAR(500)
note: TEXT
created_at
```

### Staff

#### `staff.entity.ts`
```typescript
id: UUID PK
school_id: UUID
user_id: UUID FK → users
employee_id: VARCHAR(50) UNIQUE
designation: VARCHAR(100)
department: VARCHAR(100)
qualification: TEXT
joining_date: DATE
salary: INTEGER                        // paise per month
bank_account: VARCHAR(50)
bank_ifsc: VARCHAR(20)
pan: VARCHAR(10)
aadhar: VARCHAR(12)
address: TEXT
photo_url: VARCHAR(500)
status: ENUM('active','on_leave','resigned','terminated') DEFAULT 'active'
created_at, updated_at, deleted_at
```

#### `timetable.entity.ts`
```typescript
id: UUID PK
school_id: UUID
section_id: UUID FK
subject_id: UUID FK
staff_id: UUID FK → staff
academic_year_id: UUID FK
day_of_week: ENUM('monday','tuesday','wednesday','thursday','friday','saturday')
period_number: INTEGER
start_time: TIME
end_time: TIME
created_at, updated_at
```

#### `leave.entity.ts`
```typescript
id: UUID PK
school_id: UUID
user_id: UUID FK
leave_type: ENUM('casual','sick','earned','unpaid','maternity','other')
from_date: DATE
to_date: DATE
days: INTEGER
reason: TEXT
status: ENUM('pending','approved','rejected')
approved_by: UUID FK → users
created_at, updated_at
```

### Communication

#### `announcement.entity.ts`
```typescript
id: UUID PK
school_id: UUID
title: VARCHAR(255)
body: TEXT
target_roles: VARCHAR[]               // ['teacher','parent','student']
target_class_ids: UUID[]
is_pinned: BOOLEAN DEFAULT false
attachment_url: VARCHAR(500)
created_by: UUID FK → users
expires_at: TIMESTAMP
created_at, updated_at
```

#### `notification.entity.ts`
```typescript
id: UUID PK
school_id: UUID
user_id: UUID FK
type: VARCHAR(50)                      // "fee_due","attendance","exam_result"...
title: VARCHAR(255)
body: TEXT
is_read: BOOLEAN DEFAULT false
action_url: VARCHAR(255)
created_at
```

### Library

#### `library_book.entity.ts`
```typescript
id: UUID PK
school_id: UUID
isbn: VARCHAR(20)
title: VARCHAR(255)
author: VARCHAR(255)
publisher: VARCHAR(255)
edition: VARCHAR(50)
category: VARCHAR(100)
total_copies: INTEGER DEFAULT 1
available_copies: INTEGER DEFAULT 1
rack_number: VARCHAR(20)
barcode: VARCHAR(50) UNIQUE
cover_url: VARCHAR(500)
created_at, updated_at
```

#### `book_issue.entity.ts`
```typescript
id: UUID PK
school_id: UUID
book_id: UUID FK
user_id: UUID FK                       // student or staff
issue_date: DATE
due_date: DATE
return_date: DATE
fine_amount: INTEGER DEFAULT 0
status: ENUM('issued','returned','overdue','lost')
issued_by: UUID FK → users
created_at, updated_at
```

### Transport

#### `transport_route.entity.ts`
```typescript
id: UUID PK
school_id: UUID
route_name: VARCHAR(100)
vehicle_id: UUID FK
driver_name: VARCHAR(255)
driver_phone: VARCHAR(20)
stops: JSONB                           // [{name, time, fee_paise}]
created_at, updated_at
```

### Hostel

#### `hostel_room.entity.ts`
```typescript
id: UUID PK
school_id: UUID
room_number: VARCHAR(20)
floor: INTEGER
capacity: INTEGER
type: ENUM('single','double','dormitory')
monthly_fee: INTEGER
status: ENUM('available','full','maintenance')
created_at, updated_at
```

#### `hostel_allocation.entity.ts`
```typescript
id: UUID PK
school_id: UUID
room_id: UUID FK
student_id: UUID FK
academic_year_id: UUID FK
from_date: DATE
to_date: DATE
status: ENUM('active','vacated')
created_at, updated_at
```

### Inventory

#### `inventory_item.entity.ts`
```typescript
id: UUID PK
school_id: UUID
name: VARCHAR(255)
category: VARCHAR(100)
unit: VARCHAR(20)
quantity: INTEGER DEFAULT 0
minimum_quantity: INTEGER DEFAULT 5    // alert threshold
unit_cost: INTEGER
location: VARCHAR(100)
last_stock_date: DATE
created_at, updated_at
```

---

## 12. API CONVENTIONS

### Base URL
```
/api/v1/
```

### Response envelope
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Paginated response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Error response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [...]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Headers required
```
Authorization: Bearer <access_token>
X-School-Slug: sunrise-public-school   ← for tenant resolution
Content-Type: application/json
```

### Auth endpoints
```
POST /api/v1/auth/login              ← email + password → JWT
POST /api/v1/auth/pin-login          ← user_id + PIN → short JWT (cashier)
POST /api/v1/auth/refresh            ← refresh token → new access token
POST /api/v1/auth/logout             ← blacklist refresh token
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

---

## 13. MULTI-TENANCY ARCHITECTURE

### Strategy: Schema-per-tenant on shared PostgreSQL instance

```
edupro_data DB
├── shared_pool schema     ← trial schools (row-level isolation via school_id)
├── school_sunrise         ← paid school: Sunrise Public School
├── school_greenvalley     ← paid school: Green Valley Academy
└── school_stjoseph        ← paid school: St. Joseph's School
```

### Tenant Resolution Flow
```
Request → X-School-Slug header
  → TenantMiddleware
  → Look up school in master DB
  → Determine schema_name
  → Set schema on TypeORM connection via SET search_path TO {schema}
  → Request proceeds
```

### Schema Provisioning (on plan upgrade from trial)
1. CREATE SCHEMA school_{slug}
2. Run all tenant migrations on new schema
3. Copy data from shared_pool (where school_id = this school)
4. Update school.schema_name = 'school_{slug}'
5. Update school.is_schema_provisioned = true
6. Log in schema_migrations_log

---

## 14. AUTHENTICATION FLOWS

### Standard JWT Login
```
POST /auth/login
  → Validate email + password
  → Return access_token (15m) + refresh_token (7d)
  → Store refresh_token_hash in users table
```

### PIN Login (Cashier)
```
POST /auth/pin-login
  → Validate user_id + PIN
  → Return short-lived access_token (8h)
  → Role restricted: cashier only
```

### Token Refresh
```
POST /auth/refresh
  → Validate refresh_token
  → Rotate: issue new access + refresh tokens
  → Invalidate old refresh_token_hash
```

---

## 15. DEFAULT SEED DATA

### Plans
| Plan | Monthly | Yearly | Users | Students |
|------|---------|--------|-------|----------|
| Starter | ₹999 | ₹9,990 | 5 | 200 |
| Growth | ₹2,499 | ₹24,990 | 20 | 1,000 |
| Professional | ₹4,999 | ₹49,990 | 50 | 5,000 |
| Enterprise | Custom | Custom | ∞ | ∞ |

### Features per plan
```json
{
  "starter":      ["attendance","fees","basic_reports","sms_alerts"],
  "growth":       ["starter", "exams","parent_app","online_payments","library"],
  "professional": ["growth", "transport","hostel","advanced_reports","api_access"],
  "enterprise":   ["professional", "custom_domain","sso","dedicated_support"]
}
```

### Default Superadmin
```
Email:    admin@edupro.app
Password: Admin@123456
Role:     superadmin
```

---

## 16. CODING CONVENTIONS

### NestJS
- One module per feature (`modules/fees/fees.module.ts`)
- Services handle all business logic — controllers are thin
- Use `@ApiTags`, `@ApiOperation`, `@ApiResponse` on every endpoint
- DTOs must use class-validator decorators — never raw objects
- Use `@Roles()` decorator + `RolesGuard` on every protected route
- Never expose password_hash, pin_hash, refresh_token_hash in responses
- Use `select: false` on sensitive columns in TypeORM entities

### TypeORM
- Use UUIDs (not auto-increment integers) for all PKs
- `created_at`, `updated_at` via `@CreateDateColumn` / `@UpdateDateColumn`
- Soft deletes via `@DeleteDateColumn` where specified
- All migrations in `backend/src/database/migrations/`
- Never use `synchronize: true` in production

### React
- Pages in `pages/` — one folder per feature
- Shared UI components in `components/ui/`
- Feature-specific components co-located with pages
- API calls only in `services/` — never in components
- Zustand stores: one per domain (auth, school, student, fees…)
- All forms use React Hook Form + Zod schema
- Use TanStack Query for all server state
- Types imported from `shared/types/` — never redefine

### TypeScript
- Strict mode enabled everywhere
- No `any` — use `unknown` and narrow, or define a proper type
- Enums defined once in `shared/types/index.ts` and imported everywhere
- All API request/response types in `shared/types/`

---

## 17. ACADEMIC YEAR LIFECYCLE

Every major entity is scoped to an `academic_year_id`. The lifecycle:

```
1. Create new academic year (e.g. 2025-26)
2. Set up classes and sections for the year
3. Define fee structures for the year
4. New admissions / re-enrollment of existing students
5. Daily operations: attendance, exams, fees
6. Year-end: generate report cards
7. Run promotion engine:
   - Mark passed students → promote to next class
   - Mark failed students → detain (repeat same class)
   - Transferred students → issue TC
8. Lock academic year (no further edits)
9. Activate next academic year
```

---

## 18. BACKGROUND JOBS (BullMQ)

| Queue | Job | Trigger |
|-------|-----|---------|
| `notifications` | Send SMS attendance alert | After attendance marked |
| `notifications` | Send push notification | Fee due, exam result |
| `emails` | Welcome email | New school onboarding |
| `emails` | Fee reminder | 3 days before due date |
| `reports` | Generate report card PDF | After marks finalized |
| `reports` | Generate TC PDF | TC creation |
| `maintenance` | Lock overdue subscriptions | Daily cron |
| `maintenance` | Attendance summary email | Daily 6pm cron |

---

## 19. IMPORTANT RULES FOR CLAUDE CODE

1. **Always read this CLAUDE.md first** before generating any code
2. **Never change ports** — 3002 (backend), 5175 (frontend), 5437 (master-db), 5438 (data-db), 6381 (redis)
3. **Never use `synchronize: true`** in TypeORM — always generate migrations
4. **Academic year scope** — every query on tenant data must include `academic_year_id` filter unless explicitly fetching across years
5. **Tenant middleware** — every tenant API request must go through `TenantMiddleware` to set schema
6. **school_id on all tenant entities** — denormalize it for query performance
7. **Soft deletes** — use `DeleteDateColumn` on: students, users, staff, schools — never hard delete these
8. **Monetary values always in paise** (smallest unit) — never store decimals for money
9. **PDF generation** runs in background job — never block HTTP response waiting for Puppeteer
10. **Shared types** — define enums and interfaces in `shared/types/index.ts` first, then import in both backend and frontend

---

## 20. DEVELOPMENT SETUP COMMANDS

```bash
# 1. Clone and install
npm install                            # root deps (concurrently, ts-node)
npx @nestjs/cli new backend --package-manager npm --skip-git
npm create vite@latest frontend -- --template react-ts --skip-git

# 2. Install backend deps
npm --prefix backend install \
  @nestjs/typeorm typeorm pg \
  @nestjs/config @nestjs/swagger swagger-ui-express \
  @nestjs/jwt @nestjs/passport passport passport-jwt passport-local \
  @nestjs/bull bull @nestjs/throttler @nestjs/schedule \
  class-validator class-transformer \
  bcrypt uuid slugify dayjs \
  nodemailer handlebars puppeteer \
  ioredis cache-manager cache-manager-ioredis-yet \
  multer sharp rxjs

npm --prefix backend install -D \
  @types/bcrypt @types/passport-jwt @types/passport-local \
  @types/nodemailer @types/uuid @types/multer \
  @nestjs/testing ts-jest

# 3. Install frontend deps
npm --prefix frontend install \
  zustand @tanstack/react-query @tanstack/react-table \
  react-hook-form zod @hookform/resolvers \
  axios dayjs recharts lucide-react \
  react-router-dom clsx tailwind-merge

npm --prefix frontend install -D \
  tailwindcss postcss autoprefixer

# 4. Start infra
npm run db:up

# 5. Setup DBs and seed
npm run db:setup
npm run seed

# 6. Start dev
npm run dev
```

---

*Last updated: Day 1 setup — EduPro Academic Management SaaS*
