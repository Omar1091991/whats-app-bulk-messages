import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch uploaded media, ordered by most recent first
    const { data: mediaList, error } = await supabase
      .from("uploaded_media")
      .select("*")
      .order("uploaded_at", { ascending: false })
      .limit(50) // Limit to last 50 uploads

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
        console.log("[v0] Table 'uploaded_media' does not exist yet. Returning empty list.")
        return NextResponse.json({
          success: true,
          media: [],
          tableNotFound: true,
        })
      }

      console.error("[v0] Error fetching uploaded media:", error)
      return NextResponse.json({ error: "Failed to fetch media", success: false }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      media: mediaList || [],
    })
  } catch (error) {
    console.error("[v0] Error in uploaded-media API:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch media",
        success: false,
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mediaId = searchParams.get("id")

    if (!mediaId) {
      return NextResponse.json({ error: "Media ID is required", success: false }, { status: 400 })
    }

    const supabase = await createClient()

    // Delete the media record from database
    const { error } = await supabase.from("uploaded_media").delete().eq("id", mediaId)

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
        console.log("[v0] Table 'uploaded_media' does not exist yet.")
        return NextResponse.json({
          success: false,
          error: "Media table not found. Please run the setup script first.",
        })
      }

      console.error("[v0] Error deleting media:", error)
      return NextResponse.json({ error: "Failed to delete media", success: false }, { status: 500 })
    }

    console.log("[v0] ✅ Media deleted successfully:", mediaId)

    return NextResponse.json({
      success: true,
      message: "Media deleted successfully",
    })
  } catch (error) {
    console.error("[v0] Error in DELETE uploaded-media API:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete media",
        success: false,
      },
      { status: 500 },
    )
  }
}
