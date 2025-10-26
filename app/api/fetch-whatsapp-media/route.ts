import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mediaId = searchParams.get("mediaId")

    if (!mediaId) {
      return NextResponse.json({ error: "Media ID is required" }, { status: 400 })
    }

    const supabaseClient = await createClient()
    const { data: settings } = await supabaseClient.from("api_settings").select("*").single()

    if (!settings?.access_token || !settings?.phone_number_id) {
      return NextResponse.json({ error: "WhatsApp not configured" }, { status: 500 })
    }

    const mediaInfoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
    })

    if (!mediaInfoResponse.ok) {
      const errorData = await mediaInfoResponse.json()

      // Check if it's an expired/invalid media error
      if (errorData.error?.code === 100 && errorData.error?.error_subcode === 33) {
        console.log(`[v0] Media expired or unavailable: ${mediaId}`)
        return NextResponse.json(
          {
            error: "Media expired",
            expired: true,
          },
          { status: 410 },
        ) // 410 Gone status for expired resources
      }

      console.error("[v0] Failed to fetch media info:", errorData)
      return NextResponse.json({ error: "Failed to fetch media info" }, { status: 500 })
    }

    const mediaInfo = await mediaInfoResponse.json()
    const mediaUrl = mediaInfo.url

    if (!mediaUrl) {
      return NextResponse.json({ error: "Media URL not found" }, { status: 404 })
    }

    const imageResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
    })

    if (!imageResponse.ok) {
      console.error("[v0] Failed to download image:", await imageResponse.text())
      return NextResponse.json({ error: "Failed to download image" }, { status: 500 })
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString("base64")
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg"
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    return NextResponse.json({ dataUrl, mimeType })
  } catch (error) {
    console.error("[v0] Error fetching WhatsApp media:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch media" },
      { status: 500 },
    )
  }
}
