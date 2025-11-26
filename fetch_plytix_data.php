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
    error_log("Force refresh requested");
}

error_log("=== PHP START: " . date('Y-m-d H:i:s') . " ===");

$cacheTime = 3600;
$limit = 25;
$maxPages = 1;

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

$allProducts = [];
$page = 1;

while (true) {
    error_log("--- Fetching PAGE $page ---");

    // CRITICAL FIX: Add sort order to make pagination work!
    $postData = [
        "limit" => $limit,
        "page" => $page,
        "sort" => [
            ["field" => "id", "order" => "asc"]  // Sort by ID ascending
        ],
        "attributes" => [
            "label",
            "sku",
            "retail_price",
            "product_enabled",
            "thumbnail",
            "product_images",
            "application_images",
            "production_images",
            "similar_images",
            "assets",
            "categories",
            "variant_of",
            "variants",
            "product_id",
            "gtin",
            "status",
            "created",
            "last_modified"
        ]
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
        error_log("API FAILED: $httpcode");
        error_log("Response: " . substr($response, 0, 500));
        break;
    }

    $data = json_decode($response, true);
    $callCount++;

    if (isset($data['data']) && count($data['data']) > 0) {
        $count = count($data['data']);
        error_log("Received $count products");
        
        // Log first product on page 1
        if ($page === 1) {
            error_log("First product: " . json_encode($data['data'][0], JSON_PRETTY_PRINT));
        }
        
        $allProducts = array_merge($allProducts, $data['data']);
        
        error_log("Total products so far: " . count($allProducts));

        if ($count < $limit) {
            error_log("Last page (got $count < $limit)");
            break;
        }
        if ($page >= $maxPages) {
            error_log("Max pages reached");
            break;
        }
        $page++;
    } else {
        error_log("No products on page $page");
        break;
    }

    usleep(200000);
}

error_log("=== COMPLETE: " . count($allProducts) . " products, $callCount calls ===");

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
