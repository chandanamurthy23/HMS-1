<?php
/**
 * Hospital Management System (HMS) - User Management API
 * Protected by 'users.manage' permission. Allows Super Admin to view, create, edit, activate/deactivate, and reset passwords.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/middleware.php';

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: $_POST;
$action = sanitize($input['action'] ?? $_GET['action'] ?? 'list');

// Permission Guard
if ($action === 'auto_provision_patient') {
    // Staff with patient access (Receptionist, Doctor, Admin, Super Admin) can provision patient portal logins
    $currentUser = requireAuth();
    $perms = $currentUser['permissions'] ?? [];
    $isSuperAdmin = ($currentUser['role'] === 'Super Admin' || ($currentUser['role_slug'] ?? '') === 'super_admin');
    if (!$isSuperAdmin && !in_array('patient.view', $perms) && !in_array('users.manage', $perms) && !in_array('opd.reception', $perms)) {
        jsonResponse(['success' => false, 'message' => 'Unauthorized: Insufficient permissions to register patient accounts.'], 403);
    }
} else if (in_array($action, ['create', 'update', 'toggle_status', 'reset_password', 'delete'])) {
    // General user administration modification requires users.manage
    $currentUser = requirePermission('users.manage');
}

$db = getDB();

// ==========================================
// 1. LIST USERS
// ==========================================
if ($action === 'list') {
    $search = trim((string)($_GET['search'] ?? ''));
    $roleFilter = trim((string)($_GET['role'] ?? ''));
    $statusFilter = trim((string)($_GET['status'] ?? ''));

    $sql = "SELECT u.id, u.name, u.email, u.phone, u.role, u.role_id, u.status, u.department_id, u.created_at, u.last_login,
                   r.name AS role_name, r.slug AS role_slug,
                   d.name AS department_name
            FROM users u
            LEFT JOIN roles r ON (u.role_id = r.id OR LOWER(u.role) = LOWER(r.slug))
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE 1=1";
    $params = [];

    if (!empty($search)) {
        $sql .= " AND (LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR u.phone LIKE ?)";
        $searchTerm = '%' . strtolower($search) . '%';
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = '%' . $search . '%';
    }

    if (!empty($roleFilter) && $roleFilter !== 'all') {
        $sql .= " AND (LOWER(u.role) = LOWER(?) OR LOWER(r.slug) = LOWER(?))";
        $params[] = $roleFilter;
        $params[] = $roleFilter;
    }

    if (!empty($statusFilter) && $statusFilter !== 'all') {
        $sql .= " AND LOWER(u.status) = LOWER(?)";
        $params[] = $statusFilter;
    }

    $sql .= " ORDER BY u.id DESC";

    try {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Sanitize output (strip sensitive fields)
        $cleanUsers = array_map(function ($u) {
            return [
                'id'              => (int)$u['id'],
                'name'            => $u['name'],
                'email'           => $u['email'],
                'phone'           => $u['phone'] ?: '',
                'role'            => $u['role_name'] ?: ucfirst($u['role']),
                'role_slug'       => $u['role_slug'] ?: $u['role'],
                'role_id'         => $u['role_id'] ? (int)$u['role_id'] : null,
                'status'          => strtolower($u['status'] ?: 'active'),
                'department_id'   => $u['department_id'] ? (int)$u['department_id'] : null,
                'department_name' => $u['department_name'] ?: 'General Hospital',
                'created_at'      => $u['created_at'],
                'last_login'      => $u['last_login'] ?: 'Never'
            ];
        }, $users);

        jsonResponse([
            'success' => true,
            'count'   => count($cleanUsers),
            'users'   => $cleanUsers
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 2. CREATE USER
// ==========================================
if ($action === 'create') {
    $name     = sanitize($input['name'] ?? '');
    $email    = trim(strtolower(sanitize($input['email'] ?? '')));
    $phone    = sanitize($input['phone'] ?? '');
    $roleId   = (int)($input['role_id'] ?? 0);
    $roleSlug = sanitize($input['role_slug'] ?? $input['role'] ?? '');
    $deptId   = !empty($input['department_id']) ? (int)$input['department_id'] : null;
    $password = (string)($input['password'] ?? '');

    if (empty($name) || empty($email) || empty($password)) {
        jsonResponse(['success' => false, 'message' => 'Name, Email, and Password are required.'], 422);
    }

    if (strlen($password) < 6) {
        jsonResponse(['success' => false, 'message' => 'Password must be at least 6 characters.'], 422);
    }

    // Resolve Role
    $roleRecord = null;
    if ($roleId > 0) {
        $rStmt = $db->prepare("SELECT id, slug, name FROM roles WHERE id = ?");
        $rStmt->execute([$roleId]);
        $roleRecord = $rStmt->fetch(PDO::FETCH_ASSOC);
    }
    if (!$roleRecord && !empty($roleSlug)) {
        $rStmt = $db->prepare("SELECT id, slug, name FROM roles WHERE slug = ? OR LOWER(name) = ? LIMIT 1");
        $rStmt->execute([$roleSlug, $roleSlug]);
        $roleRecord = $rStmt->fetch(PDO::FETCH_ASSOC);
    }
    if (!$roleRecord) {
        // Fallback default role
        $roleRecord = ['id' => 3, 'slug' => 'receptionist', 'name' => 'Receptionist'];
    }

    // Check duplicate email
    $chk = $db->prepare("SELECT id FROM users WHERE LOWER(email) = ?");
    $chk->execute([$email]);
    if ($chk->fetch()) {
        jsonResponse(['success' => false, 'message' => 'A user account with this email address already exists.'], 409);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $avatar = 'assets/images/avatars/admin.jpg';
    if ($roleRecord['slug'] === 'doctor') {
        $avatar = 'assets/images/doctors/dr-ananya.jpg';
    }

    try {
        $ins = $db->prepare("INSERT INTO users (name, email, password, role, role_id, phone, status, department_id, avatar) 
                             VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)");
        $ins->execute([$name, $email, $hash, $roleRecord['slug'], $roleRecord['id'], $phone, $deptId, $avatar]);
        $newId = (int)$db->lastInsertId();

        // Automated Email Dispatch via HMSMailer
        $sendEmail = !empty($input['send_email']) || $roleRecord['slug'] === 'patient';
        $mailResult = null;
        if ($sendEmail) {
            $mailResult = HMSMailer::sendWelcomeCredentials($email, $name, $password, $roleRecord['name']);
        }

        jsonResponse([
            'success' => true,
            'message' => "User '$name' created successfully." . ($sendEmail ? " Login credentials dispatched to $email." : ""),
            'email_dispatched' => (bool)$sendEmail,
            'email_details'    => $sendEmail ? [
                'to'            => $email,
                'username'      => $email,
                'temp_password' => $password,
                'role'          => $roleRecord['name']
            ] : null,
            'user'    => [
                'id'            => $newId,
                'name'          => $name,
                'email'         => $email,
                'phone'         => $phone,
                'role'          => $roleRecord['name'],
                'role_slug'     => $roleRecord['slug'],
                'role_id'       => (int)$roleRecord['id'],
                'status'        => 'active',
                'department_id' => $deptId
            ]
        ], 201);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Failed to create user: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 3. UPDATE USER
// ==========================================
if ($action === 'update') {
    $userId = (int)($input['id'] ?? 0);
    $name   = sanitize($input['name'] ?? '');
    $email  = trim(strtolower(sanitize($input['email'] ?? '')));
    $phone  = sanitize($input['phone'] ?? '');
    $roleId = (int)($input['role_id'] ?? 0);
    $deptId = !empty($input['department_id']) ? (int)$input['department_id'] : null;
    $status = strtolower(sanitize($input['status'] ?? 'active'));

    if ($userId <= 0 || empty($name) || empty($email)) {
        jsonResponse(['success' => false, 'message' => 'Valid User ID, Name, and Email are required.'], 422);
    }

    // Check user exists
    $targetStmt = $db->prepare("SELECT * FROM users WHERE id = ?");
    $targetStmt->execute([$userId]);
    $targetUser = $targetStmt->fetch(PDO::FETCH_ASSOC);

    if (!$targetUser) {
        jsonResponse(['success' => false, 'message' => 'Target user not found.'], 404);
    }

    // Check duplicate email for another user
    $dup = $db->prepare("SELECT id FROM users WHERE LOWER(email) = ? AND id != ?");
    $dup->execute([$email, $userId]);
    if ($dup->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Another user account already uses this email.'], 409);
    }

    // Resolve Role
    $roleRecord = null;
    if ($roleId > 0) {
        $rStmt = $db->prepare("SELECT id, slug, name FROM roles WHERE id = ?");
        $rStmt->execute([$roleId]);
        $roleRecord = $rStmt->fetch(PDO::FETCH_ASSOC);
    }
    $finalRoleSlug = $roleRecord ? $roleRecord['slug'] : $targetUser['role'];
    $finalRoleId   = $roleRecord ? (int)$roleRecord['id'] : $targetUser['role_id'];

    try {
        $up = $db->prepare("UPDATE users SET name = ?, email = ?, phone = ?, role = ?, role_id = ?, department_id = ?, status = ? WHERE id = ?");
        $up->execute([$name, $email, $phone, $finalRoleSlug, $finalRoleId, $deptId, $status, $userId]);

        jsonResponse([
            'success' => true,
            'message' => "User details for '$name' updated successfully."
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Failed to update user: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 4. TOGGLE STATUS (Activate / Deactivate)
// ==========================================
if ($action === 'toggle_status') {
    $userId = (int)($input['id'] ?? 0);

    if ($userId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Invalid User ID.'], 422);
    }

    if ($userId === (int)$currentUser['id']) {
        jsonResponse(['success' => false, 'message' => 'You cannot deactivate your own active session account.'], 400);
    }

    $targetStmt = $db->prepare("SELECT id, name, status, role FROM users WHERE id = ?");
    $targetStmt->execute([$userId]);
    $targetUser = $targetStmt->fetch(PDO::FETCH_ASSOC);

    if (!$targetUser) {
        jsonResponse(['success' => false, 'message' => 'User not found.'], 404);
    }

    $currentStatus = strtolower(trim((string)$targetUser['status']));
    $newStatus = ($currentStatus === 'active') ? 'inactive' : 'active';

    try {
        $up = $db->prepare("UPDATE users SET status = ? WHERE id = ?");
        $up->execute([$newStatus, $userId]);

        jsonResponse([
            'success'    => true,
            'new_status' => $newStatus,
            'message'    => "User '{$targetUser['name']}' status changed to " . ucfirst($newStatus) . "."
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Failed to toggle status: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 5. RESET PASSWORD
// ==========================================
if ($action === 'reset_password') {
    $userId      = (int)($input['id'] ?? 0);
    $newPassword = (string)($input['new_password'] ?? '');

    if ($userId <= 0 || empty($newPassword)) {
        jsonResponse(['success' => false, 'message' => 'User ID and New Password are required.'], 422);
    }

    if (strlen($newPassword) < 6) {
        jsonResponse(['success' => false, 'message' => 'New password must be at least 6 characters.'], 422);
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT);

    try {
        $uStmt = $db->prepare("SELECT id, name, email FROM users WHERE id = ?");
        $uStmt->execute([$userId]);
        $targetUser = $uStmt->fetch(PDO::FETCH_ASSOC);

        $up = $db->prepare("UPDATE users SET password = ? WHERE id = ?");
        $up->execute([$hash, $userId]);

        // Send email with new password
        $emailSent = false;
        if ($targetUser && !empty($targetUser['email'])) {
            HMSMailer::sendPasswordReset($targetUser['email'], $targetUser['name'], $newPassword);
            $emailSent = true;
        }

        jsonResponse([
            'success'          => true,
            'message'          => 'User password successfully updated' . ($emailSent ? " and sent to {$targetUser['email']}." : '.'),
            'email_dispatched' => $emailSent
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Failed to reset password: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 6. AUTO-PROVISION PATIENT PORTAL ACCOUNT
// ==========================================
if ($action === 'auto_provision_patient') {
    $name  = sanitize($input['name'] ?? '');
    $email = trim(strtolower(sanitize($input['email'] ?? '')));
    $phone = sanitize($input['phone'] ?? '');

    if (empty($name) || empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'message' => 'Valid Patient Name and Email are required.'], 422);
    }

    $tempPassword = !empty($input['password']) ? (string)$input['password'] : 'MedPulse@' . rand(1000, 9999);
    $hash = password_hash($tempPassword, PASSWORD_BCRYPT);

    try {
        $chk = $db->prepare("SELECT id, email FROM users WHERE LOWER(email) = ?");
        $chk->execute([$email]);
        $existing = $chk->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $up = $db->prepare("UPDATE users SET password = ?, status = 'active' WHERE id = ?");
            $up->execute([$hash, $existing['id']]);
            $userId = (int)$existing['id'];
        } else {
            $ins = $db->prepare("INSERT INTO users (name, email, password, role, role_id, phone, status, avatar) 
                                 VALUES (?, ?, ?, 'patient', 9, ?, 'active', 'assets/images/avatars/patient.jpg')");
            $ins->execute([$name, $email, $hash, $phone]);
            $userId = (int)$db->lastInsertId();
        }

        // Dispatch Welcome Credentials Email
        $mailResult = HMSMailer::sendWelcomeCredentials($email, $name, $tempPassword, 'Patient');

        jsonResponse([
            'success'          => true,
            'message'          => "Patient Portal account provisioned. Login credentials dispatched to $email.",
            'user_id'          => $userId,
            'email_dispatched' => true,
            'email_details'    => [
                'to'            => $email,
                'username'      => $email,
                'temp_password' => $tempPassword,
                'role'          => 'Patient'
            ]
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Failed to provision patient portal: ' . $e->getMessage()], 500);
    }
}

jsonResponse(['success' => false, 'message' => 'Unsupported action.'], 405);
