import { NextResponse } from "next/server"
import { Pool } from "@neondatabase/serverless"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  // Automatically trigger migration when accessed via browser
  return POST()
}

export async function POST() {
  try {
    console.log("[v0] Starting migration from Supabase to Neon...")

    // Connect to Neon
    const neonConnectionString =
      process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.NEON_POSTGRES_URL

    if (!neonConnectionString) {
      throw new Error("No Neon database connection string found")
    }

    const neonPool = new Pool({ connectionString: neonConnectionString })
    console.log("[v0] Connected to Neon")

    // Connect to Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not found")
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    console.log("[v0] Connected to Supabase")

    console.log("[v0] Dropping existing tables...")

    const dropTablesSQL = `
      DROP TABLE IF EXISTS webhook_messages CASCADE;
      DROP TABLE IF EXISTS uploaded_media CASCADE;
      DROP TABLE IF EXISTS scheduled_messages CASCADE;
      DROP TABLE IF EXISTS message_history CASCADE;
      DROP TABLE IF EXISTS daily_statistics CASCADE;
      DROP TABLE IF EXISTS api_settings CASCADE;
    `

    await neonPool.query(dropTablesSQL)
    console.log("[v0] ✅ Existing tables dropped")

    console.log("[v0] Creating tables in Neon with correct schema...")

    const createTablesSQL = `
      -- Create api_settings table (matches Supabase exactly)
      CREATE TABLE api_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number_id TEXT,
        business_account_id TEXT,
        access_token TEXT,
        webhook_verify_token TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create daily_statistics table (matches Supabase exactly)
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
      );

      -- Create message_history table (matches Supabase exactly)
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
      );

      -- Create scheduled_messages table (matches Supabase exactly)
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
      );

      -- Create uploaded_media table (matches Supabase exactly)
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
      );

      -- Create webhook_messages table (matches Supabase exactly)
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
      );

      -- Create indexes
      CREATE INDEX idx_message_history_to_number ON message_history(to_number);
      CREATE INDEX idx_message_history_created_at ON message_history(created_at);
      CREATE INDEX idx_daily_statistics_date ON daily_statistics(date);
      CREATE INDEX idx_scheduled_messages_status ON scheduled_messages(status);
      CREATE INDEX idx_scheduled_messages_time ON scheduled_messages(scheduled_time);
      CREATE INDEX idx_webhook_messages_from ON webhook_messages(from_number);
      CREATE INDEX idx_webhook_messages_timestamp ON webhook_messages(timestamp);
      CREATE INDEX idx_webhook_messages_message_id ON webhook_messages(message_id);
    `

    await neonPool.query(createTablesSQL)
    console.log("[v0] ✅ Tables created successfully with correct schema")

    // Step 2: Migrate data from Supabase to Neon
    const tables = [
      "api_settings",
      "daily_statistics",
      "message_history",
      "scheduled_messages",
      "uploaded_media",
      "webhook_messages",
    ]

    const migrationResults: Record<string, number> = {}

    for (const table of tables) {
      console.log(`[v0] Migrating ${table}...`)

      // Fetch all data from Supabase
      const { data, error } = await supabase.from(table).select("*")

      if (error) {
        console.error(`[v0] Error fetching ${table}:`, error)
        migrationResults[table] = 0
        continue
      }

      if (!data || data.length === 0) {
        console.log(`[v0] No data in ${table}`)
        migrationResults[table] = 0
        continue
      }

      // Insert data into Neon
      let insertedCount = 0
      for (const row of data) {
        try {
          const columns = Object.keys(row)
          const values = columns.map((col) => row[col])
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ")

          const insertSQL = `
            INSERT INTO ${table} (${columns.join(", ")})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `

          await neonPool.query(insertSQL, values)
          insertedCount++
        } catch (err) {
          console.error(`[v0] Error inserting row in ${table}:`, err instanceof Error ? err.message : err)
        }
      }

      migrationResults[table] = insertedCount
      console.log(`[v0] ✅ Migrated ${insertedCount} rows from ${table}`)
    }

    await neonPool.end()
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
  }
}
