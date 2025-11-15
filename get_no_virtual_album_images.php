<?php
define('PHPWG_ROOT_PATH', '../');
include_once(PHPWG_ROOT_PATH.'include/common.inc.php');

if (!is_admin()) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Get images that are ONLY in physical albums (no virtual album associations)
// This matches Piwigo's "With no virtual album" filter
$query = '
SELECT DISTINCT i.id, i.name, i.file, i.path
FROM '.IMAGES_TABLE.' AS i
INNER JOIN '.IMAGE_CATEGORY_TABLE.' AS ic ON i.id = ic.image_id
INNER JOIN '.CATEGORIES_TABLE.' AS c ON ic.category_id = c.id
WHERE c.dir IS NOT NULL
  AND i.id NOT IN (
    SELECT DISTINCT ic2.image_id
    FROM '.IMAGE_CATEGORY_TABLE.' AS ic2
    INNER JOIN '.CATEGORIES_TABLE.' AS c2 ON ic2.category_id = c2.id
    WHERE c2.dir IS NULL
  )
ORDER BY i.id DESC;';

$result = pwg_query($query);

$images = [];
while ($row = pwg_db_fetch_assoc($result)) {
    $images[] = [
        'id' => $row['id'],
        'name' => $row['name'],
        'file' => $row['file'],
        'path' => $row['path']
    ];
}

header('Content-Type: application/json');
echo json_encode(['images' => $images, 'count' => count($images)]);
?>
