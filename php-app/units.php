<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';
require_login();
$u = current_user();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';

    if ($action === 'add' && has_role('admin', 'accounts')) {
        q('INSERT INTO units (project_id, unit_number, price, status) VALUES (?,?,?,"available")',
          [(int)$_POST['project_id'], trim($_POST['unit_number']), (float)$_POST['price']]);
        flash_set('ok', 'Unit added.');
    } elseif ($action === 'bulk' && has_role('admin')) {
        $pid = (int) $_POST['project_id'];
        $prefix = trim($_POST['prefix']);
        $start = (int) $_POST['start']; $end = (int) $_POST['end'];
        $padding = (int) ($_POST['padding'] ?? 0);
        $price = (float) $_POST['base_price'];
        if ($end - $start + 1 > 500) flash_set('err', 'Max 500 units per batch.');
        else {
            $created = 0; $skipped = 0;
            for ($n = $start; $n <= $end; $n++) {
                $num = $prefix . ($padding ? str_pad((string)$n, $padding, '0', STR_PAD_LEFT) : (string)$n);
                $exists = fetch_one('SELECT id FROM units WHERE project_id=? AND unit_number=?', [$pid, $num]);
                if ($exists) { $skipped++; continue; }
                q('INSERT INTO units (project_id, unit_number, price, status) VALUES (?,?,?,"available")', [$pid, $num, $price]);
                $created++;
            }
            flash_set('ok', "$created units created, $skipped skipped.");
        }
    } elseif ($action === 'sell' && has_role('admin', 'accounts')) {
        q('UPDATE units SET status="sold", buyer_name=?, buyer_contact=?, price=?, sold_at=NOW() WHERE id=?',
          [trim($_POST['buyer_name']), trim($_POST['buyer_contact'] ?? ''), (float)$_POST['price'], (int)$_POST['id']]);
        flash_set('ok', 'Unit marked sold.');
    } elseif ($action === 'release' && has_role('admin', 'accounts')) {
        q('UPDATE units SET status="available", buyer_name=NULL, buyer_contact=NULL, reservation_expires_at=NULL WHERE id=?', [(int)$_POST['id']]);
        flash_set('ok', 'Released.');
    } elseif ($action === 'cancel' && has_role('admin')) {
        q('UPDATE units SET status="cancelled" WHERE id=?', [(int)$_POST['id']]);
        flash_set('ok', 'Cancelled.');
    }
    redirect('/units.php?project_id=' . (int)$_POST['project_id']);
}

$projects = in_array($u['role'], ['admin','accounts','management'], true)
    ? fetch_all('SELECT id, name FROM projects ORDER BY name')
    : fetch_all('SELECT p.id, p.name FROM projects p JOIN project_user pu ON pu.project_id=p.id WHERE pu.user_id=? ORDER BY p.name', [$u['id']]);

$projectId = (int) ($_GET['project_id'] ?? ($projects[0]['id'] ?? 0));
$status = $_GET['status'] ?? '';

$where = 'WHERE project_id = ?'; $params = [$projectId];
if ($status) { $where .= ' AND status = ?'; $params[] = $status; }
$units = $projectId ? fetch_all("SELECT * FROM units $where ORDER BY unit_number", $params) : [];

$page_title = 'Units';
$page_heading = 'Inventory';
$page_actions = '';
if (has_role('admin', 'accounts')) {
    $page_actions .= '<button class="btn sm secondary" onclick="openModal(\'m-add\')">+ Add unit</button> ';
}
if (has_role('admin')) {
    $page_actions .= '<button class="btn sm primary" onclick="openModal(\'m-bulk\')">Bulk create</button>';
}

require_once __DIR__ . '/includes/header.php';
?>

<form method="get" data-autosubmit class="flex mb-4" style="gap:8px">
    <select name="project_id">
        <?php foreach ($projects as $p): ?>
            <option value="<?= $p['id'] ?>" <?= $projectId === (int)$p['id'] ? 'selected' : '' ?>><?= e($p['name']) ?></option>
        <?php endforeach; ?>
    </select>
    <select name="status">
        <option value="">All statuses</option>
        <?php foreach (['available','reserved','sold','cancelled'] as $s): ?>
            <option value="<?= $s ?>" <?= $status === $s ? 'selected' : '' ?>><?= ucfirst($s) ?></option>
        <?php endforeach; ?>
    </select>
</form>

