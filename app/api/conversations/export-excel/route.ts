import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get("filter") || "all"

    const supabaseClient = await createClient()

    // جلب جميع الرسائل الواردة من webhook_messages فقط
    const { data: incomingMessages, error } = await supabaseClient
      .from("webhook_messages")
      .select("from_number, from_name, message_text, timestamp, replied, status")
      .order("timestamp", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching incoming messages:", error)
      return NextResponse.json({ error: "فشل في جلب الرسائل الواردة" }, { status: 500 })
    }

    // تطبيق الفلتر على الرسائل الواردة
    let filteredMessages = incomingMessages || []

    if (filter === "unread") {
      filteredMessages = filteredMessages.filter((msg) => msg.status === "unread")
    } else if (filter === "conversations") {
      // جميع الرسائل الواردة
      filteredMessages = filteredMessages
    }

    // إنشاء محتوى Excel بصيغة CSV
    const headers = ["رقم الهاتف", "اسم جهة الاتصال", "نص الرسالة", "وقت الرسالة", "الحالة", "تم الرد"]
    const csvContent = [
      headers.join(","),
      ...filteredMessages.map((msg: any) => {
        const messageTime = new Date(msg.timestamp).toLocaleString("ar-SA")
        const status = msg.status === "unread" ? "غير مقروء" : "مقروء"
        const replied = msg.replied ? "نعم" : "لا"
        return [
          msg.from_number,
          `"${msg.from_name || msg.from_number}"`,
          `"${msg.message_text || ""}"`,
          messageTime,
          status,
          replied,
        ].join(",")
      }),
    ].join("\n")

    // إضافة BOM لدعم UTF-8 في Excel
    const bom = "\uFEFF"
    const csvWithBom = bom + csvContent

    return new NextResponse(csvWithBom, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="incoming-messages-${new Date().toISOString().split("T")[0]}.csv"`,
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

    const supabaseClient = await createClient()

    // جلب جميع الرسائل الواردة من الأرقام المحددة
    const { data: incomingMessages, error } = await supabaseClient
      .from("webhook_messages")
      .select("from_number, from_name, message_text, timestamp, replied, status")
      .in("from_number", phoneNumbers)
      .order("timestamp", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching incoming messages:", error)
      return NextResponse.json({ error: "فشل في جلب الرسائل الواردة" }, { status: 500 })
    }

    // إنشاء محتوى Excel بصيغة CSV
    const headers = ["رقم الهاتف", "اسم جهة الاتصال", "نص الرسالة", "وقت الرسالة", "الحالة", "تم الرد"]
    const csvContent = [
      headers.join(","),
      ...(incomingMessages || []).map((msg: any) => {
        const messageTime = new Date(msg.timestamp).toLocaleString("ar-SA")
        const status = msg.status === "unread" ? "غير مقروء" : "مقروء"
        const replied = msg.replied ? "نعم" : "لا"
        return [
          msg.from_number,
          `"${msg.from_name || msg.from_number}"`,
          `"${msg.message_text || ""}"`,
          messageTime,
          status,
          replied,
        ].join(",")
      }),
    ].join("\n")

    // إضافة BOM لدعم UTF-8 في Excel
    const bom = "\uFEFF"
    const csvWithBom = bom + csvContent

    return new NextResponse(csvWithBom, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="selected-incoming-messages-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("[v0] Error exporting selected conversations to Excel:", error)
    return NextResponse.json({ error: "فشل في تصدير المحادثات المحددة" }, { status: 500 })
  }
}
