#!/usr/bin/env bash
# ==============================================================
#  Real Estate Dashboard — Local setup (PHP + MySQL, NO Node)
#  All frontend assets load from CDN — no npm, no build step.
# ==============================================================

set -e

echo -e "\n== Step 1/5 : Storage directories =="
mkdir -p storage/framework/{cache/data,sessions,views,testing} storage/logs storage/app/public bootstrap/cache

echo -e "\n== Step 2/5 : composer install =="
composer install

echo -e "\n== Step 3/5 : .env =="
if [ ! -f .env ]; then
    cp .env.example .env
    echo ".env created. Edit it now to set DB_PASSWORD and MAIL_PASSWORD."
    read -p "Press Enter after saving .env"
fi
php artisan key:generate --force
php artisan storage:link

echo -e "\n== Step 4/5 : Migrations + admin seed =="
echo "Create database 'realestate_dashboard' first."
read -p "Press Enter to run migrations"
php artisan migrate --seed --force

echo -e "\n== Step 5/5 : Clear caches =="
php artisan config:clear && php artisan view:clear && php artisan cache:clear && php artisan route:clear

echo -e "\n==================================================="
echo " Setup complete. Start the server with:"
echo ""
echo "   php artisan serve"
echo ""
echo " Open http://localhost:8000/login"
echo "==================================================="
