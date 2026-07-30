<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';
require_role('admin', 'site_manager');
$u = current_user();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';
    if ($action === 'add_item') {
        q('INSERT INTO stock_items (project_id, name, unit, opening) VALUES (?,?,?,?)
           ON DUPLICATE KEY UPDATE opening = VALUES(opening)',
          [(int)$_POST['project_id'], trim($_POST['name']), trim($_POST['unit']), (float)$_POST['opening']]);
        flash_set('ok', 'Item added.');
    } elseif ($action === 'movement') {
        $item = fetch_one('SELECT project_id FROM stock_items WHERE id = ?', [(int)$_POST['stock_item_id']]);
        if ($item) {
            q('INSERT INTO stock_movements (stock_item_id, project_id, kind, quantity, moved_on, note, recorded_by)
               VALUES (?,?,?,?,?,?,?)',
              [(int)$_POST['stock_item_id'], $item['project_id'], $_POST['kind'], (float)$_POST['quantity'],
               $_POST['moved_on'], $_POST['note'] ?: null, $u['id']]);
            flash_set('ok', 'Movement recorded.');
        }
    }
    redirect('/stock.php?project_id=' . (int)$_POST['project_id']);
}

$projects = has_role('admin')
    ? fetch_all('SELECT id, name FROM projects ORDER BY name')
    : fetch_all('SELECT p.id, p.name FROM projects p JOIN project_user pu ON pu.project_id=p.id WHERE pu.user_id=?', [$u['id']]);

$pid = (int) ($_GET['project_id'] ?? ($projects[0]['id'] ?? 0));
$items = $pid ? fetch_all("SELECT s.*,
    (SELECT COALESCE(SUM(quantity),0) FROM stock_movements WHERE stock_item_id=s.id AND kind='inward') AS inward,
    (SELECT COALESCE(SUM(quantity),0) FROM stock_movements WHERE stock_item_id=s.id AND kind='outward') AS outward
    FROM stock_items s WHERE s.project_id=? ORDER BY s.name", [$pid]) : [];

$page_title = 'Stock Book';
$page_heading = 'Stock Book';
$page_actions = '<button class="btn secondary" onclick="openModal(\'m-item\')">+ Add item</button>
                 <button class="btn primary" onclick="openModal(\'m-move\')">+ Record movement</button>';
require_once __DIR__ . '/includes/header.php';
?>

<form method="get" data-autosubmit class="mb-4">
    <select name="project_id">
        <?php foreach ($projects as $p): ?><option value="<?= $p['id'] ?>" <?= $pid===(int)$p['id']?'selected':'' ?>><?= e($p['name']) ?></option><?php endforeach; ?>
    </select>
</form>

<?php if (! $pid): ?>
    <div class="card empty">No project available.</div>
<?php else: ?>
    <div class="card table-wrap" style="padding:0">
        <table class="data">
            <thead><tr><th>Item</th><th>Unit</th><th>Opening</th><th>Inward</th><th>Outward</th><th>Closing</th></tr></thead>
            <tbody>
                <?php foreach ($items as $it): $closing = (float)$it['opening'] + (float)$it['inward'] - (float)$it['outward']; ?>
                    <tr>
                        <td><strong><?= e($it['name']) ?></strong></td>
                        <td><?= e($it['unit']) ?></td>
                        <td><?= number_format((float)$it['opening'], 2) ?></td>
                        <td style="color:#059669">+<?= number_format((float)$it['inward'], 2) ?></td>
                        <td style="color:#dc2626">−<?= number_format((float)$it['outward'], 2) ?></td>
                        <td><strong><?= number_format($closing, 2) ?></strong></td>
                    </tr>
                <?php endforeach; ?>
                <?php if (! $items): ?><tr><td colspan="6" class="empty">No stock items yet.</td></tr><?php endif; ?>
            </tbody>
        </table>
    </div>
<?php endif; ?>

<div id="m-item" class="modal-backdrop">
    <div class="modal">
        <button class="modal-close" onclick="closeModal('m-item')">✕</button>
        <h2>Add stock item</h2>
        <form method="post">
            <?= csrf_field() ?><input type="hidden" name="action" value="add_item"><input type="hidden" name="project_id" value="<?= $pid ?>">
            <div class="form-row"><label>Name</label><input name="name" required></div>
            <div class="form-grid">
                <div class="form-row"><label>Unit</label><input name="unit" placeholder="bag, ton, piece…" required></div>
                <div class="form-row"><label>Opening qty</label><input type="number" step="0.01" name="opening" value="0" required></div>
            </div>
            <div class="form-actions"><button type="button" class="btn secondary" onclick="closeModal('m-item')">Cancel</button><button class="btn primary">Add</button></div>
        </form>
    </div>
</div>

<div id="m-move" class="modal-backdrop">
    <div class="modal">
        <button class="modal-close" onclick="closeModal('m-move')">✕</button>
        <h2>Record movement</h2>
        <form method="post">
            <?= csrf_field() ?><input type="hidden" name="action" value="movement"><input type="hidden" name="project_id" value="<?= $pid ?>">
            <div class="form-row"><label>Item</label>
                <select name="stock_item_id" required>
                    <?php foreach ($items as $it): ?><option value="<?= $it['id'] ?>"><?= e($it['name']) ?> (<?= e($it['unit']) ?>)</option><?php endforeach; ?>
                </select>
            </div>
            <div class="form-grid">
                <div class="form-row"><label>Kind</label><select name="kind"><option value="inward">Inward</option><option value="outward">Outward</option></select></div>
                <div class="form-row"><label>Quantity</label><input type="number" step="0.01" name="quantity" required></div>
            </div>
            <div class="form-row"><label>Moved on</label><input type="date" name="moved_on" value="<?= date('Y-m-d') ?>" required></div>
            <div class="form-row"><label>Note</label><input name="note"></div>
            <div class="form-actions"><button type="button" class="btn secondary" onclick="closeModal('m-move')">Cancel</button><button class="btn primary">Record</button></div>
        </form>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
