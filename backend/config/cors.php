<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | The Next.js frontend runs on a different origin (e.g. localhost:3000)
    | and calls this API with JSON. We expose /api/* to the frontend via a
    | configurable allowed-origins list (CORS_ALLOWED_ORIGINS in .env).
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(array_map('trim', explode(',', env(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000'
    )))),

    // Regex origins, comma-separated. Handy for local development where the
    // dev machine's LAN address changes (DHCP) and the browser is opened from
    // another device, e.g. http://192.168.1.6:3000.
    'allowed_origins_patterns' => array_filter(array_map('trim', explode(',', env(
        'CORS_ALLOWED_ORIGIN_PATTERNS',
        ''
    )))),

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Token-based auth, so cookies are not required.
    'supports_credentials' => false,

];
