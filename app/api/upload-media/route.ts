import { NextResponse } from "next/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const mediaType = formData.get("mediaType") as string

    console.log("[v0] ===== بدء رفع ملف إلى WhatsApp =====")
    console.log("[v0] نوع الملف:", mediaType)
    console.log("[v0] اسم الملف:", file?.name)
    console.log("[v0] حجم الملف:", file?.size, "bytes")

    if (!file) {
      return NextResponse.json({ error: "لم يتم تحديد ملف", success: false }, { status: 400 })
    }

    // التحقق من حجم الملف (WhatsApp limits)
    const maxSizes = {
      IMAGE: 5 * 1024 * 1024, // 5MB
      VIDEO: 16 * 1024 * 1024, // 16MB
      DOCUMENT: 100 * 1024 * 1024, // 100MB
    }

    const maxSize = maxSizes[mediaType as keyof typeof maxSizes] || 5 * 1024 * 1024

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024))
      return NextResponse.json(
        {
          error: `حجم الملف كبير جداً. الحد الأقصى ${maxSizeMB}MB`,
          success: false,
        },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const { data: settingsData, error: settingsError } = await supabase.from("api_settings").select("*").limit(1)
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

    // رفع الملف إلى WhatsApp
    const url = getWhatsAppApiUrl(`${settings.phone_number_id}/media`)
    console.log("[v0] رابط رفع الملف:", url)

    const uploadFormData = new FormData()
    uploadFormData.append("file", file)
    uploadFormData.append("messaging_product", "whatsapp")
    uploadFormData.append("type", file.type)

    console.log("[v0] جاري رفع الملف إلى WhatsApp...")

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
      body: uploadFormData,
    })

    const data = await response.json()

    console.log("[v0] استجابة WhatsApp API:", {
      ok: response.ok,
      status: response.status,
      data: JSON.stringify(data, null, 2),
    })

    if (!response.ok) {
      console.error("[v0] خطأ في رفع الملف:", JSON.stringify(data, null, 2))

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

      let errorMessage = data.error?.message || "Failed to upload media"
      if (data.error?.error_data?.details) {
        errorMessage += ` - ${data.error.error_data.details}`
      }

      console.error("[v0] خطأ في الرفع:", errorMessage)
      throw new Error(errorMessage)
    }

    console.log("[v0] ✅ تم رفع الملف بنجاح!")
    console.log("[v0] Media ID:", data.id)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const dataUrl = `data:${file.type};base64,${base64}`

    try {
      const { error: insertError } = await supabase.from("uploaded_media").insert({
        media_id: data.id,
        filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        preview_url: dataUrl, // Store data URL for preview
      })

      if (insertError) {
        // Check if table doesn't exist
        if (insertError.code === "PGRST205" || insertError.message?.includes("Could not find the table")) {
          console.log("[v0] ⚠️ Table 'uploaded_media' does not exist yet. Skipping metadata save.")
          console.log("[v0] Run the SQL script 'scripts/create_uploaded_media_table.sql' to enable media gallery.")
        } else {
          console.error("[v0] خطأ في حفظ معلومات الملف:", insertError)
        }
        // Don't fail the request if saving to DB fails
      } else {
        console.log("[v0] ✅ تم حفظ معلومات الملف في قاعدة البيانات")
      }
    } catch (dbError) {
      console.error("[v0] خطأ في حفظ الملف:", dbError)
    }

    return NextResponse.json({
      success: true,
      mediaId: data.id,
      fileName: file.name,
      fileSize: file.size,
    })
  } catch (error) {
    console.error("[v0] ❌ خطأ في رفع الملف:", error)
    console.error("[v0] Error details:", error instanceof Error ? error.stack : error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload media",
        success: false,
      },
      { status: 500 },
    )
  }
}
