-- ============================================================
--  SETUP DATABASE UNTUK WEBSITE VERIFIKASI NOMOR HP
--  Kompatibel dengan SQL Server 2012 ke atas
--
--  Jalankan script ini di database Anda menggunakan
--  SQL Server Management Studio (SSMS) atau sqlcmd.
-- ============================================================

-- 1. Tabel t5_Customer
--    Berisi data customer Anda. Pastikan kolom 'MobilePhone' sudah dinormalisasi
--    ke format 62XXXXXXXXXX (Indonesia) tanpa spasi/karakter lain.
--    CATATAN: Asumsikan tabel sudah ada. Script ini hanya membuat index jika belum ada.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_t5_Customer_MobilePhone')
BEGIN
    CREATE UNIQUE INDEX UX_t5_Customer_MobilePhone ON t5_Customer(MobilePhone);
    PRINT 'Index UX_t5_Customer_MobilePhone berhasil dibuat.';
END
ELSE
BEGIN
    PRINT 'Index UX_t5_Customer_MobilePhone sudah ada.';
END
GO

-- 2. Tabel t5_Customer_verification_codes
--    Menyimpan kode 4 digit yang di-generate. Dilengkapi UNIQUE FILTERED INDEX
--    pada kolom 'code' (hanya untuk record dengan used = 0) sehingga
--    tidak mungkin ada dua kode aktif yang sama meskipun di-generate
--    secara bersamaan oleh banyak request (concurrency safe).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 't5_Customer_verification_codes')
BEGIN
    CREATE TABLE t5_Customer_verification_codes (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        MobilePhone NVARCHAR(20)  NOT NULL,
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
        ON t5_Customer_verification_codes(code)
        WHERE used = 0;

    CREATE INDEX IX_verification_phone     ON t5_Customer_verification_codes(MobilePhone);
    CREATE INDEX IX_verification_expires   ON t5_Customer_verification_codes(expires_at);
    
    PRINT 'Tabel t5_Customer_verification_codes berhasil dibuat.';
END
ELSE
BEGIN
    PRINT 'Tabel t5_Customer_verification_codes sudah ada.';
END
GO

PRINT 'Setup database selesai.';
GO

