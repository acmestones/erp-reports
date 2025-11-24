<?php
header('Content-Type: application/json');

$cacheFile = __DIR__ . '/plytix_cache.json';
$timestampFile = __DIR__ . '/plytix_lastsync.txt';
$callCountFile = __DIR__ . '/plytix_apicount.txt';
$cacheTime = 3600; // 1 hour cache lifetime in seconds
$limit = 20;       // Plytix API capped limit per call

// Test file write permission - uncomment to test and then comment out again
/*
$testFile = __DIR__ . '/test_write.txt';
if (file_put_contents($testFile, 'test')) {
    echo json_encode(["test_write" => "Success: File created at $testFile"]);
} else {
    echo json_encode(["test_write" => "Failed: Cannot write to $testFile"]);
}
exit;
*/

// Serve cached data if fresh
$currentTime = time();
if (file_exists($cacheFile) && ($currentTime - filemtime($cacheFile) < $cacheTime)) {
    $data = file_get_contents($cacheFile);
    $callCount = file_exists($callCountFile) ? intval(file_get_contents($callCountFile)) : 0;
    echo json_encode([
        "cached" => true,
        "data" => json_decode($data, true),
        "api_calls_made" => $callCount
    ]);
    exit;
}

// Reset API call counter for this run
$callCount = 0;

// Your Plytix API credentials
$apiKey = "YOUR_API_KEY_HERE";
$apiPassword = "YOUR_API_PASSWORD_HERE";

// Step 1: Authenticate and get access token
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
    die(json_encode([
        "error" => "Auth failed",
        "code" => $authHttpCode,
        "response" => json_decode($authResponse, true)
    ]));
}

$authData = json_decode($authResponse, true);
if (!isset($authData['data'][0]['access_token'])) {
    http_response_code(500);
    die(json_encode([
        "error" => "No token received",
        "response" => $authData
    ]));
}
$accessToken = $authData['data'][0]['access_token'];
$callCount++; // Count auth call

// Load last sync timestamp if available
$lastSync = file_exists($timestampFile) ? trim(file_get_contents($timestampFile)) : null;

// Set filters: fetch only updated products if lastSync exists
$filters = [];
if ($lastSync) {
    $filters[] = [
        "key" => "modified_at",
        "operator" => ">",
        "value" => $lastSync
    ];
}

// Step 2: Fetch products with pagination
$allProducts = [];
$page = 1;

do {
    $postData = [
        "limit" => $limit,
        "page" => $page,
        "attributes" => true,
        "relationships" => true,
        "assets" => true
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
        die(json_encode([
            "error" => "API fetch failed",
            "code" => $httpcode,
            "response" => $response
        ]));
    }

    $data = json_decode($response, true);
    $callCount++;

    if (isset($data['data']) && count($data['data']) > 0) {
        $allProducts = array_merge($allProducts, $data['data']);
        $page++;
    } else {
        break;
    }

    usleep(100000); // Small delay between calls to avoid rate limiting

} while (count($data['data']) == $limit);

// Step 3: Cache data and update last sync timestamp
if (count($allProducts) > 0) {
    if (file_put_contents($cacheFile, json_encode($allProducts)) === false) {
        error_log('Failed to write cache file: ' . $cacheFile);
    }
    if (file_put_contents($timestampFile, date('c')) === false) {
        error_log('Failed to write timestamp file: ' . $timestampFile);
    }
}

// Save API call count for frontend display
if (file_put_contents($callCountFile, $callCount) === false) {
    error_log('Failed to write API call count file: ' . $callCountFile);
}

// Step 4: Serve fresh data with API call count
echo json_encode([
    "cached" => false,
    "data" => $allProducts,
    "api_calls_made" => $callCount
]);
