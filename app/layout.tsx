import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Navigation } from "@/components/navigation"
import { Toaster } from "@/components/ui/toaster"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "Rose Smile - WhatsApp Bulk Messaging",
  description: "Send bulk WhatsApp messages to your customers",
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <div className="sticky top-0 z-50 bg-background border-b">
          <Suspense fallback={null}>
            <Navigation />
          </Suspense>
        </div>
        <main>{children}</main>
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
