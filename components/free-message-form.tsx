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
  Upload,
  FileSpreadsheet,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  X,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TokenExpiredAlert } from "@/components/token-expired-alert"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { RateLimitDisplay } from "@/components/rate-limit-display"
import { MediaGallery } from "@/components/media-gallery"

export function FreeMessageForm() {
  const [countryCode, setCountryCode] = useState("SA")
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([])
  const [phoneInput, setPhoneInput] = useState("")
  const [validationResult, setValidationResult] = useState<PhoneValidationResult | null>(null)
  const [messageText, setMessageText] = useState("")
  const [mediaInputType, setMediaInputType] = useState<"url" | "id">("url")
  const [mediaUrl, setMediaUrl] = useState("")
  const [mediaValue, setMediaValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadMethod, setUploadMethod] = useState<"text" | "excel">("text")
  const { toast } = useToast()

  const [isTokenExpired, setIsTokenExpired] = useState(false)
  const [sendingProgress, setSendingProgress] = useState(0)
  const [sentCount, setSentCount] = useState(0)
  const [totalToSend, setTotalToSend] = useState(0)
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)
  const [successMessageCount, setSuccessMessageCount] = useState(0)

  const [showInvalidNumbers, setShowInvalidNumbers] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [hasInvalidImageUrl, setHasInvalidImageUrl] = useState(false)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)

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

  const handleMediaUrlChange = (value: string) => {
    setMediaUrl(value)

    if (mediaInputType === "url" && value.trim()) {
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

  const handleSelectMediaFromGallery = (mediaId: string, filename: string) => {
    setMediaInputType("id")
    setMediaValue(mediaId)
    setHasInvalidImageUrl(false)
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

    if (!messageText.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال نص الرسالة",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setIsTokenExpired(false)
    setTotalToSend(phoneNumbers.length)
    setSentCount(0)
    setSendingProgress(0)
    setShowSuccessNotification(false)

    try {
      const payload: {
        phoneNumbers: string[]
        messageText: string
        mediaUrl?: string
        mediaInputType?: "url" | "id"
        mediaValue?: string
      } = {
        phoneNumbers,
        messageText: messageText.trim(),
      }

      // Add media if provided
      if (mediaInputType === "url" && mediaUrl.trim()) {
        payload.mediaUrl = mediaUrl.trim()
      } else if (mediaInputType === "id" && mediaValue.trim()) {
        payload.mediaInputType = "id"
        payload.mediaValue = mediaValue.trim()
      }

      const totalTime = phoneNumbers.length * 100
      const startTime = Date.now()

      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const progress = Math.min((elapsed / totalTime) * 100, 99)
        const estimatedSent = Math.floor((progress / 100) * phoneNumbers.length)

        setSendingProgress(progress)
        setSentCount(estimatedSent)
      }, 50)

      const response = await fetch("/api/send-free-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      clearInterval(progressInterval)

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
        throw new Error(errorData.error || "فشل في إرسال الرسائل")
      }

      const data = await response.json()

      setSuccessMessageCount(data.successCount || phoneNumbers.length)
      setSendingProgress(100)
      setSentCount(phoneNumbers.length)

      setTimeout(() => {
        setShowSuccessNotification(true)
      }, 500)
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في إرسال الرسائل",
        variant: "destructive",
      })
      setSendingProgress(0)
      setSentCount(0)
      setTotalToSend(0)
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
    setShowInvalidNumbers(false)
    setShowDuplicates(false)
    setPhoneInput("")
    setPhoneNumbers([])
    setValidationResult(null)
    setMessageText("")
    setMediaUrl("")
    setMediaValue("")
    setMediaInputType("url")
  }

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode)

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {isTokenExpired && <TokenExpiredAlert />}

        <RateLimitDisplay />

        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-900 font-semibold">⚠️ تنبيه مهم</AlertTitle>
          <AlertDescription className="text-yellow-800 text-sm space-y-2">
            <p>
              الرسائل الحرة (بدون قالب) يمكن إرسالها فقط للعملاء الذين راسلوك خلال آخر 24 ساعة (نافذة المحادثة النشطة).
            </p>
            <p className="font-medium">
              إذا كان العميل لم يراسلك خلال 24 ساعة، يجب استخدام القوالب المعتمدة من صفحة "إرسال جماعي".
            </p>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="messageText">نص الرسالة *</Label>
          <Textarea
            id="messageText"
            placeholder="اكتب رسالتك هنا... يمكنك كتابة أي نص تريده بدون قيود القوالب"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={6}
            required
            className="resize-none"
          />
          <p className="text-sm text-muted-foreground">
            عدد الأحرف: {messageText.length} | يمكنك كتابة رسالة مخصصة بدون استخدام القوالب
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              الصورة (اختياري)
            </Label>
            <RadioGroup
              value={mediaInputType}
              onValueChange={(value: "url" | "id") => {
                setMediaInputType(value)
                setMediaUrl("")
                setMediaValue("")
                setHasInvalidImageUrl(false)
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="url" id="free-media-url" />
                <Label htmlFor="free-media-url" className="font-normal cursor-pointer">
                  رابط URL
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="id" id="free-media-id" />
                <Label htmlFor="free-media-id" className="font-normal cursor-pointer">
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
                  id="free-media-upload"
                  className="hidden"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleMediaUpload}
                  disabled={isUploadingMedia}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() => document.getElementById("free-media-upload")?.click()}
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
            id="freeMediaValue"
            type="text"
            placeholder={
              mediaInputType === "url" ? "https://example.com/image.jpg (اختياري)" : "معرف الوسائط من Meta (اختياري)"
            }
            value={mediaInputType === "url" ? mediaUrl : mediaValue}
            onChange={(e) =>
              mediaInputType === "url" ? handleMediaUrlChange(e.target.value) : setMediaValue(e.target.value)
            }
            dir="ltr"
          />
          {hasInvalidImageUrl && mediaInputType === "url" && (
            <Alert variant="default" className="border-yellow-500 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertTitle className="text-yellow-500">⚠️ تحذير: رابط قد لا يعمل</AlertTitle>
              <AlertDescription className="text-sm text-yellow-800">
                هذا الرابط من خدمة قد لا تعمل بشكل موثوق مع WhatsApp. للحصول على أفضل النتائج، استخدم خدمات موثوقة أو
                ارفع الصورة مباشرة.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="space-y-2">
          <Label>كود الدولة</Label>
          <Select value={countryCode} onValueChange={handleCountryChange}>
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
          <p className="text-sm text-muted-foreground">
            الدولة المختارة: {selectedCountry?.flag} {selectedCountry?.nameAr} ({selectedCountry?.dialCode})
          </p>
        </div>

        <div className="space-y-2">
          <Label>أرقام الهاتف</Label>
          <Tabs value={uploadMethod} onValueChange={(v) => setUploadMethod(v as "text" | "excel")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text">نسخ الأرقام</TabsTrigger>
              <TabsTrigger value="excel">رفع ملف Excel</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-2">
              <Textarea
                placeholder={`أدخل الأرقام (كل رقم في سطر منفصل أو افصل بينها بفاصلة)\nمثال:\n${selectedCountry?.placeholder}\nأو: ${selectedCountry?.placeholder}, ${selectedCountry?.placeholder}`}
                value={phoneInput}
                onChange={(e) => handlePhoneInputChange(e.target.value)}
                onBlur={handlePhoneInputBlur}
                rows={8}
                dir="ltr"
              />
            </TabsContent>

            <TabsContent value="excel" className="space-y-2">
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="free-excel-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">اضغط لرفع الملف</span> أو اسحب وأفلت
                    </p>
                    <p className="text-xs text-muted-foreground">ملفات Excel فقط (.xlsx, .xls)</p>
                  </div>
                  <input
                    id="free-excel-upload"
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
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <div className="space-y-2">
                    <p className="font-semibold text-lg">
                      ✅ جاهز للإرسال إلى {validationResult.statistics.valid} رقم صالح
                    </p>
                    {(validationResult.statistics.invalid > 0 || validationResult.statistics.duplicates > 0) && (
                      <p className="text-sm">
                        تم تصفية {validationResult.statistics.invalid + validationResult.statistics.duplicates} رقم
                        تلقائياً ({validationResult.statistics.invalid} خاطئ + {validationResult.statistics.duplicates}{" "}
                        مكرر)
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

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
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                  <span className="font-semibold text-green-900">جاري الإرسال...</span>
                </div>
                <div className="text-3xl font-bold text-green-600">{Math.round(sendingProgress)}%</div>
              </div>
              <Progress value={sendingProgress} className="h-3 bg-green-100" />
              <p className="text-sm text-green-700 text-center">
                تم إرسال {sentCount} من {totalToSend} رسالة ({Math.round(sendingProgress)}%)
              </p>
            </div>
          </div>
        ) : (
          <Button type="submit" className="w-full" size="lg" disabled={isLoading || phoneNumbers.length === 0}>
            {isLoading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              <>
                <Send className="ml-2 h-4 w-4" />
                إرسال الرسائل ({phoneNumbers.length} رقم صالح)
              </>
            )}
          </Button>
        )}
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
                  <h3 className="text-xl font-bold text-green-900">تم الإرسال بنجاح!</h3>
                  <p className="text-sm text-green-700">تم إرسال جميع الرسائل</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={closeSuccessNotification} className="hover:bg-gray-100">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <div className="flex items-center justify-between">
                <span className="text-green-900 font-semibold">عدد الرسائل المرسلة:</span>
                <span className="text-3xl font-bold text-green-600">{successMessageCount}</span>
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
