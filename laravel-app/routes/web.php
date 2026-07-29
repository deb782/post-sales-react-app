<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\RevenueTargetController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\UnitController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// Public auth
Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'store']);
});

Route::post('/logout', [LoginController::class, 'destroy'])
    ->middleware('auth')->name('logout');

// Forced password reset
Route::middleware('auth')->group(function () {
    Route::get('/password/reset', [PasswordResetController::class, 'edit'])->name('password.reset');
    Route::post('/password/reset', [PasswordResetController::class, 'update'])->name('password.update');
});

// Authenticated app
Route::middleware(['auth', 'force.reset', 'onboarded'])->group(function () {
    Route::redirect('/', '/dashboard');
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Notifications
    Route::get('/notifications/poll', [NotificationController::class, 'poll'])->name('notifications.poll');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('notifications.readAll');
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead'])->name('notifications.read');

    // Projects
    Route::get('/projects', [ProjectController::class, 'index'])->name('projects.index');
    Route::middleware('role:admin')->group(function () {
        Route::post('/projects', [ProjectController::class, 'store'])->name('projects.store');
        Route::put('/projects/{project}', [ProjectController::class, 'update'])->name('projects.update');
        Route::delete('/projects/{project}', [ProjectController::class, 'destroy'])->name('projects.destroy');
        Route::get('/projects/{project}/impact', [ProjectController::class, 'impact'])->name('projects.impact');
    });

    // Units
    Route::get('/units', [UnitController::class, 'index'])->name('units.index');
    Route::middleware('role:admin,accounts')->group(function () {
        Route::post('/units', [UnitController::class, 'store'])->name('units.store');
        Route::post('/units/bulk', [UnitController::class, 'storeBulk'])->name('units.bulk');
        Route::post('/units/{unit}/sell', [UnitController::class, 'sell'])->name('units.sell');
        Route::post('/units/{unit}/reserve', [UnitController::class, 'reserve'])->name('units.reserve');
        Route::post('/units/{unit}/release', [UnitController::class, 'release'])->name('units.release');
    });
    Route::post('/units/{unit}/cancel', [UnitController::class, 'cancel'])
        ->middleware('role:admin')->name('units.cancel');

    // Revenue / Payments / Targets
    Route::middleware('role:admin,accounts,management')->group(function () {
        Route::get('/revenue', [PaymentController::class, 'index'])->name('revenue.index');
        Route::get('/revenue/targets', [RevenueTargetController::class, 'index'])->name('revenue.targets.index');
    });
    Route::middleware('role:admin,accounts')->group(function () {
        Route::post('/payments', [PaymentController::class, 'store'])->name('payments.store');
        Route::post('/revenue/targets', [RevenueTargetController::class, 'store'])->name('revenue.targets.store');
    });
    Route::delete('/revenue/targets/{target}', [RevenueTargetController::class, 'destroy'])
        ->middleware('role:admin')->name('revenue.targets.destroy');

    // Expenses (any role can raise)
    Route::get('/expenses', [ExpenseController::class, 'index'])->name('expenses.index');
    Route::post('/expenses', [ExpenseController::class, 'store'])->name('expenses.store');
    Route::post('/expenses/{expense}/stage1', [ExpenseController::class, 'stage1'])
        ->middleware('role:accounts,admin')->name('expenses.stage1');
    Route::post('/expenses/{expense}/final', [ExpenseController::class, 'final'])
        ->middleware('role:management,admin')->name('expenses.final');

    // Stock
    Route::middleware('role:admin,site_manager')->group(function () {
        Route::get('/stock', [StockController::class, 'index'])->name('stock.index');
        Route::post('/stock/items', [StockController::class, 'storeItem'])->name('stock.items.store');
        Route::post('/stock/movements', [StockController::class, 'storeMovement'])->name('stock.movements.store');
    });

    // Users (admin only)
    Route::middleware('role:admin')->group(function () {
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
    });

    // Settings + audit
    Route::middleware('role:admin')->group(function () {
        Route::get('/settings', [SettingsController::class, 'edit'])->name('settings.index');
        Route::put('/settings', [SettingsController::class, 'update'])->name('settings.update');
    });
    Route::get('/audit', [AuditLogController::class, 'index'])
        ->middleware('role:admin,accounts,management')->name('audit.index');

    // Search
    Route::get('/search', SearchController::class)->name('search');

    // Onboarding
    Route::get('/onboarding', [OnboardingController::class, 'index'])->name('onboarding.index');
    Route::post('/onboarding/complete', [OnboardingController::class, 'complete'])->name('onboarding.complete');

    // Exports
    Route::get('/exports/units.xlsx', [ExportController::class, 'unitsXlsx'])->name('exports.units.xlsx');
    Route::get('/exports/units.pdf', [ExportController::class, 'unitsPdf'])->name('exports.units.pdf');
    Route::get('/exports/expenses.xlsx', [ExportController::class, 'expensesXlsx'])->name('exports.expenses.xlsx');
    Route::get('/exports/expenses.pdf', [ExportController::class, 'expensesPdf'])->name('exports.expenses.pdf');
    Route::get('/exports/payments.xlsx', [ExportController::class, 'paymentsXlsx'])
        ->middleware('role:admin,accounts,management')->name('exports.payments.xlsx');
    Route::get('/exports/stock.xlsx', [ExportController::class, 'stockXlsx'])
        ->middleware('role:admin,site_manager')->name('exports.stock.xlsx');

    // Imports
    Route::post('/imports/units', [ExportController::class, 'importUnits'])
        ->middleware('role:admin')->name('imports.units');
});
