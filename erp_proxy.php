<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

define("API_KEY", "2f721d295151824");
define("API_SECRET", "0e9e87c5238a8a3");
define("ERP_BASE", "https://acmestones.erpnext.com");

function logError($message) {
    error_log(date("Y-m-d H:i:s") . " - " . $message . "\n", 3, "erp_debug.log");
}

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
        header("Content-Type: " . $content_type);
        header("Cache-Control: public, max-age=86400");
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

// Get a single document
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

// Make file public
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
    
    $parsed = parse_url($file_url);
    $file_path = $parsed['path'] ?? $file_url;
    logError("Making file public: " . $file_path);
    
    $ch = curl_init();
    $search_url = ERP_BASE . '/api/resource/File?filters=[["file_url","="," '. $file_path . '"]]&fields=["name","is_private"]';
    
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
        
        $ch = curl_init();
        $update_url = ERP_BASE . '/api/resource/File/' . urlencode($file_name);
        $update_data = json_encode(['is_private' => 0]);
        
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

// Update field using frappe.client.set_value
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

// Test connection
if (isset($_GET['action']) && $_GET['action'] == 'test_connection') {
    $ch = curl_init();
    $url = ERP_BASE . '/api/method/ping';
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: token ' . API_KEY . ':' . API_SECRET],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 30
    ]);
    
    $res = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    $curl_info = curl_getinfo($ch);
    curl_close($ch);
    
    echo json_encode([
        'http_code' => $http_code,
        'response' => $res,
        'curl_error' => $curl_error,
        'curl_info' => $curl_info,
        'erp_base' => ERP_BASE
    ]);
    exit;
}

// ==================== TIME LOGS ENDPOINTS ====================

// Get time logs from Job Card
if (isset($_GET['action']) && $_GET['action'] == 'get_time_logs') {
    $job_card = $_GET['job_card'] ?? '';
    
    if (empty($job_card)) {
        echo json_encode(['error' => 'Job card not specified']);
        exit;
    }
    
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job%20Card/' . rawurlencode($job_card);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code !== 200) {
        echo json_encode(['error' => 'Failed to fetch job card', 'http_code' => $http_code]);
        exit;
    }
    
$data = json_decode($response, true);
$job_card_doc = $data['data'];
$time_logs = $job_card_doc['time_logs'] ?? [];
$for_quantity = $job_card_doc['for_quantity'] ?? 0;
$total_completed_qty = $job_card_doc['total_completed_qty'] ?? 0;
$workstation = $job_card_doc['workstation'] ?? '';

// Get time_in_mins from Work Order Operations instead of Job Card time_required
$time_required = 0;
$work_order = $job_card_doc['work_order'] ?? '';
$operation = $job_card_doc['operation'] ?? '';

if ($work_order && $operation) {
    $ch2 = curl_init();
    $wo_url = ERP_BASE . '/api/resource/Work%20Order/' . rawurlencode($work_order) . '?fields=["operations"]';
    
    curl_setopt($ch2, CURLOPT_URL, $wo_url);
    curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch2, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET
    ]);
    curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, false);
    
    $wo_response = curl_exec($ch2);
    curl_close($ch2);
    
    $wo_data = json_decode($wo_response, true);
    if (isset($wo_data['data']['operations'])) {
        foreach ($wo_data['data']['operations'] as $op) {
            if ($op['operation'] === $operation) {
                $time_required = floatval($op['time_in_mins'] ?? 0);
                break;
            }
        }
    }
}

echo json_encode([
    'data' => $time_logs,
    'job_card_info' => [
        'for_quantity' => $for_quantity,
        'total_completed_qty' => $total_completed_qty,
        'time_required' => $time_required,  // Now from Work Order Operations
        'workstation' => $workstation,
        'name' => $job_card
    ]
]);
exit;
}







