<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$API_KEY = "2f721d295151824";
$API_SECRET = "0e9e87c5238a8a3";
$ERP_BASE = "https://acmestones.erpnext.com";

function logError($message) {
    error_log(date('[Y-m-d H:i:s] ') . $message . "\n", 3, 'erp_debug.log');
}

// Get users.json
if(isset($_GET['action']) && $_GET['action']==='get_users'){
    if(file_exists("users.json")) {
        echo file_get_contents("users.json");
    } else {
        echo json_encode(["error" => "users.json not found"]);
    }
    exit;
}

// Get all available reports
if(isset($_GET['action']) && $_GET['action']==='get_all_reports'){
    $ch = curl_init();
    $url = "$ERP_BASE/api/resource/Report?fields=[\"name\",\"ref_doctype\",\"report_type\"]&limit_page_length=999";
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Authorization: token $API_KEY:$API_SECRET"],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $res = curl_exec($ch);
    curl_close($ch);
    echo $res;
    exit;
}

// Get report data
if(isset($_GET['report'])){
    $report = $_GET['report'];
    $ch = curl_init();
    
    $url = "$ERP_BASE/api/method/frappe.desk.query_report.run?report_name=" . urlencode($report) . "&ignore_prepared_report=1";
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Authorization: token $API_KEY:$API_SECRET"],
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $res = curl_exec($ch);
    curl_close($ch);
    echo $res;
    exit;
}

// Update field using frappe.db.set_value (works for submitted docs)
if(isset($_GET['action']) && $_GET['action']==='update_field'){
    $input = json_decode(file_get_contents("php://input"), true);
    
    if(json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(["error" => "Invalid JSON input"]);
        exit;
    }
    
    $doctype = $input['doctype'] ?? '';
    $docname = $input['docname'] ?? '';
    $fieldname = $input['fieldname'] ?? '';
    $value = $input['value'] ?? '';
    
    if(!$doctype || !$docname || !$fieldname) {
        echo json_encode(["error" => "Missing parameters"]);
        exit;
    }
    
    logError("Updating via set_value: $doctype / $docname / $fieldname = $value");
    
    // Use frappe.db.set_value which works on submitted documents
    $ch = curl_init();
    $url = "$ERP_BASE/api/method/frappe.client.set_value";
    
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
            "Authorization: token $API_KEY:$API_SECRET",
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
if(isset($_GET['action']) && $_GET['action']==='get_link_options'){
    $doctype = $_GET['doctype'] ?? '';
    
    if(!$doctype) {
        echo json_encode(["error" => "DocType not specified"]);
        exit;
    }
    
    $ch = curl_init();
    $url = "$ERP_BASE/api/resource/$doctype?fields=[\"name\"]&limit_page_length=500";
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Authorization: token $API_KEY:$API_SECRET"],
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

    $usersFile = "users.json";
    $users = json_decode(file_get_contents($usersFile), true);

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

    // Wrap data in the 'users' key to maintain structure
    $newUsersData = ['users' => $data];

    if (file_put_contents($usersFile, json_encode($newUsersData, JSON_PRETTY_PRINT)) === false) {
        echo json_encode(["error" => "Failed to save users"]);
        exit;
    }

    echo json_encode(["message" => "User list updated successfully"]);
    exit;
}


// Save report configuration
if(isset($_GET['action']) && $_GET['action']==='save_report_config'){
    $input = json_decode(file_get_contents("php://input"), true);
    
    if(json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(["error" => "Invalid JSON"]);
        exit;
    }
    
    $config = $input['config'] ?? [];
    
    file_put_contents("report_config.json", json_encode($config, JSON_PRETTY_PRINT));
    echo json_encode(["message"=>"Report config saved"]);
    exit;
}

// Get report configuration
if(isset($_GET['action']) && $_GET['action']==='get_report_config'){
    if(file_exists("report_config.json")) {
        echo file_get_contents("report_config.json");
    } else {
        echo json_encode([]);
    }
    exit;
}

echo json_encode(["error"=>"Invalid request"]);
?>
