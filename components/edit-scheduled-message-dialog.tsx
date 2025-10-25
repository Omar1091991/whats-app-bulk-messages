"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { validateAndFilterPhoneNumbers } from "@/lib/phone-validator"
import { COUNTRY_CODES } from "@/lib/country-codes"
import { Loader2, Save, Calendar, Clock, Users, MessageSquare, ImageIcon, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Template {
  id: string
  name: string
  language: string
  status: string
  components: Array<{
    type: string
    format?: string
    text?: string
  }>
}

interface ScheduledMessage {
  id: string
  scheduled_time: string
  template_name: string
  phone_numbers: string[]
  total_numbers: number
  status: string
  media_url: string | null
  template_params?: {
    name: string
    language: string
  }
}

interface EditScheduledMessageDialogProps {
  message: ScheduledMessage | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditScheduledMessageDialog({
  message,
  open,
  onOpenChange,
  onSuccess,
}: EditScheduledMessageDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [phoneInput, setPhoneInput] = useState("")
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([])
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [needsImage, setNeedsImage] = useState(false)
  const [countryCode, setCountryCode] = useState("SA")
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false)
  const { toast } = useToast()

  // Load message data when dialog opens
  useEffect(() => {
    if (message && open) {
      // Set phone numbers
      setPhoneNumbers(message.phone_numbers)
      setPhoneInput(message.phone_numbers.join("\n"))

      // Set scheduled time
      const scheduledDateTime = new Date(message.scheduled_time)
      setScheduledDate(scheduledDateTime.toISOString().split("T")[0])
      setScheduledTime(scheduledDateTime.toTimeString().slice(0, 5))

      // Set image URL
      setImageUrl(message.media_url || "")

      // Fetch templates
      fetchTemplates()
    }
  }, [message, open])

  const fetchTemplates = async () => {
    setIsFetchingTemplates(true)
    try {
      const response = await fetch("/api/templates")
      if (!response.ok) throw new Error("فشل في جلب القوالب")

      const data = await response.json()
      setTemplates(data.templates || [])

      // Find and select the current template
      if (message) {
        const currentTemplate = data.templates?.find((t: Template) => t.name === message.template_name)
        if (currentTemplate) {
          setSelectedTemplate(currentTemplate.id)
          const headerComponent = currentTemplate.components.find((c) => c.type === "HEADER")
          setNeedsImage(headerComponent?.format === "IMAGE")
        }
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في جلب القوالب",
        variant: "destructive",
      })
    } finally {
      setIsFetchingTemplates(false)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      const headerComponent = template.components.find((c) => c.type === "HEADER")
      const requiresImage = headerComponent?.format === "IMAGE"
      setNeedsImage(requiresImage)
      if (!requiresImage) {
        setImageUrl("")
      }
    }
  }

  const handlePhoneInputChange = (value: string) => {
    setPhoneInput(value)
    if (value.trim()) {
      const result = validateAndFilterPhoneNumbers(value, countryCode)
      setPhoneNumbers(result.validNumbers)
    } else {
      setPhoneNumbers([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message) return

    if (phoneNumbers.length === 0) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال أرقام الهاتف",
        variant: "destructive",
      })
      return
    }

    if (!scheduledDate || !scheduledTime) {
      toast({
        title: "خطأ",
        description: "الرجاء تحديد تاريخ ووقت الإرسال",
        variant: "destructive",
      })
      return
    }

    if (needsImage && !imageUrl.trim()) {
      toast({
        title: "خطأ",
        description: "هذا القالب يحتاج إلى صورة. الرجاء إدخال رابط الصورة",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`)
      const isPastTime = scheduledDateTime <= new Date()

      const response = await fetch("/api/scheduled-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: message.id,
          scheduledTime: scheduledDateTime.toISOString(),
          phoneNumbers,
          templateId: selectedTemplate !== message.template_name ? selectedTemplate : undefined,
          imageUrl: needsImage ? imageUrl : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "فشل في تحديث الرسالة")
      }

      const data = await response.json()

      if (data.sentImmediately) {
        toast({
          title: "تم إرسال الرسالة فوراً",
          description: `الوقت المحدد كان في الماضي، تم إرسال ${data.successCount || 0} رسالة من أصل ${phoneNumbers.length}`,
        })
      } else if (isPastTime) {
        toast({
          title: "تم إرسال الرسالة فوراً",
          description: "الوقت المحدد كان في الماضي، تم إرسال الرسالة مباشرة",
        })
      } else {
        toast({
          title: "تم تحديث الرسالة بنجاح",
          description: `سيتم إرسال ${phoneNumbers.length} رسالة في ${scheduledDate} الساعة ${scheduledTime}`,
        })
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في تحديث الرسالة",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode)
  const isPastTime = scheduledDate && scheduledTime && new Date(`${scheduledDate}T${scheduledTime}`) <= new Date()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            تعديل الرسالة المجدولة
          </DialogTitle>
          <DialogDescription>قم بتعديل تفاصيل الرسالة المجدولة</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isPastTime && (
            <Alert className="bg-orange-50 border-orange-200">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-900">
                الوقت المحدد في الماضي - سيتم إرسال الرسالة فوراً عند الحفظ
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-template">قالب الرسالة</Label>
            <Select
              value={selectedTemplate}
              onValueChange={handleTemplateChange}
              disabled={isFetchingTemplates || templates.length === 0}
            >
              <SelectTrigger id="edit-template">
                <SelectValue placeholder="اختر قالب الرسالة" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => {
                  const hasImageHeader = template.components.some((c) => c.type === "HEADER" && c.format === "IMAGE")
                  return (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.language}) {hasImageHeader && "🖼️"}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {needsImage && (
            <div className="space-y-2">
              <Label htmlFor="edit-imageUrl" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                رابط الصورة (مطلوب)
              </Label>
              <Input
                id="edit-imageUrl"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                dir="ltr"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                التاريخ
              </Label>
              <Input
                id="edit-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                الوقت
              </Label>
              <Input
                id="edit-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>كود الدولة</Label>
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {COUNTRY_CODES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    <span className="flex items-center gap-2">
                      <span>{country.flag}</span>
                      <span className="font-medium">{country.nameAr}</span>
                      <span className="text-muted-foreground">({country.dialCode})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phones" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              أرقام الهاتف ({phoneNumbers.length} رقم)
            </Label>
            <Textarea
              id="edit-phones"
              placeholder={`أدخل الأرقام (كل رقم في سطر منفصل)\nمثال:\n${selectedCountry?.placeholder}`}
              value={phoneInput}
              onChange={(e) => handlePhoneInputChange(e.target.value)}
              rows={6}
              dir="ltr"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isLoading || phoneNumbers.length === 0}>
              {isLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="ml-2 h-4 w-4" />
                  حفظ التعديلات
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
