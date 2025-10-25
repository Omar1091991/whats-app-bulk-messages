"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Clock,
  Trash2,
  Calendar,
  Users,
  MessageSquare,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { EditScheduledMessageDialog } from "@/components/edit-scheduled-message-dialog"

interface ScheduledMessage {
  id: string
  scheduled_time: string
  template_name: string
  phone_numbers: string[]
  total_numbers: number
  status: "pending" | "processing" | "sent" | "completed" | "failed" | "partial"
  sent_count: number | null
  failed_count: number | null
  created_at: string
  processed_at: string | null
  media_url: string | null
  template_params?: {
    name: string
    language: string
  }
}

export default function ScheduledMessagesPage() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editMessage, setEditMessage] = useState<ScheduledMessage | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadMessages()
  }, [])

  const loadMessages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/scheduled-messages")
      if (response.ok) {
        const data = await response.json()
        setMessages(data.scheduledMessages || [])
      } else {
        throw new Error("فشل في جلب الرسائل المجدولة")
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في جلب الرسائل المجدولة",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/scheduled-messages?id=${deleteId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "تم الحذف بنجاح",
          description: "تم إلغاء الرسالة المجدولة",
        })
        loadMessages()
      } else {
        throw new Error("فشل في حذف الرسالة")
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في حذف الرسالة",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  const handleEdit = (message: ScheduledMessage) => {
    setEditMessage(message)
    setIsEditDialogOpen(true)
  }

  const getStatusBadge = (status: ScheduledMessage["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="border-blue-600 text-blue-600">
            <Clock className="ml-1 h-3 w-3" />
            في الانتظار
          </Badge>
        )
      case "processing":
        return (
          <Badge variant="outline" className="border-yellow-600 text-yellow-600">
            <Loader2 className="ml-1 h-3 w-3 animate-spin" />
            جاري الإرسال
          </Badge>
        )
      case "sent":
      case "completed":
        return (
          <Badge variant="outline" className="border-green-600 text-green-600">
            <CheckCircle className="ml-1 h-3 w-3" />
            تم الإرسال
          </Badge>
        )
      case "partial":
        return (
          <Badge variant="outline" className="border-orange-600 text-orange-600">
            <AlertCircle className="ml-1 h-3 w-3" />
            إرسال جزئي
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="outline" className="border-red-600 text-red-600">
            <XCircle className="ml-1 h-3 w-3" />
            فشل الإرسال
          </Badge>
        )
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "PPp", { locale: ar })
    } catch {
      return dateString
    }
  }

  const pendingMessages = messages.filter((m) => m.status === "pending")
  const completedMessages = messages.filter(
    (m) => m.status === "completed" || m.status === "sent" || m.status === "failed" || m.status === "partial",
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-balance mb-2">الرسائل المجدولة</h1>
          <p className="text-lg text-muted-foreground">إدارة الرسائل المجدولة للإرسال التلقائي</p>
        </div>
        <Button onClick={loadMessages} variant="outline" disabled={isLoading}>
          {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />}
          تحديث
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">لا توجد رسائل مجدولة</p>
            <p className="text-sm text-muted-foreground">يمكنك جدولة رسائل من صفحة الرسائل الجماعية</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {pendingMessages.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Clock className="h-6 w-6" />
                في الانتظار ({pendingMessages.length})
              </h2>
              <div className="grid gap-4">
                {pendingMessages.map((message) => (
                  <Card key={message.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            {message.template_name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-4 text-base">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDateTime(message.scheduled_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {message.total_numbers} رقم
                            </span>
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(message.status)}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(message)}
                            disabled={message.status !== "pending"}
                            title="تعديل"
                          >
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(message.id)}
                            disabled={message.status !== "pending"}
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {message.media_url && (
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <AlertCircle className="h-4 w-4" />
                          يحتوي على صورة
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {completedMessages.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <CheckCircle className="h-6 w-6" />
                السجل ({completedMessages.length})
              </h2>
              <div className="grid gap-4">
                {completedMessages.map((message) => (
                  <Card key={message.id} className="opacity-75">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            {message.template_name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-4 text-base">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDateTime(message.scheduled_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {message.total_numbers} رقم
                            </span>
                          </CardDescription>
                        </div>
                        {getStatusBadge(message.status)}
                      </div>
                    </CardHeader>
                    {(message.sent_count !== null || message.failed_count !== null) && (
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm">
                          {message.sent_count !== null && message.sent_count > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              نجح: {message.sent_count}
                            </span>
                          )}
                          {message.failed_count !== null && message.failed_count > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4" />
                              فشل: {message.failed_count}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إلغاء الرسالة المجدولة ولن يتم إرسالها. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Trash2 className="ml-2 h-4 w-4" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditScheduledMessageDialog
        message={editMessage}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={loadMessages}
      />
    </div>
  )
}
