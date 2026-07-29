# Deploying to a VPS (Ubuntu 22.04)

For **Contabo, Hetzner, DigitalOcean, Vultr, Linode** — any Ubuntu 22.04 VPS
with root access. Cost: ~$4-6/month.

Assumes you have SSH access as `root` or a sudo user, and a domain pointing
its A-record to the VPS's public IP.

---

## 1. Base packages

```bash
apt update && apt upgrade -y
apt install -y nginx mysql-server certbot python3-certbot-nginx \
    php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring php8.3-xml \
    php8.3-curl php8.3-zip php8.3-gd php8.3-intl php8.3-bcmath \
    php8.3-fileinfo composer git unzip

# Node (for building assets)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verify: `php -v` (should be 8.3.x), `composer -V`, `mysql --version`.

---

## 2. MySQL setup

```bash
mysql_secure_installation
```
Accept defaults, set a root password.

Then:
```bash
mysql -uroot -p
```
```sql
CREATE DATABASE realestate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 're_user'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON realestate.* TO 're_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 3. Deploy the code

```bash
adduser --disabled-password --gecos "" deploy   # optional non-root user
usermod -aG www-data deploy
su - deploy

cd /var/www
git clone https://github.com/<you>/<repo>.git realestate
cd realestate/laravel-app

composer install --no-dev --optimize-autoloader
npm ci
npm run build
```

---

## 4. Configure `.env`

```bash
cp .env.example .env
nano .env
```
```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

DB_HOST=127.0.0.1
DB_DATABASE=realestate
DB_USERNAME=re_user
DB_PASSWORD=a-strong-password

MAIL_USERNAME=sales@agrocorp.co.in
MAIL_PASSWORD=<google-workspace-app-password>
MAIL_FROM_ADDRESS=sales@agrocorp.co.in
```

```bash
php artisan key:generate --force
php artisan migrate --seed --force
php artisan storage:link
```
**Copy the admin email + temp password from the seeder output.**

Ownership + permissions:
```bash
sudo chown -R www-data:www-data /var/www/realestate/laravel-app/storage \
    /var/www/realestate/laravel-app/bootstrap/cache
sudo chmod -R 775 /var/www/realestate/laravel-app/storage \
    /var/www/realestate/laravel-app/bootstrap/cache
```

---

## 5. Nginx server block

Copy the nginx config from this folder:
```bash
sudo cp /var/www/realestate/laravel-app/deploy/nginx.conf \
    /etc/nginx/sites-available/realestate
sudo ln -s /etc/nginx/sites-available/realestate /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default   # optional
```

Edit the file — set `server_name` to your domain:
```bash
sudo nano /etc/nginx/sites-available/realestate
```

Test + reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. HTTPS with Let's Encrypt

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```
Certbot auto-edits your nginx config to add SSL. Follow the prompts, choose
**redirect HTTP → HTTPS**. Renewal is automatic via systemd timer.

---

## 7. Optimise + test

```bash
cd /var/www/realestate/laravel-app
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Open `https://your-domain.com/login` → sign in with seeded admin creds.

---

## 8. Zero-downtime redeploys

Create a redeploy script:
```bash
sudo nano /usr/local/bin/redeploy-realestate
```
```bash
#!/usr/bin/env bash
set -euo pipefail
cd /var/www/realestate/laravel-app

git pull --ff-only
composer install --no-dev --optimize-autoloader --no-interaction
npm ci && npm run build
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache

sudo -n systemctl reload php8.3-fpm
echo "✓ deployed at $(date)"
```
```bash
sudo chmod +x /usr/local/bin/redeploy-realestate
```
Then just `redeploy-realestate` after every `git push`.

---

## 9. Backups (nightly cron)

```bash
sudo nano /etc/cron.d/realestate-backup
```
```
30 2 * * * root mysqldump -u re_user -p'a-strong-password' realestate \
    | gzip > /var/backups/realestate-$(date +\%F).sql.gz
0 3 * * * root find /var/backups -name 'realestate-*.sql.gz' -mtime +14 -delete
```
Backups pile up in `/var/backups/`. Also consider rsync-ing to S3 /
Backblaze weekly.

---

## 10. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Troubleshooting

**502 Bad Gateway**: `sudo systemctl status php8.3-fpm` — restart if needed
(`sudo systemctl restart php8.3-fpm`).

**Permission denied errors in laravel.log**:
```bash
sudo chown -R www-data:www-data /var/www/realestate/laravel-app/storage
sudo chmod -R 775 /var/www/realestate/laravel-app/storage
```

**Session expired every request**: `SESSION_DRIVER=database` + you forgot
to run migrations. Rerun `php artisan migrate --force`.

**Mail not sending**: check `/var/www/realestate/laravel-app/storage/logs/laravel.log`
for the SMTP error. Google Workspace requires an App Password (2FA on).

---

## Cost breakdown (monthly)

| Item | Cost |
| --- | --- |
| Contabo VPS S (4 GB RAM, 200 GB SSD) | ~$4.50 |
| Domain (.com, annualised) | ~$1 |
| Google Workspace (already have) | — |
| Backups (Hetzner Storage Box optional) | ~$3 |
| **Total** | **~$8/month** |

Cheaper than Hostinger annually, but requires basic sysadmin comfort.
