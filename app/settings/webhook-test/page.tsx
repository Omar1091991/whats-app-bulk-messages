"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, CheckCircle2, XCircle, AlertCircle } from "lucide-react"

export default function WebhookTestPage() {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Test parameters
  const [testToken, setTestToken] = useState("")
  const [testChallenge, setTestChallenge] = useState("test_challenge_12345")

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        setTestToken(data.webhook_verify_token || "")
      }
    } catch (error) {
      console.error("Error loading settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const testWebhook = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const webhookUrl = `${window.location.origin}/api/webhooks`
      const testUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(testToken)}&hub.challenge=${encodeURIComponent(testChallenge)}`

      console.log("[v0] Testing webhook with URL:", testUrl)

      const response = await fetch(testUrl, {
        method: "GET",
      })

      const responseText = await response.text()
      console.log("[v0] Webhook test response:", { status: response.status, body: responseText })

      setTestResult({
        success: response.status === 200 && responseText === testChallenge,
        status: response.status,
        response: responseText,
        expected: testChallenge,
        matched: responseText === testChallenge,
      })
    } catch (error: any) {
      console.error("[v0] Webhook test error:", error)
      setTestResult({
        success: false,
        error: error.message,
      })
    } finally {
      setTesting(false)
    }
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks` : ""
  const isLocalhost = webhookUrl.includes("localhost") || webhookUrl.includes("127.0.0.1")

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">اختبار Webhook</h1>
        <p className="text-muted-foreground">اختبر وتحقق من إعدادات Webhook الخاصة بك</p>
      </div>

      {isLocalhost && (
        <Alert className="mb-6 border-yellow-500 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>تحذير:</strong> أنت تستخدم localhost. Meta لا يمكنه الوصول إلى localhost URLs. يجب عليك نشر التطبيق
            على Vercel أو استخدام خدمة مثل ngrok للاختبار.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>الإعدادات الحالية</CardTitle>
          <CardDescription>معلومات Webhook المطلوبة لتكوين Meta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">عنوان URL للاستدعاء (Callback URL)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, "url")}
                className="shrink-0"
              >
                {copied === "url" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">رمز التحقق (Verify Token)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={settings?.webhook_verify_token || "غير متوفر"} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(settings?.webhook_verify_token || "", "token")}
                disabled={!settings?.webhook_verify_token}
                className="shrink-0"
              >
                {copied === "token" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Webhook */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>اختبار Webhook محلياً</CardTitle>
          <CardDescription>اختبر ما إذا كان endpoint يستجيب بشكل صحيح</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="testToken">رمز التحقق للاختبار</Label>
            <Input
              id="testToken"
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
              placeholder="أدخل رمز التحقق"
              className="font-mono"
            />
          </div>

          <div>
            <Label htmlFor="testChallenge">Challenge للاختبار</Label>
            <Input
              id="testChallenge"
              value={testChallenge}
              onChange={(e) => setTestChallenge(e.target.value)}
              placeholder="test_challenge_12345"
              className="font-mono"
            />
          </div>

          <Button onClick={testWebhook} disabled={testing || !testToken} className="w-full">
            {testing ? "جاري الاختبار..." : "اختبار Webhook"}
          </Button>

          {testResult && (
            <Alert className={testResult.success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription>
                {testResult.success ? (
                  <div className="text-green-800">
                    <strong>نجح الاختبار!</strong>
                    <p className="text-sm mt-1">Webhook يستجيب بشكل صحيح ويعيد challenge المتوقع.</p>
                  </div>
                ) : (
                  <div className="text-red-800">
                    <strong>فشل الاختبار</strong>
                    {testResult.error ? (
                      <p className="text-sm mt-1">خطأ: {testResult.error}</p>
                    ) : (
                      <div className="text-sm mt-1 space-y-1">
                        <p>حالة الاستجابة: {testResult.status}</p>
                        <p>الاستجابة المستلمة: {testResult.response}</p>
                        <p>Challenge المتوقع: {testResult.expected}</p>
                        <p>التطابق: {testResult.matched ? "نعم ✓" : "لا ✗"}</p>
                      </div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>خطوات تكوين Webhook في Meta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-3 text-sm">
            <li>
              انتقل إلى{" "}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Meta Developers Console
              </a>
            </li>
            <li>اختر تطبيقك وانتقل إلى WhatsApp {">"} Configuration</li>
            <li>في قسم Webhooks، انقر على "Edit" أو "Configure"</li>
            <li>
              أدخل <strong>Callback URL</strong>: <code className="bg-gray-100 px-2 py-1 rounded">{webhookUrl}</code>
            </li>
            <li>
              أدخل <strong>Verify Token</strong>:{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">{settings?.webhook_verify_token || "غير متوفر"}</code>
            </li>
            <li>انقر على "Verify and Save"</li>
            <li>اشترك في webhook fields المطلوبة (messages، message_status)</li>
          </ol>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>ملاحظة مهمة:</strong> يجب أن يكون التطبيق منشوراً على URL عام (مثل Vercel) حتى يتمكن Meta من التحقق
              من Webhook. لا يمكن استخدام localhost.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
