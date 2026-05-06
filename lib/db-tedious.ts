import { Connection, Request as TediousRequest, TYPES } from "tedious"

interface QueryResult {
  recordset: Record<string, unknown>[]
}

interface RequestWrapper {
  input(name: string, type: any, value: unknown): RequestWrapper
  query(sql: string): Promise<QueryResult>
}

// SQL type mappings untuk kompatibilitas dengan mssql API
export const sql = {
  NVarChar: (len?: number) => ({ type: TYPES.NVarChar, length: len }),
  Char: (len?: number) => ({ type: TYPES.Char, length: len }),
  Int: () => ({ type: TYPES.Int }),
  DateTime: () => ({ type: TYPES.DateTime }),
  Bit: () => ({ type: TYPES.Bit }),
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
    console.log("[v0-tedious] Connecting to SQL Server:", config.server)

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

  private buildConnectionConfig() {
    const server = process.env.SQL_SERVER_HOST || "localhost"
    const user = process.env.SQL_SERVER_USER || "sa"
    const password = process.env.SQL_SERVER_PASSWORD || ""
    const database = process.env.SQL_SERVER_DATABASE || "master"
    const instanceName = process.env.SQL_SERVER_INSTANCE || ""
    const encrypt = process.env.SQL_SERVER_ENCRYPT === "true"
    const trustServerCertificate = process.env.SQL_SERVER_TRUST_CERT === "true"

    // Jika instanceName ada, gunakan instanceName (jangan port)
    // Jika tidak ada instanceName, gunakan port
    const options: any = {
      database,
      encrypt,
      trustServerCertificate,
      connectionTimeout: 30000,
      requestTimeout: 30000,
    }

    if (instanceName) {
      console.log("[v0-tedious] Using instance:", instanceName)
      options.instanceName = instanceName
    } else {
      const port = parseInt(process.env.SQL_SERVER_PORT || "1433", 10)
      console.log("[v0-tedious] Using port:", port)
      options.port = port
    }

    return {
      server,
      authentication: {
        type: "default" as const,
        options: {
          userName: user,
          password,
        },
      },
      options,
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
            const typeObj = types.get(name)
            const type = typeObj?.type || TYPES.NVarChar
            const length = typeObj?.length || undefined
            request.addParameter(name, type, value, { length })
          })

          // Event handler untuk setiap row
          request.on("row", (columns: any[]) => {
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

export async function getPool(): Promise<TediousPoolWrapper> {
  if (pool && pool.connected) {
    console.log("[v0-tedious] Reusing existing connection pool")
    return pool
  }

  console.log("[v0-tedious] Creating new connection pool")
  pool = new TediousPoolWrapper()
  await pool.connect()
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) {
    return pool.close()
  }
  return Promise.resolve()
}
