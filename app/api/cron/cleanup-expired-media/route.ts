import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabaseClient = await createClient()

    // حساب التاريخ قبل 30 يوم
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // حذف الوسائط القديمة من uploaded_media
    const { data: deletedMedia, error: deleteError } = await supabaseClient
      .from("uploaded_media")
      .delete()
      .lt("created_at", thirtyDaysAgo.toISOString())
      .select()

    if (deleteError) {
      console.error("[v0] Error deleting expired media:", deleteError)
      return NextResponse.json(
        {
          success: false,
          error: deleteError.message,
        },
        { status: 500 },
      )
    }

    console.log(`[v0] Deleted ${deletedMedia?.length || 0} expired media items`)

    return NextResponse.json({
      success: true,
      deletedCount: deletedMedia?.length || 0,
      message: `Deleted ${deletedMedia?.length || 0} expired media items older than 30 days`,
    })
  } catch (error) {
    console.error("[v0] Error in cleanup-expired-media cron:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
