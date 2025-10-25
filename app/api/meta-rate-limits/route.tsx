import { NextResponse } from "next/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface MetaRateLimitResponse {
  quality_rating: string
  messaging_limit_tier: string
}

let cachedRateLimits: any = null
let cacheTimestamp = 0
const CACHE_DURATION = 60000 // 1 minute cache

export async function GET() {
  try {
    const now = Date.now()
    if (cachedRateLimits && now - cacheTimestamp < CACHE_DURATION) {
      console.log("[v0] Returning cached rate limits")
      return NextResponse.json(cachedRateLimits)
    }

    const supabase = await createClient()

    const { data: settingsData, error: settingsError } = await supabase.from("api_settings").select("*").limit(1)

    if (settingsError) {
      console.error("[v0] Supabase error fetching API settings:", {
        message: settingsError.message,
        code: settingsError.code,
        details: settingsError.details,
      })
      return NextResponse.json(
        {
          error: "فشل في جلب إعدادات API من قاعدة البيانات",
          success: false,
          qualityRating: "UNKNOWN",
          messagingLimitTier: "TIER_1K",
          dailyLimit: 1000,
          used: 0,
          remaining: 1000,
          percentage: 0,
        },
        { status: 200 },
      )
    }

    const settings = settingsData?.[0]

    if (!settings) {
      return NextResponse.json(
        {
          error: "إعدادات API غير موجودة",
          success: false,
          qualityRating: "UNKNOWN",
          messagingLimitTier: "TIER_1K",
          dailyLimit: 1000,
          used: 0,
          remaining: 1000,
          percentage: 0,
        },
        { status: 200 },
      )
    }

    if (!settings.phone_number_id || !settings.access_token) {
      return NextResponse.json(
        {
          error: "إعدادات API غير مكتملة",
          success: false,
          qualityRating: "UNKNOWN",
          messagingLimitTier: "TIER_1K",
          dailyLimit: 1000,
          used: 0,
          remaining: 1000,
          percentage: 0,
        },
        { status: 200 },
      )
    }

    const url = getWhatsAppApiUrl(`${settings.phone_number_id}?fields=quality_rating,messaging_limit_tier`)

    console.log("[v0] Fetching rate limits from Meta:", url)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
    })

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: { message: await response.text() } }
      }

      console.error("[v0] Meta API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      })

      if (errorData.error?.code === 190 || errorData.error?.type === "OAuthException") {
        return NextResponse.json(
          {
            error: errorData.error?.message || "انتهت صلاحية Access Token",
            errorType: "TOKEN_EXPIRED",
            success: false,
            qualityRating: "UNKNOWN",
            messagingLimitTier: "TIER_1K",
            dailyLimit: 1000,
            used: 0,
            remaining: 1000,
            percentage: 0,
          },
          { status: 200 },
        )
      }

      return NextResponse.json(
        {
          error: "فشل في جلب الحدود من Meta",
          success: false,
          qualityRating: "UNKNOWN",
          messagingLimitTier: "TIER_1K",
          dailyLimit: 1000,
          used: 0,
          remaining: 1000,
          percentage: 0,
        },
        { status: 200 },
      )
    }

    const data: MetaRateLimitResponse = await response.json()

    console.log("[v0] Meta rate limits:", data)

    const tierLimits: Record<string, number> = {
      TIER_50: 50,
      TIER_250: 250,
      TIER_1K: 1000,
      TIER_10K: 10000,
      TIER_100K: 100000,
      TIER_UNLIMITED: 1000000,
    }

    const dailyLimit = tierLimits[data.messaging_limit_tier] || 1000

    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
    const twentyFourHoursAgoISO = twentyFourHoursAgo.toISOString()

    // Count only messages that were successfully delivered (sent, delivered, or read)
    const { count: last24hMessageCount } = await supabase
      .from("message_history")
      .select("*", { count: "exact", head: true })
      .gte("created_at", twentyFourHoursAgoISO)
      .in("status", ["sent", "delivered", "read"])

    console.log("[v0] Successfully delivered messages in last 24h:", last24hMessageCount)
    // </CHANGE>

    const remaining = Math.max(0, dailyLimit - (last24hMessageCount || 0))

    const result = {
      success: true,
      qualityRating: data.quality_rating,
      messagingLimitTier: data.messaging_limit_tier,
      dailyLimit,
      used: last24hMessageCount || 0,
      remaining,
      percentage: Math.round(((last24hMessageCount || 0) / dailyLimit) * 100),
    }

    cachedRateLimits = result
    cacheTimestamp = now

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Error fetching Meta rate limits:", {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
    })

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "فشل في جلب حدود الإرسال",
        success: false,
        qualityRating: "UNKNOWN",
        messagingLimitTier: "TIER_1K",
        dailyLimit: 1000,
        used: 0,
        remaining: 1000,
        percentage: 0,
      },
      { status: 200 },
    )
  }
}
