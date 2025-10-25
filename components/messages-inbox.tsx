"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2,
  RefreshCw,
  Send,
  MessageSquare,
  CheckCheck,
  ImageIcon,
  Video,
  FileText,
  Mic,
  MapPin,
  Phone,
  Reply,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatDistanceToNow } from "date-fns"
import { ar } from "date-fns/locale"

interface Message {
  id: string
  message_id: string
  from_number: string
  from_name: string
  message_type: string
  message_text: string | null
  message_media_url: string | null
  message_media_mime_type: string | null
  timestamp: number
  status: string
  replied: boolean
  reply_text: string | null
  reply_sent_at: string | null
  created_at: string
}

export function MessagesInbox() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [replyText, setReplyText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadMessages()
  }, [])

  const loadMessages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/messages")
      if (!response.ok) throw new Error("فشل في تحميل الرسائل")

      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في تحميل الرسائل",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (messageId: string) => {
    try {
      const response = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: messageId, status: "read" }),
      })

      if (!response.ok) throw new Error("فشل في تحديث الرسالة")

      setMessages(messages.map((msg) => (msg.id === messageId ? { ...msg, status: "read" } : msg)))
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في تحديث الرسالة",
        variant: "destructive",
      })
    }
  }

  const sendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return

    setIsSending(true)
    try {
      const response = await fetch("/api/messages/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: selectedMessage.id,
          toNumber: selectedMessage.from_number,
          text: replyText,
        }),
      })

      if (!response.ok) throw new Error("فشل في إرسال الرد")

      toast({
        title: "تم الإرسال بنجاح",
        description: "تم إرسال الرد إلى العميل",
      })

      setReplyText("")
      setIsDialogOpen(false)
      loadMessages()
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في إرسال الرد",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return formatDistanceToNow(date, { addSuffix: true, locale: ar })
  }

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case "text":
        return <MessageSquare className="h-4 w-4" />
      case "image":
        return <ImageIcon className="h-4 w-4" />
      case "video":
        return <Video className="h-4 w-4" />
      case "document":
        return <FileText className="h-4 w-4" />
      case "audio":
        return <Mic className="h-4 w-4" />
      case "location":
        return <MapPin className="h-4 w-4" />
      case "voice":
        return <Phone className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getMessageTypeLabel = (type: string) => {
    switch (type) {
      case "text":
        return "نص"
      case "image":
        return "صورة"
      case "video":
        return "فيديو"
      case "document":
        return "مستند"
      case "audio":
        return "صوت"
      case "location":
        return "موقع"
      case "voice":
        return "رسالة صوتية"
      default:
        return type
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <span className="text-sm text-muted-foreground">{messages.length} رسالة</span>
        </div>
        <Button variant="outline" size="sm" onClick={loadMessages}>
          <RefreshCw className="ml-2 h-4 w-4" />
          تحديث
        </Button>
      </div>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">لا توجد رسائل واردة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <Card key={message.id} className={message.status === "unread" ? "border-primary" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{message.from_name}</CardTitle>
                    <CardDescription className="font-mono text-xs">{message.from_number}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      {getMessageTypeIcon(message.message_type)}
                      {getMessageTypeLabel(message.message_type)}
                    </Badge>
                    {message.replied && (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCheck className="h-3 w-3" />
                        تم الرد
                      </Badge>
                    )}
                    <Badge variant={message.status === "unread" ? "default" : "outline"}>
                      {message.status === "unread" ? "جديدة" : "مقروءة"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {message.message_text && (
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">{message.message_text}</p>
                )}

                {message.message_media_url && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {getMessageTypeIcon(message.message_type)}
                      <span>ملف مرفق من Meta</span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">معرف الملف:</span>
                        <code className="bg-background px-2 py-1 rounded">{message.message_media_url}</code>
                      </div>
                      {message.message_media_mime_type && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">نوع الملف:</span>
                          <code className="bg-background px-2 py-1 rounded">{message.message_media_mime_type}</code>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      💡 لعرض الملف، استخدم WhatsApp Business API لتحميله باستخدام معرف الملف أعلاه
                    </p>
                  </div>
                )}

                {message.reply_text && (
                  <div className="bg-green-50 dark:bg-green-950 border-r-4 border-green-500 p-3 rounded-md space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
                      <Reply className="h-4 w-4" />
                      <span>ردك على هذه الرسالة</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.reply_text}</p>
                    {message.reply_sent_at && (
                      <p className="text-xs text-muted-foreground">
                        تم الإرسال {formatTimestamp(new Date(message.reply_sent_at).getTime() / 1000)}
                      </p>
                    )}
                  </div>
                )}

                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    عرض البيانات الوصفية من Meta
                  </summary>
                  <div className="mt-2 space-y-1 bg-muted p-3 rounded-md font-mono">
                    <div>
                      <span className="font-semibold">Message ID:</span> {message.message_id}
                    </div>
                    <div>
                      <span className="font-semibold">Type:</span> {message.message_type}
                    </div>
                    <div>
                      <span className="font-semibold">Timestamp:</span> {message.timestamp} (
                      {new Date(message.timestamp * 1000).toLocaleString("ar-SA")})
                    </div>
                    <div>
                      <span className="font-semibold">From:</span> {message.from_number}
                    </div>
                    <div>
                      <span className="font-semibold">Profile Name:</span> {message.from_name}
                    </div>
                    {message.message_media_url && (
                      <div>
                        <span className="font-semibold">Media ID:</span> {message.message_media_url}
                      </div>
                    )}
                    {message.message_media_mime_type && (
                      <div>
                        <span className="font-semibold">MIME Type:</span> {message.message_media_mime_type}
                      </div>
                    )}
                  </div>
                </details>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
                  <div className="flex gap-2">
                    {message.status === "unread" && (
                      <Button variant="outline" size="sm" onClick={() => markAsRead(message.id)}>
                        وضع علامة كمقروءة
                      </Button>
                    )}
                    <Dialog open={isDialogOpen && selectedMessage?.id === message.id} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedMessage(message)
                            setIsDialogOpen(true)
                          }}
                        >
                          <Send className="ml-2 h-4 w-4" />
                          رد
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>الرد على {message.from_name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>الرسالة الأصلية</Label>
                            <div className="p-3 bg-muted rounded-md text-sm">
                              {message.message_text || `رسالة ${getMessageTypeLabel(message.message_type)}`}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="reply">ردك</Label>
                            <Textarea
                              id="reply"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="اكتب ردك هنا..."
                              rows={4}
                            />
                          </div>
                          <Button onClick={sendReply} disabled={isSending || !replyText.trim()} className="w-full">
                            {isSending ? (
                              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="ml-2 h-4 w-4" />
                            )}
                            إرسال الرد
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
