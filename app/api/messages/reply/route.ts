import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { messageId, toNumber, text } = body

    if (!toNumber || !text) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: settingsData, error: settingsError } = await supabase.from("api_settings").select("*").limit(1)
    const settings = settingsData?.[0]

    if (settingsError || !settings) {
      console.error("[v0] Error fetching API settings:", settingsError)
      return NextResponse.json({ error: "API settings not configured" }, { status: 500 })
    }

    const url = `${getWhatsAppApiUrl(settings.phone_number_id)}/messages`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toNumber,
        type: "text",
        text: { body: text },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("[v0] WhatsApp API error:", error)
      return NextResponse.json({ error: error.error?.message || "Failed to send message" }, { status: response.status })
    }

    const data = await response.json()
    const sentMessageId = data.messages?.[0]?.id

    await supabase.from("message_history").insert({
      message_id: sentMessageId,
      to_number: toNumber,
      message_text: text,
      message_type: "reply",
      status: "sent",
    })

    const normalizedPhone = normalizePhoneNumber(toNumber)
    await supabase
      .from("webhook_messages")
      .update({
        replied: true,
        reply_text: text,
        reply_sent_at: new Date().toISOString(),
        status: "read",
      })
      .eq("from_number", toNumber)
      .eq("replied", false)

    return NextResponse.json({ success: true, messageId: sentMessageId })
  } catch (error) {
    console.error("[v0] Error sending reply:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
