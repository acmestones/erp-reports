<?php
// Enable output buffering for better performance
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors in output

set_time_limit(600);
ini_set('memory_limit', '512M');
ini_set('log_errors', 'On');
ini_set('error_log', __DIR__ . '/php-error.log');

$cacheDir = __DIR__ . '/cache';
if (!file_exists($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}

$metadataFile = $cacheDir . '/metadata.json';

// Get action from GET or POST
$action = $_GET['action'] ?? $_POST['action'] ?? 'get_status';
$forceRefresh = (isset($_GET['forcerefresh']) && $_GET['forcerefresh'] == '1');
error_log("=== DEBUG: GET params: " . print_r($_GET, true) . " ===");
error_log("=== DEBUG: forceRefresh = " . ($forceRefresh ? 'TRUE' : 'FALSE') . " ===");




error_log("=== PHP START: " . date('Y-m-d H:i:s') . " | Action: $action | Force: " . ($forceRefresh ? 'YES' : 'NO') . " ===");

$apiKey = "DQ1TBOXSRPE196ER4018";
$apiPassword = "0&0eqfaSvwb1iGdHRWL0nJZ9heuDJA3y@J;37S8z";

function loadMetadata($metadataFile) {
    if (file_exists($metadataFile)) {
        return json_decode(file_get_contents($metadataFile), true);
    }
    return [
        'last_full_sync' => null,
        'products' => []
    ];
}

function saveMetadata($metadataFile, $metadata) {
    file_put_contents($metadataFile, json_encode($metadata, JSON_PRETTY_PRINT));
}

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

function fetchProductList($accessToken, $page = 1, $pageSize = 25) {
    $postData = [
        "pagination" => [
            "page" => $page,
            "page_size" => $pageSize
        ],
        "sort" => [["field" => "modified", "order" => "desc"]]
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




// Add this function after the existing helper functions
function fetchProductFamilies($accessToken) {
    // Correct endpoint from Plytix API docs: /product_families/search
    $postData = [
        "pagination" => [
            "page" => 1,
            "page_size" => 100
        ]
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://pim.plytix.com/api/v1/product_families/search");
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
    
    error_log("fetchProductFamilies: HTTP $httpcode");
    error_log("fetchProductFamilies: Response - " . substr($response, 0, 1000));
    
    if ($httpcode == 200) {
        $data = json_decode($response, true);
        return $data['data'] ?? [];
    }
    
    return null;
}












function buildConsolidatedCache($cacheDir) {
    $consolidatedFile = $cacheDir . '/all_products_consolidated.json';
    $allProducts = [];
    
    $files = glob($cacheDir . '/product_*.json');
    if (!$files) {
        error_log("No product files found in cache directory");
        return false;
    }
    
    foreach ($files as $file) {
        $content = file_get_contents($file);
        if ($content !== false) {
            $product = json_decode($content, true);
            if ($product !== null) {
                $allProducts[] = $product;
            }
        }
    }
    
    if (count($allProducts) === 0) {
        error_log("No products loaded from cache files");
        return false;
    }
    
    file_put_contents($consolidatedFile, json_encode([
        'success' => true,
        'products' => $allProducts,
        'timestamp' => time()
    ]));
    
    error_log("Built consolidated cache with " . count($allProducts) . " products");
    return true;
}




header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');




// ACTION 1: Get cache status and product list
if ($action === 'get_status') {
    error_log("Getting cache status...");
    
    $consolidatedFile = $cacheDir . '/all_products_consolidated.json';
    
    // Skip full check unless explicitly requested
    if (!$forceRefresh) {
        error_log("Using consolidated cache, skipping API check");
        
        $metadata = loadMetadata($metadataFile);
        $cachedIds = array_keys($metadata['products'] ?? []);
        
        echo json_encode([
            "success" => true,
            "total" => count($cachedIds),
            "cached" => count($cachedIds),
            "needUpdate" => 0,
            "cachedIds" => $cachedIds,  // ← FIXED! Now has actual IDs
            "needUpdateIds" => [],
            "hasConsolidated" => true,
            "quickLoad" => true
        ]);
        exit;
    }

    
    // Full status check (only when forceRefresh=1 or no cache exists)
    error_log("Performing full API check...");
    $accessToken = getAuthToken($apiKey, $apiPassword);
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(["error" => "Authentication failed"]);
        exit;
    }

    $allProductIds = [];
    $page = 1;
    $maxPages = 50;
    error_log("Fetching product list from Plytix...");
    while ($page <= $maxPages) {
        $products = fetchProductList($accessToken, $page, 25);
        if (!$products || count($products) === 0) {
            break;
        }
        
        foreach ($products as $product) {
            $allProductIds[] = [
                'id' => $product['id'],
                'modified' => $product['modified'] ?? $product['created'] ?? null
            ];
        }
        
        if (count($products) < 25) {
            break;
        }
        
        $page++;
        usleep(100000);
    }

    error_log("Found " . count($allProductIds) . " products from API");
    
    $metadata = loadMetadata($metadataFile);
    $needUpdate = [];
    $cached = [];

foreach ($allProductIds as $productInfo) {
    $productId = $productInfo['id'];
    $productFile = $cacheDir . '/product_' . $productId . '.json';
    
    if (!file_exists($productFile)) {
        $needUpdate[] = $productId;
    } else {
        $cachedModified = $metadata['products'][$productId] ?? null;
        $currentModified = $productInfo['modified'];
        
        // Only refetch if timestamps actually differ
        if ($currentModified && $cachedModified && $currentModified !== $cachedModified) {
            $needUpdate[] = $productId;
            error_log("Product $productId needs update: cached=$cachedModified, current=$currentModified");
        } else {
            $cached[] = $productId;
        }
    }
}


    error_log("Cached: " . count($cached) . ", Need update: " . count($needUpdate));
    
    $hasConsolidated = file_exists($consolidatedFile);

    echo json_encode([
        "success" => true,
        "total" => count($allProductIds),
        "cached" => count($cached),
        "needUpdate" => count($needUpdate),
        "cachedIds" => $cached,
        "needUpdateIds" => $needUpdate,
        "hasConsolidated" => $hasConsolidated && count($needUpdate) === 0,
        "quickLoad" => false
    ]);
    exit;
}






// ACTION 1.5: Load from consolidated cache (fast path)
if ($action === 'load_consolidated') {
    $consolidatedFile = $cacheDir . '/all_products_consolidated.json';
    
    if (file_exists($consolidatedFile)) {
        // Check if file is recent (less than 1 hour old)
        $fileTime = filemtime($consolidatedFile);
        $currentTime = time();
        
        if (($currentTime - $fileTime) < 3600) {
            // File is fresh, serve it directly
            error_log("Serving from consolidated cache");
            header('Content-Type: application/json');
            readfile($consolidatedFile);
            exit;
        }
    }
    
    // Build new consolidated cache
    error_log("Building new consolidated cache");
    if (buildConsolidatedCache($cacheDir)) {
        header('Content-Type: application/json');
        readfile($consolidatedFile);
        exit;
    }
    
    // Fallback
    echo json_encode(["success" => false, "error" => "Could not build cache"]);
    exit;
}









// ACTION 2: Load cached products
if ($action === 'load_cached') {
    // Handle POST data
    $postData = file_get_contents('php://input');
    if ($postData) {
        $decoded = json_decode($postData, true);
        $ids = $decoded['ids'] ?? [];
    } else {
        $ids = json_decode($_GET['ids'] ?? '[]', true);
    }

    if (!is_array($ids) || empty($ids)) {
        echo json_encode(["success" => true, "products" => []]);
        exit;
    }

    $products = [];
    
    // Read files with minimal overhead
    foreach ($ids as $productId) {
        $productFile = $cacheDir . '/product_' . $productId . '.json';
        if (file_exists($productFile)) {
            // Use file_get_contents without extra checks for speed
            $content = @file_get_contents($productFile);
            if ($content !== false) {
                $decoded = json_decode($content, true);
                if ($decoded !== null) {
                    $products[] = $decoded;
                }
            }
        }
    }
    error_log("Loaded " . count($products) . " cached products from " . count($ids) . " requested");
    
    echo json_encode([
        "success" => true,
        "products" => $products
    ]);
    exit;

}







// ACTION 3: Fetch and cache specific products
if ($action === 'fetch_products') {
    // Handle POST data
    $postData = file_get_contents('php://input');
    if ($postData) {
        $decoded = json_decode($postData, true);
        $ids = $decoded['ids'] ?? [];
    } else {
        $ids = json_decode($_GET['ids'] ?? '[]', true);
    }
    
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
            $productFile = $cacheDir . '/product_' . $productId . '.json';
            file_put_contents($productFile, json_encode($product, JSON_PRETTY_PRINT));
            
            $metadata['products'][$productId] = $product['modified'] ?? $product['created'] ?? date('c');
            
            $products[] = $product;
        }
        
        usleep(100000);
    }
    
        $metadata['last_full_sync'] = date('c');
        saveMetadata($metadataFile, $metadata);
        error_log("Fetched and cached " . count($products) . " products");
        
        // Rebuild consolidated cache after updates
        if (count($products) > 0) {
            buildConsolidatedCache($cacheDir);
        }
        
        echo json_encode([
            "success" => true,
            "products" => $products
        ]);
        exit;

}




// ACTION 4: Get product families list
if ($action === 'get_families') {
    error_log("GET_FAMILIES: Starting...");
    
    $accessToken = getAuthToken($apiKey, $apiPassword);
    if (!$accessToken) {
        error_log("GET_FAMILIES: Auth failed");
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Authentication failed"]);
        exit;
    }
    
    error_log("GET_FAMILIES: Got token, fetching families from API...");
    $families = fetchProductFamilies($accessToken);
    
    if ($families !== null && count($families) > 0) {
        error_log("GET_FAMILIES: Got " . count($families) . " families from API");
        
        // Build ID -> Name map
        $familyMap = [];
        foreach ($families as $family) {
            if (isset($family['id']) && isset($family['name'])) {
                $familyMap[$family['id']] = $family['name'];
            }
        }
        
        error_log("GET_FAMILIES: Built map with " . count($familyMap) . " entries");
        echo json_encode([
            "success" => true,
            "families" => $familyMap
        ]);
        exit;
    }
    
    // FALLBACK: If API fails, extract IDs from cached products
    error_log("GET_FAMILIES: API returned no data, using fallback...");
    
    $familyMap = [];
    $cacheFiles = glob($cacheDir . '/product_*.json');
    
    if ($cacheFiles) {
        $sampled = array_slice($cacheFiles, 0, 100);
        
        foreach ($sampled as $file) {
            $content = @file_get_contents($file);
            if ($content) {
                $product = json_decode($content, true);
                if ($product && isset($product['product_family_id'])) {
                    $familyId = $product['product_family_id'];
                    if (!isset($familyMap[$familyId])) {
                        $familyMap[$familyId] = $familyId;
                    }
                }
            }
        }
    }
    
    echo json_encode([
        "success" => true,
        "families" => $familyMap
    ]);
    exit;
}







// ACTION: Update product field
if ($action === 'update_product') {
    $postData = file_get_contents('php://input');
    $data = json_decode($postData, true);

    $productId = $data['productId'] ?? null;
    $updates   = $data['updates'] ?? [];

    if (!$productId || empty($updates)) {
        echo json_encode(['success' => false, 'error' => 'Missing productId or updates']);
        exit;
    }

    // Get access token using existing credentials
    $accessToken = getAuthToken($apiKey, $apiPassword);
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Authentication failed']);
        exit;
    }

    // Convert 'true'/'false' strings to booleans
    foreach ($updates as $key => $value) {
        if ($value === 'true')  $updates[$key] = true;
        if ($value === 'false') $updates[$key] = false;
    }

    // Payload format per Plytix docs
    $payload = ['attributes' => $updates];
    $payloadJson = json_encode($payload);

    error_log("Plytix Update - Product ID: {$productId}");
    error_log("Plytix Update - Payload: {$payloadJson}");

    $updateUrl = "https://pim.plytix.com/api/v1/products/{$productId}";

    $ch = curl_init($updateUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payloadJson);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $response  = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    error_log("Plytix Update - Response HTTP Code: {$httpCode}");
    error_log("Plytix Update - Response Body: {$response}");
    if ($curlError) {
        error_log("Plytix Update - cURL Error: {$curlError}");
    }

if ($httpCode >= 200 && $httpCode < 300) {
    // Clear cache for this product
    $cacheFile = $cacheDir . '/product_' . $productId . '.json';
    if (file_exists($cacheFile)) {
        unlink($cacheFile);
    }
    
    // Also clear consolidated cache to force rebuild
    $consolidatedFile = $cacheDir . '/all_products_consolidated.json';
    if (file_exists($consolidatedFile)) {
        unlink($consolidatedFile);
    }

    echo json_encode(['success' => true, 'message' => 'Product updated']);
} else {
    $errorDetail = json_decode($response, true);
    $errorMsg = $errorDetail['error']['msg'] ?? 'Failed to update product in Plytix';

    echo json_encode([
        'success'  => false,
        'error'    => $errorMsg,
        'httpCode' => $httpCode,
        'details'  => $response
    ]);
}
exit;

}





