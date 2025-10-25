import { FreeMessageForm } from "@/components/free-message-form"

export default function FreeMessagesPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">إرسال رسائل حرة (بدون قالب)</h1>
          <p className="text-muted-foreground">
            أرسل رسائل مخصصة بدون استخدام القوالب المعتمدة. يمكنك كتابة أي نص تريده وإضافة صورة اختيارية.
          </p>
        </div>

        <FreeMessageForm />
      </div>
    </div>
  )
}