// Add time log
if (isset($_GET['action']) && $_GET['action'] == 'add_time_log') {
    $input = json_decode(file_get_contents('php://input'), true);
    $job_card = $input['job_card'] ?? '';
    
    if (empty($job_card)) {
        echo json_encode(['error' => 'Job card not specified']);
        exit;
    }
    
    logError("Adding time log to: $job_card");
    
    // Get current job card
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job%20Card/' . rawurlencode($job_card);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    $job_card_doc = $data['data'] ?? [];
    $time_logs = $job_card_doc['time_logs'] ?? [];
    
    // Add new log with proper structure for ERPNext child table
    $new_log = [
        'doctype' => 'Job Card Time Log',  // Child table doctype
        'from_time' => $input['from_time'],
        'to_time' => $input['to_time'] ?? null,
        'time_in_mins' => floatval($input['time_in_mins']),
        'completed_qty' => floatval($input['completed_qty'] ?? 0),
        'parent' => $job_card,
        'parentfield' => 'time_logs',
        'parenttype' => 'Job Card'
    ];
    
        // Add optional fields
        if (!empty($input['employee'])) {
            $new_log['employee'] = $input['employee'];
        }
        if (isset($input['custom_job_detail'])) {
            $new_log['custom_job_detail'] = $input['custom_job_detail'];
        }
        if (isset($input['custom_job_image'])) {
            $new_log['custom_job_image'] = $input['custom_job_image'];
        }
    
    $time_logs[] = $new_log;
    
    logError("Time logs array: " . json_encode($time_logs));




    
    // Update job card with new time logs
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job%20Card/' . rawurlencode($job_card);
    
    $update_data = json_encode(['time_logs' => $time_logs]);
    logError("Update data: $update_data");
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $update_data);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    logError("Add time log response - HTTP $http_code: $response");
    
    if ($http_code >= 200 && $http_code < 300) {
        echo json_encode(['success' => true, 'message' => 'Time log added successfully']);
    } else {
        echo json_encode(['error' => 'Failed to update', 'http_code' => $http_code, 'details' => json_decode($response, true)]);
    }
    exit;
}






// Update time log
if (isset($_GET['action']) && $_GET['action'] == 'update_time_log') {
    $input = json_decode(file_get_contents('php://input'), true);
    $job_card = $input['job_card'] ?? '';
    $log_index = $input['log_index'] ?? -1;
    
    if (empty($job_card) || $log_index < 0) {
        echo json_encode(['error' => 'Invalid parameters']);
        exit;
    }
    
    // Get current job card
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job%20Card/' . rawurlencode($job_card);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    $time_logs = $data['data']['time_logs'] ?? [];
    
    if (isset($time_logs[$log_index])) {
            $time_logs[$log_index] = array_merge($time_logs[$log_index], [
                'from_time' => $input['from_time'],
                'to_time' => $input['to_time'] ?? null,
                'time_in_mins' => floatval($input['time_in_mins']),
                'completed_qty' => floatval($input['completed_qty'] ?? 0),
                'employee' => $input['employee'] ?? null,
                'custom_job_detail' => $input['custom_job_detail'] ?? null,
                'custom_job_image' => $input['custom_job_image'] ?? null
            ]);

        
        // Update
        $ch = curl_init();
        $url = ERP_BASE . '/api/resource/Job%20Card/' . rawurlencode($job_card);
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['time_logs' => $time_logs]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: token ' . API_KEY . ':' . API_SECRET,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $response = curl_exec($ch);
        curl_close($ch);
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Log not found']);
    }
    exit;
}

// Delete time log
if (isset($_GET['action']) && $_GET['action'] == 'delete_time_log') {
    $job_card = $_GET['job_card'] ?? '';
    $log_index = intval($_GET['log_index'] ?? -1);
    
    if (empty($job_card) || $log_index < 0) {
        echo json_encode(['error' => 'Invalid parameters']);
        exit;
    }
    
    // Get current job card
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job%20Card/' . rawurlencode($job_card);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    $time_logs = $data['data']['time_logs'] ?? [];
    
    // Remove the time log
    array_splice($time_logs, $log_index, 1);
    
    // Update
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job%20Card/' . rawurlencode($job_card);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['time_logs' => $time_logs]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    curl_close($ch);
    echo json_encode(['success' => true]);
    exit;
}








// Get Employee list
if (isset($_GET['action']) && $_GET['action'] == 'get_employees') {
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Employee?fields=["name","employee_name"]&filters=[["status","=","Active"]]&limit_page_length=999';
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    curl_close($ch);
    echo $response;
    exit;
}

// Get Workstation list
if (isset($_GET['action']) && $_GET['action'] == 'get_workstations') {
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Workstation?fields=["name"]&limit_page_length=999';
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    curl_close($ch);
    echo $response;
    exit;
}



