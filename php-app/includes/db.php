<?php
// includes/db.php  —  Single PDO connection + helpers.

if (! isset($GLOBALS['__config'])) {
    $GLOBALS['__config'] = require __DIR__ . '/../config.php';
}
$cfg = $GLOBALS['__config'];

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;

    $cfg = $GLOBALS['__config'];
    $dsn = "mysql:host={$cfg['db_host']};port={$cfg['db_port']};dbname={$cfg['db_name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

function fetch_one(string $sql, array $params = []): ?array {
    $row = q($sql, $params)->fetch();
    return $row ?: null;
}

function fetch_all(string $sql, array $params = []): array {
    return q($sql, $params)->fetchAll();
}

function last_id(): int {
    return (int) db()->lastInsertId();
}
