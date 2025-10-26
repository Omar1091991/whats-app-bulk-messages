import { NextResponse } from "next/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"
import { createClient } from "@/lib/supabase/server"

function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "")
  return cleaned
}

export async function POST(request: Request) {
  try {
    const { phoneNumbers, templateId, imageUrl, mediaId, mediaInputType, mediaValue } = await request.json()

    console.log("[v0] ===== بدء إرسال رسائل جماعية =====")
    console.log("[v0] عدد الأرقام:", phoneNumbers?.length)
    console.log("[v0] معرف القالب:", templateId)
    console.log("[v0] رابط الصورة:", imageUrl)
    console.log("[v0] Media ID (مباشر):", mediaId)
    console.log("[v0] Media Input Type:", mediaInputType)
    console.log("[v0] Media Value:", mediaValue)

    const finalMediaId = mediaId || (mediaInputType === "id" ? mediaValue : null)
    const finalImageUrl = imageUrl || (mediaInputType === "url" ? mediaValue : null)

    console.log("[v0] Final Media ID:", finalMediaId)
    console.log("[v0] Final Image URL:", finalImageUrl)

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      console.error("[v0] خطأ: أرقام الهاتف مفقودة أو غير صحيحة")
      return NextResponse.json({ error: "Missing or invalid phone numbers", success: false }, { status: 400 })
    }

    if (!templateId) {
      console.error("[v0] خطأ: معرف القالب مفقود")
      return NextResponse.json({ error: "Missing template ID", success: false }, { status: 400 })
    }

    const supabaseClient = await createClient()

    console.log("[v0] جاري فحص حدود الإرسال من Meta...")
    const rateLimitsResponse = await fetch(`${request.url.split("/api/")[0]}/api/meta-rate-limits`)
    const rateLimitsData = await rateLimitsResponse.json()

    console.log("[v0] استجابة حدود الإرسال:", {
      ok: rateLimitsResponse.ok,
      status: rateLimitsResponse.status,
      success: rateLimitsData.success,
      dailyLimit: rateLimitsData.dailyLimit,
      used: rateLimitsData.used,
      remaining: rateLimitsData.remaining,
    })

    if (!rateLimitsResponse.ok || !rateLimitsData.success) {
      console.warn("[v0] تحذير: فشل جلب حدود الإرسال من Meta، استخدام الحد الافتراضي")
      console.warn("[v0] خطأ:", rateLimitsData.error)
      rateLimitsData.dailyLimit = 1000
      rateLimitsData.remaining = 1000
      rateLimitsData.used = 0
    }

    console.log("[v0] Meta rate limits:", rateLimitsData)
    console.log("[v0] Attempting to send:", phoneNumbers.length, "messages")

    if (rateLimitsData.used >= rateLimitsData.dailyLimit) {
      const exceeded = rateLimitsData.used - rateLimitsData.dailyLimit
      console.error("[v0] ❌ تم تجاوز الحد اليومي! لا يمكن إرسال الرسائل")
      console.error("[v0] الحد اليومي:", rateLimitsData.dailyLimit)
      console.error("[v0] المستخدم:", rateLimitsData.used)
      console.error("[v0] التجاوز:", exceeded)

      return NextResponse.json(
        {
          error: `تم تجاوز الحد اليومي بـ ${exceeded} رسالة. WhatsApp لن يوصل الرسائل حتى يتم تجديد الحد في منتصف الليل بتوقيت المحيط الهادئ (PST).`,
          errorType: "RATE_LIMIT_EXCEEDED",
          success: false,
          dailyLimit: rateLimitsData.dailyLimit,
          used: rateLimitsData.used,
          exceeded: exceeded,
        },
        { status: 429 },
      )
    }

    if (phoneNumbers.length > rateLimitsData.remaining) {
      console.warn("[v0] ⚠️ تحذير: عدد الرسائل المطلوب إرسالها يتجاوز الحد المتبقي")
      console.warn("[v0] المطلوب إرسالها:", phoneNumbers.length)
      console.warn("[v0] المتبقي:", rateLimitsData.remaining)

      return NextResponse.json(
        {
          error: `تحاول إرسال ${phoneNumbers.length} رسالة لكن المتبقي من الحد اليومي ${rateLimitsData.remaining} رسالة فقط. الرسائل الزائدة لن تصل للعملاء.`,
          errorType: "EXCEEDS_REMAINING",
          success: false,
          requested: phoneNumbers.length,
          remaining: rateLimitsData.remaining,
        },
        { status: 429 },
      )
    }

    console.log("[v0] جاري جلب إعدادات API...")
    const { data: settingsData, error: settingsError } = await supabaseClient.from("api_settings").select("*").limit(1)
    const settings = settingsData?.[0]

    if (settingsError || !settings) {
      console.error("[v0] خطأ في جلب إعدادات API:", settingsError)
      return NextResponse.json({ error: "API settings not configured", success: false }, { status: 500 })
    }

    const templatesUrl = getWhatsAppApiUrl(`${settings.business_account_id}/message_templates`)
    const templatesResponse = await fetch(templatesUrl, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
    })

    if (!templatesResponse.ok) {
      const error = await templatesResponse.json()
      console.error("[v0] خطأ في جلب القوالب:", error)
      if (error.error?.code === 190 || error.error?.type === "OAuthException") {
        return NextResponse.json(
          {
            error: error.error?.message || "Access token has expired",
            errorType: "TOKEN_EXPIRED",
            success: false,
          },
          { status: 401 },
        )
      }
      throw new Error("Failed to fetch template details")
    }

    const templatesData = await templatesResponse.json()
    const template = templatesData.data?.find((t: { id: string }) => t.id === templateId)

    if (!template) {
      console.error("[v0] خطأ: القالب غير موجود")
      throw new Error("Template not found")
    }

    console.log("[v0] تم العثور على القالب:", template.name)
    console.log("[v0] مكونات القالب:", JSON.stringify(template.components, null, 2))

    const bodyComponent = template.components?.find((c: { type: string }) => c.type === "BODY")
    const templateBodyText = bodyComponent?.text || ""

    console.log("[v0] Sending bulk messages to", phoneNumbers.length, "numbers with template:", template.name)
    console.log("[v0] جاري إرسال الرسائل...")

    const components = []
    const headerComponent = template.components?.find((c: { type: string; format?: string }) => c.type === "HEADER")

    console.log("[v0] Header component:", JSON.stringify(headerComponent, null, 2))

    if (headerComponent?.format === "IMAGE") {
      if (!finalImageUrl && !finalMediaId) {
        console.error("[v0] ❌ القالب يحتاج إلى صورة لكن لم يتم توفير صورة")
        return NextResponse.json(
          { error: "This template requires an image URL or Media ID", success: false },
          { status: 400 },
        )
      }

      if (finalMediaId) {
        components.push({
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                id: finalMediaId,
              },
            },
          ],
        })

        console.log("[v0] ✅ تم إضافة header مع Media ID:", finalMediaId)
      } else if (finalImageUrl) {
        const invalidDomains = ["imageshack.com", "imagizer.imageshack.com", "tinypic.com", "photobucket.com"]

        try {
          const url = new URL(finalImageUrl)
          if (invalidDomains.some((domain) => url.hostname.includes(domain))) {
            console.error("[v0] ❌ رابط صورة غير صالح:", finalImageUrl)
            return NextResponse.json(
              {
                error: `رابط الصورة من ${url.hostname} غير مدعوم. استخدم رابطاً مباشراً ينتهي بـ .jpg أو .png أو .gif، أو ارفع الصورة مباشرة إلى WhatsApp.`,
                errorType: "INVALID_IMAGE_URL",
                success: false,
              },
              { status: 400 },
            )
          }
        } catch (e) {
          console.error("[v0] ❌ رابط صورة غير صحيح:", finalImageUrl)
          return NextResponse.json(
            {
              error: "رابط الصورة غير صحيح",
              errorType: "INVALID_URL",
              success: false,
            },
            { status: 400 },
          )
        }

        components.push({
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: finalImageUrl,
              },
            },
          ],
        })

        console.log("[v0] ✅ تم إضافة header مع URL:", finalImageUrl)
      }
    }

    console.log("[v0] Components to send:", JSON.stringify(components, null, 2))

    const url = getWhatsAppApiUrl(`${settings.phone_number_id}/messages`)

    const results = []
    let successCount = 0
    let failureCount = 0

    for (const phoneNumber of phoneNumbers) {
      try {
        console.log(`[v0] إرسال رسالة إلى: ${phoneNumber}`)

        const normalizedPhone = normalizePhoneNumber(phoneNumber)

        const messagePayload: {
          messaging_product: string
          to: string
          type: string
          template: {
            name: string
            language: { code: string }
            components?: Array<{
              type: string
              parameters: Array<{ type: string; image: { link?: string; id?: string } }>
            }>
          }
        } = {
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: "template",
          template: {
            name: template.name,
            language: {
              code: template.language,
            },
          },
        }

        if (components.length > 0) {
          messagePayload.template.components = components
        }

        console.log(`[v0] Message payload for ${phoneNumber}:`, JSON.stringify(messagePayload, null, 2))

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messagePayload),
        })

        const responseText = await response.text()
        console.log(`[v0] WhatsApp API response for ${phoneNumber}:`, responseText)

        if (response.ok) {
          const data = JSON.parse(responseText)
          const messageId = data.messages?.[0]?.id

          console.log(`[v0] ✅ تم إرسال الرسالة بنجاح إلى ${phoneNumber}، معرف الرسالة: ${messageId}`)

          results.push({ phoneNumber, success: true, messageId })
          successCount++

          await supabaseClient.from("message_history").insert({
            message_id: messageId,
            to_number: normalizedPhone,
            template_name: template.name,
            message_text: templateBodyText,
            media_url: finalMediaId || finalImageUrl || null,
            message_type: "bulk_instant",
            status: "sent",
          })
        } else {
          const error = JSON.parse(responseText)
          console.error(`[v0] ❌ فشل إرسال الرسالة إلى ${phoneNumber}:`, error)

          if (error.error?.code === 190 || error.error?.type === "OAuthException") {
            return NextResponse.json(
              {
                error: error.error?.message || "Access token has expired",
                errorType: "TOKEN_EXPIRED",
                success: false,
              },
              { status: 401 },
            )
          }

          results.push({ phoneNumber, success: false, error: error.error?.message })
          failureCount++

          await supabaseClient.from("message_history").insert({
            to_number: normalizedPhone,
            template_name: template.name,
            message_text: templateBodyText,
            media_url: finalMediaId || finalImageUrl || null,
            message_type: "bulk_instant",
            status: "failed",
            error_message: error.error?.message,
          })
        }

        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`[v0] ❌ خطأ في إرسال الرسالة إلى ${phoneNumber}:`, error)
        results.push({
          phoneNumber,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
        failureCount++
      }
    }

    console.log("[v0] ===== انتهى إرسال الرسائل الجماعية =====")
    console.log("[v0] Bulk send complete. Success:", successCount, "Failed:", failureCount)

    const newTotalCount = rateLimitsData.used + successCount
    const newRemaining = rateLimitsData.dailyLimit - newTotalCount

    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      total: phoneNumbers.length,
      results,
      dailyLimit: {
        limit: rateLimitsData.dailyLimit,
        used: newTotalCount,
        remaining: newRemaining,
        shouldWarn: newRemaining <= 100,
        tier: rateLimitsData.messagingLimitTier,
        qualityRating: rateLimitsData.qualityRating,
      },
    })
  } catch (error) {
    console.error("[v0] ❌ خطأ في إرسال الرسائل الجماعية:", error)
    console.error("[v0] Error details:", error instanceof Error ? error.stack : error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send bulk messages",
        success: false,
      },
      { status: 500 },
    )
  }
}
