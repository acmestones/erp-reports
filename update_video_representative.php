<?php
define('PHPWG_ROOT_PATH','../');
include_once(PHPWG_ROOT_PATH.'include/common.inc.php');

if (!is_admin()) {
    die(json_encode(['success' => false, 'error' => 'Unauthorized']));
}

$video_id = isset($_POST['video_id']) ? intval($_POST['video_id']) : 0;

if (!$video_id) {
    die(json_encode(['success' => false, 'error' => 'Missing video_id']));
}

// Update database
$query = 'UPDATE '.IMAGES_TABLE.' 
          SET representative_ext = "jpg"
          WHERE id = '.$video_id;
pwg_query($query);

// Clear cache
invalidate_user_cache();

echo json_encode(['success' => true, 'video_id' => $video_id]);
?>
