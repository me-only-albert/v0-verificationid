-- ============================================================
--  SETUP DATABASE UNTUK WEBSITE VERIFIKASI NOMOR HP
--  Kompatibel dengan SQL Server 2012 ke atas
--
--  Jalankan script ini di database Anda menggunakan
--  SQL Server Management Studio (SSMS) atau sqlcmd.
-- ============================================================

-- 1. Tabel customers
--    Berisi data customer Anda. Pastikan kolom 'phone' sudah dinormalisasi
--    ke format 62XXXXXXXXXX (Indonesia) tanpa spasi/karakter lain.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'customers')
BEGIN
    CREATE TABLE customers (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        phone       NVARCHAR(20)  NOT NULL,
        name        NVARCHAR(100) NULL,
        created_at  DATETIME      NOT NULL DEFAULT GETDATE()
    );

    CREATE UNIQUE INDEX UX_customers_phone ON customers(phone);
END
GO

-- 2. Tabel verification_codes
--    Menyimpan kode 4 digit yang di-generate. Dilengkapi UNIQUE FILTERED INDEX
--    pada kolom 'code' (hanya untuk record dengan used = 0) sehingga
--    tidak mungkin ada dua kode aktif yang sama meskipun di-generate
--    secara bersamaan oleh banyak request (concurrency safe).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'verification_codes')
BEGIN
    CREATE TABLE verification_codes (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        phone       NVARCHAR(20)  NOT NULL,
        code        CHAR(4)       NOT NULL,
        created_at  DATETIME      NOT NULL DEFAULT GETDATE(),
        expires_at  DATETIME      NOT NULL,
        used        BIT           NOT NULL DEFAULT 0
    );

    -- UNIQUE FILTERED INDEX: hanya kode aktif (used = 0) yang harus unik.
    -- Ini KUNCI dari concurrency safety: dua INSERT bersamaan dengan code
    -- yang sama akan ditolak oleh database (error 2601/2627), lalu kode kita
    -- akan di-retry dengan random baru di sisi aplikasi.
    CREATE UNIQUE INDEX UX_verification_active_code
        ON verification_codes(code)
        WHERE used = 0;

    CREATE INDEX IX_verification_phone     ON verification_codes(phone);
    CREATE INDEX IX_verification_expires   ON verification_codes(expires_at);
END
GO

-- 3. (Opsional) Contoh data customer untuk testing.
--    Hapus / ganti dengan data customer Anda yang sebenarnya.
IF NOT EXISTS (SELECT 1 FROM customers WHERE phone = '628123456789')
BEGIN
    INSERT INTO customers (phone, name) VALUES
        ('628123456789', 'Customer Demo 1'),
        ('628987654321', 'Customer Demo 2');
END
GO

PRINT 'Setup database selesai.';
GO
