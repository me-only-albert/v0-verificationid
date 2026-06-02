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

const ROOT_SERVER = process.env.ROOT_SQL_SERVER_HOST || process.env.SQL_SERVER_HOST || "202.83.120.48"
const ROOT_INSTANCE = process.env.ROOT_SQL_SERVER_INSTANCE || process.env.SQL_SERVER_INSTANCE || "sqlexpress"
const ROOT_PORT = process.env.ROOT_SQL_SERVER_PORT || process.env.SQL_SERVER_PORT || ""
const ROOT_USER = process.env.ROOT_SQL_SERVER_USER || process.env.SQL_SERVER_USER || ""
const ROOT_PASSWORD = process.env.ROOT_SQL_SERVER_PASSWORD || process.env.SQL_SERVER_PASSWORD || ""
const ROOT_DATABASE = process.env.ROOT_SQL_SERVER_DATABASE || "DB_DAINTY_REPORTS"
const OUTLET_ID = process.env.OUTLET_ID || "mox"
const CENTRAL_CRM_DATABASE = process.env.CENTRAL_CRM_DATABASE || "DB_DAINTY_CRM"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

function rootConnectionOptions(): DbConnectionOptions {
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
    .query(
      `SELECT TOP 1 outletID, outletName, outletcode, phone
       FROM dbo.master_koneksi
       WHERE outletID = @outletId
         AND ISNULL(isPusat, 0) = 0
         AND (
           outletcode = @code
           OR codeEnkrip = @code
           OR outletName = @code
         )
       ORDER BY
         CASE WHEN codeEnkrip = @code THEN 0 WHEN outletcode = @code THEN 1 ELSE 2 END,
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
    encrypt: false,
    trustServerCertificate: true,
  }
}
