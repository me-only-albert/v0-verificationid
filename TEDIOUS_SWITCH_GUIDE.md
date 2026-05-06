# Panduan Switch dari MSSQL ke Tedious

Jika package `mssql` bermasalah dengan SQL Server 2012 Anda, ikuti langkah di bawah ini untuk switch ke **tedious** (driver native SQL Server dari Microsoft).

## Langkah 1: Edit `/app/api/verify/route.ts`

**Cari baris ini (sekitar baris 15-17):**
```typescript
// import { getPool } from "@/lib/db"
import { getPool } from "@/lib/db"
```

**Ganti dengan:**
```typescript
// import { getPoolTedious as getPool } from "@/lib/db-tedious"
import { getPoolTedious as getPool } from "@/lib/db-tedious"
```

Dengan cara ini, sisanya tidak perlu diubah - API kompatibel.

## Langkah 2: Cek Environment Variables

Pastikan `.env.local` sudah ada dengan konfigurasi lengkap:

```
DB_SERVER=your-server-name
DB_PORT=1433
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=your-database
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=false
```

## Langkah 3: Test

Restart dev server dan coba verifikasi nomor HP. Lihat console log untuk debug jika ada error.

## Catatan

- **Tedious** adalah driver SQL Server asli dari Microsoft, lebih stabil untuk SQL Server 2012
- Kompatibel 100% dengan SQL Server 2012, 2014, 2016, 2017, 2019, dan lebih baru
- Package sudah di-install di `package.json`
- Drop-in replacement, semua logic API tetap sama

## Jika Masih Error

1. Pastikan SQL Server 2012 Anda bisa di-akses dari server Node.js
2. Cek TCP/IP enabled di SQL Server Configuration Manager
3. Pastikan firewall tidak blok port 1433 (atau port custom Anda)
4. Cek kredensial (username/password) benar
5. Lihat console log untuk error message lengkap
