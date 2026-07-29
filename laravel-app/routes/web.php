<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

// Public auth routes
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

// Authenticated + password-fresh + onboarded
Route::middleware(['auth', 'force.reset', 'onboarded'])->group(function () {
    Route::redirect('/', '/dashboard');
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Placeholders — filled in Phase 2+
    Route::view('/projects', 'projects.index')->name('projects.index');
    Route::view('/units', 'units.index')->name('units.index');
    Route::view('/revenue', 'revenue.index')->name('revenue.index');
    Route::view('/expenses', 'expenses.index')->name('expenses.index');
    Route::view('/stock', 'stock.index')->name('stock.index');
    Route::view('/audit', 'audit.index')->name('audit.index')->middleware('role:admin,accounts,management');
    Route::view('/users', 'users.index')->name('users.index')->middleware('role:admin');
    Route::view('/settings', 'settings.index')->name('settings.index')->middleware('role:admin');

    // Onboarding placeholder
    Route::view('/onboarding', 'onboarding')->name('onboarding.index');
});
