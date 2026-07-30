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
$adminEmail = $cfg['smtp_from'] ?? 'admin@yourcompany.com';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in — <?= e($cfg['app_name']) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= url('assets/style.css') ?>">
</head>
<body>
<div class="login-page">
    <div class="login-card">
        <div class="login-eyebrow">Sign In</div>
        <h1 class="login-heading">Welcome back</h1>
        <p class="login-lead">
            Use the email and temporary password shared by your administrator.
            You'll be asked to set a new password on first login.
        </p>

        <?php if ($err): ?><div class="login-error"><?= e($err) ?></div><?php endif; ?>

        <form method="post" class="login-form">
            <?= csrf_field() ?>
            <div class="form-row">
                <label>Email</label>
                <input type="email" name="email" value="<?= old('email') ?>" required autofocus>
            </div>
            <div class="form-row">
                <label>Password</label>
                <div class="password-wrap">
                    <input type="password" id="pw" name="password" required>
                    <button type="button" class="toggle-eye" onclick="var i=document.getElementById('pw');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'👁':'🙈'">👁</button>
                </div>
            </div>
            <button type="submit" class="login-btn">Sign in</button>
        </form>

        <div class="login-info">
            <strong>First-time admins</strong>
            <p>System-seeded admin: <code><?= e($adminEmail) ?></code> — you'll be prompted to change the password immediately.</p>
        </div>
    </div>
</div>
</body>
</html>
