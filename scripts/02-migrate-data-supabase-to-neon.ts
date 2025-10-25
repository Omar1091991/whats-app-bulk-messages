// سكريبت نقل البيانات من Supabase إلى Neon
// يقوم بنسخ جميع البيانات من جميع الجداول

import { createClient } from "@supabase/supabase-js"
import { Pool } from "@neondatabase/serverless"

// الاتصال بـ Supabase (المصدر)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// الاتصال بـ Neon (الوجهة)
const neonPool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
})

async function migrateTable(tableName: string, columns: string[]) {
  console.log(`\n[v0] بدء نقل جدول: ${tableName}`)

  try {
    // جلب البيانات من Supabase
    const { data, error } = await supabase.from(tableName).select("*")

    if (error) {
      console.error(`[v0] خطأ في قراءة ${tableName} من Supabase:`, error)
      return
    }

    if (!data || data.length === 0) {
      console.log(`[v0] لا توجد بيانات في جدول ${tableName}`)
      return
    }

    console.log(`[v0] تم جلب ${data.length} صف من ${tableName}`)

    // إدراج البيانات في Neon
    const client = await neonPool.connect()

    try {
      let successCount = 0
      let errorCount = 0

      for (const row of data) {
        try {
          // بناء استعلام INSERT
          const columnNames = columns.filter((col) => row[col] !== undefined)
          const values = columnNames.map((col) => row[col])
          const placeholders = columnNames.map((_, i) => `$${i + 1}`).join(", ")

          const query = `
            INSERT INTO ${tableName} (${columnNames.join(", ")})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `

          await client.query(query, values)
          successCount++
        } catch (err) {
          console.error(`[v0] خطأ في إدراج صف في ${tableName}:`, err)
          errorCount++
        }
      }

      console.log(`[v0] ✅ تم نقل ${successCount} صف بنجاح من ${tableName}`)
      if (errorCount > 0) {
        console.log(`[v0] ⚠️ فشل نقل ${errorCount} صف من ${tableName}`)
      }
    } finally {
      client.release()
    }
  } catch (error) {
    console.error(`[v0] خطأ في نقل جدول ${tableName}:`, error)
  }
}

async function migrateAllData() {
  console.log("[v0] ========================================")
  console.log("[v0] بدء عملية نقل البيانات من Supabase إلى Neon")
  console.log("[v0] ========================================")

  // نقل جدول api_settings
  await migrateTable("api_settings", [
    "id",
    "phone_number_id",
    "access_token",
    "business_account_id",
    "webhook_verify_token",
    "created_at",
    "updated_at",
  ])

  // نقل جدول daily_statistics
  await migrateTable("daily_statistics", [
    "id",
    "date",
    "total_sent",
    "successful_messages",
    "failed_messages",
    "created_at",
  ])

  // نقل جدول message_history
  await migrateTable("message_history", [
    "id",
    "phone_number",
    "message_text",
    "status",
    "error_message",
    "sent_at",
    "template_name",
    "media_url",
  ])

  // نقل جدول scheduled_messages
  await migrateTable("scheduled_messages", [
    "id",
    "phone_numbers",
    "message_text",
    "template_name",
    "scheduled_time",
    "status",
    "created_at",
    "sent_at",
    "media_url",
    "error_message",
  ])

  // نقل جدول uploaded_media
  await migrateTable("uploaded_media", [
    "id",
    "media_id",
    "media_url",
    "media_type",
    "file_name",
    "file_size",
    "uploaded_at",
  ])

  // نقل جدول webhook_messages
  await migrateTable("webhook_messages", [
    "id",
    "message_id",
    "from_number",
    "from_name",
    "message_type",
    "message_text",
    "message_media_url",
    "timestamp",
    "received_at",
    "is_read",
    "conversation_status",
  ])

  console.log("\n[v0] ========================================")
  console.log("[v0] ✅ اكتملت عملية نقل البيانات!")
  console.log("[v0] ========================================")

  await neonPool.end()
}

// تشغيل عملية النقل
migrateAllData().catch(console.error)
