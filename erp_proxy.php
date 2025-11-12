<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

define('API_KEY', '2f721d295151824');
define('API_SECRET', '0e9e87c5238a8a3');
define('ERP_BASE', 'https://acmestones.erpnext.com');

function logError($message) {
    error_log(date('Y-m-d H:i:s') . " - " . $message . "\n", 3, "erp_debug.log");
}



// Add this near the top of erp_proxy.php, BEFORE any other action checks

// Proxy private images with authentication
if (isset($_GET['action']) && $_GET['action'] == 'proxy_image') {
    $file_url = $_GET['file_url'] ?? '';
    
    if (empty($file_url)) {
        header('HTTP/1.1 400 Bad Request');
        echo 'No file URL provided';
        exit;
    }
    
    // Build full ERPNext URL
    if (!str_starts_with($file_url, 'http')) {
        $file_url = ERP_BASE . $file_url;
    }
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $file_url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_FOLLOWLOCATION => true
    ]);
    
    $image_data = curl_exec($ch);
    $content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code == 200 && $image_data) {
        // Return the image with proper content type
        header("Content-Type: " . $content_type);
        header("Cache-Control: public, max-age=86400"); // Cache for 1 day
        echo $image_data;
    } else {
        header('HTTP/1.1 404 Not Found');
        echo 'Image not found';
    }
    exit;
}







// Get users.json
if (isset($_GET['action']) && $_GET['action'] == 'get_users') {
    if (file_exists("users.json")) {
        echo file_get_contents("users.json");
    } else {
        echo json_encode(["error" => "users.json not found"]);
    }
    exit;
}

// Get all available reports
if (isset($_GET['action']) && $_GET['action'] === 'get_all_reports') {
    $ch = curl_init();
    $url = ERP_BASE . "/api/resource/Report?fields=[\"name\",\"ref_doctype\",\"report_type\"]&limit_page_length=999";
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Authorization: token " . API_KEY . ":" . API_SECRET],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    echo $res;
    exit;
}

// Get report data
if (isset($_GET['report'])) {
    $report = $_GET['report'];
    $ch = curl_init();
    $url = ERP_BASE . "/api/method/frappe.desk.query_report.run?report_name=" . urlencode($report) . "&ignore_prepared_report=1";
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Authorization: token " . API_KEY . ":" . API_SECRET],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    echo $res;
    exit;
}

// NEW: Get a single document
if (isset($_GET['action']) && $_GET['action'] == 'get_doc') {
    $doctype = $_GET['doctype'] ?? '';
    $docname = $_GET['docname'] ?? '';
    
    if (empty($doctype) || empty($docname)) {
        echo json_encode(['error' => 'Missing doctype or docname']);
        exit;
    }
    
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/' . urlencode($doctype) . '/' . urlencode($docname);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code != 200) {
        logError("get_doc failed: HTTP $http_code - $response");
    }
    
    echo $response;
    exit;
}

// NEW: Make file public by updating File document
if (isset($_GET['action']) && $_GET['action'] == 'make_file_public') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (json_last_error() != JSON_ERROR_NONE) {
        echo json_encode(['error' => 'Invalid JSON input']);
        exit;
    }
    
    $file_url = $input['file_url'] ?? '';
    
    if (empty($file_url)) {
        echo json_encode(['error' => 'No file URL provided']);
        exit;
    }
    
    // Extract file path from URL (e.g., /files/image.png -> /files/image.png)
    $parsed = parse_url($file_url);
    $file_path = $parsed['path'] ?? $file_url;
    
    logError("Making file public: " . $file_path);
    
    // First, get the File document by file_url
    $ch = curl_init();
    $search_url = ERP_BASE . '/api/resource/File?filters=[["file_url","=","' . $file_path . '"]]&fields=["name","is_private"]';
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $search_url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $search_result = curl_exec($ch);
    curl_close($ch);
    
    $search_data = json_decode($search_result, true);
    
    if (isset($search_data['data']) && count($search_data['data']) > 0) {
        $file_doc = $search_data['data'][0];
        $file_name = $file_doc['name'];
        
        // Update the File document to make it public
        $ch = curl_init();
        $update_url = ERP_BASE . '/api/resource/File/' . urlencode($file_name);
        
        $update_data = json_encode([
            'is_private' => 0
        ]);
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $update_url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => 'PUT',
            CURLOPT_POSTFIELDS => $update_data,
            CURLOPT_HTTPHEADER => [
                "Authorization: token " . API_KEY . ":" . API_SECRET,
                "Content-Type: application/json"
            ],
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        
        $update_result = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        logError("Make public response (HTTP $http_code): " . $update_result);
        
        echo $update_result;
    } else {
        echo json_encode(['error' => 'File document not found']);
    }
    
    exit;
}

