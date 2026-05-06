import { NextResponse } from "next/server"
import { getPool, sql } from "@/lib/db-tedious"
import { isValidPhone, normalizePhone } from "@/lib/phone"
import { DayButton } from "react-day-picker"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Konfigurasi nama tabel/kolom (bisa di-override via env)
const CUSTOMER_TABLE = process.env.CUSTOMER_TABLE || "dbo.t5_Customer"
const CUSTOMER_PHONE_COLUMN = process.env.CUSTOMER_PHONE_COLUMN || "MobilePhone"
const VERIFICATION_TABLE = process.env.VERIFICATION_TABLE || "t5_Customer_verification_codes"
const VERIFICATION_PHONE_COLUMN = process.env.VERIFICATION_PHONE_COLUMN || "MobilePhone"

const CODE_TTL_MINUTES = 10
const MAX_GENERATE_ATTEMPTS = 100

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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawPhone = typeof body?.phone === "string" ? body.phone : ""

    if (!rawPhone.trim()) {
      return NextResponse.json({ ok: false, code: "INVALID", message: "Nomor HP wajib diisi." }, { status: 400 })
    }

    if (!isValidPhone(rawPhone)) {
      return NextResponse.json(
        { ok: false, code: "INVALID", message: "Format nomor HP tidak valid." },
        { status: 400 },
      )
    }

    const phone = normalizePhone(rawPhone)

    console.log("[v0] Attempting to verify phone:", phone)

    let pool
    try {
      pool = await getPool()
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
        .query(`SELECT TOP 1 1 AS found FROM ${customerTable} WHERE ${phoneCol} = @phone`)
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
      await pool.request().query(`UPDATE ${verifTable} SET used = 1 WHERE used = 0 AND expires_at < GETDATE()`)
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
          .input("ttl", sql.Int, CODE_TTL_MINUTES)
          .query(
            `INSERT INTO ${verifTable} (${safeIdent(VERIFICATION_PHONE_COLUMN)}, code, expires_at)
             VALUES (@phone, @code, DATEADD(MINUTE, @ttl, GETDATE()))`,
          )
        generatedCode = candidate
        console.log("[v0] Code generated successfully on attempt", attempt + 1, "code:", candidate)
        break
      } catch (err: unknown) {
        const number = (err as { number?: number })?.number
        if (number && ERR_UNIQUE_VIOLATION.has(number)) {
          // Bentrok dengan kode aktif lain → coba random lain.
          lastError = err
          console.log("[v0] Unique violation on attempt", attempt + 1, ", retrying...")
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
    return NextResponse.json({
      ok: true,
      code: "OK",
      verificationCode: generatedCode,
      expiresInMinutes: CODE_TTL_MINUTES,
      phone,
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