// Update Job Card Workstation (and sync with Work Order Operation)
if (isset($_GET['action']) && $_GET['action'] == 'update_job_card_workstation') {
    $input = json_decode(file_get_contents('php://input'), true);
    $job_card = $input['job_card'] ?? '';
    $workstation = $input['workstation'] ?? '';
    
    if (empty($job_card)) {
        echo json_encode(['error' => 'Job card not specified']);
        exit;
    }
    
    logError("Updating workstation for Job Card: $job_card to $workstation");
    
    // Step 1: Get the Job Card to find the linked Work Order and Operation
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job%20Card/' . rawurlencode($job_card);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $job_card_data = json_decode($response, true);
    if (!isset($job_card_data['data'])) {
        echo json_encode(['error' => 'Failed to fetch job card']);
        exit;
    }
    
    $work_order = $job_card_data['data']['work_order'] ?? '';
    $operation = $job_card_data['data']['operation'] ?? '';
    
    logError("Found Work Order: $work_order, Operation: $operation");
    
    // Step 2: Update the Job Card workstation
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job%20Card/' . rawurlencode($job_card);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['workstation' => $workstation]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code < 200 || $http_code >= 300) {
        echo json_encode(['error' => 'Failed to update job card', 'details' => $response]);
        exit;
    }
    
    logError("Job Card updated successfully");
    
    // Step 3: Update the Work Order Operations table
    if ($work_order && $operation) {
        // Get the Work Order
        $ch = curl_init();
        $url = ERP_BASE . '/api/resource/Work%20Order/' . rawurlencode($work_order);
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: token ' . API_KEY . ':' . API_SECRET
        ]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $wo_data = json_decode($response, true);
        if (isset($wo_data['data']['operations'])) {
            $operations = $wo_data['data']['operations'];
            
            // Find and update the matching operation
            foreach ($operations as &$op) {
                if ($op['operation'] === $operation) {
                    $op['workstation'] = $workstation;
                    logError("Found matching operation, updating workstation");
                    break;
                }
            }
            
            // Update the Work Order with modified operations
            $ch = curl_init();
            $url = ERP_BASE . '/api/resource/Work%20Order/' . rawurlencode($work_order);
            
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['operations' => $operations]));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: token ' . API_KEY . ':' . API_SECRET,
                'Content-Type: application/json'
            ]);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            
            $response = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            logError("Work Order update response - HTTP $http_code");
            
            if ($http_code >= 200 && $http_code < 300) {
                echo json_encode(['success' => true, 'message' => 'Workstation updated in both Job Card and Work Order']);
            } else {
                echo json_encode(['success' => true, 'message' => 'Job Card updated but Work Order update failed', 'wo_error' => $response]);
            }
        } else {
            echo json_encode(['success' => true, 'message' => 'Job Card updated (no operations found in Work Order)']);
        }
    } else {
        echo json_encode(['success' => true, 'message' => 'Job Card updated (no linked Work Order)']);
    }
    exit;
}






// Upload image for time log
if (isset($_GET['action']) && $_GET['action'] == 'upload_time_log_image') {
    if (!isset($_FILES['file'])) {
        echo json_encode(['error' => 'No file uploaded']);
        exit;
    }
    
    $file = $_FILES['file'];
    $job_card = $_POST['job_card'] ?? 'unknown';
    
    // Create a unique filename
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'timelog_' . $job_card . '_' . time() . '.' . $ext;
    
    // Prepare multipart form data for ERPNext
    $boundary = '----WebKitFormBoundary' . uniqid();
    $fileContent = file_get_contents($file['tmp_name']);
    
    $postData = "--$boundary\r\n";
    $postData .= "Content-Disposition: form-data; name=\"file\"; filename=\"$filename\"\r\n";
    $postData .= "Content-Type: " . $file['type'] . "\r\n\r\n";
    $postData .= $fileContent . "\r\n";
    $postData .= "--$boundary\r\n";
    $postData .= "Content-Disposition: form-data; name=\"is_private\"\r\n\r\n";
    $postData .= "0\r\n";
    $postData .= "--$boundary\r\n";
    $postData .= "Content-Disposition: form-data; name=\"doctype\"\r\n\r\n";
    $postData .= "Job Card\r\n";
    $postData .= "--$boundary\r\n";
    $postData .= "Content-Disposition: form-data; name=\"docname\"\r\n\r\n";
    $postData .= "$job_card\r\n";
    $postData .= "--$boundary--\r\n";
    
    $ch = curl_init();
    $url = ERP_BASE . '/api/method/upload_file';
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postData,
        CURLOPT_HTTPHEADER => [
            'Authorization: token ' . API_KEY . ':' . API_SECRET,
            'Content-Type: multipart/form-data; boundary=' . $boundary
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    logError("Upload response - HTTP $http_code: $response");
    
    if ($http_code === 200) {
        $result = json_decode($response, true);
        if (isset($result['message']['file_url'])) {
            echo json_encode(['file_url' => $result['message']['file_url']]);
        } else {
            echo json_encode(['error' => 'Upload succeeded but no file URL returned', 'response' => $result]);
        }
    } else {
        echo json_encode(['error' => 'Upload failed', 'http_code' => $http_code, 'response' => $response]);
    }
    exit;
}








// Update Time Required in Work Order Operations
if (isset($_GET['action']) && $_GET['action'] == 'update_time_required') {
    $input = json_decode(file_get_contents('php://input'), true);
    $job_card = $input['job_card'] ?? '';
    $time_required = floatval($input['time_required'] ?? 0);
    
    if (empty($job_card)) {
        echo json_encode(['error' => 'Job card not specified']);
        exit;
    }
    
    logError("Updating time required for Job Card: $job_card to $time_required");
    
    // Get the Job Card to find linked Work Order and Operation
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Job%20Card/' . rawurlencode($job_card);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $job_card_data = json_decode($response, true);
    if (!isset($job_card_data['data'])) {
        echo json_encode(['error' => 'Failed to fetch job card']);
        exit;
    }
    
    $work_order = $job_card_data['data']['work_order'] ?? '';
    $operation = $job_card_data['data']['operation'] ?? '';
    
    if (!$work_order || !$operation) {
        echo json_encode(['error' => 'No linked Work Order or Operation found']);
        exit;
    }
    
    // Get the Work Order
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Work%20Order/' . rawurlencode($work_order);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $wo_data = json_decode($response, true);
    if (!isset($wo_data['data']['operations'])) {
        echo json_encode(['error' => 'No operations found in Work Order']);
        exit;
    }
    
    $operations = $wo_data['data']['operations'];
    
    // Find and update the matching operation
    $found = false;
    foreach ($operations as &$op) {
        if ($op['operation'] === $operation) {
            $op['time_in_mins'] = $time_required;
            $found = true;
            logError("Updated operation time_in_mins to $time_required");
            break;
        }
    }
    
    if (!$found) {
        echo json_encode(['error' => 'Operation not found in Work Order']);
        exit;
    }
    
    // Update the Work Order
    $ch = curl_init();
    $url = ERP_BASE . '/api/resource/Work%20Order/' . rawurlencode($work_order);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['operations' => $operations]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . API_KEY . ':' . API_SECRET,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code >= 200 && $http_code < 300) {
        echo json_encode(['success' => true, 'message' => 'Time required updated in Work Order Operations']);
    } else {
        echo json_encode(['error' => 'Failed to update Work Order', 'details' => $response]);
    }
    exit;
}









