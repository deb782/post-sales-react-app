<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';
require_login();
$u = current_user();

$threshold = (float) fetch_one('SELECT threshold_amount FROM settings WHERE id=1')['threshold_amount'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';

    if ($action === 'raise') {
        $amount = (float) $_POST['amount'];
        $receipt = upload_file('receipt', 'receipts', ['pdf','jpg','jpeg','png','webp']);
        q('INSERT INTO expenses (project_id, category, vendor, amount, expense_date, description, receipt_path, raised_by, final_status)
           VALUES (?,?,?,?,?,?,?,?,?)',
           [(int)$_POST['project_id'], $_POST['category'], $_POST['vendor'] ?: null, $amount, $_POST['expense_date'],
            $_POST['description'] ?: null, $receipt, $u['id'],
            $amount > $threshold ? 'pending' : 'not_required']);
        $eid = last_id();
        audit('expense.raise', 'expense', $eid, ['amount' => $amount]);
        // notify accounts users
        foreach (fetch_all("SELECT id FROM users WHERE role='accounts' AND is_active=1") as $a) {
            q('INSERT INTO notifications (user_id, kind, message, entity_type, entity_id) VALUES (?,?,?,?,?)',
              [$a['id'], 'expense_pending', "Expense of ₹" . number_format($amount) . " needs stage-1 approval.", 'expense', $eid]);
        }
        flash_set('ok', 'Expense raised.');
    } elseif ($action === 'stage1' && has_role('accounts', 'admin')) {
        $id = (int)$_POST['id'];
        $dec = $_POST['decision'];
        $reason = $_POST['reason'] ?? '';
        if ($dec === 'rejected' && ! $reason) { flash_set('err', 'Reason required for rejection.'); redirect('/expenses.php'); }
        q('UPDATE expenses SET stage1_status=?, stage1_by=?, stage1_at=NOW(), stage1_reason=? WHERE id=?',
          [$dec, $u['id'], $reason ?: null, $id]);
        audit("expense.stage1.$dec", 'expense', $id, ['reason' => $reason]);
        flash_set('ok', 'Stage-1 decision saved.');
    } elseif ($action === 'final' && has_role('management', 'admin')) {
        $id = (int)$_POST['id'];
        $dec = $_POST['decision'];
        $reason = $_POST['reason'] ?? '';
        if ($dec === 'rejected' && ! $reason) { flash_set('err', 'Reason required.'); redirect('/expenses.php'); }
        q('UPDATE expenses SET final_status=?, final_by=?, final_at=NOW(), final_reason=? WHERE id=?',
          [$dec, $u['id'], $reason ?: null, $id]);
        audit("expense.final.$dec", 'expense', $id, ['reason' => $reason]);
        flash_set('ok', 'Final decision saved.');
    }
    redirect('/expenses.php');
}

$status = $_GET['status'] ?? '';
$where = '1=1'; $params = [];
if ($status === 'pending')   { $where = "stage1_status='pending'"; }
elseif ($status === 'stage2') { $where = "stage1_status='approved' AND final_status='pending'"; }
elseif ($status === 'approved') { $where = "stage1_status='approved' AND final_status IN ('approved','not_required')"; }
elseif ($status === 'rejected') { $where = "stage1_status='rejected' OR final_status='rejected'"; }

