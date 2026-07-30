<?php
// includes/auth.php  —  Sessions, login, role gates.

require_once __DIR__ . '/db.php';

if (session_status() === PHP_SESSION_NONE) {
    session_name($GLOBALS['__config']['session_name']);
    session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 7, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

// ---------- Auto-detect base URL from the current request ----------
// This means you never have to edit base_url in config.php.
function auto_base_url(): string {
    $cfg = $GLOBALS['__config'];
    if (! empty($cfg['base_url']) && strpos($cfg['base_url'], 'localhost/realestate') === false) {
        return rtrim($cfg['base_url'], '/');
    }
    $scheme = (! empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    // Script name is like /laravel-app/login.php  →  we want /laravel-app
    $script = $_SERVER['SCRIPT_NAME'] ?? '/';
    $dir = rtrim(str_replace('\\', '/', dirname($script)), '/');
    return $scheme . '://' . $host . $dir;
}

function url(string $path = ''): string {
    return auto_base_url() . '/' . ltrim($path, '/');
}

function redirect(string $path): void {
    header('Location: ' . url($path));
    exit;
}

// ---------- Session helpers ----------
function current_user(): ?array {
    if (! isset($_SESSION['user_id'])) return null;
    static $cache = null;
    if ($cache && $cache['id'] === $_SESSION['user_id']) return $cache;
    $u = fetch_one('SELECT * FROM users WHERE id = ? AND is_active = 1', [$_SESSION['user_id']]);
    if (! $u) { logout(); return null; }
    return $cache = $u;
}

function is_logged_in(): bool { return current_user() !== null; }

function has_role(string ...$roles): bool {
    $u = current_user();
    return $u && in_array($u['role'], $roles, true);
}

// ---------- Guards ----------
function require_login(): void {
    $u = current_user();
    if (! $u) redirect('login.php');
    if ($u['must_reset_password']) {
        $script = basename($_SERVER['SCRIPT_NAME']);
        if (! in_array($script, ['reset-password.php', 'logout.php'], true)) redirect('reset-password.php');
    }
}

function require_role(string ...$roles): void {
    require_login();
    if (! has_role(...$roles)) {
        http_response_code(403);
        die('<div style="font-family:sans-serif;padding:40px;"><h1>403 Forbidden</h1><p>You don\'t have permission to access this page.</p><p><a href="' . url('index.php') . '">← Back to dashboard</a></p></div>');
    }
}

// ---------- Auth actions ----------
function attempt_login(string $email, string $password): array {
    $email = strtolower(trim($email));
    $la = fetch_one('SELECT * FROM login_attempts WHERE email = ?', [$email]);
    if ($la && $la['locked_until'] && strtotime($la['locked_until']) > time()) {
        $mins = ceil((strtotime($la['locked_until']) - time()) / 60);
        return ['ok' => false, 'msg' => "Too many attempts. Try again in {$mins} min."];
    }
    $u = fetch_one('SELECT * FROM users WHERE email = ? AND is_active = 1', [$email]);
    if (! $u || ! password_verify($password, $u['password_hash'])) {
        $count = ($la['count'] ?? 0) + 1;
        if ($la) {
            q('UPDATE login_attempts SET count = ?, locked_until = ? WHERE email = ?',
              [$count, $count >= 5 ? date('Y-m-d H:i:s', time() + 900) : null, $email]);
        } else {
            q('INSERT INTO login_attempts (email, count, locked_until) VALUES (?, ?, NULL)', [$email, $count]);
        }
        return ['ok' => false, 'msg' => 'Invalid email or password.'];
    }
    q('DELETE FROM login_attempts WHERE email = ?', [$email]);
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $u['id'];
    return ['ok' => true, 'user' => $u];
}

function logout(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

// ---------- CSRF ----------
function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function csrf_field(): string { return '<input type="hidden" name="_csrf" value="' . csrf_token() . '">'; }
function csrf_check(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') return;
    if (! hash_equals($_SESSION['csrf'] ?? '', $_POST['_csrf'] ?? '')) {
        http_response_code(419); die('CSRF token mismatch. Refresh and try again.');
    }
}

// ---------- Audit ----------
function audit(string $action, string $entityType = null, int $entityId = null, array $meta = []): void {
    $u = current_user();
    q('INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, meta, created_at) VALUES (?,?,?,?,?,?,NOW())',
      [$u['id'] ?? null, $u['role'] ?? null, $action, $entityType, $entityId, $meta ? json_encode($meta) : null]);
}
