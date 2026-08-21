<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    http_response_code(204);
    exit;
}

header('Access-Control-Allow-Origin: *');

const TEMP_WHATSAPP_PHONE = '085111370016';

final class ApiError extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $apiCode,
        string $message
    ) {
        parent::__construct($message);
    }
}

function json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function input_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function load_config(): array
{
    $path = __DIR__ . '/config.php';
    if (!is_file($path)) {
        throw new ApiError(500, 'CONFIG_MISSING', 'File config.php belum dibuat.');
    }

    $config = require $path;
    if (!is_array($config)) {
        throw new ApiError(500, 'CONFIG_INVALID', 'Format config.php tidak valid.');
    }

    return $config;
}

function require_api_key(array $config): void
{
    $keys = $config['api_keys'] ?? [];
    $given = $_SERVER['HTTP_X_API_KEY'] ?? '';

    if (!is_array($keys) || $given === '') {
        throw new ApiError(401, 'UNAUTHORIZED', 'API key wajib diisi.');
    }

    foreach ($keys as $key) {
        if (is_string($key) && hash_equals($key, $given)) {
            return;
        }
    }

    throw new ApiError(401, 'UNAUTHORIZED', 'API key tidak valid.');
}

function client_config(array $config, string $outletId): array
{
    $defaults = $config['defaults'] ?? [];
    $overrides = $config['client_overrides'][$outletId] ?? [];

    if (!is_array($defaults) || !is_array($overrides)) {
        throw new ApiError(500, 'CLIENT_CONFIG_INVALID', 'Konfigurasi client tidak valid.');
    }

    return array_merge($defaults, $overrides, ['outlet_id' => $outletId]);
}

function safe_ident(string $name): string
{
    if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name)) {
        throw new ApiError(500, 'INVALID_IDENTIFIER', 'Identifier database tidak valid.');
    }

    return '[' . $name . ']';
}

function normalize_phone(string $input): string
{
    $phone = preg_replace('/[^\d+]/', '', $input) ?: '';
    if (str_starts_with($phone, '+')) {
        $phone = substr($phone, 1);
    }
    if (str_starts_with($phone, '0')) {
        $phone = '62' . substr($phone, 1);
    }
    if (str_starts_with($phone, '8')) {
        $phone = '62' . $phone;
    }

    return $phone;
}

function valid_phone(string $phone): bool
{
    return preg_match('/^62\d{8,13}$/', normalize_phone($phone)) === 1;
}

function wa_phone(string $phone): string
{
    return preg_replace('/[^\d]/', '', normalize_phone($phone)) ?: '';
}

function connect_db(array $db): PDO
{
    $server = trim((string)($db['server'] ?? ''));
    $database = trim((string)($db['database'] ?? ''));
    $username = (string)($db['username'] ?? '');
    $password = (string)($db['password'] ?? '');
    $instance = trim((string)($db['instance'] ?? ''));
    $port = $db['port'] ?? null;

    if ($server === '' || $database === '' || $username === '') {
        throw new ApiError(500, 'DB_CONFIG_INVALID', 'Konfigurasi koneksi database belum lengkap.');
    }

    if (extension_loaded('pdo_sqlsrv')) {
        $target = $server;
        if ($port !== null && $port !== '') {
            $target .= ',' . (int)$port;
        } elseif ($instance !== '') {
            $target .= '\\' . $instance;
        }

        $dsn = "sqlsrv:Server={$target};Database={$database};Encrypt=no;TrustServerCertificate=yes";
    } else {
        $target = $server;
        if ($port !== null && $port !== '') {
            $target .= ',' . (int)$port;
        } elseif ($instance !== '') {
            $target .= '\\' . $instance;
        }

        $dsn = "odbc:Driver={SQL Server};Server={$target};Database={$database}";
    }

    return new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function registry_pdo(array $config): PDO
{
    return connect_db($config['registry'] ?? []);
}

function find_outlet(PDO $pdo, string $code): ?array
{
    $stmt = $pdo->prepare(
        "SELECT TOP 1 outletID, outletName, outletcode, phone
         FROM dbo.master_koneksi
         WHERE codeVerifikasi = :code
         ORDER BY CASE WHEN ISNULL(isPusat, 0) = 0 THEN 0 ELSE 1 END, outletName"
    );
    $stmt->execute([
        ':code' => $code,
    ]);

    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }

    return [
        'outletId' => trim((string)$row['outletID']),
        'name' => trim((string)$row['outletName']),
        'code' => trim((string)$row['outletcode']),
        'phone' => wa_phone((string)$row['phone']),
    ];
}

