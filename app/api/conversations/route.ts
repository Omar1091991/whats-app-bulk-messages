import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get("limit")
  const limit = limitParam ? Number.parseInt(limitParam) : null
  const offset = Number.parseInt(searchParams.get("offset") || "0")
  const filter = searchParams.get("filter") || "all"

  console.log("[v0] API - Fetching conversations with limit:", limit || "ALL", "offset:", offset, "filter:", filter)

  const supabaseClient = await createClient()
  return await buildConversationsDynamically(supabaseClient, limit, offset, filter)
}

async function fetchAllRecords(supabaseClient: any, tableName: string, selectFields: string, orderBy: string) {
  const allRecords: any[] = []
  let from = 0
  const batchSize = 1000
  let hasMore = true

  console.log(`[v0] API - Starting to fetch all records from ${tableName}...`)

  while (hasMore) {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select(selectFields)
      .order(orderBy, { ascending: false })
      .range(from, from + batchSize - 1)

    if (error) {
      console.error(`[v0] API - Error fetching from ${tableName}:`, error)
      throw error
    }

    if (data && data.length > 0) {
      allRecords.push(...data)
      console.log(`[v0] API - Fetched ${data.length} records from ${tableName} (total so far: ${allRecords.length})`)

      if (data.length < batchSize) {
        hasMore = false
      } else {
        from += batchSize
      }
    } else {
      hasMore = false
    }
  }

  console.log(`[v0] API - Finished fetching ${allRecords.length} total records from ${tableName}`)
  return allRecords
}

async function buildConversationsDynamically(
  supabaseClient: any,
  limit: number | null,
  offset: number,
  filter: string,
) {
  try {
    console.log("[v0] API - Starting to fetch messages from database...")

    const incomingMessages = await fetchAllRecords(
      supabaseClient,
      "webhook_messages",
      "from_number, from_name, message_text, timestamp, replied",
      "timestamp",
    )

    const outgoingMessages = await fetchAllRecords(
      supabaseClient,
      "message_history",
      "to_number, message_text, created_at, status",
      "created_at",
    )

    const conversationsMap = new Map<string, any>()

    // Process incoming messages
    for (const msg of incomingMessages || []) {
      const normalizedPhone = normalizePhoneNumber(msg.from_number)
      const existing = conversationsMap.get(normalizedPhone)

      if (!existing || new Date(msg.timestamp) > new Date(existing.last_message_time)) {
        conversationsMap.set(normalizedPhone, {
          phone_number: msg.from_number,
          contact_name: msg.from_name || msg.from_number,
          last_message_text: msg.message_text,
          last_message_time: msg.timestamp,
          last_message_is_outgoing: false,
          unread_count: msg.replied ? 0 : 1,
          is_read: msg.replied,
          updated_at: msg.timestamp,
          has_incoming_messages: true,
        })
      }
    }

    console.log("[v0] API - After processing incoming messages, conversationsMap size:", conversationsMap.size)

    // Process outgoing messages
    for (const msg of outgoingMessages || []) {
      const normalizedPhone = normalizePhoneNumber(msg.to_number)
      const existing = conversationsMap.get(normalizedPhone)

      if (!existing || new Date(msg.created_at) > new Date(existing.last_message_time)) {
        conversationsMap.set(normalizedPhone, {
          phone_number: msg.to_number,
          contact_name: existing?.contact_name || msg.to_number,
          last_message_text: msg.message_text,
          last_message_time: msg.created_at,
          last_message_is_outgoing: true,
          unread_count: existing?.unread_count || 0,
          is_read: true,
          updated_at: msg.created_at,
          has_incoming_messages: existing?.has_incoming_messages || false,
        })
      }
    }

    console.log("[v0] API - After processing outgoing messages, conversationsMap size:", conversationsMap.size)

    let allConversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime(),
    )

    console.log("[v0] API - Total conversations before filter:", allConversations.length)

    if (filter === "unread") {
      allConversations = allConversations.filter((conv) => !conv.is_read)
    } else if (filter === "conversations") {
      allConversations = allConversations.filter((conv) => conv.has_incoming_messages)
    }

    const totalConversations = allConversations.length
    console.log("[v0] API - Total conversations after filter:", totalConversations, "filter:", filter)

    const paginatedConversations =
      limit !== null ? allConversations.slice(offset, offset + limit) : allConversations.slice(offset)

    console.log(
      "[v0] API - Returning",
      paginatedConversations.length,
      "conversations (offset:",
      offset,
      "limit:",
      limit || "ALL",
      ")",
    )

    const hasMore = limit !== null ? offset + paginatedConversations.length < totalConversations : false

    return NextResponse.json(
      {
        conversations: paginatedConversations,
        hasMore,
        nextOffset: limit !== null ? offset + limit : offset,
        total: totalConversations,
        loaded: paginatedConversations.length,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] API - Error building conversations:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