// ACTION: Get all product attributes
if ($action === 'get_all_attributes') {
    // Get access token
    $accessToken = getAuthToken($apiKey, $apiPassword);
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Authentication failed']);
        exit;
    }

    // Fetch all product attributes from Plytix
    $url = "https://pim.plytix.com/api/v1/attributes/product/search";
    $postData = [
        "filters" => [],
        "attributes" => ["name", "label", "type_class", "options"],
        "pagination" => [
            "page_size" => 500,
            "page" => 1,
            "order" => ""
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $data = json_decode($response, true);
        if (!empty($data['data'])) {
            // Build name -> attribute map
            $attributeMap = [];
            foreach ($data['data'] as $attr) {
                $attributeMap[$attr['name']] = [
                    'name' => $attr['name'],
                    'label' => $attr['label'],
                    'type' => $attr['type_class'],
                    'options' => $attr['options'] ?? []
                ];
            }
            echo json_encode(['success' => true, 'attributes' => $attributeMap]);
        } else {
            echo json_encode(['success' => false, 'error' => 'No attributes found']);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to fetch attributes']);
    }
    exit;
}








// ACTION: Get attribute definition
if ($action === 'get_attribute_definition') {
    $attrName = $_GET['attribute'] ?? null;
    if (!$attrName) {
        echo json_encode(['success' => false, 'error' => 'Missing attribute name']);
        exit;
    }

    // Get access token
    $accessToken = getAuthToken($apiKey, $apiPassword);
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Authentication failed']);
        exit;
    }

    // Fetch attribute definition from Plytix
    $url = "https://pim.plytix.com/api/v1/attributes/product/search";
    $postData = [
        "filters" => [[["field" => "name", "operator" => "=", "value" => $attrName]]], // CHANGED: name + =
        "attributes" => ["name", "label", "type_class", "options"],
        "pagination" => [
            "page_size" => 1,
            "page" => 1,
            "order" => ""
        ]
    ];

        // ADD THIS MISSING CODE:
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $data = json_decode($response, true);
        if (!empty($data['data'])) {
            $attribute = $data['data'][0];
            echo json_encode([
                'success' => true,
                'attribute' => [
                    'name' => $attribute['name'],
                    'label' => $attribute['label'],
                    'type' => $attribute['type_class'],
                    'options' => $attribute['options'] ?? []
                ]
            ]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Attribute not found']);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to fetch attribute definition']);
    }
    exit;
}






