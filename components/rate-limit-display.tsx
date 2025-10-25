"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, RefreshCw, TrendingUp, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface RateLimitData {
  success: boolean
  dailyLimit: number
  used: number
  remaining: number
  messagingLimitTier: string
  qualityRating: string
}

export function RateLimitDisplay() {
  const [rateLimits, setRateLimits] = useState<RateLimitData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const fetchRateLimits = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/meta-rate-limits")
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "فشل في جلب حدود الإرسال")
      }

      setRateLimits(data)
    } catch (err) {
      console.error("[v0] Error fetching rate limits:", err)
      setError(err instanceof Error ? err.message : "فشل في جلب حدود الإرسال")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRateLimits()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>خطأ في جلب حدود الإرسال</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchRateLimits}>
            <RefreshCw className="h-4 w-4 ml-2" />
            إعادة المحاولة
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!rateLimits) {
    return null
  }

  const usagePercentage = (rateLimits.used / rateLimits.dailyLimit) * 100
  const isWarning = rateLimits.remaining <= 100 || usagePercentage >= 90
  const isCritical = rateLimits.remaining <= 0 || usagePercentage >= 100
  const isExceeded = rateLimits.used > rateLimits.dailyLimit

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 75) return "bg-orange-500"
    if (percentage >= 50) return "bg-yellow-500"
    if (percentage >= 25) return "bg-lime-500"
    return "bg-green-500"
  }

  const getTierLabel = (tier: string) => {
    const tierMap: Record<string, string> = {
      TIER_50: "50 رسالة",
      TIER_250: "250 رسالة",
      TIER_1K: "1,000 رسالة",
      TIER_10K: "10,000 رسالة",
      TIER_100K: "100,000 رسالة",
      TIER_UNLIMITED: "غير محدود",
    }
    return tierMap[tier] || tier
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "GREEN":
        return "bg-green-500"
      case "YELLOW":
        return "bg-yellow-500"
      case "RED":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getQualityLabel = (quality: string) => {
    switch (quality) {
      case "GREEN":
        return "ممتاز"
      case "YELLOW":
        return "متوسط"
      case "RED":
        return "منخفض"
      default:
        return quality
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="w-full bg-muted h-2">
        <div
          className={`h-full transition-all duration-500 ${getProgressBarColor(usagePercentage)}`}
          style={{ width: `${Math.min(usagePercentage, 100)}%` }}
        />
      </div>

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">الحد خلال آخر 24 ساعة (نافذة متداولة)</p>
            <p className="text-lg font-bold">
              {rateLimits.remaining.toLocaleString()} / {rateLimits.dailyLimit.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isCritical ? "destructive" : isWarning ? "default" : "secondary"}>
            {usagePercentage.toFixed(1)}%
          </Badge>
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      {isExpanded && (
        <CardContent className="pt-0 pb-6 space-y-4 border-t">
          <div className="flex items-center justify-between pt-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">المرسل في آخر 24 ساعة:</span>
                <span className="font-medium">{rateLimits.used.toLocaleString()} رسالة</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchRateLimits}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-blue-900 text-sm">
              <strong>📊 نافذة الـ24 ساعة المتداولة:</strong>
              <br />
              يحسب Meta الحد بناءً على آخر 24 ساعة، وليس من منتصف الليل. إذا أرسلت رسالة الساعة 10 صباحاً، ستُحتسب حتى
              الساعة 10 صباحاً في اليوم التالي.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">المستوى:</span>
              <Badge variant="outline">{getTierLabel(rateLimits.messagingLimitTier)}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">الجودة:</span>
              <Badge className={getQualityColor(rateLimits.qualityRating)}>
                {getQualityLabel(rateLimits.qualityRating)}
              </Badge>
            </div>
          </div>

          {isExceeded && (
            <Alert variant="destructive" className="border-2 border-red-500">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-lg font-bold">🚫 تم تجاوز الحد!</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="font-bold">
                  لقد تجاوزت الحد بـ {(rateLimits.used - rateLimits.dailyLimit).toLocaleString()} رسالة
                </p>
                <p className="text-sm">
                  <strong>ماذا يعني هذا؟</strong>
                  <br />• WhatsApp يقبل الرسائل (status: "accepted") لكنه <strong>لا يوصلها</strong> للعملاء
                  <br />• الرسائل التي تتجاوز الحد لن تصل إلى المستلمين
                  <br />• سيتم تحرير الحد تدريجياً كلما خرجت رسالة من نافذة الـ24 ساعة
                </p>
                <p className="text-sm mt-2 bg-red-950/50 p-2 rounded">
                  💡 <strong>الحل:</strong> انتظر حتى تخرج بعض الرسائل من نافذة الـ24 ساعة، أو قم بترقية حسابك لزيادة
                  الحد من إعدادات Meta Business
                </p>
              </AlertDescription>
            </Alert>
          )}

          {isCritical && !isExceeded && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>تحذير: الحد على وشك الانتهاء!</AlertTitle>
              <AlertDescription>
                تبقى {rateLimits.remaining} رسالة فقط. سيتم تحرير الحد تدريجياً كلما خرجت رسالة من نافذة الـ24 ساعة.
              </AlertDescription>
            </Alert>
          )}

          {isWarning && !isCritical && !isExceeded && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-900">
                اقتربت من الحد. تبقى {rateLimits.remaining} رسالة فقط.
              </AlertDescription>
            </Alert>
          )}

          {!isWarning && !isExceeded && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                يمكنك إرسال {rateLimits.remaining.toLocaleString()} رسالة إضافية خلال آخر 24 ساعة.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}
    </Card>
  )
}
