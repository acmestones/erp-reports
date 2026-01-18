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
        
        // Save thumbnail
        if (file_put_contents($thumb_path, $decoded_image)) {
            // Update database
            $query = 'UPDATE '.IMAGES_TABLE.' 
                      SET representative_ext = "jpg"
                      WHERE id = '.$video_id;
            pwg_query($query);
            
            invalidate_user_cache();
            
            echo json_encode(['success' => true, 'message' => 'Thumbnail saved successfully']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to save thumbnail']);
        }
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
                $thumb_url = $has_thumbnail ? $base_url . $video_dir . '/pwg_representative/' . $video_name . '.jpg' : null;
                
                $videos[] = array(
                    'id' => $row['id'],
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
        }
        .select-btn:hover {
            background: #2563eb;
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
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 Video Thumbnail Selector</h1>
        <p class="subtitle">Choose the perfect frame for each video thumbnail</p>
        
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

        function renderVideos() {
            let filteredVideos = videos;
            
            if (currentFilter === 'no-thumb') {
                filteredVideos = videos.filter(v => !v.has_thumbnail);
            } else if (currentFilter === 'has-thumb') {
                filteredVideos = videos.filter(v => v.has_thumbnail);
            }
            
            const html = filteredVideos.length === 0 ? 
                '<div style="text-align: center; padding: 40px; color: #666;">No videos found</div>' :
                filteredVideos.map(video => `
                    <div class="video-card ${video.has_thumbnail ? 'has-thumbnail' : ''}">
                        <div class="video-name" title="${video.name}">${video.name}</div>
                        ${video.has_thumbnail ? 
                            `<img src="${video.thumbnail_url}?${Date.now()}" class="current-thumb" alt="Current thumbnail">` :
                            '<div class="no-thumb">No thumbnail</div>'
                        }
                        <button class="select-btn" onclick="openModal(${video.id})">
                            ${video.has_thumbnail ? 'Change Thumbnail' : 'Create Thumbnail'}
                        </button>
                    </div>
                `).join('');
            
            document.getElementById('videoList').innerHTML = `<div class="video-list">${html}</div>`;
        }

        function openModal(videoId) {
            currentVideo = videos.find(v => v.id === videoId);
            document.getElementById('modalTitle').textContent = currentVideo.name;
            
            const video = document.getElementById('videoPlayer');
            video.src = currentVideo.url;
            
            document.getElementById('modal').classList.add('active');
            document.getElementById('saveBtn').disabled = true;
            document.getElementById('status').style.display = 'none';
            capturedImage = null;
            
            video.addEventListener('loadedmetadata', function() {
                document.getElementById('timeSlider').max = video.duration;
                document.getElementById('duration').textContent = formatTime(video.duration);
            });
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

        function captureFrame() {
            const video = document.getElementById('videoPlayer');
            const canvas = document.getElementById('previewCanvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            capturedImage = canvas.toDataURL('image/jpeg', 0.9);
            document.getElementById('saveBtn').disabled = false;
            
            showStatus('Frame captured! Click "Save Thumbnail" to upload.', 'success');
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
                    showStatus('✅ Thumbnail saved successfully!', 'success');
                    setTimeout(() => {
                        closeModal();
                        loadVideos(); // Refresh list
                    }, 1500);
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
    </script>
</body>
</html>
