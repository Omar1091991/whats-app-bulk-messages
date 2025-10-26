import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabaseClient = await createClient()

    const { data, error } = await supabaseClient.from("api_settings").select("*").limit(1)

    if (error) {
      console.error("[v0] Error fetching API settings:", error)
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }

    return NextResponse.json(data && data.length > 0 ? data[0] : null)
  } catch (error) {
    console.error("[v0] Error in settings GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabaseClient = await createClient()
    const body = await request.json()

    const { business_account_id, phone_number_id, access_token, webhook_verify_token } = body

    if (!business_account_id || !phone_number_id || !access_token) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const finalWebhookToken =
      webhook_verify_token ||
      `whatsapp_verify_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`

    const { data: existing } = await supabaseClient.from("api_settings").select("id").limit(1)

    let result
    if (existing && existing.length > 0) {
      result = await supabaseClient
        .from("api_settings")
        .update({
          business_account_id,
          phone_number_id,
          access_token,
          webhook_verify_token: finalWebhookToken,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id)
        .select()
    } else {
      result = await supabaseClient
        .from("api_settings")
        .insert({
          business_account_id,
          phone_number_id,
          access_token,
          webhook_verify_token: finalWebhookToken,
        })
        .select()
    }

    if (result.error) {
      console.error("[v0] Error saving API settings:", result.error)
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
    }

    return NextResponse.json(result.data?.[0])
  } catch (error) {
    console.error("[v0] Error in settings POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
