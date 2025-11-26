<?php
set_time_limit(600); // Increase timeout for multiple API calls
ini_set('memory_limit', '256M');
ini_set('log_errors', 'On');
ini_set('error_log', __DIR__ . '/php-error.log');

$cacheFile = __DIR__ . '/plytix_cache.json';
$timestampFile = __DIR__ . '/plytix_lastsync.txt';
$callCountFile = __DIR__ . '/plytix_apicount.txt';

if (isset($_GET['force_refresh']) && $_GET['force_refresh'] === 'true') {
    @unlink($cacheFile);
    @unlink($timestampFile);
    error_log("Force refresh requested");
}

error_log("=== PHP START: " . date('Y-m-d H:i:s') . " ===");

$cacheTime = 3600;
$limit = 25;
$maxProducts = 25; // Fetch 25 products for testing

$currentTime = time();
if (file_exists($cacheFile) && ($currentTime - filemtime($cacheFile) < $cacheTime)) {
    error_log("Serving cached data");
    header('Content-Type: application/json');
    header('Cache-Control: no-cache, must-revalidate');
    echo file_get_contents($cacheFile);
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
    error_log("AUTH FAILED: $authHttpCode");
    http_response_code(500);
    die(json_encode(["error" => "Auth failed"]));
}

$authData = json_decode($authResponse, true);
$accessToken = $authData['data'][0]['access_token'];
$callCount = 1;

// STEP 1: Get list of product IDs
error_log("STEP 1: Getting product IDs...");
$postData = [
    "limit" => $limit,
    "page" => 1,
    "sort" => [
        ["field" => "id", "order" => "asc"]
    ]
];

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
$callCount++;

if ($httpcode != 200) {
    error_log("Failed to get product list: HTTP $httpcode");
    http_response_code(500);
    die(json_encode(["error" => "Failed to get products"]));
}

$data = json_decode($response, true);
$productIds = [];

if (isset($data['data'])) {
    foreach ($data['data'] as $product) {
        if (isset($product['id'])) {
            $productIds[] = $product['id'];
        }
    }
}

error_log("Got " . count($productIds) . " product IDs");

// STEP 2: Fetch full details for each product
error_log("STEP 2: Fetching full product details...");
$allProducts = [];

foreach ($productIds as $index => $productId) {
    error_log("Fetching product " . ($index + 1) . "/$limit: $productId");
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://pim.plytix.com/api/v1/products/" . $productId);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $callCount++;
    
if ($httpcode == 200) {
        $productData = json_decode($response, true);
        
        // Extract product from response - handle different structures
        if (isset($productData['data']) && is_array($productData['data'])) {
            // If data is an array with one element, unwrap it
            if (isset($productData['data'][0]) && count($productData['data']) == 1) {
                $allProducts[] = $productData['data'][0];
            } else {
                // Otherwise just use data as-is
                $allProducts[] = $productData['data'];
            }
        } else {
            $allProducts[] = $productData;
        }
        
        // Log first product structure
        if ($index === 0) {
            error_log("First full product: " . json_encode($allProducts[0], JSON_PRETTY_PRINT));
        }
    } else {
        error_log("Failed to fetch product $productId: HTTP $httpcode");
    }
    
    // Rate limiting
    if (($index + 1) % 5 == 0) {
        usleep(500000); // 500ms pause every 5 products
    } else {
        usleep(100000); // 100ms between products
    }
}

error_log("=== COMPLETE: " . count($allProducts) . " products, $callCount API calls ===");

if (count($allProducts) > 0) {
    $jsonOutput = json_encode($allProducts, JSON_PRETTY_PRINT);
    file_put_contents($cacheFile, $jsonOutput);
    file_put_contents($timestampFile, date('c'));
}

file_put_contents($callCountFile, $callCount);

header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');
echo json_encode($allProducts);
?>
