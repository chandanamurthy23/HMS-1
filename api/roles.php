<?php
/**
 * Hospital Management System (HMS) - Role & Permission Management API
 * Protected by 'roles.manage' permission. Allows Super Admin to view, create, edit roles and assign granular departmental permissions.
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
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/middleware.php';

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: $_POST;
$action = sanitize($input['action'] ?? $_GET['action'] ?? 'list');

// Enforce permission: roles.manage for modifying operations
if (in_array($action, ['create', 'update', 'update_permissions', 'delete'])) {
    $currentUser = requirePermission('roles.manage');
}
$db = getDB();

// ==========================================
// 1. LIST ALL ROLES
// ==========================================
if ($action === 'list') {
    try {
        $rolesStmt = $db->query("SELECT r.*, 
                                        (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id OR LOWER(u.role) = LOWER(r.slug)) AS user_count,
                                        (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS perm_count
                                 FROM roles r 
                                 ORDER BY r.is_system DESC, r.id ASC");
        $roles = $rolesStmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch permissions for each role
        $rolePermStmt = $db->prepare("SELECT p.code FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ?");

        $results = [];
        foreach ($roles as $r) {
            $rolePermStmt->execute([$r['id']]);
            $assignedCodes = $rolePermStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

            // If super_admin, shows all permissions
            if ($r['slug'] === 'super_admin') {
                $allPermCodes = $db->query("SELECT code FROM permissions")->fetchAll(PDO::FETCH_COLUMN) ?: [];
                $assignedCodes = $allPermCodes;
            }

            $results[] = [
                'id'          => (int)$r['id'],
                'name'        => $r['name'],
                'slug'        => $r['slug'],
                'description' => $r['description'] ?: '',
                'is_system'   => (bool)$r['is_system'],
                'user_count'  => (int)$r['user_count'],
                'perm_count'  => count($assignedCodes),
                'permissions' => $assignedCodes,
                'created_at'  => $r['created_at']
            ];
        }

        jsonResponse([
            'success' => true,
            'count'   => count($results),
            'roles'   => $results
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 2. GET ALL SYSTEM PERMISSIONS GROUPED
// ==========================================
if ($action === 'permissions') {
    try {
        $pStmt = $db->query("SELECT * FROM permissions ORDER BY module ASC, id ASC");
        $allPerms = $pStmt->fetchAll(PDO::FETCH_ASSOC);

        $grouped = [];
        foreach ($allPerms as $p) {
            $mod = $p['module'] ?: 'General';
            if (!isset($grouped[$mod])) {
                $grouped[$mod] = [];
            }
            $grouped[$mod][] = [
                'id'          => (int)$p['id'],
                'code'        => $p['code'],
                'name'        => $p['name'],
                'description' => $p['description'] ?: ''
            ];
        }

        jsonResponse([
            'success'     => true,
            'total_count' => count($allPerms),
            'grouped'     => $grouped
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 3. ROLE DETAILS & ASSIGNED USERS
// ==========================================
if ($action === 'details') {
    $roleId = (int)($_GET['id'] ?? $input['id'] ?? 0);
    if ($roleId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Valid Role ID is required.'], 422);
    }

    try {
        $rStmt = $db->prepare("SELECT * FROM roles WHERE id = ?");
        $rStmt->execute([$roleId]);
        $role = $rStmt->fetch(PDO::FETCH_ASSOC);

        if (!$role) {
            jsonResponse(['success' => false, 'message' => 'Role not found.'], 404);
        }

        // Assigned permission codes
        $pStmt = $db->prepare("SELECT p.code FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ?");
        $pStmt->execute([$roleId]);
        $perms = $pStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

        // Assigned users
        $uStmt = $db->prepare("SELECT id, name, email, phone, status, last_login FROM users WHERE role_id = ? OR LOWER(role) = LOWER(?)");
        $uStmt->execute([$roleId, $role['slug']]);
        $users = $uStmt->fetchAll(PDO::FETCH_ASSOC);

        jsonResponse([
            'success' => true,
            'role'    => [
                'id'          => (int)$role['id'],
                'name'        => $role['name'],
                'slug'        => $role['slug'],
                'description' => $role['description'],
                'is_system'   => (bool)$role['is_system'],
                'permissions' => $perms,
                'users'       => $users
            ]
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 4. CREATE CUSTOM ROLE
// ==========================================
if ($action === 'create') {
    $name        = sanitize($input['name'] ?? '');
    $description = sanitize($input['description'] ?? '');
    $permCodes   = is_array($input['permissions'] ?? null) ? $input['permissions'] : [];

    if (empty($name)) {
        jsonResponse(['success' => false, 'message' => 'Role Name is required.'], 422);
    }

    // Generate slug
    $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '_', trim($name)));
    if (empty($slug)) {
        $slug = 'custom_role_' . time();
    }

    // Check duplicate slug
    $chk = $db->prepare("SELECT id FROM roles WHERE slug = ? OR LOWER(name) = LOWER(?)");
    $chk->execute([$slug, $name]);
    if ($chk->fetch()) {
        jsonResponse(['success' => false, 'message' => "A role named '$name' already exists."], 409);
    }

    try {
        $db->beginTransaction();

        $ins = $db->prepare("INSERT INTO roles (name, slug, description, is_system) VALUES (?, ?, ?, 0)");
        $ins->execute([$name, $slug, $description]);
        $newRoleId = (int)$db->lastInsertId();

        // Assign permissions
        if (!empty($permCodes)) {
            $findP = $db->prepare("SELECT id FROM permissions WHERE code = ?");
            $insRP = $db->prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)");

            foreach ($permCodes as $code) {
                $findP->execute([$code]);
                $pRow = $findP->fetch();
                if ($pRow) {
                    $insRP->execute([$newRoleId, $pRow['id']]);
                }
            }
        }

        $db->commit();

        jsonResponse([
            'success' => true,
            'message' => "Custom role '$name' created successfully.",
            'role_id' => $newRoleId,
            'slug'    => $slug
        ], 201);
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        jsonResponse(['success' => false, 'message' => 'Failed to create role: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 5. UPDATE ROLE PERMISSIONS
// ==========================================
if ($action === 'update_permissions') {
    $roleId    = (int)($input['role_id'] ?? 0);
    $permCodes = is_array($input['permissions'] ?? null) ? $input['permissions'] : [];

    if ($roleId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Valid Role ID is required.'], 422);
    }

    // Verify role exists
    $rStmt = $db->prepare("SELECT id, name, slug, is_system FROM roles WHERE id = ?");
    $rStmt->execute([$roleId]);
    $role = $rStmt->fetch(PDO::FETCH_ASSOC);

    if (!$role) {
        jsonResponse(['success' => false, 'message' => 'Role not found.'], 404);
    }

    try {
        $db->beginTransaction();

        // Clear existing permissions
        $del = $db->prepare("DELETE FROM role_permissions WHERE role_id = ?");
        $del->execute([$roleId]);

        // Insert new permissions
        if (!empty($permCodes)) {
            $findP = $db->prepare("SELECT id FROM permissions WHERE code = ?");
            $insRP = $db->prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)");

            foreach ($permCodes as $code) {
                $findP->execute([$code]);
                $pRow = $findP->fetch();
                if ($pRow) {
                    $insRP->execute([$roleId, $pRow['id']]);
                }
            }
        }

        $db->commit();

        jsonResponse([
            'success' => true,
            'message' => "Permissions for role '{$role['name']}' have been updated. All users assigned to this role now possess the updated access rights."
        ]);
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        jsonResponse(['success' => false, 'message' => 'Failed to update permissions: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 6. DELETE CUSTOM ROLE
// ==========================================
if ($action === 'delete') {
    $roleId = (int)($input['role_id'] ?? 0);

    if ($roleId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Valid Role ID is required.'], 422);
    }

    $rStmt = $db->prepare("SELECT * FROM roles WHERE id = ?");
    $rStmt->execute([$roleId]);
    $role = $rStmt->fetch(PDO::FETCH_ASSOC);

    if (!$role) {
        jsonResponse(['success' => false, 'message' => 'Role not found.'], 404);
    }

    if (!empty($role['is_system'])) {
        jsonResponse(['success' => false, 'message' => "System core roles cannot be deleted."], 400);
    }

    // Check if users are currently assigned
    $uChk = $db->prepare("SELECT COUNT(*) FROM users WHERE role_id = ? OR LOWER(role) = LOWER(?)");
    $uChk->execute([$roleId, $role['slug']]);
    $assignedUsers = (int)$uChk->fetchColumn();

    if ($assignedUsers > 0) {
        jsonResponse([
            'success' => false,
            'message' => "Cannot delete role '{$role['name']}': $assignedUsers user(s) are currently assigned to this role. Please reassign them first."
        ], 400);
    }

    try {
        $db->beginTransaction();
        $db->prepare("DELETE FROM role_permissions WHERE role_id = ?")->execute([$roleId]);
        $db->prepare("DELETE FROM roles WHERE id = ?")->execute([$roleId]);
        $db->commit();

        jsonResponse([
            'success' => true,
            'message' => "Custom role '{$role['name']}' deleted successfully."
        ]);
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        jsonResponse(['success' => false, 'message' => 'Failed to delete role: ' . $e->getMessage()], 500);
    }
}

jsonResponse(['success' => false, 'message' => 'Unsupported action.'], 405);
