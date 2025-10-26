import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get("filter") || "all"

    const supabaseClient = await createClient()

    // جلب جميع الرسائل الواردة
    const { data: incomingMessages, error: incomingError } = await supabaseClient
      .from("webhook_messages")
      .select("from_number, from_name, message_text, timestamp, replied")
      .order("timestamp", { ascending: false })

    if (incomingError) throw incomingError

    // جلب جميع الرسائل الصادرة
    const { data: outgoingMessages, error: outgoingError } = await supabaseClient
      .from("message_history")
      .select("to_number, message_text, created_at, status")
      .order("created_at", { ascending: false })

    if (outgoingError) throw outgoingError

    // بناء المحادثات
    const conversationsMap = new Map<string, any>()

    for (const msg of incomingMessages || []) {
      const normalizedPhone = normalizePhoneNumber(msg.from_number)
      const existing = conversationsMap.get(normalizedPhone)

      if (!existing || new Date(msg.timestamp) > new Date(existing.last_message_time)) {
        conversationsMap.set(normalizedPhone, {
          phone_number: msg.from_number,
          contact_name: msg.from_name || msg.from_number,
          last_message_text: msg.message_text,
          last_message_time: msg.timestamp,
          unread_count: msg.replied ? 0 : 1,
          has_incoming_messages: true,
        })
      }
    }

    for (const msg of outgoingMessages || []) {
      const normalizedPhone = normalizePhoneNumber(msg.to_number)
      const existing = conversationsMap.get(normalizedPhone)

      if (!existing || new Date(msg.created_at) > new Date(existing.last_message_time)) {
        conversationsMap.set(normalizedPhone, {
          phone_number: msg.to_number,
          contact_name: existing?.contact_name || msg.to_number,
          last_message_text: msg.message_text,
          last_message_time: msg.created_at,
          unread_count: existing?.unread_count || 0,
          has_incoming_messages: existing?.has_incoming_messages || false,
        })
      }
    }

    let conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime(),
    )

    // تطبيق الفلتر
    if (filter === "unread") {
      conversations = conversations.filter((conv) => conv.unread_count > 0)
    } else if (filter === "conversations") {
      conversations = conversations.filter((conv) => conv.has_incoming_messages)
    }

    // إنشاء محتوى HTML بسيط يمكن طباعته كـ PDF
    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير المحادثات</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      direction: rtl;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background: #00a884;
      color: white;
      border-radius: 8px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header p {
      margin: 10px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background: #202c33;
      color: white;
      padding: 12px;
      text-align: right;
      font-weight: bold;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      text-align: right;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:hover {
      background: #f9f9f9;
    }
    .unread-badge {
      background: #25d366;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding: 15px;
      color: #666;
      font-size: 12px;
    }
    @media print {
      body { background: white; }
      .header { background: #00a884 !important; -webkit-print-color-adjust: exact; }
      th { background: #202c33 !important; -webkit-print-color-adjust: exact; }
      .unread-badge { background: #25d366 !important; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير المحادثات</h1>
    <p>تاريخ التصدير: ${new Date().toLocaleDateString("ar-SA")} - ${new Date().toLocaleTimeString("ar-SA")}</p>
    <p>عدد المحادثات: ${conversations.length}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>رقم الهاتف</th>
        <th>اسم جهة الاتصال</th>
        <th>آخر رسالة</th>
        <th>وقت آخر رسالة</th>
        <th>غير مقروء</th>
      </tr>
    </thead>
    <tbody>
      ${conversations
        .map(
          (conv: any) => `
        <tr>
          <td>${conv.phone_number}</td>
          <td>${conv.contact_name}</td>
          <td>${conv.last_message_text || "-"}</td>
          <td>${new Date(conv.last_message_time).toLocaleString("ar-SA")}</td>
          <td>${conv.unread_count > 0 ? `<span class="unread-badge">${conv.unread_count}</span>` : "-"}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>
  
  <div class="footer">
    <p>تم إنشاء هذا التقرير بواسطة نظام إدارة رسائل واتساب</p>
  </div>
</body>
</html>
    `

    return new NextResponse(htmlContent, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="conversations-${new Date().toISOString().split("T")[0]}.html"`,
      },
    })
  } catch (error) {
    console.error("[v0] Error exporting conversations to PDF:", error)
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
    const normalizedPhones = phoneNumbers.map((phone: string) => normalizePhoneNumber(phone))

    // جلب الرسائل الواردة للأرقام المحددة
    const { data: incomingMessages, error: incomingError } = await supabaseClient
      .from("webhook_messages")
      .select("from_number, from_name, message_text, timestamp, replied")
      .order("timestamp", { ascending: false })

    if (incomingError) throw incomingError

    // جلب الرسائل الصادرة للأرقام المحددة
    const { data: outgoingMessages, error: outgoingError } = await supabaseClient
      .from("message_history")
      .select("to_number, message_text, created_at, status")
      .order("created_at", { ascending: false })

    if (outgoingError) throw outgoingError

    // تصفية الرسائل للأرقام المحددة فقط
    const filteredIncoming = (incomingMessages || []).filter((msg) =>
      normalizedPhones.includes(normalizePhoneNumber(msg.from_number)),
    )
    const filteredOutgoing = (outgoingMessages || []).filter((msg) =>
      normalizedPhones.includes(normalizePhoneNumber(msg.to_number)),
    )

    // بناء المحادثات
    const conversationsMap = new Map<string, any>()

    for (const msg of filteredIncoming) {
      const normalizedPhone = normalizePhoneNumber(msg.from_number)
      const existing = conversationsMap.get(normalizedPhone)

      if (!existing || new Date(msg.timestamp) > new Date(existing.last_message_time)) {
        conversationsMap.set(normalizedPhone, {
          phone_number: msg.from_number,
          contact_name: msg.from_name || msg.from_number,
          last_message_text: msg.message_text,
          last_message_time: msg.timestamp,
          unread_count: msg.replied ? 0 : 1,
        })
      }
    }

    for (const msg of filteredOutgoing) {
      const normalizedPhone = normalizePhoneNumber(msg.to_number)
      const existing = conversationsMap.get(normalizedPhone)

      if (!existing || new Date(msg.created_at) > new Date(existing.last_message_time)) {
        conversationsMap.set(normalizedPhone, {
          phone_number: msg.to_number,
          contact_name: existing?.contact_name || msg.to_number,
          last_message_text: msg.message_text,
          last_message_time: msg.created_at,
          unread_count: existing?.unread_count || 0,
        })
      }
    }

    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime(),
    )

    // إنشاء محتوى HTML
    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير المحادثات المحددة</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      direction: rtl;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background: #00a884;
      color: white;
      border-radius: 8px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header p {
      margin: 10px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background: #202c33;
      color: white;
      padding: 12px;
      text-align: right;
      font-weight: bold;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      text-align: right;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:hover {
      background: #f9f9f9;
    }
    .unread-badge {
      background: #25d366;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding: 15px;
      color: #666;
      font-size: 12px;
    }
    @media print {
      body { background: white; }
      .header { background: #00a884 !important; -webkit-print-color-adjust: exact; }
      th { background: #202c33 !important; -webkit-print-color-adjust: exact; }
      .unread-badge { background: #25d366 !important; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير المحادثات المحددة</h1>
    <p>تاريخ التصدير: ${new Date().toLocaleDateString("ar-SA")} - ${new Date().toLocaleTimeString("ar-SA")}</p>
    <p>عدد المحادثات: ${conversations.length}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>رقم الهاتف</th>
        <th>اسم جهة الاتصال</th>
        <th>آخر رسالة</th>
        <th>وقت آخر رسالة</th>
        <th>غير مقروء</th>
      </tr>
    </thead>
    <tbody>
      ${conversations
        .map(
          (conv: any) => `
        <tr>
          <td>${conv.phone_number}</td>
          <td>${conv.contact_name}</td>
          <td>${conv.last_message_text || "-"}</td>
          <td>${new Date(conv.last_message_time).toLocaleString("ar-SA")}</td>
          <td>${conv.unread_count > 0 ? `<span class="unread-badge">${conv.unread_count}</span>` : "-"}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>
  
  <div class="footer">
    <p>تم إنشاء هذا التقرير بواسطة نظام إدارة رسائل واتساب</p>
  </div>
</body>
</html>
    `

    return new NextResponse(htmlContent, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="selected-conversations-${new Date().toISOString().split("T")[0]}.html"`,
      },
    })
  } catch (error) {
    console.error("[v0] Error exporting selected conversations to PDF:", error)
    return NextResponse.json({ error: "فشل في تصدير المحادثات المحددة" }, { status: 500 })
  }
}
