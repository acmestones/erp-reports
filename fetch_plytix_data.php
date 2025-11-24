<?php
// --- CONFIGURATION ---
$apiKey = "DQ1TBOXSRPE196ER4018";
$apiSecret = "00eqfaSvwb1iGdHRWL0nJZ9heuDJA3yJ37S8z";

// --- FETCH FROM PLYTIX ---
header('Content-Type: application/json');

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://pim.plytix.com/api/v1/products/search");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_USERPWD, $apiKey . ":" . $apiSecret);
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(array("limit" => 1000))); // Adjust as needed

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpcode != 200) {
    http_response_code($httpcode);
    die(json_encode(array("error" => "Plytix API Error")));
}

$data = json_decode($response, true);
if (isset($data['data']) && is_array($data['data'])) {
    echo json_encode($data['data']); // Return products directly
} else {
    http_response_code(500);
    die(json_encode(array("error" => "Invalid data format")));
}
?>
