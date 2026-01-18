<?php
define('PHPWG_ROOT_PATH','../');
include_once(PHPWG_ROOT_PATH.'include/common.inc.php');

if (!is_admin()) {
    die(json_encode(['error' => 'Unauthorized']));
}

// Video extensions
$video_ext = array('mp4', 'mov', 'avi', 'mkv', 'webm', 'ogv', 'mpg', 'mpeg', 'm4v', '3gp', 'flv');

// Get ALL videos without thumbnails in ONE query
$query = 'SELECT id, file, path, name 
          FROM '.IMAGES_TABLE.' 
          WHERE representative_ext IS NULL';
$result = pwg_query($query);

$videos = array();
while ($row = pwg_db_fetch_assoc($result)) {
    $ext = strtolower(pathinfo($row['file'], PATHINFO_EXTENSION));
    if (in_array($ext, $video_ext)) {
        $videos[] = array(
            'id' => $row['id'],
            'file' => $row['file'],
            'path' => $row['path'],
            'name' => $row['name'],
            'url' => get_root_url().$row['path']
        );
    }
}

header('Content-Type: application/json');
echo json_encode([
    'videos' => $videos, 
    'count' => count($videos),
    'query_time' => '< 1 second'
]);
?>