// Update field using frappe.db.set_value (works for submitted docs)
if (isset($_GET['action']) && $_GET['action'] === 'update_field') {
    $input = json_decode(file_get_contents("php://input"), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(["error" => "Invalid JSON input"]);
        exit;
    }

    $doctype = $input['doctype'] ?? '';
    $docname = $input['docname'] ?? '';
    $fieldname = $input['fieldname'] ?? '';
    $value = $input['value'] ?? '';
    if (!$doctype || !$docname || !$fieldname) {
        echo json_encode(["error" => "Missing parameters"]);
        exit;
    }

    logError("Updating via set_value: $doctype / $docname / $fieldname");
    // Use frappe.db.set_value which works on submitted documents
    $ch = curl_init();
    $url = ERP_BASE . "/api/method/frappe.client.set_value";
    $postData = json_encode([
        'doctype' => $doctype,
        'name' => $docname,
        'fieldname' => $fieldname,
        'value' => $value
    ]);
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postData,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET,
            "Content-Type: application/json"
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    logError("Update response: HTTP $httpCode - $res");
    curl_close($ch);
    echo $res;
    exit;
}

// Get link field options
if (isset($_GET['action']) && $_GET['action'] === 'get_link_options') {
    $doctype = $_GET['doctype'] ?? '';
    if (!$doctype) {
        echo json_encode(["error" => "DocType not specified"]);
        exit;
    }

    $ch = curl_init();
    $url = ERP_BASE . "/api/resource/$doctype?fields=[\"name\"]&limit_page_length=500";
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Authorization: token " . API_KEY . ":" . API_SECRET],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    echo $res;
    exit;
}

// Save users
if (isset($_GET['action']) && $_GET['action'] === 'save_users') {
    $input = json_decode(file_get_contents("php://input"), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(["error" => "Invalid JSON"]);
        exit;
    }

    $admin_email = $input['admin_email'] ?? '';
    $data = $input['data'] ?? [];
    $users = json_decode(file_get_contents("users.json"), true);
    $adminFound = false;
    foreach ($users['users'] as $u) {
        if ($u['email'] === $admin_email && $u['role'] === 'admin') {
            $adminFound = true;
            break;
        }
    }
    if (!$adminFound) {
        echo json_encode(["error" => "Not authorized"]);
        exit;
    }

    logError("Saving users: " . json_encode($data));
    file_put_contents("users.json", json_encode(['users' => $data], JSON_PRETTY_PRINT));
    echo json_encode(["message" => "User list updated successfully"]);
    exit;
}

// Save report configuration
if (isset($_GET['action']) && $_GET['action'] === 'save_report_config') {
    $input = json_decode(file_get_contents("php://input"), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(["error" => "Invalid JSON"]);
        exit;
    }

    $config = $input['config'] ?? [];
    file_put_contents("report_config.json", json_encode($config, JSON_PRETTY_PRINT));
    echo json_encode(["message" => "Report config saved"]);
    exit;
}

// Get report configuration
if (isset($_GET['action']) && $_GET['action'] === 'get_report_config') {
    if (file_exists("report_config.json")) {
        echo file_get_contents("report_config.json");
    } else {
        echo json_encode([]);
    }
    exit;
}






// Get time logs from Job Card (child table)
if (isset($_GET['action']) && $_GET['action'] == 'get_time_logs') {
    $job_card = $_GET['job_card'] ?? '';
    
    if (empty($job_card)) {
        echo json_encode(['error' => 'Job card not specified']);
        exit;
    }
    
    // Fetch the Job Card document to get its time logs and other details
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job Card/' . urlencode($job_card);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: token ' . API_KEY . ':' . API_SECRET],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $res = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code !== 200) {
        error_log("Job Card API Error - HTTP $http_code: $res");
        echo json_encode(['error' => 'Failed to fetch job card', 'details' => $res, 'http_code' => $http_code]);
    } else {
        $job_card_data = json_decode($res, true);
        
        // Extract time logs from the time_logs child table
        $time_logs = $job_card_data['data']['time_logs'] ?? [];
        $for_quantity = $job_card_data['data']['for_quantity'] ?? 0;
        $total_completed_qty = $job_card_data['data']['total_completed_qty'] ?? 0;
        
        echo json_encode([
            'data' => $time_logs,
            'job_card_info' => [
                'for_quantity' => $for_quantity,
                'total_completed_qty' => $total_completed_qty,
                'name' => $job_card
            ]
        ]);
    }
    exit;
}

