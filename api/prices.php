<?php
/**
 * Hospital Management System (HMS) - Price Management API
 * Protected by granular permissions: 'price.view' for viewing and 'price.manage' for creating/updating/toggling prices.
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
$db = getDB();

// ==========================================
// 1. LIST PRICES (Requires 'price.view' or 'price.manage')
// ==========================================
if ($action === 'list') {
    try {
        $currentUser = getAuthenticatedUser();
    } catch (Throwable $t) {
        $currentUser = null;
    }

    $itemType   = trim((string)($_GET['type'] ?? 'all'));
    $search     = trim((string)($_GET['search'] ?? ''));
    $status     = trim((string)($_GET['status'] ?? 'all'));

    $sql = "SELECT b.*, d.name AS department_name 
            FROM billable_items b 
            LEFT JOIN departments d ON b.department_id = d.id 
            WHERE 1=1";
    $params = [];

    if (!empty($itemType) && $itemType !== 'all') {
        $sql .= " AND b.item_type = ?";
        $params[] = $itemType;
    }

    if (!empty($search)) {
        $sql .= " AND (LOWER(b.name) LIKE ? OR LOWER(b.code) LIKE ? OR LOWER(b.category) LIKE ?)";
        $term = '%' . strtolower($search) . '%';
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
    }

    if ($status === 'active') {
        $sql .= " AND b.status = 1";
    } elseif ($status === 'inactive') {
        $sql .= " AND b.status = 0";
    }

    $sql .= " ORDER BY b.item_type ASC, b.name ASC";

    try {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Check if current user has permission to manage/edit prices
        $canManage = !empty($currentUser['is_super_admin']) || in_array('price.manage', $currentUser['permissions'] ?? []);

        $cleanItems = array_map(function ($it) {
            return [
                'id'              => (int)$it['id'],
                'item_type'       => $it['item_type'],
                'category'        => $it['category'],
                'code'            => $it['code'],
                'name'            => $it['name'],
                'unit_price'      => (float)$it['unit_price'],
                'department_id'   => $it['department_id'] ? (int)$it['department_id'] : null,
                'department_name' => $it['department_name'] ?: 'General Hospital',
                'status'          => (int)$it['status'] === 1 ? 'active' : 'inactive',
                'created_at'      => $it['created_at']
            ];
        }, $items);

        jsonResponse([
            'success'    => true,
            'can_manage' => $canManage,
            'count'      => count($cleanItems),
            'items'      => $cleanItems
        ]);

    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Failed to load prices: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 2. SAVE / UPDATE PRICE (Requires 'price.manage')
// ==========================================
if ($action === 'save') {
    $currentUser = requirePermission('price.manage');

    $id        = (int)($input['id'] ?? 0);
    $itemType  = sanitize($input['item_type'] ?? 'service');
    $category  = sanitize($input['category'] ?? 'General');
    $code      = strtoupper(trim(sanitize($input['code'] ?? '')));
    $name      = sanitize($input['name'] ?? '');
    $price     = (float)($input['unit_price'] ?? $input['price'] ?? 0);
    $deptId    = !empty($input['department_id']) ? (int)$input['department_id'] : null;
    $status    = isset($input['status']) ? ((int)$input['status'] === 1 || $input['status'] === 'active' ? 1 : 0) : 1;

    if (empty($name) || empty($code) || $price < 0) {
        jsonResponse(['success' => false, 'message' => 'Item Name, Unique Code, and a valid Unit Price are required.'], 422);
    }

    try {
        if ($id > 0) {
            // Update
            $chk = $db->prepare("SELECT id FROM billable_items WHERE id = ?");
            $chk->execute([$id]);
            if (!$chk->fetch()) {
                jsonResponse(['success' => false, 'message' => 'Item not found.'], 404);
            }

            // Check duplicate code on other items
            $dup = $db->prepare("SELECT id FROM billable_items WHERE code = ? AND id != ?");
            $dup->execute([$code, $id]);
            if ($dup->fetch()) {
                jsonResponse(['success' => false, 'message' => "Item Code '$code' is already in use by another item."], 409);
            }

            $up = $db->prepare("UPDATE billable_items SET item_type = ?, category = ?, code = ?, name = ?, unit_price = ?, department_id = ?, status = ? WHERE id = ?");
            $up->execute([$itemType, $category, $code, $name, $price, $deptId, $status, $id]);

            jsonResponse([
                'success' => true,
                'message' => "Item '$name' updated successfully.",
                'item'    => ['id' => $id, 'name' => $name, 'unit_price' => $price, 'code' => $code]
            ]);
        } else {
            // Create
            $dup = $db->prepare("SELECT id FROM billable_items WHERE code = ?");
            $dup->execute([$code]);
            if ($dup->fetch()) {
                jsonResponse(['success' => false, 'message' => "Item Code '$code' already exists."], 409);
            }

            $ins = $db->prepare("INSERT INTO billable_items (item_type, category, code, name, unit_price, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $ins->execute([$itemType, $category, $code, $name, $price, $deptId, $status]);
            $newId = (int)$db->lastInsertId();

            jsonResponse([
                'success' => true,
                'message' => "New billable item '$name' added successfully.",
                'item'    => ['id' => $newId, 'name' => $name, 'unit_price' => $price, 'code' => $code]
            ], 201);
        }
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Failed to save item: ' . $e->getMessage()], 500);
    }
}

// ==========================================
// 3. TOGGLE STATUS (Requires 'price.manage')
// ==========================================
if ($action === 'toggle_status') {
    $currentUser = requirePermission('price.manage');
    $id = (int)($input['id'] ?? 0);

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Invalid Item ID.'], 422);
    }

    try {
        $stmt = $db->prepare("SELECT id, name, status FROM billable_items WHERE id = ?");
        $stmt->execute([$id]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            jsonResponse(['success' => false, 'message' => 'Item not found.'], 404);
        }

        $newStatus = ((int)$item['status'] === 1) ? 0 : 1;
        $db->prepare("UPDATE billable_items SET status = ? WHERE id = ?")->execute([$newStatus, $id]);

        jsonResponse([
            'success'    => true,
            'new_status' => $newStatus === 1 ? 'active' : 'inactive',
            'message'    => "Item '{$item['name']}' status changed to " . ($newStatus === 1 ? 'Active' : 'Inactive') . "."
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Failed to toggle status: ' . $e->getMessage()], 500);
    }
}

jsonResponse(['success' => false, 'message' => 'Unsupported action.'], 405);
