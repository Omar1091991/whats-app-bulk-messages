import { NextResponse } from "next/server"
import { createClient } from "@/lib/neon/server"

export const dynamic = "force-dynamic"

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Number.parseInt(searchParams.get("limit") || "20")
  const offset = Number.parseInt(searchParams.get("offset") || "0")
  const filter = searchParams.get("filter") || "all"

  console.log("[v0] API - Fetching conversations with limit:", limit, "offset:", offset, "filter:", filter)

  const neonClient = await createClient()
  return await buildConversationsDynamically(neonClient, limit, offset, filter)
}

async function buildConversationsDynamically(neonClient: any, limit: number, offset: number, filter: string) {
  try {
    const { rows: countRows } = await neonClient.query(`
      WITH all_phones AS (
        SELECT DISTINCT REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') as normalized_phone
        FROM webhook_messages
        UNION
        SELECT DISTINCT REGEXP_REPLACE(to_number, '[^0-9]', '', 'g') as normalized_phone
        FROM message_history
      )
      SELECT COUNT(*) as total FROM all_phones
    `)

    const totalConversations = Number.parseInt(countRows[0]?.total || "0")
    console.log("[v0] API - Total conversations in database:", totalConversations)

    const { rows: conversations } = await neonClient.query(
      `
      WITH all_messages AS (
        SELECT 
          REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') as normalized_phone,
          from_number as phone_number,
          COALESCE(from_name, from_number) as contact_name,
          message_text,
          to_timestamp(timestamp) as message_time,
          false as is_outgoing,
          NOT replied as is_unread,
          'incoming' as source
        FROM webhook_messages
        
        UNION ALL
        
        SELECT 
          REGEXP_REPLACE(to_number, '[^0-9]', '', 'g') as normalized_phone,
          to_number as phone_number,
          to_number as contact_name,
          message_text,
          created_at as message_time,
          true as is_outgoing,
          false as is_unread,
          'outgoing' as source
        FROM message_history
      ),
      latest_per_phone AS (
        SELECT DISTINCT ON (normalized_phone)
          normalized_phone,
          phone_number,
          contact_name,
          message_text,
          message_time,
          is_outgoing,
          is_unread,
          source
        FROM all_messages
        ORDER BY normalized_phone, message_time DESC
      ),
      unread_counts AS (
        SELECT 
          REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') as normalized_phone,
          COUNT(*) FILTER (WHERE NOT replied) as unread_count
        FROM webhook_messages
        GROUP BY REGEXP_REPLACE(from_number, '[^0-9]', '', 'g')
      ),
      has_incoming AS (
        SELECT DISTINCT
          REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') as normalized_phone,
          true as has_incoming_messages
        FROM webhook_messages
      )
      SELECT 
        l.phone_number,
        l.contact_name,
        COALESCE(l.message_text, '') as last_message_text,
        l.message_time as last_message_time,
        l.is_outgoing as last_message_is_outgoing,
        COALESCE(u.unread_count, 0)::int as unread_count,
        l.message_time as updated_at,
        NOT l.is_unread as is_read,
        COALESCE(h.has_incoming_messages, false) as has_incoming_messages
      FROM latest_per_phone l
      LEFT JOIN unread_counts u ON l.normalized_phone = u.normalized_phone
      LEFT JOIN has_incoming h ON l.normalized_phone = h.normalized_phone
      ${filter === "unread" ? "WHERE COALESCE(u.unread_count, 0) > 0" : ""}
      ${filter === "conversations" ? "WHERE COALESCE(h.has_incoming_messages, false) = true" : ""}
      ORDER BY l.message_time DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset],
    )

    console.log("[v0] API - Fetched", conversations?.length || 0, "conversations at offset", offset)

    const formattedConversations = (conversations || []).map((conv: any) => ({
      phone_number: conv.phone_number,
      contact_name: conv.contact_name,
      last_message_text: conv.last_message_text,
      last_message_time: new Date(conv.last_message_time).toISOString(),
      last_message_is_outgoing: conv.last_message_is_outgoing,
      unread_count: conv.unread_count,
      is_read: conv.is_read,
      updated_at: new Date(conv.updated_at).toISOString(),
      has_incoming_messages: conv.has_incoming_messages,
    }))

    const hasMore = offset + conversations.length < totalConversations

    console.log("[v0] API - Returning hasMore:", hasMore, "loaded so far:", offset + conversations.length)

    return NextResponse.json(
      {
        conversations: formattedConversations,
        hasMore,
        nextOffset: offset + limit,
        total: totalConversations,
        loaded: offset + conversations.length,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] API - Error building conversations:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