// Get work order operations with job card data
if (isset($_GET['action']) && $_GET['action'] === 'get_work_order_operations') {
    $workOrder = $_GET['work_order'] ?? '';
    
    if (empty($workOrder)) {
        echo json_encode(['success' => false, 'message' => 'Work Order not specified']);
        exit;
    }
    
    // URL encode the work order name properly
    $encodedWorkOrder = rawurlencode($workOrder);
    $url = ERP_BASE . "/api/resource/Work%20Order/{$encodedWorkOrder}?fields=[\"operations\",\"qty\"]";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    error_log("Get WO Operations - HTTP {$httpCode}: " . $response);
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        $operations = $data['data']['operations'] ?? [];
        $woQty = $data['data']['qty'] ?? 0;
        
        // For each operation, fetch the linked Job Card data
        foreach ($operations as &$op) {
            $operationId = $op['name'] ?? '';
            
            if (!empty($operationId)) {
                // Search for Job Card linked to this operation
                $searchUrl = ERP_BASE . "/api/resource/Job%20Card?filters=" . 
                    urlencode('[["work_order","=","' . $workOrder . '"],["operation_id","=","' . $operationId . '"]]') . 
                    "&fields=[\"name\",\"for_quantity\",\"total_completed_qty\"]";
                
                $ch = curl_init();
                curl_setopt_array($ch, [
                    CURLOPT_URL => $searchUrl,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_HTTPHEADER => [
                        "Authorization: token " . API_KEY . ":" . API_SECRET
                    ],
                    CURLOPT_SSL_VERIFYPEER => false
                ]);
                
                $jcResponse = curl_exec($ch);
                $jcHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                
                if ($jcHttpCode === 200) {
                    $jcData = json_decode($jcResponse, true);
                    if (!empty($jcData['data'])) {
                        $jobCard = $jcData['data'][0];
                        $op['job_card_name'] = $jobCard['name'] ?? '';
                        $op['for_quantity'] = $jobCard['for_quantity'] ?? $woQty;
                        $op['total_completed_qty'] = $jobCard['total_completed_qty'] ?? 0;
                    } else {
                        // No job card found
                        $op['job_card_name'] = '';
                        $op['for_quantity'] = $woQty;
                        $op['total_completed_qty'] = 0;
                    }
                } else {
                    // Error fetching job card
                    $op['job_card_name'] = '';
                    $op['for_quantity'] = $woQty;
                    $op['total_completed_qty'] = 0;
                }
            }
        }
        
        echo json_encode([
            'success' => true,
            'operations' => $operations
        ]);
    } else {
        echo json_encode([
            'success' => false, 
            'message' => 'Failed to fetch operations',
            'httpCode' => $httpCode,
            'response' => $response
        ]);
    }
    exit;
}







