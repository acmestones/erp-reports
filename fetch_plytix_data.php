<?php
header('Content-Type: application/json');

// Paste your API credentials from accounts.plytix.com
$apiKey = "DQ1TBOXSRPE196ER4018";
$apiPassword = "0&0eqfaSvwb1iGdHRWL0nJZ9heuDJA3y@J;37S8z";

$cacheFile = 'plytix_cache.json';
$timestampFile = 'plytix_lastsync.txt';
$cacheTime = 3600; // 1 hour cache lifetime in seconds
$limit = 20; // Plytix API capped limit per call

// Get current time for cache expiration
$currentTime = time();

// Load last sync timestamp
$lastSync = file_exists($timestampFile) ? file_get_contents($timestampFile) : null;

// Decide if cache is expired or doesn't exist
if (file_exists($cacheFile) && ($currentTime - filemtime($cacheFile) < $cacheTime)) {
    // Serve cached data
    echo file_get_contents($cacheFile);
    exit;
}

// Step 1: Get access token
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
    http_response_code(500);
    die(json_encode(["error" => "Auth failed", "code" => $authHttpCode, "response" => json_decode($authResponse, true)]));
}

$authData = json_decode($authResponse, true);
if (!isset($authData['data'][0]['access_token'])) {
    http_response_code(500);
    die(json_encode(["error" => "No token received", "response" => $authData]));
}
$accessToken = $authData['data'][0]['access_token'];

// Step 2: Set up filters
$filters = [];
if ($lastSync) {
    // Fetch only products modified after last sync
    $filters[] = [
        "key" => "modified_at",
        "operator" => ">",
        "value" => $lastSync
    ];
}

$allProducts = [];
$page = 1;

do {
    $postData = [
        "limit" => $limit,
        "page" => $page,
        "attributes" => true,
        "relationships" => true,
        "assets" => true,
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
        http_response_code(500);
        die(json_encode(["error" => "API fetch failed", "code" => $httpcode]));
    }

    $data = json_decode($response, true);

    if (isset($data['data']) && count($data['data']) > 0) {
        $allProducts = array_merge($allProducts, $data['data']);
        $page++;
    } else {
        break;
    }

    usleep(100000); // Slight delay to avoid hitting rate limits
} while (count($data['data']) == $limit);

// Step 3: Update cache and last sync timestamp

if (count($allProducts) > 0) {
    $jsonOutput = json_encode($allProducts);
    file_put_contents($cacheFile, $jsonOutput);
    file_put_contents($timestampFile, date('c')); // ISO 8601 timestamp for last sync
}

// Serve the cached or fresh data
echo file_get_contents($cacheFile);

?>
