import { NextResponse } from "next/server"
import { formatPhoneNumber, isValidWhatsAppNumber } from "@/lib/phone-formatter"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const countryCode = (formData.get("countryCode") as string) || "SA"

    if (!file) {
      return NextResponse.json({ error: "No file provided", success: false }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const XLSX = await import("xlsx")
    const workbook = XLSX.read(buffer, { type: "buffer" })

    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]

    const phoneNumbers: string[] = []

    for (const row of data) {
      if (row[0]) {
        const phone = String(row[0]).trim()
        if (phone) {
          const formatted = formatPhoneNumber(phone, countryCode)
          if (isValidWhatsAppNumber(formatted)) {
            phoneNumbers.push(formatted)
          }
        }
      }
    }

    console.log("[v0] Parsed Excel file:", phoneNumbers.length, "valid numbers found")

    return NextResponse.json({
      success: true,
      phoneNumbers,
      count: phoneNumbers.length,
    })
  } catch (error) {
    console.error("[v0] Error parsing Excel file:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to parse Excel file",
        success: false,
      },
      { status: 500 },
    )
  }
}