// Add work order operation
if (isset($_GET['action']) && $_GET['action'] === 'add_work_order_operation') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $workOrder = $input['work_order'] ?? '';
    $operation = $input['operation'] ?? '';
    $workstation = $input['workstation'] ?? '';
    $timeInMins = $input['time_in_mins'] ?? 0;
    $plant = $input['custom_plant'] ?? '';
    
    if (empty($workOrder) || empty($operation)) {
        echo json_encode(['success' => false, 'message' => 'Missing required parameters']);
        exit;
    }
    
    // Use Frappe's server script method to add operation and create job card
    // This is more reliable than manual updates
    $methodUrl = ERP_BASE . "/api/method/frappe.client.insert";
    
    // First, get Work Order details for Job Card creation
    $encodedWO = rawurlencode($workOrder);
    $getUrl = ERP_BASE . "/api/resource/Work%20Order/{$encodedWO}";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $getUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch Work Order']);
        exit;
    }
    
    $woData = json_decode($response, true);
    $operations = $woData['data']['operations'] ?? [];
    
    // Add new operation
    $newOp = [
        'operation' => $operation,
        'workstation' => $workstation,
        'time_in_mins' => floatval($timeInMins),
        'idx' => count($operations) + 1
    ];
    
    if (!empty($plant)) {
        $newOp['custom_plant'] = $plant;
    }
    
    $operations[] = $newOp;
    
    // Update Work Order with new operation
    $updateUrl = ERP_BASE . "/api/resource/Work%20Order/{$encodedWO}";
    
    $updateData = json_encode([
        'operations' => $operations
    ]);
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $updateUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => $updateData,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET,
            "Content-Type: application/json"
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    error_log("Add operation - HTTP {$httpCode}: {$response}");
    
    if ($httpCode !== 200) {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to add operation',
            'httpCode' => $httpCode
        ]);
        exit;
    }
    
    // IMPORTANT: Wait a moment for ERPNext to process and assign the name
    sleep(1);
    
    // Get the updated Work Order to find the newly created operation's name
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $getUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        echo json_encode([
            'success' => true,
            'message' => 'Operation added but could not verify operation ID for Job Card creation'
        ]);
        exit;
    }
    
    $updatedWoData = json_decode($response, true);
    $updatedOperations = $updatedWoData['data']['operations'] ?? [];
    
    // Find the newly added operation (match by operation name and workstation)
    $newOperationData = null;
    foreach ($updatedOperations as $op) {
        if ($op['operation'] === $operation && 
            $op['workstation'] === $workstation && 
            !empty($op['name'])) {
            // Check if Job Card already exists for this operation
            $searchUrl = ERP_BASE . "/api/resource/Job%20Card?filters=" . urlencode('[["work_order","=","' . $workOrder . '"],["operation_id","=","' . $op['name'] . '"]]') . "&fields=[\"name\"]";
            
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $searchUrl,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    "Authorization: token " . API_KEY . ":" . API_SECRET
                ],
                CURLOPT_SSL_VERIFYPEER => false
            ]);
            
            $searchResponse = curl_exec($ch);
            curl_close($ch);
            
            $existingJCs = json_decode($searchResponse, true);
            if (empty($existingJCs['data'])) {
                // No job card exists for this operation, so this must be our new one
                $newOperationData = $op;
                break;
            }
        }
    }
    
    if (empty($newOperationData) || empty($newOperationData['name'])) {
        error_log("Could not find operation ID. Operations data: " . json_encode($updatedOperations));
        echo json_encode([
            'success' => true,
            'message' => 'Operation added but Job Card creation skipped (operation ID not found)',
            'debug' => [
                'operations_count' => count($updatedOperations),
                'looking_for' => $operation . ' - ' . $workstation
            ]
        ]);
        exit;
    }
    
    $operationId = $newOperationData['name'];
    error_log("Found new operation ID: {$operationId}");
    
    // Now create the Job Card for this operation
    $createJobCardUrl = ERP_BASE . "/api/resource/Job%20Card";
    
    $jobCardData = [
        'work_order' => $workOrder,
        'operation_id' => $operationId,
        'operation' => $operation,
        'workstation' => $workstation,
        'for_quantity' => floatval($woData['data']['qty'] ?? 1),
        'production_item' => $woData['data']['production_item'] ?? '',
        'item_name' => $woData['data']['item_name'] ?? '',
        'bom_no' => $woData['data']['bom_no'] ?? ''
    ];
    
    if (!empty($plant)) {
        $jobCardData['custom_plant'] = $plant;
    }
    
    error_log("Creating Job Card with data: " . json_encode($jobCardData));
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $createJobCardUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($jobCardData),
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET,
            "Content-Type: application/json"
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $jcResponse = curl_exec($ch);
    $jcHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    error_log("Create Job Card - HTTP {$jcHttpCode}: {$jcResponse}");
    
    if ($jcHttpCode === 200) {
        $jcData = json_decode($jcResponse, true);
        $jobCardName = $jcData['data']['name'] ?? '';
        echo json_encode([
            'success' => true,
            'message' => 'Operation and Job Card created successfully',
            'job_card' => $jobCardName,
            'operation_id' => $operationId
        ]);
    } else {
        // Operation was added but Job Card creation failed
        $jcError = json_decode($jcResponse, true);
        error_log("Job Card creation failed: " . json_encode($jcError));
        echo json_encode([
            'success' => true,
            'message' => 'Operation added but Job Card creation failed',
            'warning' => 'Job Card creation error: ' . ($jcError['exception'] ?? $jcResponse),
            'operation_id' => $operationId
        ]);
    }
    exit;
}







