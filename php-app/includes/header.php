<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/functions.php';
require_login();
$__u = current_user();
$__cfg = $GLOBALS['__config'];
$__here = basename($_SERVER['SCRIPT_NAME']);
$__initials = strtoupper(substr($__cfg['company_name'], 0, 2));

$nav = [
    ['index.php',     '📊', 'Dashboard',   ['admin','accounts','management','site_manager']],
    ['projects.php',  '🏗️', 'Projects',    ['admin','accounts','management','site_manager']],
    ['units.php',     '🏘️', 'Units',       ['admin','accounts','management','site_manager']],
    ['payments.php',  '💰', 'Revenue',     ['admin','accounts','management']],
    ['expenses.php',  '🧾', 'Expenses',    ['admin','accounts','management','site_manager']],
    ['stock.php',     '📦', 'Stock Book',  ['admin','site_manager']],
    ['audit.php',     '📋', 'Audit Log',   ['admin','accounts','management']],
    ['users.php',     '👥', 'Users',       ['admin']],
    ['settings.php',  '⚙️', 'Settings',    ['admin']],
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($page_title ?? $__cfg['app_name']) ?></title>
    <link rel="stylesheet" href="<?= url('assets/style.css') ?>">
    <script defer src="<?= url('assets/app.js') ?>"></script>
</head>
<body>
<div class="layout">
    <aside class="sidebar">
        <div class="brand flex" style="gap:12px;">
            <div class="login-logo" style="width:36px; height:36px; font-size:14px; margin:0; border-radius:10px;"><?= e($__initials) ?></div>
            <div>
                <div class="brand-name"><?= e($__cfg['company_name']) ?></div>
                <div class="brand-sub">Estate Dashboard</div>
            </div>
        </div>
        <nav>
            <?php foreach ($nav as [$link, $icon, $label, $roles]): if (! in_array($__u['role'], $roles, true)) continue; ?>
                <a href="<?= url($link) ?>" class="<?= $__here === $link ? 'active' : '' ?>">
                    <span style="width:20px; display:inline-block; text-align:center;"><?= $icon ?></span>
                    <span><?= $label ?></span>
                </a>
            <?php endforeach; ?>
        </nav>
        <div class="user">
            <div class="user-name"><?= e($__u['name']) ?></div>
            <div class="user-role"><?= str_replace('_', ' ', ucwords($__u['role'], '_')) ?></div>
            <form method="post" action="<?= url('logout.php') ?>" style="margin-top:8px">
                <?= csrf_field() ?>
                <button class="link-btn">→ Log out</button>
            </form>
        </div>
    </aside>

    <main class="main">
        <header class="topbar">
            <h1><?= $page_heading ?? 'Dashboard' ?></h1>
            <div class="topbar-actions"><?= $page_actions ?? '' ?></div>
        </header>

        <?php if ($m = flash_get('ok')): ?><div class="flash ok">✓ <?= e($m) ?></div><?php endif; ?>
        <?php if ($m = flash_get('err')): ?><div class="flash err">✗ <?= e($m) ?></div><?php endif; ?>

        <div class="content">
