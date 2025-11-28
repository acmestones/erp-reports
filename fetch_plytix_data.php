<?php
set_time_limit(600);
ini_set('memory_limit', '512M');
ini_set('log_errors', 'On');
ini_set('error_log', __DIR__ . '/php-error.log');

$cacheDir = __DIR__ . '/cache';
if (!file_exists($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}

// Individual product cache files: cache/product_{id}.json
// Metadata file: cache/metadata.json (stores last fetch time and product modification times)

$metadataFile = $cacheDir . '/metadata.json';

$action = $_GET['action'] ?? 'get_status';
$forceRefresh = isset($_GET['force_refresh']) && $_GET['force_refresh'] === 'true';

error_log("=== PHP START: " . date('Y-m-d H:i:s') . " | Action: $action | Force: " . ($forceRefresh ? 'YES' : 'NO') . " ===");

$apiKey = "DQ1TBOXSRPE196ER4018";
$apiPassword = "0&0eqfaSvwb1iGdHRWL0nJZ9heuDJA3y@J;37S8z";

// Load or initialize metadata
function loadMetadata($metadataFile) {
    if (file_exists($metadataFile)) {
        return json_decode(file_get_contents($metadataFile), true);
    }
    return [
        'last_full_sync' => null,
        'products' => [] // product_id => last_modified_time
    ];
}

function saveMetadata($metadataFile, $metadata) {
    file_put_contents($metadataFile, json_encode($metadata, JSON_PRETTY_PRINT));
}

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

// Function to fetch product IDs with modification times
function fetchProductList($accessToken, $page = 1, $pageSize = 100) {
    $postData = [
        "pagination" => [
            "page" => $page,
            "page_size" => $pageSize
        ],
        "sort" => [["field" => "modified", "order" => "desc"]] // Sort by modified date
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
        return null;
    }
    
    $data = json_decode($response, true);
    return $data['data'] ?? [];
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

// ACTION 1: Get cache status and product list
if ($action === 'get_status') {
    error_log("Getting cache status...");
    
    $accessToken = getAuthToken($apiKey, $apiPassword);
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(["error" => "Authentication failed"]);
        exit;
    }
    
    // Fetch first page to get all product IDs with modification times
    $allProductIds = [];
    $page = 1;
    $maxPages = 50; // Adjust based on your product count
    
    error_log("Fetching product list...");
    
    while ($page <= $maxPages) {
        $products = fetchProductList($accessToken, $page, 100);
        
        if (!$products || count($products) === 0) {
            break;
        }
        
        foreach ($products as $product) {
            $allProductIds[] = [
                'id' => $product['id'],
                'modified' => $product['modified'] ?? $product['created'] ?? null
            ];
        }
        
        if (count($products) < 100) {
            break;
        }
        
        $page++;
        usleep(100000); // 100ms delay
    }
    
    error_log("Found " . count($allProductIds) . " products");
    
    // Load metadata to check which products are cached and which need updates
    $metadata = loadMetadata($metadataFile);
    
    $needUpdate = [];
    $cached = [];
    
    foreach ($allProductIds as $productInfo) {
        $productId = $productInfo['id'];
        $productFile = $cacheDir . '/product_' . $productId . '.json';
        
        // Check if product exists in cache
        if (!file_exists($productFile)) {
            $needUpdate[] = $productId;
        } else {
            // Check if product was modified since last cache
            $cachedModified = $metadata['products'][$productId] ?? null;
            $currentModified = $productInfo['modified'];
            
            if ($forceRefresh || ($currentModified && $cachedModified && $currentModified !== $cachedModified)) {
                $needUpdate[] = $productId;
                error_log("Product $productId needs update: cached=$cachedModified, current=$currentModified");
            } else {
                $cached[] = $productId;
            }
        }
    }
    
    error_log("Cached: " . count($cached) . ", Need update: " . count($needUpdate));
    
    echo json_encode([
        "success" => true,
        "total" => count($allProductIds),
        "cached" => count($cached),
        "needUpdate" => count($needUpdate),
        "cachedIds" => $cached,
        "needUpdateIds" => $needUpdate
    ]);
    exit;
}

// ACTION 2: Load cached products
if ($action === 'load_cached') {
    // Get IDs from POST or GET
    $ids = isset($_POST['ids']) ? json_decode($_POST['ids'], true) : json_decode($_GET['ids'] ?? '[]', true);
    
    if (!is_array($ids) || empty($ids)) {
        echo json_encode(["success" => true, "products" => []]);
        exit;
    }
    
    $products = [];
    foreach ($ids as $productId) {
        $productFile = $cacheDir . '/product_' . $productId . '.json';
        if (file_exists($productFile)) {
            $products[] = json_decode(file_get_contents($productFile), true);
        }
    }
    
    error_log("Loaded " . count($products) . " cached products");
    
    echo json_encode([
        "success" => true,
        "products" => $products
    ]);
    exit;
}

// ACTION 3: Fetch and cache specific products
if ($action === 'fetch_products') {
    // Get IDs from POST or GET
    $ids = isset($_POST['ids']) ? json_decode($_POST['ids'], true) : json_decode($_GET['ids'] ?? '[]', true);
    
    if (!is_array($ids) || empty($ids)) {
        echo json_encode(["success" => true, "products" => []]);
        exit;
    }
    
    $accessToken = getAuthToken($apiKey, $apiPassword);
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(["error" => "Authentication failed"]);
        exit;
    }
    
    $metadata = loadMetadata($metadataFile);
    $products = [];
    
    error_log("Fetching " . count($ids) . " products from API...");
    
    foreach ($ids as $productId) {
        $product = fetchProductDetails($productId, $accessToken);
        
        if ($product) {
            // Cache the product
            $productFile = $cacheDir . '/product_' . $productId . '.json';
            file_put_contents($productFile, json_encode($product, JSON_PRETTY_PRINT));
            
            // Update metadata
            $metadata['products'][$productId] = $product['modified'] ?? $product['created'] ?? date('c');
            
            $products[] = $product;
        }
        
        usleep(100000); // 100ms delay
    }
    
    // Save updated metadata
    $metadata['last_full_sync'] = date('c');
    saveMetadata($metadataFile, $metadata);
    
    error_log("Fetched and cached " . count($products) . " products");
    
    echo json_encode([
        "success" => true,
        "products" => $products
    ]);
    exit;
}

echo json_encode(["error" => "Invalid action"]);
?>
