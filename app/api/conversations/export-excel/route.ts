import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get("filter") || "all"

    const client = await createClient()

    const { rows: conversations } = await client.query(
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
        l.message_time as last_activity,
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

    // إنشاء محتوى Excel بصيغة CSV (يمكن فتحه في Excel)
    const headers = ["رقم الهاتف", "اسم جهة الاتصال", "آخر رسالة", "وقت آخر رسالة", "عدد الرسائل غير المقروءة"]
    const csvContent = [
      headers.join(","),
      ...conversations.map((conv: any) => {
        const lastMessageTime = new Date(conv.last_message_time).toLocaleString("ar-SA")
        return [
          conv.phone_number,
          `"${conv.contact_name}"`,
          `"${conv.last_message_text || ""}"`,
          lastMessageTime,
          conv.unread_count,
        ].join(",")
      }),
    ].join("\n")

    // إضافة BOM لدعم UTF-8 في Excel
    const bom = "\uFEFF"
    const csvWithBom = bom + csvContent

    return new NextResponse(csvWithBom, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="conversations-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("[v0] Error exporting conversations to Excel:", error)
    return NextResponse.json({ error: "فشل في تصدير المحادثات" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumbers } = await request.json()

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return NextResponse.json({ error: "يجب تحديد أرقام الهواتف" }, { status: 400 })
    }

    const client = await createClient()

    const placeholders = phoneNumbers.map((_, i) => `$${i + 1}`).join(",")
    const normalizedPhones = phoneNumbers.map((phone: string) => phone.replace(/\D/g, ""))

    const { rows: conversations } = await client.query(
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
        WHERE REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') IN (${placeholders})
           OR REGEXP_REPLACE(to_number, '[^0-9]', '', 'g') IN (${placeholders})
        ORDER BY normalized_phone, message_time DESC
      ),
      unread_counts AS (
        SELECT 
          REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') as normalized_phone,
          COUNT(*) FILTER (WHERE NOT replied) as unread_count
        FROM webhook_messages
        WHERE REGEXP_REPLACE(from_number, '[^0-9]', '', 'g') IN (${placeholders})
        GROUP BY REGEXP_REPLACE(from_number, '[^0-9]', '', 'g')
      )
      SELECT 
        l.phone_number,
        l.contact_name,
        COALESCE(l.message_text, '') as last_message_text,
        l.message_time as last_message_time,
        l.is_outgoing as last_message_is_outgoing,
        COALESCE(u.unread_count, 0)::int as unread_count,
        l.message_time as last_activity
      FROM latest_per_phone l
      LEFT JOIN unread_counts u ON l.normalized_phone = u.normalized_phone
      ORDER BY l.message_time DESC
    `,
      normalizedPhones,
    )

    // إنشاء محتوى Excel بصيغة CSV
    const headers = ["رقم الهاتف", "اسم جهة الاتصال", "آخر رسالة", "وقت آخر رسالة", "عدد الرسائل غير المقروءة"]
    const csvContent = [
      headers.join(","),
      ...conversations.map((conv: any) => {
        const lastMessageTime = new Date(conv.last_message_time).toLocaleString("ar-SA")
        return [
          conv.phone_number,
          `"${conv.contact_name}"`,
          `"${conv.last_message_text || ""}"`,
          lastMessageTime,
          conv.unread_count,
        ].join(",")
      }),
    ].join("\n")

    // إضافة BOM لدعم UTF-8 في Excel
    const bom = "\uFEFF"
    const csvWithBom = bom + csvContent

    return new NextResponse(csvWithBom, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="selected-conversations-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("[v0] Error exporting selected conversations to Excel:", error)
    return NextResponse.json({ error: "فشل في تصدير المحادثات المحددة" }, { status: 500 })
  }
}
