# Real Estate Stakeholder Dashboard — Laravel 11 + MySQL

PHP port of the Emergent React/FastAPI/MongoDB dashboard.
Stack: **Laravel 11 · MySQL · Blade · Tailwind · Alpine.js · Chart.js**.

> 📖 Full feature spec: see [`/app/docs/USER_GUIDE.md`](../docs/USER_GUIDE.md) and [`/app/docs/TECH_SPEC.md`](../docs/TECH_SPEC.md).

---

## Local Setup (macOS / Windows / Linux)

### 1. Prerequisites
- **PHP 8.3+** (`php -v`)
- **Composer 2** (`composer -V`)
- **MySQL 8** (or MariaDB 10.6+)
- **Node.js 20+ & npm** (for building Tailwind assets)

Windows: install [Laravel Herd](https://herd.laravel.com/) — bundles PHP 8.3, MySQL, and Composer.
macOS: `brew install php composer mysql node`.

### 2. Install dependencies
```bash
cd laravel-app
composer install
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
php artisan key:generate
```
Edit `.env`:
```
DB_DATABASE=realestate_dashboard
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
MAIL_HOST=smtp.gmail.com
MAIL_USERNAME=sales@agrocorp.co.in
MAIL_PASSWORD="your_google_workspace_app_password"
MAIL_FROM_ADDRESS=sales@agrocorp.co.in
MAIL_FROM_NAME="Agrocorp Internal"
```

### 4. Create the database
```sql
CREATE DATABASE realestate_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. Run migrations + seed admin
```bash
php artisan migrate --seed
```
Seeder prints the admin email + temp password. Save them.

### 6. Build assets & serve
```bash
npm run build        # or `npm run dev` for hot reload
php artisan storage:link
php artisan serve
```
Visit http://localhost:8000 → log in with the seeded admin.

---

## Deploying

Two supported paths — see [`deploy/`](./deploy/) for the full guides:

- **[Hostinger cPanel](./deploy/HOSTINGER.md)** — cheapest ($3-5/mo), no sysadmin skills.
- **[Ubuntu VPS](./deploy/VPS.md)** — full control (~$4-6/mo).
- **[Post-deploy admin seed](./deploy/POST_DEPLOY_SEED.md)** — how to seed / rotate the admin on prod.

---

## Deploying to Hostinger cPanel (cheapest path)

1. In cPanel → **MySQL Databases** → create db + user, note credentials.
2. Zip the project (excluding `vendor/`, `node_modules/`, `.env`) and upload via **File Manager** to `public_html/` (or a subdirectory).
3. Extract, then SSH into cPanel: `composer install --no-dev --optimize-autoloader`.
4. Point your domain's document root to `public_html/laravel-app/public/`.
5. Copy `.env.example` → `.env`, fill in production DB + SMTP creds, `php artisan key:generate`.
6. `php artisan migrate --seed --force`.
7. `php artisan storage:link`.
8. `chmod -R 775 storage bootstrap/cache`.
9. Log in with seeded admin creds.

## Deploying to a VPS (Contabo / Hetzner / DigitalOcean)

```bash
# Ubuntu 22.04
apt install -y nginx mysql-server php8.3-fpm php8.3-{mysql,mbstring,xml,curl,zip,gd,intl,bcmath}
apt install -y composer nodejs npm

# clone your GitHub repo, then:
cd /var/www/laravel-app
composer install --no-dev --optimize-autoloader
npm ci && npm run build
cp .env.example .env && php artisan key:generate
php artisan migrate --seed --force
php artisan storage:link
chown -R www-data:www-data storage bootstrap/cache

# Point nginx at public/index.php (see /docs/deploy-nginx.conf in this repo)
systemctl reload nginx
```

---

## Repo Layout

```
laravel-app/
├── app/
│   ├── Http/Controllers/       # Route handlers (grouped by feature)
│   ├── Http/Middleware/        # RoleMiddleware, ForcePasswordReset, EnsureOnboarded
│   ├── Http/Requests/          # Form validation
│   ├── Models/                 # Eloquent models (User, Project, Unit, …)
│   ├── Mail/                   # InviteMail, ResetPasswordMail
│   └── Services/               # ExpenseApproval, RevenueTargets, StockService
├── config/                     # Laravel config files
├── database/
│   ├── migrations/             # MySQL schema
│   └── seeders/                # AdminUserSeeder (fresh admin)
├── resources/
│   ├── views/                  # Blade templates
│   ├── css/app.css             # Tailwind entry
│   └── js/app.js               # Alpine + Chart.js entry
├── routes/web.php              # All routes (RBAC applied via middleware)
├── public/                     # Web root (index.php + built assets)
└── composer.json
```

---

## Roles

| Role slug | User-facing name |
| --- | --- |
| `admin` | Admin |
| `accounts` | Accounts |
| `management` | Management |
| `site_manager` | Site Manager |

Role guard is applied per-route via the `role:admin,accounts` middleware.
