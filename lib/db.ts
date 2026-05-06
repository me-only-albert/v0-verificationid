import sql, { type ConnectionPool, type config as SqlConfig } from "mssql"

/**
 * Koneksi SQL Server (mendukung SQL Server 2012 ke atas).
 *
 * Variabel environment yang dibutuhkan (set di file .env atau di Project Settings → Vars):
 *   SQL_SERVER_HOST       -> contoh: 192.168.1.10  atau  db.contoh.com
 *   SQL_SERVER_PORT       -> default 1433
 *   SQL_SERVER_USER       -> user SQL Server (SQL Authentication)
 *   SQL_SERVER_PASSWORD   -> password SQL Server
 *   SQL_SERVER_DATABASE   -> nama database
 *   SQL_SERVER_ENCRYPT    -> "true" / "false" (default "false" untuk SQL Server 2012 on-prem)
 *   SQL_SERVER_TRUST_CERT -> "true" / "false" (default "true" agar self-signed cert diterima)
 *   SQL_SERVER_INSTANCE   -> opsional, nama instance (mis. "SQLEXPRESS")
 *
 * Tabel yang digunakan (bisa di-override lewat env juga):
 *   CUSTOMER_TABLE         -> default: "customers"
 *   CUSTOMER_PHONE_COLUMN  -> default: "phone"
 *   VERIFICATION_TABLE     -> default: "verification_codes"
 */

let pool: ConnectionPool | null = null
let connecting: Promise<ConnectionPool> | null = null

function buildConfig(): SqlConfig {
  const host = process.env.SQL_SERVER_HOST
  const user = process.env.SQL_SERVER_USER
  const password = process.env.SQL_SERVER_PASSWORD
  const database = process.env.SQL_SERVER_DATABASE

  if (!host || !user || !password || !database) {
    throw new Error(
      "Konfigurasi SQL Server belum lengkap. Mohon set SQL_SERVER_HOST, SQL_SERVER_USER, SQL_SERVER_PASSWORD, SQL_SERVER_DATABASE.",
    )
  }

  const port = process.env.SQL_SERVER_PORT ? Number.parseInt(process.env.SQL_SERVER_PORT, 10) : 1433
  const encrypt = process.env.SQL_SERVER_ENCRYPT === "true"
  const trustServerCertificate = process.env.SQL_SERVER_TRUST_CERT !== "false"
  const instanceName = process.env.SQL_SERVER_INSTANCE || undefined

  const config: SqlConfig = {
    server: host,
    port,
    user,
    password,
    database,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt,
      trustServerCertificate,
      // Agar driver tedious kompatibel dengan SQL Server 2012
      // (TDS 7.4 sudah disupport oleh SQL Server 2012)
      tdsVersion: "7_4",
      enableArithAbort: true,
      ...(instanceName ? { instanceName } : {}),
    },
    connectionTimeout: 30000,  // 30 detik untuk koneksi awal
    requestTimeout: 30000,     // 30 detik untuk setiap request
  }

  return config
}

export async function getPool(): Promise<ConnectionPool> {
  if (pool && pool.connected) {
    console.log("[v0] Reusing existing SQL Server pool")
    return pool
  }
  if (connecting) {
    console.log("[v0] Waiting for SQL Server connection in progress...")
    return connecting
  }

  const config = buildConfig()
  console.log("[v0] Initiating new SQL Server connection to:", config.server, ":", config.port, "database:", config.database)
  
  connecting = new sql.ConnectionPool(config)
    .connect()
    .then((p) => {
      console.log("[v0] SQL Server pool connected successfully!")
      pool = p
      p.on("error", (err) => {
        console.log("[v0] SQL Server pool error event:", err?.message || err)
        pool = null
      })
      return p
    })
    .catch((err) => {
      connecting = null
      const errMsg = err instanceof Error ? err.message : String(err)
      console.log("[v0] SQL Server pool connection FAILED:", errMsg)
      throw err
    })

  return connecting
}

export { sql }
