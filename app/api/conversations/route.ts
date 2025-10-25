import { NextResponse } from "next/server"
import { createClient } from "@/lib/neon/server"

export const dynamic = "force-dynamic"

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

export async function GET() {
  const neonClient = await createClient()
  return await buildConversationsDynamically(neonClient)
}

async function buildConversationsDynamically(neonClient: any) {
  try {
    // Fetch incoming messages
    const { rows: incomingMessages, error: incomingError } = await neonClient.query(
      "SELECT * FROM webhook_messages ORDER BY timestamp DESC",
    )

    if (incomingError) {
      console.error("[v0] Error fetching incoming messages:", incomingError)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    // Fetch sent messages
    const { rows: sentMessages, error: sentError } = await neonClient.query(
      "SELECT * FROM message_history ORDER BY created_at DESC",
    )

    if (sentError) {
      console.error("[v0] Error fetching sent messages:", sentError)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    const conversationsMap = new Map()

    if (incomingMessages) {
      for (const message of incomingMessages) {
        const normalizedPhone = normalizePhoneNumber(message.from_number)
        const messageTime = message.timestamp
          ? new Date(
              typeof message.timestamp === "number" ? message.timestamp * 1000 : Number.parseInt(message.timestamp),
            )
          : new Date(message.created_at)

        if (!conversationsMap.has(normalizedPhone)) {
          conversationsMap.set(normalizedPhone, {
            phone_number: message.from_number,
            contact_name: message.from_name || message.from_number,
            last_message_text: message.message_text || "",
            last_message_time: messageTime.toISOString(),
            last_message_is_outgoing: false,
            unread_count: message.replied ? 0 : 1,
            has_incoming_messages: true,
            has_replies: false,
            is_read: message.replied || false,
            updated_at: messageTime.toISOString(),
          })
        } else {
          const conv = conversationsMap.get(normalizedPhone)
          conv.has_incoming_messages = true
          if (!message.replied) {
            conv.unread_count = (conv.unread_count || 0) + 1
          }
          if (messageTime > new Date(conv.last_message_time)) {
            conv.last_message_text = message.message_text || ""
            conv.last_message_time = messageTime.toISOString()
            conv.last_message_is_outgoing = false
            conv.updated_at = messageTime.toISOString()
          }
        }
      }
    }

    if (sentMessages) {
      for (const message of sentMessages) {
        const normalizedPhone = normalizePhoneNumber(message.to_number)
        const messageTime = new Date(message.created_at)

        if (!conversationsMap.has(normalizedPhone)) {
          conversationsMap.set(normalizedPhone, {
            phone_number: message.to_number,
            contact_name: message.to_number,
            last_message_text: message.message_text || "",
            last_message_time: messageTime.toISOString(),
            last_message_is_outgoing: true,
            unread_count: 0,
            has_incoming_messages: false,
            has_replies: true,
            is_read: true,
            updated_at: messageTime.toISOString(),
          })
        } else {
          const conv = conversationsMap.get(normalizedPhone)
          conv.has_replies = true
          if (messageTime > new Date(conv.last_message_time)) {
            conv.last_message_text = message.message_text || ""
            conv.last_message_time = messageTime.toISOString()
            conv.last_message_is_outgoing = true
            conv.updated_at = messageTime.toISOString()
          }
        }
      }
    }

    // Convert map to array and sort by updated_at
    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )

    return NextResponse.json({ conversations }, { status: 200 })
  } catch (error) {
    console.error("[v0] Unexpected error building conversations dynamically:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
