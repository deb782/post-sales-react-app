<?php
$page_title = 'Dashboard';
$page_eyebrow = 'Overview';
$page_heading = 'Welcome back';
require_once __DIR__ . '/includes/header.php';

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

$monthly = fetch_all("SELECT DATE_FORMAT(paid_on, '%Y-%m') m, SUM(amount) t
    FROM payments WHERE project_id IN ($ph) AND paid_on >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
    GROUP BY m ORDER BY m", $ids);

$totalProjects = (int) fetch_one("SELECT COUNT(*) n FROM projects")['n'];
?>

<div class="grid grid-4">
    <div class="kpi">
        <div class="kpi-label">Projects</div>
        <div class="kpi-value"><?= $totalProjects ?></div>
        <div class="kpi-sub">Across all types</div>
    </div>
    <div class="kpi">
        <div class="kpi-label">Total Units</div>
        <div class="kpi-value"><?= $totalUnits ?></div>
        <div class="kpi-sub"><?= $availUnits ?> available · <?= $reservedUnits ?> reserved</div>
    </div>
    <div class="kpi">
        <div class="kpi-label">Units Sold</div>
        <div class="kpi-value ok"><?= $soldUnits ?></div>
        <div class="kpi-sub"><?= $totalUnits ? round(($soldUnits/$totalUnits)*100, 1) : 0 ?>% of inventory</div>
    </div>
    <div class="kpi">
        <div class="kpi-label">Pending Approvals</div>
        <div class="kpi-value <?= $pending>0?'bad':'' ?>"><?= $pending ?></div>
        <div class="kpi-sub">Awaiting your action</div>
    </div>
</div>

<div class="grid grid-3 mt-6">
    <div class="kpi">
        <div class="kpi-label">Accrued Revenue</div>
        <div class="kpi-value"><?= inr($accrued) ?></div>
        <div class="kpi-sub">Sum of sold-unit prices</div>
    </div>
    <div class="kpi">
        <div class="kpi-label">Received</div>
        <div class="kpi-value ok"><?= inr($received) ?></div>
        <div class="kpi-sub">Payments recorded</div>
    </div>
    <div class="kpi">
        <div class="kpi-label">Receivable</div>
        <div class="kpi-value amber"><?= inr($receivable) ?></div>
        <div class="kpi-sub">Accrued − Received</div>
    </div>
</div>

<div class="card mt-6">
    <div class="flex between mb-4">
        <div>
            <div class="eyebrow" style="margin-bottom:4px">Revenue</div>
            <h2>Last 12 months</h2>
        </div>
        <a href="<?= url('payments.php') ?>" class="btn sm secondary">View payments →</a>
    </div>
    <?php if ($monthly): ?>
        <?php $max = max(array_column($monthly, 't')) ?: 1; ?>
        <div class="revenue-chart">
            <?php foreach ($monthly as $m): $h = ($m['t'] / $max) * 200; ?>
                <div class="revenue-bar">
                    <div class="amount"><?= inr((float)$m['t']) ?></div>
                    <div class="bar" style="height:<?= (int)$h ?>px"></div>
                    <div class="month"><?= e($m['m']) ?></div>
                </div>
            <?php endforeach; ?>
        </div>
    <?php else: ?>
        <p class="empty">No payments recorded yet. <a href="<?= url('payments.php') ?>">Record your first payment →</a></p>
    <?php endif; ?>
</div>

<div class="card mt-6">
    <div class="eyebrow" style="margin-bottom:4px">Inventory</div>
    <h2 class="mb-4">Status breakdown</h2>
    <div class="grid grid-4">
        <?php $stats = [
            ['available','green','Available',$availUnits],
            ['reserved','amber','Reserved',$reservedUnits],
            ['sold','blue','Sold',$soldUnits],
            ['cancelled','red','Cancelled',$totalUnits-$soldUnits-$availUnits-$reservedUnits],
        ]; ?>
        <?php foreach ($stats as [$s, $tone, $label, $n]): ?>
            <div class="kpi">
                <div class="kpi-label"><span class="badge <?= $tone ?>"><?= $label ?></span></div>
                <div class="kpi-value"><?= max(0, $n) ?></div>
            </div>
        <?php endforeach; ?>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
