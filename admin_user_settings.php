<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

$settingsFile = __DIR__ . '/user_settings.json';

// BOOTSTRAP: Define initial admins who should always have access
$BOOTSTRAP_ADMINS = [
    'marblehouse@gmail.com',
    // Add other bootstrap admins here
];

// Get current user from request
// For GET requests, use query parameter
// For POST requests with JSON body, read from decoded JSON
$currentUserEmail = null;

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $currentUserEmail = $_GET['currentUser'] ?? null;
} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // First try to get from POST (for form data)
    $currentUserEmail = $_POST['currentUser'] ?? null;
    
    // If not in POST, read from JSON body
    if (!$currentUserEmail) {
        $postData = file_get_contents('php://input');
        if ($postData) {
            $jsonData = json_decode($postData, true);
            $currentUserEmail = $jsonData['currentUser'] ?? null;
        }
    }
}

// Log for debugging
error_log("Current user email: " . ($currentUserEmail ?? 'NULL'));
error_log("Request method: " . $_SERVER['REQUEST_METHOD']);

if (!$currentUserEmail) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized - No user provided']);
    exit;
}

// Load settings with auto-initialization
function loadSettings($settingsFile, $bootstrapAdmins, $currentUser) {
    $needsSave = false;
    
    if (file_exists($settingsFile)) {
        $content = file_get_contents($settingsFile);
        $settings = json_decode($content, true);
        
        // Validate structure
        if (!isset($settings['admins'])) $settings['admins'] = [];
        if (!isset($settings['users'])) $settings['users'] = [];
        if (!isset($settings['available_attributes'])) {
            $settings['available_attributes'] = [
                'sku', 'label', 'price', 'cost', 'msrp', 'categories', 
                'productfamily', 'images', 'thumbnail', 'assets', 
                'enabledisableproduct', 'description', 'weight', 
                'dimensions', 'material', 'color', 'finish'
            ];
            $needsSave = true;
        }
    } else {
        // File doesn't exist - create default structure
        $settings = [
            'admins' => [],
            'users' => [],
            'available_attributes' => [
                'sku', 'label', 'price', 'cost', 'msrp', 'categories', 
                'productfamily', 'images', 'thumbnail', 'assets', 
                'enabledisableproduct', 'description', 'weight', 
                'dimensions', 'material', 'color', 'finish'
            ]
        ];
        $needsSave = true;
    }
    
    // Bootstrap: If no admins exist, add bootstrap admins
    if (empty($settings['admins'])) {
        $settings['admins'] = $bootstrapAdmins;
        $needsSave = true;
        
        // Add bootstrap admins to users array if not present
        foreach ($bootstrapAdmins as $adminEmail) {
            $userExists = false;
            foreach ($settings['users'] as $user) {
                if ($user['email'] === $adminEmail) {
                    $userExists = true;
                    break;
                }
            }
            
            if (!$userExists) {
                $settings['users'][] = [
                    'email' => $adminEmail,
                    'role' => 'admin',
                    'visible_attributes' => ['all'],
                    'editable_attributes' => ['all']
                ];
            }
        }
    }
    
    // Auto-add current user if they're a bootstrap admin but not in the system
    if (in_array($currentUser, $bootstrapAdmins)) {
        $userExists = false;
        foreach ($settings['users'] as $user) {
            if ($user['email'] === $currentUser) {
                $userExists = true;
                break;
            }
        }
        
        if (!$userExists) {
            $settings['users'][] = [
                'email' => $currentUser,
                'role' => 'admin',
                'visible_attributes' => ['all'],
                'editable_attributes' => ['all']
            ];
            $needsSave = true;
        }
        
        if (!in_array($currentUser, $settings['admins'])) {
            $settings['admins'][] = $currentUser;
            $needsSave = true;
        }
    }
    
    // Save if changes were made
    if ($needsSave) {
        saveSettings($settingsFile, $settings);
    }
    
    return $settings;
}

// Save settings
function saveSettings($settingsFile, $settings) {
    return file_put_contents($settingsFile, json_encode($settings, JSON_PRETTY_PRINT));
}

// Check if user is admin
function isAdmin($email, $settings) {
    return in_array($email, $settings['admins'] ?? []);
}

// Get action from GET or decoded JSON POST
$action = null;
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? 'get';
} else {
    $postData = file_get_contents('php://input');
    if ($postData) {
        $jsonData = json_decode($postData, true);
        $action = $jsonData['action'] ?? null;
    }
}

error_log("Action: " . ($action ?? 'NULL'));

// Load settings with bootstrap
$settings = loadSettings($settingsFile, $BOOTSTRAP_ADMINS, $currentUserEmail);

// ACTION: Get all settings
if ($action === 'get') {
    // Check if current user is admin
    if (!isAdmin($currentUserEmail, $settings)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden - Admin access required']);
        exit;
    }
    
    echo json_encode([
        'success' => true,
        'settings' => $settings
    ]);
    exit;
}

// ACTION: Get current user's permissions
if ($action === 'getPermissions') {
    $userPermissions = null;
    foreach ($settings['users'] as $user) {
        if ($user['email'] === $currentUserEmail) {
            $userPermissions = $user;
            break;
        }
    }
    
    if (!$userPermissions) {
        // Default permissions if user not found
        $userPermissions = [
            'email' => $currentUserEmail,
            'role' => 'user',
            'visible_attributes' => ['sku', 'label', 'images', 'thumbnail', 'assets'],
            'editable_attributes' => []
        ];
    }
    
    $userPermissions['isAdmin'] = isAdmin($currentUserEmail, $settings);
    
    echo json_encode([
        'success' => true,
        'permissions' => $userPermissions
    ]);
    exit;
}

