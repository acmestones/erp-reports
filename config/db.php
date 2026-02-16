<?php
$host = "localhost";
$dbname = "u165026639_maintenance";
$username = "u165026639_maintenance";
$password = "Calcutta!60";

$conn = new mysqli($host, $username, $password, $dbname);

if ($conn->connect_error) {
    die("DB Connection failed: " . $conn->connect_error);
}
?>
