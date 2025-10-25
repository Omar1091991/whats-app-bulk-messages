import { NextResponse } from "next/server"
import { createClient } from "@/lib/neon/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { messageId, phoneNumbers, templateName, templateParams, mediaUrl, mediaType } = await request.json()

    if (!messageId || !phoneNumbers || !templateName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const neonClient = await createClient()

    // Update status to processing
    await neonClient.from("scheduled_messages").update({ status: "processing" }).eq("id", messageId)

    // Fetch API settings
    const { data: settingsData } = await neonClient.from("api_settings").select("*").limit(1)
    const settings = settingsData?.[0]

    if (!settings) {
      console.error("[v0] API settings not found in database")
      return NextResponse.json({ error: "API settings not configured" }, { status: 500 })
    }

    console.log("[v0] Using API settings for send-now:", {
      phone_number_id: settings.phone_number_id,
      business_account_id: settings.business_account_id,
      has_access_token: !!settings.access_token,
      access_token_length: settings.access_token?.length || 0,
    })

    const url = getWhatsAppApiUrl(`${settings.phone_number_id}/messages`)
    console.log("[v0] WhatsApp API URL:", url)

    // Send messages
    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const phoneNumber of phoneNumbers) {
      try {
        const messagePayload: any = {
          messaging_product: "whatsapp",
          to: phoneNumber.replace("+", ""),
          type: "template",
          template: {
            name: templateName,
            language: {
              code: templateParams.language,
            },
          },
        }

        // Add media if present
        if (mediaType && mediaUrl) {
          messagePayload.template.components = [
            {
              type: "header",
              parameters: [
                {
                  type: mediaType.toLowerCase(),
                  [mediaType.toLowerCase()]: {
                    link: mediaUrl,
                  },
                },
              ],
            },
          ]
        }

        console.log("[v0] Sending message to:", phoneNumber, "Template:", templateName)

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messagePayload),
        })

        const responseData = await response.json()

        if (response.ok && responseData.messages && responseData.messages.length > 0) {
          const messageId = responseData.messages[0].id
          console.log("[v0] ✓ Message sent successfully to", phoneNumber, "Message ID:", messageId)
          successCount++

          // Store in message history
          await neonClient.from("message_history").insert({
            to_number: phoneNumber,
            message_id: messageId,
            template_name: templateName,
            message_type: "bulk_scheduled",
            status: "sent",
          })
        } else {
          const errorMessage = responseData.error?.message || JSON.stringify(responseData)
          console.error("[v0] ✗ Failed to send to", phoneNumber, "Status:", response.status, "Error:", errorMessage)
          errors.push(`${phoneNumber}: ${errorMessage}`)
          failedCount++

          // Store failed message in history
          await neonClient.from("message_history").insert({
            to_number: phoneNumber,
            template_name: templateName,
            message_type: "bulk_scheduled",
            status: "failed",
          })
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        console.error("[v0] ✗ Exception sending to", phoneNumber, ":", errorMsg)
        errors.push(`${phoneNumber}: ${errorMsg}`)
        failedCount++
      }
    }

    // Update scheduled message with results
    let finalStatus: "sent" | "failed" | "partial" = "sent"
    if (successCount === 0) {
      finalStatus = "failed"
    } else if (failedCount > 0) {
      finalStatus = "partial"
    }

    await neonClient
      .from("scheduled_messages")
      .update({
        status: finalStatus,
        sent_count: successCount,
        failed_count: failedCount,
        processed_at: new Date().toISOString(),
        error_message: errors.length > 0 ? errors.join("; ") : null,
      })
      .eq("id", messageId)

    return NextResponse.json({
      success: successCount > 0,
      successCount,
      failedCount,
      totalNumbers: phoneNumbers.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("[v0] Error sending scheduled message immediately:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send message",
      },
      { status: 500 },
    )
  }
}
