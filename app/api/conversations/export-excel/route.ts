import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/neon/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get("filter") || "all"

    const sql = createClient()

    // بناء الاستعلام بناءً على الفلتر
    let query = `
      SELECT 
        phone_number,
        contact_name,
        last_message_text,
        last_message_time,
        unread_count,
        last_activity
      FROM conversations
    `

    if (filter === "unread") {
      query += " WHERE unread_count > 0"
    } else if (filter === "conversations") {
      query += " WHERE has_incoming_messages = true"
    }

    query += " ORDER BY last_activity DESC"

    const result = await sql(query)
    const conversations = result.rows

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

    const sql = createClient()

    // استعلام للحصول على المحادثات المحددة
    const placeholders = phoneNumbers.map((_, i) => `$${i + 1}`).join(",")
    const query = `
      SELECT 
        phone_number,
        contact_name,
        last_message_text,
        last_message_time,
        unread_count,
        last_activity
      FROM conversations
      WHERE phone_number IN (${placeholders})
      ORDER BY last_activity DESC
    `

    const result = await sql(query, phoneNumbers)
    const conversations = result.rows

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
