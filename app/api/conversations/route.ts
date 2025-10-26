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

  const neonClient = await createClient()
  return await buildConversationsDynamically(neonClient, limit, offset)
}

async function buildConversationsDynamically(neonClient: any, limit: number, offset: number) {
  try {
    const { rows: conversations, error } = await neonClient.query(
      `
      WITH incoming_latest AS (
        SELECT DISTINCT ON (REGEXP_REPLACE(from_number, '[^0-9]', '', 'g'))
          REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') as normalized_phone,
          from_number as phone_number,
          COALESCE(from_name, from_number) as contact_name,
          message_text,
          to_timestamp(timestamp) as message_time,
          false as is_outgoing,
          NOT replied as is_unread
        FROM webhook_messages
        ORDER BY REGEXP_REPLACE(from_number, '[^0-9]', '', 'g'), 
                 to_timestamp(timestamp) DESC
      ),
      outgoing_latest AS (
        SELECT DISTINCT ON (REGEXP_REPLACE(to_number, '[^0-9]', '', 'g'))
          REGEXP_REPLACE(to_number, '[^0-9]', '', 'g') as normalized_phone,
          to_number as phone_number,
          to_number as contact_name,
          message_text,
          created_at as message_time,
          true as is_outgoing,
          false as is_unread
        FROM message_history
        ORDER BY REGEXP_REPLACE(to_number, '[^0-9]', '', 'g'), created_at DESC
      ),
      combined AS (
        SELECT * FROM incoming_latest
        UNION ALL
        SELECT * FROM outgoing_latest
      ),
      latest_per_phone AS (
        SELECT DISTINCT ON (normalized_phone)
          normalized_phone,
          phone_number,
          contact_name,
          message_text,
          message_time,
          is_outgoing,
          is_unread
        FROM combined
        ORDER BY normalized_phone, message_time DESC
      ),
      unread_counts AS (
        SELECT 
          REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') as normalized_phone,
          COUNT(*) FILTER (WHERE NOT replied) as unread_count
        FROM webhook_messages
        GROUP BY REGEXP_REPLACE(from_number, '[^0-9]', '', 'g')
      )
      SELECT 
        l.phone_number,
        l.contact_name,
        COALESCE(l.message_text, '') as last_message_text,
        l.message_time as last_message_time,
        l.is_outgoing as last_message_is_outgoing,
        COALESCE(u.unread_count, 0)::int as unread_count,
        l.message_time as updated_at,
        NOT l.is_unread as is_read
      FROM latest_per_phone l
      LEFT JOIN unread_counts u ON l.normalized_phone = u.normalized_phone
      ORDER BY l.message_time DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset],
    )

    if (error) {
      console.error("[v0] Error fetching conversations:", error)
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 })
    }

    const formattedConversations = (conversations || []).map((conv: any) => ({
      phone_number: conv.phone_number,
      contact_name: conv.contact_name,
      last_message_text: conv.last_message_text,
      last_message_time: new Date(conv.last_message_time).toISOString(),
      last_message_is_outgoing: conv.last_message_is_outgoing,
      unread_count: conv.unread_count,
      is_read: conv.is_read,
      updated_at: new Date(conv.updated_at).toISOString(),
    }))

    const hasMore = conversations.length === limit

    return NextResponse.json(
      {
        conversations: formattedConversations,
        hasMore,
        nextOffset: offset + limit,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Unexpected error building conversations:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
