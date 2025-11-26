<?php
// Set max execution time and memory for heavy fetches
set_time_limit(300);
ini_set('memory_limit', '256M');

// Configure PHP error logging explicitly
ini_set('log_errors', 'On');
ini_set('error_log', __DIR__ . '/php-error.log');

// Use absolute paths for files
$cacheFile = __DIR__ . '/plytix_cache.json';
$timestampFile = __DIR__ . '/plytix_lastsync.txt';
$callCountFile = __DIR__ . '/plytix_apicount.txt';

// Force refresh parameter - only delete cache if explicitly requested
if (isset($_GET['force_refresh']) && $_GET['force_refresh'] === 'true') {
    @unlink($cacheFile);
    @unlink($timestampFile);
    error_log("Force refresh: Cache files deleted");
}

error_log("PHP script executed at " . date('Y-m-d H:i:s'));

$cacheTime = 3600;  // 1 hour cache (change to suit your needs)
$limit = 25;        // products per page
$maxPages = 3;      // Limit to 3 pages for debugging

$currentTime = time();
if (file_exists($cacheFile) && ($currentTime - filemtime($cacheFile) < $cacheTime)) {
    error_log("Serving cached data. Cache age (seconds): " . ($currentTime - filemtime($cacheFile)));
    $cacheData = file_get_contents($cacheFile);
    
    header('Content-Type: application/json');
    header('Cache-Control: no-cache, must-revalidate');
    header('Expires: 0');
    echo $cacheData;
    exit;
}

error_log("Cache expired or missing. Fetching fresh data from API.");

$callCount = 0;

// Update these with your valid API credentials
$apiKey = "DQ1TBOXSRPE196ER4018";
$apiPassword = "0&0eqfaSvwb1iGdHRWL0nJZ9heuDJA3y@J;37S8z";

error_log("Starting authentication with Plytix API.");

// Authenticate to get access token
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

error_log("Authentication HTTP code: $authHttpCode");

if ($authHttpCode != 200) {
    error_log("Authentication failed: HTTP $authHttpCode");
    http_response_code(500);
    die(json_encode(["error" => "Auth failed", "code" => $authHttpCode]));
}

$authData = json_decode($authResponse, true);
if (!isset($authData['data'][0]['access_token'])) {
    error_log("No access token received");
    http_response_code(500);
    die(json_encode(["error" => "No token received"]));
}
$accessToken = $authData['data'][0]['access_token'];
$callCount++;

$lastSync = file_exists($timestampFile) ? trim(file_get_contents($timestampFile)) : null;

$filters = [];
if ($lastSync && !isset($_GET['force_refresh'])) {
    $filters[] = [
        "key" => "modified_at",
        "operator" => ">",
        "value" => $lastSync
    ];
}

$allProducts = [];
$page = 1;

while (true) {
    error_log("Fetching page $page from API...");

    // FETCH ALL ATTRIBUTES - Don't specify attributes array to get everything
    $postData = [
        "limit" => $limit,
        "page" => $page
    ];
    
    if (!empty($filters)) {
        $postData["filters"] = $filters;
    }

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
        error_log("API fetch failed at page $page with HTTP $httpcode");
        http_response_code(500);
        die(json_encode(["error" => "API fetch failed", "code" => $httpcode, "response" => $response]));
    }

    $data = json_decode($response, true);
    $callCount++;

    if (isset($data['data']) && count($data['data']) > 0) {
        error_log("Fetched page $page with " . count($data['data']) . " products.");
        $allProducts = array_merge($allProducts, $data['data']);

        if (count($data['data']) < $limit) {
            error_log("Last page reached at page $page.");
            break;
        }
        if ($page >= $maxPages) {
            error_log("Max pages limit ($maxPages) reached. Halting fetch.");
            break;
        }
        $page++;
    } else {
        error_log("No products returned at page $page.");
        break;
    }

    usleep(200000); // 200ms delay between requests
}

if (count($allProducts) > 0) {
    error_log("Encoding JSON for " . count($allProducts) . " products.");
    $jsonOutput = json_encode($allProducts, JSON_PRETTY_PRINT);
    
    if ($jsonOutput === false) {
        error_log("JSON encoding error: " . json_last_error_msg());
    } else {
        error_log("JSON encoding successful. Size: " . strlen($jsonOutput) . " bytes");

        if (file_put_contents($cacheFile, $jsonOutput) === false) {
            error_log("Failed writing cache file: $cacheFile");
        } else {
            error_log("Cache file written successfully");
        }

        if (file_put_contents($timestampFile, date('c')) === false) {
            error_log("Failed writing timestamp file: $timestampFile");
        } else {
            error_log("Timestamp file written");
        }
    }
}

file_put_contents($callCountFile, $callCount);

header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');
header('Expires: 0');
echo json_encode($allProducts);
?>
