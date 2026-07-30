<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';
require_role('admin', 'accounts', 'management');

$actionFilter = $_GET['action'] ?? '';
$entityFilter = $_GET['entity_type'] ?? '';

$where = '1=1'; $params = [];
if ($actionFilter) { $where .= ' AND a.action LIKE ?'; $params[] = $actionFilter . '%'; }
if ($entityFilter) { $where .= ' AND a.entity_type = ?'; $params[] = $entityFilter; }

$logs = fetch_all("SELECT a.*, u.name AS actor_name
    FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
    WHERE $where ORDER BY a.created_at DESC LIMIT 300", $params);

$page_title = 'Audit Log';
$page_heading = 'Audit Log';
require_once __DIR__ . '/includes/header.php';
?>

<form method="get" class="flex mb-4" style="gap:10px; align-items:flex-end; flex-wrap:wrap">
    <div style="flex:1; min-width:220px"><label>Action starts with</label><input name="action" value="<?= e($actionFilter) ?>" placeholder="e.g. expense.stage1"></div>
    <div style="min-width:180px"><label>Entity</label>
        <select name="entity_type">
            <option value="">All entities</option>
            <?php foreach (['user','project','unit','expense','payment'] as $t): ?>
                <option value="<?= $t ?>" <?= $entityFilter===$t?'selected':'' ?>><?= ucfirst($t) ?></option>
            <?php endforeach; ?>
        </select>
    </div>
    <button class="btn secondary">Filter</button>
</form>

<div class="card table-wrap" style="padding:0">
    <table class="data">
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Meta</th></tr></thead>
        <tbody>
            <?php foreach ($logs as $l): ?>
                <tr>
                    <td class="sm"><?= date('d M Y H:i', strtotime($l['created_at'])) ?></td>
                    <td>
                        <?= e($l['actor_name'] ?? '—') ?>
                        <div class="xs muted"><?= e($l['actor_role']) ?></div>
                    </td>
                    <td><code class="sm"><?= e($l['action']) ?></code></td>
                    <td class="sm"><?= e($l['entity_type']) ?> #<?= (int)$l['entity_id'] ?></td>
                    <td class="xs muted" style="max-width:300px; word-break:break-all"><?= e($l['meta']) ?></td>
                </tr>
            <?php endforeach; ?>
            <?php if (! $logs): ?><tr><td colspan="5" class="empty">No entries.</td></tr><?php endif; ?>
        </tbody>
    </table>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