// Update work order operation
if (isset($_GET['action']) && $_GET['action'] === 'update_work_order_operation') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $workOrder = $input['work_order'] ?? '';
    $operationName = $input['operation_name'] ?? '';
    $operation = $input['operation'] ?? '';
    $workstation = $input['workstation'] ?? '';
    $timeInMins = $input['time_in_mins'] ?? 0;
    $plant = $input['custom_plant'] ?? '';
    
    if (empty($workOrder) || empty($operationName)) {
        echo json_encode(['success' => false, 'message' => 'Missing required parameters']);
        exit;
    }
    
    // First, get the parent Work Order document
    $encodedWO = rawurlencode($workOrder);
    $getUrl = ERP_BASE . "/api/resource/Work%20Order/{$encodedWO}";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $getUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to fetch Work Order',
            'httpCode' => $httpCode
        ]);
        exit;
    }
    
    $woData = json_decode($response, true);
    $operations = $woData['data']['operations'] ?? [];
    
    // Find and update the specific operation
    $updated = false;
    foreach ($operations as &$op) {
        if ($op['name'] === $operationName) {
            $op['operation'] = $operation;
            $op['workstation'] = $workstation;
            $op['time_in_mins'] = floatval($timeInMins);
            if (!empty($plant)) {
                $op['custom_plant'] = $plant;
            }
            $updated = true;
            break;
        }
    }
    
    if (!$updated) {
        echo json_encode(['success' => false, 'message' => 'Operation not found in Work Order']);
        exit;
    }
    
    // Update the entire Work Order with modified operations
    $updateUrl = ERP_BASE . "/api/resource/Work%20Order/{$encodedWO}";
    
    $updateData = json_encode([
        'operations' => $operations
    ]);
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $updateUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => $updateData,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET,
            "Content-Type: application/json"
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    error_log("Update operation - HTTP {$httpCode}: {$response}");
    
    if ($httpCode !== 200) {
        $responseData = json_decode($response, true);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to update operation',
            'httpCode' => $httpCode,
            'response' => $responseData['exception'] ?? $response
        ]);
        exit;
    }
    
    // Now update the linked Job Card if it exists
    $searchUrl = ERP_BASE . "/api/resource/Job%20Card?filters=" . urlencode('[["work_order","=","' . $workOrder . '"],["operation_id","=","' . $operationName . '"]]') . "&fields=[\"name\"]";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $searchUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $jcSearchResponse = curl_exec($ch);
    $jcHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($jcHttpCode === 200) {
        $jobCards = json_decode($jcSearchResponse, true);
        if (!empty($jobCards['data'])) {
            foreach ($jobCards['data'] as $jc) {
                $jobCardName = $jc['name'];
                $encodedJC = rawurlencode($jobCardName);
                $updateJCUrl = ERP_BASE . "/api/resource/Job%20Card/{$encodedJC}";
                
                $jcUpdateData = [
                    'operation' => $operation,
                    'workstation' => $workstation
                ];
                
                if (!empty($plant)) {
                    $jcUpdateData['custom_plant'] = $plant;
                }
                
                $ch = curl_init();
                curl_setopt_array($ch, [
                    CURLOPT_URL => $updateJCUrl,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_CUSTOMREQUEST => 'PUT',
                    CURLOPT_POSTFIELDS => json_encode($jcUpdateData),
                    CURLOPT_HTTPHEADER => [
                        "Authorization: token " . API_KEY . ":" . API_SECRET,
                        "Content-Type: application/json"
                    ],
                    CURLOPT_SSL_VERIFYPEER => false
                ]);
                
                $jcUpdateResponse = curl_exec($ch);
                $jcUpdateHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                
                error_log("Update Job Card {$jobCardName} - HTTP {$jcUpdateHttpCode}: {$jcUpdateResponse}");
            }
        }
    }
    
    echo json_encode(['success' => true, 'message' => 'Operation and Job Card updated successfully']);
    exit;
}









