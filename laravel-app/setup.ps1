# ==============================================================
#  Real Estate Dashboard — Local setup (PHP + MySQL, NO Node)
#  All frontend assets load from CDN — no npm, no build step.
#  Prerequisites: PHP 8.3, Composer 2, MySQL 8 (or MariaDB 10.6+)
# ==============================================================

$ErrorActionPreference = "Stop"

Write-Host "`n== Step 1/5 : Ensure storage directories exist ==" -ForegroundColor Cyan
$dirs = @(
    "storage\framework\cache\data",
    "storage\framework\sessions",
    "storage\framework\views",
    "storage\framework\testing",
    "storage\logs",
    "storage\app\public",
    "bootstrap\cache"
)
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}

Write-Host "`n== Step 2/5 : Install PHP dependencies (composer install) ==" -ForegroundColor Cyan
composer install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Composer failed. Install Composer first: https://getcomposer.org/download/" -ForegroundColor Red
    exit 1
}

Write-Host "`n== Step 3/5 : .env file ==" -ForegroundColor Cyan
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host ".env created. Open it in Notepad and set:" -ForegroundColor Yellow
    Write-Host "  DB_PASSWORD    (blank if Wamp default)" -ForegroundColor Yellow
    Write-Host "  MAIL_PASSWORD  (Google Workspace App Password — or leave blank now)" -ForegroundColor Yellow
    Read-Host "Press Enter after saving .env"
}

php artisan key:generate --force
php artisan storage:link

Write-Host "`n== Step 4/5 : DB migrations + admin seed ==" -ForegroundColor Cyan
Write-Host "Create database 'realestate_dashboard' in phpMyAdmin first, then:" -ForegroundColor Yellow
Read-Host "Press Enter to run migrations"
php artisan migrate --seed --force
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migrations failed. Check DB credentials in .env." -ForegroundColor Red
    exit 1
}

Write-Host "`n== Step 5/5 : Clear caches ==" -ForegroundColor Cyan
php artisan config:clear
php artisan view:clear
php artisan cache:clear
php artisan route:clear

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "  Setup complete. Start the server with:" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "    php artisan serve" -ForegroundColor Yellow
Write-Host "" -ForegroundColor Green
Write-Host "  Open http://localhost:8000/login and sign in with" -ForegroundColor Green
Write-Host "  the admin email + temp password shown above." -ForegroundColor Green
Write-Host "===================================================`n" -ForegroundColor Green
