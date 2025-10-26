import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

let conversationsCache: {
  data: any[]
  timestamp: number
} | null = null

const CACHE_DURATION = 60000 // 1 دقيقة

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get("limit")
  const limit = limitParam ? Number.parseInt(limitParam) : null
  const offset = Number.parseInt(searchParams.get("offset") || "0")

  const supabaseClient = await createClient()
  return await buildConversationsDynamically(supabaseClient, limit, offset)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchAllRecords(
  supabaseClient: any,
  tableName: string,
  selectFields: string,
  orderBy: string,
  maxRecords = 50000,
) {
  const allRecords: any[] = []
  let from = 0
  const batchSize = 1000
  let hasMore = true

  try {
    while (hasMore && allRecords.length < maxRecords) {
      if (from > 0) {
        await delay(300)
      }

      const { data, error } = await supabaseClient
        .from(tableName)
        .select(selectFields)
        .order(orderBy, { ascending: false })
        .range(from, from + batchSize - 1)

      if (error) {
        console.error(`[v0] Error fetching from ${tableName}:`, error)
        break
      }

      if (data && data.length > 0) {
        allRecords.push(...data)

        if (data.length < batchSize || allRecords.length >= maxRecords) {
          hasMore = false
        } else {
          from += batchSize
        }
      } else {
        hasMore = false
      }
    }
  } catch (error) {
    console.error(`[v0] Unexpected error in fetchAllRecords for ${tableName}:`, error)
  }

  return allRecords
}

async function buildConversationsDynamically(supabaseClient: any, limit: number | null, offset: number) {
  try {
    const now = Date.now()
    let allConversations: any[]

    if (conversationsCache && now - conversationsCache.timestamp < CACHE_DURATION) {
      console.log("[v0] Using cached conversations")
      allConversations = conversationsCache.data
    } else {
      console.log("[v0] Fetching fresh conversations data...")
      try {
        const incomingMessages = await fetchAllRecords(
          supabaseClient,
          "webhook_messages",
          "from_number, from_name, message_text, timestamp, replied, status",
          "timestamp",
          50000,
        )

        console.log(`[v0] Fetched ${incomingMessages.length} incoming messages`)

        const outgoingMessages = await fetchAllRecords(
          supabaseClient,
          "message_history",
          "to_number, message_text, created_at, status",
          "created_at",
          50000,
        )

        console.log(`[v0] Fetched ${outgoingMessages.length} outgoing messages`)

        const conversationsMap = new Map<string, any>()

        for (const msg of incomingMessages || []) {
          const normalizedPhone = normalizePhoneNumber(msg.from_number)
          const existing = conversationsMap.get(normalizedPhone)

          if (!existing || new Date(msg.timestamp) > new Date(existing.last_message_time)) {
            const isRead = msg.status === "read"
            const hasReplied = msg.replied === true

            const messageText = msg.message_text?.trim() || "رسالة واردة"

            conversationsMap.set(normalizedPhone, {
              phone_number: msg.from_number,
              contact_name: msg.from_name || msg.from_number,
              last_message_text: messageText,
              last_incoming_message_text: messageText, // حفظ آخر رسالة واردة
              last_incoming_message_time: msg.timestamp, // حفظ وقت آخر رسالة واردة
              last_message_time: msg.timestamp,
              last_message_is_outgoing: false,
              unread_count: isRead ? 0 : 1,
              is_read: isRead,
              has_replied: hasReplied,
              updated_at: msg.timestamp,
              has_incoming_messages: true,
            })
          } else if (existing && new Date(msg.timestamp) > new Date(existing.last_incoming_message_time || 0)) {
            // تحديث آخر رسالة واردة فقط إذا كانت أحدث
            const messageText = msg.message_text?.trim() || "رسالة واردة"
            existing.last_incoming_message_text = messageText
            existing.last_incoming_message_time = msg.timestamp
          }
        }

        for (const msg of outgoingMessages || []) {
          const normalizedPhone = normalizePhoneNumber(msg.to_number)
          const existing = conversationsMap.get(normalizedPhone)

          const messageText = msg.message_text?.trim() || "رسالة صادرة"

          if (!existing) {
            conversationsMap.set(normalizedPhone, {
              phone_number: msg.to_number,
              contact_name: msg.to_number,
              last_message_text: messageText,
              last_incoming_message_text: null, // لا توجد رسالة واردة
              last_incoming_message_time: null,
              last_message_time: msg.created_at,
              last_message_is_outgoing: true,
              unread_count: 0,
              is_read: true,
              has_replied: false,
              updated_at: msg.created_at,
              has_incoming_messages: false,
            })
          } else if (new Date(msg.created_at) > new Date(existing.last_message_time)) {
            // تحديث آخر رسالة بشكل عام للترتيب، لكن الاحتفاظ بآخر رسالة واردة
            existing.last_message_text = messageText
            existing.last_message_time = msg.created_at
            existing.last_message_is_outgoing = true
            existing.updated_at = msg.created_at
            // لا نستبدل last_incoming_message_text هنا
          }
        }

        allConversations = Array.from(conversationsMap.values()).sort(
          (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime(),
        )

        console.log(`[v0] Built ${allConversations.length} conversations`)

        conversationsCache = {
          data: allConversations,
          timestamp: now,
        }
      } catch (fetchError) {
        console.error("[v0] Error fetching conversations:", fetchError)
        if (conversationsCache) {
          console.log("[v0] Using stale cache due to fetch error")
          allConversations = conversationsCache.data
        } else {
          return NextResponse.json(
            {
              conversations: [],
              hasMore: false,
              nextOffset: 0,
              total: 0,
              loaded: 0,
              error: "Failed to fetch conversations",
            },
            { status: 200 },
          )
        }
      }
    }

    const totalConversations = allConversations.length

    const paginatedConversations =
      limit !== null ? allConversations.slice(offset, offset + limit) : allConversations.slice(offset)

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
    return NextResponse.json(
      {
        conversations: [],
        hasMore: false,
        nextOffset: 0,
        total: 0,
        loaded: 0,
        error: "Internal Server Error",
      },
      { status: 200 },
    )
  }
}
