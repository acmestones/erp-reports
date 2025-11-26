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
$maxProducts = 75; // Fetch 75 products total (3 pages worth)

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
$offset = 0;
$page = 1;

while (count($allProducts) < $maxProducts) {
    error_log("--- Fetching OFFSET $offset (page equivalent $page) ---");

    // Try OFFSET-based pagination instead of page
    $postData = [
        "limit" => $limit,
        "offset" => $offset,
        "relationship_data" => true  // Try to get related data
    ];

    error_log("Request: " . json_encode($postData));

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://pim.plytix.com/api/v1/products/search");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
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

    if (!isset($data['data']) || count($data['data']) === 0) {
        error_log("No more products at offset $offset");
        break;
    }

    $pageCount = count($data['data']);
    error_log("Received $pageCount products");

    // Log first product structure on first call
    if ($offset === 0) {
        error_log("=== FIRST PRODUCT STRUCTURE ===");
        error_log(json_encode($data['data'][0], JSON_PRETTY_PRINT));
    }

    // Check if we're getting new products or duplicates
    $newProducts = 0;
    foreach ($data['data'] as $product) {
        $pid = $product['id'] ?? $product['sku'] ?? null;
        $isDupe = false;
        
        // Check if already exists
        foreach ($allProducts as $existing) {
            $eid = $existing['id'] ?? $existing['sku'] ?? null;
            if ($eid === $pid) {
                $isDupe = true;
                error_log("DUPLICATE: $pid at offset $offset");
                break;
            }
        }
        
        if (!$isDupe) {
            $allProducts[] = $product;
            $newProducts++;
        }
    }

    error_log("New products added: $newProducts");
    error_log("Total unique products: " . count($allProducts));

    // If we got no new products, pagination isn't working
    if ($newProducts === 0) {
        error_log("ERROR: Got 0 new products - pagination not working!");
        break;
    }

    // Stop if we got fewer products than requested
    if ($pageCount < $limit) {
        error_log("Last batch (got $pageCount, expected $limit)");
        break;
    }

    $offset += $limit;
    $page++;
    usleep(200000); // 200ms delay
}

error_log("=== FETCH COMPLETE ===");
error_log("Total API calls: $callCount");
error_log("Total unique products: " . count($allProducts));

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
