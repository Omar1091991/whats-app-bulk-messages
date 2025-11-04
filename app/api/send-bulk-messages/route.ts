import { NextResponse } from "next/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"
import { createClient } from "@/lib/supabase/server"

function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "")
  return cleaned
}

async function sendMessageBatch(
  phoneNumbers: string[],
  template: any,
  components: any[],
  settings: any,
  templateBodyText: string,
  finalMediaId: string | null,
  finalImageUrl: string | null,
  supabaseClient: any,
  onProgress: (sent: number, failed: number, currentPhone?: string) => void,
) {
  const url = getWhatsAppApiUrl(`${settings.phone_number_id}/messages`)
  const results = []
  let successCount = 0
  let failureCount = 0

  const BATCH_SIZE = 5
  for (let i = 0; i < phoneNumbers.length; i += BATCH_SIZE) {
    const batch = phoneNumbers.slice(i, i + BATCH_SIZE)

    const batchPromises = batch.map(async (phoneNumber) => {
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

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messagePayload),
        })

        const responseText = await response.text()

        if (response.ok) {
          const data = JSON.parse(responseText)
          const messageId = data.messages?.[0]?.id

          console.log(`[v0] ✅ تم إرسال الرسالة بنجاح إلى ${phoneNumber}`)

          await supabaseClient.from("message_history").insert({
            message_id: messageId,
            to_number: normalizedPhone,
            template_name: template.name,
            message_text: templateBodyText,
            media_url: finalMediaId || finalImageUrl || null,
            message_type: "bulk_instant",
            status: "sent",
          })

          return { phoneNumber, success: true, messageId }
        } else {
          const error = JSON.parse(responseText)
          console.error(`[v0] ❌ فشل إرسال الرسالة إلى ${phoneNumber}:`, error)

          if (error.error?.code === 190 || error.error?.type === "OAuthException") {
            throw new Error("TOKEN_EXPIRED")
          }

          await supabaseClient.from("message_history").insert({
            to_number: normalizedPhone,
            template_name: template.name,
            message_text: templateBodyText,
            media_url: finalMediaId || finalImageUrl || null,
            message_type: "bulk_instant",
            status: "failed",
            error_message: error.error?.message,
          })

          return { phoneNumber, success: false, error: error.error?.message }
        }
      } catch (error) {
        console.error(`[v0] ❌ خطأ في إرسال الرسالة إلى ${phoneNumber}:`, error)
        return {
          phoneNumber,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    const batchSuccess = batchResults.filter((r) => r.success).length
    const batchFailed = batchResults.filter((r) => !r.success).length
    successCount += batchSuccess
    failureCount += batchFailed

    onProgress(successCount, failureCount, phoneNumbers[i + BATCH_SIZE - 1])

    if (i + BATCH_SIZE < phoneNumbers.length) {
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }

  return { results, successCount, failureCount }
}

export async function POST(request: Request) {
  try {
    const { phoneNumbers, templateId, imageUrl, mediaId, mediaInputType, mediaValue } = await request.json()

    console.log("[v0] ===== بدء إرسال رسائل جماعية =====")
    console.log("[v0] عدد الأرقام:", phoneNumbers?.length)

    const finalMediaId = mediaId || (mediaInputType === "id" ? mediaValue : null)
    const finalImageUrl = imageUrl || (mediaInputType === "url" ? mediaValue : null)

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

    if (!rateLimitsResponse.ok || !rateLimitsData.success) {
      console.warn("[v0] تحذير: فشل جلب حدود الإرسال من Meta، استخدام الحد الافتراضي")
      rateLimitsData.dailyLimit = 1000
      rateLimitsData.remaining = 1000
      rateLimitsData.used = 0
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

    const bodyComponent = template.components?.find((c: { type: string }) => c.type === "BODY")
    const templateBodyText = bodyComponent?.text || ""

    const components = []
    const headerComponent = template.components?.find((c: { type: string; format?: string }) => c.type === "HEADER")

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
      } else if (finalImageUrl) {
        const invalidDomains = ["imageshack.com", "imagizer.imageshack.com", "tinypic.com", "photobucket.com"]

        try {
          const url = new URL(finalImageUrl)
          if (invalidDomains.some((domain) => url.hostname.includes(domain))) {
            return NextResponse.json(
              {
                error: `رابط الصورة من ${url.hostname} غير مدعوم.`,
                errorType: "INVALID_IMAGE_URL",
                success: false,
              },
              { status: 400 },
            )
          }
        } catch (e) {
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
      }
    }

    console.log("[v0] جاري إرسال الرسائل...")

    const { results, successCount, failureCount } = await sendMessageBatch(
      phoneNumbers,
      template,
      components,
      settings,
      templateBodyText,
      finalMediaId,
      finalImageUrl,
      supabaseClient,
      (sent, failed, currentPhone) => {
        console.log(`[v0] التقدم: ${sent} ناجح، ${failed} فاشل`)
      },
    )

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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send bulk messages",
        success: false,
      },
      { status: 500 },
    )
  }
}
