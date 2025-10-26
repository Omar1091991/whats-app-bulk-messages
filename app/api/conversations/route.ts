import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

let conversationsCache: {
  data: any[]
  timestamp: number
} | null = null

const CACHE_DURATION = 30000 // 30 ثانية

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get("limit")
  const limit = limitParam ? Number.parseInt(limitParam) : null
  const offset = Number.parseInt(searchParams.get("offset") || "0")
  const filter = searchParams.get("filter") || "all"

  const supabaseClient = await createClient()
  return await buildConversationsDynamically(supabaseClient, limit, offset, filter)
}

async function fetchAllRecords(supabaseClient: any, tableName: string, selectFields: string, orderBy: string) {
  const allRecords: any[] = []
  let from = 0
  const batchSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select(selectFields)
      .order(orderBy, { ascending: false })
      .range(from, from + batchSize - 1)

    if (error) {
      console.error(`[v0] Error fetching from ${tableName}:`, error)
      throw error
    }

    if (data && data.length > 0) {
      allRecords.push(...data)

      if (data.length < batchSize) {
        hasMore = false
      } else {
        from += batchSize
      }
    } else {
      hasMore = false
    }
  }

  return allRecords
}

async function buildConversationsDynamically(
  supabaseClient: any,
  limit: number | null,
  offset: number,
  filter: string,
) {
  try {
    const now = Date.now()
    let allConversations: any[]

    if (conversationsCache && now - conversationsCache.timestamp < CACHE_DURATION) {
      console.log("[v0] Cached conversations:", conversationsCache.data.length)
      allConversations = conversationsCache.data
    } else {
      console.log("[v0] Fetching fresh conversations data...")

      const incomingMessages = await fetchAllRecords(
        supabaseClient,
        "webhook_messages",
        "from_number, from_name, message_text, timestamp, replied, status",
        "timestamp",
      )

      const outgoingMessages = await fetchAllRecords(
        supabaseClient,
        "message_history",
        "to_number, message_text, created_at, status",
        "created_at",
      )

      const conversationsMap = new Map<string, any>()

      for (const msg of incomingMessages || []) {
        const normalizedPhone = normalizePhoneNumber(msg.from_number)
        const existing = conversationsMap.get(normalizedPhone)

        if (!existing || new Date(msg.timestamp) > new Date(existing.last_message_time)) {
          const isRead = msg.status === "read"
          const hasReplied = msg.replied === true

          conversationsMap.set(normalizedPhone, {
            phone_number: msg.from_number,
            contact_name: msg.from_name || msg.from_number,
            last_message_text: msg.message_text,
            last_message_time: msg.timestamp,
            last_message_is_outgoing: false,
            unread_count: isRead ? 0 : 1,
            is_read: isRead,
            has_replied: hasReplied,
            updated_at: msg.timestamp,
            has_incoming_messages: true,
          })
        }
      }

      // معالجة الرسائل الصادرة
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
            has_replied: existing?.has_replied || false,
            updated_at: msg.created_at,
            has_incoming_messages: existing?.has_incoming_messages || false,
          })
        }
      }

      allConversations = Array.from(conversationsMap.values()).sort(
        (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime(),
      )

      conversationsCache = {
        data: allConversations,
        timestamp: now,
      }

      console.log(`[v0] Cached ${allConversations.length} conversations`)
    }

    let filteredConversations = allConversations

    if (filter === "unread") {
      // فلتر "الغير مقروء": الرسائل الواردة التي لم يتم قراءتها
      filteredConversations = allConversations.filter((conv) => !conv.is_read && conv.unread_count > 0)
    } else if (filter === "conversations") {
      // فلتر "المحادثات": الرسائل الواردة التي تم الرد عليها
      filteredConversations = allConversations.filter((conv) => conv.has_incoming_messages && conv.has_replied)
    }

    const totalConversations = filteredConversations.length

    const paginatedConversations =
      limit !== null ? filteredConversations.slice(offset, offset + limit) : filteredConversations.slice(offset)

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
    console.error("[v0] Error building conversations:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
