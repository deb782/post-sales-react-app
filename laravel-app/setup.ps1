# ==============================================================
#  Local setup for the Real Estate Dashboard (Laravel + MySQL)
#  Run this from PowerShell inside the laravel-app folder
#  Prerequisites: PHP 8.3, Composer 2, MySQL 8 (or MariaDB 10.6+)
# ==============================================================

Write-Host "`n== Step 1/5 : PHP dependencies (composer) ==" -ForegroundColor Cyan
composer install
if ($LASTEXITCODE -ne 0) { Write-Host "Composer failed. Install Composer first: https://getcomposer.org/download/" -ForegroundColor Red; exit 1 }

Write-Host "`n== Step 2/5 : .env file ==" -ForegroundColor Cyan
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host ".env created from .env.example — edit it now to set DB_PASSWORD, MAIL_PASSWORD, and APP_URL." -ForegroundColor Yellow
    Write-Host "  APP_URL=http://<your-lan-ip>:8000   (e.g. http://192.168.110.29:8000)" -ForegroundColor Yellow
    Read-Host "Press Enter after you have edited .env"
} else {
    Write-Host ".env already exists — leaving it as-is."
}

Write-Host "`n== Step 3/5 : app key + storage link ==" -ForegroundColor Cyan
php artisan key:generate --force
php artisan storage:link

Write-Host "`n== Step 4/5 : DB migrations + admin seed ==" -ForegroundColor Cyan
Write-Host "Make sure MySQL is running and the database exists:" -ForegroundColor Yellow
Write-Host "  CREATE DATABASE realestate_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" -ForegroundColor Yellow
Read-Host "Press Enter to run migrations"
php artisan migrate --seed --force
if ($LASTEXITCODE -ne 0) { Write-Host "Migrations failed. Check DB credentials in .env." -ForegroundColor Red; exit 1 }

Write-Host "`n== Step 5/5 : clear caches ==" -ForegroundColor Cyan
php artisan config:clear
php artisan view:clear
php artisan cache:clear

Write-Host "`n=================================================" -ForegroundColor Green
Write-Host " Setup complete. Now start the server with:"  -ForegroundColor Green
Write-Host ""
Write-Host "   php artisan serve --host=0.0.0.0 --port=8000" -ForegroundColor White
Write-Host ""
Write-Host " Then open http://<your-lan-ip>:8000/login in a browser." -ForegroundColor Green
Write-Host " The admin email + temp password were printed above by the seeder."
Write-Host "=================================================`n" -ForegroundColor Green
