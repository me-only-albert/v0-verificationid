<?php

return [
    'api_keys' => [
        'ganti-dengan-api-key-panjang',
    ],
    'registry' => [
        'server' => '202.83.120.48',
        'instance' => 'sqlexpress',
        'port' => null,
        'database' => 'DB_DAINTY_REPORTS',
        'username' => 'daintyuser',
        'password' => 'isi-password-di-config-php',
    ],
    'defaults' => [
        'central_crm_database' => 'DB_DAINTY_CRM',
        'customer_table' => 't5_Customer',
        'customer_phone_column' => 'MobilePhone',
        'verification_table' => 't5_Customer_verification_codes',
        'verification_phone_column' => 'MobilePhone',
        'otp_ttl_minutes' => 10,
        'same_phone_code_cooldown_days' => 60,
    ],
    'client_overrides' => [
        'mox' => [
            'test_customer_phone' => '085789850597',
            'test_whatsapp_phone' => '087786577529',
        ],
    ],
];
