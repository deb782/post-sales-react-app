<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';
require_login();
$u = current_user();

// Handle actions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (! has_role('admin')) { http_response_code(403); die('Forbidden'); }

    $action = $_POST['action'] ?? '';
    if ($action === 'create') {
        $data = [
            $_POST['name'] ?? '',
            $_POST['project_type'] ?? 'residential',
            $_POST['developer'] ?? null,
            $_POST['address'] ?? null,
            $_POST['city'] ?? null,
            $_POST['state'] ?? null,
            $_POST['pincode'] ?? null,
            $_POST['rera_number'] ?? null,
            $_POST['start_date'] ?: null,
            $_POST['expected_completion'] ?: null,
            (int) ($_POST['total_units_planned'] ?? 0),
            (float) ($_POST['target_revenue'] ?? 0),
            upload_file('image', 'projects', ['jpg','jpeg','png','webp']),
        ];
        q('INSERT INTO projects (name,project_type,developer,address,city,state,pincode,rera_number,start_date,expected_completion,total_units_planned,target_revenue,image_path)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', $data);
        audit('project.create', 'project', last_id(), ['name' => $data[0]]);
        flash_set('ok', 'Project “' . $data[0] . '” created.');
    } elseif ($action === 'delete') {
        $id = (int) ($_POST['id'] ?? 0);
        q('DELETE FROM projects WHERE id = ?', [$id]);
        audit('project.delete', 'project', $id);
        flash_set('ok', 'Project deleted.');
    }
    redirect('/projects.php');
}

$page_title = 'Projects';
$page_heading = 'Projects';
$page_actions = has_role('admin')
    ? '<button class="btn primary" onclick="openModal(\'m-new\')">+ New project</button>' : '';

$projects = fetch_all('SELECT p.*, (SELECT COUNT(*) FROM units WHERE project_id = p.id) unit_count FROM projects p ORDER BY p.created_at DESC');

require_once __DIR__ . '/includes/header.php';
?>

<?php if (! $projects): ?>
    <div class="card empty">
        <p>No projects yet.</p>
        <?php if (has_role('admin')): ?><p class="sm mt-2">Click <b>New project</b> to add your first one.</p><?php endif; ?>
    </div>
<?php else: ?>
    <div class="grid grid-3">
        <?php foreach ($projects as $p): ?>
            <div class="card">
                <div class="between flex mb-2">
                    <h2><?= e($p['name']) ?></h2>
                    <span class="badge slate"><?= str_replace('_',' ', ucwords($p['project_type'], '_')) ?></span>
                </div>
                <div class="sm muted"><?= e(trim(($p['city'] ?? '') . ($p['state'] ? ', '.$p['state'] : ''))) ?></div>
                <div class="sm mt-2"><?= (int)$p['unit_count'] ?> units · Target <?= inr((float)$p['target_revenue']) ?></div>
                <div class="mt-4 flex between">
                    <a class="btn sm secondary" href="units.php?project_id=<?= $p['id'] ?>">View units</a>
                    <?php if (has_role('admin')): ?>
                        <form method="post" data-confirm="Delete “<?= e($p['name']) ?>” and all its data?">
                            <?= csrf_field() ?>
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="id" value="<?= $p['id'] ?>">
                            <button class="btn sm danger">Delete</button>
                        </form>
                    <?php endif; ?>
                </div>
            </div>
        <?php endforeach; ?>
    </div>
<?php endif; ?>

<?php if (has_role('admin')): ?>
<div id="m-new" class="modal-backdrop">
    <div class="modal" style="max-width:640px">
        <button class="modal-close" onclick="closeModal('m-new')">✕</button>
        <h2>New project</h2>
        <form method="post" enctype="multipart/form-data">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="create">
            <div class="form-row"><label>Name *</label><input name="name" required></div>
            <div class="form-grid">
                <div class="form-row">
                    <label>Type</label>
                    <select name="project_type">
                        <option value="residential">Residential</option>
                        <option value="commercial">Commercial</option>
                        <option value="plot">Plot</option>
                        <option value="villa">Villa</option>
                        <option value="mixed">Mixed-use</option>
                    </select>
                </div>
                <div class="form-row"><label>Developer</label><input name="developer"></div>
                <div class="form-row"><label>City</label><input name="city"></div>
                <div class="form-row"><label>State</label><input name="state"></div>
                <div class="form-row"><label>Pincode</label><input name="pincode"></div>
                <div class="form-row"><label>RERA</label><input name="rera_number"></div>
                <div class="form-row"><label>Start date</label><input type="date" name="start_date"></div>
                <div class="form-row"><label>Expected completion</label><input type="date" name="expected_completion"></div>
                <div class="form-row"><label>Units planned</label><input type="number" name="total_units_planned"></div>
                <div class="form-row"><label>Target revenue (₹)</label><input type="number" step="0.01" name="target_revenue"></div>
            </div>
            <div class="form-row"><label>Address</label><input name="address"></div>
            <div class="form-row"><label>Cover image</label><input type="file" name="image" accept="image/*"></div>
            <div class="form-actions">
                <button type="button" class="btn secondary" onclick="closeModal('m-new')">Cancel</button>
                <button class="btn primary">Create project</button>
            </div>
        </form>
    </div>
</div>
<?php endif; ?>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
