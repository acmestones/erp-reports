 
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
$maxPages = 1;  // Only fetch page 1 for now (25 products)

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

// Function to fetch asset URL by ID
function getAssetUrl($assetId, $accessToken) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://pim.plytix.com/api/v1/assets/" . $assetId);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpcode == 200) {
        $assetData = json_decode($response, true);
        // Try different response structures
        if (isset($assetData['url'])) {
            return $assetData['url'];
        } elseif (isset($assetData['data']['url'])) {
            return $assetData['data']['url'];
        } elseif (isset($assetData['data'][0]['url'])) {
            return $assetData['data'][0]['url'];
        }
    }
    
    error_log("Failed to get asset URL for ID: $assetId (HTTP $httpcode)");
    return null;
}

$allProducts = [];
$page = 1;

while (true) {
    error_log("--- Fetching PAGE $page ---");

    // Don't specify attributes - let API return everything
    $postData = [
        "limit" => $limit,
        "page" => $page,
        "sort" => [
            ["field" => "id", "order" => "asc"]
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
        
        // Process each product to add asset URLs
        error_log("Fetching asset URLs...");
        foreach ($data['data'] as &$product) {
            // Fetch thumbnail URL
            if (isset($product['thumbnail']['id'])) {
                $thumbnailId = $product['thumbnail']['id'];
                error_log("Fetching thumbnail: $thumbnailId");
                $thumbnailUrl = getAssetUrl($thumbnailId, $accessToken);
                if ($thumbnailUrl) {
                    $product['thumbnail_url'] = $thumbnailUrl;
                    error_log("Got thumbnail URL: $thumbnailUrl");
                }
                $callCount++;
                usleep(100000); // 100ms delay between asset calls
            }
            
            // Fetch first 2 asset URLs to save API calls
            if (isset($product['assets']) && is_array($product['assets'])) {
                $assetUrls = [];
                $assetCount = min(count($product['assets']), 2);
                for ($i = 0; $i < $assetCount; $i++) {
                    if (isset($product['assets'][$i]['id'])) {
                        $assetId = $product['assets'][$i]['id'];
                        $assetUrl = getAssetUrl($assetId, $accessToken);
                        if ($assetUrl) {
                            $assetUrls[] = $assetUrl;
                        }
                        $callCount++;
                        usleep(100000);
                    }
                }
                if (!empty($assetUrls)) {
                    $product['asset_urls'] = $assetUrls;
                }
            }
        }
        unset($product); // Break reference
        
        // Log first product with URLs
        if ($page === 1) {
            error_log("First product with URLs: " . json_encode($data['data'][0], JSON_PRETTY_PRINT));
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
