import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    // Verify cron secret for security (optional but recommended)
    const authHeader = request.headers.get("authorization")
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()

    // Fetch pending scheduled messages that are due
    const now = new Date().toISOString()
    const { data: scheduledMessages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_time", now)
      .order("scheduled_time", { ascending: true })

    if (fetchError) {
      console.error("[v0] Error fetching scheduled messages:", fetchError)
      return NextResponse.json({ error: "Failed to fetch scheduled messages" }, { status: 500 })
    }

    if (!scheduledMessages || scheduledMessages.length === 0) {
      return NextResponse.json({ message: "No scheduled messages to process", processed: 0 })
    }

    console.log("[v0] Processing", scheduledMessages.length, "scheduled messages")

    // Fetch API settings
    const { data: settingsData } = await supabase.from("api_settings").select("*").limit(1)
    const settings = settingsData?.[0]

    if (!settings) {
      console.error("[v0] API settings not found in database")
      return NextResponse.json({ error: "API settings not configured" }, { status: 500 })
    }

    const templatesUrl = getWhatsAppApiUrl(`${settings.business_account_id}/message_templates`)
    const templatesResponse = await fetch(templatesUrl, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
    })

    const templatesMap = new Map()
    if (templatesResponse.ok) {
      const templatesData = await templatesResponse.json()
      templatesData.data?.forEach((template: { name: string; components: Array<{ type: string; text?: string }> }) => {
        const bodyComponent = template.components?.find((c: { type: string }) => c.type === "BODY")
        templatesMap.set(template.name, bodyComponent?.text || "")
      })
    }

    console.log("[v0] Using API settings:", {
      phone_number_id: settings.phone_number_id,
      business_account_id: settings.business_account_id,
      has_access_token: !!settings.access_token,
      access_token_length: settings.access_token?.length || 0,
    })

    const results = []

    for (const scheduledMessage of scheduledMessages) {
      try {
        // Mark as processing
        await supabase.from("scheduled_messages").update({ status: "processing" }).eq("id", scheduledMessage.id)

        console.log("[v0] Processing scheduled message:", scheduledMessage.id)

        const templateBodyText = templatesMap.get(scheduledMessage.template_name) || ""

        // Prepare message components
        const components = []
        if (scheduledMessage.media_type && scheduledMessage.media_url) {
          components.push({
            type: "header",
            parameters: [
              {
                type: scheduledMessage.media_type.toLowerCase(),
                [scheduledMessage.media_type.toLowerCase()]: {
                  link: scheduledMessage.media_url,
                },
              },
            ],
          })
        }

        const url = getWhatsAppApiUrl(`${settings.phone_number_id}/messages`)
        console.log("[v0] WhatsApp API URL:", url)

        let successCount = 0
        let failureCount = 0
        const errors: string[] = []

        // Send messages to all phone numbers
        for (const phoneNumber of scheduledMessage.phone_numbers) {
          try {
            const messagePayload: {
              messaging_product: string
              to: string
              type: string
              template: {
                name: string
                language: { code: string }
                components?: Array<{
                  type: string
                  parameters: Array<{ type: string; [key: string]: unknown }>
                }>
              }
            } = {
              messaging_product: "whatsapp",
              to: phoneNumber.replace("+", ""),
              type: "template",
              template: {
                name: scheduledMessage.template_name,
                language: {
                  code: scheduledMessage.template_params.language,
                },
              },
            }

            if (components.length > 0) {
              messagePayload.template.components = components
            }

            console.log("[v0] Sending message to:", phoneNumber, "Template:", scheduledMessage.template_name)

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

              await supabase.from("message_history").insert({
                message_id: messageId,
                to_number: phoneNumber,
                template_name: scheduledMessage.template_name,
                message_text: templateBodyText,
                message_type: "bulk_scheduled",
                status: "sent",
              })
            } else {
              const errorMessage = responseData.error?.message || JSON.stringify(responseData)
              console.error("[v0] ✗ Failed to send to", phoneNumber, "Status:", response.status, "Error:", errorMessage)
              errors.push(`${phoneNumber}: ${errorMessage}`)
              failureCount++

              await supabase.from("message_history").insert({
                to_number: phoneNumber,
                template_name: scheduledMessage.template_name,
                message_text: templateBodyText,
                message_type: "bulk_scheduled",
                status: "failed",
              })
            }

            // Small delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 100))
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error"
            console.error("[v0] ✗ Exception sending to", phoneNumber, ":", errorMsg)
            errors.push(`${phoneNumber}: ${errorMsg}`)
            failureCount++
          }
        }

        // Update scheduled message status
        let finalStatus: "sent" | "failed" | "partial" = "sent"
        if (failureCount === scheduledMessage.total_numbers) {
          finalStatus = "failed"
        } else if (failureCount > 0) {
          finalStatus = "partial"
        }

        await supabase
          .from("scheduled_messages")
          .update({
            status: finalStatus,
            sent_count: successCount,
            failed_count: failureCount,
            processed_at: new Date().toISOString(),
            error_message: errors.length > 0 ? errors.join("; ") : null,
          })
          .eq("id", scheduledMessage.id)

        results.push({
          id: scheduledMessage.id,
          successCount,
          failureCount,
          total: scheduledMessage.total_numbers,
          errors: errors.length > 0 ? errors : undefined,
        })

        console.log(
          "[v0] Completed scheduled message:",
          scheduledMessage.id,
          "Success:",
          successCount,
          "Failed:",
          failureCount,
          "- Stats will be reflected in message_history",
        )
      } catch (error) {
        console.error("[v0] Error processing scheduled message:", scheduledMessage.id, error)

        // Mark as failed
        await supabase
          .from("scheduled_messages")
          .update({
            status: "failed",
            processed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", scheduledMessage.id)

        results.push({
          id: scheduledMessage.id,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    console.log("[v0] Scheduled messages processing complete. All sent messages are now in message_history.")

    return NextResponse.json({
      success: true,
      processed: scheduledMessages.length,
      results,
    })
  } catch (error) {
    console.error("[v0] Error in cron job:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process scheduled messages",
      },
      { status: 500 },
    )
  }
}
