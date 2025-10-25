import { Pool } from "@neondatabase/serverless"
import { createClient } from "@supabase/supabase-js"

async function migrateToNeon() {
  console.log("🚀 بدء عملية نقل البيانات من Supabase إلى Neon...\n")

  // الاتصال بـ Neon
  const neonPool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
  })

  // الاتصال بـ Supabase
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  try {
    // الخطوة 1: إنشاء الجداول في Neon
    console.log("📋 الخطوة 1: إنشاء الجداول في Neon...")

    await neonPool.query(`
      -- جدول إعدادات API
      CREATE TABLE IF NOT EXISTS api_settings (
        id SERIAL PRIMARY KEY,
        phone_number_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        business_account_id TEXT,
        webhook_verify_token TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- جدول الإحصائيات اليومية
      CREATE TABLE IF NOT EXISTS daily_statistics (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        total_sent INTEGER DEFAULT 0,
        successful_messages INTEGER DEFAULT 0,
        failed_messages INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- جدول سجل الرسائل
      CREATE TABLE IF NOT EXISTS message_history (
        id SERIAL PRIMARY KEY,
        phone_number TEXT NOT NULL,
        message_text TEXT,
        status TEXT NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT,
        message_id TEXT
      );

      -- جدول الرسائل المجدولة
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL,
        total_numbers INTEGER NOT NULL,
        message_text TEXT NOT NULL,
        media_url TEXT,
        scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0
      );

      -- جدول الوسائط المرفوعة
      CREATE TABLE IF NOT EXISTS uploaded_media (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL,
        media_url TEXT NOT NULL,
        media_type TEXT NOT NULL,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- جدول رسائل Webhook
      CREATE TABLE IF NOT EXISTS webhook_messages (
        id SERIAL PRIMARY KEY,
        message_id TEXT NOT NULL UNIQUE,
        from_number TEXT NOT NULL,
        from_name TEXT,
        message_type TEXT NOT NULL,
        message_text TEXT,
        message_media_url TEXT,
        timestamp BIGINT NOT NULL,
        received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- إنشاء الفهارس
      CREATE INDEX IF NOT EXISTS idx_message_history_phone ON message_history(phone_number);
      CREATE INDEX IF NOT EXISTS idx_message_history_sent_at ON message_history(sent_at);
      CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
      CREATE INDEX IF NOT EXISTS idx_scheduled_messages_time ON scheduled_messages(scheduled_time);
      CREATE INDEX IF NOT EXISTS idx_webhook_messages_from ON webhook_messages(from_number);
      CREATE INDEX IF NOT EXISTS idx_webhook_messages_timestamp ON webhook_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_daily_statistics_date ON daily_statistics(date);
    `)

    console.log("✅ تم إنشاء جميع الجداول والفهارس بنجاح\n")

    // الخطوة 2: نقل البيانات
    console.log("📦 الخطوة 2: نقل البيانات من Supabase إلى Neon...\n")

    const tables = [
      "api_settings",
      "daily_statistics",
      "message_history",
      "scheduled_messages",
      "uploaded_media",
      "webhook_messages",
    ]

    for (const table of tables) {
      console.log(`📊 نقل بيانات جدول: ${table}...`)

      // جلب البيانات من Supabase
      const { data, error } = await supabase.from(table).select("*")

      if (error) {
        console.log(`⚠️  خطأ في جلب بيانات ${table}: ${error.message}`)
        continue
      }

      if (!data || data.length === 0) {
        console.log(`ℹ️  جدول ${table} فارغ، تخطي...\n`)
        continue
      }

      console.log(`   وجد ${data.length} سجل`)

      // إدراج البيانات في Neon
      for (const row of data) {
        const columns = Object.keys(row).join(", ")
        const placeholders = Object.keys(row)
          .map((_, i) => `$${i + 1}`)
          .join(", ")
        const values = Object.values(row)

        try {
          await neonPool.query(
            `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values,
          )
        } catch (err: any) {
          console.log(`   ⚠️  خطأ في إدراج سجل: ${err.message}`)
        }
      }

      console.log(`✅ تم نقل ${data.length} سجل من ${table}\n`)
    }

    console.log("🎉 اكتملت عملية النقل بنجاح!")
    console.log("\n📊 ملخص النقل:")

    // عرض إحصائيات الجداول
    for (const table of tables) {
      const result = await neonPool.query(`SELECT COUNT(*) as count FROM ${table}`)
      console.log(`   ${table}: ${result.rows[0].count} سجل`)
    }
  } catch (error: any) {
    console.error("❌ خطأ في عملية النقل:", error.message)
    throw error
  } finally {
    await neonPool.end()
  }
}

// تشغيل النقل
migrateToNeon()
  .then(() => {
    console.log("\n✅ تمت عملية النقل بنجاح!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ فشلت عملية النقل:", error)
    process.exit(1)
  })
