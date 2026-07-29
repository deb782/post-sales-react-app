# Deploying to Hostinger cPanel — Step by Step

**Target audience:** small teams, cheapest option (~₹250 / $3 per month), no sysadmin
skills required. Everything is done through the cPanel web UI + File Manager
+ Terminal.

**What you get:** LiteSpeed web server + PHP 8.3 + MySQL + free SSL + email +
daily automatic backups.

---

## 1. Buy the plan

1. Go to https://www.hostinger.com/web-hosting → pick **Premium** or higher
   (Single won't work — we need SSH + Composer).
2. Add your domain during checkout (or use the free `.online` / `.website` if included).
3. Complete payment. You'll get a cPanel login by email.

---

## 2. Point your domain

If you bought the domain from Hostinger, skip this.

Otherwise: log in to your domain registrar (GoDaddy / Namecheap / etc.), open
DNS settings, and update the nameservers to:
```
ns1.dns-parking.com
ns2.dns-parking.com
```
Propagation: 15 min to 4 hours.

---

## 3. Create the MySQL database

1. In cPanel → **Databases → MySQL Databases**.
2. Create a database — name: `realestate`.
3. Create a database user — name: `re_user`, strong password (save it).
4. **Add user to database** with **All Privileges**.
5. Note your final DB credentials — they look like:
   ```
   DB_DATABASE=uXXXXXX_realestate
   DB_USERNAME=uXXXXXX_re_user
   DB_PASSWORD=<the-password-you-set>
   DB_HOST=localhost
   ```

---

## 4. Enable SSH access

1. cPanel → **Advanced → SSH Access** → **Manage SSH Keys** → generate a
   new key pair OR use "Import Key".
2. Enable "Access to Shell" (may be under a different tab in newer versions).
3. Note your SSH connection details (host + port + username).

---

## 5. Set PHP version to 8.3

1. cPanel → **Advanced → Select PHP Version**.
2. Set to **8.3**.
3. Under Extensions, tick: `pdo`, `pdo_mysql`, `mbstring`, `openssl`, `zip`,
   `gd`, `curl`, `xml`, `intl`, `bcmath`, `fileinfo`, `tokenizer`.
4. Save.

---

## 6. Upload the code

**Option A — Git (recommended if your code is on GitHub):**

SSH into your host:
```bash
ssh -p <port> user@your-host
cd ~
git clone https://github.com/<you>/<repo>.git realestate-app
cd realestate-app/laravel-app
```

**Option B — ZIP upload:**

1. Locally: zip the `laravel-app` folder (exclude `vendor/`, `node_modules/`,
   `.env`).
2. cPanel → **File Manager** → open the home folder → **Upload** the zip.
3. Extract, then move the resulting folder to a clean name like `realestate-app`.

Final path on the server: `/home/uXXXXXX/realestate-app/laravel-app/`.

---

## 7. Install dependencies (via SSH)

```bash
cd ~/realestate-app/laravel-app

# Composer is pre-installed on Hostinger — verify:
composer --version

# Install PHP dependencies (production, no dev tools)
composer install --no-dev --optimize-autoloader

# Node build — Hostinger has node available at /opt/alt/alt-nodejs20/root/usr/bin/node
# but the easier approach: build assets LOCALLY and upload public/build/*
```

**Local asset build (do this on your Mac/PC):**
```bash
npm install
npm run build
```
Then upload the `public/build/` folder to `~/realestate-app/laravel-app/public/build/`
via cPanel File Manager.

---

## 8. Configure `.env`

```bash
cd ~/realestate-app/laravel-app
cp .env.example .env
nano .env
```

Update these values:
```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

DB_HOST=localhost
DB_DATABASE=uXXXXXX_realestate
DB_USERNAME=uXXXXXX_re_user
DB_PASSWORD=<the-password>

MAIL_USERNAME=sales@agrocorp.co.in
MAIL_PASSWORD=<google-workspace-app-password>
MAIL_FROM_ADDRESS=sales@agrocorp.co.in
```
Save & exit (Ctrl+X, Y, Enter).

Generate app key + link storage:
```bash
php artisan key:generate --force
php artisan storage:link
```

---

## 9. Run migrations + seed the admin

```bash
php artisan migrate --seed --force
```
**Copy the printed admin email + temp password immediately** — you'll need
them to log in.

---

## 10. Set the web root to `public/`

By default cPanel serves `public_html/` — we need it to point to
`realestate-app/laravel-app/public/` instead.

### Cleanest option — cPanel "Domains" tool

1. cPanel → **Domains** → find your primary domain → **Manage**.
2. Change **Document Root** to
   `realestate-app/laravel-app/public`.
3. Save.

### Fallback if your plan won't let you change the doc root

1. Move contents of `laravel-app/public/*` into `public_html/`.
2. Edit `public_html/index.php`, update the two `require` paths:
   ```php
   require __DIR__.'/../realestate-app/laravel-app/vendor/autoload.php';
   $app = require_once __DIR__.'/../realestate-app/laravel-app/bootstrap/app.php';
   ```
3. Keep everything else (`app/`, `bootstrap/`, `config/`, `storage/`, etc.)
   in `realestate-app/laravel-app/` — never move them inside `public_html/`.

---

## 11. Enable HTTPS

1. cPanel → **Security → SSL/TLS Status** → tick your domain → **Run AutoSSL**.
2. Wait 2-5 minutes → refresh. You should see a green padlock.
3. Force HTTPS: cPanel → **Domains → Manage → Force HTTPS Redirect** → toggle on.

---

## 12. Set correct permissions

Via SSH:
```bash
cd ~/realestate-app/laravel-app
chmod -R 775 storage bootstrap/cache
chown -R $USER:$USER storage bootstrap/cache
```

---

## 13. Optimise for production

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Whenever you deploy new code, re-run:
```bash
php artisan config:clear && php artisan config:cache
php artisan route:clear && php artisan route:cache
php artisan view:clear && php artisan view:cache
```

---

## 14. Test

- Open `https://your-domain.com/login`
- Log in with the admin creds from step 9
- Set a new password → complete onboarding → invite a teammate → verify
  they receive a real email

---

## 15. Automatic backups

Hostinger takes daily backups automatically (Premium plan and above).
To download one manually:
- cPanel → **Files → Backups** → download the latest.

Restore is a one-click operation from the same page.

---

## Troubleshooting

### 500 error / "The stream or file could not be opened"
```bash
chmod -R 775 storage bootstrap/cache
```

### "Class 'PDO' not found" / DB not connecting
- PHP version < 8.3 or `pdo_mysql` extension disabled. Recheck step 5.

### Invite emails not sending
```bash
php artisan tinker
>>> Mail::raw('test', fn($m) => $m->to('you@example.com')->subject('smtp check'));
```
- If it errors: your Google Workspace App Password is wrong. Regenerate at
  https://myaccount.google.com/apppasswords.

### Assets not loading (blank page or unstyled)
- You didn't upload `public/build/` from your local `npm run build`, or its
  path is wrong. Verify: `ls ~/realestate-app/laravel-app/public/build/`.

### `.env` changes not taking effect
```bash
php artisan config:clear && php artisan config:cache
```

---

## Cost breakdown (annual)

| Item | Cost |
| --- | --- |
| Hostinger Premium (12 months) | ~₹4,500 / $50 |
| Google Workspace (already have) | ~₹210/mo / $6/mo per user |
| Domain (.com) | ~₹850 / $10 first year |
| **Total year 1** | **~₹5,350 / $60** |

Total for the app running for a year of internal use.
