<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';
require_role('admin');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $logoPath = upload_file('logo', 'logos', ['jpg','jpeg','png','webp']);
    if ($logoPath) {
        q('UPDATE settings SET company_name=?, currency=?, threshold_amount=?, logo_path=? WHERE id=1',
          [$_POST['company_name'], $_POST['currency'], (float)$_POST['threshold_amount'], $logoPath]);
    } else {
        q('UPDATE settings SET company_name=?, currency=?, threshold_amount=? WHERE id=1',
          [$_POST['company_name'], $_POST['currency'], (float)$_POST['threshold_amount']]);
    }
    flash_set('ok', 'Settings saved.');
    redirect('/settings.php');
}

$s = fetch_one('SELECT * FROM settings WHERE id=1');

$page_title = 'Settings';
$page_heading = 'Settings';
require_once __DIR__ . '/includes/header.php';
?>

<div class="card" style="max-width:640px">
    <form method="post" enctype="multipart/form-data">
        <?= csrf_field() ?>
        <div class="form-row"><label>Company name</label><input name="company_name" value="<?= e($s['company_name']) ?>" required></div>
        <div class="form-grid">
            <div class="form-row"><label>Currency</label><input name="currency" value="<?= e($s['currency']) ?>" required></div>
            <div class="form-row">
                <label>Expense threshold (₹)</label>
                <input type="number" step="0.01" name="threshold_amount" value="<?= (float)$s['threshold_amount'] ?>" required>
                <p class="sm muted mt-2">Amounts above this need Management final approval.</p>
            </div>
        </div>
        <div class="form-row">
            <label>Company logo</label>
            <?php if ($s['logo_path']): ?><img src="<?= url($s['logo_path']) ?>" style="height:48px; margin-bottom:8px"><br><?php endif; ?>
            <input type="file" name="logo" accept="image/*">
        </div>
        <div class="right"><button class="btn primary">Save settings</button></div>
    </form>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
