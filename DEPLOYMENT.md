# EduPro — Deployment Guide

Production deployment for the EduPro SaaS (NestJS API + React SPA + PostgreSQL + Redis).
This guide assumes a single Linux server (Ubuntu/Debian) with **Node 20**, **PostgreSQL 16**, **Redis 7**, **nginx**, and **git** already installed — **no Docker**. (The repo's `docker-compose.yml` is for local development only.)

EduPro uses two logical databases — **`edupro_master`** (schools/plans/subscriptions) and **`edupro_data`** (tenant schemas). On a native server these are simply **two databases inside one PostgreSQL instance** (default port **5432**), not two servers.

Two committed files do most of the work:

- [`ecosystem.config.js`](./ecosystem.config.js) — PM2 process config for the API.
- [`nginx-edupro.conf`](./nginx-edupro.conf) — nginx site (SPA + API proxy).

Throughout, the repo is assumed at `/var/www/edupro` and the public domain is `app.yourdomain.com` — adjust to yours.

---

## Architecture (what runs where)

| Component | Port | Notes |
|-----------|------|-------|
| API (NestJS) | **3002** (localhost) | global prefix `/api/v1`, Swagger `/api/docs`, static `/uploads` |
| SPA (React build) | — | static files in `frontend/dist`, served by nginx |
| PostgreSQL | **5432** (localhost) | one instance, two databases: `edupro_master` + `edupro_data` (tenant schemas `shared_pool` + `school_<slug>`) |
| Redis | **6379** (localhost) | BullMQ queues (PDF generation jobs) |
| nginx | **80 / 443** (public) | serves SPA, proxies `/api/` + `/uploads/` to 3002 |

Only **80/443** are exposed publicly. Everything else stays on `localhost`.

> The docker-compose dev setup uses non-standard ports (5437/5438/6381) to avoid local conflicts. On a native server, use the **standard 5432 / 6379** as shown here and set the `.env` ports to match.

---

## 1. Clone & install

```bash
cd /var/www
git clone <your-repo-url> edupro
cd edupro

# Install all three. DEV deps are required: db:setup + seed run via ts-node.
npm install
npm --prefix backend install
npm --prefix frontend install
```

## 2. Environment

The API loads the **repo-root `.env`** (it runs with cwd = `backend/`, and ConfigModule reads `../.env`).

```bash
cp .env.example .env
nano .env
```

Minimum production values to set:

```env
NODE_ENV=production
APP_URL=https://app.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com         # CORS origin

# Strong secrets — generate each:  openssl rand -hex 32
JWT_SECRET=...
JWT_REFRESH_SECRET=...
PIN_JWT_SECRET=...

# DB / Redis — native PostgreSQL (one instance, two DBs) + native Redis
MASTER_DB_HOST=localhost  MASTER_DB_PORT=5432  MASTER_DB_NAME=edupro_master  MASTER_DB_USER=edupro_user  MASTER_DB_PASS=<change-me>
DATA_DB_HOST=localhost    DATA_DB_PORT=5432    DATA_DB_NAME=edupro_data      DATA_DB_USER=edupro_user    DATA_DB_PASS=<change-me>
REDIS_HOST=localhost      REDIS_PORT=6379

# Uploads — ABSOLUTE path, on persistent disk (holds report-card / TC PDFs + photos)
STORAGE_LOCAL_PATH=/var/www/edupro/uploads

# First superadmin (change BEFORE seeding)
SEED_SUPERADMIN_EMAIL=admin@yourdomain.com
SEED_SUPERADMIN_PASSWORD=<a strong password>

# Razorpay — add your keys to enable billing checkout (blank = "not configured")
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# (optional) explicit Chrome path for PDF generation; auto-detected if omitted
# PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

> `APP_PORT` is optional — the API defaults to **3002**. The `MASTER_DB_PASS` / `DATA_DB_PASS` must match the password you set for the `edupro_user` role in step 3.

```bash
mkdir -p /var/www/edupro/uploads
```

## 3. Database — PostgreSQL + Redis (native)

### 3a. Install (if not already present)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib redis-server
sudo systemctl enable --now postgresql redis-server
```

### 3b. Create the role + the two databases + extensions

`db:setup` connects **as `edupro_user`** and materializes the tables, but it does **not** create the role, the databases, or the (superuser-only) extensions. Do that once as the `postgres` superuser:

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE edupro_user LOGIN PASSWORD 'CHANGE_ME_STRONG';
CREATE DATABASE edupro_master OWNER edupro_user;
CREATE DATABASE edupro_data   OWNER edupro_user;
SQL

# uuid-ossp + pgcrypto are superuser-only — install them in BOTH databases now
# so the app's `CREATE EXTENSION IF NOT EXISTS` calls are harmless no-ops.
for db in edupro_master edupro_data; do
  sudo -u postgres psql -d "$db" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
  sudo -u postgres psql -d "$db" -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'
done
```

Use the **same password** (`CHANGE_ME_STRONG`) for `MASTER_DB_PASS` / `DATA_DB_PASS` in `.env`.

> PostgreSQL listens on `localhost:5432` by default — no `postgresql.conf` / `pg_hba.conf` changes needed for a same-box app. Redis listens on `localhost:6379` by default. If your Redis requires a password, set `REDIS_PASSWORD` in `.env`.

### 3c. Create the schema + seed

```bash
npm run db:setup              # creates the shared_pool schema + all tables on both DBs
npm run seed                  # seeds the 4 plans + the superadmin account
```

> **No migration system.** `db:setup` materializes the schema from the TypeORM entities (run once on first deploy; safe to re-run). It needs `ts-node` — hence the full `npm install` in step 1.

## 4. Build

```bash
npm run build:backend         # → backend/dist/main.js
npm run build:frontend        # → frontend/dist (static SPA nginx serves)
```

## 5. Run the API (PM2)

Chrome is required for PDF generation (report cards, transfer certificates):

```bash
sudo apt install -y google-chrome-stable     # PdfService auto-detects /usr/bin/google-chrome
```

Start via the committed config:

```bash
sudo npm i -g pm2
pm2 start ecosystem.config.js
pm2 logs edupro-api           # expect "Nest application successfully started"
pm2 save
pm2 startup                   # run the command it prints (boot persistence)
```

The config runs **one** `fork`-mode instance on purpose — the daily expiry cron and the BullMQ workers live in-process and must not be clustered.

## 6. nginx + TLS

```bash
# Edit server_name + root in the committed config, then enable it:
nano nginx-edupro.conf
sudo ln -s /var/www/edupro/nginx-edupro.conf /etc/nginx/sites-enabled/edupro
sudo nginx -t && sudo systemctl reload nginx

# TLS — adds the 443 server block + HTTP→HTTPS redirect automatically
sudo certbot --nginx -d app.yourdomain.com
```

The SPA calls the API at the **relative** path `/api/v1`, so no build-time API URL is needed — it works on any domain behind this proxy. SPA and API share an origin, so CORS isn't exercised in practice (keep `FRONTEND_URL` correct regardless).

## 7. Firewall & verify

```bash
sudo ufw allow 80,443/tcp     # keep 3002 + DB + Redis private
```

Smoke test:
- `https://app.yourdomain.com` → marketing landing; `/pricing` lists the 4 plans.
- `/superadmin/login` → log in with the seeded superadmin.
- `/signup` → create a trial school → lands in the dashboard.
- `/api/docs` → Swagger (consider disabling in prod — see the commented block in `nginx-edupro.conf`).

## 8. Razorpay webhook

In the Razorpay dashboard, add a webhook:

- **URL:** `https://app.yourdomain.com/api/v1/public/razorpay/webhook`
- **Secret:** the value of `RAZORPAY_WEBHOOK_SECRET`
- **Event:** `payment.captured`

(Subscription activation also happens synchronously via the in-app checkout `verify` step; the webhook is the idempotent backstop.)

---

## Redeploys (no schema change)

```bash
cd /var/www/edupro && git pull
npm --prefix backend install && npm --prefix frontend install
npm run build:backend && npm run build:frontend
pm2 restart edupro-api        # nginx serves the new frontend/dist immediately
```

If a release adds **new tables/columns**, re-run `npm run db:setup` (synchronize) before restarting — review the diff first, as there is no versioned migration safety net.

## Operations

- **Logs:** `pm2 logs edupro-api`, `pm2 monit`.
- **Backups:** schedule `pg_dump` for both DBs and back up `uploads/`:
  ```bash
  PGPASSWORD=$MASTER_DB_PASS pg_dump -h localhost -p 5432 -U edupro_user edupro_master > master.sql
  PGPASSWORD=$DATA_DB_PASS   pg_dump -h localhost -p 5432 -U edupro_user edupro_data   > data.sql
  tar czf uploads.tgz /var/www/edupro/uploads
  ```
  (Generated PDFs are **not** auto-regenerated — back up `uploads/`.)
- **Schema-per-school:** new schools start in `shared_pool`. A superadmin can move a paying school to its own schema from **Superadmin → Schools → Provision** (the data is relocated in one transaction; the school keeps working).
- **Subscription lifecycle:** the expiry sweep runs daily at 1 AM (server time) inside the API process — nothing to schedule. It can also be triggered from **Superadmin → Schools → Run expiry sweep**.

## Caveats before going live

- **Rotate secrets:** change the default DB passwords and the seeded superadmin password after first login.
- **Single API instance:** required (in-process cron + queues). To scale, externalise the scheduler/queue workers first.
- **Migrations:** there is no versioned migration system yet — plan for one before the schema changes frequently in production.
- **Email/SMS:** fill `SMTP_*` (and SMS provider keys) if you rely on notifications; they're inert when blank.
