import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "")
  return cleaned.startsWith("0") ? cleaned.substring(1) : cleaned
}

function formatDateTimeForExport(dateString: string | number) {
  let date: Date

  if (typeof dateString === "number") {
    // إذا كان رقم، نتحقق إذا كان بالـ seconds أو milliseconds
    // Unix timestamps بالـ seconds عادة أقل من 10^10 (10 أرقام)
    // Unix timestamps بالـ milliseconds عادة أكبر من 10^12 (13 رقم)
    if (dateString < 10000000000) {
      // timestamp بالـ seconds، نحوله إلى milliseconds
      console.log(`[v0] Converting timestamp from seconds to milliseconds: ${dateString}`)
      date = new Date(dateString * 1000)
    } else {
      // timestamp بالـ milliseconds
      date = new Date(dateString)
    }
  } else if (typeof dateString === "string") {
    // إذا كان string، نحاول تحويله
    const parsed = Date.parse(dateString)
    if (isNaN(parsed)) {
      // إذا فشل التحويل، نحاول كـ Unix timestamp
      const numericValue = Number.parseInt(dateString, 10)
      if (!isNaN(numericValue)) {
        if (numericValue < 10000000000) {
          date = new Date(numericValue * 1000)
        } else {
          date = new Date(numericValue)
        }
      } else {
        console.error(`[v0] Invalid date format: ${dateString}`)
        date = new Date()
      }
    } else {
      date = new Date(parsed)
    }
  } else {
    console.error(`[v0] Unknown date type: ${typeof dateString}`)
    date = new Date()
  }

  console.log(`[v0] Original timestamp: ${dateString}, Converted date: ${date.toISOString()}`)

  // تحويل التاريخ إلى توقيت مكة المكرمة (Asia/Riyadh - UTC+3) بالتقويم الميلادي
  const formattedDate = date.toLocaleDateString("en-GB", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const formattedTime = date.toLocaleTimeString("ar-SA", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  return { date: formattedDate, time: formattedTime }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get("filter") || "all"

    const supabaseClient = await createClient()

    console.log("[v0] Exporting incoming messages only to PDF")
    const { data: incomingMessages, error: incomingError } = await supabaseClient
      .from("webhook_messages")
      .select("from_number, from_name, message_text, timestamp, replied, status")
      .order("timestamp", { ascending: true })

    if (incomingError) throw incomingError

    console.log(`[v0] Fetched ${incomingMessages?.length || 0} incoming messages for PDF export`)

    const conversationsMap = new Map<string, any>()

    for (const msg of incomingMessages || []) {
      const normalizedPhone = normalizePhoneNumber(msg.from_number)
      const existing = conversationsMap.get(normalizedPhone)

      if (!existing || new Date(msg.timestamp) > new Date(existing.last_message_time)) {
        conversationsMap.set(normalizedPhone, {
          phone_number: msg.from_number,
          contact_name: msg.from_name || msg.from_number,
          last_message_text: msg.message_text || "رسالة",
          last_message_time: msg.timestamp,
          unread_count: msg.status === "unread" ? 1 : 0,
          has_incoming_messages: true,
        })
      }
    }

    let conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(a.last_message_time).getTime() - new Date(b.last_message_time).getTime(),
    )

    // تطبيق الفلتر
    if (filter === "unread") {
      conversations = conversations.filter((conv) => conv.unread_count > 0)
    } else if (filter === "conversations") {
      conversations = conversations.filter((conv) => conv.has_incoming_messages)
    }

    console.log(`[v0] Exporting ${conversations.length} conversations to PDF`)

    const exportDateTime = formatDateTimeForExport(new Date().toISOString())

    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير الرسائل الواردة</title>
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
    <h1>تقرير الرسائل الواردة من العملاء</h1>
    <p>تاريخ التصدير: ${exportDateTime.date} - ${exportDateTime.time} (توقيت مكة المكرمة)</p>
    <p>عدد الرسائل: ${conversations.length}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>الاسم</th>
        <th>رقم الجوال</th>
        <th>نص الرسالة الواردة</th>
        <th>التاريخ</th>
        <th>الوقت</th>
        <th>الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${conversations
        .map((conv: any) => {
          const { date, time } = formatDateTimeForExport(conv.last_message_time)
          return `
        <tr>
          <td>${conv.contact_name}</td>
          <td>${conv.phone_number}</td>
          <td>${conv.last_message_text}</td>
          <td>${date}</td>
          <td>${time}</td>
          <td>${conv.unread_count > 0 ? `<span class="unread-badge">غير مقروء</span>` : "مقروء"}</td>
        </tr>
      `
        })
        .join("")}
    </tbody>
  </table>
  
  <div class="footer">
    <p>تم إنشاء هذا التقرير بواسطة نظام إدارة رسائل واتساب - الرسائل الواردة من العملاء فقط</p>
    <p>جميع الأوقات بتوقيت مكة المكرمة (UTC+3) - مرتبة من الأقدم إلى الأحدث</p>
  </div>
</body>
</html>
    `

    return new NextResponse(htmlContent, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="incoming-messages-${new Date().toISOString().split("T")[0]}.html"`,
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

    console.log("[v0] Exporting selected phones:", phoneNumbers)

    console.log("[v0] Fetching all incoming messages to understand phone format...")
    const { data: allIncoming, error: allError } = await supabaseClient
      .from("webhook_messages")
      .select("from_number, from_name, message_text, timestamp, replied, status")
      .order("timestamp", { ascending: true })
      .limit(10)

    if (allError) throw allError

    console.log("[v0] Sample phone numbers from database:", allIncoming?.map((m) => m.from_number).slice(0, 5))

    console.log("[v0] Exporting selected incoming messages only to PDF")

    // إنشاء قائمة بجميع التنسيقات الممكنة للأرقام
    const phoneVariants: string[] = []
    for (const phone of phoneNumbers) {
      const normalized = normalizePhoneNumber(phone)
      phoneVariants.push(phone) // الرقم الأصلي
      phoneVariants.push(normalized) // الرقم المعياري
      phoneVariants.push(`+${normalized}`) // مع +
      phoneVariants.push(`0${normalized.slice(3)}`) // مع 0 بدلاً من رمز الدولة
      phoneVariants.push(normalized.slice(3)) // بدون رمز الدولة
      phoneVariants.push(normalized.slice(-9)) // آخر 9 أرقام فقط
    }

    console.log("[v0] Phone variants to search:", phoneVariants.slice(0, 10))

    const { data: incomingMessages, error: incomingError } = await supabaseClient
      .from("webhook_messages")
      .select("from_number, from_name, message_text, timestamp, replied, status")
      .in("from_number", phoneVariants)
      .order("timestamp", { ascending: true })

    if (incomingError) throw incomingError

    console.log(`[v0] Fetched ${incomingMessages?.length || 0} incoming messages using .in() query`)

    let filteredIncoming = incomingMessages || []

    if (filteredIncoming.length === 0) {
      console.log("[v0] No messages found with .in() query, trying manual filtering...")
      const { data: allMessages, error: allMessagesError } = await supabaseClient
        .from("webhook_messages")
        .select("from_number, from_name, message_text, timestamp, replied, status")
        .order("timestamp", { ascending: true })

      if (allMessagesError) throw allMessagesError

      console.log(`[v0] Fetched ${allMessages?.length || 0} total incoming messages for manual filtering`)

      filteredIncoming = (allMessages || []).filter((msg) => {
        const normalizedMsgPhone = normalizePhoneNumber(msg.from_number)
        const matches = phoneNumbers.some((phone) => {
          const normalizedPhone = normalizePhoneNumber(phone)
          // مطابقة كاملة
          if (normalizedMsgPhone === normalizedPhone) return true
          // مطابقة آخر 9 أرقام
          if (normalizedMsgPhone.slice(-9) === normalizedPhone.slice(-9)) return true
          return false
        })
        if (matches) {
          console.log(`[v0] Matched: ${msg.from_number} with normalized: ${normalizedMsgPhone}`)
        }
        return matches
      })

      console.log(`[v0] Filtered to ${filteredIncoming.length} messages after manual filtering`)
    }

    const messagesByPhone = new Map<string, any>()

    for (const msg of filteredIncoming) {
      const normalizedPhone = normalizePhoneNumber(msg.from_number)

      if (!messagesByPhone.has(normalizedPhone)) {
        messagesByPhone.set(normalizedPhone, {
          phone_number: msg.from_number,
          contact_name: msg.from_name || msg.from_number,
          messages: [],
          latest_timestamp: msg.timestamp,
          latest_status: msg.status,
        })
      }

      const entry = messagesByPhone.get(normalizedPhone)!
      entry.messages.push({
        text: msg.message_text || "رسالة",
        timestamp: msg.timestamp,
        status: msg.status,
      })

      // تحديث آخر رسالة للحصول على آخر وقت وحالة
      if (new Date(msg.timestamp).getTime() > new Date(entry.latest_timestamp).getTime()) {
        entry.latest_timestamp = msg.timestamp
        entry.latest_status = msg.status
      }
    }

    // ترتيب العملاء حسب آخر رسالة من الأقدم إلى الأحدث
    const sortedConversations = Array.from(messagesByPhone.values()).sort(
      (a, b) => new Date(a.latest_timestamp).getTime() - new Date(b.latest_timestamp).getTime(),
    )

    console.log(`[v0] Exporting ${sortedConversations.length} customers with their incoming messages`)

    const exportDateTime = formatDateTimeForExport(new Date().toISOString())

    const tableRows = sortedConversations
      .map((conv: any) => {
        // دمج جميع الرسائل في نص واحد، كل رسالة في سطر منفصل مع التاريخ والوقت
        const messagesText = conv.messages
          .map((msg: any) => {
            const { date, time } = formatDateTimeForExport(msg.timestamp)
            return `${date} - ${time}: ${msg.text}`
          })
          .join("<br>")

        const { date: lastDate, time: lastTime } = formatDateTimeForExport(conv.latest_timestamp)

        return `
        <tr>
          <td>${conv.contact_name}</td>
          <td>${conv.phone_number}</td>
          <td style="text-align: right; line-height: 1.8;">${messagesText}</td>
          <td>${lastDate}</td>
          <td>${lastTime}</td>
          <td>${conv.latest_status === "unread" ? `<span class="unread-badge">غير مقروء</span>` : "مقروء"}</td>
        </tr>
      `
      })
      .join("")

    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير الرسائل الواردة المحددة</title>
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
      vertical-align: top;
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
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير الرسائل الواردة من العملاء</h1>
    <p>تاريخ التصدير: ${exportDateTime.date} - ${exportDateTime.time} (توقيت مكة المكرمة)</p>
    <p>عدد الرسائل: ${filteredIncoming.length}</p>
    <p>عدد العملاء: ${sortedConversations.length}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>الاسم</th>
        <th>رقم الجوال</th>
        <th>نص الرسالة الواردة</th>
        <th>التاريخ</th>
        <th>الوقت</th>
        <th>الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  
  <div class="footer">
    <p>تم إنشاء هذا التقرير بواسطة نظام إدارة رسائل واتساب - الرسائل الواردة من العملاء</p>
    <p>جميع الأوقات بتوقيت مكة المكرمة (UTC+3) - مرتبة من الأقدم إلى الأحدث</p>
  </div>
</body>
</html>
    `

    return new NextResponse(htmlContent, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="selected-incoming-messages-${new Date().toISOString().split("T")[0]}.html"`,
      },
    })
  } catch (error) {
    console.error("[v0] Error exporting selected conversations to PDF:", error)
    return NextResponse.json({ error: "فشل في تصدير المحادثات المحددة" }, { status: 500 })
  }
}
