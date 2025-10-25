import { NextResponse } from "next/server"
import { createClient } from "@/lib/neon/server"

export async function POST() {
  try {
    const neonClient = await createClient()

    // Generate a new random verify token
    const newVerifyToken = `whatsapp_verify_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`

    // Get existing settings
    const { data: existing } = await neonClient.from("api_settings").select("id").limit(1)

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: "No settings found. Please save your API settings first." }, { status: 404 })
    }

    // Update the verify token
    const { data, error } = await neonClient
      .from("api_settings")
      .update({
        webhook_verify_token: newVerifyToken,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing[0].id)
      .select()

    if (error) {
      console.error("[v0] Error regenerating verify token:", error)
      return NextResponse.json({ error: "Failed to regenerate verify token" }, { status: 500 })
    }

    return NextResponse.json(data?.[0])
  } catch (error) {
    console.error("[v0] Error in regenerate-token POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
