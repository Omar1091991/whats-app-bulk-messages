import { NextResponse } from "next/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabaseClient = await createClient()
    const { error: settingsError, data: settingsData } = await supabaseClient.from("api_settings").select("*").limit(1)
    const settings = settingsData?.[0]

    if (settingsError || !settings) {
      console.error("[v0] Error fetching API settings:", settingsError)
      return NextResponse.json(
        {
          connected: false,
          phoneNumberId: "Not configured",
          businessAccountId: "Not configured",
          error: "API settings not configured",
        },
        { status: 500 },
      )
    }

    // Test connection by fetching phone number details
    const url = getWhatsAppApiUrl(settings.phone_number_id)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("[v0] WhatsApp API connection error:", error)

      const isTokenExpired =
        error.error?.code === 190 ||
        error.error?.message?.includes("expired") ||
        error.error?.message?.includes("Session has expired")

      return NextResponse.json({
        connected: false,
        phoneNumberId: settings.phone_number_id,
        businessAccountId: settings.business_account_id,
        error: error.error?.message || "Connection failed",
        errorCode: error.error?.code,
        isTokenExpired,
      })
    }

    const responseData = await response.json()
    console.log("[v0] WhatsApp connection successful:", responseData)

    return NextResponse.json({
      connected: true,
      phoneNumberId: settings.phone_number_id,
      businessAccountId: settings.business_account_id,
      phoneNumber: responseData.display_phone_number,
      verifiedName: responseData.verified_name,
    })
  } catch (error) {
    console.error("[v0] Error testing connection:", error)
    return NextResponse.json(
      {
        connected: false,
        phoneNumberId: "Error",
        businessAccountId: "Error",
        error: error instanceof Error ? error.message : "Connection test failed",
      },
      { status: 500 },
    )
  }
}
