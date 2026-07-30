<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/functions.php';
require_login();
$__u = current_user();
$__cfg = $GLOBALS['__config'];
$__here = basename($_SERVER['SCRIPT_NAME']);

$nav = [
    ['index.php',     'Dashboard',   ['admin','accounts','management','site_manager']],
    ['projects.php',  'Projects',    ['admin','accounts','management','site_manager']],
    ['units.php',     'Units',       ['admin','accounts','management','site_manager']],
    ['payments.php',  'Revenue',     ['admin','accounts','management']],
    ['expenses.php',  'Expenses',    ['admin','accounts','management','site_manager']],
    ['stock.php',     'Stock Book',  ['admin','site_manager']],
    ['audit.php',     'Audit Log',   ['admin','accounts','management']],
    ['users.php',     'Users',       ['admin']],
    ['settings.php',  'Settings',    ['admin']],
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($page_title ?? $__cfg['app_name']) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= url('assets/style.css') ?>">
    <script defer src="<?= url('assets/app.js') ?>"></script>
</head>
<body>
<div class="layout">
    <aside class="sidebar">
        <div class="brand">
            <div class="brand-name"><?= e($__cfg['company_name']) ?></div>
            <div class="brand-sub">Estate Dashboard</div>
        </div>
        <nav>
            <?php foreach ($nav as [$link, $label, $roles]): if (! in_array($__u['role'], $roles, true)) continue; ?>
                <a href="<?= url($link) ?>" class="<?= $__here === $link ? 'active' : '' ?>"><?= $label ?></a>
            <?php endforeach; ?>
        </nav>
        <div class="user">
            <div class="user-name"><?= e($__u['name']) ?></div>
            <div class="user-role"><?= str_replace('_', ' ', $__u['role']) ?></div>
            <form method="post" action="<?= url('logout.php') ?>">
                <?= csrf_field() ?>
                <button class="link-btn">Log out</button>
            </form>
        </div>
    </aside>

    <main class="main">
        <header class="topbar">
            <div>
                <div class="eyebrow" style="margin-bottom:6px"><?= e($page_eyebrow ?? '') ?></div>
                <h1><?= $page_heading ?? 'Dashboard' ?></h1>
            </div>
            <div class="topbar-actions"><?= $page_actions ?? '' ?></div>
        </header>

        <?php if ($m = flash_get('ok')): ?><div class="flash ok"><?= e($m) ?></div><?php endif; ?>
        <?php if ($m = flash_get('err')): ?><div class="flash err"><?= e($m) ?></div><?php endif; ?>

        <div class="content">
