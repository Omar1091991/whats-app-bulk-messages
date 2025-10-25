import { SettingsForm } from "@/components/settings-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WebhookInfo } from "@/components/webhook-info"

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-balance mb-2">الإعدادات</h1>
        <p className="text-lg text-muted-foreground">إدارة إعدادات واتساب وقوالب الرسائل</p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>معلومات الاتصال بواتساب</CardTitle>
            <CardDescription>بيانات الاتصال بـ Meta for Developers</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm />
          </CardContent>
        </Card>

        <WebhookInfo />
      </div>
    </div>
  )
}
