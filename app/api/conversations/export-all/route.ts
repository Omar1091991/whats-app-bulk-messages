import { NextResponse } from "next/server"
import { createClient } from "@/lib/neon/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "json"
  const filter = searchParams.get("filter") || "all"

  try {
    const neonClient = await createClient()

    // جلب جميع المحادثات
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
    `,
    )

    if (format === "csv") {
      // تصدير CSV
      const csvHeader = "رقم الهاتف,اسم جهة الاتصال,آخر رسالة,وقت آخر رسالة,عدد الرسائل غير المقروءة,نوع آخر رسالة\n"
      const csvRows = conversations
        .map((conv: any) => {
          const phoneNumber = conv.phone_number
          const contactName = conv.contact_name.replace(/,/g, " ")
          const lastMessage = (conv.last_message_text || "").replace(/,/g, " ").replace(/\n/g, " ")
          const lastMessageTime = new Date(conv.last_message_time).toLocaleString("ar-SA")
          const unreadCount = conv.unread_count
          const messageType = conv.last_message_is_outgoing ? "صادرة" : "واردة"

          return `${phoneNumber},${contactName},${lastMessage},${lastMessageTime},${unreadCount},${messageType}`
        })
        .join("\n")

      const csv = csvHeader + csvRows

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="conversations-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      })
    } else {
      // تصدير JSON
      const formattedConversations = conversations.map((conv: any) => ({
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

      return NextResponse.json(
        {
          exported_at: new Date().toISOString(),
          total_conversations: formattedConversations.length,
          filter: filter,
          conversations: formattedConversations,
        },
        {
          headers: {
            "Content-Disposition": `attachment; filename="conversations-${new Date().toISOString().split("T")[0]}.json"`,
          },
        },
      )
    }
  } catch (error) {
    console.error("[v0] Error exporting conversations:", error)
    return NextResponse.json({ error: "فشل في تصدير المحادثات" }, { status: 500 })
  }
}
