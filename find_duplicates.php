<?php
define('PHPWG_ROOT_PATH', '../../'); // Adjust path as needed
include_once(PHPWG_ROOT_PATH.'include/common.inc.php');

if (!is_admin()) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// 1. Get all images with their MD5 checksums
 $query = '
SELECT id, file, path, name 
FROM '.IMAGES_TABLE.' 
WHERE md5sum IS NOT NULL 
ORDER BY md5sum, id;';
 $result = pwg_query($query);

 $map = [];
while ($row = pwg_db_fetch_assoc($result)) {
    $md5 = $row['md5sum'];
    if (!isset($map[$md5])) {
        $map[$md5] = [];
    }
    $map[$md5][] = $row;
}

// 2. Filter only groups that have more than 1 image
 $duplicates = [];
foreach ($map as $md5 => $images) {
    if (count($images) > 1) {
        $duplicates[] = [
            'md5' => $md5,
            'images' => $images
        ];
    }
}

// 3. Return result
header('Content-Type: application/json');
echo json_encode([
    'groups' => $duplicates, 
    'total_groups' => count($duplicates)
]);
?>
