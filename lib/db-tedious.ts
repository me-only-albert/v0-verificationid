import { Connection, Request as TediousRequest, TYPES } from "tedious"

interface QueryResult {
  recordset: Record<string, unknown>[]
}

interface RequestWrapper {
  input(name: string, type: any, value: unknown): RequestWrapper
  query(sql: string): Promise<QueryResult>
}

export interface DbConnectionOptions {
  server?: string
  user?: string
  password?: string
  database?: string
  instanceName?: string
  port?: number
  preferPort?: boolean
  encrypt?: boolean
  trustServerCertificate?: boolean
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
  private queryQueue: Promise<unknown> = Promise.resolve()
  private readonly options?: DbConnectionOptions

  constructor(options?: DbConnectionOptions) {
    this.options = options
  }

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

      conn.on("connect", (err) => {
        if (err) {
          console.log("[v0-tedious] Connect event failed:", err.message)
          console.log("[v0-tedious] Error code:", (err as any).code)
          this.connection = null
          reject(err)
          return
        }

        console.log("[v0-tedious] Connected to SQL Server successfully")
        this.connection = conn
        resolve(conn)
      })

      conn.on("error", (err) => {
        console.log("[v0-tedious] Connection error event:", err.message)
        console.log("[v0-tedious] Error code:", (err as any).code)
        this.connection = null
        reject(err)
      })

      conn.on("end", () => {
        console.log("[v0-tedious] Connection ended")
        this.connection = null
      })

      console.log("[v0-tedious] Calling conn.connect()...")
      conn.connect()
    })

    try {
      await this.connecting
    } catch (err) {
      this.connecting = null
      const errMsg = err instanceof Error ? err.message : String(err)
      console.log("[v0-tedious] Connection failed:", errMsg)
      throw err
    } finally {
      this.connecting = null
    }

    return this
  }

  private buildConnectionConfig() {
    const server = this.options?.server || process.env.SQL_SERVER_HOST || "localhost"
    const user = this.options?.user || process.env.SQL_SERVER_USER || "sa"
    const password = this.options?.password ?? process.env.SQL_SERVER_PASSWORD ?? ""
    const database = this.options?.database || process.env.SQL_SERVER_DATABASE || "master"
    const instanceName = this.options?.instanceName ?? process.env.SQL_SERVER_INSTANCE ?? ""
    const encrypt = this.options?.encrypt ?? process.env.SQL_SERVER_ENCRYPT === "true"
    const trustServerCertificate = this.options?.trustServerCertificate ?? process.env.SQL_SERVER_TRUST_CERT === "true"

    console.log("[v0-tedious] Config:", {
      server,
      user,
      database,
      instanceName: instanceName || "(empty)",
      encrypt,
      trustServerCertificate,
    })

    // Jika instanceName ada, gunakan instanceName (jangan port)
    // Jika tidak ada instanceName, gunakan port
    const options: any = {
      database,
      encrypt,
      trustServerCertificate,
      connectionTimeout: 30000,
      requestTimeout: 30000,
    }

    if (instanceName && !this.options?.preferPort) {
      console.log("[v0-tedious] Using instance:", instanceName)
      options.instanceName = instanceName
    } else {
      const port = this.options?.port ?? parseInt(process.env.SQL_SERVER_PORT || "1433", 10)
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
      const state = this.connection?.state?.name || "null"
      const err = `Database connection not established (state: ${state})`
      console.log("[v0-tedious]", err)
      throw new Error(err)
    }

    const conn = this.connection
    const runQueued = <T>(task: () => Promise<T>): Promise<T> => {
      const next = this.queryQueue.then(task, task)
      this.queryQueue = next.catch(() => undefined)
      return next
    }
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
        return runQueued(() => new Promise((resolve, reject) => {
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
        }))
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

const pools = new Map<string, TediousPoolWrapper>()

function poolKey(options?: DbConnectionOptions) {
  if (!options) return "default"

  return JSON.stringify({
    server: options.server || "",
    user: options.user || "",
    database: options.database || "",
    instanceName: options.instanceName || "",
    port: options.port || "",
    preferPort: options.preferPort ?? false,
    encrypt: options.encrypt ?? false,
    trustServerCertificate: options.trustServerCertificate ?? false,
  })
}

export async function getPool(options?: DbConnectionOptions): Promise<TediousPoolWrapper> {
  const key = poolKey(options)
  const existing = pools.get(key)

  if (existing && existing.connected) {
    console.log("[v0-tedious] Reusing existing connection pool")
    return existing
  }

  console.log("[v0-tedious] Creating new connection pool")
  const pool = new TediousPoolWrapper(options)
  pools.set(key, pool)
  await pool.connect()
  if (!pool.connected) {
    pools.delete(key)
    throw new Error("Database connection closed immediately after login.")
  }
  return pool
}

export async function closePool(): Promise<void> {
  await Promise.all(Array.from(pools.values()).map((pool) => pool.close()))
  pools.clear()
}
