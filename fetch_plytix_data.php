<?php
set_time_limit(600);
ini_set('memory_limit', '512M');
ini_set('log_errors', 'On');
ini_set('error_log', __DIR__ . '/php-error.log');

$cacheDir = __DIR__ . '/cache';
if (!file_exists($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}

$action = $_GET['action'] ?? 'get_ids';
$forceRefresh = isset($_GET['force_refresh']) && $_GET['force_refresh'] === 'true';

error_log("=== PHP START: " . date('Y-m-d H:i:s') . " | Action: $action ===");

$apiKey = "DQ1TBOXSRPE196ER4018";
$apiPassword = "0&0eqfaSvwb1iGdHRWL0nJZ9heuDJA3y@J;37S8z";

// Function to authenticate and get token
function getAuthToken($apiKey, $apiPassword) {
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
        return null;
    }
    
    $authData = json_decode($authResponse, true);
    return $authData['data'][0]['access_token'];
}

// Function to get cached product
function getCachedProduct($productId, $cacheDir) {
    $cacheFile = $cacheDir . '/product_' . $productId . '.json';
    if (file_exists($cacheFile)) {
        $data = json_decode(file_get_contents($cacheFile), true);
        return $data;
    }
    return null;
}

// Function to save product to cache
function cacheProduct($product, $cacheDir) {
    $cacheFile = $cacheDir . '/product_' . $product['id'] . '.json';
    file_put_contents($cacheFile, json_encode($product, JSON_PRETTY_PRINT));
}






// Function to fetch product from API
function fetchProductFromAPI($productId, $accessToken) {
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
    
    if ($httpcode == 200) {
        $productData = json_decode($response, true);
        
        if (isset($productData['data']) && is_array($productData['data'])) {
            if (isset($productData['data'][0]) && count($productData['data']) == 1) {
                return $productData['data'][0];
            } else {
                return $productData['data'];
            }
        }
        return $productData;
    }
    
    return null;
}

header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');








// ACTION: Get all product IDs with modification dates
if ($action === 'get_ids') {
    $accessToken = getAuthToken($apiKey, $apiPassword);
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(["error" => "Authentication failed"]);
        exit;
    }
    
    error_log("Fetching all product IDs using GET /v1/products...");
    
    $allProductIds = [];
    $limit = 100; // GET endpoint supports higher limits
    $cursor = null;
    $iteration = 0;
    $maxIterations = 50; // Safety limit (100 * 50 = 5000 products max)
    
    while ($iteration < $maxIterations) {
        $iteration++;
        
        // Build URL with cursor
        $url = "https://pim.plytix.com/api/v1/products?limit=$limit";
        if ($cursor) {
            $url .= "&cursor=" . urlencode($cursor);
        }
        
        error_log("Iteration $iteration: Fetching from $url");
        
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
            error_log("Failed on iteration $iteration (HTTP $httpcode)");
            error_log("Response: " . substr($response, 0, 500));
            break;
        }
        
        $data = json_decode($response, true);
        
        // Log structure on first iteration
        if ($iteration === 1) {
            error_log("Response structure: " . json_encode(array_keys($data), JSON_PRETTY_PRINT));
        }
        
        // Handle different response structures
        $products = [];
        if (isset($data['data'])) {
            $products = $data['data'];
        } elseif (isset($data['products'])) {
            $products = $data['products'];
        } elseif (is_array($data) && isset($data[0]['id'])) {
            $products = $data;
        }
        
        if (empty($products)) {
            error_log("No products found in iteration $iteration");
            break;
        }
        
        foreach ($products as $product) {
            $allProductIds[] = [
                'id' => $product['id'],
                'modified' => $product['modified'] ?? null
            ];
        }
        
        error_log("Iteration $iteration: Got " . count($products) . " products (Total: " . count($allProductIds) . ")");
        
        // Check for cursor/pagination
        if (isset($data['pagination']['next_cursor'])) {
            $cursor = $data['pagination']['next_cursor'];
            error_log("Next cursor: $cursor");
        } elseif (isset($data['next_cursor'])) {
            $cursor = $data['next_cursor'];
            error_log("Next cursor: $cursor");
        } elseif (isset($data['pagination']['has_more']) && !$data['pagination']['has_more']) {
            error_log("No more pages (has_more = false)");
            break;
        } else {
            error_log("No cursor found, stopping");
            break;
        }
        
        // If we got fewer than limit, we're done
        if (count($products) < $limit) {
            error_log("Got fewer than limit ($products < $limit), stopping");
            break;
        }
        
        usleep(200000); // 200ms delay
    }
    
    error_log("Total product IDs fetched: " . count($allProductIds));
    
    echo json_encode([
        "success" => true,
        "total" => count($allProductIds),
        "products" => $allProductIds
    ]);
    exit;
}








// ACTION: Fetch batch of products
if ($action === 'fetch_batch') {
    $ids = $_GET['ids'] ?? '';
    if (empty($ids)) {
        echo json_encode(["error" => "No IDs provided"]);
        exit;
    }
    
    $productIds = explode(',', $ids);
    $accessToken = getAuthToken($apiKey, $apiPassword);
    
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(["error" => "Authentication failed"]);
        exit;
    }
    
    $products = [];
    $fetchedCount = 0;
    $cachedCount = 0;
    
    foreach ($productIds as $productId) {
        $productId = trim($productId);
        if (empty($productId)) continue;
        
        // Check cache first (unless force refresh)
        if (!$forceRefresh) {
            $cached = getCachedProduct($productId, $cacheDir);
            if ($cached) {
                $products[] = $cached;
                $cachedCount++;
                error_log("Using cached: $productId");
                continue;
            }
        }
        
        // Fetch from API
        error_log("Fetching from API: $productId");
        $product = fetchProductFromAPI($productId, $accessToken);
        
        if ($product) {
            cacheProduct($product, $cacheDir);
            $products[] = $product;
            $fetchedCount++;
        }
        
        usleep(100000); // 100ms delay between API calls
    }
    
    error_log("Batch complete: $cachedCount cached, $fetchedCount fetched");
    
    echo json_encode([
        "success" => true,
        "products" => $products,
        "cached" => $cachedCount,
        "fetched" => $fetchedCount
    ]);
    exit;
}

// ACTION: Check which products need updating
if ($action === 'check_updates') {
    $idsParam = $_GET['ids'] ?? '';
    if (empty($idsParam)) {
        echo json_encode(["needUpdate" => []]);
        exit;
    }
    
    $products = json_decode($idsParam, true);
    $needUpdate = [];
    
    foreach ($products as $product) {
        $productId = $product['id'];
        $apiModified = $product['modified'];
        
        $cached = getCachedProduct($productId, $cacheDir);
        
        if (!$cached) {
            $needUpdate[] = $productId;
        } else if ($apiModified && isset($cached['modified']) && $apiModified !== $cached['modified']) {
            $needUpdate[] = $productId;
            error_log("Product $productId needs update: API=$apiModified, Cache=$cached[modified]");
        }
    }
    
    error_log("Products needing update: " . count($needUpdate) . " / " . count($products));
    
    echo json_encode([
        "needUpdate" => $needUpdate
    ]);
    exit;
}

echo json_encode(["error" => "Invalid action"]);
?>
