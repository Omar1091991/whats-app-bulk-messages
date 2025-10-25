"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"

export default function MigrateToNeonPage() {
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [details, setDetails] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    console.log("[v0] Migration page loaded")
  }, [])

  const startMigration = async () => {
    console.log("[v0] Starting migration...")
    setStatus("running")
    setMessage("جاري نقل البيانات من Supabase إلى Neon...")

    try {
      console.log("[v0] Calling /api/migrate-to-neon...")
      const response = await fetch("/api/migrate-to-neon", {
        method: "POST",
      })

      console.log("[v0] Response status:", response.status)
      const data = await response.json()
      console.log("[v0] Response data:", data)

      if (response.ok) {
        setStatus("success")
        setMessage("تم نقل البيانات بنجاح!")
        setDetails(data)
      } else {
        setStatus("error")
        setMessage(data.error || "حدث خطأ أثناء النقل")
        setDetails(data)
      }
    } catch (error) {
      setStatus("error")
      setMessage("حدث خطأ في الاتصال")
      console.error("[v0] Migration error:", error)
      setDetails({ error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (!mounted) {
    return (
      <div className="container mx-auto p-8 max-w-4xl">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>جاري التحميل...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">نقل قاعدة البيانات من Supabase إلى Neon</CardTitle>
          <CardDescription>
            سيتم نقل جميع البيانات من قاعدة بيانات Supabase إلى قاعدة بيانات Neon الجديدة
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === "idle" && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-medium text-yellow-900">تحذير مهم</p>
                    <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                      <li>سيتم حذف جميع البيانات الموجودة في Neon وإعادة إنشائها</li>
                      <li>قد تستغرق العملية عدة دقائق حسب حجم البيانات</li>
                      <li>لا تغلق هذه الصفحة حتى تكتمل العملية</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>الجداول التي سيتم نقلها:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 mr-4 mt-2 text-sm text-blue-800">
                  <li>api_settings - إعدادات API</li>
                  <li>daily_statistics - الإحصائيات اليومية</li>
                  <li>message_history - سجل الرسائل والمحادثات</li>
                  <li>scheduled_messages - الرسائل المجدولة</li>
                  <li>uploaded_media - الوسائط والصور المرفوعة</li>
                  <li>webhook_messages - رسائل Webhook والمحادثات الواردة</li>
                </ul>
              </div>

              <Button onClick={startMigration} size="lg" className="w-full">
                بدء عملية النقل
              </Button>
            </div>
          )}

          {status === "running" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                <div>
                  <p className="font-medium text-blue-900">{message}</p>
                  <p className="text-sm text-blue-700">الرجاء الانتظار... قد تستغرق العملية عدة دقائق</p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium">مراحل النقل:</p>
                <ul className="list-decimal list-inside space-y-1 mr-4">
                  <li>حذف الجداول القديمة في Neon</li>
                  <li>إنشاء الجداول الجديدة بالبنية الصحيحة</li>
                  <li>نقل البيانات من Supabase إلى Neon</li>
                  <li>التحقق من اكتمال النقل</li>
                </ul>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">{message}</p>
                  <p className="text-sm text-green-700">تم نقل جميع البيانات والمحادثات بنجاح</p>
                </div>
              </div>

              {details?.results && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="font-medium">تفاصيل النقل:</p>
                  <div className="space-y-2">
                    {Object.entries(details.results).map(([table, count]) => (
                      <div key={table} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">
                          {table === "api_settings" && "إعدادات API"}
                          {table === "daily_statistics" && "الإحصائيات اليومية"}
                          {table === "message_history" && "سجل الرسائل"}
                          {table === "scheduled_messages" && "الرسائل المجدولة"}
                          {table === "uploaded_media" && "الوسائط المرفوعة"}
                          {table === "webhook_messages" && "رسائل Webhook"}
                        </span>
                        <span className="font-medium text-green-600">{count} صف</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center font-medium">
                      <span>إجمالي الصفوف المنقولة:</span>
                      <span className="text-green-600">
                        {Object.values(details.results).reduce((a: number, b: any) => a + Number(b), 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={() => (window.location.href = "/")} className="w-full">
                العودة إلى الصفحة الرئيسية
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
                <div className="flex-1">
                  <p className="font-medium text-red-900">فشل النقل</p>
                  <p className="text-sm text-red-700">{message}</p>
                </div>
              </div>

              {details && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium mb-2 text-sm">تفاصيل الخطأ:</p>
                  <pre className="text-xs overflow-auto max-h-64 bg-white p-3 rounded border">
                    {JSON.stringify(details, null, 2)}
                  </pre>
                </div>
              )}

              <Button onClick={startMigration} variant="outline" className="w-full bg-transparent">
                إعادة المحاولة
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
