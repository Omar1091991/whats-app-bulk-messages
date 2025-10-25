"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Send, Users, CheckCircle, Inbox, Calendar, Clock, TrendingUp, BarChart3 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { RateLimitDisplay } from "@/components/rate-limit-display"

interface Stats {
  totalSent: number
  successfulMessages: number
  templatesCount: number
  incomingMessages: number
  messagesByType?: {
    single: number
    bulkInstant: number
    bulkScheduled: number
    reply: number
  }
  todayStats: {
    sent: number
    successful: number
  }
  scheduledMessages: {
    pending: number
    today: number
    completed: number
    failed: number
  }
  date?: string
}

interface DailyStats {
  date: string
  total_sent: number
  successful_messages: number
  single_messages: number
  bulk_instant_messages: number
  bulk_scheduled_messages: number
  reply_messages: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalSent: 0,
    successfulMessages: 0,
    templatesCount: 0,
    incomingMessages: 0,
    todayStats: {
      sent: 0,
      successful: 0,
    },
    scheduledMessages: {
      pending: 0,
      today: 0,
      completed: 0,
      failed: 0,
    },
  })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<"all" | "today" | "history">("today")
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [historyData, setHistoryData] = useState<DailyStats[]>([])

  useEffect(() => {
    loadStats()
    loadHistory()
  }, [])

  useEffect(() => {
    if (selectedView === "history" && selectedDate) {
      loadStatsForDate(selectedDate)
    } else if (selectedView !== "history") {
      loadStats()
    }
  }, [selectedView, selectedDate])

  const loadStats = async () => {
    try {
      const response = await fetch("/api/stats")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("[v0] Error loading stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStatsForDate = async (dateStr: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/stats?date=${dateStr}`)
      if (response.ok) {
        const data = await response.json()
        setStats({
          ...data,
          todayStats: {
            sent: data.totalSent,
            successful: data.successfulMessages,
          },
          scheduledMessages: {
            pending: 0,
            today: 0,
            completed: 0,
            failed: 0,
          },
        })
      } else {
        // No data for this date
        setStats({
          totalSent: 0,
          successfulMessages: 0,
          templatesCount: 0,
          incomingMessages: 0,
          messagesByType: {
            single: 0,
            bulkInstant: 0,
            bulkScheduled: 0,
            reply: 0,
          },
          todayStats: {
            sent: 0,
            successful: 0,
          },
          scheduledMessages: {
            pending: 0,
            today: 0,
            completed: 0,
            failed: 0,
          },
          date: dateStr,
        })
      }
    } catch (error) {
      console.error("[v0] Error loading stats for date:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadHistory = async () => {
    try {
      const response = await fetch("/api/stats/history?limit=7")
      if (response.ok) {
        const data = await response.json()
        setHistoryData(data.history || [])
      }
    } catch (error) {
      console.error("[v0] Error loading history:", error)
    }
  }

  const displayStats = selectedView === "today" ? stats.todayStats : stats

  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
      <div className="mb-6 md:mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-balance mb-2">
          مرحباً بك في نظام الرسائل الجماعية
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground">أرسل رسائل واتساب لعملائك بسهولة وسرعة</p>
      </div>

      <Tabs
        value={selectedView}
        onValueChange={(v) => setSelectedView(v as "all" | "today" | "history")}
        className="mb-4 md:mb-6 animate-in fade-in slide-in-from-top-4 duration-700 delay-100"
      >
        <TabsList className="grid w-full max-w-2xl grid-cols-3 h-auto">
          <TabsTrigger value="all" className="text-xs sm:text-sm py-2">
            <BarChart3 className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">الإحصائيات الإجمالية</span>
            <span className="sm:hidden">الإجمالي</span>
          </TabsTrigger>
          <TabsTrigger value="today" className="text-xs sm:text-sm py-2">
            <Clock className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">إحصائيات اليوم</span>
            <span className="sm:hidden">اليوم</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm py-2">
            <Calendar className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">السجل التاريخي</span>
            <span className="sm:hidden">السجل</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {selectedView === "history" && (
        <div className="mb-4 md:mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-2 max-w-md">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={format(new Date(), "yyyy-MM-dd")}
              min="2024-01-01"
              className={cn(
                "flex h-9 md:h-10 w-full rounded-md border border-input bg-background px-2 md:px-3 py-2 text-xs md:text-sm ring-offset-background",
                "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              )}
              placeholder="اختر تاريخاً لعرض إحصائياته"
            />
          </div>
        </div>
      )}

      <div className="mb-6 md:mb-8 animate-in fade-in slide-in-from-top-4 duration-700 delay-200">
        <RateLimitDisplay />
      </div>

      <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4 mb-6 md:mb-8">
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">الرسائل المرسلة</CardTitle>
            <Send className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="text-lg sm:text-xl md:text-2xl font-bold">
              {isLoading ? "..." : selectedView === "today" ? displayStats.sent : stats.totalSent}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {selectedView === "history" && selectedDate
                ? `إحصائيات ${format(new Date(selectedDate), "PPP", { locale: ar })}`
                : selectedView === "today"
                  ? "رسائل اليوم"
                  : "إجمالي الرسائل المرسلة"}
            </p>
          </CardContent>
        </Card>

        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[400ms]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">الرسائل الناجحة</CardTitle>
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="text-lg sm:text-xl md:text-2xl font-bold">
              {isLoading ? "..." : selectedView === "today" ? displayStats.successful : stats.successfulMessages}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {selectedView === "history" && selectedDate
                ? "تم التسليم بنجاح"
                : selectedView === "today"
                  ? "نجحت اليوم"
                  : "تم التسليم بنجاح"}
            </p>
          </CardContent>
        </Card>

        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[500ms]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">
              {selectedView === "history" ? "القوالب المستخدمة" : "الرسائل المجدولة"}
            </CardTitle>
            {selectedView === "history" ? (
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            ) : (
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="text-lg sm:text-xl md:text-2xl font-bold">
              {isLoading ? "..." : selectedView === "history" ? stats.templatesCount : stats.scheduledMessages.pending}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {selectedView === "history"
                ? "قوالب مختلفة"
                : stats.scheduledMessages.today > 0
                  ? `${stats.scheduledMessages.today} اليوم`
                  : "في انتظار الإرسال"}
            </p>
            {selectedView === "all" && stats.scheduledMessages.completed > 0 && (
              <p className="text-[10px] sm:text-xs text-green-600 mt-1">
                {stats.scheduledMessages.completed} تم إرسالها
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[600ms]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">
              {selectedView === "today" || selectedView === "history" ? "القوالب" : "الرسائل الواردة"}
            </CardTitle>
            {selectedView === "today" || selectedView === "history" ? (
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            ) : (
              <Inbox className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="text-lg sm:text-xl md:text-2xl font-bold">
              {isLoading
                ? "..."
                : selectedView === "today" || selectedView === "history"
                  ? stats.templatesCount
                  : stats.incomingMessages}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {selectedView === "today" || selectedView === "history" ? "قوالب الرسائل المستخدمة" : "رسائل من العملاء"}
            </p>
          </CardContent>
        </Card>
      </div>

      {(selectedView === "all" || selectedView === "history") && stats.messagesByType && (
        <Card className="mb-6 md:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-700">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              تفصيل الرسائل حسب النوع
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {selectedView === "history" && selectedDate
                ? `إحصائيات ${format(new Date(selectedDate), "PPP", { locale: ar })}`
                : "إجمالي الرسائل المرسلة حسب النوع"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">رسائل فردية</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{stats.messagesByType.single}</p>
                </div>
                <Send className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
              </div>
              <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">رسائل جماعية فورية</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{stats.messagesByType.bulkInstant}</p>
                </div>
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
              </div>
              <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">رسائل جماعية مجدولة</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{stats.messagesByType.bulkScheduled}</p>
                </div>
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
              </div>
              <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">ردود على العملاء</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{stats.messagesByType.reply}</p>
                </div>
                <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedView === "all" && historyData.length > 0 && (
        <Card className="mb-6 md:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[800ms]">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
              آخر 7 أيام
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              نظرة سريعة على نشاط الرسائل في الأيام السابقة
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              {historyData.map((day) => (
                <div key={day.date} className="flex items-center gap-2 sm:gap-4">
                  <div className="w-20 sm:w-32 text-xs sm:text-sm font-medium">
                    {format(new Date(day.date), "PPP", { locale: ar })}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all"
                          style={{
                            width: `${Math.min((day.total_sent / Math.max(...historyData.map((d) => d.total_sent))) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="w-12 sm:w-20 text-xs sm:text-sm font-bold text-left">{day.total_sent}</div>
                    </div>
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">{day.successful_messages} ناجحة</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 mb-6 md:mb-8">
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[900ms]">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg md:text-xl">إرسال رسالة واحدة</CardTitle>
            <CardDescription className="text-xs sm:text-sm">أرسل رسالة واتساب لرقم واحد</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <Link href="/single-message">
              <Button className="w-full text-sm sm:text-base" size="lg">
                <Send className="ml-2 h-4 w-4" />
                إرسال رسالة
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-1000">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6">
            <CardTitle className="text-base sm:text-lg md:text-xl">إرسال رسائل جماعية</CardTitle>
            <CardDescription className="text-xs sm:text-sm">أرسل رسائل لمجموعة من الأرقام دفعة واحدة</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <Link href="/bulk-messages">
              <Button className="w-full text-sm sm:text-base" size="lg" variant="secondary">
                <Users className="ml-2 h-4 w-4" />
                رسائل جماعية
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
