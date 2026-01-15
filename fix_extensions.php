<?php
// Enable error display for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Try to load Piwigo
define('PHPWG_ROOT_PATH','../');
if (!file_exists(PHPWG_ROOT_PATH.'include/common.inc.php')) {
    die('Error: Cannot find Piwigo. Make sure this file is in the /manage/ folder.');
}

include_once(PHPWG_ROOT_PATH.'include/common.inc.php');

// Check admin access
if (!is_admin()) {
    die('Access denied. You must be logged in as admin.');
}

set_time_limit(0);
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Fix Wrong File Extensions</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 20px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .button { background: #2196F3; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; }
        .button:hover { background: #1976D2; }
        .success { color: #4CAF50; padding: 10px; background: #e8f5e9; border-left: 4px solid #4CAF50; margin: 10px 0; }
        .error { color: #f44336; padding: 10px; background: #ffebee; border-left: 4px solid #f44336; margin: 10px 0; }
        .warning { color: #ff9800; padding: 10px; background: #fff3e0; border-left: 4px solid #ff9800; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 600; }
        .back-link { display: inline-block; margin-top: 20px; color: #2196F3; text-decoration: none; }
        .back-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Fix Wrong File Extensions</h1>
        <p>This tool detects images with wrong file extensions (e.g., PNG files named as .jpg)</p>
        
        <?php if (!isset($_POST['fix']) && !isset($_POST['scan'])): ?>
            <form method="post">
                <button type="submit" name="scan" class="button">🔍 Scan for Problems</button>
            </form>
        <?php endif; ?>

        <?php
        if (isset($_POST['scan']) || isset($_POST['fix'])) {
            echo '<div class="warning">⏳ Scanning images... Please wait...</div>';
            flush();
            
            $query = 'SELECT id, path, file FROM '.IMAGES_TABLE.' ORDER BY id';
            $result = pwg_query($query);
            
            $problems = array();
            $scanned = 0;
            
            while ($row = pwg_db_fetch_assoc($result)) {
                $scanned++;
                $file_path = PHPWG_ROOT_PATH.$row['path'];
                
                if (!file_exists($file_path)) {
                    continue;
                }
                
                $handle = @fopen($file_path, 'rb');
                if (!$handle) {
                    continue;
                }
                
                $header = fread($handle, 4);
                fclose($handle);
                
                if (strlen($header) < 4) {
                    continue;
                }
                
                $bytes = unpack('C*', $header);
                
                $real_type = '';
                
                // PNG: 89 50 4E 47
                if (isset($bytes[1]) && isset($bytes[2]) && $bytes[1] == 0x89 && $bytes[2] == 0x50) {
                    $real_type = 'png';
                }
                // JPEG: FF D8
                elseif (isset($bytes[1]) && isset($bytes[2]) && $bytes[1] == 0xFF && $bytes[2] == 0xD8) {
                    $real_type = 'jpg';
                }
                // GIF: 47 49 46
                elseif (isset($bytes[1]) && isset($bytes[2]) && isset($bytes[3]) && $bytes[1] == 0x47 && $bytes[2] == 0x49 && $bytes[3] == 0x46) {
                    $real_type = 'gif';
                }
                else {
                    continue;
                }
                
                $ext = strtolower(pathinfo($row['file'], PATHINFO_EXTENSION));
                
                // Check if mismatch
                if ($ext != $real_type && !($ext == 'jpeg' && $real_type == 'jpg')) {
                    $problems[] = array(
                        'id' => $row['id'],
                        'path' => $row['path'],
                        'file' => $row['file'],
                        'current_ext' => $ext,
                        'correct_ext' => $real_type
                    );
                }
            }
            
            echo '<div class="success">✅ Scanned '.$scanned.' images</div>';
            
            if (empty($problems)) {
                echo '<div class="success">✅ No problems found! All file extensions are correct.</div>';
            } else {
                echo '<div class="error">⚠️ Found '.count($problems).' files with wrong extensions:</div>';
                
                echo '<table><tr><th>ID</th><th>File</th><th>Current Ext</th><th>Correct Ext</th><th>Path</th></tr>';
                foreach ($problems as $p) {
                    echo '<tr>';
                    echo '<td>'.$p['id'].'</td>';
                    echo '<td><strong>'.$p['file'].'</strong></td>';
                    echo '<td style="color: #f44336;">'.$p['current_ext'].'</td>';
                    echo '<td style="color: #4CAF50;">'.$p['correct_ext'].'</td>';
                    echo '<td style="font-size: 11px;">'.htmlspecialchars($p['path']).'</td>';
                    echo '</tr>';
                }
                echo '</table>';
                
                if (!isset($_POST['fix'])) {
                    echo '<form method="post" style="margin-top: 20px;">';
                    echo '<button type="submit" name="fix" class="button">✅ Fix All '.count($problems).' Problems</button>';
                    echo '</form>';
                }
            }
            
            // Actually fix the files
            if (isset($_POST['fix']) && !empty($problems)) {
                echo '<div class="warning">⏳ Fixing files... Please wait...</div>';
                flush();
                
                $fixed = 0;
                $failed = 0;
                $failed_list = array();
                
                foreach ($problems as $p) {
                    $old_path = PHPWG_ROOT_PATH.$p['path'];
                    $path_info = pathinfo($old_path);
                    $new_path = $path_info['dirname'].'/'.$path_info['filename'].'.'.$p['correct_ext'];
                    
                    if (file_exists($new_path)) {
                        $failed++;
                        $failed_list[] = $p['file'].' (target already exists)';
                        continue;
                    }
                    
                    if (@rename($old_path, $new_path)) {
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
                        $failed_list[] = $p['file'].' (permission denied)';
                    }
                }
                
                echo '<div class="success"><strong>✅ Fixed '.$fixed.' files!</strong></div>';
                
                if ($failed > 0) {
                    echo '<div class="error">❌ Failed to fix '.$failed.' files:<br>';
                    foreach ($failed_list as $fail) {
                        echo '- '.$fail.'<br>';
                    }
                    echo '</div>';
                }
                
                if ($fixed > 0) {
                    echo '<div class="warning"><strong>📋 Next steps:</strong><br>
                          1. Go to <strong>Admin → Tools → Maintenance</strong><br>
                          2. Check "Regenerate Thumbnails" and click Submit<br>
                          3. Clear your browser cache (Ctrl+Shift+Delete)</div>';
                }
            }
        }
        ?>
        
        <a href="../admin.php" class="back-link">← Back to Admin Panel</a>
    </div>
</body>
</html>
