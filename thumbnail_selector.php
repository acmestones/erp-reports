<?php
define('PHPWG_ROOT_PATH','../');
include_once(PHPWG_ROOT_PATH.'include/common.inc.php');

if (!is_admin()) {
    die('Access denied');
}

// Handle thumbnail upload
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    header('Content-Type: application/json');
    
    if ($_POST['action'] === 'save_thumbnail') {
        $video_id = intval($_POST['video_id']);
        $image_data = $_POST['image_data'];
        $video_path = $_POST['video_path'];
        
        // Decode base64 image
        $image_data = str_replace('data:image/jpeg;base64,', '', $image_data);
        $image_data = str_replace(' ', '+', $image_data);
        $decoded_image = base64_decode($image_data);
        
        // Determine paths
        $video_path_info = pathinfo($video_path);
        $video_dir = $video_path_info['dirname'];
        $video_name = $video_path_info['filename'];
        
        $thumb_dir = PHPWG_ROOT_PATH . $video_dir . '/pwg_representative';
        $thumb_path = $thumb_dir . '/' . $video_name . '.jpg';
        
        // Create directory if needed
        if (!file_exists($thumb_dir)) {
            mkdir($thumb_dir, 0755, true);
        }
        
        // Save new thumbnail
        if (file_put_contents($thumb_path, $decoded_image)) {
            // Update database
            $query = 'UPDATE '.IMAGES_TABLE.' 
                      SET representative_ext = "jpg"
                      WHERE id = '.$video_id;
            pwg_query($query);
            
            // CRITICAL: Delete ALL derivative cache files
            include_once(PHPWG_ROOT_PATH.'admin/include/functions.php');
            
            // Use Piwigo's function first
            clear_derivative_cache(array($video_id));
            
            // Get the exact stored path from database
            $query = 'SELECT path FROM '.IMAGES_TABLE.' WHERE id = '.$video_id;
            $result = pwg_query($query);
            $image_info = pwg_db_fetch_assoc($result);
            
            $deleted_count = 0;
            
            if ($image_info) {
                // Get just the filename without extension
                $stored_path = $image_info['path'];
                $path_parts = pathinfo($stored_path);
                $filename_no_ext = $path_parts['filename'];
                
                // Construct path to derivatives
                $derivative_base = PHPWG_ROOT_PATH . '_data/i/';
                
                if (is_dir($derivative_base)) {
                    // Get all subdirectories (square, thumb, small, medium, etc.)
                    $size_dirs = scandir($derivative_base);
                    
                    foreach ($size_dirs as $size_dir) {
                        if ($size_dir == '.' || $size_dir == '..') continue;
                        
                        $full_size_path = $derivative_base . $size_dir;
                        
                        if (is_dir($full_size_path)) {
                            // Get the stored path structure
                            // Piwigo stores derivatives like: _data/i/square/galleries/path/to/video-md5.jpg
                            
                            // Build the expected derivative path mirroring the gallery structure
                            $relative_path = str_replace('../', '', dirname($stored_path));
                            $derivative_folder = $full_size_path . '/' . $relative_path;
                            
                            if (is_dir($derivative_folder)) {
                                // Find all files in this folder matching the video name
                                $files = scandir($derivative_folder);
                                foreach ($files as $file) {
                                    if ($file == '.' || $file == '..') continue;
                                    
                                    // Match files that contain the video filename
                                    if (strpos($file, $filename_no_ext) === 0) {
                                        $full_file_path = $derivative_folder . '/' . $file;
                                        if (@unlink($full_file_path)) {
                                            $deleted_count++;
                                        }
                                    }
                                }
                            }
                            
                            // Also try direct glob pattern match
                            $pattern = $full_size_path . '/*/' . $filename_no_ext . '*';
                            $matches = glob($pattern);
                            foreach ($matches as $match_file) {
                                if (is_file($match_file) && @unlink($match_file)) {
                                    $deleted_count++;
                                }
                            }
                        }
                    }
                    
                    // Additional recursive search as fallback
                    $iterator = new RecursiveIteratorIterator(
                        new RecursiveDirectoryIterator($derivative_base, RecursiveDirectoryIterator::SKIP_DOTS),
                        RecursiveIteratorIterator::SELF_FIRST
                    );
                    
                    foreach ($iterator as $file) {
                        if ($file->isFile()) {
                            $basename = $file->getFilename();
                            // Check if filename starts with our video name
                            if (strpos($basename, $filename_no_ext) === 0) {
                                if (@unlink($file->getPathname())) {
                                    $deleted_count++;
                                }
                            }
                        }
                    }
                }
            }
            
            // Clear user cache
            invalidate_user_cache();
            
            echo json_encode([
                'success' => true, 
                'message' => 'Thumbnail saved successfully',
                'deleted_derivatives' => $deleted_count,
                'note' => $deleted_count > 0 ? 'Old thumbnails deleted. New ones will be generated automatically.' : 'No old derivatives found (this might be the first thumbnail).'
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to save thumbnail']);
        }
        exit;
    }
    
    if ($_POST['action'] === 'clear_single_video') {
        $video_id = intval($_POST['video_id']);
        
        include_once(PHPWG_ROOT_PATH.'admin/include/functions.php');
        
        // Use Piwigo's function
        clear_derivative_cache(array($video_id));
        
        // Get video info
        $query = 'SELECT path FROM '.IMAGES_TABLE.' WHERE id = '.$video_id;
        $result = pwg_query($query);
        $video_info = pwg_db_fetch_assoc($result);
        
        $deleted_count = 0;
        
        if ($video_info) {
            $filename_no_ext = pathinfo($video_info['path'], PATHINFO_FILENAME);
            
            // Aggressive deletion
            $derivative_base = PHPWG_ROOT_PATH . '_data/i/';
            
            if (is_dir($derivative_base)) {
                $iterator = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator($derivative_base, RecursiveDirectoryIterator::SKIP_DOTS),
                    RecursiveIteratorIterator::SELF_FIRST
                );
                
                foreach ($iterator as $file) {
                    if ($file->isFile()) {
                        $basename = $file->getFilename();
                        if (strpos($basename, $filename_no_ext) === 0) {
                            if (@unlink($file->getPathname())) {
                                $deleted_count++;
                            }
                        }
                    }
                }
            }
        }
        
        invalidate_user_cache();
        
        echo json_encode([
            'success' => true, 
            'message' => 'Cache cleared',
            'deleted' => $deleted_count
        ]);
        exit;
    }
    
    if ($_POST['action'] === 'get_videos') {
        $video_ext = array('mp4', 'mov', 'avi', 'mkv', 'webm', 'ogv', 'mpg', 'mpeg', 'm4v', '3gp', 'flv');
        
        $query = 'SELECT id, file, path, name 
                  FROM '.IMAGES_TABLE.' 
                  ORDER BY id DESC';
        $result = pwg_query($query);
        
        $videos = array();
        while ($row = pwg_db_fetch_assoc($result)) {
            $ext = strtolower(pathinfo($row['file'], PATHINFO_EXTENSION));
            if (in_array($ext, $video_ext)) {
                $base_url = get_absolute_root_url();
                $clean_path = str_replace('../', '', $row['path']);
                
                // Check for existing thumbnail
                $video_path_info = pathinfo($row['path']);
                $video_dir = $video_path_info['dirname'];
                $video_name = $video_path_info['filename'];
                $thumb_path = PHPWG_ROOT_PATH . $video_dir . '/pwg_representative/' . $video_name . '.jpg';
                
                $has_thumbnail = file_exists($thumb_path);
                $thumb_url = $has_thumbnail ? $base_url . $video_dir . '/pwg_representative/' . $video_name . '.jpg?t=' . time() : null;
                
                $videos[] = array(
                    'id' => intval($row['id']),
                    'file' => $row['file'],
                    'path' => $row['path'],
                    'name' => $row['name'] ?: $row['file'],
                    'url' => $base_url . $clean_path,
                    'has_thumbnail' => $has_thumbnail,
                    'thumbnail_url' => $thumb_url
                );
            }
        }
        
        echo json_encode(['videos' => $videos]);
        exit;
    }
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Video Thumbnail Selector</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 { 
            margin: 0 0 10px 0;
            color: #333;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        .video-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .video-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            background: #fafafa;
            transition: box-shadow 0.2s;
        }
        .video-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .video-card.has-thumbnail {
            background: #f0f9ff;
            border-color: #93c5fd;
        }
        .video-name {
            font-weight: 600;
            margin-bottom: 10px;
            color: #333;
            font-size: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .current-thumb {
            width: 100%;
            margin-bottom: 10px;
            border-radius: 4px;
            background: #e5e7eb;
            height: 180px;
            object-fit: cover;
        }
        .no-thumb {
            width: 100%;
            height: 180px;
            background: #e5e7eb;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #9ca3af;
            font-size: 14px;
            margin-bottom: 10px;
        }
        .select-btn {
            width: 100%;
            padding: 10px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 5px;
        }
        .select-btn:hover {
            background: #2563eb;
        }
        .select-btn.refresh-btn {
            background: #f59e0b;
        }
        .select-btn.refresh-btn:hover {
            background: #d97706;
        }
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 1000;
            padding: 20px;
            overflow: auto;
        }
        .modal.active {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .modal-content {
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 900px;
            width: 100%;
            max-height: 90vh;
            overflow: auto;
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .modal-header h2 {
            margin: 0;
            color: #333;
        }
        .close-btn {
            background: none;
            border: none;
            font-size: 28px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 32px;
            height: 32px;
            line-height: 1;
        }
        .close-btn:hover {
            color: #000;
        }
        .video-player {
            width: 100%;
            border-radius: 8px;
            background: #000;
            margin-bottom: 20px;
        }
        .controls {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .slider-container {
            margin-bottom: 15px;
        }
        .slider-label {
            display: block;
            margin-bottom: 8px;
            color: #666;
            font-size: 14px;
            font-weight: 500;
        }
        .time-slider {
            width: 100%;
            height: 8px;
            border-radius: 4px;
            outline: none;
            -webkit-appearance: none;
            background: #e5e7eb;
        }
        .time-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
        }
        .time-slider::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            border: none;
        }
        .time-display {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-top: 8px;
        }
        .preview-canvas {
            width: 100%;
            border-radius: 8px;
            border: 2px solid #e5e7eb;
            margin-bottom: 20px;
        }
        .button-group {
            display: flex;
            gap: 10px;
        }
        .btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
        }
        .btn-capture {
            background: #10b981;
            color: white;
        }
        .btn-capture:hover {
            background: #059669;
        }
        .btn-save {
            background: #3b82f6;
            color: white;
        }
        .btn-save:hover {
            background: #2563eb;
        }
        .btn-save:disabled {
            background: #9ca3af;
            cursor: not-allowed;
        }
        .status {
            padding: 12px;
            border-radius: 6px;
            margin-top: 15px;
            text-align: center;
            font-size: 14px;
            display: none;
        }
        .status.success {
            background: #d1fae5;
            color: #065f46;
            display: block;
        }
        .status.error {
            background: #fee2e2;
            color: #991b1b;
            display: block;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        .filter-buttons {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .filter-btn {
            padding: 8px 16px;
            border: 2px solid #e5e7eb;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        .filter-btn.active {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
        }
        .info-banner {
            background: #e0f2fe;
            border-left: 4px solid #0284c7;
            padding: 12px 16px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #075985;
        }
        .play-icon-toggle {
            margin-bottom: 15px;
            padding: 12px;
            background: #fef3c7;
            border-radius: 6px;
            border-left: 4px solid #f59e0b;
        }
        .play-icon-toggle label {
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #92400e;
        }
        .play-icon-toggle input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 Video Thumbnail Selector</h1>
        <p class="subtitle">Choose the perfect frame for each video thumbnail</p>
        
        <div class="info-banner">
            💡 <strong>How it works:</strong> Select a video, use the slider to find a good frame, capture it with a play icon overlay, and save. The script will automatically clear old cached thumbnails. Refresh your Piwigo gallery after saving!
        </div>
        
        <div class="filter-buttons">
            <button class="filter-btn active" onclick="filterVideos('all')">All Videos</button>
            <button class="filter-btn" onclick="filterVideos('no-thumb')">No Thumbnail</button>
            <button class="filter-btn" onclick="filterVideos('has-thumb')">Has Thumbnail</button>
        </div>
        
        <div id="videoList" class="loading">Loading videos...</div>
    </div>

    <div id="modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle">Select Thumbnail</h2>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            
            <video id="videoPlayer" class="video-player" controls crossorigin="anonymous"></video>
            
            <div class="controls">
                <div class="play-icon-toggle">
                    <label>
                        <input type="checkbox" id="addPlayIcon" checked>
                        <span>▶️ Add play icon overlay to thumbnail</span>
                    </label>
                </div>
                
                <div class="slider-container">
                    <label class="slider-label">Select Frame Position:</label>
                    <input type="range" id="timeSlider" class="time-slider" min="0" max="100" value="0" step="0.1">
                    <div class="time-display">
                        <span id="currentTime">0:00</span> / <span id="duration">0:00</span>
                    </div>
                </div>
            </div>
            
            <canvas id="previewCanvas" class="preview-canvas"></canvas>
            
            <div class="button-group">
                <button class="btn btn-capture" onclick="captureFrame()">📸 Capture This Frame</button>
                <button class="btn btn-save" id="saveBtn" onclick="saveThumbnail()" disabled>💾 Save Thumbnail</button>
            </div>
            
            <div id="status" class="status"></div>
        </div>
    </div>

    <script>
        let videos = [];
        let currentVideo = null;
        let capturedImage = null;
        let currentFilter = 'all';

        // Load videos
        async function loadVideos() {
            try {
                const response = await fetch('', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: 'action=get_videos'
                });
                const data = await response.json();
                videos = data.videos;
                renderVideos();
            } catch (error) {
                document.getElementById('videoList').innerHTML = '<div style="color: red;">Error loading videos: ' + error.message + '</div>';
            }
        }

        function filterVideos(filter) {
            currentFilter = filter;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            renderVideos();
        }

        async function clearVideoCache(videoId) {
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '⏳ Clearing...';
            btn.disabled = true;
            
            try {
                const response = await fetch('', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: 'action=clear_single_video&video_id=' + videoId
                });
                const data = await response.json();
                
                if (data.success) {
                    alert(`✅ Cleared ${data.deleted} cached thumbnail files! Hard refresh your Piwigo gallery (Ctrl+Shift+R).`);
                    setTimeout(() => loadVideos(), 500);
                } else {
                    alert('⚠️ Cache clear may have failed');
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            } catch (error) {
                alert('Error: ' + error.message);
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function renderVideos() {
            let filteredVideos = videos;
            
            if (currentFilter === 'no-thumb') {
                filteredVideos = videos.filter(v => !v.has_thumbnail);
            } else if (currentFilter === 'has-thumb') {
                filteredVideos = videos.filter(v => v.has_thumbnail);
            }
            
            const html = filteredVideos.length === 0 ? 
                '<div style="text-align: center; padding: 40px; color: #666;">No videos found</div>' :
                filteredVideos.map((video, index) => `
                    <div class="video-card ${video.has_thumbnail ? 'has-thumbnail' : ''}">
                        <div class="video-name" title="${escapeHtml(video.name)}">${escapeHtml(video.name)}</div>
                        ${video.has_thumbnail ? 
                            `<img src="${video.thumbnail_url}" class="current-thumb" alt="Current thumbnail">` :
                            '<div class="no-thumb">No thumbnail</div>'
                        }
                        <button class="select-btn" onclick="openModalById(${video.id})">
                            ${video.has_thumbnail ? 'Change Thumbnail' : 'Create Thumbnail'}
                        </button>
                        ${video.has_thumbnail ? 
                            `<button class="select-btn refresh-btn" onclick="clearVideoCache(${video.id})">
                                🔄 Clear Cache & Regenerate
                            </button>` : ''
                        }
                    </div>
                `).join('');
            
            document.getElementById('videoList').innerHTML = `<div class="video-list">${html}</div>`;
        }

        function openModalById(videoId) {
            const video = videos.find(v => v.id == videoId);
            if (!video) {
                alert('Video not found');
                return;
            }
            openModal(video);
        }

        function openModal(video) {
            currentVideo = video;
            document.getElementById('modalTitle').textContent = currentVideo.name;
            
            const videoElement = document.getElementById('videoPlayer');
            videoElement.src = currentVideo.url;
            
            document.getElementById('modal').classList.add('active');
            document.getElementById('saveBtn').disabled = true;
            document.getElementById('status').style.display = 'none';
            capturedImage = null;
            
            // Clear canvas
            const canvas = document.getElementById('previewCanvas');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            videoElement.addEventListener('loadedmetadata', function() {
                document.getElementById('timeSlider').max = videoElement.duration;
                document.getElementById('duration').textContent = formatTime(videoElement.duration);
            }, { once: true });
        }

        function closeModal() {
            document.getElementById('modal').classList.remove('active');
            document.getElementById('videoPlayer').pause();
            document.getElementById('videoPlayer').src = '';
        }

        document.getElementById('timeSlider').addEventListener('input', function(e) {
            const video = document.getElementById('videoPlayer');
            video.currentTime = e.target.value;
        });

        document.getElementById('videoPlayer').addEventListener('timeupdate', function() {
            const video = this;
            document.getElementById('timeSlider').value = video.currentTime;
            document.getElementById('currentTime').textContent = formatTime(video.currentTime);
        });

        function addPlayIconOverlay(ctx, width, height) {
            const centerX = width / 2;
            const centerY = height / 2;
            const iconSize = Math.min(width, height) / 5;
            const circleRadius = iconSize / 2;
            
            // Draw semi-transparent black circle background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw white circle border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Draw white play triangle
            const triangleSize = iconSize / 2.5;
            const offsetX = triangleSize / 8; // Shift right for visual centering
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.beginPath();
            ctx.moveTo(centerX - triangleSize / 2 + offsetX, centerY - triangleSize / 2);
            ctx.lineTo(centerX - triangleSize / 2 + offsetX, centerY + triangleSize / 2);
            ctx.lineTo(centerX + triangleSize / 2 + offsetX, centerY);
            ctx.closePath();
            ctx.fill();
        }

        function captureFrame() {
            const video = document.getElementById('videoPlayer');
            const canvas = document.getElementById('previewCanvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Draw video frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Add play button overlay if checkbox is checked
            if (document.getElementById('addPlayIcon').checked) {
                addPlayIconOverlay(ctx, canvas.width, canvas.height);
            }
            
            capturedImage = canvas.toDataURL('image/jpeg', 0.9);
            document.getElementById('saveBtn').disabled = false;
            
            const message = document.getElementById('addPlayIcon').checked ? 
                '✅ Frame captured with play icon! Click "Save Thumbnail" to upload.' :
                '✅ Frame captured! Click "Save Thumbnail" to upload.';
            showStatus(message, 'success');
        }

        async function saveThumbnail() {
            if (!capturedImage) return;
            
            document.getElementById('saveBtn').disabled = true;
            document.getElementById('saveBtn').textContent = 'Saving...';
            
            try {
                const response = await fetch('', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: new URLSearchParams({
                        action: 'save_thumbnail',
                        video_id: currentVideo.id,
                        video_path: currentVideo.path,
                        image_data: capturedImage
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showStatus(`✅ Thumbnail saved! Deleted ${data.deleted_derivatives} old cached files. Hard refresh Piwigo (Ctrl+Shift+R) to see changes.`, 'success');
                    setTimeout(() => {
                        closeModal();
                        loadVideos();
                    }, 3000);
                } else {
                    showStatus('❌ Error: ' + data.message, 'error');
                    document.getElementById('saveBtn').disabled = false;
                }
            } catch (error) {
                showStatus('❌ Error saving thumbnail: ' + error.message, 'error');
                document.getElementById('saveBtn').disabled = false;
            }
            
            document.getElementById('saveBtn').textContent = '💾 Save Thumbnail';
        }

        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = 'status ' + type;
        }

        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        // Load videos on page load
        loadVideos();
        
        // Close modal on ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        });
        
        // Close modal when clicking outside
        document.getElementById('modal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    </script>
</body>
</html>
