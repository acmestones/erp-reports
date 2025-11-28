<?php
set_time_limit(600);
ini_set('memory_limit', '512M');
ini_set('log_errors', 'On');
ini_set('error_log', __DIR__ . '/php-error.log');

$cacheDir = __DIR__ . '/cache';
if (!file_exists($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}

// MASTER CACHE FILE - all products in one file for instant loading
$masterCacheFile = $cacheDir . '/all_products.json';

$action = $_GET['action'] ?? 'get_products';
$forceRefresh = isset($_GET['force_refresh']) && $_GET['force_refresh'] === 'true';

error_log("=== PHP START: " . date('Y-m-d H:i:s') . " | Action: $action | Force: " . ($forceRefresh ? 'YES' : 'NO') . " ===");

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

// Function to fetch all products with full details
function fetchAllProducts($accessToken) {
    error_log("Fetching all products from Plytix API...");
    
    $allProducts = [];
    $seenIds = [];
    $page = 1;
    $pageSize = 100;
    $maxPages = 50;
    
    while ($page <= $maxPages) {
        error_log("Fetching page $page...");
        
        $postData = [
            "pagination" => [
                "page" => $page,
                "page_size" => $pageSize
            ],
            "sort" => [["field" => "id", "order" => "asc"]]
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
        
        if ($httpcode != 200) {
            error_log("Failed on page $page (HTTP $httpcode)");
            break;
        }
        
        $data = json_decode($response, true);
        
        if (!isset($data['data']) || count($data['data']) === 0) {
            error_log("No data on page $page");
            break;
        }
        
        $newCount = 0;
        foreach ($data['data'] as $product) {
            if (!isset($seenIds[$product['id']])) {
                $seenIds[$product['id']] = true;
                
                // Fetch full product details
                $fullProduct = fetchProductDetails($product['id'], $accessToken);
                if ($fullProduct) {
                    $allProducts[] = $fullProduct;
                    $newCount++;
                }
            }
        }
        
        error_log("Page $page: $newCount new products (Total: " . count($allProducts) . ")");
        
        if ($newCount === 0 || count($data['data']) < $pageSize) {
            error_log("Last page detected");
            break;
        }
        
        $page++;
        usleep(200000); // 200ms delay
    }
    
    error_log("Total unique products fetched: " . count($allProducts));
    return $allProducts;
}

// Function to fetch full product details
function fetchProductDetails($productId, $accessToken) {
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

// ACTION: Get all products (instant from cache or fetch fresh)
if ($action === 'get_products') {
    
    // If force refresh OR cache doesn't exist, fetch fresh
    if ($forceRefresh || !file_exists($masterCacheFile)) {
        error_log("Fetching fresh data from API...");
        
        $accessToken = getAuthToken($apiKey, $apiPassword);
        if (!$accessToken) {
            http_response_code(500);
            echo json_encode(["error" => "Authentication failed"]);
            exit;
        }
        
        $allProducts = fetchAllProducts($accessToken);
        
        // Save to master cache
        file_put_contents($masterCacheFile, json_encode($allProducts, JSON_PRETTY_PRINT));
        error_log("Saved " . count($allProducts) . " products to master cache");
        
        echo json_encode([
            "success" => true,
            "total" => count($allProducts),
            "products" => $allProducts,
            "cached" => false
        ]);
        exit;
    }
    
    // Serve from cache - INSTANT!
    error_log("Serving from master cache (instant load)");
    $cachedProducts = json_decode(file_get_contents($masterCacheFile), true);
    
    echo json_encode([
        "success" => true,
        "total" => count($cachedProducts),
        "products" => $cachedProducts,
        "cached" => true
    ]);
    exit;
}

echo json_encode(["error" => "Invalid action"]);
?>
