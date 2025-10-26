import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "")

  // إذا كان الرقم يبدأ بـ 966، نحتفظ به كما هو
  if (cleaned.startsWith("966")) {
    return cleaned
  }

  // إذا كان الرقم يبدأ بـ 0، نستبدله بـ 966
  if (cleaned.startsWith("0")) {
    return "966" + cleaned.substring(1)
  }

  // إذا كان الرقم لا يبدأ بـ 966 أو 0، نضيف 966
  if (!cleaned.startsWith("966")) {
    return "966" + cleaned
  }

  return cleaned
}

export async function GET(request: Request, { params }: { params: { phone: string } }) {
  try {
    const { phone } = params
    const supabaseClient = await createClient()

    const normalizedPhone = normalizePhoneNumber(phone)

    console.log("[v0] Fetching messages for phone:", phone, "normalized:", normalizedPhone)

    const phoneVariants = [normalizedPhone, phone, phone.replace(/\D/g, "")]

    console.log("[v0] Phone variants:", phoneVariants)

    const { data: incomingMessages, error: incomingError } = await supabaseClient
      .from("webhook_messages")
      .select("*")
      .or(phoneVariants.map((p) => `from_number.eq.${p}`).join(","))
      .order("created_at", { ascending: true })

    if (incomingError) {
      console.error("[v0] Error fetching incoming messages:", incomingError)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    console.log("[v0] Found incoming messages:", incomingMessages?.length || 0)

    const { data: sentReplies, error: sentError } = await supabaseClient
      .from("message_history")
      .select("*")
      .or(phoneVariants.map((p) => `to_number.eq.${p}`).join(","))
      .order("created_at", { ascending: true })

    if (sentError) {
      console.error("[v0] Error fetching sent replies:", sentError)
      return NextResponse.json({ error: "Failed to fetch sent replies" }, { status: 500 })
    }

    console.log("[v0] Found sent messages:", sentReplies?.length || 0)

    const allMessages = [
      ...(incomingMessages || []).map((msg) => ({
        id: msg.id,
        type: "incoming" as const,
        timestamp: msg.created_at,
        message_text: msg.message_text || msg.body || "",
        message_type: msg.message_type,
        from_number: msg.from_number,
        contact_name: msg.contact_name,
        status: msg.status,
        replied: msg.replied,
        message_media_url: msg.message_media_url,
        media_url: msg.media_url,
        media_type: msg.media_type,
      })),
      ...(sentReplies || []).map((msg) => ({
        id: msg.id,
        type: "outgoing" as const,
        timestamp: msg.created_at,
        message_text: msg.message_text || msg.template_body || "",
        to_number: msg.to_number,
        status: msg.status,
        template_name: msg.template_name,
        media_url: msg.media_url,
      })),
    ].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      return timeA - timeB
    })

    console.log("[v0] Total messages in conversation:", allMessages.length)

    return NextResponse.json({ messages: allMessages })
  } catch (error) {
    console.error("[v0] Error in conversation GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { phone: string } }) {
  try {
    const { phone } = params
    const supabaseClient = await createClient()

    const normalizedPhone = normalizePhoneNumber(phone)

    const { data: unreadMessages, error: fetchError } = await supabaseClient
      .from("webhook_messages")
      .select("*")
      .eq("status", "unread")

    if (fetchError) {
      console.error("[v0] Error fetching unread messages:", fetchError)
      return NextResponse.json({ error: "Failed to fetch unread messages" }, { status: 500 })
    }

    const messagesToUpdate = unreadMessages?.filter((msg) => normalizePhoneNumber(msg.from_number) === normalizedPhone)

    if (messagesToUpdate && messagesToUpdate.length > 0) {
      const messageIds = messagesToUpdate.map((msg) => msg.id)

      const { error } = await supabaseClient.from("webhook_messages").update({ status: "read" }).in("id", messageIds)

      if (error) {
        console.error("[v0] Error marking messages as read:", error)
        return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in conversation PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
