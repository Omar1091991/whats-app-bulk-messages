import { NextResponse } from "next/server"
import { createClient } from "@/lib/neon/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization")
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const neonClient = await createClient()

    // Calculate stats for yesterday (since today is not complete yet)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const yesterdayISO = yesterday.toISOString()

    const endOfYesterday = new Date(yesterday)
    endOfYesterday.setHours(23, 59, 59, 999)
    const endOfYesterdayISO = endOfYesterday.toISOString()

    const yesterdayDate = yesterday.toISOString().split("T")[0]

    console.log("[v0] Calculating daily stats for:", yesterdayDate)

    // Check if stats already exist for this date
    const { data: existingStats } = await neonClient
      .from("daily_statistics")
      .select("id")
      .eq("date", yesterdayDate)
      .single()

    if (existingStats) {
      console.log("[v0] Stats already exist for", yesterdayDate)
      return NextResponse.json({ message: "Stats already calculated for this date", date: yesterdayDate })
    }

    // Get total sent messages for yesterday
    const { count: totalSent } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .gte("created_at", yesterdayISO)
      .lte("created_at", endOfYesterdayISO)

    // Get messages by type
    const { count: singleMessages } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .eq("message_type", "single")
      .gte("created_at", yesterdayISO)
      .lte("created_at", endOfYesterdayISO)

    const { count: bulkInstantMessages } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .eq("message_type", "bulk_instant")
      .gte("created_at", yesterdayISO)
      .lte("created_at", endOfYesterdayISO)

    const { count: bulkScheduledMessages } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .eq("message_type", "bulk_scheduled")
      .gte("created_at", yesterdayISO)
      .lte("created_at", endOfYesterdayISO)

    const { count: replyMessages } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .eq("message_type", "reply")
      .gte("created_at", yesterdayISO)
      .lte("created_at", endOfYesterdayISO)

    // Get successful messages
    const { count: successfulMessages } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .in("status", ["delivered", "sent", "read"])
      .gte("created_at", yesterdayISO)
      .lte("created_at", endOfYesterdayISO)

    // Get failed messages
    const { count: failedMessages } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", yesterdayISO)
      .lte("created_at", endOfYesterdayISO)

    // Get unique templates
    const { data: templates } = await neonClient
      .from("message_history")
      .select("template_name")
      .not("template_name", "is", null)
      .gte("created_at", yesterdayISO)
      .lte("created_at", endOfYesterdayISO)

    const uniqueTemplates = new Set(templates?.map((t) => t.template_name).filter(Boolean))

    // Get incoming messages
    const { count: incomingMessages } = await neonClient
      .from("webhook_messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", yesterdayISO)
      .lte("created_at", endOfYesterdayISO)

    // Get scheduled messages stats
    const { count: scheduledCompleted } = await neonClient
      .from("scheduled_messages")
      .select("*", { count: "exact", head: true })
      .in("status", ["sent", "completed"])
      .gte("processed_at", yesterdayISO)
      .lte("processed_at", endOfYesterdayISO)

    const { count: scheduledFailed } = await neonClient
      .from("scheduled_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("processed_at", yesterdayISO)
      .lte("processed_at", endOfYesterdayISO)

    // Insert daily statistics
    const { error: insertError } = await neonClient.from("daily_statistics").insert({
      date: yesterdayDate,
      total_sent: totalSent || 0,
      single_messages: singleMessages || 0,
      bulk_instant_messages: bulkInstantMessages || 0,
      bulk_scheduled_messages: bulkScheduledMessages || 0,
      reply_messages: replyMessages || 0,
      successful_messages: successfulMessages || 0,
      failed_messages: failedMessages || 0,
      incoming_messages: incomingMessages || 0,
      unique_templates: uniqueTemplates.size,
      scheduled_completed: scheduledCompleted || 0,
      scheduled_failed: scheduledFailed || 0,
    })

    if (insertError) {
      console.error("[v0] Error inserting daily stats:", insertError)
      throw insertError
    }

    console.log("[v0] Successfully calculated and stored daily stats for", yesterdayDate)

    return NextResponse.json({
      success: true,
      date: yesterdayDate,
      stats: {
        totalSent: totalSent || 0,
        singleMessages: singleMessages || 0,
        bulkInstantMessages: bulkInstantMessages || 0,
        bulkScheduledMessages: bulkScheduledMessages || 0,
        replyMessages: replyMessages || 0,
        successfulMessages: successfulMessages || 0,
        failedMessages: failedMessages || 0,
        incomingMessages: incomingMessages || 0,
        uniqueTemplates: uniqueTemplates.size,
        scheduledCompleted: scheduledCompleted || 0,
        scheduledFailed: scheduledFailed || 0,
      },
    })
  } catch (error) {
    console.error("[v0] Error calculating daily stats:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to calculate daily stats",
      },
      { status: 500 },
    )
  }
}
