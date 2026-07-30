<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';

if (is_logged_in()) redirect('index.php');

$err = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $r = attempt_login($_POST['email'] ?? '', $_POST['password'] ?? '');
    if ($r['ok']) {
        if ($r['user']['must_reset_password']) redirect('reset-password.php');
        redirect('index.php');
    }
    $err = $r['msg'];
}
$cfg = $GLOBALS['__config'];
$initials = strtoupper(substr($cfg['company_name'], 0, 2));
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in — <?= e($cfg['app_name']) ?></title>
    <link rel="stylesheet" href="<?= url('assets/style.css') ?>">
</head>
<body>
<div class="login-page">
    <div class="login-card">
        <div class="login-logo"><?= e($initials) ?></div>
        <div class="login-title">
            <h1><?= e($cfg['company_name']) ?></h1>
            <p>Sign in to your estate dashboard</p>
        </div>

        <?php if ($err): ?><div class="login-error"><?= e($err) ?></div><?php endif; ?>

        <form method="post">
            <?= csrf_field() ?>
            <div class="form-row">
                <label>Email address</label>
                <input type="email" name="email" value="<?= old('email') ?>" required autofocus placeholder="you@company.com">
            </div>
            <div class="form-row">
                <label>Password</label>
                <input type="password" name="password" required placeholder="Your password">
            </div>
            <button type="submit" class="login-btn">Sign in →</button>
        </form>
    </div>
    <p class="login-hint" style="position:absolute; bottom: 20px; left: 0; right: 0;">
        Trouble signing in? Ask your admin to reset your password.
    </p>
</div>
</body>
</html>