// Reorder work order operations
if (isset($_GET['action']) && $_GET['action'] === 'reorder_work_order_operations') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $workOrder = $input['work_order'] ?? '';
    $operationsOrder = $input['operations_order'] ?? [];
    
    if (empty($workOrder) || empty($operationsOrder)) {
        echo json_encode(['success' => false, 'message' => 'Missing required parameters']);
        exit;
    }
    
    // Get the current Work Order
    $encodedWO = rawurlencode($workOrder);
    $getUrl = ERP_BASE . "/api/resource/Work%20Order/{$encodedWO}";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $getUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to fetch Work Order',
            'httpCode' => $httpCode
        ]);
        exit;
    }
    
    $woData = json_decode($response, true);
    $operations = $woData['data']['operations'] ?? [];
    
    // Reorder operations based on new order
    $reorderedOps = [];
    foreach ($operationsOrder as $orderItem) {
        foreach ($operations as $op) {
            if ($op['name'] === $orderItem['name']) {
                $op['idx'] = $orderItem['idx'];
                $reorderedOps[] = $op;
                break;
            }
        }
    }
    
    // Update the Work Order with reordered operations
    $updateUrl = ERP_BASE . "/api/resource/Work%20Order/{$encodedWO}";
    
    $updateData = json_encode([
        'operations' => $reorderedOps
    ]);
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $updateUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => $updateData,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET,
            "Content-Type: application/json"
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    error_log("Reorder operations - HTTP {$httpCode}: {$response}");
    error_log("Reorder operations - Error: {$error}");
    
    if ($httpCode === 200) {
        echo json_encode(['success' => true, 'message' => 'Operations reordered successfully']);
    } else {
        $responseData = json_decode($response, true);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to reorder operations',
            'httpCode' => $httpCode,
            'error' => $error,
            'response' => $responseData['exception'] ?? $response
        ]);
    }
    exit;
}








// Delete work order operation
if (isset($_GET['action']) && $_GET['action'] === 'delete_work_order_operation') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $workOrder = $input['work_order'] ?? '';
    $operationName = $input['operation_name'] ?? '';
    
    if (empty($workOrder) || empty($operationName)) {
        echo json_encode(['success' => false, 'message' => 'Missing required parameters']);
        exit;
    }
    
    // First, find the linked Job Card
    $encodedWO = rawurlencode($workOrder);
    $searchUrl = ERP_BASE . "/api/resource/Job%20Card?filters=" . urlencode('[["work_order","=","' . $workOrder . '"],["operation_id","=","' . $operationName . '"]]') . "&fields=[\"name\"]";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $searchUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    error_log("Search Job Card - HTTP {$httpCode}: {$response}");
    
    $jobCardDeleted = false;
    if ($httpCode === 200) {
        $jobCards = json_decode($response, true);
        if (!empty($jobCards['data'])) {
            foreach ($jobCards['data'] as $jc) {
                $jobCardName = $jc['name'];
                $encodedJC = rawurlencode($jobCardName);
                $deleteJCUrl = ERP_BASE . "/api/resource/Job%20Card/{$encodedJC}";
                
                $ch = curl_init();
                curl_setopt_array($ch, [
                    CURLOPT_URL => $deleteJCUrl,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_CUSTOMREQUEST => 'DELETE',
                    CURLOPT_HTTPHEADER => [
                        "Authorization: token " . API_KEY . ":" . API_SECRET
                    ],
                    CURLOPT_SSL_VERIFYPEER => false
                ]);
                
                $jcResponse = curl_exec($ch);
                $jcHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                
                error_log("Delete Job Card {$jobCardName} - HTTP {$jcHttpCode}: {$jcResponse}");
                
                if ($jcHttpCode === 202 || $jcHttpCode === 200) {
                    $jobCardDeleted = true;
                }
            }
        }
    }
    
    // Now delete the operation from Work Order
    $getWOUrl = ERP_BASE . "/api/resource/Work%20Order/{$encodedWO}";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $getWOUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch Work Order']);
        exit;
    }
    
    $woData = json_decode($response, true);
    $operations = $woData['data']['operations'] ?? [];
    
    // Remove the operation
    $filteredOps = array_filter($operations, function($op) use ($operationName) {
        return $op['name'] !== $operationName;
    });
    
    // Reindex array
    $filteredOps = array_values($filteredOps);
    
    // Update the Work Order
    $updateUrl = ERP_BASE . "/api/resource/Work%20Order/{$encodedWO}";
    
    $updateData = json_encode([
        'operations' => $filteredOps
    ]);
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $updateUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => $updateData,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET,
            "Content-Type: application/json"
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    error_log("Delete operation - HTTP {$httpCode}: {$response}");
    
    if ($httpCode === 200) {
        $message = 'Operation deleted successfully';
        if ($jobCardDeleted) {
            $message .= ' and linked Job Card deleted';
        }
        echo json_encode(['success' => true, 'message' => $message]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to delete operation',
            'httpCode' => $httpCode
        ]);
    }
    exit;
}







