import { Pool } from "@neondatabase/serverless"

interface QueryBuilder {
  select: (columns?: string, options?: { count?: string; head?: boolean }) => QueryBuilder
  insert: (data: any) => QueryBuilder
  update: (data: any) => QueryBuilder
  delete: () => QueryBuilder
  eq: (column: string, value: any) => QueryBuilder
  neq: (column: string, value: any) => QueryBuilder
  in: (column: string, values: any[]) => QueryBuilder
  not: (column: string, operator: string, value: any) => QueryBuilder
  gte: (column: string, value: any) => QueryBuilder
  lte: (column: string, value: any) => QueryBuilder
  gt: (column: string, value: any) => QueryBuilder
  lt: (column: string, value: any) => QueryBuilder
  is: (column: string, value: any) => QueryBuilder
  limit: (count: number) => QueryBuilder
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder
  single: () => Promise<{ data: any; error: any; count?: number }>
  maybeSingle: () => Promise<{ data: any; error: any; count?: number }>
  then: (
    resolve: (value: { data: any; error: any; count?: number }) => void,
    reject?: (reason: any) => void,
  ) => Promise<any>
}

class NeonQueryBuilder implements QueryBuilder {
  private pool: Pool
  private tableName: string
  private selectColumns = "*"
  private whereConditions: Array<{ column: string; operator: string; value: any }> = []
  private limitCount?: number
  private orderColumn?: string
  private orderAscending = true
  private operation: "select" | "insert" | "update" | "delete" = "select"
  private insertData?: any
  private updateData?: any
  private returnSingle = false
  private countOnly = false
  private headOnly = false

  constructor(pool: Pool, tableName: string) {
    this.pool = pool
    this.tableName = tableName
  }

  select(columns = "*", options?: { count?: string; head?: boolean }): QueryBuilder {
    this.operation = "select"
    this.selectColumns = columns
    if (options?.count === "exact") {
      this.countOnly = true
    }
    if (options?.head) {
      this.headOnly = true
    }
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
    this.whereConditions.push({ column, operator: "=", value })
    return this
  }

  neq(column: string, value: any): QueryBuilder {
    this.whereConditions.push({ column, operator: "!=", value })
    return this
  }

  in(column: string, values: any[]): QueryBuilder {
    this.whereConditions.push({ column, operator: "IN", value: values })
    return this
  }

  not(column: string, operator: string, value: any): QueryBuilder {
    if (operator === "is" && value === null) {
      this.whereConditions.push({ column, operator: "IS NOT", value: null })
    } else if (operator === "eq") {
      this.whereConditions.push({ column, operator: "!=", value })
    } else if (operator === "in") {
      this.whereConditions.push({ column, operator: "NOT IN", value })
    } else {
      // For other operators, negate them
      this.whereConditions.push({ column, operator: `NOT ${operator}`, value })
    }
    return this
  }

  gte(column: string, value: any): QueryBuilder {
    this.whereConditions.push({ column, operator: ">=", value })
    return this
  }

  lte(column: string, value: any): QueryBuilder {
    this.whereConditions.push({ column, operator: "<=", value })
    return this
  }

  gt(column: string, value: any): QueryBuilder {
    this.whereConditions.push({ column, operator: ">", value })
    return this
  }

  lt(column: string, value: any): QueryBuilder {
    this.whereConditions.push({ column, operator: "<", value })
    return this
  }

  is(column: string, value: any): QueryBuilder {
    if (value === null) {
      this.whereConditions.push({ column, operator: "IS", value: null })
    } else {
      this.whereConditions.push({ column, operator: "IS NOT", value: null })
    }
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

  single(): Promise<{ data: any; error: any; count?: number }> {
    this.returnSingle = true
    return this.execute()
  }

  maybeSingle(): Promise<{ data: any; error: any; count?: number }> {
    this.returnSingle = true
    return this.execute().then((result) => {
      if (result.error) {
        return { data: null, error: null }
      }
      return result
    })
  }

  then(
    resolve: (value: { data: any; error: any; count?: number }) => void,
    reject?: (reason: any) => void,
  ): Promise<any> {
    return this.execute().then(resolve, reject)
  }

  private async execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      if (this.operation === "select") {
        if (this.countOnly) {
          let query = `SELECT COUNT(*) as count FROM ${this.tableName}`
          const values: any[] = []
          let paramIndex = 1

          if (this.whereConditions.length > 0) {
            const whereClause = this.buildWhereClause(values, paramIndex)
            query += ` WHERE ${whereClause.clause}`
            paramIndex = whereClause.paramIndex
          }

          const result = await this.pool.query(query, values)
          const count = Number.parseInt(result.rows[0]?.count || "0")
          return {
            data: this.headOnly ? null : [],
            error: null,
            count,
          }
        }

        let query = `SELECT ${this.selectColumns} FROM ${this.tableName}`
        const values: any[] = []
        let paramIndex = 1

        if (this.whereConditions.length > 0) {
          const whereClause = this.buildWhereClause(values, paramIndex)
          query += ` WHERE ${whereClause.clause}`
          paramIndex = whereClause.paramIndex
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
          const whereClause = this.buildWhereClause(values, paramIndex)
          query += ` WHERE ${whereClause.clause}`
          paramIndex = whereClause.paramIndex
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
          const whereClause = this.buildWhereClause(values, paramIndex)
          query += ` WHERE ${whereClause.clause}`
          paramIndex = whereClause.paramIndex
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

  private buildWhereClause(values: any[], startParamIndex: number): { clause: string; paramIndex: number } {
    let paramIndex = startParamIndex
    const clauses = this.whereConditions.map((cond) => {
      if (cond.operator === "IN" || cond.operator === "NOT IN") {
        const placeholders = cond.value.map(() => `$${paramIndex++}`)
        cond.value.forEach((v: any) => values.push(v))
        return `${cond.column} ${cond.operator} (${placeholders.join(", ")})`
      } else if (cond.operator === "IS" || cond.operator === "IS NOT") {
        return `${cond.column} ${cond.operator} NULL`
      } else {
        values.push(cond.value)
        return `${cond.column} ${cond.operator} $${paramIndex++}`
      }
    })
    return { clause: clauses.join(" AND "), paramIndex }
  }
}

export async function createClient() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.NEON_POSTGRES_URL ||
    process.env.POSTGRES_URL

  if (!connectionString) {
    console.error(
      "[v0] No Neon database connection string found. Tried: DATABASE_URL, NEON_DATABASE_URL, NEON_POSTGRES_URL, POSTGRES_URL",
    )
    throw new Error("No Neon database connection string found. Please set DATABASE_URL environment variable.")
  }

  console.log("[v0] Neon connection string found, connecting to database...")
  const pool = new Pool({ connectionString })

  return {
    from: (tableName: string) => new NeonQueryBuilder(pool, tableName),
    query: async (text: string, params?: any[]) => {
      try {
        const result = await pool.query(text, params)
        return { rows: result.rows, error: null }
      } catch (error) {
        console.error("[v0] Raw query error:", error)
        return { rows: [], error }
      }
    },
  }
}
