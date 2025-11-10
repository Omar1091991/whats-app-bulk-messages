"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { validateAndFilterPhoneNumbers, type PhoneValidationResult } from "@/lib/phone-validator"
import { COUNTRY_CODES } from "@/lib/country-codes"
import {
  Send,
  Loader2,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Clock,
  Calendar,
  X,
  AlertTriangle,
  AlertCircle as AlertTitle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TokenExpiredAlert } from "@/components/token-expired-alert"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { RateLimitDisplay } from "@/components/rate-limit-display"
import { MediaGallery } from "@/components/media-gallery"

interface Template {
  id: string
  name: string
  language: string
  status: string
  components: Array<{
    type: string
    format?: string
    text?: string
    parameters?: Array<{ type: string; text: string }>
  }>
}

export function BulkMessageForm() {
  const [countryCode, setCountryCode] = useState("SA")
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([])
  const [phoneInput, setPhoneInput] = useState("")
  const [validationResult, setValidationResult] = useState<PhoneValidationResult | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [mediaInputType, setMediaInputType] = useState<"url" | "id">("url")
  const [mediaValue, setMediaValue] = useState("")
  const [needsImage, setNeedsImage] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [messagePreview, setMessagePreview] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false)
  const [uploadMethod, setUploadMethod] = useState<"text" | "excel">("text")
  const { toast } = useToast()

  const [isTokenExpired, setIsTokenExpired] = useState(false)
  const [sendMode, setSendMode] = useState<"now" | "scheduled">("now")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")

  const [templatesLoaded, setTemplatesLoaded] = useState(false)

  const [sendingProgress, setSendingProgress] = useState(0)
  const [sentCount, setSentCount] = useState(0)
  const [totalToSend, setTotalToSend] = useState(0)
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)
  const [successMessageCount, setSuccessMessageCount] = useState(0)
  const [failedMessageCount, setFailedMessageCount] = useState(0)

  const [showInvalidNumbers, setShowInvalidNumbers] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)

  const [hasInvalidImageUrl, setHasInvalidImageUrl] = useState(false)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)

  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null)

  const fetchTemplates = async () => {
    setIsFetchingTemplates(true)
    setIsTokenExpired(false)
    try {
      const response = await fetch("/api/templates")

      if (response.status === 401) {
        const data = await response.json()
        if (data.errorType === "TOKEN_EXPIRED") {
          setIsTokenExpired(true)
          toast({
            title: "انتهت صلاحية رمز الوصول",
            description: "يرجى تحديث رمز الوصول (Access Token) في إعدادات المشروع",
            variant: "destructive",
          })
          return
        }
      }

      if (!response.ok) throw new Error("فشل في جلب القوالب")

      const data = await response.json()
      setTemplates(data.templates || [])
      setTemplatesLoaded(true)
      toast({
        title: "تم جلب القوالب بنجاح",
        description: `تم العثور على ${data.templates?.length || 0} قالب`,
      })
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
      const bodyComponent = template.components.find((c) => c.type === "BODY")
      setMessagePreview(bodyComponent?.text || "")

      const headerComponent = template.components.find((c) => c.type === "HEADER")
      const requiresImage = headerComponent?.format === "IMAGE"
      setNeedsImage(requiresImage)
      if (!requiresImage) {
        setMediaValue("")
        setMediaInputType("url")
        setHasInvalidImageUrl(false)
        setSelectedImagePreview(null)
      }
    }
  }

  const handlePhoneInputChange = (value: string) => {
    setPhoneInput(value)
  }

  const handlePhoneInputBlur = () => {
    if (phoneInput.trim()) {
      const result = validateAndFilterPhoneNumbers(phoneInput, countryCode)
      setValidationResult(result)
      setPhoneNumbers(result.validNumbers)

      if (result.invalidNumbers.length > 0 || result.duplicates.length > 0) {
        const cleanedInput = result.validNumbers.join("\n")
        setPhoneInput(cleanedInput)

        const totalFiltered = result.invalidNumbers.length + result.duplicates.length
        toast({
          title: "تم تصفية الأرقام تلقائياً",
          description: `تم إزالة ${totalFiltered} رقم (${result.invalidNumbers.length} خاطئ + ${result.duplicates.length} مكرر). سيتم الإرسال إلى ${result.validNumbers.length} رقم صالح فقط.`,
          variant: "default",
        })

        if (result.invalidNumbers.length > 0) {
          setShowInvalidNumbers(true)
        }
        if (result.duplicates.length > 0) {
          setShowDuplicates(true)
        }
      }
    } else {
      setValidationResult(null)
      setPhoneNumbers([])
      setShowInvalidNumbers(false)
      setShowDuplicates(false)
    }
  }

  const handleCountryChange = (code: string) => {
    setCountryCode(code)
    if (phoneInput.trim()) {
      const result = validateAndFilterPhoneNumbers(phoneInput, code)
      setValidationResult(result)
      setPhoneNumbers(result.validNumbers)

      if (result.invalidNumbers.length > 0 || result.duplicates.length > 0) {
        const cleanedInput = result.validNumbers.join("\n")
        setPhoneInput(cleanedInput)

        const totalFiltered = result.invalidNumbers.length + result.duplicates.length
        toast({
          title: "تم تصفية الأرقام تلقائياً",
          description: `تم إزالة ${totalFiltered} رقم (${result.invalidNumbers.length} خاطئ + ${result.duplicates.length} مكرر). سيتم الإرسال إلى ${result.validNumbers.length} رقم صالح فقط.`,
          variant: "default",
        })

        if (result.invalidNumbers.length > 0) {
          setShowInvalidNumbers(true)
        }
        if (result.duplicates.length > 0) {
          setShowDuplicates(true)
        }
      }
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast({
        title: "خطأ",
        description: "الرجاء رفع ملف Excel فقط (.xlsx أو .xls)",
        variant: "destructive",
      })
      return
    }

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("countryCode", countryCode)

      const response = await fetch("/api/parse-excel", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("فشل في قراءة ملف Excel")

      const data = await response.json()
      const numbersText = data.phoneNumbers.join("\n")
      const result = validateAndFilterPhoneNumbers(numbersText, countryCode)
      setValidationResult(result)
      setPhoneNumbers(result.validNumbers)

      setPhoneInput(result.validNumbers.join("\n"))

      const totalFiltered = result.invalidNumbers.length + result.duplicates.length
      toast({
        title: "تم رفع الملف وتصفية الأرقام",
        description: `تم العثور على ${result.statistics.valid} رقم صالح من أصل ${result.statistics.total}. تم إزالة ${totalFiltered} رقم غير صالح أو مكرر تلقائياً.`,
      })

      if (result.invalidNumbers.length > 0) {
        setShowInvalidNumbers(true)
      }
      if (result.duplicates.length > 0) {
        setShowDuplicates(true)
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في قراءة ملف Excel",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (phoneNumbers.length === 0) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال أرقام هاتف صالحة",
        variant: "destructive",
      })
      return
    }

    if (!selectedTemplate) {
      toast({
        title: "خطأ",
        description: "الرجاء اختيار قالب الرسالة",
        variant: "destructive",
      })
      return
    }

    if (needsImage && !mediaValue.trim()) {
      toast({
        title: "خطأ",
        description: "هذا القالب يحتاج إلى صورة. الرجاء إدخال رابط الصورة أو Media ID",
        variant: "destructive",
      })
      return
    }

    if (sendMode === "scheduled") {
      if (!scheduledDate || !scheduledTime) {
        toast({
          title: "خطأ",
          description: "الرجاء تحديد تاريخ ووقت الإرسال",
          variant: "destructive",
        })
        return
      }

      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`)
      if (scheduledDateTime <= new Date()) {
        toast({
          title: "خطأ",
          description: "يجب أن يكون وقت الإرسال في المستقبل",
          variant: "destructive",
        })
        return
      }
    }

    setIsLoading(true)
    setIsTokenExpired(false)
    setTotalToSend(phoneNumbers.length)
    setSentCount(0)
    setSendingProgress(0)
    setShowSuccessNotification(false)
    setFailedMessageCount(0)

    let pollingInterval: NodeJS.Timeout | null = null

    try {
      const apiUrl = sendMode === "now" ? "/api/send-bulk-messages" : "/api/scheduled-messages"

      const payload: {
        phoneNumbers: string[]
        templateId: string
        imageUrl?: string
        mediaInputType?: "url" | "id"
        mediaValue?: string
        scheduledTime?: string
      } = {
        phoneNumbers,
        templateId: selectedTemplate,
      }

      if (needsImage && mediaValue) {
        if (mediaInputType === "url") {
          payload.imageUrl = mediaValue
        } else {
          payload.mediaInputType = "id"
          payload.mediaValue = mediaValue
        }
      }

      if (sendMode === "scheduled") {
        payload.scheduledTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      }

      if (sendMode === "now") {
        const totalMessages = phoneNumbers.length
        const estimatedTimePerMessage = 0.4
        const totalEstimatedTime = totalMessages * estimatedTimePerMessage * 1000
        const startTime = Date.now()

        pollingInterval = setInterval(() => {
          const elapsed = Date.now() - startTime
          const estimatedProgress = Math.min((elapsed / totalEstimatedTime) * 100, 95)
          setSendingProgress(estimatedProgress)

          const estimatedSent = Math.floor((estimatedProgress / 100) * totalMessages)
          setSentCount(estimatedSent)
        }, 200)

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (pollingInterval) clearInterval(pollingInterval)

        if (response.status === 401) {
          const data = await response.json()
          if (data.errorType === "TOKEN_EXPIRED") {
            setIsTokenExpired(true)
            toast({
              title: "انتهت صلاحية رمز الوصول",
              description: "يرجى تحديث رمز الوصول (Access Token) في إعدادات المشروع",
              variant: "destructive",
            })
            return
          }
        }

        if (!response.ok) {
          const errorData = await response.json()
          toast({
            title: "❌ فشل الإرسال",
            description: errorData.error || "فشل في إرسال الرسائل. يرجى المحاولة مرة أخرى.",
            variant: "destructive",
          })
          throw new Error(errorData.error || "فشل في إرسال الرسائل")
        }

        const data = await response.json()

        setSuccessMessageCount(data.successCount || 0)
        setFailedMessageCount(data.failureCount || 0)
        setSendingProgress(100)
        setSentCount(data.successCount || 0)

        setTimeout(() => {
          setShowSuccessNotification(true)
        }, 500)
      } else {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (response.status === 401) {
          const data = await response.json()
          if (data.errorType === "TOKEN_EXPIRED") {
            setIsTokenExpired(true)
            toast({
              title: "انتهت صلاحية رمز الوصول",
              description: "يرجى تحديث رمز الوصول (Access Token) في إعدادات المشروع",
              variant: "destructive",
            })
            return
          }
        }

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "فشل في جدولة الرسائل")
        }

        toast({
          title: "تم جدولة الرسائل بنجاح",
          description: `سيتم إرسال ${phoneNumbers.length} رسالة في ${scheduledDate} الساعة ${scheduledTime}`,
        })
      }

      if (sendMode === "scheduled" || showSuccessNotification) {
        setPhoneInput("")
        setPhoneNumbers([])
        setValidationResult(null)
        setSelectedTemplate("")
        setMessagePreview("")
        setMediaValue("")
        setMediaInputType("url")
        setNeedsImage(false)
        setSendMode("now")
        setScheduledDate("")
        setScheduledTime("")
        setShowInvalidNumbers(false)
        setShowDuplicates(false)
        setSelectedImagePreview(null)
      }
    } catch (error) {
      if (pollingInterval) clearInterval(pollingInterval)

      toast({
        title: "❌ فشل الإرسال",
        description: error instanceof Error ? error.message : "فشل في إرسال الرسائل. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      })
      setSendingProgress(0)
      setSentCount(0)
      setTotalToSend(0)
      setShowInvalidNumbers(false)
      setShowDuplicates(false)
      setSelectedImagePreview(null)
    } finally {
      setIsLoading(false)
    }
  }

  const closeSuccessNotification = () => {
    setShowSuccessNotification(false)
    setSendingProgress(0)
    setSentCount(0)
    setTotalToSend(0)
    setSuccessMessageCount(0)
    setFailedMessageCount(0)
    setShowInvalidNumbers(false)
    setShowDuplicates(false)
    setPhoneInput("")
    setPhoneNumbers([])
    setValidationResult(null)
    setSelectedTemplate("")
    setMessagePreview("")
    setMediaValue("")
    setMediaInputType("url")
    setNeedsImage(false)
    setSelectedImagePreview(null)
  }

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode)

  const validateImageUrl = (url: string): boolean => {
    const trimmedUrl = url.trim().toLowerCase()
    if (!trimmedUrl) return true

    const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    const hasValidExtension = validExtensions.some((ext) => trimmedUrl.endsWith(ext))

    if (!hasValidExtension) {
      return false
    }

    const invalidPatterns = [
      "imageshack.com/i/",
      "imageshack.com/a/",
      "imagizer.imageshack.com",
      "imgur.com/a/",
      "imgur.com/gallery/",
      "flickr.com/photos/",
      "photobucket.com/albums/",
      "tinypic.com/view",
    ]

    if (invalidPatterns.some((pattern) => trimmedUrl.includes(pattern))) {
      return false
    }

    return true
  }

  const handleMediaValueChange = (value: string) => {
    setMediaValue(value)

    if (value !== mediaValue) {
      setSelectedImagePreview(null)
    }

    if (needsImage && mediaInputType === "url" && value.trim()) {
      const isValid = validateImageUrl(value)
      setHasInvalidImageUrl(!isValid)
    } else {
      setHasInvalidImageUrl(false)
    }
  }

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!validTypes.includes(file.type)) {
      toast({
        title: "خطأ في نوع الملف",
        description: `نوع الملف غير مدعوم. الأنواع المدعومة: ${validTypes.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    setIsUploadingMedia(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mediaType", "IMAGE")

      const response = await fetch("/api/upload-media", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "فشل في رفع الملف")
      }

      const data = await response.json()

      setMediaInputType("id")
      setMediaValue(data.mediaId)
      setHasInvalidImageUrl(false)
      setSelectedImagePreview(data.previewUrl)

      toast({
        title: "تم رفع الصورة بنجاح ✅",
        description: `Media ID: ${data.mediaId}`,
      })
    } catch (error) {
      toast({
        title: "خطأ في رفع الملف",
        description: error instanceof Error ? error.message : "فشل في رفع الملف",
        variant: "destructive",
      })
    } finally {
      setIsUploadingMedia(false)
    }
  }

  const handleSelectMediaFromGallery = (mediaId: string, filename: string, previewUrl?: string) => {
    setMediaInputType("id")
    setMediaValue(mediaId)
    setHasInvalidImageUrl(false)
    setSelectedImagePreview(previewUrl || null)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {isTokenExpired && <TokenExpiredAlert />}

        <RateLimitDisplay />

        <Card className="bg-secondary/10 border-secondary">
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="templates" className="text-lg font-semibold text-secondary-foreground">
                قالب الرسالة
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchTemplates}
                disabled={isFetchingTemplates}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                {isFetchingTemplates ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="ml-2 h-4 w-4" />
                )}
                جلب القوالب
              </Button>
            </div>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange} disabled={templates.length === 0}>
              <SelectTrigger
                id="templates"
                className={
                  templatesLoaded ? "bg-secondary text-secondary-foreground border-secondary" : "bg-background"
                }
              >
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
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground">اضغط على "جلب القوالب" لتحميل القوالب المعتمدة</p>
            )}
          </CardContent>
        </Card>

        {needsImage && (
          <Card className="bg-accent/10 border-accent">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-lg font-semibold text-accent-foreground">
                  <ImageIcon className="h-5 w-5" />
                  الصورة (مطلوبة)
                </Label>
                <RadioGroup
                  value={mediaInputType}
                  onValueChange={(value: "url" | "id") => {
                    setMediaInputType(value)
                    setMediaValue("")
                    setHasInvalidImageUrl(false)
                    setSelectedImagePreview(null)
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="url" id="media-url" />
                    <Label htmlFor="media-url" className="font-normal cursor-pointer">
                      رابط URL
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="id" id="media-id" />
                    <Label htmlFor="media-id" className="font-normal cursor-pointer">
                      Media ID (مرفوع على Meta)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {mediaInputType === "id" && (
                <div className="space-y-3">
                  <MediaGallery onSelectMedia={handleSelectMediaFromGallery} selectedMediaId={mediaValue} />

                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      id="bulk-media-upload"
                      className="hidden"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleMediaUpload}
                      disabled={isUploadingMedia}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={() => document.getElementById("bulk-media-upload")?.click()}
                      disabled={isUploadingMedia}
                    >
                      {isUploadingMedia ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          جاري الرفع...
                        </>
                      ) : (
                        <>
                          <Upload className="ml-2 h-4 w-4" />
                          رفع الصورة إلى WhatsApp
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">أو أدخل Media ID يدوياً:</p>
                </div>
              )}

              <Input
                id="mediaValue"
                type="text"
                placeholder={
                  mediaInputType === "url" ? "https://example.com/image.jpg" : "معرف الوسائط من Meta (Media ID)"
                }
                value={mediaValue}
                onChange={(e) => handleMediaValueChange(e.target.value)}
                dir="ltr"
                required
                className="bg-background"
              />
              {hasInvalidImageUrl && mediaInputType === "url" && (
                <Alert variant="default" className="border-yellow-500 bg-yellow-500/10">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <AlertTitle className="text-yellow-500">⚠️ تحذير: رابط قد لا يعمل</AlertTitle>
                  <AlertDescription className="space-y-2 text-sm">
                    <p>
                      هذا الرابط من خدمة قد لا تعمل بشكل موثوق مع WhatsApp. الروابط من imageshack وخدمات مشابهة غالباً ما
                      تفشل حتى لو كانت تنتهي بامتداد صحيح.
                    </p>
                    <p className="font-medium text-yellow-600">💡 للحصول على أفضل النتائج:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>استخدم خدمات موثوقة مثل Imgur (Direct Link)</li>
                      <li>أو ارفع الصورة مباشرة إلى WhatsApp باستخدام خيار "Media ID"</li>
                    </ul>
                    <p className="text-xs opacity-80 mt-2">يمكنك المتابعة بالإرسال، لكن قد لا تصل الصورة للعميل.</p>
                  </AlertDescription>
                </Alert>
              )}
              {!hasInvalidImageUrl && mediaInputType === "url" && (
                <p className="text-sm text-muted-foreground">الصيغ المدعومة: JPG, PNG, GIF, WebP</p>
              )}
              {mediaInputType === "id" && mediaValue && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
                  <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-background">
                    <img
                      src={selectedImagePreview || "/placeholder.svg"}
                      alt="معاينة الصورة المختارة"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">الصورة المختارة</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      ID: {mediaValue.substring(0, 20)}...
                    </p>
                  </div>
                </div>
              )}
              {mediaInputType === "id" && !mediaValue && (
                <p className="text-sm text-muted-foreground">أدخل معرف الصورة الذي تم رفعه مسبقاً على Meta</p>
              )}
            </CardContent>
          </Card>
        )}

        {messagePreview && (
          <Card className="bg-accent border-accent">
            <CardContent className="pt-6">
              <Label className="mb-2 block text-lg font-semibold text-accent-foreground">معاينة الرسالة</Label>
              <p className="text-sm whitespace-pre-wrap text-accent-foreground">{messagePreview}</p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-primary/10 border-primary">
          <CardContent className="pt-6 space-y-4">
            <Label className="text-lg font-semibold text-primary-foreground">وقت الإرسال</Label>
            <RadioGroup value={sendMode} onValueChange={(v) => setSendMode(v as "now" | "scheduled")}>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="now" id="send-now" />
                <Label htmlFor="send-now" className="flex items-center gap-2 cursor-pointer font-normal">
                  <Send className="h-4 w-4" />
                  إرسال فوري
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="scheduled" id="send-scheduled" />
                <Label htmlFor="send-scheduled" className="flex items-center gap-2 cursor-pointer font-normal">
                  <Clock className="h-4 w-4" />
                  جدولة الإرسال
                </Label>
              </div>
            </RadioGroup>

            {sendMode === "scheduled" && (
              <Card className="bg-secondary/20 border-secondary">
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scheduled-date" className="flex items-center gap-2 text-secondary-foreground">
                        <Calendar className="h-4 w-4" />
                        التاريخ
                      </Label>
                      <Input
                        id="scheduled-date"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        required={sendMode === "scheduled"}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scheduled-time" className="flex items-center gap-2 text-secondary-foreground">
                        <Clock className="h-4 w-4" />
                        الوقت
                      </Label>
                      <Input
                        id="scheduled-time"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        required={sendMode === "scheduled"}
                        className="bg-background"
                      />
                    </div>
                  </div>
                  <Alert className="bg-secondary/30 border-secondary">
                    <AlertCircle className="h-4 w-4 text-secondary-foreground" />
                    <AlertDescription className="text-secondary-foreground text-sm">
                      سيتم إرسال الرسائل تلقائياً في الوقت المحدد
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <Card className="bg-secondary/10 border-secondary">
          <CardContent className="pt-6 space-y-2">
            <Label className="text-lg font-semibold text-secondary-foreground">كود الدولة</Label>
            <Select value={countryCode} onValueChange={handleCountryChange}>
              <SelectTrigger className="bg-secondary text-secondary-foreground border-secondary">
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
            <p className="text-sm text-muted-foreground">
              الدولة المختارة: {selectedCountry?.flag} {selectedCountry?.nameAr} ({selectedCountry?.dialCode})
            </p>
          </CardContent>
        </Card>

        <Card className="bg-primary/10 border-primary">
          <CardContent className="pt-6 space-y-2">
            <Label className="text-lg font-semibold text-primary-foreground">أرقام الهاتف</Label>
            <Tabs value={uploadMethod} onValueChange={(v) => setUploadMethod(v as "text" | "excel")}>
              <TabsList className="grid w-full grid-cols-2 bg-primary/20">
                <TabsTrigger
                  value="text"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  نسخ الأرقام
                </TabsTrigger>
                <TabsTrigger
                  value="excel"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  رفع ملف Excel
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-2">
                <Textarea
                  placeholder={`أدخل الأرقام (كل رقم في سطر منفصل أو افصل بينها بفاصلة)\nمثال:\n${selectedCountry?.placeholder}\nأو: ${selectedCountry?.placeholder}, ${selectedCountry?.placeholder}`}
                  value={phoneInput}
                  onChange={(e) => handlePhoneInputChange(e.target.value)}
                  onBlur={handlePhoneInputBlur}
                  rows={8}
                  dir="ltr"
                  className="bg-primary text-primary-foreground border-primary placeholder:text-primary-foreground/60"
                />
              </TabsContent>

              <TabsContent value="excel" className="space-y-2">
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="excel-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary rounded-lg cursor-pointer bg-primary/20 hover:bg-primary/30 transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-primary-foreground" />
                      <p className="mb-2 text-sm text-primary-foreground">
                        <span className="font-semibold">اضغط لرفع الملف</span> أو اسحب وأفلت
                      </p>
                      <p className="text-xs text-primary-foreground/80">ملفات Excel فقط (.xlsx, .xls)</p>
                    </div>
                    <input
                      id="excel-upload"
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                <p className="text-sm text-muted-foreground">
                  <FileSpreadsheet className="inline h-4 w-4 ml-1" />
                  يجب أن تكون الأرقام في العمود الأول من ملف Excel
                </p>
              </TabsContent>
            </Tabs>

            {validationResult && validationResult.statistics.total > 0 && (
              <div className="space-y-3">
                <Alert className="bg-green-600 border-green-700">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                  <AlertDescription className="text-white">
                    <div className="space-y-2">
                      <p className="font-semibold text-lg">
                        ✅ جاهز للإرسال إلى {validationResult.statistics.valid} رقم صالح
                      </p>
                      {(validationResult.statistics.invalid > 0 || validationResult.statistics.duplicates > 0) && (
                        <p className="text-sm text-white/90">
                          تم تصفية {validationResult.statistics.invalid + validationResult.statistics.duplicates} رقم
                          تلقائياً ({validationResult.statistics.invalid} خاطئ + {validationResult.statistics.duplicates}{" "}
                          مكرر)
                        </p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                {isLoading && sendMode === "now" ? (
                  <div className="space-y-3">
                    <div className="bg-green-600 border-2 border-green-700 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                          <span className="font-semibold text-white">جاري الإرسال...</span>
                        </div>
                        <div className="text-3xl font-bold text-white">{Math.round(sendingProgress)}%</div>
                      </div>
                      <Progress value={sendingProgress} className="h-3 bg-green-100" />
                      <p className="text-sm text-white text-center">
                        تم إرسال {sentCount} من {totalToSend} رسالة ({Math.round(sendingProgress)}%)
                      </p>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="submit"
                    className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
                    size="lg"
                    disabled={isLoading || phoneNumbers.length === 0}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        {sendMode === "now" ? "جاري الإرسال..." : "جاري الجدولة..."}
                      </>
                    ) : (
                      <>
                        {sendMode === "now" ? (
                          <>
                            <Send className="ml-2 h-4 w-4" />
                            إرسال الرسائل ({phoneNumbers.length} رقم صالح)
                          </>
                        ) : (
                          <>
                            <Clock className="ml-2 h-4 w-4" />
                            جدولة الرسائل ({phoneNumbers.length} رقم صالح)
                          </>
                        )}
                      </>
                    )}
                  </Button>
                )}

                {validationResult.invalidNumbers.length > 0 && (
                  <Collapsible open={showInvalidNumbers} onOpenChange={setShowInvalidNumbers}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full bg-transparent">
                        <XCircle className="ml-2 h-4 w-4 text-red-600" />
                        عرض الأرقام التي تم تصفيتها ({validationResult.invalidNumbers.length} خاطئ)
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <Card className="bg-red-50 border-red-200">
                        <CardContent className="pt-4">
                          <p className="text-sm text-red-700 mb-3 font-medium">
                            تم إزالة هذه الأرقام تلقائياً ولن يتم إرسال رسائل إليها:
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-2">
                            {validationResult.invalidNumbers.map((item, index) => (
                              <div
                                key={index}
                                className="text-sm flex items-start gap-2 p-2 bg-white rounded border border-red-200"
                              >
                                <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="font-mono font-semibold text-red-900">{item.number}</p>
                                  <p className="text-red-700 text-xs">{item.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {validationResult.duplicates.length > 0 && (
                  <Collapsible open={showDuplicates} onOpenChange={setShowDuplicates}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full bg-transparent">
                        <Copy className="ml-2 h-4 w-4 text-orange-600" />
                        عرض الأرقام المكررة التي تم تصفيتها ({validationResult.duplicates.length})
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <Card className="bg-orange-50 border-orange-200">
                        <CardContent className="pt-4">
                          <p className="text-sm text-orange-700 mb-3 font-medium">
                            تم إزالة هذه الأرقام المكررة تلقائياً (سيتم الإرسال مرة واحدة فقط):
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {validationResult.duplicates.map((phone, index) => (
                              <div
                                key={index}
                                className="text-sm flex items-center gap-2 p-2 bg-white rounded border border-orange-200"
                              >
                                <Copy className="h-4 w-4 text-orange-600" />
                                <p className="font-mono text-orange-900">{phone}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </form>

      {showSuccessNotification && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeSuccessNotification}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 rounded-full p-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-green-900">اكتمل الإرسال!</h3>
                  <p className="text-sm text-green-700">تم معالجة جميع الرسائل</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={closeSuccessNotification} className="hover:bg-gray-100">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                <div className="flex items-center justify-between">
                  <span className="text-green-900 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    رسائل ناجحة:
                  </span>
                  <span className="text-3xl font-bold text-green-600">{successMessageCount}</span>
                </div>
              </div>

              {failedMessageCount > 0 && (
                <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
                  <div className="flex items-center justify-between">
                    <span className="text-red-900 font-semibold flex items-center gap-2">
                      <XCircle className="h-5 w-5" />
                      رسائل فاشلة:
                    </span>
                    <span className="text-3xl font-bold text-red-600">{failedMessageCount}</span>
                  </div>
                  <p className="text-xs text-red-700 mt-2">تم تخطي الرسائل الفاشلة وإكمال الإرسال للأرقام الأخرى</p>
                </div>
              )}

              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-900 font-medium">إجمالي الرسائل:</span>
                  <span className="text-xl font-bold text-blue-600">{successMessageCount + failedMessageCount}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={closeSuccessNotification} className="flex-1 bg-green-600 hover:bg-green-700">
                إغلاق
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">اضغط في أي مكان لإغلاق الإشعار</p>
          </div>
        </div>
      )}
    </>
  )
}
