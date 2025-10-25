import { NextResponse } from "next/server"
import { createClient } from "@/lib/neon/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { phoneNumbers, templateId, imageUrl, scheduledTime } = await request.json()

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return NextResponse.json({ error: "Missing or invalid phone numbers" }, { status: 400 })
    }

    if (!templateId) {
      return NextResponse.json({ error: "Missing template ID" }, { status: 400 })
    }

    if (!scheduledTime) {
      return NextResponse.json({ error: "Missing scheduled time" }, { status: 400 })
    }

    const scheduledDateTime = new Date(scheduledTime)
    if (scheduledDateTime <= new Date()) {
      return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 })
    }

    const neonClient = await createClient()

    // Fetch template details to get name and language
    const { data: settingsData } = await neonClient.from("api_settings").select("*").limit(1)
    const settings = settingsData?.[0]

    if (!settings) {
      return NextResponse.json({ error: "API settings not configured" }, { status: 500 })
    }

    // Fetch template details from WhatsApp API
    const templatesUrl = `https://graph.facebook.com/v21.0/${settings.business_account_id}/message_templates`
    const templatesResponse = await fetch(templatesUrl, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
    })

    if (!templatesResponse.ok) {
      throw new Error("Failed to fetch template details")
    }

    const templatesData = await templatesResponse.json()
    const template = templatesData.data?.find((t: { id: string }) => t.id === templateId)

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Determine media type from template
    const headerComponent = template.components?.find((c: { type: string; format?: string }) => c.type === "HEADER")
    const mediaType = headerComponent?.format || null

    // Store template parameters
    const templateParams = {
      name: template.name,
      language: template.language,
    }

    // Insert scheduled message into database
    const { data, error } = await neonClient
      .from("scheduled_messages")
      .insert({
        scheduled_time: scheduledDateTime.toISOString(),
        template_name: template.name,
        phone_numbers: phoneNumbers,
        template_params: templateParams,
        media_type: mediaType,
        media_url: imageUrl || null,
        total_numbers: phoneNumbers.length,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error inserting scheduled message:", error)
      return NextResponse.json({ error: "Failed to schedule message" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      scheduledMessageId: data.id,
      scheduledTime: scheduledDateTime.toISOString(),
      totalNumbers: phoneNumbers.length,
    })
  } catch (error) {
    console.error("[v0] Error scheduling messages:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to schedule messages",
      },
      { status: 500 },
    )
  }
}

// GET endpoint to fetch scheduled messages
export async function GET() {
  try {
    const neonClient = await createClient()

    const { data, error } = await neonClient
      .from("scheduled_messages")
      .select("*")
      .order("scheduled_time", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching scheduled messages:", error)
      return NextResponse.json({ error: "Failed to fetch scheduled messages" }, { status: 500 })
    }

    return NextResponse.json({ scheduledMessages: data })
  } catch (error) {
    console.error("[v0] Error fetching scheduled messages:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch scheduled messages",
      },
      { status: 500 },
    )
  }
}

// DELETE endpoint to cancel a scheduled message
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing message ID" }, { status: 400 })
    }

    const neonClient = await createClient()

    const { error } = await neonClient.from("scheduled_messages").delete().eq("id", id).eq("status", "pending")

    if (error) {
      console.error("[v0] Error deleting scheduled message:", error)
      return NextResponse.json({ error: "Failed to delete scheduled message" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting scheduled message:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete scheduled message",
      },
      { status: 500 },
    )
  }
}

// PATCH endpoint to update a scheduled message
export async function PATCH(request: Request) {
  try {
    const { id, scheduledTime, phoneNumbers, templateId, imageUrl } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Missing message ID" }, { status: 400 })
    }

    const neonClient = await createClient()

    // Check if message exists and is still pending
    const { data: existingMessage, error: fetchError } = await neonClient
      .from("scheduled_messages")
      .select("*")
      .eq("id", id)
      .eq("status", "pending")
      .single()

    if (fetchError || !existingMessage) {
      return NextResponse.json({ error: "Message not found or already processed" }, { status: 404 })
    }

    const updates: {
      scheduled_time?: string
      phone_numbers?: string[]
      total_numbers?: number
      template_name?: string
      template_params?: any
      media_url?: string | null
      media_type?: string | null
      updated_at: string
    } = {
      updated_at: new Date().toISOString(),
    }

    // Handle scheduled time update
    if (scheduledTime) {
      const scheduledDateTime = new Date(scheduledTime)
      updates.scheduled_time = scheduledDateTime.toISOString()

      if (scheduledDateTime <= new Date()) {
        // Send immediately by calling the send endpoint
        const sendResponse = await fetch(`${request.url.split("/api")[0]}/api/scheduled-messages/send-now`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: id,
            phoneNumbers: phoneNumbers || existingMessage.phone_numbers,
            templateName: existingMessage.template_name,
            templateParams: existingMessage.template_params,
            mediaUrl: imageUrl !== undefined ? imageUrl : existingMessage.media_url,
            mediaType: existingMessage.media_type,
          }),
        })

        if (!sendResponse.ok) {
          return NextResponse.json({ error: "Failed to send message immediately" }, { status: 500 })
        }

        const sendData = await sendResponse.json()
        return NextResponse.json({ success: true, sentImmediately: true, ...sendData })
      }
    }

    // Handle phone numbers update
    if (phoneNumbers && Array.isArray(phoneNumbers)) {
      updates.phone_numbers = phoneNumbers
      updates.total_numbers = phoneNumbers.length
    }

    // Handle template update
    if (templateId) {
      const { data: settingsData } = await neonClient.from("api_settings").select("*").limit(1)
      const settings = settingsData?.[0]

      if (!settings) {
        return NextResponse.json({ error: "API settings not configured" }, { status: 500 })
      }

      // Fetch template details from WhatsApp API
      const templatesUrl = `https://graph.facebook.com/v21.0/${settings.business_account_id}/message_templates`
      const templatesResponse = await fetch(templatesUrl, {
        headers: {
          Authorization: `Bearer ${settings.access_token}`,
        },
      })

      if (!templatesResponse.ok) {
        throw new Error("Failed to fetch template details")
      }

      const templatesData = await templatesResponse.json()
      const template = templatesData.data?.find((t: { id: string }) => t.id === templateId)

      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 })
      }

      // Determine media type from template
      const headerComponent = template.components?.find((c: { type: string; format?: string }) => c.type === "HEADER")
      const mediaType = headerComponent?.format || null

      updates.template_name = template.name
      updates.template_params = {
        name: template.name,
        language: template.language,
      }
      updates.media_type = mediaType
    }

    // Handle image URL update
    if (imageUrl !== undefined) {
      updates.media_url = imageUrl || null
    }

    const { error } = await neonClient.from("scheduled_messages").update(updates).eq("id", id).eq("status", "pending")

    if (error) {
      console.error("[v0] Error updating scheduled message:", error)
      return NextResponse.json({ error: "Failed to update scheduled message" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error updating scheduled message:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update scheduled message",
      },
      { status: 500 },
    )
  }
}
