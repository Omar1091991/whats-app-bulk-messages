"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, RefreshCw, CheckCircle, AlertCircle, ExternalLink, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Template {
  id: string
  name: string
  language: string
  status: string
  components: Array<{
    type: string
    text?: string
  }>
}

interface ConnectionStatus {
  connected: boolean
  phoneNumberId: string
  businessAccountId: string
  phoneNumber?: string
  verifiedName?: string
  error?: string
  errorCode?: number
  isTokenExpired?: boolean
}

interface ApiSettings {
  id: string
  business_account_id: string
  phone_number_id: string
  access_token: string
  webhook_verify_token?: string
}

export function SettingsForm() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [apiSettings, setApiSettings] = useState<ApiSettings | null>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedSettings, setEditedSettings] = useState<Partial<ApiSettings>>({})
  const [isRegeneratingToken, setIsRegeneratingToken] = useState(false)
  const { toast } = useToast()

  const [webhookUrl, setWebhookUrl] = useState("")

  useEffect(() => {
    loadSettings()
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/webhooks`)
    }
  }, [])

  const loadSettings = async () => {
    setIsLoadingSettings(true)
    try {
      const response = await fetch("/api/settings")
      if (!response.ok) throw new Error("فشل في تحميل الإعدادات")

      const data = await response.json()
      setApiSettings(data)
      setEditedSettings(data)
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في تحميل الإعدادات",
        variant: "destructive",
      })
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const saveSettings = async () => {
    setIsSavingSettings(true)
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedSettings),
      })

      if (!response.ok) throw new Error("فشل في حفظ الإعدادات")

      const data = await response.json()
      setApiSettings(data)
      setEditedSettings(data)
      setIsEditing(false)

      toast({
        title: "تم الحفظ بنجاح",
        description: "تم حفظ إعدادات API بنجاح",
      })

      // Test connection with new settings
      testConnection()
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في حفظ الإعدادات",
        variant: "destructive",
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const testConnection = async () => {
    setIsTestingConnection(true)
    try {
      const response = await fetch("/api/test-connection")
      const data = await response.json()

      setConnectionStatus(data)

      if (data.connected) {
        toast({
          title: "الاتصال ناجح",
          description: "تم الاتصال بواتساب بنجاح",
        })
      } else if (data.isTokenExpired) {
        toast({
          title: "انتهت صلاحية رمز الوصول",
          description: "يرجى تحديث رمز الوصول من Meta Business Suite",
          variant: "destructive",
        })
      } else {
        toast({
          title: "خطأ في الاتصال",
          description: data.error || "فشل في الاتصال بواتساب",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "خطأ في الاتصال",
        description: error instanceof Error ? error.message : "فشل في الاتصال بواتساب",
        variant: "destructive",
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const fetchTemplates = async () => {
    setIsFetchingTemplates(true)
    try {
      const response = await fetch("/api/templates")
      if (!response.ok) throw new Error("فشل في جلب القوالب")

      const data = await response.json()
      setTemplates(data.templates || [])
      toast({
        title: "تم جلب القوالب بنجاح",
        description: `تم العثور على ${data.templates?.length || 0} قالب معتمد`,
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

  const regenerateVerifyToken = async () => {
    setIsRegeneratingToken(true)
    try {
      const response = await fetch("/api/settings/regenerate-token", {
        method: "POST",
      })

      if (!response.ok) throw new Error("فشل في إعادة إنشاء رمز التحقق")

      const data = await response.json()
      setApiSettings(data)
      setEditedSettings(data)

      toast({
        title: "تم إعادة إنشاء رمز التحقق",
        description: "تم إنشاء رمز تحقق جديد بنجاح. يرجى تحديث الرمز في إعدادات Meta Webhook",
      })
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في إعادة إنشاء رمز التحقق",
        variant: "destructive",
      })
    } finally {
      setIsRegeneratingToken(false)
    }
  }

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    toast({
      title: "تم النسخ",
      description: "تم نسخ عنوان URL للاستدعاء إلى الحافظة",
    })
  }

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>معلومات API</CardTitle>
              <CardDescription>إعدادات الاتصال بـ WhatsApp Business API</CardDescription>
            </div>
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                تعديل
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditedSettings(apiSettings || {})
                    setIsEditing(false)
                  }}
                >
                  إلغاء
                </Button>
                <Button onClick={saveSettings} disabled={isSavingSettings}>
                  {isSavingSettings ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="ml-2 h-4 w-4" />
                  )}
                  حفظ
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-900 dark:text-yellow-100">تنبيه مهم</AlertTitle>
            <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-sm space-y-2">
              <p>لإرسال الرسائل بنجاح، تأكد من:</p>
              <ul className="list-disc list-inside space-y-1 mr-4">
                <li>إضافة أرقام الاختبار في Meta Business (إذا كان الحساب في وضع التطوير)</li>
                <li>إعداد طريقة الدفع في Meta Business Manager</li>
                <li>التحقق من أن رمز الوصول لديه الصلاحيات المطلوبة</li>
              </ul>
              <Button variant="outline" size="sm" className="mt-2 bg-transparent" asChild>
                <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer">
                  فتح Meta Business Settings
                  <ExternalLink className="mr-2 h-3 w-3" />
                </a>
              </Button>
            </AlertDescription>
          </Alert>

          <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <Label htmlFor="webhook_url" className="text-blue-900 dark:text-blue-100">
                عنوان URL للاستدعاء (Callback URL)
              </Label>
              <Button variant="outline" size="sm" onClick={copyWebhookUrl} className="h-8 bg-transparent">
                نسخ
              </Button>
            </div>
            <Input id="webhook_url" value={webhookUrl} readOnly className="font-mono bg-white dark:bg-gray-950" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              استخدم هذا العنوان في إعدادات Webhook في Meta Developer Console. تأكد من أن هذا URL يمكن الوصول إليه من
              الإنترنت العام.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_account_id">معرف حساب واتساب للأعمال</Label>
            <Input
              id="business_account_id"
              value={editedSettings.business_account_id || ""}
              onChange={(e) => setEditedSettings({ ...editedSettings, business_account_id: e.target.value })}
              readOnly={!isEditing}
              className="font-mono"
              placeholder="1096746608955840"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone_number_id">معرف رقم الهاتف</Label>
            <Input
              id="phone_number_id"
              value={editedSettings.phone_number_id || ""}
              onChange={(e) => setEditedSettings({ ...editedSettings, phone_number_id: e.target.value })}
              readOnly={!isEditing}
              className="font-mono"
              placeholder="623846684149569"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="access_token">رمز الوصول</Label>
            <Input
              id="access_token"
              value={editedSettings.access_token || ""}
              onChange={(e) => setEditedSettings({ ...editedSettings, access_token: e.target.value })}
              readOnly={!isEditing}
              className="font-mono"
              type={isEditing ? "text" : "password"}
              placeholder="EAAaOfrKNUMw..."
            />
            <p className="text-xs text-muted-foreground">
              يمكنك الحصول على رمز الوصول من{" "}
              <a
                href="https://business.facebook.com/settings/system-users"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Meta Business Suite
              </a>
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="webhook_verify_token">رمز التحقق من Webhook</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={regenerateVerifyToken}
                disabled={isRegeneratingToken}
                className="h-8"
              >
                {isRegeneratingToken ? (
                  <Loader2 className="ml-2 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="ml-2 h-3 w-3" />
                )}
                إعادة إنشاء
              </Button>
            </div>
            <Input
              id="webhook_verify_token"
              value={editedSettings.webhook_verify_token || ""}
              onChange={(e) => setEditedSettings({ ...editedSettings, webhook_verify_token: e.target.value })}
              readOnly={!isEditing}
              className="font-mono"
              placeholder="my_verify_token_123"
            />
            <p className="text-xs text-muted-foreground">
              رمز مخصص للتحقق من صحة طلبات Webhook من Meta. استخدم زر "إعادة إنشاء" لإنشاء رمز جديد تلقائياً.
            </p>
          </div>
        </CardContent>
      </Card>

      {connectionStatus?.isTokenExpired && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>انتهت صلاحية رمز الوصول</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>رمز الوصول الخاص بك قد انتهت صلاحيته. يرجى اتباع الخطوات التالية لتحديثه:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm mr-4">
              <li>افتح Meta Business Suite</li>
              <li>انتقل إلى إعدادات النظام {">"} رموز الوصول</li>
              <li>قم بإنشاء رمز وصول جديد</li>
              <li>قم بتحديثه في الحقل أعلاه واحفظ التغييرات</li>
            </ol>
            <Button variant="outline" size="sm" className="mt-2 bg-transparent" asChild>
              <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer">
                فتح Meta Business Suite
                <ExternalLink className="mr-2 h-3 w-3" />
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">حالة الاتصال</h3>
            <p className="text-sm text-muted-foreground">تحقق من اتصالك بـ WhatsApp Business API</p>
          </div>
          <Button variant="outline" onClick={testConnection} disabled={isTestingConnection}>
            {isTestingConnection ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="ml-2 h-4 w-4" />
            )}
            اختبار الاتصال
          </Button>
        </div>

        {connectionStatus && (
          <Card className={connectionStatus.connected ? "border-green-500" : "border-red-500"}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                {connectionStatus.connected ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-semibold text-green-500">متصل</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="font-semibold text-red-500">غير متصل</span>
                  </>
                )}
              </div>
              <div className="space-y-2 text-sm">
                {connectionStatus.connected && connectionStatus.phoneNumber && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">رقم الهاتف:</span>
                      <span className="font-mono">{connectionStatus.phoneNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الاسم المعتمد:</span>
                      <span>{connectionStatus.verifiedName}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">معرف رقم الهاتف:</span>
                  <span className="font-mono">{connectionStatus.phoneNumberId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">معرف حساب الأعمال:</span>
                  <span className="font-mono">{connectionStatus.businessAccountId}</span>
                </div>
                {!connectionStatus.connected && connectionStatus.error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-md">
                    <p className="text-xs text-red-600 dark:text-red-400 font-mono break-words">
                      {connectionStatus.error}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">قوالب الرسائل</h3>
            <p className="text-sm text-muted-foreground">القوالب المعتمدة من Meta</p>
          </div>
          <Button onClick={fetchTemplates} disabled={isFetchingTemplates}>
            {isFetchingTemplates ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="ml-2 h-4 w-4" />
            )}
            جلب القوالب
          </Button>
        </div>

        {templates.length > 0 ? (
          <div className="space-y-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={template.status === "APPROVED" ? "default" : "secondary"}>
                        {template.status}
                      </Badge>
                      <Badge variant="outline">{template.language}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {template.components.map((component, idx) => {
                    if (component.type === "BODY" && component.text) {
                      return (
                        <div key={idx} className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {component.text}
                        </div>
                      )
                    }
                    return null
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-muted">
            <CardContent className="pt-6">
              <p className="text-sm text-center text-muted-foreground">
                لا توجد قوالب محملة. اضغط على "جلب القوالب" لتحميل القوالب المعتمدة من حسابك.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
