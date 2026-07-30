<?php
// ========== CONFIG ==========
// Edit these values for your environment.

return [
    // Database
    'db_host'      => '127.0.0.1',
    'db_port'      => 3306,
    'db_name'      => 'realestate',
    'db_user'      => 'root',
    'db_pass'      => '',                       // Wamp default: blank

    // Application
    'app_name'     => 'Agrocorp Estate Dashboard',
    'company_name' => 'Agrocorp',
    'currency'     => 'INR',
    'threshold'    => 50000,                    // Expenses above this need Management approval
    'base_url'     => 'http://localhost/realestate',   // no trailing slash

    // Session cookie name (only change if running multiple apps on same host)
    'session_name' => 'REALESTATE_SESSION',

    // Google Workspace SMTP (optional — leave blank to skip email invites;
    // the temp password will still be shown on-screen after creating a user)
    'smtp_host'    => 'smtp.gmail.com',
    'smtp_port'    => 587,
    'smtp_user'    => 'sales@agrocorp.co.in',
    'smtp_pass'    => '',                       // Google App Password
    'smtp_from'    => 'sales@agrocorp.co.in',
    'smtp_name'    => 'Agrocorp Internal',
];
