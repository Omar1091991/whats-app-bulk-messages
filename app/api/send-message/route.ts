import { NextResponse } from "next/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"
import { createClient } from "@/lib/neon/server"

interface TemplateParameters {
  mediaType?: "IMAGE" | "VIDEO" | "DOCUMENT"
  mediaInputType: "url" | "id"
  mediaValue: string
  bodyVariables: string[]
}

export async function POST(request: Request) {
  try {
    const { phoneNumber, templateId, templateParams } = await request.json()

    console.log("[v0] ===== بدء إرسال رسالة فردية =====")
    console.log("[v0] رقم الهاتف:", phoneNumber)
    console.log("[v0] معرف القالب:", templateId)

    if (!phoneNumber || !templateId) {
      console.error("[v0] خطأ: حقول مطلوبة مفقودة")
      return NextResponse.json({ error: "Missing required fields", success: false }, { status: 400 })
    }

    const cleanPhone = phoneNumber.replace(/[^\d]/g, "")
    if (cleanPhone.length < 10) {
      console.error("[v0] خطأ: رقم الهاتف غير صحيح:", cleanPhone)
      return NextResponse.json({ error: "رقم الهاتف غير صحيح", success: false }, { status: 400 })
    }

    const neonClient = await createClient()

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
    }

    console.log("[v0] Meta rate limits:", rateLimitsData)

    if (rateLimitsData.remaining <= 0) {
      console.warn("[v0] ⚠️ تحذير: تم تجاوز الحد اليومي للرسائل")
      console.warn("[v0] الحد اليومي:", rateLimitsData.dailyLimit)
      console.warn("[v0] المستخدم:", rateLimitsData.used)
      console.warn("[v0] المتبقي:", rateLimitsData.remaining)
      console.warn("[v0] سيتم محاولة الإرسال على أي حال - Meta ستتعامل مع الحد إذا لزم الأمر")
    }

    const shouldWarn = rateLimitsData.remaining <= 100

    const { data: settingsData, error: settingsError } = await neonClient.from("api_settings").select("*").limit(1)
    const settings = settingsData?.[0]

    if (settingsError || !settings) {
      console.error("[v0] خطأ في جلب إعدادات API:", settingsError)
      return NextResponse.json({ error: "API settings not configured", success: false }, { status: 500 })
    }

    if (!settings.phone_number_id || !settings.access_token || !settings.business_account_id) {
      return NextResponse.json(
        { error: "إعدادات API غير مكتملة. يرجى التحقق من الإعدادات", success: false },
        { status: 500 },
      )
    }

    console.log("[v0] Using Phone Number ID:", settings.phone_number_id)
    console.log("[v0] Using Business Account ID:", settings.business_account_id)

    console.log("[v0] جاري جلب تفاصيل القالب...")
    const templatesUrl = getWhatsAppApiUrl(
      `${settings.business_account_id}/message_templates?fields=id,name,language,status,components`,
    )
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
    console.log("[v0] Sending message to:", phoneNumber, "with template:", template.name)
    console.log("[v0] Template language:", template.language)
    console.log("[v0] Template category:", template.category)

    const bodyComponent = template.components?.find((c: { type: string }) => c.type === "BODY")
    let templateBodyText = bodyComponent?.text || ""

    const params = templateParams as TemplateParameters | undefined
    if (params?.bodyVariables && params.bodyVariables.length > 0) {
      params.bodyVariables.forEach((value, index) => {
        templateBodyText = templateBodyText.replace(`{{${index + 1}}}`, value)
      })
    }

    const url = getWhatsAppApiUrl(`${settings.phone_number_id}/messages`)

    const components = []

    const headerComponent = template.components?.find((c: { type: string }) => c.type === "HEADER")
    if (headerComponent && params?.mediaType) {
      const mediaTypeKey = params.mediaType.toLowerCase() as "image" | "video" | "document"

      if (params.mediaInputType === "url") {
        try {
          new URL(params.mediaValue)
        } catch {
          return NextResponse.json(
            { error: "رابط الوسائط غير صحيح. يرجى التحقق من الرابط", success: false },
            { status: 400 },
          )
        }
      }

      components.push({
        type: "header",
        parameters: [
          {
            type: mediaTypeKey,
            [mediaTypeKey]: params.mediaInputType === "id" ? { id: params.mediaValue } : { link: params.mediaValue },
          },
        ],
      })

      console.log(`[v0] Adding ${params.mediaType} header with ${params.mediaInputType}:`, params.mediaValue)
    }

    if (params?.bodyVariables && params.bodyVariables.length > 0) {
      components.push({
        type: "body",
        parameters: params.bodyVariables.map((text) => ({
          type: "text",
          text,
        })),
      })

      console.log("[v0] Adding body parameters:", params.bodyVariables)
    }

    const messagePayload: {
      messaging_product: string
      to: string
      type: string
      template: {
        name: string
        language: { code: string }
        components?: Array<{
          type: string
          parameters: Array<any>
        }>
      }
    } = {
      messaging_product: "whatsapp",
      to: phoneNumber.replace(/[^\d]/g, ""),
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

    console.log("[v0] Message payload:", JSON.stringify(messagePayload, null, 2))
    console.log("[v0] Sending to WhatsApp API URL:", url)
    console.log("[v0] جاري إرسال الرسالة إلى WhatsApp API...")

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messagePayload),
    })

    const data = await response.json()

    console.log("[v0] استجابة WhatsApp API:", {
      ok: response.ok,
      status: response.status,
      data: JSON.stringify(data, null, 2),
    })

    if (!response.ok) {
      console.error("[v0] WhatsApp API error:", JSON.stringify(data, null, 2))

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

      let errorMessage = data.error?.message || "Failed to send message"
      if (data.error?.error_data?.details) {
        errorMessage += ` - ${data.error.error_data.details}`
      }

      console.error("[v0] خطأ في الإرسال:", errorMessage)
      throw new Error(errorMessage)
    }

    console.log("[v0] ✅ تم إرسال الرسالة بنجاح!")
    console.log("[v0] Message sent successfully:", data)
    console.log("[v0] Message ID:", data.messages?.[0]?.id)
    console.log("[v0] Message status:", data.messages?.[0]?.message_status)

    console.log("[v0] جاري حفظ الرسالة في قاعدة البيانات...")
    await neonClient.from("message_history").insert({
      message_id: data.messages?.[0]?.id,
      to_number: phoneNumber,
      template_name: template.name,
      message_type: "single",
      message_text: templateBodyText,
      media_url: params?.mediaType === "IMAGE" ? params.mediaValue : null,
      status: data.messages?.[0]?.message_status || "sent",
    })

    console.log("[v0] ===== انتهى إرسال الرسالة بنجاح =====")

    return NextResponse.json({
      success: true,
      messageId: data.messages?.[0]?.id,
      status: data.messages?.[0]?.message_status,
      info: {
        phoneNumber: phoneNumber,
        templateName: template.name,
        templateCategory: template.category,
      },
      dailyLimit: {
        limit: rateLimitsData.dailyLimit,
        used: rateLimitsData.used + 1,
        remaining: rateLimitsData.remaining - 1,
        shouldWarn,
        tier: rateLimitsData.messagingLimitTier,
        qualityRating: rateLimitsData.qualityRating,
      },
    })
  } catch (error) {
    console.error("[v0] ❌ خطأ في إرسال الرسالة:", error)
    console.error("[v0] Error details:", error instanceof Error ? error.stack : error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send message",
        success: false,
      },
      { status: 500 },
    )
  }
}
