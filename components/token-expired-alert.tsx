import { AlertCircle, ExternalLink } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function TokenExpiredAlert() {
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>انتهت صلاحية رمز الوصول (Access Token)</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>رمز الوصول الخاص بـ WhatsApp Business API قد انتهت صلاحيته. يرجى تحديثه لمتابعة إرسال الرسائل.</p>
        <div className="space-y-2">
          <p className="font-semibold">خطوات تحديث الرمز:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>افتح Meta Business Suite</li>
            <li>اذهب إلى إعدادات WhatsApp Business API</li>
            <li>قم بإنشاء رمز وصول جديد (Access Token)</li>
            <li>انسخ الرمز الجديد</li>
            <li>حدّث متغير البيئة WHATSAPP_ACCESS_TOKEN في إعدادات المشروع</li>
          </ol>
        </div>
        <Button variant="outline" size="sm" asChild className="mt-2 bg-transparent">
          <a
            href="https://business.facebook.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
          >
            فتح Meta Business Suite
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
