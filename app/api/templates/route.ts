import { NextResponse } from "next/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"
import { createClient } from "@/lib/neon/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const neonClient = await createClient()
    const { data: settingsData, error: settingsError } = await neonClient.from("api_settings").select("*").limit(1)
    const settings = settingsData?.[0]

    if (settingsError || !settings) {
      console.error("[v0] Error fetching API settings:", settingsError)
      return NextResponse.json({ error: "API settings not configured", success: false }, { status: 500 })
    }

    const url = getWhatsAppApiUrl(
      `${settings.business_account_id}/message_templates?fields=id,name,language,status,components,category`,
    )

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("[v0] WhatsApp API error:", error)

      if (error.error?.code === 190 || error.error?.type === "OAuthException") {
        return NextResponse.json(
          {
            error: error.error?.message || "Access token has expired",
            errorType: "TOKEN_EXPIRED",
            success: false,
          },
          { status: 401 },
        )
      }

      throw new Error(error.error?.message || "Failed to fetch templates")
    }

    const data = await response.json()
    console.log("[v0] Templates fetched:", data.data?.length || 0)
    console.log("[v0] Template details:", JSON.stringify(data.data, null, 2))

    return NextResponse.json({
      templates: data.data || [],
      success: true,
    })
  } catch (error) {
    console.error("[v0] Error fetching templates:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch templates",
        success: false,
      },
      { status: 500 },
    )
  }
}
