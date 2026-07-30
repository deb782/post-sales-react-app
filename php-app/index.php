<?php
$page_title = 'Dashboard';
$page_heading = 'Dashboard';
require_once __DIR__ . '/includes/header.php';

// Scope projects for non-admin/accounts/management
$u = current_user();
if (in_array($u['role'], ['admin', 'accounts', 'management'], true)) {
    $projectIds = array_column(fetch_all('SELECT id FROM projects'), 'id');
} else {
    $projectIds = array_column(fetch_all('SELECT project_id AS id FROM project_user WHERE user_id = ?', [$u['id']]), 'id');
}
$ids = $projectIds ?: [0];
$ph = implode(',', array_fill(0, count($ids), '?'));

$totalUnits    = (int) fetch_one("SELECT COUNT(*) n FROM units WHERE project_id IN ($ph)", $ids)['n'];
$soldUnits     = (int) fetch_one("SELECT COUNT(*) n FROM units WHERE project_id IN ($ph) AND status='sold'", $ids)['n'];
$availUnits    = (int) fetch_one("SELECT COUNT(*) n FROM units WHERE project_id IN ($ph) AND status='available'", $ids)['n'];
$reservedUnits = (int) fetch_one("SELECT COUNT(*) n FROM units WHERE project_id IN ($ph) AND status='reserved'", $ids)['n'];

$received = (float) fetch_one("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE project_id IN ($ph)", $ids)['s'];
$accrued  = (float) fetch_one("SELECT COALESCE(SUM(price),0) s FROM units WHERE project_id IN ($ph) AND status='sold'", $ids)['s'];
$receivable = max($accrued - $received, 0);

$pending = 0;
if ($u['role'] === 'accounts' || $u['role'] === 'admin') {
    $pending = (int) fetch_one("SELECT COUNT(*) n FROM expenses WHERE project_id IN ($ph) AND stage1_status='pending'", $ids)['n'];
} elseif ($u['role'] === 'management') {
    $pending = (int) fetch_one("SELECT COUNT(*) n FROM expenses WHERE project_id IN ($ph) AND stage1_status='approved' AND final_status='pending'", $ids)['n'];
}

// Monthly revenue (last 12 months)
$monthly = fetch_all("SELECT DATE_FORMAT(paid_on, '%Y-%m') m, SUM(amount) t
    FROM payments WHERE project_id IN ($ph) AND paid_on >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
    GROUP BY m ORDER BY m", $ids);

$statusCounts = fetch_all("SELECT status, COUNT(*) n FROM units WHERE project_id IN ($ph) GROUP BY status", $ids);
?>

<div class="grid grid-4">
    <div class="kpi"><div class="kpi-label">Total Units</div><div class="kpi-value"><?= $totalUnits ?></div></div>
    <div class="kpi"><div class="kpi-label">Sold</div><div class="kpi-value ok"><?= $soldUnits ?></div></div>
    <div class="kpi"><div class="kpi-label">Available</div><div class="kpi-value amber"><?= $availUnits ?></div></div>
    <div class="kpi"><div class="kpi-label">Pending Approvals</div><div class="kpi-value bad"><?= $pending ?></div></div>
</div>

<div class="grid grid-3 mt-6">
    <div class="kpi"><div class="kpi-label">Accrued</div><div class="kpi-value"><?= inr($accrued) ?></div></div>
    <div class="kpi"><div class="kpi-label">Received</div><div class="kpi-value ok"><?= inr($received) ?></div></div>
    <div class="kpi"><div class="kpi-label">Receivable</div><div class="kpi-value amber"><?= inr($receivable) ?></div></div>
</div>

<div class="card mt-6">
    <h2>Revenue — last 12 months</h2>
    <?php if ($monthly): ?>
        <?php $max = max(array_column($monthly, 't')) ?: 1; ?>
        <div style="display:flex; align-items:flex-end; height:220px; gap:6px; margin-top:16px; padding-bottom:24px; border-bottom:1px solid #e2e8f0;">
            <?php foreach ($monthly as $m): $h = ($m['t'] / $max) * 200; ?>
                <div style="flex:1; display:flex; flex-direction:column; align-items:center;">
                    <div class="sm muted" style="margin-bottom:4px"><?= inr((float)$m['t']) ?></div>
                    <div style="width:100%; height:<?= (int)$h ?>px; background:#2f47d1; border-radius:4px 4px 0 0"></div>
                    <div class="xs muted" style="margin-top:6px"><?= e($m['m']) ?></div>
                </div>
            <?php endforeach; ?>
        </div>
    <?php else: ?>
        <p class="muted mt-4">No payments recorded yet.</p>
    <?php endif; ?>
</div>

<div class="card mt-6">
    <h2>Inventory status</h2>
    <div class="grid grid-4 mt-4">
        <?php $map = ['available' => 'green', 'reserved' => 'amber', 'sold' => 'blue', 'cancelled' => 'red'];
              $lookup = []; foreach ($statusCounts as $s) $lookup[$s['status']] = (int) $s['n'];
              foreach (['available','reserved','sold','cancelled'] as $s): ?>
            <div class="kpi">
                <div class="kpi-label"><span class="badge <?= $map[$s] ?>"><?= ucfirst($s) ?></span></div>
                <div class="kpi-value"><?= $lookup[$s] ?? 0 ?></div>
            </div>
        <?php endforeach; ?>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
