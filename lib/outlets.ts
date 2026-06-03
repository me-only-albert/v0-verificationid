import { getPool, sql, type DbConnectionOptions } from "@/lib/db-tedious"
import { normalizePhone } from "@/lib/phone"

export interface OutletInfo {
  outletId: string
  outletName: string
  outletCode: string
  phone: string
}

interface MasterKoneksiRow {
  outletID?: unknown
  outletName?: unknown
  outletcode?: unknown
  phone?: unknown
  serverName?: unknown
  serverPort?: unknown
  serverSql?: unknown
  username?: unknown
  daintyPass?: unknown
}

const ROOT_SERVER = process.env.ROOT_SQL_SERVER_HOST || "202.83.120.48"
const ROOT_INSTANCE = process.env.ROOT_SQL_SERVER_INSTANCE || ""
const ROOT_PORT = process.env.ROOT_SQL_SERVER_PORT || "1433"
const ROOT_USER = process.env.ROOT_SQL_SERVER_USER || ""
const ROOT_PASSWORD = process.env.ROOT_SQL_SERVER_PASSWORD || ""
const ROOT_DATABASE = process.env.ROOT_SQL_SERVER_DATABASE || "DB_DAINTY_REPORTS"
const OUTLET_ID = process.env.OUTLET_ID || "mox"
const CENTRAL_CRM_DATABASE = process.env.CENTRAL_CRM_DATABASE || "DB_DAINTY_CRM"
const ALLOW_OUTLET_CODE_LOOKUP = process.env.ALLOW_OUTLET_CODE_LOOKUP === "true"
const VERIFICATION_API_BASE_URL = process.env.VERIFICATION_API_BASE_URL || ""
const VERIFICATION_API_KEY = process.env.VERIFICATION_API_KEY || ""
const VERIFICATION_API_CLIENT = process.env.VERIFICATION_API_CLIENT || OUTLET_ID

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

function rootConnectionOptions(): DbConnectionOptions {
  if (!ROOT_USER || !ROOT_PASSWORD) {
    throw new Error("ROOT_SQL_SERVER_USER dan ROOT_SQL_SERVER_PASSWORD wajib diisi untuk membaca master_koneksi.")
  }

  return {
    server: ROOT_SERVER,
    user: ROOT_USER,
    password: ROOT_PASSWORD,
    database: ROOT_DATABASE,
    instanceName: ROOT_INSTANCE,
    port: ROOT_PORT ? Number(ROOT_PORT) : undefined,
    encrypt: false,
    trustServerCertificate: true,
  }
}

export function formatPhoneForWa(phone: string) {
  return normalizePhone(phone).replace(/[^\d]/g, "")
}

export async function getOutletByCode(code: string): Promise<OutletInfo | null> {
  const outletCode = code.trim()
  if (!outletCode) return null

  if (VERIFICATION_API_BASE_URL) {
    if (!VERIFICATION_API_KEY) {
      throw new Error("VERIFICATION_API_KEY wajib diisi jika memakai VERIFICATION_API_BASE_URL.")
    }

    const url = new URL("/outlet", VERIFICATION_API_BASE_URL)
    url.searchParams.set("client", VERIFICATION_API_CLIENT)
    url.searchParams.set("code", outletCode)

    const response = await fetch(url, {
      headers: {
        "X-API-Key": VERIFICATION_API_KEY,
      },
      cache: "no-store",
    })

    if (response.status === 404) return null
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.ok) {
      throw new Error(data?.message || "Gagal mengambil data outlet dari API verifikasi.")
    }

    return {
      outletId: VERIFICATION_API_CLIENT,
      outletName: String(data.outlet.name || ""),
      outletCode: String(data.outlet.code || ""),
      phone: formatPhoneForWa(String(data.outlet.phone || "")),
    }
  }

  const pool = await getPool(rootConnectionOptions())
  const result = await pool
    .request()
    .input("outletId", sql.NVarChar(50), OUTLET_ID)
    .input("code", sql.NVarChar(255), outletCode)
    .input("allowOutletCode", sql.Bit(), ALLOW_OUTLET_CODE_LOOKUP)
    .query(
      `SELECT TOP 1 outletID, outletName, outletcode, phone
       FROM dbo.master_koneksi
       WHERE outletID = @outletId
         AND ISNULL(isPusat, 0) = 0
         AND (
           codeVerifikasi = @code
           OR codeEnkrip = @code
           OR (@allowOutletCode = 1 AND outletcode = @code)
         )
       ORDER BY
         CASE WHEN codeVerifikasi = @code THEN 0 WHEN codeEnkrip = @code THEN 1 ELSE 2 END,
         outletName`,
    )

  const row = result.recordset[0] as MasterKoneksiRow | undefined
  if (!row) return null

  return {
    outletId: asString(row.outletID),
    outletName: asString(row.outletName),
    outletCode: asString(row.outletcode),
    phone: formatPhoneForWa(asString(row.phone)),
  }
}

export async function getCentralCrmConnectionOptions(): Promise<DbConnectionOptions> {
  const pool = await getPool(rootConnectionOptions())
  const result = await pool
    .request()
    .input("outletId", sql.NVarChar(50), OUTLET_ID)
    .query(
      `SELECT TOP 1 serverName, serverPort, serverSql, username, daintyPass
       FROM dbo.master_koneksi
       WHERE outletID = @outletId AND ISNULL(isPusat, 0) = 1`,
    )

  const row = result.recordset[0] as MasterKoneksiRow | undefined
  if (!row) {
    throw new Error(`Koneksi pusat untuk outletID ${OUTLET_ID} tidak ditemukan.`)
  }

  const port = Number(asString(row.serverPort))

  return {
    server: asString(row.serverName),
    user: asString(row.username),
    password: asString(row.daintyPass),
    database: CENTRAL_CRM_DATABASE,
    instanceName: asString(row.serverSql),
    port: Number.isFinite(port) ? port : undefined,
    preferPort: Number.isFinite(port),
    encrypt: false,
    trustServerCertificate: true,
  }
}
