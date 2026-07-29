<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ProjectController;
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

    // Revenue / Payments
    Route::middleware('role:admin,accounts,management')->group(function () {
        Route::get('/revenue', [PaymentController::class, 'index'])->name('revenue.index');
    });
    Route::post('/payments', [PaymentController::class, 'store'])
        ->middleware('role:admin,accounts')->name('payments.store');

    // Users (admin only)
    Route::middleware('role:admin')->group(function () {
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
    });

    // Placeholders — Phase 3+
    Route::view('/expenses', 'expenses.index')->name('expenses.index');
    Route::view('/stock', 'stock.index')->name('stock.index')->middleware('role:admin,site_manager');
    Route::view('/audit', 'audit.index')->name('audit.index')->middleware('role:admin,accounts,management');
    Route::view('/settings', 'settings.index')->name('settings.index')->middleware('role:admin');
    Route::view('/onboarding', 'onboarding')->name('onboarding.index');
});
