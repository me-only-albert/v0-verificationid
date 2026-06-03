import { NextResponse } from "next/server"
import { getPool, sql } from "@/lib/db-tedious"
import { formatPhoneForWa, getCentralCrmConnectionOptions, getOutletByCode } from "@/lib/outlets"
import { isValidPhone, normalizePhone } from "@/lib/phone"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Konfigurasi nama tabel/kolom (bisa di-override via env)
const CUSTOMER_TABLE = process.env.CUSTOMER_TABLE || "t5_Customer"
const CUSTOMER_PHONE_COLUMN = process.env.CUSTOMER_PHONE_COLUMN || "MobilePhone"
const VERIFICATION_TABLE = process.env.VERIFICATION_TABLE || "t5_Customer_verification_codes"
const VERIFICATION_PHONE_COLUMN = process.env.VERIFICATION_PHONE_COLUMN || "MobilePhone"

const CODE_TTL_MINUTES = 10
const MAX_GENERATE_ATTEMPTS = 100
const SAME_PHONE_CODE_COOLDOWN_DAYS = 60
const TEST_CUSTOMER_PHONE = normalizePhone(process.env.TEST_CUSTOMER_PHONE || "085789850597")
const TEST_WHATSAPP_PHONE = normalizePhone(process.env.TEST_WHATSAPP_PHONE || "087786577529")
const VERIFICATION_API_BASE_URL = process.env.VERIFICATION_API_BASE_URL || ""
const VERIFICATION_API_KEY = process.env.VERIFICATION_API_KEY || ""
const REQUIRE_VERIFICATION_API = process.env.REQUIRE_VERIFICATION_API === "true" || process.env.VERCEL === "1"

// SQL Server unique-key violation error numbers
const ERR_UNIQUE_VIOLATION = new Set([2601, 2627])

function safeIdent(name: string) {
  // Whitelist: hanya boleh huruf/angka/underscore. Mencegah SQL injection lewat env var.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Identifier tidak valid: ${name}`)
  }
  return `[${name}]`
}

