<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('PHPWG_ROOT_PATH','../');
if (!file_exists(PHPWG_ROOT_PATH.'include/common.inc.php')) {
    die('Error: Cannot find Piwigo.');
}

include_once(PHPWG_ROOT_PATH.'include/common.inc.php');

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
        body { font-family: Arial, sans-serif; max-width: 1400px; margin: 20px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .button { background: #2196F3; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; margin: 5px; }
        .button:hover { background: #1976D2; }
        .button-warn { background: #ff9800; }
        .button-warn:hover { background: #f57c00; }
        .success { color: #4CAF50; padding: 10px; background: #e8f5e9; border-left: 4px solid #4CAF50; margin: 10px 0; }
        .error { color: #f44336; padding: 10px; background: #ffebee; border-left: 4px solid #f44336; margin: 10px 0; }
        .warning { color: #ff9800; padding: 10px; background: #fff3e0; border-left: 4px solid #ff9800; margin: 10px 0; }
        .info { color: #2196F3; padding: 10px; background: #e3f2fd; border-left: 4px solid #2196F3; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; position: sticky; top: 0; }
        .fixed-row { background: #e8f5e9; }
        .failed-row { background: #ffebee; }
        .path-cell { font-size: 10px; color: #666; max-width: 300px; word-break: break-all; }
        .back-link { display: inline-block; margin-top: 20px; color: #2196F3; text-decoration: none; }
        .back-link:hover { text-decoration: underline; }
        .tabs { margin: 20px 0; border-bottom: 2px solid #e0e0e0; }
        .tab { display: inline-block; padding: 10px 20px; cursor: pointer; border: none; background: none; font-size: 14px; }
        .tab.active { border-bottom: 3px solid #2196F3; color: #2196F3; font-weight: 600; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Fix Wrong File Extensions - Enhanced</h1>
        <p>This tool detects and fixes images with wrong file extensions</p>
        
        <?php if (!isset($_POST['fix']) && !isset($_POST['scan']) && !isset($_POST['force_fix'])): ?>
            <form method="post">
                <button type="submit" name="scan" class="button">🔍 Scan for Problems</button>
            </form>
        <?php endif; ?>

        <?php
        if (isset($_POST['scan']) || isset($_POST['fix']) || isset($_POST['force_fix'])) {
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
                
                if (isset($bytes[1]) && isset($bytes[2]) && $bytes[1] == 0x89 && $bytes[2] == 0x50) {
                    $real_type = 'png';
                }
                elseif (isset($bytes[1]) && isset($bytes[2]) && $bytes[1] == 0xFF && $bytes[2] == 0xD8) {
                    $real_type = 'jpg';
                }
                elseif (isset($bytes[1]) && isset($bytes[2]) && isset($bytes[3]) && $bytes[1] == 0x47 && $bytes[2] == 0x49 && $bytes[3] == 0x46) {
                    $real_type = 'gif';
                }
                else {
                    continue;
                }
                
                $ext = strtolower(pathinfo($row['file'], PATHINFO_EXTENSION));
                
                if ($ext != $real_type && !($ext == 'jpeg' && $real_type == 'jpg')) {
                    $old_path = PHPWG_ROOT_PATH.$row['path'];
                    $path_info = pathinfo($old_path);
                    $new_path = $path_info['dirname'].'/'.$path_info['filename'].'.'.$real_type;
                    
                    $can_write = is_writable($old_path);
                    $target_exists = file_exists($new_path);
                    $perms = substr(sprintf('%o', fileperms($old_path)), -4);
                    
                    $problems[] = array(
                        'id' => $row['id'],
                        'path' => $row['path'],
                        'file' => $row['file'],
                        'current_ext' => $ext,
                        'correct_ext' => $real_type,
                        'can_write' => $can_write,
                        'target_exists' => $target_exists,
                        'permissions' => $perms,
                        'full_path' => $old_path
                    );
                }
            }
            
            echo '<div class="success">✅ Scanned '.$scanned.' images</div>';
            
            if (empty($problems)) {
                echo '<div class="success">✅ No problems found! All file extensions are correct.</div>';
            } else {
                $fixable = 0;
                $blocked = 0;
                foreach ($problems as $p) {
                    if ($p['can_write'] && !$p['target_exists']) $fixable++;
                    else $blocked++;
                }
                
                echo '<div class="info">📊 Found '.count($problems).' files with wrong extensions:<br>';
                echo '✅ <strong>'.$fixable.' can be fixed automatically</strong><br>';
                echo '⚠️ <strong>'.$blocked.' are blocked</strong> (permissions or target exists)</div>';
                
                // Tabs for different views
                echo '<div class="tabs">';
                echo '<button class="tab active" onclick="showTab(\'all\')">All Problems ('.count($problems).')</button>';
                echo '<button class="tab" onclick="showTab(\'fixable\')">Fixable ('.$fixable.')</button>';
                echo '<button class="tab" onclick="showTab(\'blocked\')">Blocked ('.$blocked.')</button>';
                echo '</div>';
                
                // All Problems Tab
                echo '<div id="tab-all" class="tab-content active">';
                echo '<table><tr><th>ID</th><th>File</th><th>Current</th><th>Correct</th><th>Writable</th><th>Target Exists</th><th>Perms</th><th>Path</th></tr>';
                foreach ($problems as $p) {
                    $row_class = ($p['can_write'] && !$p['target_exists']) ? 'fixed-row' : 'failed-row';
                    echo '<tr class="'.$row_class.'">';
                    echo '<td>'.$p['id'].'</td>';
                    echo '<td><strong>'.$p['file'].'</strong></td>';
                    echo '<td style="color: #f44336;">'.$p['current_ext'].'</td>';
                    echo '<td style="color: #4CAF50;">'.$p['correct_ext'].'</td>';
                    echo '<td>'.($p['can_write'] ? '✅' : '❌').'</td>';
                    echo '<td>'.($p['target_exists'] ? '❌ YES' : '✅ No').'</td>';
                    echo '<td>'.$p['permissions'].'</td>';
                    echo '<td class="path-cell">'.htmlspecialchars($p['path']).'</td>';
                    echo '</tr>';
                }
                echo '</table></div>';
                
                // Fixable Tab
                echo '<div id="tab-fixable" class="tab-content">';
                echo '<p class="success">These '.$fixable.' files can be fixed automatically:</p>';
                echo '<table><tr><th>ID</th><th>File</th><th>Current → Correct</th><th>Path</th></tr>';
                foreach ($problems as $p) {
                    if ($p['can_write'] && !$p['target_exists']) {
                        echo '<tr class="fixed-row">';
                        echo '<td>'.$p['id'].'</td>';
                        echo '<td><strong>'.$p['file'].'</strong></td>';
                        echo '<td>'.$p['current_ext'].' → '.$p['correct_ext'].'</td>';
                        echo '<td class="path-cell">'.htmlspecialchars($p['path']).'</td>';
                        echo '</tr>';
                    }
                }
                echo '</table></div>';
                
                // Blocked Tab
                echo '<div id="tab-blocked" class="tab-content">';
                echo '<p class="error">These '.$blocked.' files cannot be fixed automatically:</p>';
                echo '<table><tr><th>ID</th><th>File</th><th>Issue</th><th>Path</th></tr>';
                foreach ($problems as $p) {
                    if (!$p['can_write'] || $p['target_exists']) {
                        $issue = '';
                        if (!$p['can_write']) $issue = 'No write permission ('.$p['permissions'].')';
                        if ($p['target_exists']) $issue = 'Target file already exists';
                        
                        echo '<tr class="failed-row">';
                        echo '<td>'.$p['id'].'</td>';
                        echo '<td><strong>'.$p['file'].'</strong></td>';
                        echo '<td>'.$issue.'</td>';
                        echo '<td class="path-cell">'.htmlspecialchars($p['full_path']).'</td>';
                        echo '</tr>';
                    }
                }
                echo '</table></div>';
                
                if (!isset($_POST['fix']) && !isset($_POST['force_fix'])) {
                    echo '<form method="post" style="margin-top: 20px;">';
                    if ($fixable > 0) {
                        echo '<button type="submit" name="fix" class="button">✅ Fix '.$fixable.' Fixable Files</button>';
                    }
                    if ($blocked > 0) {
                        echo '<button type="submit" name="force_fix" class="button button-warn" onclick="return confirm(\'This will try to fix blocked files. For files where target exists, it will skip. For permission issues, it may still fail. Continue?\')">⚠️ Try Fixing Blocked Files</button>';
                    }
                    echo '</form>';
                }
            }
            
            // Actually fix the files
            if ((isset($_POST['fix']) || isset($_POST['force_fix'])) && !empty($problems)) {
                echo '<div class="warning">⏳ Fixing files... Please wait...</div>';
                flush();
                
                $fixed = 0;
                $skipped = 0;
                $failed = 0;
                $results = array();
                
                foreach ($problems as $p) {
                    // Skip if not fixable and not force mode
                    if (!isset($_POST['force_fix']) && (!$p['can_write'] || $p['target_exists'])) {
                        $skipped++;
                        continue;
                    }
                    
                    $old_path = PHPWG_ROOT_PATH.$p['path'];
                    $path_info = pathinfo($old_path);
                    $new_path = $path_info['dirname'].'/'.$path_info['filename'].'.'.$p['correct_ext'];
                    
                    if (file_exists($new_path)) {
                        $results[] = array('file' => $p['file'], 'status' => 'skipped', 'reason' => 'Target exists');
                        $skipped++;
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
                        
                        $results[] = array('file' => $p['file'], 'status' => 'fixed', 'new_name' => $new_file);
                        $fixed++;
                    } else {
                        $results[] = array('file' => $p['file'], 'status' => 'failed', 'reason' => 'Rename failed (permissions?)');
                        $failed++;
                    }
                }
                
                echo '<div class="success"><strong>✅ Fixed: '.$fixed.'</strong></div>';
                if ($skipped > 0) echo '<div class="warning"><strong>⏭️ Skipped: '.$skipped.'</strong></div>';
                if ($failed > 0) echo '<div class="error"><strong>❌ Failed: '.$failed.'</strong></div>';
                
                // Show detailed results
                if (!empty($results)) {
                    echo '<h3>Detailed Results:</h3>';
                    echo '<table><tr><th>File</th><th>Status</th><th>Details</th></tr>';
                    foreach ($results as $r) {
                        $row_class = $r['status'] == 'fixed' ? 'fixed-row' : 'failed-row';
                        echo '<tr class="'.$row_class.'">';
                        echo '<td>'.$r['file'].'</td>';
                        echo '<td>'.strtoupper($r['status']).'</td>';
                        echo '<td>'.($r['status'] == 'fixed' ? '→ '.$r['new_name'] : $r['reason']).'</td>';
                        echo '</tr>';
                    }
                    echo '</table>';
                }
                
                if ($fixed > 0) {
                    echo '<div class="info"><strong>📋 Next Steps:</strong><br>
                          1. Go to <strong>Admin → Tools → Maintenance</strong><br>
                          2. Check "Regenerate Thumbnails" and Submit<br>
                          3. Clear browser cache</div>';
                }
                
                echo '<form method="post"><button type="submit" name="scan" class="button">🔄 Scan Again</button></form>';
            }
        }
        ?>
        
        <a href="../admin.php" class="back-link">← Back to Admin</a>
    </div>
    
    <script>
    function showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        
        // Show selected tab
        document.getElementById('tab-' + tabName).classList.add('active');
        event.target.classList.add('active');
    }
    </script>
</body>
</html>
