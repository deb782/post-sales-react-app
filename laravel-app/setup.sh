#!/usr/bin/env bash
# ==============================================================
#  Local setup for the Real Estate Dashboard (Laravel + MySQL)
#  Run: bash setup.sh   (macOS / Linux)
#  Prerequisites: PHP 8.3, Composer 2, MySQL 8 (or MariaDB 10.6+)
# ==============================================================

set -e

echo -e "\n== Step 1/5 : PHP dependencies (composer) =="
composer install

echo -e "\n== Step 2/5 : .env file =="
if [ ! -f .env ]; then
    cp .env.example .env
    echo ".env created — edit it now to set DB_PASSWORD, MAIL_PASSWORD, and APP_URL."
    read -p "Press Enter after you have edited .env"
else
    echo ".env already exists — leaving it as-is."
fi

echo -e "\n== Step 3/5 : app key + storage link =="
php artisan key:generate --force
php artisan storage:link

echo -e "\n== Step 4/5 : DB migrations + admin seed =="
echo "Make sure MySQL is running and the database exists:"
echo "  CREATE DATABASE realestate_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
read -p "Press Enter to run migrations"
php artisan migrate --seed --force

echo -e "\n== Step 5/5 : clear caches =="
php artisan config:clear
php artisan view:clear
php artisan cache:clear

echo -e "\n================================================="
echo " Setup complete. Start the server with:"
echo ""
echo "   php artisan serve --host=0.0.0.0 --port=8000"
echo ""
echo " Then open http://<your-lan-ip>:8000/login in a browser."
echo " The admin email + temp password were printed above by the seeder."
echo "================================================="
