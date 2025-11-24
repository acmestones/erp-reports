<?php
header('Content-Type: application/json');

$apiKey = "DQ1TBOXSRPE196ER4018";
$apiSecret = "0&0eqfaSvwb1iGdHRWL0nJZ9heuDJA3y@J;37S8z";

// Step 1: Get access token
$authCh = curl_init();
curl_setopt($authCh, CURLOPT_URL, "https://pim.plytix.com/api/v1/auth/access_token");
curl_setopt($authCh, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($authCh, CURLOPT_POST, 1);
curl_setopt($authCh, CURLOPT_POSTFIELDS, json_encode(array(
    "api_key" => $apiKey,
    "api_secret" => $apiSecret
)));
curl_setopt($authCh, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
curl_setopt($authCh, CURLOPT_SSL_VERIFYPEER, false);

$authResponse = curl_exec($authCh);
$authData = json_decode($authResponse, true);
curl_close($authCh);

if (!isset($authData['access_token'])) {
    die(json_encode(array("error" => "Failed to get access token", "response" => $authData)));
}

$accessToken = $authData['access_token'];

// Step 2: Fetch products using Bearer token
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://pim.plytix.com/api/v1/products/search");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(array("limit" => 1000)));
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Content-Type: application/json',
    'Authorization: Bearer ' . $accessToken
));
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpcode == 200) {
    $data = json_decode($response, true);
    if (isset($data['data']) && is_array($data['data'])) {
        echo json_encode($data['data']);
    } else {
        echo $response;
    }
} else {
    echo json_encode(array("error" => "API Error", "http_code" => $httpcode, "response" => $response));
}
?>