function fetchAllCategories($accessToken) {
    $postData = [
        "filters" => [],
        "attributes" => ["id", "name", "path"],
        "pagination" => [
            "page_size" => 500,
            "page" => 1,
            "order" => ""
        ]
    ];

    $ch = curl_init("https://pim.plytix.com/api/v1/categories/search");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    error_log("fetchAllCategories: HTTP $httpCode");
    error_log("fetchAllCategories response: " . substr($response, 0, 1000));

    if ($httpCode === 200) {
        $data = json_decode($response, true);
        return $data['data'] ?? [];
    }
    return [];
}



//Action: Get list of categories
if ($action === 'get_all_categories') {
    $accessToken = getAuthToken($apiKey, $apiPassword);
    if (!$accessToken) {
        echo json_encode(['success' => false, 'error' => 'Authentication failed']);
        exit;
    }

    $cats = fetchAllCategories($accessToken);
    echo json_encode(['success' => true, 'categories' => $cats]);
    exit;
}


//Action : Update categories
if ($action === 'update_categories') {
    $postData = file_get_contents('php://input');
    $data = json_decode($postData, true);

    $productId   = $data['productId']   ?? null;
    $categoryIds = $data['categoryIds'] ?? [];

    if (!$productId) {
        echo json_encode(['success' => false, 'error' => 'Missing productId']);
        exit;
    }

    $accessToken = getAuthToken($apiKey, $apiPassword);
    if (!$accessToken) {
        echo json_encode(['success' => false, 'error' => 'Authentication failed']);
        exit;
    }

    // Simple strategy: clear existing categories (not via API, just by re‑setting all)
    // First, unlink all current categories if needed (Plytix docs allow linking; for full sync you may need unlink endpoint too.)
    // Here we'll just link the desired ones; duplicates should be harmless.

    foreach ($categoryIds as $catId) {
        $url = "https://pim.plytix.com/api/v1/products/{$productId}/categories";
        $payload = json_encode(['id' => $catId]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode < 200 || $httpCode >= 300) {
            error_log("Update categories failed for product {$productId} / category {$catId}: HTTP {$httpCode} - {$response}");
        }
    }

    // Re-fetch product to return updated categories
    $updated = fetchProductDetails($productId, $accessToken);
    $categories = $updated['categories'] ?? [];

    echo json_encode(['success' => true, 'categories' => $categories]);
    exit;
}















echo json_encode(["error" => "Invalid action"]);


// Flush output buffer
ob_end_flush();
?>
