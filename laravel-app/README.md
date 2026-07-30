# Real Estate Stakeholder Dashboard — Laravel 11 + MySQL

PHP port of the Emergent React/FastAPI/MongoDB dashboard.

**Stack:** Laravel 11 · MySQL · Blade · Tailwind CDN · Alpine.js CDN · Chart.js CDN.

> ⚡ **No Node, no npm, no build step.** All frontend assets are loaded
> from public CDNs directly in the Blade layouts. Just PHP + MySQL.

---

## Setup (30 min the first time)

### Prerequisites
- PHP 8.3+ (`php -v`)
- Composer 2 (`composer -V`)
- MySQL 8 or MariaDB 10.6+ (or Wamp / XAMPP / Laragon)

### Steps (Windows / Wamp)
1. Extract this project to `C:\wamp64\www\laravel-app`
2. Create the DB — open `http://localhost/phpmyadmin` →
   New → `realestate_dashboard` → `utf8mb4_unicode_ci` → Create.
3. Run `powershell -ExecutionPolicy Bypass -File .\setup.ps1`
   (or `bash setup.sh` on macOS/Linux).
4. When it prompts, open `.env` and set at minimum:
   ```
   DB_PASSWORD=              # blank for Wamp default
   MAIL_PASSWORD=            # Google Workspace App Password (optional)
   ```
5. Continue the script — it will migrate, seed the admin, and print
   the temp password. **Copy it.**
6. Start the server:
   ```
   php artisan serve
   ```
7. Open `http://localhost:8000/login` and sign in.

---

## Repo layout

```
laravel-app/
├── app/
│   ├── Http/Controllers/       # Route handlers
│   ├── Http/Middleware/        # Role, force-reset, onboarding
│   ├── Models/                 # Eloquent models
│   ├── Mail/                   # InviteMail
│   ├── Exports/                # Maatwebsite Excel exports
│   └── Imports/                # Excel imports
├── config/                     # All standard Laravel config files
├── database/
│   ├── migrations/             # MySQL schema
│   └── seeders/                # DatabaseSeeder (fresh admin)
├── resources/
│   └── views/                  # Blade templates (Tailwind via CDN)
├── routes/web.php              # All routes (RBAC via middleware)
├── public/                     # Web root (index.php + .htaccess)
├── deploy/                     # Production deployment guides
└── composer.json
```

---

## Deployment

- **[deploy/HOSTINGER.md](./deploy/HOSTINGER.md)** — cheapest path (~$3/mo)
- **[deploy/VPS.md](./deploy/VPS.md)** — Contabo/Hetzner/DigitalOcean
- **[deploy/POST_DEPLOY_SEED.md](./deploy/POST_DEPLOY_SEED.md)** — seed admin on prod

---

## Roles

| Role slug | User-facing name |
| --- | --- |
| `admin` | Admin |
| `accounts` | Accounts |
| `management` | Management |
| `site_manager` | Site Manager |
