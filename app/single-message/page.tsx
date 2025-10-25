import { SingleMessageForm } from "@/components/single-message-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SingleMessagePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-4xl font-bold text-balance mb-2">إرسال رسالة واحدة</h1>
        <p className="text-lg text-muted-foreground">أرسل رسالة واتساب لرقم واحد</p>
      </div>

      <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل الرسالة</CardTitle>
            <CardDescription>أدخل رقم الهاتف واختر قالب الرسالة</CardDescription>
          </CardHeader>
          <CardContent>
            <SingleMessageForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
