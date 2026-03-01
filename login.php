<?php
session_start();
header('Content-Type: application/json');

// Load allowed users from user_settings.json
$settingsFile = __DIR__ . '/user_settings.json';
if (!file_exists($settingsFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'User settings file not found']);
    exit;
}

$settings = json_decode(file_get_contents($settingsFile), true);
$allowedUsers = array_column($settings['users'], 'email');

// Get user from POST
$postData = file_get_contents('php://input');
$data = json_decode($postData, true);
$userEmail = $data['user'] ?? null;

if (!$userEmail || !in_array($userEmail, $allowedUsers)) {
    http_response_code(403);
    echo json_encode(['error' => 'Access denied']);
    exit;
}

// Set session
$_SESSION['user'] = $userEmail;
echo json_encode(['success' => true]);
?>
