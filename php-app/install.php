<?php
// install.php — one-time database setup. Delete this file after running.

require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/functions.php';

$cfg = $GLOBALS['__config'];
$run = isset($_POST['run']);
$log = [];
$adminPw = null;

function step(array &$log, string $sql, string $label): void {
    try {
        db()->exec($sql);
        $log[] = ['ok' => true, 'msg' => $label];
    } catch (Throwable $e) {
        $log[] = ['ok' => false, 'msg' => $label . ' — ' . $e->getMessage()];
    }
}

if ($run) {
    // 1. Tables
    step($log, "CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(30) NULL,
        role ENUM('admin','accounts','management','site_manager') NOT NULL DEFAULT 'site_manager',
        password_hash VARCHAR(255) NOT NULL,
        must_reset_password TINYINT(1) NOT NULL DEFAULT 1,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        onboarding_completed TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'users table');

    step($log, "CREATE TABLE IF NOT EXISTS projects (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        project_type ENUM('residential','commercial','plot','villa','mixed') NOT NULL DEFAULT 'residential',
        developer VARCHAR(120) NULL, address VARCHAR(255) NULL,
        city VARCHAR(80) NULL, state VARCHAR(80) NULL, pincode VARCHAR(10) NULL,
        rera_number VARCHAR(80) NULL,
        start_date DATE NULL, expected_completion DATE NULL,
        total_units_planned INT UNSIGNED DEFAULT 0,
        target_revenue DECIMAL(15,2) DEFAULT 0,
        image_path VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'projects table');

    step($log, "CREATE TABLE IF NOT EXISTS project_user (
        project_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        PRIMARY KEY (project_id, user_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB", 'project_user pivot');

    step($log, "CREATE TABLE IF NOT EXISTS units (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED NOT NULL,
        unit_number VARCHAR(60) NOT NULL,
        price DECIMAL(15,2) NOT NULL DEFAULT 0,
        status ENUM('available','reserved','sold','cancelled') NOT NULL DEFAULT 'available',
        buyer_name VARCHAR(120) NULL, buyer_contact VARCHAR(80) NULL,
        sold_at DATETIME NULL, reservation_expires_at DATETIME NULL,
        attributes JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unit_num_per_project (project_id, unit_number),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'units table');

    step($log, "CREATE TABLE IF NOT EXISTS payments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED NOT NULL,
        unit_id INT UNSIGNED NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        mode ENUM('bank','cash','upi','cheque') NOT NULL DEFAULT 'bank',
        paid_on DATE NOT NULL,
        note VARCHAR(255) NULL,
        recorded_by INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
        FOREIGN KEY (recorded_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'payments table');

    step($log, "CREATE TABLE IF NOT EXISTS revenue_targets (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED NOT NULL,
        period_type ENUM('monthly','quarterly') NOT NULL,
        period_key VARCHAR(10) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        UNIQUE KEY target_key (project_id, period_type, period_key),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'revenue_targets table');

    step($log, "CREATE TABLE IF NOT EXISTS expenses (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED NOT NULL,
        category VARCHAR(80) NOT NULL,
        vendor VARCHAR(120) NULL,
        amount DECIMAL(15,2) NOT NULL,
        expense_date DATE NOT NULL,
        description TEXT NULL,
        receipt_path VARCHAR(255) NULL,
        raised_by INT UNSIGNED NOT NULL,
        stage1_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        stage1_by INT UNSIGNED NULL,
        stage1_at DATETIME NULL,
        stage1_reason TEXT NULL,
        final_status ENUM('pending','approved','rejected','not_required') NOT NULL DEFAULT 'pending',
        final_by INT UNSIGNED NULL,
        final_at DATETIME NULL,
        final_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (raised_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'expenses table');

    step($log, "CREATE TABLE IF NOT EXISTS stock_items (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED NOT NULL,
        name VARCHAR(120) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        opening DECIMAL(12,2) NOT NULL DEFAULT 0,
        UNIQUE KEY item_per_project (project_id, name),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'stock_items table');

    step($log, "CREATE TABLE IF NOT EXISTS stock_movements (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        stock_item_id INT UNSIGNED NOT NULL,
        project_id INT UNSIGNED NOT NULL,
        kind ENUM('inward','outward') NOT NULL,
        quantity DECIMAL(12,2) NOT NULL,
        moved_on DATE NOT NULL,
        note VARCHAR(255) NULL,
        recorded_by INT UNSIGNED NOT NULL,
        FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'stock_movements table');

    step($log, "CREATE TABLE IF NOT EXISTS notifications (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        kind VARCHAR(80) NOT NULL,
        message VARCHAR(500) NOT NULL,
        entity_type VARCHAR(40) NULL,
        entity_id INT UNSIGNED NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'notifications table');

    step($log, "CREATE TABLE IF NOT EXISTS audit_logs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        actor_id INT UNSIGNED NULL,
        actor_role VARCHAR(30) NULL,
        action VARCHAR(120) NOT NULL,
        entity_type VARCHAR(40) NULL,
        entity_id INT UNSIGNED NULL,
        meta JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (entity_type, entity_id),
        INDEX (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'audit_logs table');

    step($log, "CREATE TABLE IF NOT EXISTS login_attempts (
        email VARCHAR(255) PRIMARY KEY,
        count INT UNSIGNED NOT NULL DEFAULT 0,
        locked_until DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'login_attempts table');

    step($log, "CREATE TABLE IF NOT EXISTS settings (
        id INT UNSIGNED PRIMARY KEY DEFAULT 1,
        company_name VARCHAR(120) NOT NULL,
        currency VARCHAR(8) NOT NULL DEFAULT 'INR',
        threshold_amount DECIMAL(15,2) NOT NULL DEFAULT 50000,
        logo_path VARCHAR(255) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'settings table');

    // Settings row
    try {
        q('INSERT IGNORE INTO settings (id, company_name, currency, threshold_amount) VALUES (1, ?, ?, ?)',
          [$cfg['company_name'], $cfg['currency'], $cfg['threshold']]);
        $log[] = ['ok' => true, 'msg' => 'settings row'];
    } catch (Throwable $e) { $log[] = ['ok' => false, 'msg' => 'settings row — ' . $e->getMessage()]; }

    // Seed admin
    try {
        $adminEmail = $cfg['smtp_from'] ?: 'admin@example.com';
        $adminPw = random_password(14);
        $hash = password_hash($adminPw, PASSWORD_BCRYPT);
        q('INSERT INTO users (email, name, role, password_hash, must_reset_password)
           VALUES (?, ?, "admin", ?, 1)
           ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), must_reset_password = 1',
          [$adminEmail, 'Admin', $hash]);
        $log[] = ['ok' => true, 'msg' => 'admin user seeded'];
    } catch (Throwable $e) { $log[] = ['ok' => false, 'msg' => 'admin seed — ' . $e->getMessage()]; }
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Install — <?= htmlspecialchars($cfg['app_name']) ?></title>
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="login-wrap">
<div class="login-box" style="max-width:640px">
<div class="card">
    <h1>Install <?= htmlspecialchars($cfg['app_name']) ?></h1>
    <p class="muted mt-2">Creates all MySQL tables and seeds a fresh admin user.</p>

    <?php if (! $run): ?>
        <form method="post" class="mt-4">
            <p><strong>Before you click Install:</strong></p>
            <ol>
                <li>Open phpMyAdmin (<a href="http://localhost/phpmyadmin" target="_blank">localhost/phpmyadmin</a>).</li>
                <li>Create a database named <code><?= htmlspecialchars($cfg['db_name']) ?></code>
                    with collation <code>utf8mb4_unicode_ci</code>.</li>
                <li>Verify <code>config.php</code> has the right DB credentials for your machine.</li>
            </ol>
            <div class="mt-4">
                <button name="run" value="1" class="btn primary">Install now</button>
            </div>
        </form>
    <?php else: ?>
        <div class="mt-4">
        <?php foreach ($log as $l): ?>
            <div class="flash <?= $l['ok'] ? 'ok' : 'err' ?>"><?= $l['ok'] ? '✓' : '✗' ?> <?= htmlspecialchars($l['msg']) ?></div>
        <?php endforeach; ?>
        </div>

        <?php if ($adminPw): ?>
            <div class="card mt-4" style="border-color:#2f47d1; background:#eff6ff">
                <h2>Admin credentials — SAVE THESE NOW</h2>
                <p><strong>Email :</strong> <?= htmlspecialchars($cfg['smtp_from'] ?: 'admin@example.com') ?></p>
                <p><strong>Password :</strong> <code style="background:#fff; padding:4px 8px; border-radius:4px"><?= htmlspecialchars($adminPw) ?></code></p>
                <p class="muted sm mt-2">You'll be forced to set a new password on first login.</p>
                <p class="mt-4"><a class="btn primary" href="login.php">Go to Login →</a></p>
            </div>
            <div class="flash err mt-4"><strong>⚠ Delete install.php now</strong> so nobody can re-run it. Or rename it.</div>
        <?php endif; ?>
    <?php endif; ?>
</div>
</div>
</div>
</body>
</html>
