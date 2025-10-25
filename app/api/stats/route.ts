import { NextResponse } from "next/server"
import { createClient } from "@/lib/neon/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const neonClient = await createClient()

    if (date) {
      const { data: dailyStats } = await neonClient.from("daily_statistics").select("*").eq("date", date).maybeSingle()

      if (!dailyStats) {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        const startISO = startOfDay.toISOString()
        const endISO = endOfDay.toISOString()

        const { count: totalSent } = await neonClient
          .from("message_history")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startISO)
          .lte("created_at", endISO)

        const { count: successfulMessages } = await neonClient
          .from("message_history")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .in("status", ["delivered", "sent", "read"])

        const { count: failedMessages } = await neonClient
          .from("message_history")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .eq("status", "failed")

        const { count: singleMessages } = await neonClient
          .from("message_history")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .eq("message_type", "single")

        const { count: bulkInstantMessages } = await neonClient
          .from("message_history")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .eq("message_type", "bulk_instant")

        const { count: bulkScheduledMessages } = await neonClient
          .from("message_history")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .eq("message_type", "bulk_scheduled")

        const { count: replyMessages } = await neonClient
          .from("message_history")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .eq("message_type", "reply")

        const { data: templates } = await neonClient
          .from("message_history")
          .select("template_name")
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .not("template_name", "is", null)

        const uniqueTemplates = new Set(templates?.map((t) => t.template_name).filter(Boolean))

        const { count: incomingMessages } = await neonClient
          .from("webhook_messages")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startISO)
          .lte("created_at", endISO)

        return NextResponse.json({
          date,
          totalSent: totalSent || 0,
          successfulMessages: successfulMessages || 0,
          failedMessages: failedMessages || 0,
          templatesCount: uniqueTemplates.size,
          incomingMessages: incomingMessages || 0,
          messagesByType: {
            single: singleMessages || 0,
            bulkInstant: bulkInstantMessages || 0,
            bulkScheduled: bulkScheduledMessages || 0,
            reply: replyMessages || 0,
          },
          scheduledMessages: {
            completed: 0,
            failed: 0,
          },
          calculated: true,
        })
      }

      return NextResponse.json({
        date: dailyStats.date,
        totalSent: dailyStats.total_sent,
        successfulMessages: dailyStats.successful_messages,
        failedMessages: dailyStats.failed_messages,
        templatesCount: dailyStats.unique_templates,
        incomingMessages: dailyStats.incoming_messages,
        messagesByType: {
          single: dailyStats.single_messages,
          bulkInstant: dailyStats.bulk_instant_messages,
          bulkScheduled: dailyStats.bulk_scheduled_messages,
          reply: dailyStats.reply_messages,
        },
        scheduledMessages: {
          completed: dailyStats.scheduled_completed,
          failed: dailyStats.scheduled_failed,
        },
      })
    }

    if (startDate && endDate) {
      const { data: rangeStats, error } = await neonClient
        .from("daily_statistics")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false })

      if (error) {
        throw error
      }

      const aggregated = rangeStats?.reduce(
        (acc, day) => ({
          totalSent: acc.totalSent + (day.total_sent || 0),
          successfulMessages: acc.successfulMessages + (day.successful_messages || 0),
          failedMessages: acc.failedMessages + (day.failed_messages || 0),
          incomingMessages: acc.incomingMessages + (day.incoming_messages || 0),
          singleMessages: acc.singleMessages + (day.single_messages || 0),
          bulkInstantMessages: acc.bulkInstantMessages + (day.bulk_instant_messages || 0),
          bulkScheduledMessages: acc.bulkScheduledMessages + (day.bulk_scheduled_messages || 0),
          replyMessages: acc.replyMessages + (day.reply_messages || 0),
        }),
        {
          totalSent: 0,
          successfulMessages: 0,
          failedMessages: 0,
          incomingMessages: 0,
          singleMessages: 0,
          bulkInstantMessages: 0,
          bulkScheduledMessages: 0,
          replyMessages: 0,
        },
      )

      return NextResponse.json({
        startDate,
        endDate,
        ...aggregated,
        dailyBreakdown: rangeStats,
      })
    }

    // حساب الرسائل المرسلة فعلياً من message_history فقط
    const { count: totalSent } = await neonClient.from("message_history").select("*", { count: "exact", head: true })

    const { count: singleMessages } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .eq("message_type", "single")

    const { count: bulkInstantMessages } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .eq("message_type", "bulk_instant")

    const { count: bulkScheduledMessages } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .eq("message_type", "bulk_scheduled")

    const { count: replyMessages } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .eq("message_type", "reply")

    const { count: successfulMessages } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .in("status", ["delivered", "sent", "read"])

    const { data: templates } = await neonClient
      .from("message_history")
      .select("template_name")
      .not("template_name", "is", null)

    const uniqueTemplates = new Set(templates?.map((t) => t.template_name).filter(Boolean))

    const { count: incomingMessages } = await neonClient
      .from("webhook_messages")
      .select("*", { count: "exact", head: true })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const { count: todaySent } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayISO)

    const { count: todaySuccessful } = await neonClient
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayISO)
      .in("status", ["delivered", "sent", "read"])

    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const endOfTodayISO = endOfToday.toISOString()

    const { count: pendingScheduled } = await neonClient
      .from("scheduled_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")

    const { count: todayScheduled } = await neonClient
      .from("scheduled_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("scheduled_time", todayISO)
      .lte("scheduled_time", endOfTodayISO)

    const { count: completedScheduled } = await neonClient
      .from("scheduled_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")

    const { count: failedScheduled } = await neonClient
      .from("scheduled_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")

    console.log("[v0] Stats calculated:", {
      totalSent,
      successfulMessages,
      pendingScheduled,
      completedScheduled,
      failedScheduled,
    })

    let metaRateLimits = null
    try {
      const rateLimitsResponse = await fetch(`${request.url.split("/api/")[0]}/api/meta-rate-limits`)
      if (rateLimitsResponse.ok) {
        metaRateLimits = await rateLimitsResponse.json()
      }
    } catch (error) {
      console.warn("[v0] Could not fetch Meta rate limits for stats:", error)
    }

    return NextResponse.json({
      totalSent: totalSent || 0,
      successfulMessages: successfulMessages || 0,
      templatesCount: uniqueTemplates.size,
      incomingMessages: incomingMessages || 0,
      messagesByType: {
        single: singleMessages || 0,
        bulkInstant: bulkInstantMessages || 0,
        bulkScheduled: bulkScheduledMessages || 0,
        reply: replyMessages || 0,
      },
      todayStats: {
        sent: todaySent || 0,
        successful: todaySuccessful || 0,
      },
      scheduledMessages: {
        pending: pendingScheduled || 0,
        today: todayScheduled || 0,
        completed: completedScheduled || 0,
        failed: failedScheduled || 0,
      },
      metaRateLimits: metaRateLimits?.success ? metaRateLimits : null,
    })
  } catch (error) {
    console.error("[v0] Error fetching stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
