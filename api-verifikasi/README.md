# API Verifikasi

API PHP murni untuk verifikasi promo/member. API ini sebaiknya di-host di server yang bisa mengakses SQL Server, misalnya Windows Server 2022 yang satu jaringan/dekat dengan database.

## Setup

1. Copy `config.example.php` menjadi `config.php`.
2. Isi password dan API key di `config.php`.
3. Pastikan PHP punya salah satu driver:
   - `sqlsrv`, atau
   - `pdo_odbc` dengan ODBC driver SQL Server.
4. Arahkan domain `apiverifikasi.daintypos.com` ke folder `api-verifikasi`.

## Endpoint

```text
GET /health
GET /outlet?code={codeVerifikasi}
POST /otp/generate
```

Header untuk endpoint selain `/health`:

```text
X-API-Key: isi-api-key
```

Body `POST /otp/generate`:

```json
{
  "outletCode": "codeVerifikasi",
  "phone": "085789850597"
}
```

`outletID`/client diambil otomatis dari `master_koneksi` berdasarkan `codeVerifikasi`, lalu API mencari koneksi pusat dari baris `isPusat = 1` untuk `outletID` tersebut.
