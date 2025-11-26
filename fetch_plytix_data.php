<?php
set_time_limit(300);
ini_set('memory_limit', '256M');
ini_set('log_errors', 'On');
ini_set('error_log', __DIR__ . '/php-error.log');

$cacheFile = __DIR__ . '/plytix_cache.json';
$timestampFile = __DIR__ . '/plytix_lastsync.txt';
$callCountFile = __DIR__ . '/plytix_apicount.txt';

if (isset($_GET['force_refresh']) && $_GET['force_refresh'] === 'true') {
    @unlink($cacheFile);
    @unlink($timestampFile);
    error_log("Force refresh: Cache files deleted");
}

error_log("=== PHP EXECUTION START: " . date('Y-m-d H:i:s') . " ===");

$cacheTime = 3600;
$limit = 25;
$maxProducts = 75;

$currentTime = time();
if (file_exists($cacheFile) && ($currentTime - filemtime($cacheFile) < $cacheTime)) {
    error_log("Serving cached data");
    $cacheData = file_get_contents($cacheFile);
    header('Content-Type: application/json');
    header('Cache-Control: no-cache, must-revalidate');
    header('Expires: 0');
    echo $cacheData;
    exit;
}

error_log("Fetching fresh data from API");

$apiKey = "DQ1TBOXSRPE196ER4018";
$apiPassword = "0&0eqfaSvwb1iGdHRWL0nJZ9heuDJA3y@J;37S8z";

// Authenticate
$authCh = curl_init();
curl_setopt($authCh, CURLOPT_URL, "https://auth.plytix.com/auth/api/get-token");
curl_setopt($authCh, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($authCh, CURLOPT_POST, 1);
curl_setopt($authCh, CURLOPT_POSTFIELDS, json_encode([
    "api_key" => $apiKey,
    "api_password" => $apiPassword
]));
curl_setopt($authCh, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($authCh, CURLOPT_SSL_VERIFYPEER, false);

$authResponse = curl_exec($authCh);
$authHttpCode = curl_getinfo($authCh, CURLINFO_HTTP_CODE);
curl_close($authCh);

if ($authHttpCode != 200) {
    error_log("AUTH FAILED: HTTP $authHttpCode");
    http_response_code(500);
    die(json_encode(["error" => "Auth failed"]));
}

$authData = json_decode($authResponse, true);
$accessToken = $authData['data'][0]['access_token'];
$callCount = 1;

$allProducts = [];
$lastId = null; // For cursor-based pagination

while (count($allProducts) < $maxProducts) {
    $attempt = floor(count($allProducts) / $limit) + 1;
    error_log("--- Fetching batch $attempt (have " . count($allProducts) . " products) ---");

    // Try GET endpoint with query parameters for pagination
    $url = "https://pim.plytix.com/api/v1/products?limit=$limit";
    if ($lastId) {
        $url .= "&after_id=$lastId"; // Cursor-based pagination
    }

    error_log("Request URL: $url");

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $response = curl_exec($ch);
    $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpcode != 200) {
        error_log("API FAILED: HTTP $httpcode");
        error_log("Response: " . substr($response, 0, 1000));
        break;
    }

    $data = json_decode($response, true);
    $callCount++;

    // Check different response structures
    $products = [];
    if (isset($data['data'])) {
        $products = $data['data'];
    } elseif (is_array($data)) {
        $products = $data;
    }

    if (count($products) === 0) {
        error_log("No more products returned");
        break;
    }

    $pageCount = count($products);
    error_log("Received $pageCount products");

    // Log first product structure on first call
    if (count($allProducts) === 0) {
        error_log("=== FIRST PRODUCT STRUCTURE ===");
        error_log(json_encode($products[0], JSON_PRETTY_PRINT));
    }

    // Check for duplicates
    $newCount = 0;
    foreach ($products as $product) {
        $pid = $product['id'] ?? $product['sku'] ?? null;
        
        // Check if already exists
        $exists = false;
        foreach ($allProducts as $existing) {
            $eid = $existing['id'] ?? $existing['sku'] ?? null;
            if ($eid === $pid) {
                $exists = true;
                error_log("DUPLICATE: $pid");
                break;
            }
        }
        
        if (!$exists) {
            $allProducts[] = $product;
            $newCount++;
            $lastId = $pid; // Update cursor
        }
    }

    error_log("New products: $newCount, Total: " . count($allProducts));

    if ($newCount === 0) {
        error_log("ERROR: Got 0 new products - stopping");
        break;
    }

    if ($pageCount < $limit) {
        error_log("Last batch (got $pageCount < $limit)");
        break;
    }

    usleep(200000);
}

error_log("=== FETCH COMPLETE ===");
error_log("Total API calls: $callCount");
error_log("Total products: " . count($allProducts));

if (count($allProducts) > 0) {
    $jsonOutput = json_encode($allProducts, JSON_PRETTY_PRINT);
    file_put_contents($cacheFile, $jsonOutput);
    file_put_contents($timestampFile, date('c'));
}

file_put_contents($callCountFile, $callCount);

header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');
header('Expires: 0');
echo json_encode($allProducts);
?>