function central_pdo(PDO $registry, array $client): PDO
{
    $stmt = $registry->prepare(
        "SELECT TOP 1 serverName, serverPort, serverSql, username, daintyPass
         FROM dbo.master_koneksi
         WHERE outletID = :outletId AND ISNULL(isPusat, 0) = 1"
    );
    $stmt->execute([':outletId' => $client['outlet_id']]);
    $row = $stmt->fetch();

    if (!$row) {
        throw new ApiError(500, 'CENTRAL_NOT_FOUND', 'Koneksi pusat client tidak ditemukan.');
    }

    return connect_db([
        'server' => trim((string)$row['serverName']),
        'port' => trim((string)$row['serverPort']) !== '' ? (int)$row['serverPort'] : null,
        'instance' => trim((string)$row['serverSql']),
        'database' => $client['central_crm_database'],
        'username' => trim((string)$row['username']),
        'password' => (string)$row['daintyPass'],
    ]);
}

function random_code(): string
{
    return str_pad((string)random_int(0, 9999), 4, '0', STR_PAD_LEFT);
}

function handle_health(): void
{
    json_response([
        'ok' => true,
        'service' => 'api-verifikasi',
        'drivers' => [
            'pdo_sqlsrv' => extension_loaded('pdo_sqlsrv'),
            'pdo_odbc' => extension_loaded('pdo_odbc'),
        ],
    ]);
}

function handle_outlet(array $config): void
{
    require_api_key($config);

    $code = trim((string)($_GET['code'] ?? ''));
    if ($code === '') {
        throw new ApiError(400, 'INVALID', 'Kode outlet wajib diisi.');
    }

    $outlet = find_outlet(registry_pdo($config), $code);

    if (!$outlet) {
        throw new ApiError(404, 'OUTLET_NOT_FOUND', 'Outlet tidak ditemukan.');
    }

    json_response(['ok' => true, 'outlet' => $outlet]);
}

