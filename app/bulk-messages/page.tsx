import { BulkMessageForm } from "@/components/bulk-message-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function BulkMessagesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-4xl font-bold text-balance mb-2">إرسال رسائل جماعية</h1>
        <p className="text-lg text-muted-foreground">أرسل رسائل واتساب لمجموعة من الأرقام دفعة واحدة</p>
      </div>

      <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل الرسائل الجماعية</CardTitle>
            <CardDescription>أدخل الأرقام أو ارفع ملف Excel واختر قالب الرسالة</CardDescription>
          </CardHeader>
          <CardContent>
            <BulkMessageForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
