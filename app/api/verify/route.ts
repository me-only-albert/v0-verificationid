import { NextResponse } from "next/server"
import { getPool, sql } from "@/lib/db"
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
    const pool = await getPool()

    // 1. Cek apakah nomor terdaftar di tabel customers
    const customerTable = safeIdent(CUSTOMER_TABLE)
    const phoneCol = safeIdent(CUSTOMER_PHONE_COLUMN)
    const verifTable = safeIdent(VERIFICATION_TABLE)

    const customerResult = await pool
      .request()
      .input("phone", sql.NVarChar(20), phone)
      .query(`SELECT TOP 1 1 AS found FROM ${customerTable} WHERE ${phoneCol} = @phone`)

    if (customerResult.recordset.length === 0) {
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
    await pool.request().query(`UPDATE ${verifTable} SET used = 1 WHERE used = 0 AND expires_at < GETDATE()`)

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
        break
      } catch (err: unknown) {
        const number = (err as { number?: number })?.number
        if (number && ERR_UNIQUE_VIOLATION.has(number)) {
          // Bentrok dengan kode aktif lain → coba random lain.
          lastError = err
          continue
        }
        throw err
      }
    }

    if (!generatedCode) {
      console.log("[v0] Gagal generate kode unik setelah retry maksimal:", lastError)
      return NextResponse.json(
        {
          ok: false,
          code: "EXHAUSTED",
          message: "Sistem sedang sibuk, silakan coba lagi sebentar.",
        },
        { status: 503 },
      )
    }

    return NextResponse.json({
      ok: true,
      code: "OK",
      verificationCode: generatedCode,
      expiresInMinutes: CODE_TTL_MINUTES,
      phone,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan."
    console.log("[v0] /api/verify error:", message)
    return NextResponse.json(
      {
        ok: false,
        code: "SERVER_ERROR",
        message: "Server sedang bermasalah. Silakan coba lagi nanti.",
      },
      { status: 500 },
    )
  }
}
