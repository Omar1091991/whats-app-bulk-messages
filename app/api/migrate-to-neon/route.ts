import { NextResponse } from "next/server"
import { Pool } from "@neondatabase/serverless"
import { createClient } from "@supabase/supabase-js"

let migrationInProgress = false

export async function GET() {
  return POST()
}

export async function POST() {
  if (migrationInProgress) {
    return NextResponse.json(
      {
        success: false,
        error: "Migration is already in progress. Please wait for it to complete.",
      },
      { status: 409 },
    )
  }

  migrationInProgress = true

  try {
    console.log("[v0] Starting migration from Supabase to Neon...")

    const neonConnectionString =
      process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.NEON_POSTGRES_URL

    if (!neonConnectionString) {
      throw new Error("No Neon database connection string found")
    }

    const neonPool = new Pool({ connectionString: neonConnectionString })
    const neonClient = await neonPool.connect()
    console.log("[v0] Connected to Neon")

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not found")
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    console.log("[v0] Connected to Supabase")

    console.log("[v0] Dropping existing tables...")
    const tablesToDrop = [
      "webhook_messages",
      "uploaded_media",
      "scheduled_messages",
      "message_history",
      "daily_statistics",
      "api_settings",
    ]

    for (const table of tablesToDrop) {
      await neonClient.query(`DROP TABLE IF EXISTS ${table} CASCADE`)
      console.log(`[v0] Dropped table: ${table}`)
    }

    console.log("[v0] Creating tables in Neon...")

    await neonClient.query(`
      CREATE TABLE api_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number_id TEXT,
        business_account_id TEXT,
        access_token TEXT,
        webhook_verify_token TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("[v0] ✅ Created table: api_settings")

    await neonClient.query(`
      CREATE TABLE daily_statistics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL UNIQUE,
        total_sent INTEGER DEFAULT 0,
        single_messages INTEGER DEFAULT 0,
        bulk_instant_messages INTEGER DEFAULT 0,
        bulk_scheduled_messages INTEGER DEFAULT 0,
        reply_messages INTEGER DEFAULT 0,
        successful_messages INTEGER DEFAULT 0,
        failed_messages INTEGER DEFAULT 0,
        pending_messages INTEGER DEFAULT 0,
        incoming_messages INTEGER DEFAULT 0,
        unique_templates INTEGER DEFAULT 0,
        scheduled_pending INTEGER DEFAULT 0,
        scheduled_completed INTEGER DEFAULT 0,
        scheduled_failed INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("[v0] ✅ Created table: daily_statistics")

    await neonClient.query(`
      CREATE TABLE message_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        to_number TEXT,
        message_text TEXT,
        message_type TEXT,
        media_url TEXT,
        template_name TEXT,
        status TEXT,
        error_message TEXT,
        message_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("[v0] ✅ Created table: message_history")

    await neonClient.query(`
      CREATE TABLE scheduled_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_name TEXT,
        template_params JSONB,
        phone_numbers TEXT[],
        media_id TEXT,
        media_url TEXT,
        media_type TEXT,
        scheduled_time TIMESTAMP WITH TIME ZONE,
        status TEXT DEFAULT 'pending',
        total_numbers INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        error_message TEXT,
        processed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("[v0] ✅ Created table: scheduled_messages")

    await neonClient.query(`
      CREATE TABLE uploaded_media (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename TEXT,
        mime_type TEXT,
        file_size BIGINT,
        media_id TEXT,
        media_url TEXT,
        preview_url TEXT,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("[v0] ✅ Created table: uploaded_media")

    await neonClient.query(`
      CREATE TABLE webhook_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id TEXT,
        from_number TEXT,
        from_name TEXT,
        message_text TEXT,
        message_type TEXT,
        message_media_url TEXT,
        message_media_mime_type TEXT,
        timestamp BIGINT,
        replied BOOLEAN DEFAULT FALSE,
        reply_text TEXT,
        reply_sent_at TIMESTAMP WITH TIME ZONE,
        status TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("[v0] ✅ Created table: webhook_messages")

    console.log("[v0] Creating indexes...")
    await neonClient.query(`CREATE INDEX idx_message_history_to_number ON message_history(to_number)`)
    await neonClient.query(`CREATE INDEX idx_message_history_created_at ON message_history(created_at)`)
    await neonClient.query(`CREATE INDEX idx_daily_statistics_date ON daily_statistics(date)`)
    await neonClient.query(`CREATE INDEX idx_scheduled_messages_status ON scheduled_messages(status)`)
    await neonClient.query(`CREATE INDEX idx_scheduled_messages_time ON scheduled_messages(scheduled_time)`)
    await neonClient.query(`CREATE INDEX idx_webhook_messages_from ON webhook_messages(from_number)`)
    await neonClient.query(`CREATE INDEX idx_webhook_messages_timestamp ON webhook_messages(timestamp)`)
    await neonClient.query(`CREATE INDEX idx_webhook_messages_message_id ON webhook_messages(message_id)`)
    console.log("[v0] ✅ Indexes created")

    const tables = [
      "api_settings",
      "daily_statistics",
      "message_history",
      "scheduled_messages",
      "uploaded_media",
      "webhook_messages",
    ]

    const migrationResults: Record<string, number> = {}

    neonClient.release()
    await neonPool.end()
    console.log("[v0] Schema creation completed, released connection")

    for (const table of tables) {
      console.log(`[v0] Migrating ${table}...`)

      // First, get the total count
      const { count, error: countError } = await supabase.from(table).select("*", { count: "exact", head: true })

      if (countError) {
        console.error(`[v0] Error counting ${table}:`, countError)
        migrationResults[table] = 0
        continue
      }

      const totalRows = count || 0
      console.log(`[v0] Total rows in ${table}: ${totalRows}`)

      if (totalRows === 0) {
        console.log(`[v0] No data in ${table}`)
        migrationResults[table] = 0
        continue
      }

      // Fetch all data in pages of 1000 rows
      const pageSize = 1000
      let allData: any[] = []

      for (let page = 0; page * pageSize < totalRows; page++) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) {
          console.error(`[v0] Error fetching page ${page} of ${table}:`, error)
          continue
        }

        if (data && data.length > 0) {
          allData = allData.concat(data)
          console.log(`[v0] Fetched page ${page + 1}: ${data.length} rows (total: ${allData.length}/${totalRows})`)
        }
      }

      if (allData.length === 0) {
        console.log(`[v0] No data fetched from ${table}`)
        migrationResults[table] = 0
        continue
      }

      console.log(`[v0] Fetched ${allData.length} total rows from ${table}, starting insert...`)

      const tablePool = new Pool({ connectionString: neonConnectionString })
      const tableClient = await tablePool.connect()
      console.log(`[v0] Created fresh connection for ${table}`)

      let insertedCount = 0
      const batchSize = 100

      try {
        for (let i = 0; i < allData.length; i += batchSize) {
          const batch = allData.slice(i, i + batchSize)

          try {
            if (batch.length > 0) {
              const columns = Object.keys(batch[0])
              const valueRows: string[] = []
              const allValues: any[] = []
              let paramIndex = 1

              for (const row of batch) {
                const rowPlaceholders = columns.map(() => `$${paramIndex++}`).join(", ")
                valueRows.push(`(${rowPlaceholders})`)
                columns.forEach((col) => allValues.push(row[col]))
              }

              const insertSQL = `
                INSERT INTO ${table} (${columns.join(", ")})
                VALUES ${valueRows.join(", ")}
                ON CONFLICT DO NOTHING
              `

              await tableClient.query(insertSQL, allValues)
              insertedCount += batch.length

              if (insertedCount % 500 === 0 || insertedCount === allData.length) {
                console.log(`[v0] Progress: ${insertedCount}/${allData.length} rows migrated to ${table}`)
              }
            }
          } catch (err) {
            console.error(`[v0] Error inserting batch in ${table}:`, err instanceof Error ? err.message : err)

            // Try inserting rows one by one if batch fails
            for (const row of batch) {
              try {
                const columns = Object.keys(row)
                const values = columns.map((col) => row[col])
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ")

                const insertSQL = `
                  INSERT INTO ${table} (${columns.join(", ")})
                  VALUES (${placeholders})
                  ON CONFLICT DO NOTHING
                `

                await tableClient.query(insertSQL, values)
                insertedCount++
              } catch (rowErr) {
                console.error(
                  `[v0] Error inserting row in ${table}:`,
                  rowErr instanceof Error ? rowErr.message : rowErr,
                )
              }
            }
          }
        }
      } finally {
        tableClient.release()
        await tablePool.end()
        console.log(`[v0] Released connection for ${table}`)
      }

      migrationResults[table] = insertedCount
      console.log(`[v0] ✅ Migrated ${insertedCount} rows from ${table}`)
    }

    console.log("[v0] Migration completed successfully!")

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully",
      results: migrationResults,
    })
  } catch (error) {
    console.error("[v0] Migration error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  } finally {
    migrationInProgress = false
  }
}
