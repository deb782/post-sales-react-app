<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';
require_role('admin', 'accounts', 'management');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (! has_role('admin', 'accounts')) { http_response_code(403); die('Forbidden'); }
    $unit = fetch_one('SELECT id, project_id FROM units WHERE id = ?', [(int)$_POST['unit_id']]);
    if ($unit) {
        q('INSERT INTO payments (project_id, unit_id, amount, mode, paid_on, note, recorded_by) VALUES (?,?,?,?,?,?,?)',
          [$unit['project_id'], $unit['id'], (float)$_POST['amount'], $_POST['mode'], $_POST['paid_on'], $_POST['note'] ?: null, current_user()['id']]);
        audit('payment.create', 'payment', last_id(), ['amount' => (float)$_POST['amount']]);
        flash_set('ok', 'Payment recorded.');
    }
    redirect('/payments.php' . (! empty($_GET['project_id']) ? '?project_id=' . (int)$_GET['project_id'] : ''));
}

$pid = (int) ($_GET['project_id'] ?? 0);
$projects = fetch_all('SELECT id, name FROM projects ORDER BY name');

$where = ''; $params = [];
if ($pid) { $where = 'WHERE p.project_id = ?'; $params[] = $pid; }

$payments = fetch_all("SELECT p.*, u.unit_number, pr.name AS project_name
    FROM payments p LEFT JOIN units u ON u.id = p.unit_id LEFT JOIN projects pr ON pr.id = p.project_id
    $where ORDER BY p.paid_on DESC LIMIT 200", $params);

$w2 = $pid ? 'WHERE project_id = ?' : '';
$p2 = $pid ? [$pid] : [];
$accrued = (float) fetch_one("SELECT COALESCE(SUM(price),0) s FROM units $w2 " . ($pid ? "AND" : "WHERE") . " status='sold'", $p2)['s'];
$received = (float) fetch_one("SELECT COALESCE(SUM(amount),0) s FROM payments $w2", $p2)['s'];
$receivable = max($accrued - $received, 0);

$soldUnits = fetch_all("SELECT u.id, u.unit_number, pr.name AS pn FROM units u JOIN projects pr ON pr.id=u.project_id WHERE u.status='sold' ORDER BY u.unit_number");

$page_title = 'Revenue';
$page_heading = 'Revenue & Payments';
$page_actions = has_role('admin', 'accounts')
    ? '<button class="btn primary" onclick="openModal(\'m-pay\')">+ Record payment</button>' : '';
require_once __DIR__ . '/includes/header.php';
?>

<form method="get" data-autosubmit class="mb-4">
    <select name="project_id">
        <option value="">All projects</option>
        <?php foreach ($projects as $p): ?>
            <option value="<?= $p['id'] ?>" <?= $pid === (int)$p['id'] ? 'selected' : '' ?>><?= e($p['name']) ?></option>
        <?php endforeach; ?>
    </select>
</form>

<div class="grid grid-3">
    <div class="kpi"><div class="kpi-label">Accrued</div><div class="kpi-value"><?= inr($accrued) ?></div></div>
    <div class="kpi"><div class="kpi-label">Received</div><div class="kpi-value ok"><?= inr($received) ?></div></div>
    <div class="kpi"><div class="kpi-label">Receivable</div><div class="kpi-value amber"><?= inr($receivable) ?></div></div>
</div>

<div class="card mt-6 table-wrap" style="padding:0">
    <table class="data">
        <thead><tr><th>Date</th><th>Project</th><th>Unit</th><th>Mode</th><th>Amount</th><th>Note</th></tr></thead>
        <tbody>
            <?php foreach ($payments as $p): ?>
                <tr>
                    <td><?= date('d M Y', strtotime($p['paid_on'])) ?></td>
                    <td><?= e($p['project_name']) ?></td>
                    <td><?= e($p['unit_number'] ?? '—') ?></td>
                    <td><span class="badge slate"><?= strtoupper($p['mode']) ?></span></td>
                    <td><strong><?= inr((float)$p['amount']) ?></strong></td>
                    <td class="sm muted"><?= e($p['note']) ?></td>
                </tr>
            <?php endforeach; ?>
            <?php if (! $payments): ?><tr><td colspan="6" class="empty">No payments yet.</td></tr><?php endif; ?>
        </tbody>
    </table>
</div>

<?php if (has_role('admin', 'accounts')): ?>
<div id="m-pay" class="modal-backdrop">
    <div class="modal">
        <button class="modal-close" onclick="closeModal('m-pay')">✕</button>
        <h2>Record payment</h2>
        <form method="post">
            <?= csrf_field() ?>
            <div class="form-row">
                <label>Unit (sold)</label>
                <select name="unit_id" required>
                    <option value="">— select —</option>
                    <?php foreach ($soldUnits as $u): ?>
                        <option value="<?= $u['id'] ?>"><?= e($u['unit_number']) ?> (<?= e($u['pn']) ?>)</option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-grid">
                <div class="form-row"><label>Amount (₹)</label><input type="number" step="0.01" name="amount" required></div>
                <div class="form-row"><label>Mode</label>
                    <select name="mode"><option value="bank">Bank</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="cheque">Cheque</option></select>
                </div>
            </div>
            <div class="form-row"><label>Paid on</label><input type="date" name="paid_on" value="<?= date('Y-m-d') ?>" required></div>
            <div class="form-row"><label>Note</label><input name="note"></div>
            <div class="form-actions"><button type="button" class="btn secondary" onclick="closeModal('m-pay')">Cancel</button><button class="btn primary">Record</button></div>
        </form>
    </div>
</div>
<?php endif; ?>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
