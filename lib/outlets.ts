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

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

function rootConnectionOptions(): DbConnectionOptions {
  // Validate that we have the required credentials
  const hasCredentials = ROOT_USER && ROOT_PASSWORD
  
  if (!hasCredentials) {
    console.error("[db-outlets] Missing database credentials:")
    console.error(`  ROOT_SQL_SERVER_USER: ${ROOT_USER ? "set" : "NOT SET"}`)
    console.error(`  ROOT_SQL_SERVER_PASSWORD: ${ROOT_PASSWORD ? "set" : "NOT SET"}`)
    console.error("[db-outlets] Please add these environment variables in Vercel project settings")
    throw new Error(
      `Database credentials not configured. Please set ROOT_SQL_SERVER_USER and ROOT_SQL_SERVER_PASSWORD environment variables in your Vercel project settings (Settings > Vars).`
    )
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
