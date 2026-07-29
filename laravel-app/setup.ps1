# ==============================================================
#  Local setup for the Real Estate Dashboard (Laravel + MySQL)
#  Run this from PowerShell inside the laravel-app folder
#  Prerequisites: PHP 8.3, Composer 2, MySQL 8 (or MariaDB 10.6+)
# ==============================================================

$ErrorActionPreference = "Stop"

Write-Host "`n== Step 1/6 : Ensuring storage directories exist ==" -ForegroundColor Cyan
$dirs = @(
    "storage\framework\cache\data",
    "storage\framework\sessions",
    "storage\framework\views",
    "storage\framework\testing",
    "storage\logs",
    "storage\app\public",
    "bootstrap\cache"
)
foreach ($d in $dirs) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null; Write-Host "  created $d" } }

Write-Host "`n== Step 2/6 : PHP dependencies (composer install) ==" -ForegroundColor Cyan
composer install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Composer failed. Install Composer first: https://getcomposer.org/download/" -ForegroundColor Red
    exit 1
}

Write-Host "`n== Step 3/6 : .env file ==" -ForegroundColor Cyan
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host ".env created from .env.example." -ForegroundColor Yellow
    Write-Host "OPEN .env in Notepad NOW and set:" -ForegroundColor Yellow
    Write-Host "   DB_PASSWORD     = your MySQL root password (blank if using Wamp default)" -ForegroundColor Yellow
    Write-Host "   MAIL_PASSWORD   = your Google Workspace App Password (or leave blank for now)" -ForegroundColor Yellow
    Write-Host "   APP_URL         = http://localhost:8000  (or your LAN IP if accessing from other devices)" -ForegroundColor Yellow
    Read-Host "Press Enter after saving .env"
} else {
    Write-Host ".env already exists — leaving it as-is."
}

Write-Host "`n== Step 4/6 : App key + storage link ==" -ForegroundColor Cyan
php artisan key:generate --force
php artisan storage:link

Write-Host "`n== Step 5/6 : DB migrations + admin seed ==" -ForegroundColor Cyan
Write-Host "Make sure MySQL is running and the database exists:" -ForegroundColor Yellow
Write-Host "   CREATE DATABASE realestate_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" -ForegroundColor Yellow
Write-Host "In Wamp, use phpMyAdmin (http://localhost/phpmyadmin) → New → name it 'realestate_dashboard' → utf8mb4_unicode_ci." -ForegroundColor Yellow
Read-Host "Press Enter to run migrations (this will create all tables and seed the admin)"
php artisan migrate --seed --force
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migrations failed. Check DB credentials in .env." -ForegroundColor Red
    exit 1
}

Write-Host "`n== Step 6/6 : Clear caches ==" -ForegroundColor Cyan
php artisan config:clear
php artisan view:clear
php artisan cache:clear
php artisan route:clear

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "  Setup complete." -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  Start the dev server with:" -ForegroundColor White
Write-Host ""
Write-Host "    php artisan serve" -ForegroundColor Yellow
Write-Host ""
Write-Host "  or for LAN access:" -ForegroundColor White
Write-Host ""
Write-Host "    php artisan serve --host=0.0.0.0 --port=8000" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Then open in browser: http://localhost:8000/login" -ForegroundColor White
Write-Host "  Log in with the admin email + temp password shown above." -ForegroundColor White
Write-Host "===================================================`n" -ForegroundColor Green
