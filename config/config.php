<?php
/**
 * Hospital Management System (HMS) - Global Configuration
 */

// Safe session initialization for serverless / lambda environments
if (session_status() === PHP_SESSION_NONE) {
    if (is_dir('/tmp') && is_writable('/tmp')) {
        @ini_set('session.save_path', '/tmp');
    }
    @session_start();
}

// Environment & Error reporting
error_reporting(E_ALL);
ini_set('display_errors', 0); // Set to 1 during debugging

// Site Details
define('SITE_NAME', 'HMS - Hospital & Medical Centre');
define('SITE_TAGLINE', 'Compassionate Care, Advanced Healthcare');
define('SITE_URL', 'http://localhost/HMS');
define('SITE_EMAIL', 'info@hmshospital.com');
define('SITE_PHONE', '+91 98765 43210');
define('SITE_ADDRESS', '742 Healthcare Ave, Medical District, Bangalore - 560001');

// Database Credentials (Defaults to Aiven Cloud MySQL with Vercel Env Var override)
define('DB_HOST', getenv('DB_HOST') ?: 'mysql-28cb2d4c-chandanap-0903.i.aivencloud.com');
define('DB_PORT', getenv('DB_PORT') ?: '26919');
define('DB_NAME', getenv('DB_NAME') ?: 'defaultdb');
define('DB_USER', getenv('DB_USER') ?: 'avnadmin');
define('DB_PASS', (getenv('DB_PASS') !== false && getenv('DB_PASS') !== '') ? getenv('DB_PASS') : base64_decode('QVZOU19SdFpmYW93MDdTUFJ2MXFnc1hO'));
define('DB_CHARSET', 'utf8mb4');

// SQLite fallback path
define('SQLITE_DB_PATH', __DIR__ . '/../database.sqlite');

// Upload directory
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('UPLOAD_URL', SITE_URL . '/uploads/');

// ==========================================
// SMTP MAIL CONFIGURATION (FOR LIVE EMAIL DELIVERY)
// ==========================================
define('SMTP_ENABLED', getenv('SMTP_ENABLED') !== false ? filter_var(getenv('SMTP_ENABLED'), FILTER_VALIDATE_BOOLEAN) : false);
define('SMTP_HOST', getenv('SMTP_HOST') ?: 'smtp.hostinger.com');
define('SMTP_PORT', getenv('SMTP_PORT') ?: 465);
define('SMTP_SECURE', getenv('SMTP_SECURE') ?: 'ssl');
define('SMTP_USER', getenv('SMTP_USER') ?: '');
define('SMTP_PASS', getenv('SMTP_PASS') ?: '');
define('SMTP_FROM_EMAIL', getenv('SMTP_FROM_EMAIL') ?: 'no-reply@medpulse-hms.com');
define('SMTP_FROM_NAME', getenv('SMTP_FROM_NAME') ?: 'MedPulse Hospital Management System');
