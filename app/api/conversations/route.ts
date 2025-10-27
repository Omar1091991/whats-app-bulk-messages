import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

let conversationsCache: {
  data: any[]
  timestamp: number
} | null = null

const CACHE_DURATION = 60000 // تقليل cache من 5 دقائق إلى 1 دقيقة لضمان تحديث البيانات بشكل أسرع

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
  retryCount = 0,
) {
  const allRecords: any[] = []
  let from = 0
  const batchSize = 1000
  let hasMore = true

  try {
    while (hasMore && allRecords.length < maxRecords) {
      if (from > 0) {
        await delay(500) // زيادة التأخير من 300ms إلى 500ms
      }

      try {
        const { data, error } = await supabaseClient
          .from(tableName)
          .select(selectFields)
          .order(orderBy, { ascending: false })
          .range(from, from + batchSize - 1)

        if (error) {
          if (error.message?.includes("Too Many") || error.code === "429") {
            if (retryCount < 3) {
              const backoffDelay = Math.pow(2, retryCount) * 2000 // 2s, 4s, 8s
              console.log(`[v0] Rate limit hit for ${tableName}, retrying in ${backoffDelay}ms...`)
              await delay(backoffDelay)
              return fetchAllRecords(supabaseClient, tableName, selectFields, orderBy, maxRecords, retryCount + 1)
            } else {
              console.error(`[v0] Max retries reached for ${tableName}`)
              break
            }
          }
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
      } catch (fetchError: any) {
        if (fetchError.message?.includes("Too Many") || fetchError.message?.includes("not valid JSON")) {
          if (retryCount < 3) {
            const backoffDelay = Math.pow(2, retryCount) * 2000
            console.log(`[v0] Rate limit or JSON error for ${tableName}, retrying in ${backoffDelay}ms...`)
            await delay(backoffDelay)
            return fetchAllRecords(supabaseClient, tableName, selectFields, orderBy, maxRecords, retryCount + 1)
          } else {
            console.error(`[v0] Max retries reached for ${tableName}`)
            break
          }
        }
        throw fetchError
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
              last_incoming_message_text: messageText,
              last_incoming_message_time: msg.timestamp,
              last_message_time: msg.timestamp,
              last_message_is_outgoing: false,
              unread_count: isRead ? 0 : 1, // تُعتبر غير مقروءة إذا لم يكن status = "read"
              is_read: isRead,
              has_replied: hasReplied,
              updated_at: msg.timestamp,
              has_incoming_messages: true,
            })
          } else if (existing) {
            // تحديث آخر رسالة واردة إذا كانت أحدث
            if (new Date(msg.timestamp) > new Date(existing.last_incoming_message_time || 0)) {
              const messageText = msg.message_text?.trim() || "رسالة واردة"
              existing.last_incoming_message_text = messageText
              existing.last_incoming_message_time = msg.timestamp
            }

            if (msg.replied === true) {
              existing.has_replied = true
            }

            // تُعتبر غير مقروءة إذا status !== "read" فقط
            if (msg.status !== "read") {
              existing.unread_count = (existing.unread_count || 0) + 1
            }
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
              last_incoming_message_text: null,
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
            existing.last_message_text = messageText
            existing.last_message_time = msg.created_at
            existing.last_message_is_outgoing = true
            existing.updated_at = msg.created_at
          }
        }

        allConversations = Array.from(conversationsMap.values()).sort((a, b) => {
          const aTime = a.last_incoming_message_time || a.last_message_time
          const bTime = b.last_incoming_message_time || b.last_message_time
          return new Date(bTime).getTime() - new Date(aTime).getTime()
        })

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