// Get operation options
if (isset($_GET['action']) && $_GET['action'] === 'get_operation_options') {
    $url = ERP_BASE . "/api/resource/Operation?fields=[\"name\"]&limit_page_length=999";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        $options = array_map(function($item) {
            return $item['name'];
        }, $data['data'] ?? []);
        
        echo json_encode(['success' => true, 'options' => $options]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch operations']);
    }
    exit;
}

// Get workstation options
if (isset($_GET['action']) && $_GET['action'] === 'get_workstation_options') {
    $url = ERP_BASE . "/api/resource/Workstation?fields=[\"name\"]&limit_page_length=999";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        $options = array_map(function($item) {
            return $item['name'];
        }, $data['data'] ?? []);
        
        echo json_encode(['success' => true, 'options' => $options]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch workstations']);
    }
    exit;
}








// Get plant floor options (custom link field)
if (isset($_GET['action']) && $_GET['action'] === 'get_plant_options') {
    $url = ERP_BASE . "/api/resource/Plant%20Floor?fields=[\"name\"]&limit_page_length=999";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    error_log("Get Plant Floor options - HTTP {$httpCode}: {$response}");
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        $options = array_map(function($item) {
            return $item['name'];
        }, $data['data'] ?? []);
        
        echo json_encode(['success' => true, 'options' => $options]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch Plant Floor options', 'httpCode' => $httpCode]);
    }
    exit;
}








// Save card priority order
if (isset($_GET['action']) && $_GET['action'] === 'save_card_priority') {
    $input = json_decode(file_get_contents("php://input"), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(["error" => "Invalid JSON"]);
        exit;
    }

    $reportName = $input['report_name'] ?? '';
    $primaryGroup = $input['primary_group'] ?? '';
    $secondaryGroup = $input['secondary_group'] ?? '';
    $cardOrder = $input['card_order'] ?? [];

    if (empty($reportName) || empty($cardOrder)) {
        echo json_encode(["error" => "Missing required parameters"]);
        exit;
    }

    // ========== FIX: Load existing FULL config ==========
    $config = [];
    if (file_exists("report_config.json")) {
        $configContent = file_get_contents("report_config.json");
        $config = json_decode($configContent, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            logError("Failed to parse existing config: " . json_last_error_msg());
            $config = [];
        }
    }

    // Initialize structure if needed (but preserve existing data!)
    if (!isset($config[$reportName])) {
        $config[$reportName] = [];
    }
    if (!isset($config[$reportName]['card_priority'])) {
        $config[$reportName]['card_priority'] = [];
    }
    if (!isset($config[$reportName]['card_priority'][$primaryGroup])) {
        $config[$reportName]['card_priority'][$primaryGroup] = [];
    }

    // Update ONLY the specific card priority
    $config[$reportName]['card_priority'][$primaryGroup][$secondaryGroup] = $cardOrder;
    // ========== END FIX ==========

    // Save the FULL config back
    $saveResult = file_put_contents("report_config.json", json_encode($config, JSON_PRETTY_PRINT));
    
    if ($saveResult === false) {
        logError("Failed to save report_config.json");
        echo json_encode(["error" => "Failed to save config file"]);
        exit;
    }
    
    logError("Card priority saved for $reportName > $primaryGroup > $secondaryGroup (saved " . count($cardOrder) . " cards)");
    echo json_encode(["success" => true, "message" => "Card priority saved"]);
    exit;
}






// Get DocType metadata (field definitions)
if (isset($_GET['action']) && $_GET['action'] === 'get_doctype_meta') {
    $doctype = $_GET['doctype'] ?? '';
    if (empty($doctype)) {
        echo json_encode(['error' => 'DocType not specified']);
        exit;
    }
    
    $ch = curl_init();
    $url = ERP_BASE . "/api/resource/DocType/" . urlencode($doctype);
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: token " . API_KEY . ":" . API_SECRET
        ],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $data = json_decode($res, true);
        // Extract only the fields array with relevant info
        $fields = [];
        if (isset($data['data']['fields'])) {
            foreach ($data['data']['fields'] as $field) {
                $fields[] = [
                    'fieldname' => $field['fieldname'],
                    'label' => $field['label'],
                    'fieldtype' => $field['fieldtype'],
                    'options' => $field['options'] ?? null,
                    'read_only' => $field['read_only'] ?? 0,
                    'in_list_view' => $field['in_list_view'] ?? 0
                ];
            }
        }
        echo json_encode(['success' => true, 'fields' => $fields]);
    } else {
        echo json_encode(['error' => 'Failed to fetch DocType meta', 'http_code' => $httpCode]);
    }
    exit;
}









// ==================== END TIME LOGS ENDPOINTS ====================

echo json_encode(["error" => "Invalid request"]);
?>
