<?php
// =============================================================================
//  SECURE PLYTIX DATA FETCHER (v3 - Most Robust Version)
// =============================================================================

// --- CONFIGURATION ---
// IMPORTANT: Generate a NEW API key and secret in Plytix and paste them here.
$apiKey = 'DQ1TBOXSRPE196ER4018';
$apiSecret = '0&0eqfaSvwb1iGdHRWL0nJZ9heuDJA3y@J;37S8z';
$outputFile = 'products.json';
// --- END CONFIGURATION ---


// --- SCRIPT LOGIC ---
header('Content-Type: text/plain');

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.plytix.com/products');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

// Use the more reliable CURLOPT_USERPWD for authentication
curl_setopt($ch, CURLOPT_USERPWD, $apiKey . ':' . $apiSecret);

// SSL workaround for common hosting issues
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error_num = curl_errno($ch);
$curl_error_msg = curl_error($ch);
curl_close($ch);

if ($curl_error_num > 0) {
    http_response_code(500);
    die("❌ cURL Error (#" . $curl_error_num . "): " . $curl_error_msg);
}

if ($httpcode != 200) {
    http_response_code($httpcode);
    die("❌ Plytix API Error: Status code: " . $httpcode . "\nResponse: " . $response);
}

$data = json_decode($response, true);

if (isset($data['data']) && is_array($data['data'])) {
    $products = $data['data'];
    $jsonOutput = json_encode($products, JSON_PRETTY_PRINT);
    
    if (file_put_contents($outputFile, $jsonOutput)) {
        echo "✅ Success: " . count($products) . " products fetched and saved to " . $outputFile;
    } else {
        http_response_code(500);
        die("❌ File System Error: Could not write to '" . $outputFile . "'. Check permissions.");
    }
} else {
    http_response_code(500);
    die("❌ Data Format Error: Unexpected data format from Plytix.");
}
?>
