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

    let mediaInfoResponse
    try {
      mediaInfoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: {
          Authorization: `Bearer ${settings.access_token}`,
        },
      })
    } catch (fetchError) {
      console.log(
        `[v0] Network error fetching media info for ${mediaId}:`,
        fetchError instanceof Error ? fetchError.message : "Unknown error",
      )
      return NextResponse.json(
        {
          error: "Network error",
          expired: true,
        },
        { status: 410 },
      )
    }

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

      console.log(`[v0] Failed to fetch media info for ${mediaId}:`, errorData.error?.message || "Unknown error")
      return NextResponse.json({ error: "Failed to fetch media info", expired: true }, { status: 410 })
    }

    const mediaInfo = await mediaInfoResponse.json()
    const mediaUrl = mediaInfo.url

    if (!mediaUrl) {
      console.log(`[v0] Media URL not found for ${mediaId}`)
      return NextResponse.json({ error: "Media URL not found", expired: true }, { status: 410 })
    }

    const imageResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
    })

    if (!imageResponse.ok) {
      console.log(`[v0] Failed to download image for ${mediaId}:`, imageResponse.status)
      return NextResponse.json({ error: "Failed to download image", expired: true }, { status: 410 })
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString("base64")
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg"
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    return NextResponse.json({ dataUrl, mimeType })
  } catch (error) {
    console.log("[v0] Error fetching WhatsApp media:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch media", expired: true },
      { status: 410 },
    )
  }
}
