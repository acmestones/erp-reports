<?php
/**
 * Cron job to check for product updates in background
 * Set up cron: 0 */2 * * * php /path/to/cron_check_updates.php
 * (Runs every 2 hours)
 */

// Simulate the forcerefresh parameter
$_GET['forcerefresh'] = '1';
$_GET['action'] = 'get_status';

// Capture output so it doesn't print
ob_start();
require_once __DIR__ . '/fetch_plytix_data.php';
$result = ob_get_clean();

// Log the result
$timestamp = date('Y-m-d H:i:s');
$logFile = __DIR__ . '/cache/cron_log.txt';
file_put_contents($logFile, "[$timestamp] Status check completed\n", FILE_APPEND);

// Decode result to see if updates are needed
$data = json_decode($result, true);
if ($data && isset($data['needUpdate']) && $data['needUpdate'] > 0) {
    file_put_contents($logFile, "[$timestamp] Found {$data['needUpdate']} products to update\n", FILE_APPEND);
    
    // Trigger fetch for updated products
    $_GET['action'] = 'fetch_products';
    $_POST['ids'] = json_encode($data['needUpdateIds']);
    
    ob_start();
    require_once __DIR__ . '/fetch_plytix_data.php';
    ob_end_clean();
    
    file_put_contents($logFile, "[$timestamp] Updated products fetched\n", FILE_APPEND);
} else {
    file_put_contents($logFile, "[$timestamp] No updates needed\n", FILE_APPEND);
}

echo "Done\n";
?>