// Add new time log to Job Card
if (isset($_GET['action']) && $_GET['action'] == 'add_time_log') {
    $input = json_decode(file_get_contents('php://input'), true);
    $job_card = $input['job_card'] ?? '';
    
    if (empty($job_card)) {
        echo json_encode(['error' => 'Job card not specified']);
        exit;
    }
    
    // First, fetch the current job card
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job Card/' . urlencode($job_card);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: token ' . API_KEY . ':' . API_SECRET],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $res = curl_exec($ch);
    curl_close($ch);
    
    $job_card_data = json_decode($res, true);
    if (!$job_card_data || !isset($job_card_data['data'])) {
        echo json_encode(['error' => 'Job card not found']);
        exit;
    }
    
    // Add new time log to the time_logs array
    $time_logs = $job_card_data['data']['time_logs'] ?? [];
    $time_logs[] = [
        'from_time' => $input['from_time'],
        'to_time' => $input['to_time'] ?? null,
        'time_in_mins' => $input['time_in_mins'],
        'completed_qty' => $input['completed_qty'] ?? 0,
        'employee' => $input['employee'] ?? null
    ];
    
    // Update the job card
    $update_data = ['time_logs' => $time_logs];
    
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job Card/' . urlencode($job_card);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => json_encode($update_data),
        CURLOPT_HTTPHEADER => [
            'Authorization: token ' . API_KEY . ':' . API_SECRET,
            'Content-Type: application/json'
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $res = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    echo $res;
    exit;
}

// Update time log in Job Card
if (isset($_GET['action']) && $_GET['action'] == 'update_time_log') {
    $input = json_decode(file_get_contents('php://input'), true);
    $job_card = $input['job_card'] ?? '';
    $log_index = $input['log_index'] ?? -1;
    
    if (empty($job_card) || $log_index < 0) {
        echo json_encode(['error' => 'Invalid parameters']);
        exit;
    }
    
    // Fetch current job card
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job Card/' . urlencode($job_card);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: token ' . API_KEY . ':' . API_SECRET],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $res = curl_exec($ch);
    curl_close($ch);
    
    $job_card_data = json_decode($res, true);
    $time_logs = $job_card_data['data']['time_logs'] ?? [];
    
    // Update the specific time log
    if (isset($time_logs[$log_index])) {
        $time_logs[$log_index] = array_merge($time_logs[$log_index], [
            'from_time' => $input['from_time'],
            'to_time' => $input['to_time'] ?? null,
            'time_in_mins' => $input['time_in_mins'],
            'completed_qty' => $input['completed_qty'] ?? 0,
            'employee' => $input['employee'] ?? null
        ]);
        
        // Update job card
        $update_data = ['time_logs' => $time_logs];
        
        $ch = curl_init();
        $url = ERP_BASE . '/api/resource/Job Card/' . urlencode($job_card);
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => 'PUT',
            CURLOPT_POSTFIELDS => json_encode($update_data),
            CURLOPT_HTTPHEADER => [
                'Authorization: token ' . API_KEY . ':' . API_SECRET,
                'Content-Type: application/json'
            ],
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        
        $res = curl_exec($ch);
        curl_close($ch);
        echo $res;
    } else {
        echo json_encode(['error' => 'Time log not found']);
    }
    exit;
}

// Delete time log from Job Card
if (isset($_GET['action']) && $_GET['action'] == 'delete_time_log') {
    $job_card = $_GET['job_card'] ?? '';
    $log_index = $_GET['log_index'] ?? -1;
    
    if (empty($job_card) || $log_index < 0) {
        echo json_encode(['error' => 'Invalid parameters']);
        exit;
    }
    
    // Fetch current job card
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job Card/' . urlencode($job_card);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: token ' . API_KEY . ':' . API_SECRET],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $res = curl_exec($ch);
    curl_close($ch);
    
    $job_card_data = json_decode($res, true);
    $time_logs = $job_card_data['data']['time_logs'] ?? [];
    
    // Remove the time log
    array_splice($time_logs, $log_index, 1);
    
    // Update job card
    $update_data = ['time_logs' => $time_logs];
    
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job Card/' . urlencode($job_card);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => json_encode($update_data),
        CURLOPT_HTTPHEADER => [
            'Authorization: token ' . API_KEY . ':' . API_SECRET,
            'Content-Type: application/json'
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $res = curl_exec($ch);
    curl_close($ch);
    echo $res;
    exit;
}







echo json_encode(["error" => "Invalid request"]);
?>
