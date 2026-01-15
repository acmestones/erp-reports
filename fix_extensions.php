<?php
define('PHPWG_ROOT_PATH','./');
include_once(PHPWG_ROOT_PATH.'include/common.inc.php');

if (!is_admin()) {
    die('Access denied');
}

set_time_limit(0);
?>
<!DOCTYPE html>
<html>
<head>
    <title>Fix Wrong File Extensions</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 20px auto; padding: 20px; }
        .button { background: #2196F3; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
        .button:hover { background: #1976D2; }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
    </style>
</head>
<body>
    <h1>🔧 Fix Wrong File Extensions</h1>
    <p>This tool detects images with wrong file extensions (e.g., PNG files named as .jpg)</p>
    
    <?php if (!isset($_POST['fix'])): ?>
        <form method="post">
            <button type="submit" name="scan" class="button">1. Scan for Problems</button>
        </form>
    <?php endif; ?>

    <?php
    if (isset($_POST['scan']) || isset($_POST['fix'])) {
        $query = 'SELECT id, path, file FROM '.IMAGES_TABLE.' ORDER BY id';
        $result = pwg_query($query);
        
        $problems = [];
        
        while ($row = pwg_db_fetch_assoc($result)) {
            $file_path = PHPWG_ROOT_PATH.$row['path'];
            
            if (!file_exists($file_path)) continue;
            
            $handle = @fopen($file_path, 'rb');
            if (!$handle) continue;
            
            $header = fread($handle, 4);
            fclose($handle);
            
            $bytes = unpack('C*', $header);
            
            if ($bytes[1] == 0x89 && $bytes[2] == 0x50) {
                $real_type = 'png';
            } elseif ($bytes[1] == 0xFF && $bytes[2] == 0xD8) {
                $real_type = 'jpg';
            } elseif ($bytes[1] == 0x47 && $bytes[2] == 0x49) {
                $real_type = 'gif';
            } else {
                continue;
            }
            
            $ext = strtolower(pathinfo($row['file'], PATHINFO_EXTENSION));
            
            if ($ext != $real_type && !($ext == 'jpeg' && $real_type == 'jpg')) {
                $problems[] = [
                    'id' => $row['id'],
                    'path' => $row['path'],
                    'file' => $row['file'],
                    'current_ext' => $ext,
                    'correct_ext' => $real_type
                ];
            }
        }
        
        if (empty($problems)) {
            echo '<p class="success">✅ No problems found! All file extensions are correct.</p>';
        } else {
            echo '<p class="error">⚠️ Found '.count($problems).' files with wrong extensions:</p>';
            
            echo '<table><tr><th>ID</th><th>File</th><th>Current Ext</th><th>Correct Ext</th></tr>';
            foreach ($problems as $p) {
                echo '<tr><td>'.$p['id'].'</td><td>'.$p['file'].'</td><td>'.$p['current_ext'].'</td><td>'.$p['correct_ext'].'</td></tr>';
            }
            echo '</table>';
            
            if (!isset($_POST['fix'])) {
                echo '<form method="post"><button type="submit" name="fix" class="button" style="margin-top: 20px;">2. Fix All Problems</button></form>';
            }
        }
        
        // Actually fix the files
        if (isset($_POST['fix']) && !empty($problems)) {
            $fixed = 0;
            $failed = 0;
            
            foreach ($problems as $p) {
                $old_path = PHPWG_ROOT_PATH.$p['path'];
                $path_info = pathinfo($old_path);
                $new_path = $path_info['dirname'].'/'.$path_info['filename'].'.'.$p['correct_ext'];
                
                if (rename($old_path, $new_path)) {
                    $new_file = pathinfo($p['file'], PATHINFO_FILENAME).'.'.$p['correct_ext'];
                    $new_db_path = str_replace($p['file'], $new_file, $p['path']);
                    
                    $update = 'UPDATE '.IMAGES_TABLE.' 
                               SET file = "'.pwg_db_real_escape_string($new_file).'",
                                   path = "'.pwg_db_real_escape_string($new_db_path).'"
                               WHERE id = '.$p['id'];
                    pwg_query($update);
                    $fixed++;
                } else {
                    $failed++;
                }
            }
            
            echo '<p class="success">✅ Fixed '.$fixed.' files!</p>';
            if ($failed > 0) echo '<p class="error">❌ Failed to fix '.$failed.' files</p>';
            echo '<p><strong>Next steps:</strong><br>
                  1. Go to Admin → Tools → Maintenance<br>
                  2. Click "Regenerate Thumbnails"<br>
                  3. Clear your browser cache</p>';
        }
    }
    ?>
    
    <p style="margin-top: 30px;"><a href="admin.php">← Back to Admin</a></p>
</body>
</html>