$expenses = fetch_all("SELECT e.*, p.name AS project_name, r.name AS raiser_name
    FROM expenses e LEFT JOIN projects p ON p.id=e.project_id LEFT JOIN users r ON r.id=e.raised_by
    WHERE $where ORDER BY e.created_at DESC LIMIT 200", $params);

$projects = fetch_all('SELECT id, name FROM projects ORDER BY name');

$page_title = 'Expenses';
$page_heading = 'Expenses';
$page_actions = '<button class="btn primary" onclick="openModal(\'m-raise\')">+ Raise expense</button>';
require_once __DIR__ . '/includes/header.php';
?>

<form method="get" data-autosubmit class="mb-4">
    <select name="status">
        <option value="">All</option>
        <option value="pending" <?= $status==='pending'?'selected':'' ?>>Awaiting Stage 1</option>
        <option value="stage2" <?= $status==='stage2'?'selected':'' ?>>Awaiting Final</option>
        <option value="approved" <?= $status==='approved'?'selected':'' ?>>Approved</option>
        <option value="rejected" <?= $status==='rejected'?'selected':'' ?>>Rejected</option>
    </select>
</form>

<div class="card table-wrap" style="padding:0">
    <table class="data">
        <thead><tr><th>Date</th><th>Project</th><th>Cat / Vendor</th><th>Amount</th><th>Raised by</th><th>Stage 1</th><th>Final</th><th class="right">Actions</th></tr></thead>
        <tbody>
            <?php $tone = ['pending'=>'amber','approved'=>'green','rejected'=>'red','not_required'=>'slate']; ?>
            <?php foreach ($expenses as $e): ?>
                <tr>
                    <td><?= date('d M Y', strtotime($e['expense_date'])) ?></td>
                    <td><?= e($e['project_name']) ?></td>
                    <td>
                        <strong><?= e($e['category']) ?></strong>
                        <div class="sm muted"><?= e($e['vendor']) ?></div>
                    </td>
                    <td>
                        <strong><?= inr((float)$e['amount']) ?></strong>
                        <?php if ((float)$e['amount'] > $threshold): ?><div><span class="badge amber">Needs final</span></div><?php endif; ?>
                    </td>
                    <td class="sm"><?= e($e['raiser_name']) ?></td>
                    <td>
                        <span class="badge <?= $tone[$e['stage1_status']] ?>"><?= ucfirst($e['stage1_status']) ?></span>
                        <?php if ($e['stage1_reason']): ?><div class="xs" style="color:#dc2626"><?= e($e['stage1_reason']) ?></div><?php endif; ?>
                    </td>
                    <td>
                        <span class="badge <?= $tone[$e['final_status']] ?>"><?= str_replace('_',' ', ucfirst($e['final_status'])) ?></span>
                        <?php if ($e['final_reason']): ?><div class="xs" style="color:#dc2626"><?= e($e['final_reason']) ?></div><?php endif; ?>
                    </td>
                    <td class="right sm">
                        <?php if ($e['receipt_path']): ?>
                            <a href="<?= url($e['receipt_path']) ?>" target="_blank">Receipt</a>
                        <?php endif; ?>
                        <?php if ($e['stage1_status']==='pending' && has_role('accounts','admin')): ?>
                            <button class="btn sm secondary" onclick="actExp(<?= $e['id'] ?>, 1)">Act</button>
                        <?php elseif ($e['stage1_status']==='approved' && $e['final_status']==='pending' && has_role('management','admin')): ?>
                            <button class="btn sm secondary" onclick="actExp(<?= $e['id'] ?>, 2)">Act</button>
                        <?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; ?>
            <?php if (! $expenses): ?><tr><td colspan="8" class="empty">No expenses.</td></tr><?php endif; ?>
        </tbody>
    </table>
</div>

<div id="m-raise" class="modal-backdrop">
    <div class="modal">
        <button class="modal-close" onclick="closeModal('m-raise')">✕</button>
        <h2>Raise expense</h2>
        <form method="post" enctype="multipart/form-data">
            <?= csrf_field() ?><input type="hidden" name="action" value="raise">
            <div class="form-row"><label>Project</label>
                <select name="project_id" required>
                    <?php foreach ($projects as $p): ?><option value="<?= $p['id'] ?>"><?= e($p['name']) ?></option><?php endforeach; ?>
                </select>
            </div>
            <div class="form-grid">
                <div class="form-row"><label>Category</label><input name="category" required></div>
                <div class="form-row"><label>Vendor</label><input name="vendor"></div>
                <div class="form-row"><label>Amount (₹)</label><input type="number" step="0.01" name="amount" required></div>
                <div class="form-row"><label>Date</label><input type="date" name="expense_date" value="<?= date('Y-m-d') ?>" required></div>
            </div>
            <div class="form-row"><label>Description</label><textarea name="description" rows="2"></textarea></div>
            <div class="form-row"><label>Receipt (pdf/image)</label><input type="file" name="receipt" accept=".pdf,image/*"></div>
            <p class="sm muted">Above <?= inr($threshold) ?> requires Management final approval.</p>
            <div class="form-actions"><button type="button" class="btn secondary" onclick="closeModal('m-raise')">Cancel</button><button class="btn primary">Raise</button></div>
        </form>
    </div>
</div>

<div id="m-act" class="modal-backdrop">
    <div class="modal">
        <button class="modal-close" onclick="closeModal('m-act')">✕</button>
        <h2><span id="act-stage-title">Decision</span></h2>
        <form method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="action" id="act-action">
            <input type="hidden" name="id" id="act-id">
            <div class="form-row flex" style="gap:16px">
                <label class="flex"><input type="radio" name="decision" value="approved" checked style="width:auto"> Approve</label>
                <label class="flex"><input type="radio" name="decision" value="rejected" style="width:auto"> Reject</label>
            </div>
            <div class="form-row"><label>Reason (required if rejecting)</label><textarea name="reason" rows="3"></textarea></div>
            <div class="form-actions"><button type="button" class="btn secondary" onclick="closeModal('m-act')">Cancel</button><button class="btn primary">Submit</button></div>
        </form>
    </div>
</div>
<script>
function actExp(id, stage) {
    document.getElementById('act-id').value = id;
    document.getElementById('act-action').value = stage === 1 ? 'stage1' : 'final';
    document.getElementById('act-stage-title').textContent = stage === 1 ? 'Stage-1 decision' : 'Final decision';
    openModal('m-act');
}
</script>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
