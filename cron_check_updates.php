<?php
$_GET['forcerefresh'] = '1';
$_GET['action'] = 'get_status';

ob_start();
require_once __DIR__ . '/fetch_plytix_data.php';
$result = ob_get_clean();

$timestamp = date('Y-m-d H:i:s');
$logFile = __DIR__ . '/cache/cron_log.txt';
file_put_contents($logFile, "[$timestamp] Cache check completed\n", FILE_APPEND);

$data = json_decode($result, true);
if ($data && isset($data['needUpdate']) && $data['needUpdate'] > 0) {
    file_put_contents($logFile, "[$timestamp] Found {$data['needUpdate']} products to update\n", FILE_APPEND);
    
    $_GET['action'] = 'fetch_products';
    $_POST = ['ids' => $data['needUpdateIds']];
    
    ob_start();
    require_once __DIR__ . '/fetch_plytix_data.php';
    ob_end_clean();
    
    file_put_contents($logFile, "[$timestamp] Products updated\n", FILE_APPEND);
}
?>
