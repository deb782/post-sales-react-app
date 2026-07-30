<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';
require_role('admin');

$showPassword = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';

    if ($action === 'invite') {
        $email = strtolower(trim($_POST['email']));
        $name = trim($_POST['name']);
        $role = $_POST['role'];
        $phone = trim($_POST['phone'] ?? '');
        $projectIds = $_POST['project_ids'] ?? [];

        $exists = fetch_one('SELECT id FROM users WHERE email = ?', [$email]);
        if ($exists) { flash_set('err', 'Email already exists.'); redirect('/users.php'); }

        $temp = random_password(12);
        q('INSERT INTO users (email, name, phone, role, password_hash, must_reset_password) VALUES (?,?,?,?,?,1)',
          [$email, $name, $phone ?: null, $role, password_hash($temp, PASSWORD_BCRYPT)]);
        $uid = last_id();
        foreach ($projectIds as $pid) {
            q('INSERT INTO project_user (project_id, user_id) VALUES (?, ?)', [(int)$pid, $uid]);
        }
        $mail = send_invite_email($email, $name, $temp, $role);
        audit('user.invite', 'user', $uid, ['email_sent' => $mail['ok']]);
        if ($mail['ok']) {
            flash_set('ok', "Invite sent to {$email}.");
        } else {
            $_SESSION['show_password'] = ['email' => $email, 'password' => $temp];
            flash_set('ok', 'User created. Email failed — see password below.');
        }
    } elseif ($action === 'reset') {
        $id = (int)$_POST['id'];
        $target = fetch_one('SELECT * FROM users WHERE id = ?', [$id]);
        if ($target) {
            $temp = random_password(12);
            q('UPDATE users SET password_hash = ?, must_reset_password = 1 WHERE id = ?',
              [password_hash($temp, PASSWORD_BCRYPT), $id]);
            q('DELETE FROM login_attempts WHERE email = ?', [$target['email']]);
            $mail = send_invite_email($target['email'], $target['name'], $temp, $target['role']);
            if (! $mail['ok']) $_SESSION['show_password'] = ['email' => $target['email'], 'password' => $temp];
            flash_set('ok', $mail['ok'] ? "Reset link emailed to {$target['email']}." : 'Password reset — see below.');
        }
    } elseif ($action === 'deactivate') {
        q('UPDATE users SET is_active = 0 WHERE id = ?', [(int)$_POST['id']]);
        flash_set('ok', 'User deactivated.');
    }
    redirect('/users.php');
}

if (! empty($_SESSION['show_password'])) {
    $showPassword = $_SESSION['show_password'];
    unset($_SESSION['show_password']);
}

$users = fetch_all('SELECT * FROM users ORDER BY created_at DESC');
$projects = fetch_all('SELECT id, name FROM projects ORDER BY name');

$page_title = 'Users';
$page_heading = 'Team & Access';
$page_actions = '<button class="btn primary" onclick="openModal(\'m-invite\')">+ Invite user</button>';
require_once __DIR__ . '/includes/header.php';
?>

<?php if ($showPassword): ?>
<div class="card mt-2 mb-4" style="border-color:#2f47d1; background:#eff6ff">
    <h3>Share this temporary password with the user</h3>
    <p><strong>Email:</strong> <?= e($showPassword['email']) ?></p>
    <p><strong>Password:</strong> <code style="background:#fff; padding:4px 8px; border-radius:4px"><?= e($showPassword['password']) ?></code></p>
    <p class="sm muted">Copy it now. It won't be shown again.</p>
</div>
<?php endif; ?>

<div class="card table-wrap" style="padding:0">
    <table class="data">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th class="right">Actions</th></tr></thead>
        <tbody>
            <?php foreach ($users as $u): ?>
                <tr>
                    <td><strong><?= e($u['name']) ?></strong></td>
                    <td><?= e($u['email']) ?></td>
                    <td>
                        <span class="badge slate"><?= str_replace('_',' ', ucwords($u['role'], '_')) ?></span>
                        <?php if ($u['must_reset_password']): ?><span class="badge amber">Reset pending</span><?php endif; ?>
                    </td>
                    <td><?= $u['is_active'] ? '<span class="badge green">Active</span>' : '<span class="badge red">Deactivated</span>' ?></td>
                    <td class="right sm">
                        <form method="post" style="display:inline">
                            <?= csrf_field() ?><input type="hidden" name="action" value="reset"><input type="hidden" name="id" value="<?= $u['id'] ?>">
                            <button class="btn sm secondary">Reset pwd</button>
                        </form>
                        <?php if ($u['is_active'] && $u['id'] != current_user()['id']): ?>
                            <form method="post" data-confirm="Deactivate <?= e($u['name']) ?>?" style="display:inline">
                                <?= csrf_field() ?><input type="hidden" name="action" value="deactivate"><input type="hidden" name="id" value="<?= $u['id'] ?>">
                                <button class="btn sm danger">Deactivate</button>
                            </form>
                        <?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div id="m-invite" class="modal-backdrop">
    <div class="modal">
        <button class="modal-close" onclick="closeModal('m-invite')">✕</button>
        <h2>Invite user</h2>
        <form method="post">
            <?= csrf_field() ?><input type="hidden" name="action" value="invite">
            <div class="form-row"><label>Email</label><input type="email" name="email" required></div>
            <div class="form-row"><label>Name</label><input name="name" required></div>
            <div class="form-row"><label>Phone (optional)</label><input name="phone"></div>
            <div class="form-row"><label>Role</label>
                <select name="role" required>
                    <option value="site_manager">Site Manager</option>
                    <option value="accounts">Accounts</option>
                    <option value="management">Management</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
            <?php if ($projects): ?>
                <div class="form-row"><label>Assign to projects (for site managers)</label>
                    <select name="project_ids[]" multiple size="4">
                        <?php foreach ($projects as $p): ?><option value="<?= $p['id'] ?>"><?= e($p['name']) ?></option><?php endforeach; ?>
                    </select>
                </div>
            <?php endif; ?>
            <p class="sm muted">A temp password is auto-generated. Sent via SMTP if configured, else shown on-screen.</p>
            <div class="form-actions"><button type="button" class="btn secondary" onclick="closeModal('m-invite')">Cancel</button><button class="btn primary">Invite</button></div>
        </form>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
