<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

$report = [];
$report['php_version'] = PHP_VERSION;
$report['loaded_extensions'] = get_loaded_extensions();

try {
    require_once __DIR__ . '/../config/config.php';
    $report['config_loaded'] = true;
} catch (Throwable $t) {
    $report['config_error'] = $t->getMessage();
}

try {
    require_once __DIR__ . '/../config/db.php';
    $report['db_file_loaded'] = true;
} catch (Throwable $t) {
    $report['db_file_error'] = $t->getMessage();
}

try {
    $db = getDB();
    $report['db_connected'] = ($db !== null);
    $report['db_driver'] = Database::getDriver();
} catch (Throwable $t) {
    $report['db_connect_error'] = $t->getMessage();
}

echo json_encode($report, JSON_PRETTY_PRINT);