function handle_generate(array $config): void
{
    require_api_key($config);

    $body = input_json();
    $outletCode = trim((string)($body['outletCode'] ?? ''));
    $rawPhone = (string)($body['phone'] ?? '');

    if ($outletCode === '' || trim($rawPhone) === '' || !valid_phone($rawPhone)) {
        throw new ApiError(400, 'INVALID', 'Kode outlet dan nomor HP wajib valid.');
    }

    $registry = registry_pdo($config);
    $outlet = find_outlet($registry, $outletCode);
    if (!$outlet) {
        throw new ApiError(404, 'OUTLET_NOT_FOUND', 'Outlet tidak ditemukan.');
    }
    // Sementara semua pesan verifikasi diarahkan ke nomor pusat/test.
    // Balikkan blok ini kalau nomor WhatsApp outlet sudah dipakai lagi.
    // if ($outlet['phone'] === '') {
    //     throw new ApiError(422, 'OUTLET_PHONE_EMPTY', 'Nomor WhatsApp outlet belum diatur.');
    // }

    $client = client_config($config, $outlet['outletId']);

    $phone = normalize_phone($rawPhone);
    $localPhone = str_starts_with($phone, '62') ? '0' . substr($phone, 2) : $phone;
    $rawDigits = preg_replace('/[^\d]/', '', $rawPhone) ?: '';
    $central = central_pdo($registry, $client);

    $customerTable = safe_ident($client['customer_table'] ?? 't5_Customer');
    $customerPhoneCol = safe_ident($client['customer_phone_column'] ?? 'MobilePhone');
    $verificationTable = safe_ident($client['verification_table'] ?? 't5_Customer_verification_codes');
    $verificationPhoneCol = safe_ident($client['verification_phone_column'] ?? 'MobilePhone');
    $ttl = (int)($client['otp_ttl_minutes'] ?? 10);
    $cooldownDays = (int)($client['same_phone_code_cooldown_days'] ?? 60);

    $stmt = $central->prepare(
        "SELECT TOP 1 Code, FirstName, {$customerPhoneCol} AS MobilePhone
         FROM dbo.{$customerTable}
         WHERE REPLACE(REPLACE(REPLACE(REPLACE({$customerPhoneCol}, ' ', ''), '-', ''), '+', ''), '.', '')
           IN (:phone, :localPhone, :rawPhone)
         ORDER BY Code"
    );
    $stmt->execute([
        ':phone' => $phone,
        ':localPhone' => $localPhone,
        ':rawPhone' => $rawDigits,
    ]);
    $customer = $stmt->fetch();

    if (!$customer) {
        throw new ApiError(404, 'NOT_FOUND', 'Nomor HP tidak terdaftar.');
    }

    $otpPhone = trim((string)($customer['MobilePhone'] ?? '')) ?: $localPhone;
    $otpPhoneNormalized = normalize_phone($otpPhone);
    $phoneCandidates = array_values(array_unique(array_filter([
        $otpPhone,
        $otpPhoneNormalized,
        $phone,
        $localPhone,
        $rawDigits,
    ])));
    while (count($phoneCandidates) < 5) {
        $phoneCandidates[] = $otpPhone;
    }

    $central->exec("UPDATE dbo.{$verificationTable} SET used = 1 WHERE used = 0 AND expires_at < GETDATE()");

    $generated = null;
    for ($attempt = 0; $attempt < 100; $attempt++) {
        $candidate = random_code();

        try {
            $central->beginTransaction();

            $stmt = $central->prepare(
                "DECLARE @lockResult INT;
                 DECLARE @resource nvarchar(255);
                 SET @resource = CAST(? AS nvarchar(255));
                 EXEC @lockResult = sp_getapplock
                   @Resource = @resource,
                   @LockMode = 'Exclusive',
                   @LockOwner = 'Transaction',
                   @LockTimeout = 10000;
                 IF @lockResult < 0
                 BEGIN
                   RAISERROR('Gagal mengunci proses generate OTP.', 16, 1);
                 END"
            );
            $stmt->execute([$otpPhoneNormalized]);

            $stmt = $central->prepare(
                "UPDATE dbo.{$verificationTable}
                 SET used = 1
                 WHERE {$verificationPhoneCol} IN (
                   CAST(? AS nvarchar(40)),
                   CAST(? AS nvarchar(40)),
                   CAST(? AS nvarchar(40)),
                   CAST(? AS nvarchar(40)),
                   CAST(? AS nvarchar(40))
                 )
                   AND used = 0"
            );
            $stmt->execute($phoneCandidates);

            $stmt = $central->prepare(
                "SELECT TOP 1 1 AS found
                 FROM dbo.{$verificationTable}
                 WHERE {$verificationPhoneCol} IN (
                   CAST(? AS nvarchar(40)),
                   CAST(? AS nvarchar(40)),
                   CAST(? AS nvarchar(40)),
                   CAST(? AS nvarchar(40)),
                   CAST(? AS nvarchar(40))
                 )
                   AND code = CAST(? AS char(4))
                   AND created_at >= DATEADD(DAY, -{$cooldownDays}, GETDATE())"
            );
            $stmt->execute([...$phoneCandidates, $candidate]);
            if ($stmt->fetch()) {
                $central->rollBack();
                continue;
            }

            $stmt = $central->prepare(
                "INSERT INTO dbo.{$verificationTable} ({$verificationPhoneCol}, code, expires_at)
                 VALUES (CAST(? AS nvarchar(40)), CAST(? AS char(4)), DATEADD(MINUTE, {$ttl}, GETDATE()))"
            );
            $stmt->execute([
                $otpPhone,
                $candidate,
            ]);

            $central->commit();
            $generated = $candidate;
            break;
        } catch (Throwable $err) {
            if ($central->inTransaction()) {
                $central->rollBack();
            }

            if (str_contains($err->getMessage(), 'UX_verification_active_code')) {
                continue;
            }

            throw $err;
        }
    }

    if ($generated === null) {
        throw new ApiError(503, 'EXHAUSTED', 'Sistem sedang sibuk, silakan coba lagi sebentar.');
    }

    $customerName = trim((string)($customer['FirstName'] ?? '')) ?: 'Customer';
    // Sementara pakai satu nomor tujuan untuk semua outlet.
    // Nanti kalau POS sudah siap, balikin ke logic outlet/test customer di bawah.
    $targetWa = wa_phone(TEMP_WHATSAPP_PHONE);
    // $targetWa = $phone === normalize_phone((string)($client['test_customer_phone'] ?? ''))
    //     ? wa_phone((string)($client['test_whatsapp_phone'] ?? $outlet['phone']))
    //     : $outlet['phone'];
    $message = "Halo {$outlet['name']}, saya ingin klaim promo diskon member.\n\n"
        . "Nama: {$customerName}\n"
        . "Nomor HP: {$otpPhone}\n"
        . "Kode OTP: {$generated}\n"
        . "Outlet: {$outlet['name']}\n\n"
        . "Supported by DaintyPOS (daintypos.com)";

    json_response([
        'ok' => true,
        'verificationCode' => $generated,
        'expiresInMinutes' => $ttl,
        'phone' => $otpPhone,
        'customer' => [
            'code' => trim((string)($customer['Code'] ?? '')),
            'name' => $customerName,
            'mobilePhone' => $otpPhone,
        ],
        'outlet' => [
            'outletId' => $outlet['outletId'],
            'name' => $outlet['name'],
            'code' => $outlet['code'],
            'phone' => $targetWa,
        ],
        'whatsappUrl' => 'https://wa.me/' . $targetWa . '?text=' . rawurlencode($message),
    ]);
}

try {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $path = rtrim($path, '/') ?: '/';

    if ($path === '/health') {
        handle_health();
    }

    $config = load_config();

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $path === '/outlet') {
        handle_outlet($config);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $path === '/otp/generate') {
        handle_generate($config);
    }

    throw new ApiError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan.');
} catch (ApiError $err) {
    json_response([
        'ok' => false,
        'code' => $err->apiCode,
        'message' => $err->getMessage(),
    ], $err->status);
} catch (Throwable $err) {
    json_response([
        'ok' => false,
        'code' => 'SERVER_ERROR',
        'message' => 'Server API sedang bermasalah.',
        'details' => $err->getMessage(),
    ], 500);
}
