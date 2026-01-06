<?php
// rebuild_cache.php - Run this ONCE to fix the 1022 vs 1001 discrepancy

$cacheDir = __DIR__ . '/cache';
$metadataFile = $cacheDir . '/metadata.json';

echo "=== CACHE REBUILD SCRIPT ===\n\n";

// Step 1: Count actual cache files
$files = glob($cacheDir . '/product_*.json');
if (!$files) {
    die("ERROR: No product cache files found!\n");
}

echo "Step 1: Found " . count($files) . " product cache files\n";

// Step 2: Rebuild metadata from actual files
$metadata = [
    'last_full_sync' => date('c'),
    'products' => []
];

$validCount = 0;
$errorCount = 0;

foreach ($files as $file) {
    $content = file_get_contents($file);
    if ($content === false) {
        echo "  WARNING: Could not read file: $file\n";
        $errorCount++;
        continue;
    }
    
    $product = json_decode($content, true);
    if ($product === null) {
        echo "  WARNING: Invalid JSON in file: $file\n";
        $errorCount++;
        continue;
    }
    
    if (!isset($product['id'])) {
        echo "  WARNING: Product has no ID in file: $file\n";
        $errorCount++;
        continue;
    }
    
    $metadata['products'][$product['id']] = 
        $product['modified'] ?? $product['created'] ?? date('c');
    $validCount++;
}

echo "Step 2: Rebuilt metadata with $validCount valid products";
if ($errorCount > 0) {
    echo " ($errorCount errors)";
}
echo "\n";

// Step 3: Save metadata
$saved = file_put_contents($metadataFile, json_encode($metadata, JSON_PRETTY_PRINT));
if ($saved === false) {
    die("ERROR: Could not save metadata file!\n");
}
echo "Step 3: Saved metadata.json (" . number_format($saved) . " bytes)\n";

// Step 4: Rebuild consolidated cache
echo "Step 4: Rebuilding consolidated cache...\n";

$allProducts = [];
foreach ($files as $file) {
    $content = file_get_contents($file);
    if ($content !== false) {
        $product = json_decode($content, true);
        if ($product !== null && isset($product['id'])) {
            $allProducts[] = $product;
        }
    }
}

$consolidatedFile = $cacheDir . '/all_products_consolidated.json';
$consolidatedData = [
    'success' => true,
    'products' => $allProducts,
    'timestamp' => time()
];

$saved = file_put_contents($consolidatedFile, json_encode($consolidatedData));
if ($saved === false) {
    die("ERROR: Could not save consolidated cache!\n");
}

echo "  Built consolidated cache with " . count($allProducts) . " products\n";
echo "  File size: " . number_format($saved) . " bytes\n";

// Step 5: Verification
echo "\n=== VERIFICATION ===\n";
echo "Cache files: " . count($files) . "\n";
echo "Metadata entries: " . count($metadata['products']) . "\n";
echo "Consolidated products: " . count($allProducts) . "\n";

if (count($files) === count($metadata['products']) && 
    count($metadata['products']) === count($allProducts)) {
    echo "\n✓ SUCCESS: All counts match! Cache is now synchronized.\n";
} else {
    echo "\n⚠ WARNING: Counts don't match. Check for corrupted cache files.\n";
}

echo "\nDone!\n";
?>
