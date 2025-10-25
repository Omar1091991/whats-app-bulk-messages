import { Pool } from "@neondatabase/serverless"

interface QueryBuilder {
  select: (columns?: string) => QueryBuilder
  insert: (data: any) => QueryBuilder
  update: (data: any) => QueryBuilder
  delete: () => QueryBuilder
  eq: (column: string, value: any) => QueryBuilder
  limit: (count: number) => QueryBuilder
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder
  single: () => Promise<{ data: any; error: any }>
  then: (resolve: (value: { data: any; error: any }) => void, reject?: (reason: any) => void) => Promise<any>
}

class NeonQueryBuilder implements QueryBuilder {
  private pool: Pool
  private tableName: string
  private selectColumns = "*"
  private whereConditions: Array<{ column: string; value: any }> = []
  private limitCount?: number
  private orderColumn?: string
  private orderAscending = true
  private operation: "select" | "insert" | "update" | "delete" = "select"
  private insertData?: any
  private updateData?: any
  private returnSingle = false

  constructor(pool: Pool, tableName: string) {
    this.pool = pool
    this.tableName = tableName
  }

  select(columns = "*"): QueryBuilder {
    this.operation = "select"
    this.selectColumns = columns
    return this
  }

  insert(data: any): QueryBuilder {
    this.operation = "insert"
    this.insertData = Array.isArray(data) ? data : [data]
    return this
  }

  update(data: any): QueryBuilder {
    this.operation = "update"
    this.updateData = data
    return this
  }

  delete(): QueryBuilder {
    this.operation = "delete"
    return this
  }

  eq(column: string, value: any): QueryBuilder {
    this.whereConditions.push({ column, value })
    return this
  }

  limit(count: number): QueryBuilder {
    this.limitCount = count
    return this
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder {
    this.orderColumn = column
    this.orderAscending = options?.ascending !== false
    return this
  }

  single(): Promise<{ data: any; error: any }> {
    this.returnSingle = true
    return this.execute()
  }

  then(resolve: (value: { data: any; error: any }) => void, reject?: (reason: any) => void): Promise<any> {
    return this.execute().then(resolve, reject)
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      if (this.operation === "select") {
        let query = `SELECT ${this.selectColumns} FROM ${this.tableName}`
        const values: any[] = []
        let paramIndex = 1

        if (this.whereConditions.length > 0) {
          const whereClause = this.whereConditions
            .map((cond) => {
              values.push(cond.value)
              return `${cond.column} = $${paramIndex++}`
            })
            .join(" AND ")
          query += ` WHERE ${whereClause}`
        }

        if (this.orderColumn) {
          query += ` ORDER BY ${this.orderColumn} ${this.orderAscending ? "ASC" : "DESC"}`
        }

        if (this.limitCount) {
          query += ` LIMIT $${paramIndex++}`
          values.push(this.limitCount)
        }

        const result = await this.pool.query(query, values)
        return {
          data: this.returnSingle ? result.rows[0] || null : result.rows,
          error: null,
        }
      }

      if (this.operation === "insert") {
        const keys = Object.keys(this.insertData[0])
        const values: any[] = []
        let paramIndex = 1

        const valuePlaceholders = this.insertData
          .map((row: any) => {
            const rowPlaceholders = keys.map(() => `$${paramIndex++}`)
            keys.forEach((key) => values.push(row[key]))
            return `(${rowPlaceholders.join(", ")})`
          })
          .join(", ")

        const query = `INSERT INTO ${this.tableName} (${keys.join(", ")}) VALUES ${valuePlaceholders} RETURNING *`
        const result = await this.pool.query(query, values)
        return { data: result.rows, error: null }
      }

      if (this.operation === "update") {
        const keys = Object.keys(this.updateData)
        const values: any[] = []
        let paramIndex = 1

        const setClause = keys
          .map((key) => {
            values.push(this.updateData[key])
            return `${key} = $${paramIndex++}`
          })
          .join(", ")

        let query = `UPDATE ${this.tableName} SET ${setClause}`

        if (this.whereConditions.length > 0) {
          const whereClause = this.whereConditions
            .map((cond) => {
              values.push(cond.value)
              return `${cond.column} = $${paramIndex++}`
            })
            .join(" AND ")
          query += ` WHERE ${whereClause}`
        }

        query += " RETURNING *"
        const result = await this.pool.query(query, values)
        return { data: result.rows, error: null }
      }

      if (this.operation === "delete") {
        let query = `DELETE FROM ${this.tableName}`
        const values: any[] = []
        let paramIndex = 1

        if (this.whereConditions.length > 0) {
          const whereClause = this.whereConditions
            .map((cond) => {
              values.push(cond.value)
              return `${cond.column} = $${paramIndex++}`
            })
            .join(" AND ")
          query += ` WHERE ${whereClause}`
        }

        query += " RETURNING *"
        const result = await this.pool.query(query, values)
        return { data: result.rows, error: null }
      }

      return { data: null, error: new Error("Invalid operation") }
    } catch (error) {
      console.error("[v0] Neon query error:", error)
      return { data: null, error }
    }
  }
}

export async function createClient() {
  const connectionString =
    process.env.NEON_NEON_DATABASE_URL ||
    process.env.NEON_POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL

  if (!connectionString) {
    console.error(
      "[v0] No Neon database connection string found. Tried: NEON_DATABASE_URL, NEON_POSTGRES_URL, DATABASE_URL, POSTGRES_URL",
    )
    throw new Error(
      "No Neon database connection string found. Please set NEON_DATABASE_URL or NEON_POSTGRES_URL environment variable.",
    )
  }

  console.log("[v0] Neon connection string found, connecting to database...")
  const pool = new Pool({ connectionString })

  return {
    from: (tableName: string) => new NeonQueryBuilder(pool, tableName),
  }
}
