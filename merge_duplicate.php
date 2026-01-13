<?php
// Enable error reporting so we can see any PHP crashes
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

define('PHPWG_ROOT_PATH', '../');
include_once(PHPWG_ROOT_PATH.'include/common.inc.php');

if (!is_admin()) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

 $masterId = isset($_POST['master_id']) ? intval($_POST['master_id']) : 0;
 $dupId = isset($_POST['dup_id']) ? intval($_POST['dup_id']) : 0;

if (!$masterId || !$dupId) {
    echo json_encode(['error' => 'Missing IDs']);
    exit;
}

// 1. Get all tags from the duplicate
 $query = 'SELECT tag_id FROM '.IMAGE_TAG_TABLE.' WHERE image_id = '.$dupId;
 $result = pwg_query($query);
 $dupTags = [];
while ($row = pwg_db_fetch_assoc($result)) {
    $dupTags[] = $row['tag_id'];
}

// 2. Add tags to Master (Using INSERT IGNORE to avoid duplicate errors)
if (count($dupTags) > 0) {
    foreach ($dupTags as $tagId) {
        $query = 'INSERT IGNORE INTO '.IMAGE_TAG_TABLE.' (image_id, tag_id) VALUES ('.$masterId.', '.$tagId.')';
        pwg_query($query);
    }
}

// 3. Delete the duplicate image
 $success = true;
 $error_msg = '';

// Try to delete physical file + DB entry using Piwigo function
try {
    include_once(PHPWG_ROOT_PATH.'admin/include/functions.php');
    delete_elements(array($dupId), true);
} catch (Exception $e) {
    // If standard delete fails (e.g. file permission), we fallback to removing DB entry only
    $success = false;
    $error_msg = $e->getMessage();
}

if (!$success) {
    // Fallback: Just remove from Database so the duplicate disappears from the list
    // Even if physical file remains, the merge (tags) is successful.
    $query = 'DELETE FROM '.IMAGES_TABLE.' WHERE id = '.$dupId;
    pwg_query($query);
    
    // Also remove associations
    $query = 'DELETE FROM '.IMAGE_CATEGORY_TABLE.' WHERE image_id = '.$dupId;
    pwg_query($query);
}

// 4. Return result
echo json_encode([
    'stat' => 'ok', 
    'message' => 'Merged and deleted successfully',
    'deleted_physically' => $success,
    'note' => $error_msg ? 'File delete failed (DB only): ' . $error_msg : 'File deleted'
]);
?>
