<?php
$conn = new mysqli("localhost","u165026639_maintenance","Calcutta!60","u165026639_maintenance");

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "Connected successfully";
?>
