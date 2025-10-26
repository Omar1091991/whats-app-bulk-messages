import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabaseClient = await createClient()

    const { data, error } = await supabaseClient
      .from("webhook_messages")
      .select("*")
      .order("status", { ascending: true }) // unread comes before read alphabetically
      .order("reply_sent_at", { ascending: false, nullsFirst: false }) // latest reply first
      .order("created_at", { ascending: false }) // then by creation time

    if (error) {
      console.error("[v0] Error fetching messages:", error)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    const sortedMessages = data?.sort((a, b) => {
      // الرسائل غير المقروءة أولاً
      if (a.status === "unread" && b.status !== "unread") return -1
      if (a.status !== "unread" && b.status === "unread") return 1

      // ثم حسب آخر نشاط (وقت الرد أو وقت الاستلام)
      const aTime = a.reply_sent_at ? new Date(a.reply_sent_at).getTime() : new Date(a.created_at).getTime()
      const bTime = b.reply_sent_at ? new Date(b.reply_sent_at).getTime() : new Date(b.created_at).getTime()

      return bTime - aTime // الأحدث أولاً
    })

    return NextResponse.json({ messages: sortedMessages })
  } catch (error) {
    console.error("[v0] Error in messages GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status } = body

    if (!id) {
      return NextResponse.json({ error: "Message ID is required" }, { status: 400 })
    }

    const supabaseClient = await createClient()

    const { data, error } = await supabaseClient
      .from("webhook_messages")
      .update({ status })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating message:", error)
      return NextResponse.json({ error: "Failed to update message" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error in messages PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
