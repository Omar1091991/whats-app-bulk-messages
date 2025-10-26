import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "json"
  const filter = searchParams.get("filter") || "all"

  try {
    const supabaseClient = await createClient()

    // جلب جميع المحادثات
    const { data: conversations, error } = await supabaseClient
      .from("webhook_messages")
      .select(
        `
          REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') as normalized_phone,
          from_number as phone_number,
          COALESCE(from_name, from_number) as contact_name,
          message_text,
          to_timestamp(timestamp) as message_time,
          false as is_outgoing,
          NOT replied as is_unread,
          'incoming' as source
        `,
      )
      .union(
        supabaseClient.from("message_history").select(
          `
              REGEXP_REPLACE(to_number, '[^0-9]', '', 'g') as normalized_phone,
              to_number as phone_number,
              to_number as contact_name,
              message_text,
              created_at as message_time,
              true as is_outgoing,
              false as is_unread,
              'outgoing' as source
            `,
        ),
      )
      .then(({ data }) => {
        return supabaseClient
          .from("all_messages")
          .select(
            `
              normalized_phone,
              phone_number,
              contact_name,
              message_text,
              message_time,
              is_outgoing,
              is_unread,
              source
            `,
          )
          .distinct("normalized_phone")
          .order("message_time", { ascending: false })
          .then(({ data }) => {
            return data
          })
      })

    if (error) {
      throw error
    }

    const unreadCounts = await supabaseClient
      .from("webhook_messages")
      .select(
        `
          REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') as normalized_phone,
          COUNT(*) FILTER (WHERE NOT replied) as unread_count
        `,
      )
      .groupBy("normalized_phone")

    const hasIncoming = await supabaseClient
      .from("webhook_messages")
      .select(
        `
          REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') as normalized_phone,
          true as has_incoming_messages
        `,
      )
      .distinct("normalized_phone")

    const formattedConversations = conversations.map((conv: any) => {
      const unreadCount =
        unreadCounts.find((uc: any) => uc.normalized_phone === conv.normalized_phone)?.unread_count || 0
      const hasIncomingMessages = hasIncoming.some((hi: any) => hi.normalized_phone === conv.normalized_phone)

      return {
        phone_number: conv.phone_number,
        contact_name: conv.contact_name,
        last_message_text: conv.message_text,
        last_message_time: new Date(conv.message_time).toISOString(),
        last_message_is_outgoing: conv.is_outgoing,
        unread_count: unreadCount,
        is_read: !conv.is_unread,
        updated_at: new Date(conv.message_time).toISOString(),
        has_incoming_messages: hasIncomingMessages,
      }
    })

    const filteredConversations = formattedConversations.filter((conv: any) => {
      if (filter === "unread") {
        return conv.unread_count > 0
      }
      if (filter === "conversations") {
        return conv.has_incoming_messages
      }
      return true
    })

    if (format === "csv") {
      // تصدير CSV
      const csvHeader = "رقم الهاتف,اسم جهة الاتصال,آخر رسالة,وقت آخر رسالة,عدد الرسائل غير المقروءة,نوع آخر رسالة\n"
      const csvRows = filteredConversations
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
      return NextResponse.json(
        {
          exported_at: new Date().toISOString(),
          total_conversations: filteredConversations.length,
          filter: filter,
          conversations: filteredConversations,
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
