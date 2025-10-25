import { NextResponse } from "next/server"
import { createClient } from "@/lib/neon/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get("phone")
    const format = searchParams.get("format") || "json" // json or csv

    const neonClient = await createClient()

    if (phone) {
      // Export specific conversation
      const { rows: messages } = await neonClient.query(
        `SELECT * FROM (
          SELECT 
            message_id,
            from_number,
            from_name,
            message_type,
            message_text,
            message_media_url,
            timestamp,
            'incoming' as type,
            created_at
          FROM webhook_messages
          WHERE from_number = $1
          UNION ALL
          SELECT 
            message_id,
            to_number as from_number,
            to_number as from_name,
            message_type,
            message_text,
            media_url as message_media_url,
            EXTRACT(EPOCH FROM created_at)::bigint as timestamp,
            'outgoing' as type,
            created_at
          FROM message_history
          WHERE to_number = $1
        ) combined
        ORDER BY timestamp ASC`,
        [phone],
      )

      if (format === "csv") {
        // Export as CSV
        const csv = [
          "التاريخ,الوقت,النوع,المرسل,الرسالة,نوع الرسالة",
          ...messages.map((msg: any) => {
            const date = new Date(
              typeof msg.timestamp === "number" ? msg.timestamp * 1000 : msg.created_at,
            ).toLocaleString("ar-SA")
            const type = msg.type === "incoming" ? "وارد" : "صادر"
            const sender = msg.from_name || msg.from_number
            const text = (msg.message_text || "").replace(/"/g, '""')
            const messageType = msg.message_type || "text"
            return `"${date}","${type}","${sender}","${text}","${messageType}"`
          }),
        ].join("\n")

        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="conversation-${phone}.csv"`,
          },
        })
      } else {
        // Export as JSON
        return NextResponse.json(
          {
            phone,
            messages,
            exported_at: new Date().toISOString(),
          },
          {
            headers: {
              "Content-Disposition": `attachment; filename="conversation-${phone}.json"`,
            },
          },
        )
      }
    } else {
      // Export all conversations
      const { rows: allMessages } = await neonClient.query(
        `SELECT * FROM (
          SELECT 
            message_id,
            from_number,
            from_name,
            message_type,
            message_text,
            timestamp,
            'incoming' as type,
            created_at
          FROM webhook_messages
          UNION ALL
          SELECT 
            message_id,
            to_number as from_number,
            to_number as from_name,
            message_type,
            message_text,
            EXTRACT(EPOCH FROM created_at)::bigint as timestamp,
            'outgoing' as type,
            created_at
          FROM message_history
        ) combined
        ORDER BY timestamp DESC`,
      )

      if (format === "csv") {
        const csv = [
          "التاريخ,الوقت,النوع,الرقم,الاسم,الرسالة,نوع الرسالة",
          ...allMessages.map((msg: any) => {
            const date = new Date(
              typeof msg.timestamp === "number" ? msg.timestamp * 1000 : msg.created_at,
            ).toLocaleString("ar-SA")
            const type = msg.type === "incoming" ? "وارد" : "صادر"
            const phone = msg.from_number
            const name = msg.from_name || msg.from_number
            const text = (msg.message_text || "").replace(/"/g, '""')
            const messageType = msg.message_type || "text"
            return `"${date}","${type}","${phone}","${name}","${text}","${messageType}"`
          }),
        ].join("\n")

        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="all-conversations.csv"`,
          },
        })
      } else {
        return NextResponse.json(
          {
            messages: allMessages,
            total: allMessages.length,
            exported_at: new Date().toISOString(),
          },
          {
            headers: {
              "Content-Disposition": `attachment; filename="all-conversations.json"`,
            },
          },
        )
      }
    }
  } catch (error) {
    console.error("[v0] Error exporting conversations:", error)
    return NextResponse.json({ error: "Failed to export conversations" }, { status: 500 })
  }
}
