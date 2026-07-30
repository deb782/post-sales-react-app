<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';
require_login();

$err = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $u = current_user();
    $current = $_POST['current_password'] ?? '';
    $new = $_POST['password'] ?? '';
    $confirm = $_POST['password_confirmation'] ?? '';

    if (! password_verify($current, $u['password_hash'])) $err = 'Current password is incorrect.';
    elseif (strlen($new) < 8) $err = 'Password must be at least 8 characters.';
    elseif (! preg_match('/[A-Za-z]/', $new) || ! preg_match('/[0-9]/', $new)) $err = 'Password must include letters and numbers.';
    elseif ($new !== $confirm) $err = 'Passwords do not match.';
    elseif (password_verify($new, $u['password_hash'])) $err = 'New password must differ from current.';
    else {
        q('UPDATE users SET password_hash = ?, must_reset_password = 0 WHERE id = ?',
          [password_hash($new, PASSWORD_BCRYPT), $u['id']]);
        flash_set('ok', 'Password updated.');
        redirect('index.php');
    }
}
$cfg = $GLOBALS['__config'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Set new password — <?= e($cfg['app_name']) ?></title>
    <link rel="stylesheet" href="<?= url('assets/style.css') ?>">
</head>
<body>
<div class="login-page">
    <div class="login-card">
        <div class="login-logo">🔒</div>
        <div class="login-title">
            <h1>Set a new password</h1>
            <p>Required before you can use the dashboard.</p>
        </div>

        <?php if ($err): ?><div class="login-error"><?= e($err) ?></div><?php endif; ?>

        <form method="post">
            <?= csrf_field() ?>
            <div class="form-row"><label>Current (temp) password</label><input type="password" name="current_password" required autofocus></div>
            <div class="form-row"><label>New password</label><input type="password" name="password" required></div>
            <div class="form-row"><label>Confirm new password</label><input type="password" name="password_confirmation" required></div>
            <button type="submit" class="login-btn">Update password</button>
        </form>
    </div>
</div>
</body>
</html>
