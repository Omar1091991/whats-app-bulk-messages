"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2,
  Send,
  MessageSquare,
  CheckCheck,
  Search,
  MoreVertical,
  Phone,
  Video,
  ArrowRight,
  ArrowDown,
  Download,
  FileDown,
  FileSpreadsheet,
  CheckSquare,
  Square,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import useSWR from "swr"

interface Conversation {
  phone_number: string
  contact_name: string
  unread_count: number
  last_message_text: string
  last_message_time: string
  last_activity: string
  last_message_is_outgoing?: boolean
  has_incoming_messages?: boolean
  has_replies?: boolean
}

interface Message {
  id: string
  message_id: string
  from_number: string
  from_name: string
  message_type: string
  message_text: string | null
  message_media_url: string | null
  message_media_mime_type: string | null
  timestamp: number | string
  status: string
  replied: boolean
  reply_text: string | null
  reply_sent_at: string | null
  created_at: string
  type?: "incoming" | "outgoing"
  template_name?: string
  to_number?: string
  media_url?: string
}

const MESSAGES_PER_PAGE = 10

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type FilterType = "all" | "unread" | "conversations"

export function WhatsAppInbox() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [replyText, setReplyText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [viewedConversations, setViewedConversations] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("viewedConversations")
      return stored ? new Set(JSON.parse(stored)) : new Set()
    }
    return new Set()
  })
  const [previousUnreadCounts, setPreviousUnreadCounts] = useState<Map<string, number>>(new Map())
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const [loadingMediaIds, setLoadingMediaIds] = useState<Set<string>>(new Set())
  const [mediaCache, setMediaCache] = useState<Map<string, string>>(new Map())
  // Removed: const [conversations, setConversations] = useState<Conversation[]>([])
  // Removed: const [hasMore, setHasMore] = useState(true)
  // Removed: const [isLoadingMore, setIsLoadingMore] = useState(false)
  // Removed: const [offset, setOffset] = useState(0)
  // Removed: const CONVERSATIONS_PER_PAGE = 100
  // Removed: const [totalConversations, setTotalConversations] = useState(0)
  // Removed: const [loadedConversations, setLoadedConversations] = useState(0)
  // Removed: const isInitialLoadingRef = useRef(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const conversationsListRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [showChat, setShowChat] = useState(false)

  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)
  const [isExportMode, setIsExportMode] = useState(false)

  const { data: conversationsData, mutate: mutateConversations } = useSWR(
    `/api/conversations?filter=${activeFilter}`,
    fetcher,
    {
      refreshInterval: 10000,
      dedupingInterval: 5000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  )

  const conversations = conversationsData?.conversations || []
  const totalConversations = conversationsData?.total || 0

  const conversationMessages: Message[] = conversationsData?.messages || []

  useEffect(() => {
    if (conversationMessages.length > 0 && isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [conversationMessages, isAtBottom])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight

      const atBottom = distanceFromBottom < 100
      setIsAtBottom(atBottom)
      setShowScrollButton(!atBottom)
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [selectedConversation])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    setIsAtBottom(true)
  }

  const sendReply = async () => {
    if (!selectedConversation || !replyText.trim()) return

    setIsSending(true)

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      message_id: `temp-${Date.now()}`,
      from_number: selectedConversation.phone_number,
      from_name: selectedConversation.contact_name,
      message_type: "text",
      message_text: replyText,
      message_media_url: null,
      message_media_mime_type: null,
      timestamp: new Date().toISOString(),
      status: "sent",
      replied: false,
      reply_text: null,
      reply_sent_at: null,
      created_at: new Date().toISOString(),
      type: "outgoing",
    }

    const currentReplyText = replyText
    setReplyText("")

    setTimeout(() => scrollToBottom(), 100)

    mutateConversations(
      async () => {
        try {
          const response = await fetch("/api/messages/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toNumber: selectedConversation.phone_number,
              text: currentReplyText,
            }),
          })

          if (!response.ok) throw new Error("فشل في إرسال الرد")

          toast({
            title: "تم الإرسال بنجاح",
            description: "تم إرسال الرد إلى العميل",
          })

          mutateConversations()

          const freshData = await fetch(
            `/api/conversations/${encodeURIComponent(selectedConversation.phone_number)}`,
          ).then((res) => res.json())

          return freshData
        } catch (error) {
          setReplyText(currentReplyText)
          toast({
            title: "خطأ",
            description: error instanceof Error ? error.message : "فشل في إرسال الرد",
            variant: "destructive",
          })
          throw error
        } finally {
          setIsSending(false)
        }
      },
      {
        optimisticData: {
          messages: [...conversationMessages, optimisticMessage],
        },
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      },
    )
  }

  const formatTimestamp = (timestamp: number | string) => {
    const date = typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp)
    const now = new Date()

    const dateAtMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const nowAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const diffInMs = nowAtMidnight.getTime() - dateAtMidnight.getTime()
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
    } else if (days === 1) {
      return "أمس"
    } else if (days < 7) {
      return date.toLocaleDateString("ar-SA", { weekday: "long" })
    } else {
      return date.toLocaleDateString("ar-SA", { day: "numeric", month: "numeric", year: "numeric" })
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const filteredConversations = conversations
    .filter(
      (conv) =>
        conv.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.phone_number.includes(searchQuery) ||
        conv.last_message_text?.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .filter((conv) => {
      if (activeFilter === "unread") {
        return conv.unread_count > 0
      }
      if (activeFilter === "conversations") {
        return conv.has_incoming_messages === true
      }
      return true
    })

  const searchSuggestions = searchQuery.trim() ? filteredConversations.slice(0, 5) : []

  const displayedConversations = filteredConversations

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setShowSearchSuggestions(false)
    setSearchQuery("")
    setShowChat(true)
    setFailedImages(new Set())
    if (typeof window !== "undefined") {
      const updatedViewedConversations = new Set(viewedConversations)
      updatedViewedConversations.add(conversation.phone_number)
      localStorage.setItem("viewedConversations", JSON.stringify([...updatedViewedConversations]))
      setViewedConversations(updatedViewedConversations)
    }
  }

  const handleBackToConversations = () => {
    setShowChat(false)
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("viewedConversations", JSON.stringify([...viewedConversations]))
    }
  }, [viewedConversations])

  useEffect(() => {
    if (!conversationsData || conversationsData.conversations.length === 0) return

    const newUnreadCounts = new Map<string, number>()
    const updatedViewedConversations = new Set(viewedConversations)
    let hasChanges = false

    conversationsData.conversations.forEach((conv) => {
      const currentUnreadCount = conv.unread_count
      const previousUnreadCount = previousUnreadCounts.get(conv.phone_number) || 0

      if (currentUnreadCount > previousUnreadCount) {
        updatedViewedConversations.delete(conv.phone_number)
        hasChanges = true
      }

      newUnreadCounts.set(conv.phone_number, currentUnreadCount)
    })

    if (hasChanges) {
      setViewedConversations(updatedViewedConversations)
      setPreviousUnreadCounts(newUnreadCounts)
    }
  }, [conversationsData])

  const isMediaId = (url: string | null): boolean => {
    if (!url) return false
    return /^\d+$/.test(url.trim())
  }

  const fetchMediaFromWhatsApp = async (mediaId: string): Promise<string | null> => {
    if (mediaCache.has(mediaId)) {
      return mediaCache.get(mediaId) || null
    }

    if (loadingMediaIds.has(mediaId)) {
      return null
    }

    setLoadingMediaIds((prev) => new Set(prev).add(mediaId))

    try {
      const response = await fetch(`/api/fetch-whatsapp-media?mediaId=${encodeURIComponent(mediaId)}`)

      if (response.status === 410) {
        setFailedImages((prev) => new Set(prev).add(mediaId))
        return null
      }

      const data = await response.json()

      if (data.dataUrl) {
        setMediaCache((prev) => new Map(prev).set(mediaId, data.dataUrl))
        return data.dataUrl
      } else {
        setFailedImages((prev) => new Set(prev).add(mediaId))
        return null
      }
    } catch (error) {
      setFailedImages((prev) => new Set(prev).add(mediaId))
      return null
    } finally {
      setLoadingMediaIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(mediaId)
        return newSet
      })
    }
  }

  const exportConversation = async (format: "json" | "csv") => {
    if (!selectedConversation) return

    try {
      const url = `/api/conversations/export?phone=${encodeURIComponent(selectedConversation.phone_number)}&format=${format}`
      const response = await fetch(url)

      if (!response.ok) throw new Error("فشل في تصدير المحادثة")

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `conversation-${selectedConversation.phone_number}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast({
        title: "تم التصدير بنجاح",
        description: `تم تصدير المحادثة بصيغة ${format.toUpperCase()}`,
      })
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تصدير المحادثة",
        variant: "destructive",
      })
    }
  }

  const toggleSelectConversation = (phoneNumber: string) => {
    setSelectedConversations((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(phoneNumber)) {
        newSet.delete(phoneNumber)
      } else {
        newSet.add(phoneNumber)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedConversations.size === displayedConversations.length) {
      setSelectedConversations(new Set())
    } else {
      setSelectedConversations(new Set(displayedConversations.map((c) => c.phone_number)))
    }
  }

  const cancelExportMode = () => {
    setIsExportMode(false)
    setSelectedConversations(new Set())
  }

  const enterExportMode = () => {
    setIsExportMode(true)
  }

  const exportSelectedConversations = async () => {
    if (selectedConversations.size === 0) {
      toast({
        title: "تنبيه",
        description: "الرجاء تحديد محادثة واحدة على الأقل",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)
    try {
      const phoneNumbers = Array.from(selectedConversations)
      const url = `/api/conversations/export-excel`
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumbers }),
      })

      if (!response.ok) throw new Error("فشل في تصدير المحادثات")

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `conversations-${new Date().toISOString().split("T")[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast({
        title: "تم التصدير بنجاح",
        description: `تم تصدير ${selectedConversations.size} محادثة بصيغة Excel`,
      })

      cancelExportMode()
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تصدير المحادثات",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportAllConversations = async () => {
    setIsExporting(true)
    try {
      const url = `/api/conversations/export-excel?filter=${activeFilter}`
      const response = await fetch(url)

      if (!response.ok) throw new Error("فشل في تصدير المحادثات")

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `all-conversations-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast({
        title: "تم التصدير بنجاح",
        description: `تم تصدير ${totalConversations} محادثة بصيغة Excel`,
      })
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تصدير المحادثات",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportAllConversationsPDF = async () => {
    setIsExporting(true)
    try {
      const url = `/api/conversations/export-pdf?filter=${activeFilter}`
      const response = await fetch(url)

      if (!response.ok) throw new Error("فشل في تصدير المحادثات")

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `all-conversations-${new Date().toISOString().split("T")[0]}.html`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast({
        title: "تم التصدير بنجاح",
        description: `تم تصدير ${totalConversations} محادثة بصيغة PDF`,
      })
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تصدير المحادثات",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportSelectedConversationsPDF = async () => {
    if (selectedConversations.size === 0) {
      toast({
        title: "تنبيه",
        description: "الرجاء تحديد محادثة واحدة على الأقل",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)
    try {
      const phoneNumbers = Array.from(selectedConversations)
      const url = `/api/conversations/export-pdf`
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumbers }),
      })

      if (!response.ok) throw new Error("فشل في تصدير المحادثات")

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `selected-conversations-${new Date().toISOString().split("T")[0]}.html`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast({
        title: "تم التصدير بنجاح",
        description: `تم تصدير ${selectedConversations.size} محادثة بصيغة PDF`,
      })

      cancelExportMode()
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تصدير المحادثات",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Removed: loadMoreConversations, and related effects and states

  if (!conversationsData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#111b21] overflow-hidden" dir="rtl">
      {/* Conversations Sidebar */}
      <div
        className={`${showChat ? "hidden md:flex" : "flex"} w-full md:w-[380px] lg:w-[420px] bg-[#111b21] border-l border-[#2a3942] flex-col h-screen`}
      >
        {/* Header */}
        <div className="bg-[#202c33] p-3 md:p-4 flex items-center justify-between flex-shrink-0">
          <h1 className="text-white text-lg md:text-xl font-semibold">المحادثات</h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="text-white hover:bg-[#2a3942] h-9 w-9 md:h-10 md:w-10">
              <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-2 bg-[#111b21] relative flex-shrink-0" ref={searchRef}>
          <div className="bg-[#202c33] rounded-lg flex items-center px-3 md:px-4 py-2">
            <Search className="h-4 w-4 md:h-5 md:w-5 text-white ml-2 md:ml-3" />
            <input
              type="text"
              placeholder="ابحث عن محادثة"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSearchSuggestions(e.target.value.trim().length > 0)
              }}
              onFocus={() => searchQuery.trim().length > 0 && setShowSearchSuggestions(true)}
              className="bg-transparent text-white placeholder:text-[#667781] outline-none flex-1 text-sm md:text-base"
            />
          </div>

          {showSearchSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-2 right-2 mt-1 bg-[#202c33] rounded-lg shadow-lg z-50 overflow-hidden">
              {searchSuggestions.map((suggestion) => (
                <div
                  key={suggestion.phone_number}
                  onClick={() => handleSelectConversation(suggestion)}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[#2a3942] transition-colors border-b border-[#2a3942] last:border-b-0"
                >
                  <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                    <AvatarFallback className="bg-[#00a884] text-white text-xs md:text-sm">
                      {getInitials(suggestion.contact_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm md:text-base truncate">{suggestion.contact_name}</h3>
                    <p className="text-xs md:text-sm text-[#667781] truncate">{suggestion.phone_number}</p>
                  </div>
                  {suggestion.unread_count > 0 && !viewedConversations.has(suggestion.phone_number) && (
                    <div className="bg-[#25d366] text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px] md:text-[11px] font-bold ml-2 flex-shrink-0">
                      {suggestion.unread_count}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-2 pb-2 bg-[#111b21] flex-shrink-0">
          <div className="relative group">
            <button
              className="w-full flex items-center justify-center gap-2 bg-[#202c33] hover:bg-[#2a3942] text-white rounded-lg py-2.5 px-3 transition-all text-sm font-medium"
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  <span>تصدير المحادثات</span>
                </>
              )}
            </button>
            <div className="absolute left-0 right-0 top-full mt-1 bg-[#202c33] rounded-lg shadow-lg overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="px-3 py-2 border-b border-[#2a3942]">
                <p className="text-xs text-[#8696a0] font-semibold">خيارات التصدير</p>
              </div>

              <button
                onClick={enterExportMode}
                disabled={isExporting}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-white hover:bg-[#2a3942] text-sm transition-colors disabled:opacity-50 border-b border-[#2a3942]"
              >
                <CheckSquare className="h-4 w-4 text-[#00a884]" />
                <span>تحديد محادثات</span>
              </button>

              <div className="px-3 py-2 bg-[#1a2730] border-b border-[#2a3942]">
                <p className="text-[10px] text-[#8696a0] font-medium">تصدير الكل ({totalConversations})</p>
              </div>
              <button
                onClick={exportAllConversations}
                disabled={isExporting}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-white hover:bg-[#2a3942] text-sm transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-500" />
                <span>تصدير Excel</span>
              </button>
              <button
                onClick={exportAllConversationsPDF}
                disabled={isExporting}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-white hover:bg-[#2a3942] text-sm transition-colors disabled:opacity-50"
              >
                <FileDown className="h-4 w-4 text-red-500" />
                <span>تصدير PDF</span>
              </button>
            </div>
          </div>
        </div>

        {isExportMode && displayedConversations.length > 0 && (
          <div className="px-2 pb-2 bg-[#111b21] flex-shrink-0">
            <div className="flex items-center justify-between bg-[#00a884] rounded-lg p-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-white hover:text-[#111b21] transition-colors"
                >
                  {selectedConversations.size === displayedConversations.length ? (
                    <CheckSquare className="h-5 w-5" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                  <span className="text-sm font-medium">
                    {selectedConversations.size === displayedConversations.length ? "إلغاء الكل" : "تحديد الكل"}
                  </span>
                </button>
                {selectedConversations.size > 0 && (
                  <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                    <span className="text-xs font-medium">محدد:</span>
                    <span className="text-sm font-bold">{selectedConversations.size}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedConversations.size > 0 && (
                  <>
                    <Button
                      onClick={exportSelectedConversations}
                      size="sm"
                      className="bg-white text-[#00a884] hover:bg-white/90 h-8 px-3 text-xs font-medium"
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <FileSpreadsheet className="h-3 w-3 ml-1" />
                          Excel
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={exportSelectedConversationsPDF}
                      size="sm"
                      className="bg-white text-red-500 hover:bg-white/90 h-8 px-3 text-xs font-medium"
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <FileDown className="h-3 w-3 ml-1" />
                          PDF
                        </>
                      )}
                    </Button>
                  </>
                )}
                <Button
                  onClick={cancelExportMode}
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="px-2 pb-2 bg-[#111b21] flex-shrink-0">
          <div className="flex gap-2 bg-[#202c33] rounded-lg p-1">
            <button
              onClick={() => setActiveFilter("all")}
              className={`flex-1 py-2 px-3 rounded-md text-xs md:text-sm font-medium transition-all ${
                activeFilter === "all"
                  ? "bg-[#00a884] text-white shadow-sm"
                  : "text-[#8696a0] hover:text-white hover:bg-[#2a3942]"
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setActiveFilter("unread")}
              className={`flex-1 py-2 px-3 rounded-md text-xs md:text-sm font-medium transition-all ${
                activeFilter === "unread"
                  ? "bg-[#00a884] text-white shadow-sm"
                  : "text-[#8696a0] hover:text-white hover:bg-[#2a3942]"
              }`}
            >
              غير مقروء
            </button>
            <button
              onClick={() => setActiveFilter("conversations")}
              className={`flex-1 py-2 px-3 rounded-md text-xs md:text-sm font-medium transition-all ${
                activeFilter === "conversations"
                  ? "bg-[#00a884] text-white shadow-sm"
                  : "text-[#8696a0] hover:text-white hover:bg-[#2a3942]"
              }`}
            >
              المحادثات
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div ref={conversationsListRef} className="flex-1 overflow-y-auto">
          {displayedConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-[#667781]">
              <MessageSquare className="h-12 w-12 mb-4" />
              <p className="text-sm md:text-base">
                {activeFilter === "unread"
                  ? "لا توجد رسائل غير مقروءة"
                  : activeFilter === "conversations"
                    ? "لا توجد محادثات واردة"
                    : "لا توجد محادثات"}
              </p>
            </div>
          ) : (
            <div>
              {totalConversations > 0 && (
                <div className="px-3 py-2.5 text-center bg-[#202c33] border-b border-[#2a3942] sticky top-0 z-10">
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <CheckCheck className="h-4 w-4 text-[#00a884]" />
                    <span className="text-white font-medium">{totalConversations}</span>
                    <span className="text-[#8696a0]">محادثة محملة</span>
                  </div>
                </div>
              )}

              {displayedConversations.map((conversation) => (
                <div
                  key={conversation.phone_number}
                  className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 cursor-pointer hover:bg-[#202c33] transition-colors ${
                    selectedConversation?.phone_number === conversation.phone_number ? "bg-[#2a3942]" : ""
                  }`}
                >
                  {isExportMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelectConversation(conversation.phone_number)
                      }}
                      className="flex-shrink-0 text-white hover:text-[#00a884] transition-colors"
                    >
                      {selectedConversations.has(conversation.phone_number) ? (
                        <CheckSquare className="h-5 w-5 text-[#00a884]" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                  )}

                  <div
                    onClick={() => handleSelectConversation(conversation)}
                    className="flex items-center gap-2 md:gap-3 flex-1 min-w-0"
                  >
                    <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                      <AvatarFallback className="bg-[#00a884] text-white text-xs md:text-sm">
                        {getInitials(conversation.contact_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-white font-medium text-sm md:text-base truncate">
                          {conversation.contact_name}
                        </h3>
                        <span className="text-[10px] md:text-xs text-[#667781] ml-2 flex-shrink-0">
                          {formatTimestamp(conversation.last_message_time)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs md:text-sm text-[#667781] truncate flex-1 flex items-center gap-1">
                          {conversation.last_message_is_outgoing && (
                            <CheckCheck className="h-3 w-3 text-[#53bdeb] flex-shrink-0" />
                          )}
                          <span className="truncate">{conversation.last_message_text || "رسالة"}</span>
                        </p>
                        {conversation.unread_count > 0 && !viewedConversations.has(conversation.phone_number) && (
                          <div className="bg-[#25d366] text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px] md:text-[11px] font-bold ml-2 flex-shrink-0">
                            {conversation.unread_count}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConversation ? (
        <div className={`${showChat ? "flex" : "hidden md:flex"} flex-1 flex-col h-screen`}>
          {/* Chat Header */}
          <div className="bg-[#202c33] p-2 md:p-3 flex items-center justify-between border-b border-[#2a3942] flex-shrink-0">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-[#2a3942] md:hidden h-9 w-9 flex-shrink-0"
                onClick={handleBackToConversations}
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Avatar className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0">
                <AvatarFallback className="bg-[#00a884] text-white text-xs md:text-sm">
                  {getInitials(selectedConversation.contact_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-medium text-sm md:text-base truncate">
                  {selectedConversation.contact_name}
                </h2>
                <p className="text-[10px] md:text-xs text-[#667781] truncate">{selectedConversation.phone_number}</p>
              </div>
            </div>
            <div className="flex gap-1 md:gap-2 flex-shrink-0">
              <Button variant="ghost" size="icon" className="text-white hover:bg-[#2a3942] h-9 w-9 md:h-10 md:w-10">
                <Video className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white hover:bg-[#2a3942] h-9 w-9 md:h-10 md:w-10">
                <Phone className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <div className="relative group">
                <Button variant="ghost" size="icon" className="text-white hover:bg-[#2a3942] h-9 w-9 md:h-10 md:w-10">
                  <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
                <div className="absolute left-0 top-full mt-1 bg-[#202c33] rounded-lg shadow-lg overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[150px]">
                  <button
                    onClick={() => exportConversation("json")}
                    className="w-full flex items-center gap-2 px-4 py-2 text-white hover:bg-[#2a3942] text-sm"
                  >
                    <Download className="h-4 w-4" />
                    <span>تصدير JSON</span>
                  </button>
                  <button
                    onClick={() => exportConversation("csv")}
                    className="w-full flex items-center gap-2 px-4 py-2 text-white hover:bg-[#2a3942] text-sm"
                  >
                    <Download className="h-4 w-4" />
                    <span>تصدير CSV</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-3 md:p-4 scroll-smooth relative"
            style={{ backgroundColor: "#0b141a" }}
          >
            {!conversationsData ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-[#667781]" />
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-2 md:space-y-3">
                {conversationMessages.map((message) => {
                  const isOutgoing = message.type === "outgoing"
                  const messageText = message.message_text || "رسالة"
                  const messageTime = message.timestamp
                  const templateName = isOutgoing ? message.template_name : null
                  const isButtonReply = message.message_type === "button_reply"
                  const messageTypeLabel = isOutgoing
                    ? message.message_type === "single"
                      ? "رسالة فردية"
                      : message.message_type === "bulk_instant"
                        ? "رسالة جماعية"
                        : message.message_type === "bulk_scheduled"
                          ? "رسالة مجدولة"
                          : message.message_type === "reply"
                            ? "رد"
                            : null
                    : null
                  const rawMediaUrl = message.media_url || message.message_media_url
                  const isMediaIdValue = isMediaId(rawMediaUrl)
                  const cachedMediaUrl = isMediaIdValue && rawMediaUrl ? mediaCache.get(rawMediaUrl) : null
                  const mediaUrl = cachedMediaUrl || (!isMediaIdValue ? rawMediaUrl : null)
                  const isLoadingMedia = isMediaIdValue && rawMediaUrl ? loadingMediaIds.has(rawMediaUrl) : false

                  if (
                    isMediaIdValue &&
                    rawMediaUrl &&
                    !cachedMediaUrl &&
                    !isLoadingMedia &&
                    !failedImages.has(rawMediaUrl)
                  ) {
                    fetchMediaFromWhatsApp(rawMediaUrl)
                  }

                  const hasFailedImage = rawMediaUrl ? failedImages.has(rawMediaUrl) : false

                  return (
                    <div key={message.id} className={`flex ${isOutgoing ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`${
                          isOutgoing ? "bg-[#056162]" : "bg-[#262d31]"
                        } text-white rounded-lg p-2 md:p-3 max-w-[85%] md:max-w-[65%] shadow-sm`}
                      >
                        {!isOutgoing && isButtonReply && (
                          <div className="mb-2 pb-2 border-b border-white/10">
                            <div className="inline-flex items-center gap-1.5 bg-[#00a884]/20 px-2.5 py-1 rounded-full">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#00a884]"></div>
                              <span className="text-[10px] md:text-xs text-[#00d9ff] font-medium">رد سريع</span>
                            </div>
                          </div>
                        )}
                        {isOutgoing && (templateName || messageTypeLabel) && (
                          <div className="mb-2 pb-2 border-b border-white/10">
                            {templateName && (
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-[10px] md:text-xs text-[#8696a0]">القالب:</span>
                                <span className="text-[10px] md:text-xs text-[#00d9ff] font-medium">
                                  {templateName}
                                </span>
                              </div>
                            )}
                            {messageTypeLabel && (
                              <div className="inline-block bg-white/10 px-2 py-0.5 rounded text-[9px] md:text-[10px] text-[#8696a0]">
                                {messageTypeLabel}
                              </div>
                            )}
                          </div>
                        )}
                        {isLoadingMedia && (
                          <div className="mb-2 rounded-lg overflow-hidden bg-[#1a2730] p-4 flex flex-col items-center justify-center min-h-[120px]">
                            <Loader2 className="h-6 w-6 animate-spin text-[#00a884] mb-2" />
                            <div className="text-[#8696a0] text-xs">جاري تحميل الصورة...</div>
                          </div>
                        )}
                        {mediaUrl && !hasFailedImage && !isLoadingMedia && (
                          <div className="mb-2 rounded-lg overflow-hidden bg-[#1a2730]">
                            <img
                              src={mediaUrl || "/placeholder.svg"}
                              alt="صورة"
                              className="w-full h-auto max-h-[300px] object-cover"
                              onError={() => {
                                if (rawMediaUrl) {
                                  setFailedImages((prev) => new Set(prev).add(rawMediaUrl))
                                }
                              }}
                            />
                          </div>
                        )}
                        {hasFailedImage && !isLoadingMedia && (
                          <div className="mb-2 rounded-lg overflow-hidden bg-[#1a2730] p-4 flex flex-col items-center justify-center min-h-[120px] border border-[#2a3942]">
                            <div className="text-4xl mb-2">🖼️</div>
                            <div className="text-[#8696a0] text-xs text-center">الصورة غير متوفرة</div>
                            <div className="text-[#667781] text-[10px] text-center mt-1">انتهت صلاحية الوسائط</div>
                          </div>
                        )}
                        <p className="text-xs md:text-sm whitespace-pre-wrap break-words">{messageText}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[9px] md:text-[10px] text-[#8696a0]">
                            {formatTimestamp(messageTime)}
                          </span>
                          {isOutgoing && <CheckCheck className="h-3 w-3 text-[#53bdeb]" />}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
            {showScrollButton && (
              <Button
                onClick={scrollToBottom}
                size="icon"
                className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 bg-[#202c33] hover:bg-[#2a3942] text-white h-10 w-10 md:h-11 md:w-11 rounded-full shadow-lg z-10 transition-all duration-300"
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Reply Input */}
          <div className="bg-[#202c33] p-2 md:p-3 border-t border-[#2a3942] flex-shrink-0">
            <div className="flex items-end gap-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendReply()
                  }
                }}
                placeholder="اكتب رسالة..."
                className="flex-1 bg-[#2a3942] border-none text-white placeholder:text-[#667781] resize-none min-h-[40px] md:min-h-[44px] max-h-[150px] md:max-h-[200px] text-sm md:text-base"
                rows={1}
              />
              <Button
                onClick={sendReply}
                disabled={isSending || !replyText.trim()}
                size="icon"
                className="bg-[#00a884] hover:bg-[#06cf9c] text-white h-10 w-10 md:h-11 md:w-11 rounded-full flex-shrink-0"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 md:h-5 md:w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-[#0b141a]">
          <div className="text-center text-[#667781] px-4">
            <MessageSquare className="h-16 w-16 md:h-24 md:w-24 mx-auto mb-4 opacity-20" />
            <h2 className="text-xl md:text-2xl font-light mb-2">واتساب ويب</h2>
            <p className="text-xs md:text-sm">اختر محادثة لبدء المراسلة</p>
          </div>
        </div>
      )}
    </div>
  )
}
