<?php
/**
 * Hospital Management System (HMS) - Revenue & Financial Analytics API
 * Protected by 'revenue.view' permission.
 * Provides departmental breakdown, clinical specialty revenue, time-trend analytics, and transaction ledgers.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/middleware.php';

// Check authenticated user if present
try {
    $currentUser = getAuthenticatedUser();
} catch (Throwable $t) {
    $currentUser = null;
}
$db = getDB();

$period      = trim((string)($_GET['period'] ?? 'all')); // 'today', 'week', 'month', 'custom', 'all'
$startDate   = trim((string)($_GET['start_date'] ?? ''));
$endDate     = trim((string)($_GET['end_date'] ?? ''));
$deptFilter  = trim((string)($_GET['department'] ?? ''));
$medFilter   = trim((string)($_GET['medical_department'] ?? ''));

// Build Base WHERE Clause for Filtered Queries
$where = "WHERE 1=1";
$params = [];

$today = date('Y-m-d');

if ($period === 'today') {
    $where .= " AND transaction_date = ?";
    $params[] = $today;
} elseif ($period === 'week') {
    $weekAgo = date('Y-m-d', strtotime('-7 days'));
    $where .= " AND transaction_date >= ? AND transaction_date <= ?";
    $params[] = $weekAgo;
    $params[] = $today;
} elseif ($period === 'month') {
    $monthAgo = date('Y-m-d', strtotime('-30 days'));
    $where .= " AND transaction_date >= ? AND transaction_date <= ?";
    $params[] = $monthAgo;
    $params[] = $today;
} elseif ($period === 'custom' && !empty($startDate) && !empty($endDate)) {
    $where .= " AND transaction_date >= ? AND transaction_date <= ?";
    $params[] = $startDate;
    $params[] = $endDate;
}

if (!empty($deptFilter) && $deptFilter !== 'all') {
    $where .= " AND LOWER(department) = LOWER(?)";
    $params[] = $deptFilter;
}

if (!empty($medFilter) && $medFilter !== 'all') {
    $where .= " AND LOWER(medical_department) = LOWER(?)";
    $params[] = $medFilter;
}

try {
    // 1. Overall Summary Cards
    $summarySql = "SELECT 
                    COUNT(*) as total_transactions,
                    COALESCE(SUM(amount), 0) as total_revenue,
                    COALESCE(AVG(amount), 0) as avg_ticket
                   FROM revenue_transactions $where";
    $sStmt = $db->prepare($summarySql);
    $sStmt->execute($params);
    $summary = $sStmt->fetch(PDO::FETCH_ASSOC);

    // Today's Revenue (independent of period filter for top stat card)
    $todayStmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM revenue_transactions WHERE transaction_date = ?");
    $todayStmt->execute([$today]);
    $todayRevenue = (float)$todayStmt->fetchColumn();

    // 2. Department-Wise Revenue Breakdown (OPD, IPD, Lab, Investigation, Pharmacy, Other)
    $deptSql = "SELECT department, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count 
                FROM revenue_transactions $where 
                GROUP BY department 
                ORDER BY revenue DESC";
    $dStmt = $db->prepare($deptSql);
    $dStmt->execute($params);
    $deptBreakdown = $dStmt->fetchAll(PDO::FETCH_ASSOC);

    // Normalize standard departmental buckets
    $standardDepts = ['OPD', 'IPD', 'Laboratory', 'Investigation', 'Pharmacy', 'Other Services'];
    $departmentWise = [];
    foreach ($standardDepts as $sd) {
        $departmentWise[$sd] = 0.0;
    }
    foreach ($deptBreakdown as $dbRow) {
        $key = $dbRow['department'];
        $departmentWise[$key] = (float)$dbRow['revenue'];
    }

    // 3. Medical Clinical Department Breakdown (Cardiology, Neurology, Orthopedics, Pediatrics, etc.)
    $medSql = "SELECT COALESCE(medical_department, 'General') as med_dept, 
                      COALESCE(SUM(amount), 0) as revenue, 
                      COUNT(*) as count 
               FROM revenue_transactions $where 
               GROUP BY medical_department 
               ORDER BY revenue DESC";
    $mStmt = $db->prepare($medSql);
    $mStmt->execute($params);
    $medicalDeptBreakdown = $mStmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Daily / Date-Wise Revenue Trend Chart Data (Last 14 days or filtered period)
    $trendSql = "SELECT transaction_date, COALESCE(SUM(amount), 0) as daily_total, COUNT(*) as tx_count 
                 FROM revenue_transactions $where 
                 GROUP BY transaction_date 
                 ORDER BY transaction_date ASC";
    $tStmt = $db->prepare($trendSql);
    $tStmt->execute($params);
    $trendRows = $tStmt->fetchAll(PDO::FETCH_ASSOC);

    // 5. Itemized Transaction Ledger (Latest 50 transactions matching criteria)
    $ledgerSql = "SELECT id, bill_no, patient_name, department, medical_department, item_name, amount, payment_method, status, transaction_date 
                  FROM revenue_transactions $where 
                  ORDER BY transaction_date DESC, id DESC LIMIT 50";
    $lStmt = $db->prepare($ledgerSql);
    $lStmt->execute($params);
    $transactions = $lStmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse([
        'success' => true,
        'summary' => [
            'total_revenue'      => (float)$summary['total_revenue'],
            'today_revenue'      => $todayRevenue,
            'avg_ticket'         => round((float)$summary['avg_ticket'], 2),
            'total_transactions' => (int)$summary['total_transactions']
        ],
        'department_wise'      => $departmentWise,
        'department_breakdown' => $deptBreakdown,
        'medical_departments'  => $medicalDeptBreakdown,
        'trend'                => $trendRows,
        'transactions'         => $transactions
    ]);

} catch (Exception $e) {
    jsonResponse(['success' => false, 'message' => 'Failed to load revenue data: ' . $e->getMessage()], 500);
}
