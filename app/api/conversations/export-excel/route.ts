import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get("filter") || "all"

    const supabaseClient = await createClient()

    console.log("[v0] Exporting conversations with newest first ordering")

    const { data: incomingMessages, error } = await supabaseClient
      .from("webhook_messages")
      .select("from_number, from_name, message_text, timestamp, replied, status")
      .order("timestamp", { ascending: false }) // من الأحدث إلى الأقدم

    if (error) {
      console.error("[v0] Error fetching incoming messages:", error)
      return NextResponse.json({ error: "فشل في جلب الرسائل الواردة" }, { status: 500 })
    }

    const conversationsMap = new Map<string, any>()

    incomingMessages?.forEach((msg: any) => {
      const existing = conversationsMap.get(msg.from_number)
      if (!existing) {
        conversationsMap.set(msg.from_number, {
          from_number: msg.from_number,
          from_name: msg.from_name,
          last_message_text: msg.message_text,
          last_message_time: msg.timestamp, // آخر رسالة واردة
          status: msg.status,
          replied: msg.replied,
        })
      }
    })

    let filteredConversations = Array.from(conversationsMap.values())

    if (filter === "unread") {
      filteredConversations = filteredConversations.filter((conv) => conv.status === "unread")
    }

    console.log(`[v0] Exporting ${filteredConversations.length} conversations after filter: ${filter}`)

    const headers = ["رقم الهاتف", "اسم جهة الاتصال", "آخر رسالة", "وقت آخر رسالة واردة", "الحالة", "تم الرد"]
    const csvContent = [
      headers.join(","),
      ...filteredConversations.map((conv: any) => {
        const messageTime = new Date(conv.last_message_time).toLocaleString("ar-SA", {
          timeZone: "Asia/Riyadh",
        })
        const status = conv.status === "unread" ? "غير مقروء" : "مقروء"
        const replied = conv.replied ? "نعم" : "لا"
        return [
          conv.from_number,
          `"${conv.from_name || conv.from_number}"`,
          `"${conv.last_message_text || ""}"`,
          messageTime,
          status,
          replied,
        ].join(",")
      }),
    ].join("\n")

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

    const supabaseClient = await createClient()

    console.log(`[v0] Exporting ${phoneNumbers.length} selected conversations in specified order`)

    const { data: incomingMessages, error } = await supabaseClient
      .from("webhook_messages")
      .select("from_number, from_name, message_text, timestamp, replied, status")
      .in("from_number", phoneNumbers)

    if (error) {
      console.error("[v0] Error fetching incoming messages:", error)
      return NextResponse.json({ error: "فشل في جلب الرسائل الواردة" }, { status: 500 })
    }

    const conversationsMap = new Map<string, any>()

    incomingMessages?.forEach((msg: any) => {
      const existing = conversationsMap.get(msg.from_number)
      if (!existing) {
        conversationsMap.set(msg.from_number, {
          from_number: msg.from_number,
          from_name: msg.from_name,
          last_message_text: msg.message_text,
          last_message_time: msg.timestamp,
          status: msg.status,
          replied: msg.replied,
        })
      }
    })

    const selectedConversations = phoneNumbers
      .map((phone) => conversationsMap.get(phone))
      .filter((conv) => conv !== undefined)

    console.log(`[v0] Exporting ${selectedConversations.length} selected conversations with preserved order`)

    const headers = ["رقم الهاتف", "اسم جهة الاتصال", "آخر رسالة", "وقت آخر رسالة واردة", "الحالة", "تم الرد"]
    const csvContent = [
      headers.join(","),
      ...selectedConversations.map((conv: any) => {
        const messageTime = new Date(conv.last_message_time).toLocaleString("ar-SA", {
          timeZone: "Asia/Riyadh",
        })
        const status = conv.status === "unread" ? "غير مقروء" : "مقروء"
        const replied = conv.replied ? "نعم" : "لا"
        return [
          conv.from_number,
          `"${conv.from_name || conv.from_number}"`,
          `"${conv.last_message_text || ""}"`,
          messageTime,
          status,
          replied,
        ].join(",")
      }),
    ].join("\n")

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
