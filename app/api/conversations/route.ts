import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

let conversationsCache: {
  data: any[]
  timestamp: number
} | null = null

const CACHE_DURATION = 2000 // تقليل cache من 10 ثوانٍ إلى 2 ثانية فقط للتحديث الفوري

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

        // دمج جميع الرسائل (واردة وصادرة) في مصفوفة واحدة مع نوع الرسالة
        const allMessages: Array<{
          phone: string
          name: string | null
          text: string | null
          timestamp: string
          type: "incoming" | "outgoing"
          status: string
          replied: boolean
        }> = []

        // إضافة الرسائل الواردة
        for (const msg of incomingMessages || []) {
          allMessages.push({
            phone: msg.from_number,
            name: msg.from_name,
            text: msg.message_text,
            timestamp: msg.timestamp,
            type: "incoming",
            status: msg.status,
            replied: msg.replied === true,
          })
        }

        // إضافة الرسائل الصادرة
        for (const msg of outgoingMessages || []) {
          allMessages.push({
            phone: msg.to_number,
            name: null,
            text: msg.message_text,
            timestamp: msg.created_at,
            type: "outgoing",
            status: msg.status || "sent",
            replied: false,
          })
        }

        // ترتيب جميع الرسائل حسب الوقت
        allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

        // بناء المحادثات من جميع الرسائل
        for (const msg of allMessages) {
          const normalizedPhone = normalizePhoneNumber(msg.phone)
          const existing = conversationsMap.get(normalizedPhone)

          const messageText = msg.text?.trim() || (msg.type === "incoming" ? "رسالة واردة" : "رسالة صادرة")

          if (!existing) {
            // إنشاء محادثة جديدة
            conversationsMap.set(normalizedPhone, {
              phone_number: msg.phone,
              contact_name: msg.name || msg.phone,
              last_message_text: messageText,
              last_incoming_message_text: msg.type === "incoming" ? messageText : null,
              last_incoming_message_time: msg.type === "incoming" ? msg.timestamp : null,
              last_message_time: msg.timestamp, // آخر رسالة (واردة أو صادرة)
              last_message_is_outgoing: msg.type === "outgoing",
              unread_count: msg.type === "incoming" && msg.status !== "read" ? 1 : 0,
              is_read: msg.type === "incoming" ? msg.status === "read" : true,
              has_replied: msg.type === "incoming" ? msg.replied : false,
              updated_at: msg.timestamp,
              has_incoming_messages: msg.type === "incoming",
            })
          } else {
            // تحديث محادثة موجودة
            // تحديث آخر رسالة (واردة أو صادرة) دائماً
            existing.last_message_text = messageText
            existing.last_message_time = msg.timestamp
            existing.last_message_is_outgoing = msg.type === "outgoing"
            existing.updated_at = msg.timestamp

            if (msg.type === "incoming") {
              // تحديث آخر رسالة واردة
              existing.last_incoming_message_text = messageText
              existing.last_incoming_message_time = msg.timestamp
              existing.has_incoming_messages = true

              if (msg.replied) {
                existing.has_replied = true
              }

              // زيادة عداد غير المقروءة فقط إذا status !== "read"
              if (msg.status !== "read") {
                existing.unread_count = (existing.unread_count || 0) + 1
                existing.is_read = false
              }
            }
          }
        }

        // ترتيب المحادثات حسب آخر رسالة (واردة أو صادرة)
        allConversations = Array.from(conversationsMap.values()).sort((a, b) => {
          return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
        })

        console.log(`[v0] Built ${allConversations.length} conversations`)

        if (allConversations.length > 0) {
          console.log("[v0] Sample conversations with last_message_time:")
          allConversations.slice(0, 3).forEach((conv, idx) => {
            console.log(`[v0] Conversation ${idx + 1}: ${conv.contact_name} (${conv.phone_number})`)
            console.log(`[v0]   last_message_time: ${conv.last_message_time}`)
            console.log(`[v0]   last_message_text: ${conv.last_message_text?.substring(0, 50)}...`)
            console.log(`[v0]   last_message_is_outgoing: ${conv.last_message_is_outgoing}`)
          })
        }

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
