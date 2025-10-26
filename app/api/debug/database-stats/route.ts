import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabaseClient = await createClient()

    // Count total records in each table
    const { count: webhookCount, error: webhookError } = await supabaseClient
      .from("webhook_messages")
      .select("*", { count: "exact", head: true })

    const { count: historyCount, error: historyError } = await supabaseClient
      .from("message_history")
      .select("*", { count: "exact", head: true })

    const { count: mediaCount, error: mediaError } = await supabaseClient
      .from("uploaded_media")
      .select("*", { count: "exact", head: true })

    const { count: scheduledCount, error: scheduledError } = await supabaseClient
      .from("scheduled_messages")
      .select("*", { count: "exact", head: true })

    // Get unique phone numbers from webhook_messages
    const { data: incomingPhones, error: incomingError } = await supabaseClient
      .from("webhook_messages")
      .select("from_number")

    // Get unique phone numbers from message_history
    const { data: outgoingPhones, error: outgoingError } = await supabaseClient
      .from("message_history")
      .select("to_number")

    // Calculate unique phone numbers
    const uniqueIncoming = new Set(incomingPhones?.map((p) => p.from_number.replace(/\D/g, "")) || [])
    const uniqueOutgoing = new Set(outgoingPhones?.map((p) => p.to_number.replace(/\D/g, "")) || [])
    const allUniquePhones = new Set([...uniqueIncoming, ...uniqueOutgoing])

    // Check for media storage
    const { data: recentMedia, error: recentMediaError } = await supabaseClient
      .from("uploaded_media")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)

    // Check for recent messages with media
    const { data: messagesWithMedia, error: messagesMediaError } = await supabaseClient
      .from("message_history")
      .select("*")
      .not("media_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(5)

    const stats = {
      tables: {
        webhook_messages: {
          total_records: webhookCount || 0,
          unique_phone_numbers: uniqueIncoming.size,
          error: webhookError?.message,
        },
        message_history: {
          total_records: historyCount || 0,
          unique_phone_numbers: uniqueOutgoing.size,
          error: historyError?.message,
        },
        uploaded_media: {
          total_records: mediaCount || 0,
          recent_uploads: recentMedia?.length || 0,
          error: mediaError?.message,
        },
        scheduled_messages: {
          total_records: scheduledCount || 0,
          error: scheduledError?.message,
        },
      },
      conversations: {
        total_unique_phone_numbers: allUniquePhones.size,
        incoming_only: uniqueIncoming.size - allUniquePhones.size + uniqueIncoming.size,
        outgoing_only: uniqueOutgoing.size - allUniquePhones.size + uniqueOutgoing.size,
        both_directions: allUniquePhones.size,
      },
      media: {
        recent_uploads: recentMedia || [],
        messages_with_media: messagesWithMedia || [],
      },
      database_health: {
        all_queries_successful:
          !webhookError && !historyError && !mediaError && !scheduledError && !incomingError && !outgoingError,
        errors: [webhookError, historyError, mediaError, scheduledError, incomingError, outgoingError].filter(Boolean),
      },
    }

    console.log("[v0] Database Stats:", JSON.stringify(stats, null, 2))

    return NextResponse.json(stats, { status: 200 })
  } catch (error) {
    console.error("[v0] Error fetching database stats:", error)
    return NextResponse.json({ error: "Internal Server Error", details: error }, { status: 500 })
  }
}