<div class="card table-wrap" style="padding:0">
    <?php if (! $projectId): ?>
        <div class="empty">Create a project first.</div>
    <?php elseif (! $units): ?>
        <div class="empty">No units for this filter.</div>
    <?php else: ?>
        <table class="data">
            <thead><tr><th>Unit #</th><th>Price</th><th>Status</th><th>Buyer</th><th class="right">Actions</th></tr></thead>
            <tbody>
                <?php $tone = ['available'=>'green','reserved'=>'amber','sold'=>'blue','cancelled'=>'red']; ?>
                <?php foreach ($units as $unit): ?>
                    <tr>
                        <td><strong><?= e($unit['unit_number']) ?></strong></td>
                        <td><?= inr((float)$unit['price']) ?></td>
                        <td><span class="badge <?= $tone[$unit['status']] ?>"><?= ucfirst($unit['status']) ?></span></td>
                        <td class="sm muted"><?= e($unit['buyer_name'] ?: '—') ?></td>
                        <td class="right">
                            <?php if ($unit['status']==='available' && has_role('admin','accounts')): ?>
                                <button class="btn sm secondary"
                                    onclick="document.getElementById('sell-id').value=<?= $unit['id'] ?>;
                                             document.getElementById('sell-num').textContent='<?= e($unit['unit_number']) ?>';
                                             document.getElementById('sell-price').value=<?= (float)$unit['price'] ?>;
                                             openModal('m-sell')">Sell</button>
                            <?php elseif ($unit['status']==='reserved' && has_role('admin','accounts')): ?>
                                <form method="post" style="display:inline">
                                    <?= csrf_field() ?><input type="hidden" name="project_id" value="<?= $projectId ?>">
                                    <input type="hidden" name="action" value="release"><input type="hidden" name="id" value="<?= $unit['id'] ?>">
                                    <button class="btn sm secondary">Release</button>
                                </form>
                            <?php elseif ($unit['status']==='sold' && has_role('admin')): ?>
                                <form method="post" data-confirm="Cancel this sold unit?" style="display:inline">
                                    <?= csrf_field() ?><input type="hidden" name="project_id" value="<?= $projectId ?>">
                                    <input type="hidden" name="action" value="cancel"><input type="hidden" name="id" value="<?= $unit['id'] ?>">
                                    <button class="btn sm danger">Cancel</button>
                                </form>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
</div>

<?php if ($projectId && has_role('admin', 'accounts')): ?>
<div id="m-add" class="modal-backdrop">
    <div class="modal">
        <button class="modal-close" onclick="closeModal('m-add')">✕</button>
        <h2>Add unit</h2>
        <form method="post">
            <?= csrf_field() ?><input type="hidden" name="action" value="add"><input type="hidden" name="project_id" value="<?= $projectId ?>">
            <div class="form-row"><label>Unit number</label><input name="unit_number" required></div>
            <div class="form-row"><label>Price (₹)</label><input type="number" step="0.01" name="price" required></div>
            <div class="form-actions"><button type="button" class="btn secondary" onclick="closeModal('m-add')">Cancel</button><button class="btn primary">Add</button></div>
        </form>
    </div>
</div>

<div id="m-sell" class="modal-backdrop">
    <div class="modal">
        <button class="modal-close" onclick="closeModal('m-sell')">✕</button>
        <h2>Sell unit <span id="sell-num"></span></h2>
        <form method="post">
            <?= csrf_field() ?><input type="hidden" name="action" value="sell"><input type="hidden" name="project_id" value="<?= $projectId ?>">
            <input type="hidden" id="sell-id" name="id">
            <div class="form-row"><label>Buyer name</label><input name="buyer_name" required></div>
            <div class="form-row"><label>Buyer contact</label><input name="buyer_contact"></div>
            <div class="form-row"><label>Final price (₹)</label><input type="number" step="0.01" id="sell-price" name="price" required></div>
            <div class="form-actions"><button type="button" class="btn secondary" onclick="closeModal('m-sell')">Cancel</button><button class="btn primary">Confirm sale</button></div>
        </form>
    </div>
</div>
<?php endif; ?>

<?php if ($projectId && has_role('admin')): ?>
<div id="m-bulk" class="modal-backdrop">
    <div class="modal">
        <button class="modal-close" onclick="closeModal('m-bulk')">✕</button>
        <h2>Bulk create units</h2>
        <form method="post">
            <?= csrf_field() ?><input type="hidden" name="action" value="bulk"><input type="hidden" name="project_id" value="<?= $projectId ?>">
            <div class="form-row"><label>Prefix (e.g. A-)</label><input name="prefix" required></div>
            <div class="form-grid">
                <div class="form-row"><label>Start</label><input type="number" name="start" required></div>
                <div class="form-row"><label>End</label><input type="number" name="end" required></div>
                <div class="form-row"><label>Padding</label><input type="number" name="padding" value="0"></div>
                <div class="form-row"><label>Base price (₹)</label><input type="number" step="0.01" name="base_price" required></div>
            </div>
            <p class="sm muted">Max 500 per batch. Duplicates skipped.</p>
            <div class="form-actions"><button type="button" class="btn secondary" onclick="closeModal('m-bulk')">Cancel</button><button class="btn primary">Create</button></div>
        </form>
    </div>
</div>
<?php endif; ?>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
