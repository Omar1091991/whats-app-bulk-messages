/**
 * Migration script to copy data from Supabase to Neon
 * This script connects to both databases and copies all data
 */

import { neon } from "@neondatabase/serverless"

async function migrateData() {
  console.log("🚀 Starting migration from Supabase to Neon...")

  // Connect to Supabase (source)
  const supabaseUrl = process.env.POSTGRES_URL!
  const supabaseClient = neon(supabaseUrl)

  // Connect to Neon (destination)
  const neonUrl = process.env.NEON_NEON_DATABASE_URL!
  const neonClient = neon(neonUrl)

  try {
    // 1. Migrate api_settings
    console.log("📋 Migrating api_settings...")
    const apiSettings = await supabaseClient`SELECT * FROM api_settings`
    if (apiSettings.length > 0) {
      for (const row of apiSettings) {
        await neonClient`
          INSERT INTO api_settings (
            id, phone_number_id, business_account_id, access_token,
            webhook_verify_token, created_at, updated_at
          ) VALUES (
            ${row.id}, ${row.phone_number_id}, ${row.business_account_id},
            ${row.access_token}, ${row.webhook_verify_token},
            ${row.created_at}, ${row.updated_at}
          )
          ON CONFLICT (id) DO UPDATE SET
            phone_number_id = EXCLUDED.phone_number_id,
            business_account_id = EXCLUDED.business_account_id,
            access_token = EXCLUDED.access_token,
            webhook_verify_token = EXCLUDED.webhook_verify_token,
            updated_at = EXCLUDED.updated_at
        `
      }
      console.log(`✅ Migrated ${apiSettings.length} api_settings records`)
    }

    // 2. Migrate daily_statistics
    console.log("📊 Migrating daily_statistics...")
    const dailyStats = await supabaseClient`SELECT * FROM daily_statistics`
    if (dailyStats.length > 0) {
      for (const row of dailyStats) {
        await neonClient`
          INSERT INTO daily_statistics (
            id, date, total_sent, single_messages, bulk_instant_messages,
            bulk_scheduled_messages, reply_messages, successful_messages,
            failed_messages, pending_messages, incoming_messages,
            unique_templates, scheduled_pending, scheduled_completed,
            scheduled_failed, created_at, updated_at
          ) VALUES (
            ${row.id}, ${row.date}, ${row.total_sent}, ${row.single_messages},
            ${row.bulk_instant_messages}, ${row.bulk_scheduled_messages},
            ${row.reply_messages}, ${row.successful_messages}, ${row.failed_messages},
            ${row.pending_messages}, ${row.incoming_messages}, ${row.unique_templates},
            ${row.scheduled_pending}, ${row.scheduled_completed}, ${row.scheduled_failed},
            ${row.created_at}, ${row.updated_at}
          )
          ON CONFLICT (id) DO UPDATE SET
            total_sent = EXCLUDED.total_sent,
            single_messages = EXCLUDED.single_messages,
            bulk_instant_messages = EXCLUDED.bulk_instant_messages,
            bulk_scheduled_messages = EXCLUDED.bulk_scheduled_messages,
            reply_messages = EXCLUDED.reply_messages,
            successful_messages = EXCLUDED.successful_messages,
            failed_messages = EXCLUDED.failed_messages,
            pending_messages = EXCLUDED.pending_messages,
            incoming_messages = EXCLUDED.incoming_messages,
            unique_templates = EXCLUDED.unique_templates,
            scheduled_pending = EXCLUDED.scheduled_pending,
            scheduled_completed = EXCLUDED.scheduled_completed,
            scheduled_failed = EXCLUDED.scheduled_failed,
            updated_at = EXCLUDED.updated_at
        `
      }
      console.log(`✅ Migrated ${dailyStats.length} daily_statistics records`)
    }

    // 3. Migrate message_history
    console.log("📨 Migrating message_history...")
    const messageHistory = await supabaseClient`SELECT * FROM message_history`
    if (messageHistory.length > 0) {
      for (const row of messageHistory) {
        await neonClient`
          INSERT INTO message_history (
            id, message_id, to_number, template_name, message_text,
            message_type, media_url, status, error_message,
            created_at, updated_at
          ) VALUES (
            ${row.id}, ${row.message_id}, ${row.to_number}, ${row.template_name},
            ${row.message_text}, ${row.message_type}, ${row.media_url},
            ${row.status}, ${row.error_message}, ${row.created_at}, ${row.updated_at}
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            error_message = EXCLUDED.error_message,
            updated_at = EXCLUDED.updated_at
        `
      }
      console.log(`✅ Migrated ${messageHistory.length} message_history records`)
    }

    // 4. Migrate scheduled_messages
    console.log("⏰ Migrating scheduled_messages...")
    const scheduledMessages = await supabaseClient`SELECT * FROM scheduled_messages`
    if (scheduledMessages.length > 0) {
      for (const row of scheduledMessages) {
        await neonClient`
          INSERT INTO scheduled_messages (
            id, template_name, phone_numbers, template_params,
            scheduled_time, status, total_numbers, sent_count,
            failed_count, processed_at, error_message, media_id,
            media_url, media_type, created_at, updated_at
          ) VALUES (
            ${row.id}, ${row.template_name}, ${row.phone_numbers},
            ${row.template_params}, ${row.scheduled_time}, ${row.status},
            ${row.total_numbers}, ${row.sent_count}, ${row.failed_count},
            ${row.processed_at}, ${row.error_message}, ${row.media_id},
            ${row.media_url}, ${row.media_type}, ${row.created_at}, ${row.updated_at}
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            sent_count = EXCLUDED.sent_count,
            failed_count = EXCLUDED.failed_count,
            processed_at = EXCLUDED.processed_at,
            error_message = EXCLUDED.error_message,
            updated_at = EXCLUDED.updated_at
        `
      }
      console.log(`✅ Migrated ${scheduledMessages.length} scheduled_messages records`)
    }

    // 5. Migrate uploaded_media
    console.log("🖼️  Migrating uploaded_media...")
    const uploadedMedia = await supabaseClient`SELECT * FROM uploaded_media`
    if (uploadedMedia.length > 0) {
      for (const row of uploadedMedia) {
        await neonClient`
          INSERT INTO uploaded_media (
            id, media_id, filename, mime_type, file_size,
            media_url, preview_url, uploaded_at, created_at
          ) VALUES (
            ${row.id}, ${row.media_id}, ${row.filename}, ${row.mime_type},
            ${row.file_size}, ${row.media_url}, ${row.preview_url},
            ${row.uploaded_at}, ${row.created_at}
          )
          ON CONFLICT (id) DO NOTHING
        `
      }
      console.log(`✅ Migrated ${uploadedMedia.length} uploaded_media records`)
    }

    // 6. Migrate webhook_messages
    console.log("💬 Migrating webhook_messages...")
    const webhookMessages = await supabaseClient`SELECT * FROM webhook_messages`
    if (webhookMessages.length > 0) {
      for (const row of webhookMessages) {
        await neonClient`
          INSERT INTO webhook_messages (
            id, message_id, from_number, from_name, message_text,
            message_type, message_media_url, message_media_mime_type,
            timestamp, status, replied, reply_text, reply_sent_at,
            created_at
          ) VALUES (
            ${row.id}, ${row.message_id}, ${row.from_number}, ${row.from_name},
            ${row.message_text}, ${row.message_type}, ${row.message_media_url},
            ${row.message_media_mime_type}, ${row.timestamp}, ${row.status},
            ${row.replied}, ${row.reply_text}, ${row.reply_sent_at}, ${row.created_at}
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            replied = EXCLUDED.replied,
            reply_text = EXCLUDED.reply_text,
            reply_sent_at = EXCLUDED.reply_sent_at
        `
      }
      console.log(`✅ Migrated ${webhookMessages.length} webhook_messages records`)
    }

    console.log("🎉 Migration completed successfully!")
    console.log("📊 Summary:")
    console.log(`   - api_settings: ${apiSettings.length} records`)
    console.log(`   - daily_statistics: ${dailyStats.length} records`)
    console.log(`   - message_history: ${messageHistory.length} records`)
    console.log(`   - scheduled_messages: ${scheduledMessages.length} records`)
    console.log(`   - uploaded_media: ${uploadedMedia.length} records`)
    console.log(`   - webhook_messages: ${webhookMessages.length} records`)
  } catch (error) {
    console.error("❌ Migration failed:", error)
    throw error
  }
}

// Run migration
migrateData()
  .then(() => {
    console.log("✅ Migration script completed")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Migration script failed:", error)
    process.exit(1)
  })
