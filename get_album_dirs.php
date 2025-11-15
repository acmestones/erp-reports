<?php
define('PHPWG_ROOT_PATH', '../');  // Go up one directory to Piwigo root
include_once(PHPWG_ROOT_PATH.'include/common.inc.php');

// Check if user is admin
if (!is_admin()) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$query = 'SELECT id, name, dir FROM '.CATEGORIES_TABLE.' ORDER BY id;';
$result = pwg_query($query);

$albums = [];
while ($row = pwg_db_fetch_assoc($result)) {
    $albums[] = [
        'id' => $row['id'],
        'name' => $row['name'],
        'dir' => $row['dir'],
        'isPhysical' => !empty($row['dir'])
    ];
}

header('Content-Type: application/json');
echo json_encode(['albums' => $albums]);
?>