// ACTION: Save settings (admin only)
if ($action === 'save') {
    if (!isAdmin($currentUserEmail, $settings)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden - Admin access required']);
        exit;
    }
    
    $postData = file_get_contents('php://input');
    $data = json_decode($postData, true);
    
    if (!$data || !isset($data['settings'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid data']);
        exit;
    }
    
    $newSettings = $data['settings'];
    
    // Validate structure
    if (!isset($newSettings['admins']) || !isset($newSettings['users']) || !isset($newSettings['available_attributes'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid settings structure']);
        exit;
    }
    
    // Ensure at least one admin exists
    if (empty($newSettings['admins'])) {
        http_response_code(400);
        echo json_encode(['error' => 'At least one admin must exist']);
        exit;
    }
    
    if (saveSettings($settingsFile, $newSettings)) {
        echo json_encode([
            'success' => true,
            'message' => 'Settings saved successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save settings']);
    }
    exit;
}

// ACTION: Add user
if ($action === 'addUser') {
    if (!isAdmin($currentUserEmail, $settings)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden - Admin access required']);
        exit;
    }
    
    $postData = file_get_contents('php://input');
    $data = json_decode($postData, true);
    
    $newUserEmail = $data['email'] ?? null;
    $role = $data['role'] ?? 'user';
    
    if (!$newUserEmail || !filter_var($newUserEmail, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email address']);
        exit;
    }
    
    // Check if user already exists
    foreach ($settings['users'] as $user) {
        if ($user['email'] === $newUserEmail) {
            http_response_code(400);
            echo json_encode(['error' => 'User already exists']);
            exit;
        }
    }
    
    // Add new user
    $newUser = [
        'email' => $newUserEmail,
        'role' => $role,
        'visible_attributes' => $data['visible_attributes'] ?? ($role === 'admin' ? ['all'] : ['sku', 'label', 'images', 'thumbnail', 'assets']),
        'editable_attributes' => $data['editable_attributes'] ?? ($role === 'admin' ? ['all'] : [])
    ];
    
    $settings['users'][] = $newUser;
    
    // If role is admin, add to admins array
    if ($role === 'admin') {
        if (!in_array($newUserEmail, $settings['admins'])) {
            $settings['admins'][] = $newUserEmail;
        }
    }
    
    if (saveSettings($settingsFile, $settings)) {
        echo json_encode([
            'success' => true,
            'message' => 'User added successfully',
            'user' => $newUser
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save settings']);
    }
    exit;
}




// ACTION: Update user
if ($action === 'updateUser') {
    
    if (!isAdmin($currentUserEmail, $settings)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden - Admin access required']);
        exit;
    }
    
    $postData = file_get_contents('php://input');
    $data = json_decode($postData, true);
    
    $userEmail = $data['email'] ?? null;
    
    if (!$userEmail) {
        http_response_code(400);
        echo json_encode(['error' => 'Email required']);
        exit;
    }
    
    // Find and update user
    $userFound = false;
    foreach ($settings['users'] as &$user) {
        if ($user['email'] === $userEmail) {
            $user['role'] = $data['role'] ?? $user['role'];
            
            // CRITICAL: Use exactly what was sent, don't override
            $user['visible_attributes'] = $data['visible_attributes'] ?? $user['visible_attributes'];
            $user['editable_attributes'] = $data['editable_attributes'] ?? $user['editable_attributes'];
            
            $userFound = true;
            
            // Update admin status
            if ($user['role'] === 'admin') {
                if (!in_array($userEmail, $settings['admins'])) {
                    $settings['admins'][] = $userEmail;
                }
            } else {
                $settings['admins'] = array_values(array_filter($settings['admins'], function($email) use ($userEmail) {
                    return $email !== $userEmail;
                }));
            }
            
            break;
        }
    }
    
    if (!$userFound) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit;
    }
    
    // Ensure at least one admin remains
    if (empty($settings['admins'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot remove last admin']);
        exit;
    }
    
    if (saveSettings($settingsFile, $settings)) {
        echo json_encode([
            'success' => true,
            'message' => 'User updated successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save settings']);
    }
    exit;
}










// ACTION: Delete user
if ($action === 'deleteUser') {
    if (!isAdmin($currentUserEmail, $settings)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden - Admin access required']);
        exit;
    }
    
    $postData = file_get_contents('php://input');
    $data = json_decode($postData, true);
    
    $userEmail = $data['email'] ?? null;
    
    if (!$userEmail) {
        http_response_code(400);
        echo json_encode(['error' => 'Email required']);
        exit;
    }
    
    // Prevent deleting yourself
    if ($userEmail === $currentUserEmail) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot delete your own account']);
        exit;
    }
    
    // Check if this would remove the last admin
    $remainingAdmins = array_filter($settings['admins'], function($email) use ($userEmail) {
        return $email !== $userEmail;
    });
    
    if (empty($remainingAdmins)) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot delete the last admin']);
        exit;
    }
    
    // Remove user
    $settings['users'] = array_values(array_filter($settings['users'], function($user) use ($userEmail) {
        return $user['email'] !== $userEmail;
    }));
    
    // Remove from admins if present
    $settings['admins'] = array_values($remainingAdmins);
    
    if (saveSettings($settingsFile, $settings)) {
        echo json_encode([
            'success' => true,
            'message' => 'User deleted successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save settings']);
    }
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Invalid action: ' . ($action ?? 'none')]);
?>
