import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

async function fetchMediaAsDataUrl(mediaId: string, accessToken: string): Promise<string | null> {
  try {
    console.log("[v0] Fetching media URL for ID:", mediaId)

    // الخطوة 1: جلب رابط الصورة من WhatsApp
    const mediaInfoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!mediaInfoResponse.ok) {
      console.error("[v0] Failed to fetch media info:", await mediaInfoResponse.text())
      return null
    }

    const mediaInfo = await mediaInfoResponse.json()
    const mediaUrl = mediaInfo.url

    if (!mediaUrl) {
      console.error("[v0] No URL in media info response")
      return null
    }

    console.log("[v0] Media URL retrieved:", mediaUrl)

    // الخطوة 2: تحميل الصورة
    const imageResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!imageResponse.ok) {
      console.error("[v0] Failed to download image:", await imageResponse.text())
      return null
    }

    // الخطوة 3: تحويل الصورة إلى base64
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64 = Buffer.from(imageBuffer).toString("base64")
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg"
    const dataUrl = `data:${mimeType};base64,${base64}`

    console.log("[v0] Image converted to data URL successfully")
    return dataUrl
  } catch (error) {
    console.error("[v0] Error fetching media:", error)
    return null
  }
}

// GET request for webhook verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  console.log("[v0] Webhook verification request:", { mode, token, challenge })

  if (!mode || !token || !challenge) {
    console.error("[v0] Missing required parameters:", { mode, token, challenge })
    return NextResponse.json(
      { error: "Missing required parameters: hub.mode, hub.verify_token, or hub.challenge" },
      { status: 400 },
    )
  }

  const supabaseClient = await createClient()
  const { data: settingsData, error: dbError } = await supabaseClient
    .from("api_settings")
    .select("webhook_verify_token")
    .limit(1)

  if (dbError) {
    console.error("[v0] Database error:", dbError)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  const settings = settingsData?.[0]
  const verifyToken = settings?.webhook_verify_token

  if (!verifyToken) {
    console.error("[v0] No webhook_verify_token found in database")
    return NextResponse.json({ error: "Webhook verify token not configured" }, { status: 403 })
  }

  console.log("[v0] Comparing tokens - Received:", token, "Expected:", verifyToken)

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[v0] Webhook verified successfully, returning challenge:", challenge)
    return new NextResponse(challenge, { status: 200 })
  } else {
    console.error("[v0] Webhook verification failed - Mode:", mode, "Token match:", token === verifyToken)
    return NextResponse.json(
      {
        error: "Verification failed",
        details: {
          modeValid: mode === "subscribe",
          tokenMatch: token === verifyToken,
        },
      },
      { status: 403 },
    )
  }
}

// POST request for receiving webhook events
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[v0] Webhook received:", JSON.stringify(body, null, 2))

    const supabaseClient = await createClient()

    const { data: settingsData } = await supabaseClient.from("api_settings").select("access_token").limit(1)
    const accessToken = settingsData?.[0]?.access_token

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === "messages") {
            const value = change.value

            for (const message of value.messages || []) {
              console.log("[v0] ===== Processing Message =====")
              console.log("[v0] Message ID:", message.id)
              console.log("[v0] Message Type:", message.type)
              console.log("[v0] Full Message Object:", JSON.stringify(message, null, 2))

              let mediaUrl: string | null = null
              const mediaId = message.image?.id || message.video?.id || message.document?.id

              if (mediaId && accessToken) {
                console.log("[v0] Message contains media, fetching URL...")
                mediaUrl = await fetchMediaAsDataUrl(mediaId, accessToken)
              }

              let messageText = ""
              let messageType = message.type
              let buttonPayload: string | null = null

              // Extract message text based on message type
              if (message.type === "text") {
                // Plain text message
                messageText = message.text?.body || ""
                console.log("[v0] Text message detected:", messageText)
              } else if (message.type === "button") {
                // Template button reply
                messageText = message.button?.text || message.button?.payload || "زر"
                buttonPayload = message.button?.payload || null
                messageType = "button_reply"
                console.log("[v0] Button message detected:", messageText, "Payload:", buttonPayload)
              } else if (message.type === "interactive") {
                // Interactive message (button_reply or list_reply)
                console.log("[v0] Interactive message detected!")
                console.log("[v0] Interactive type:", message.interactive?.type)
                console.log("[v0] Interactive object:", JSON.stringify(message.interactive, null, 2))

                if (message.interactive?.button_reply) {
                  // Interactive button reply
                  messageText =
                    message.interactive.button_reply.title || message.interactive.button_reply.text || "رد سريع"
                  buttonPayload =
                    message.interactive.button_reply.id || message.interactive.button_reply.payload || null
                  messageType = "button_reply"
                  console.log("[v0] Button reply detected:", messageText, "Payload:", buttonPayload)
                } else if (message.interactive?.list_reply) {
                  // Interactive list reply
                  messageText =
                    message.interactive.list_reply.title || message.interactive.list_reply.description || "رد من قائمة"
                  buttonPayload = message.interactive.list_reply.id || null
                  messageType = "list_reply"
                  console.log("[v0] List reply detected:", messageText, "ID:", buttonPayload)
                }
              } else if (message.type === "image" || message.type === "video" || message.type === "document") {
                // Media message with optional caption
                messageText = message.image?.caption || message.video?.caption || message.document?.caption || ""
                console.log("[v0] Media message detected with caption:", messageText)
              }

              console.log("[v0] Final message text:", messageText)
              console.log("[v0] Final message type:", messageType)
              console.log("[v0] Button payload:", buttonPayload)
              console.log("[v0] ===== End Processing Message =====")

              const messageData = {
                message_id: message.id,
                from_number: message.from,
                from_name: value.contacts?.[0]?.profile?.name || "Unknown",
                message_type: messageType,
                message_text: messageText,
                message_media_url: mediaUrl,
                message_media_mime_type:
                  message.image?.mime_type || message.video?.mime_type || message.document?.mime_type || null,
                timestamp: Number.parseInt(message.timestamp),
                status: "unread",
                replied: false,
              }

              const { error } = await supabaseClient.from("webhook_messages").insert(messageData)

              if (error) {
                console.error("[v0] ❌ Error inserting message:", error)
              } else {
                console.log("[v0] ✅ Message stored successfully:", messageData.message_id)
                console.log("[v0] Stored message data:", JSON.stringify(messageData, null, 2))
              }
            }

            for (const status of value.statuses || []) {
              console.log("[v0] Message status update:", {
                id: status.id,
                status: status.status,
                timestamp: status.timestamp,
              })

              await supabaseClient
                .from("message_history")
                .update({
                  status: status.status,
                })
                .eq("message_id", status.id)
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("[v0] Error processing webhook:", error)
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 200 })
  }
}
