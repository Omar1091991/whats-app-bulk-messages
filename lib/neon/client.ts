import { neon } from "@neondatabase/serverless"

export function createClient() {
  const sql = neon(process.env.NEON_NEON_DATABASE_URL!)
  return sql
}
