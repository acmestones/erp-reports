<?php
ini_set('log_errors', 'On');
ini_set('error_log', __DIR__ . '/php-error.log');
error_log("PHP script executed at " . date('Y-m-d H:i:s'));


$cacheFile = __DIR__ . '/plytix_cache.json';
$timestampFile = __DIR__ . '/plytix_lastsync.txt';
$callCountFile = __DIR__ . '/plytix_apicount.txt';


error_log("Cache file path: $cacheFile");
error_log("Timestamp file path: $timestampFile");


set_time_limit(300); // 5 minutes max execution time
ini_set('memory_limit', '256M'); // Increase PHP memory limit

header('Content-Type: application/json');


$cacheTime = 3600; // Cache lifetime in seconds
$limit = 20;

$currentTime = time();

// Debug log to trace cache usage
if (file_exists($cacheFile) && ($currentTime - filemtime($cacheFile) < $cacheTime)) {
    error_log("Serving cached data. Cache age (seconds): " . ($currentTime - filemtime($cacheFile)));
    $cacheData = file_get_contents($cacheFile);
    $callCount = file_exists($callCountFile) ? intval(file_get_contents($callCountFile)) : 0;
    echo json_encode([
        "cached" => true,
        "data" => json_decode($cacheData, true),
        "api_calls_made" => $callCount,
        "debug" => "Served from cache, no api fetch."
    ]);
    exit;
}

error_log("Cache expired or missing. Fetching fresh data from API.");

$callCount = 0;
$apiKey = "DQ1TBOXSRPE196ER4018";
$apiPassword = "0&0eqfaSvwb1iGdHRWL0nJZ9heuDJA3y@J;37S8z";

// Step 1: Authenticate
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
    error_log("Authentication failed with HTTP code: $authHttpCode");
    http_response_code(500);
    die(json_encode(["error" => "Auth failed", "code" => $authHttpCode, "response" => json_decode($authResponse, true)]));
}

$authData = json_decode($authResponse,true);
if (!isset($authData['data'][0]['access_token'])) {
    error_log("No access token received in auth response.");
    http_response_code(500);
    die(json_encode(["error" => "No token received", "response" => $authData]));
}
$accessToken = $authData['data'][0]['access_token'];
$callCount++;

$lastSync = file_exists($timestampFile) ? trim(file_get_contents($timestampFile)) : null;
$filters = [];
if ($lastSync) {
    error_log("Last sync timestamp loaded: $lastSync");
    $filters[] = [
        "key" => "modified_at",
        "operator" => ">",
        "value" => $lastSync
    ];
} else {
    error_log("No last sync timestamp available. Fetching all products.");
}

$allProducts = [];
$page = 1;

while (true) {
    $postData = [
        "limit" => $limit,
        "page" => $page,
        "attributes" => [],
        "relationships" => [],
        "assets" => []
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
        error_log("API fetch failed with HTTP code: $httpcode");
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
            break; // Last page
        }
        $page++;
    } else {
        error_log("No products data returned on page $page.");
        break;
    }

    usleep(100000); // 0.1 sec delay
}



if (count($allProducts) > 0) {
    error_log("Attempting to write " . count($allProducts) . " products to cache.");

    $jsonOutput = json_encode($allProducts);
    if ($jsonOutput === false) {
        error_log("JSON encoding failed: " . json_last_error_msg());
    } else {
        error_log("JSON encoding succeeded. Size: " . strlen($jsonOutput) . " bytes");

        $cacheWriteResult = file_put_contents($cacheFile, $jsonOutput);
        if ($cacheWriteResult === false) {
            error_log("FAILED to write cache file: $cacheFile");
        } else {
            error_log("Successfully wrote $cacheWriteResult bytes to cache file");
        }

        $timestampWriteResult = file_put_contents($timestampFile, date('c'));
        if ($timestampWriteResult === false) {
            error_log("FAILED to write timestamp file: $timestampFile");
        } else {
            error_log("Successfully wrote timestamp file");
        }
    }
} else {
    error_log("No products fetched; cache not updated.");
}

if (file_put_contents($callCountFile, $callCount) === false) {
    error_log("Failed to write API call count file: $callCountFile");
}