function random4Digit(): string {
  return Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawPhone = typeof body?.phone === "string" ? body.phone : ""
    const outletCode = typeof body?.outletCode === "string" ? body.outletCode.trim() : ""

    if (REQUIRE_VERIFICATION_API && !VERIFICATION_API_BASE_URL) {
      return NextResponse.json(
        {
          ok: false,
          code: "API_CONFIG_ERROR",
          message: "VERIFICATION_API_BASE_URL wajib diisi di Vercel.",
        },
        { status: 500 },
      )
    }

    if (VERIFICATION_API_BASE_URL) {
      if (!VERIFICATION_API_KEY) {
        return NextResponse.json(
          { ok: false, code: "API_CONFIG_ERROR", message: "VERIFICATION_API_KEY belum diatur." },
          { status: 500 },
        )
      }

      const response = await fetch(new URL("/otp/generate", VERIFICATION_API_BASE_URL), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": VERIFICATION_API_KEY,
        },
        body: JSON.stringify({
          outletCode,
          phone: rawPhone,
        }),
        cache: "no-store",
      })

      const data = await response.json().catch(() => ({
        ok: false,
        code: "API_RESPONSE_ERROR",
        message: "Response API verifikasi tidak valid.",
      }))

      return NextResponse.json(data, { status: response.status })
    }

    if (!rawPhone.trim()) {
      return NextResponse.json({ ok: false, code: "INVALID", message: "Nomor HP wajib diisi." }, { status: 400 })
    }

    if (!outletCode) {
      return NextResponse.json({ ok: false, code: "INVALID", message: "Kode outlet wajib diisi." }, { status: 400 })
    }

    if (!isValidPhone(rawPhone)) {
      return NextResponse.json(
        { ok: false, code: "INVALID", message: "Format nomor HP tidak valid." },
        { status: 400 },
      )
    }

    const phone = normalizePhone(rawPhone)
    const localPhone = phone.startsWith("62") ? `0${phone.slice(2)}` : phone
    const rawDigits = rawPhone.replace(/[^\d]/g, "")

    console.log("[v0] Attempting to verify phone:", phone, "outlet:", outletCode)

    const outlet = await getOutletByCode(outletCode)
    if (!outlet) {
      return NextResponse.json(
        {
          ok: false,
          code: "OUTLET_NOT_FOUND",
          message: "Outlet tidak ditemukan.",
        },
        { status: 404 },
      )
    }

    if (!outlet.phone) {
      return NextResponse.json(
        {
          ok: false,
          code: "OUTLET_PHONE_EMPTY",
          message: "Nomor WhatsApp outlet belum diatur.",
        },
        { status: 422 },
      )
    }

    let pool
    try {
      const centralCrm = await getCentralCrmConnectionOptions()
      pool = await getPool(centralCrm)
      console.log("[v0] Database pool connected")
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.log("[v0] Database connection failed:", errMsg)
      return NextResponse.json(
        {
          ok: false,
          code: "DB_CONNECTION_ERROR",
          message: "Gagal terhubung ke database. Pastikan konfigurasi SQL Server sudah benar.",
          details: errMsg,
        },
        { status: 503 },
      )
    }

    // 1. Cek apakah nomor terdaftar di tabel customers
    const customerTable = safeIdent(CUSTOMER_TABLE)
    const phoneCol = safeIdent(CUSTOMER_PHONE_COLUMN)
    const verifTable = safeIdent(VERIFICATION_TABLE)

    console.log("[v0] Checking customer existence in table:", CUSTOMER_TABLE, "with column:", CUSTOMER_PHONE_COLUMN)

    let customerResult
    try {
      customerResult = await pool
        .request()
        .input("phone", sql.NVarChar(20), phone)
        .input("localPhone", sql.NVarChar(20), localPhone)
        .input("rawPhone", sql.NVarChar(20), rawDigits)
        .query(
          `SELECT TOP 1 Code, FirstName, ${phoneCol} AS MobilePhone
           FROM dbo.${customerTable}
           WHERE REPLACE(REPLACE(REPLACE(REPLACE(${phoneCol}, ' ', ''), '-', ''), '+', ''), '.', '')
             IN (@phone, @localPhone, @rawPhone)
           ORDER BY Code`,
        )
      console.log("[v0] Customer check completed, found:", customerResult.recordset.length > 0)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.log("[v0] Customer lookup query error:", errMsg)
      return NextResponse.json(
        {
          ok: false,
          code: "DB_QUERY_ERROR",
          message: "Gagal mengakses database customer. Periksa nama tabel dan kolom.",
          details: errMsg,
        },
        { status: 503 },
      )
    }

    const customer = customerResult.recordset[0]
    const customerName = asString(customer.FirstName) || "Customer"
    const customerCode = asString(customer.Code)
    const customerMobilePhone = asString(customer.MobilePhone) || localPhone

    if (customerResult.recordset.length === 0) {
      console.log("[v0] Phone not found in database:", phone)
      return NextResponse.json(
        {
          ok: false,
          code: "NOT_FOUND",
          message: "Nomor HP tidak terdaftar.",
        },
        { status: 404 },
      )
    }

    // 2. Cleanup: tandai kode yang sudah expired sebagai used,
    //    sehingga "slot" kodenya bisa dipakai ulang.
    try {
      await pool.request().query(`UPDATE dbo.${verifTable} SET used = 1 WHERE used = 0 AND expires_at < GETDATE()`)
      console.log("[v0] Expired codes cleaned up")
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.log("[v0] Cleanup query error (non-fatal):", errMsg)
      // Cleanup error bukan fatal, lanjut aja
    }

    // 3. Generate kode 4 digit yang unik (anti-collision saat concurrent).
    //    Strategi: random + INSERT, kalau bentrok dengan UNIQUE FILTERED INDEX
    //    (used = 0), retry dengan random baru. Karena unik dijamin oleh database,
    //    tidak mungkin ada dua kode aktif yang sama walau request bersamaan.
    let generatedCode: string | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
      const candidate = random4Digit()
      try {
        await pool
          .request()
          .input("phone", sql.NVarChar(20), phone)
          .input("code", sql.Char(4), candidate)
          .input("ttl", sql.Int(), CODE_TTL_MINUTES)
          .input("cooldownDays", sql.Int(), SAME_PHONE_CODE_COOLDOWN_DAYS)
          .query(
            `BEGIN TRY
               BEGIN TRANSACTION;

               DECLARE @lockResult INT;
               EXEC @lockResult = sp_getapplock
                 @Resource = @phone,
                 @LockMode = 'Exclusive',
                 @LockOwner = 'Transaction',
                 @LockTimeout = 10000;

               IF @lockResult < 0
               BEGIN
                 THROW 50001, 'Gagal mengunci proses generate OTP untuk nomor ini.', 1;
               END

               UPDATE dbo.${verifTable}
               SET used = 1
               WHERE ${safeIdent(VERIFICATION_PHONE_COLUMN)} = @phone
                 AND used = 0;

               IF EXISTS (
                 SELECT 1
                 FROM dbo.${verifTable}
                 WHERE ${safeIdent(VERIFICATION_PHONE_COLUMN)} = @phone
                   AND code = @code
                   AND created_at >= DATEADD(DAY, -@cooldownDays, GETDATE())
               )
               BEGIN
                 THROW 50002, 'Kode OTP pernah dipakai nomor ini dalam periode cooldown.', 1;
               END

               INSERT INTO dbo.${verifTable} (${safeIdent(VERIFICATION_PHONE_COLUMN)}, code, expires_at)
               VALUES (@phone, @code, DATEADD(MINUTE, @ttl, GETDATE()));

               COMMIT TRANSACTION;
             END TRY
             BEGIN CATCH
               IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
               THROW;
             END CATCH`,
          )
        generatedCode = candidate
        console.log("[v0] Code generated successfully on attempt", attempt + 1, "code:", candidate)
        break
      } catch (err: unknown) {
        const number = (err as { number?: number })?.number
        if (number && (ERR_UNIQUE_VIOLATION.has(number) || number === 50002)) {
          // Bentrok dengan kode aktif lain → coba random lain.
          lastError = err
          console.log("[v0] OTP code collision on attempt", attempt + 1, ", retrying...")
          continue
        }
        // Non-unique error
        const errMsg = err instanceof Error ? err.message : String(err)
        console.log("[v0] Code generation INSERT error:", errMsg)
        throw err
      }
    }

    if (!generatedCode) {
      const errMsg = lastError instanceof Error ? lastError.message : String(lastError)
      console.log("[v0] Gagal generate kode unik setelah retry maksimal:", errMsg)
      return NextResponse.json(
        {
          ok: false,
          code: "EXHAUSTED",
          message: "Sistem sedang sibuk, silakan coba lagi sebentar.",
          details: "Gagal generate kode unik setelah 100 percobaan.",
        },
        { status: 503 },
      )
    }

    console.log("[v0] /api/verify success for phone:", phone)
    const outletPhone = phone === TEST_CUSTOMER_PHONE ? formatPhoneForWa(TEST_WHATSAPP_PHONE) : formatPhoneForWa(outlet.phone)
    const whatsappMessage = encodeURIComponent(
      `Halo ${outlet.outletName}, saya ingin klaim promo diskon member.\n\nNama: ${customerName}\nNomor HP: ${phone}\nKode OTP: ${generatedCode}\nOutlet: ${outlet.outletName}\n\nSupported by DaintyPOS (daintypos.com)`,
    )

    return NextResponse.json({
      ok: true,
      code: "OK",
      verificationCode: generatedCode,
      expiresInMinutes: CODE_TTL_MINUTES,
      phone,
      customer: {
        code: customerCode,
        name: customerName,
        mobilePhone: customerMobilePhone,
      },
      outlet: {
        name: outlet.outletName,
        code: outlet.outletCode,
        phone: outletPhone,
      },
      whatsappUrl: `https://wa.me/${outletPhone}?text=${whatsappMessage}`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan."
    const stack = err instanceof Error ? err.stack : ""
    console.log("[v0] /api/verify FATAL error:", message)
    console.log("[v0] Stack trace:", stack)
    return NextResponse.json(
      {
        ok: false,
        code: "SERVER_ERROR",
        message: "Server sedang bermasalah. Silakan coba lagi nanti.",
        details: message,
      },
      { status: 500 },
    )
  }
}

