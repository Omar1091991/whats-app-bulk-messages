import { NextResponse } from "next/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"
import { createClient } from "@/lib/supabase/server"

// Helper function to normalize phone numbers
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d]/g, "")
}

export async function POST(request: Request) {
  try {
    const { phoneNumbers, messageText, mediaUrl, mediaInputType, mediaValue } = await request.json()

    console.log("[v0] ===== بدء إرسال رسائل حرة جماعية =====")
    console.log("[v0] عدد الأرقام:", phoneNumbers?.length)
    console.log("[v0] نص الرسالة:", messageText?.substring(0, 50) + "...")

    if (!phoneNumbers || phoneNumbers.length === 0) {
      console.error("[v0] خطأ: لا توجد أرقام هاتف")
      return NextResponse.json({ error: "يجب إدخال أرقام هاتف", success: false }, { status: 400 })
    }

    if (!messageText || messageText.trim().length === 0) {
      console.error("[v0] خطأ: نص الرسالة فارغ")
      return NextResponse.json({ error: "يجب إدخال نص الرسالة", success: false }, { status: 400 })
    }

    const supabaseClient = await createClient()

    // Get API settings
    const { data: settingsData, error: settingsError } = await supabaseClient.from("api_settings").select("*").limit(1)
    const settings = settingsData?.[0]

    if (settingsError || !settings) {
      console.error("[v0] خطأ في جلب إعدادات API:", settingsError)
      return NextResponse.json({ error: "API settings not configured", success: false }, { status: 500 })
    }

    if (!settings.phone_number_id || !settings.access_token) {
      return NextResponse.json(
        { error: "إعدادات API غير مكتملة. يرجى التحقق من الإعدادات", success: false },
        { status: 500 },
      )
    }

    console.log("[v0] Using Phone Number ID:", settings.phone_number_id)

    // Check rate limits
    console.log("[v0] جاري فحص حدود الإرسال من Meta...")
    const rateLimitsResponse = await fetch(`${request.url.split("/api/")[0]}/api/meta-rate-limits`)
    const rateLimitsData = await rateLimitsResponse.json()

    if (!rateLimitsResponse.ok || !rateLimitsData.success) {
      console.warn("[v0] تحذير: فشل جلب حدود الإرسال من Meta، استخدام الحد الافتراضي")
      rateLimitsData.dailyLimit = 1000
      rateLimitsData.remaining = 1000
    }

    if (rateLimitsData.remaining <= 0) {
      console.warn("[v0] ⚠️ تحذير: تم تجاوز الحد اليومي للرسائل")
    }

    const url = getWhatsAppApiUrl(`${settings.phone_number_id}/messages`)
    const results = []
    let successCount = 0
    let failureCount = 0

    // Determine if we're sending text-only or image with caption
    const hasMedia = (mediaUrl && mediaUrl.trim()) || (mediaValue && mediaValue.trim())

    console.log("[v0] نوع الرسالة:", hasMedia ? "صورة مع نص" : "نص فقط")

    for (const phoneNumber of phoneNumbers) {
      const cleanPhone = normalizePhoneNumber(phoneNumber)

      try {
        let messagePayload: any

        if (hasMedia) {
          // Send image with caption
          const imageValue = mediaInputType === "id" ? mediaValue : mediaUrl

          messagePayload = {
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "image",
            image:
              mediaInputType === "id"
                ? {
                    id: imageValue,
                  }
                : {
                    link: imageValue,
                  },
          }

          // Add caption if message text is provided
          if (messageText && messageText.trim()) {
            messagePayload.image.caption = messageText.trim()
          }
        } else {
          // Send text-only message
          messagePayload = {
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "text",
            text: {
              body: messageText.trim(),
            },
          }
        }

        console.log(`[v0] إرسال رسالة إلى: ${cleanPhone}`)

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messagePayload),
        })

        const data = await response.json()

        if (!response.ok) {
          console.error(`[v0] فشل الإرسال إلى ${cleanPhone}:`, data.error?.message)

          if (data.error?.code === 190 || data.error?.type === "OAuthException") {
            return NextResponse.json(
              {
                error: data.error?.message || "Access token has expired",
                errorType: "TOKEN_EXPIRED",
                success: false,
              },
              { status: 401 },
            )
          }

          failureCount++
          results.push({
            phoneNumber: cleanPhone,
            success: false,
            error: data.error?.message || "فشل الإرسال",
          })
        } else {
          console.log(`[v0] ✅ تم الإرسال بنجاح إلى ${cleanPhone}`)
          successCount++

          // Save to database
          await supabaseClient.from("message_history").insert({
            message_id: data.messages?.[0]?.id,
            to_number: cleanPhone,
            template_name: null, // No template for free messages
            message_type: "bulk_free",
            message_text: messageText.trim(),
            media_url: hasMedia ? (mediaInputType === "id" ? mediaValue : mediaUrl) : null,
            status: data.messages?.[0]?.message_status || "sent",
          })

          results.push({
            phoneNumber: cleanPhone,
            success: true,
            messageId: data.messages?.[0]?.id,
          })
        }

        // Add delay between messages to avoid rate limiting
        if (phoneNumbers.indexOf(phoneNumber) < phoneNumbers.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`[v0] خطأ في إرسال الرسالة إلى ${cleanPhone}:`, error)
        failureCount++
        results.push({
          phoneNumber: cleanPhone,
          success: false,
          error: error instanceof Error ? error.message : "خطأ غير معروف",
        })
      }
    }

    console.log("[v0] ===== انتهى الإرسال =====")
    console.log(`[v0] نجح: ${successCount}, فشل: ${failureCount}`)

    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      totalSent: phoneNumbers.length,
      results,
      dailyLimit: {
        limit: rateLimitsData.dailyLimit,
        used: rateLimitsData.used + successCount,
        remaining: rateLimitsData.remaining - successCount,
        tier: rateLimitsData.messagingLimitTier,
        qualityRating: rateLimitsData.qualityRating,
      },
    })
  } catch (error) {
    console.error("[v0] ❌ خطأ في إرسال الرسائل:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "فشل في إرسال الرسائل",
        success: false,
      },
      { status: 500 },
    )
  }
}
