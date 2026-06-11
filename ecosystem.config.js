/**
 * PM2 process config for the EduPro backend (NestJS API).
 *
 *   pm2 start ecosystem.config.js
 *   pm2 save && pm2 startup        # survive reboots
 *   pm2 logs edupro-api
 *   pm2 restart edupro-api         # after a redeploy
 *
 * Notes:
 *  - Runs with cwd = ./backend so the app loads the repo-root `.env`
 *    (ConfigModule envFilePath includes '../.env').
 *  - Single instance ON PURPOSE: the subscription-expiry cron and the
 *    in-process BullMQ workers assume exactly one process. Do NOT cluster.
 *  - Build first: `npm run build:backend` (produces backend/dist/main.js).
 *  - Chrome must be installed for PDF generation (report cards / TCs); the
 *    PdfService auto-detects it, or set PUPPETEER_EXECUTABLE_PATH in .env.
 */
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'edupro-api',
      script: path.join(__dirname, 'backend', 'dist', 'main.js'),
      cwd: path.join(__dirname, 'backend'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '700M',
      min_uptime: '10s',
      max_restarts: 10,
      time: true,
      env: {
        NODE_ENV: 'production',
        // Remaining config (DB, JWT, Razorpay, …) comes from the repo-root .env.
        // APP_PORT defaults to 3002 if unset.
      },
    },
  ],
};
