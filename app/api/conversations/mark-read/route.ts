import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    const supabaseClient = await createClient()

    const normalizedPhone = phone.replace(/\D/g, "")

    const { error: msgError } = await supabaseClient
      .from("webhook_messages")
      .update({ replied: true })
      .eq("from_number", normalizedPhone)
      .eq("replied", false)

    if (msgError) {
      console.error("[v0] Error updating messages:", msgError)
      return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error marking conversation as read:", error)
    return NextResponse.json({ error: "Failed to mark conversation as read" }, { status: 500 })
  }
}
