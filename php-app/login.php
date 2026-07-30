<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';

if (is_logged_in()) redirect('/index.php');

$err = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $r = attempt_login($_POST['email'] ?? '', $_POST['password'] ?? '');
    if ($r['ok']) {
        if ($r['user']['must_reset_password']) redirect('/reset-password.php');
        redirect('/index.php');
    }
    $err = $r['msg'];
}
$cfg = $GLOBALS['__config'];
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in — <?= e($cfg['app_name']) ?></title>
    <link rel="stylesheet" href="<?= url('assets/style.css') ?>">
</head>
<body>
<div class="login-wrap">
    <div class="login-box">
        <div class="login-title">
            <h1><?= e($cfg['company_name']) ?></h1>
            <p>Sign in to your dashboard</p>
        </div>
        <div class="card">
            <?php if ($err): ?><div class="flash err mb-4"><?= e($err) ?></div><?php endif; ?>
            <form method="post">
                <?= csrf_field() ?>
                <div class="form-row">
                    <label>Email</label>
                    <input type="email" name="email" value="<?= old('email') ?>" required autofocus>
                </div>
                <div class="form-row">
                    <label>Password</label>
                    <input type="password" name="password" required>
                </div>
                <button class="btn primary" style="width:100%;justify-content:center">Sign in</button>
            </form>
        </div>
        <p class="muted xs" style="text-align:center;margin-top:16px">Trouble signing in? Ask your admin to reset your password.</p>
    </div>
</div>
</body>
</html>
