<?php
define('PHPWG_ROOT_PATH', '../');
include_once(PHPWG_ROOT_PATH.'include/common.inc.php');

if (!is_admin()) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

 $masterId = $_POST['master_id'] ?? 0;
 $dupId = $_POST['dup_id'] ?? 0;

if (!$masterId || !$dupId) {
    echo json_encode(['error' => 'Missing IDs']);
    exit;
}

// 1. Get all tags from the duplicate
 $dupTags = [];
 $query = '
SELECT tag_id 
FROM '.IMAGE_TAG_TABLE.' 
WHERE image_id = '.$dupId;
 $result = pwg_query($query);

while ($row = pwg_db_fetch_assoc($result)) {
    $dupTags[] = $row['tag_id'];
}

// 2. Move tags to Master (avoiding duplicates)
if (count($dupTags) > 0) {
    foreach ($dupTags as $tagId) {
        // Check if Master already has this tag
        $check = pwg_db_fetch_assoc(pwg_query('
            SELECT image_id FROM '.IMAGE_TAG_TABLE.' 
            WHERE image_id = '.$masterId.' AND tag_id = '.$tagId
        '));
        
        if (!$check) {
            // Add tag to Master
            $insert = array(
                'image_id' => $masterId,
                'tag_id' => $tagId,
            );
            mass_inserts(IMAGE_TAG_TABLE, array($insert));
        }
    }
}

// 3. Delete the duplicate image (Physical file + DB entry)
include_once(PHPWG_ROOT_PATH.'admin/include/functions.php');
delete_elements(array($dupId), true);

echo json_encode(['stat' => 'ok', 'message' => 'Merged and deleted successfully']);
?>
