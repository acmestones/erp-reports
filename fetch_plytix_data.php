<?php
header('Content-Type: application/json');

$apiKey = "DQ1TBOXSRPE196ER4018";
$apiSecret = "0&0eqfaSvwb1iGdHRWL0nJZ9heuDJA3y@J;37S8z";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://pim.plytix.com/api/v1/products/search");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_USERPWD, $apiKey . ":" . $apiSecret);
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(array("limit" => 100)));
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

if ($httpcode == 200) {
    $data = json_decode($response, true);
    if (isset($data['data']) && is_array($data['data'])) {
        echo json_encode($data['data']);
    } else {
        echo $response; // Show raw response if structure is unexpected
    }
} else {
    // Show detailed error for debugging
    echo json_encode(array(
        "error" => "API Error",
        "http_code" => $httpcode,
        "curl_error" => $curl_error,
        "response" => $response
    ));
}
?>

