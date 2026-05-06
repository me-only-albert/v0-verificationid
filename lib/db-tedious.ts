import { Connection, ConnectionConfig, Request as TediousRequest } from "tedious"

interface QueryResult {
  recordset: Record<string, unknown>[]
}

interface RequestWrapper {
  input(name: string, type: any, value: unknown): RequestWrapper
  query(sql: string): Promise<QueryResult>
}

/**
 * Wrapper untuk tedious Connection agar API mirip dengan mssql package.
 * Ini untuk kompatibilitas drop-in jika mssql tidak bisa dipakai.
 */
class TediousPoolWrapper {
  private connection: Connection | null = null
  private connecting: Promise<Connection> | null = null

  async connect(): Promise<this> {
    if (this.connection && this.connection.state?.name === "LoggedIn") {
      return this
    }

    if (this.connecting) {
      await this.connecting
      return this
    }

    const config = this.buildConnectionConfig()
    console.log("[v0-tedious] Connecting to SQL Server:", config.server, ":", config.options?.port)

    this.connecting = new Promise((resolve, reject) => {
      const conn = new Connection(config)

      conn.on("connect", () => {
        console.log("[v0-tedious] Connected to SQL Server successfully")
        this.connection = conn
        resolve(conn)
      })

      conn.on("error", (err) => {
        console.log("[v0-tedious] Connection error:", err.message)
        this.connection = null
      })

      conn.connect()
    })

    try {
      await this.connecting
    } catch (err) {
      this.connecting = null
      throw err
    } finally {
      this.connecting = null
    }

    return this
  }

  private buildConnectionConfig(): ConnectionConfig {
    const server = process.env.DB_SERVER || "localhost"
    const port = parseInt(process.env.DB_PORT || "1433", 10)
    const user = process.env.DB_USER || "sa"
    const password = process.env.DB_PASSWORD || ""
    const database = process.env.DB_NAME || "master"
    const encrypt = process.env.DB_ENCRYPT === "true"
    const trustServerCertificate = process.env.DB_TRUST_SERVER_CERTIFICATE === "true"

    return {
      server,
      authentication: {
        type: "default",
        options: {
          userName: user,
          password,
        },
      },
      options: {
        port,
        database,
        encrypt,
        trustServerCertificate,
        // Kompatibel dengan SQL Server 2012
        connectionTimeout: 30000,
        requestTimeout: 30000,
      },
    }
  }

  request(): RequestWrapper {
    if (!this.connection || this.connection.state?.name !== "LoggedIn") {
      throw new Error("Database connection not established")
    }

    const conn = this.connection
    const inputs: Map<string, unknown> = new Map()
    const types: Map<string, any> = new Map()

    // Import tipe dari tedious
    const { TYPES } = require("tedious")

    const wrapper: RequestWrapper = {
      input(name: string, type: any, value: unknown): RequestWrapper {
        inputs.set(name, value)
        types.set(name, type)
        return wrapper
      },

      async query(sql: string): Promise<QueryResult> {
        return new Promise((resolve, reject) => {
          const recordset: Record<string, unknown>[] = []

          const request = new TediousRequest(sql, (err) => {
            if (err) {
              console.log("[v0-tedious] Query error:", err.message)
              reject(err)
            } else {
              resolve({ recordset })
            }
          })

          // Tambah input parameters
          inputs.forEach((value, name) => {
            const type = types.get(name)
            request.addParameter(name, type, value)
          })

          // Event handler untuk setiap row
          request.on("row", (columns) => {
            const row: Record<string, unknown> = {}
            columns.forEach((col) => {
              row[col.metadata.colName] = col.value
            })
            recordset.push(row)
          })

          conn.execSql(request)
        })
      },
    }

    return wrapper
  }

  get connected(): boolean {
    return this.connection !== null && this.connection.state?.name === "LoggedIn"
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connection) {
        this.connection.close()
      }
      resolve()
    })
  }
}

let pool: TediousPoolWrapper | null = null

export async function getPoolTedious(): Promise<TediousPoolWrapper> {
  if (pool && pool.connected) {
    console.log("[v0-tedious] Reusing existing connection pool")
    return pool
  }

  console.log("[v0-tedious] Creating new connection pool")
  pool = new TediousPoolWrapper()
  await pool.connect()
  return pool
}

export function closePoolTedious(): Promise<void> {
  if (pool) {
    return pool.close()
  }
  return Promise.resolve()
}
