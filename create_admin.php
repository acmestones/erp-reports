<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'config/db.php';

$password = password_hash("admin123", PASSWORD_DEFAULT);

$sql = "INSERT INTO users (role_id, full_name, mobile, email, password, status)
        VALUES (1, 'Admin User', '9999999999', 'admin@acmestones.com', '$password', 'active')";

if ($conn->query($sql)) {
    echo "Admin created successfully";
} else {
    echo "Error: " . $conn->error;
}
?>
