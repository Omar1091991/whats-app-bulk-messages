"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, ExternalLink, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

export function WebhookInfo() {
  const [copied, setCopied] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState<string>("")
  const [verifyToken, setVerifyToken] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [existingSettings, setExistingSettings] = useState<any>(null)
  const [isLocalhost, setIsLocalhost] = useState(false)
  const { toast } = useToast()

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings")
      const data = await res.json()
      setExistingSettings(data)
      if (data?.webhook_verify_token) {
        setVerifyToken(data.webhook_verify_token)
      } else {
        setVerifyToken("")
      }
    } catch (error) {
      console.error("[v0] Error fetching settings:", error)
      setVerifyToken("")
      setExistingSettings(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const url = `${window.location.origin}/api/webhooks`
    setWebhookUrl(url)
    setIsLocalhost(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    fetchSettings()
  }, [])

  const generateToken = async () => {
    if (!existingSettings || !existingSettings.phone_number_id) {
      toast({
        title: "خطأ",
        description: "يجب حفظ إعدادات واتساب أولاً قبل إنشاء رمز التحقق",
        variant: "destructive",
      })
      return
    }

    setGenerating(true)
    try {
      // Generate a random token
      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_account_id: existingSettings.business_account_id,
          phone_number_id: existingSettings.phone_number_id,
          access_token: existingSettings.access_token,
          webhook_verify_token: newToken,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        console.error("[v0] API error:", errorData)
        throw new Error(errorData.error || "Failed to save token")
      }

      setVerifyToken(newToken)
      toast({
        title: "تم إنشاء رمز التحقق",
        description: "تم إنشاء وحفظ رمز التحقق بنجاح",
      })
    } catch (error) {
      console.error("[v0] Error generating token:", error)
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في إنشاء رمز التحقق",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          تكوين Webhook في Meta
          <ExternalLink className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
        <CardDescription>استخدم هذه المعلومات لتكوين Webhook في Meta for Developers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLocalhost && (
          <Alert variant="destructive">
            <AlertDescription className="text-sm leading-relaxed">
              <strong>تحذير:</strong> أنت تستخدم localhost حالياً. Meta لا يمكنه الوصول إلى localhost. يجب عليك نشر
              التطبيق على Vercel أو استخدام خدمة مثل ngrok للحصول على URL عام قبل تكوين Webhook في Meta.
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertDescription className="text-sm leading-relaxed">
            لتلقي الرسائل الواردة من واتساب، يجب عليك تكوين Webhook في لوحة تحكم Meta for Developers. اتبع الخطوات
            التالية:
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {/* Webhook URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">عنوان URL للاستدعاء (Callback URL)</label>
            <div className="flex gap-2">
              <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm break-all">{webhookUrl}</div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, "url")}
                className="shrink-0"
              >
                {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {!isLocalhost && (
              <p className="text-xs text-muted-foreground">تأكد من أن هذا URL يمكن الوصول إليه من الإنترنت العام</p>
            )}
          </div>

          {/* Verify Token */}
          <div className="space-y-2">
            <label className="text-sm font-medium">رمز التحقق (Verify Token)</label>
            {loading ? (
              <div className="flex-1 p-3 bg-muted rounded-md text-sm text-muted-foreground">جاري التحميل...</div>
            ) : verifyToken ? (
              <div className="flex gap-2">
                <div className="flex-1 p-3 bg-primary/5 border-2 border-primary/20 rounded-md font-mono text-sm break-all">
                  {verifyToken}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(verifyToken, "token")}
                  className="shrink-0"
                >
                  {copied === "token" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Alert>
                  <AlertDescription>
                    {!existingSettings || !existingSettings.phone_number_id
                      ? "يجب حفظ إعدادات واتساب أولاً قبل إنشاء رمز التحقق"
                      : "لم يتم تعيين رمز التحقق بعد. انقر على الزر أدناه لإنشاء رمز جديد."}
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={generateToken}
                  disabled={generating || !existingSettings || !existingSettings.phone_number_id}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                      جاري الإنشاء...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 ml-2" />
                      إنشاء رمز التحقق
                    </>
                  )}
                </Button>
              </div>
            )}
            {verifyToken && !loading && (
              <Button
                variant="outline"
                size="sm"
                onClick={generateToken}
                disabled={generating}
                className="w-full bg-transparent"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 ml-2" />
                    إعادة إنشاء رمز جديد
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-medium text-sm">خطوات التكوين في Meta:</h4>
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground leading-relaxed">
            <li>انتقل إلى لوحة تحكم Meta for Developers</li>
            <li>اختر تطبيقك ثم انتقل إلى WhatsApp {">"} Configuration</li>
            <li>في قسم Webhook، انقر على "Edit"</li>
            <li>الصق عنوان URL للاستدعاء في حقل "Callback URL"</li>
            <li>الصق رمز التحقق في حقل "Verify Token"</li>
            <li>انقر على "Verify and Save"</li>
            <li>اشترك في حقل "messages" لتلقي الرسائل الواردة</li>
          </ol>
          <div className="mt-4 p-3 bg-muted/50 rounded-md">
            <h5 className="font-medium text-sm mb-2">نصائح لحل المشاكل:</h5>
            <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
              <li>تأكد من أن رمز التحقق يطابق تماماً الرمز المحفوظ في الإعدادات</li>
              <li>تأكد من أن URL يمكن الوصول إليه من الإنترنت (ليس localhost)</li>
              <li>تحقق من أن التطبيق منشور ويعمل بشكل صحيح</li>
              <li>إذا استمرت المشكلة، جرب إعادة إنشاء رمز التحقق</li>
            </ul>
          </div>
        </div>

        <Button variant="outline" className="w-full bg-transparent" asChild>
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 ml-2" />
            فتح Meta for Developers
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
