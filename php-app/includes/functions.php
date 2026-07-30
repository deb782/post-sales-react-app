<?php
// includes/functions.php  —  Small helpers.

function e(?string $s): string { return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8'); }

function inr(float $n): string { return '₹' . number_format($n); }

function old(string $key, $default = ''): string {
    return e($_POST[$key] ?? $default);
}

function flash_set(string $key, string $msg): void { $_SESSION['flash'][$key] = $msg; }

function flash_get(string $key): ?string {
    if (! isset($_SESSION['flash'][$key])) return null;
    $m = $_SESSION['flash'][$key];
    unset($_SESSION['flash'][$key]);
    return $m;
}

function random_password(int $length = 12): string {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    $out = '';
    for ($i = 0; $i < $length; $i++) $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    return $out;
}

function send_invite_email(string $to, string $name, string $tempPassword, string $role): array {
    $cfg = $GLOBALS['__config'];
    if (empty($cfg['smtp_pass'])) return ['ok' => false, 'msg' => 'SMTP not configured — show password on screen.'];

    // Simple SMTP without external libraries
    $loginUrl = $cfg['base_url'] . '/login.php';
    $subject  = $cfg['app_name'] . " — you're invited";
    $body = "Hi {$name},\r\n\r\n"
          . "You've been invited to " . $cfg['app_name'] . " as " . str_replace('_', ' ', ucwords($role, '_')) . ".\r\n\r\n"
          . "Login URL : {$loginUrl}\r\n"
          . "Email     : {$to}\r\n"
          . "Password  : {$tempPassword}\r\n\r\n"
          . "You'll be asked to set a new password on first login.\r\n\r\n"
          . "— " . $cfg['smtp_name'] . "\r\n";

    // Use PHP's mail() — works if the server is configured. For real reliability
    // configure sendmail in php.ini. For now we return ok=false so users see the
    // password on-screen. Replace this with a proper SMTP call in production.
    $headers = "From: " . $cfg['smtp_name'] . " <" . $cfg['smtp_from'] . ">\r\n"
             . "Reply-To: " . $cfg['smtp_from'] . "\r\n"
             . "X-Mailer: PHP/" . phpversion();
    $sent = @mail($to, $subject, $body, $headers);
    return ['ok' => (bool) $sent, 'msg' => $sent ? 'Sent.' : 'mail() returned false — show password on screen.'];
}

function upload_file(string $field, string $subdir, array $allowedExt): ?string {
    if (empty($_FILES[$field]['name']) || $_FILES[$field]['error'] !== UPLOAD_ERR_OK) return null;
    $ext = strtolower(pathinfo($_FILES[$field]['name'], PATHINFO_EXTENSION));
    if (! in_array($ext, $allowedExt, true)) return null;
    $name = uniqid('', true) . '.' . $ext;
    $dir = __DIR__ . '/../uploads/' . $subdir;
    if (! is_dir($dir)) mkdir($dir, 0775, true);
    $dest = $dir . '/' . $name;
    if (! move_uploaded_file($_FILES[$field]['tmp_name'], $dest)) return null;
    return "uploads/{$subdir}/{$name}";
}
