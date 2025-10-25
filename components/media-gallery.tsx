"use client"
// Build timestamp: 2025-01-10 - Force cache invalidation

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LoaderIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react"

interface UploadedMedia {
  id: string
  media_id: string
  filename: string
  mime_type: string
  file_size: number
  uploaded_at: string
  preview_url?: string
}

interface MediaGalleryProps {
  onSelectMedia: (mediaId: string, filename: string, previewUrl?: string) => void
  selectedMediaId?: string
}

export function MediaGallery({ onSelectMedia, selectedMediaId }: MediaGalleryProps) {
  const [open, setOpen] = useState(false)
  const [mediaList, setMediaList] = useState<UploadedMedia[]>([])
  const [loading, setLoading] = useState(false)
  const [tableNotFound, setTableNotFound] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchMedia()
    }
  }, [open])

  const fetchMedia = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/uploaded-media")
      const data = await response.json()

      if (data.success) {
        setMediaList(data.media)
        setTableNotFound(data.tableNotFound || false)
      } else {
        toast({
          title: "خطأ",
          description: "فشل في تحميل الصور المرفوعة",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching media:", error)
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل الصور",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectMedia = (media: UploadedMedia) => {
    onSelectMedia(media.media_id, media.filename, media.preview_url)
    setOpen(false)
    toast({
      title: "تم الاختيار",
      description: `تم اختيار الصورة: ${media.filename}`,
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full bg-transparent">
          <ImageIcon className="ml-2 h-4 w-4" />
          اختر من الصور المرفوعة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>الصور المرفوعة على WhatsApp</DialogTitle>
          <DialogDescription>اختر صورة من الصور التي تم رفعها مسبقاً لإعادة استخدامها</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoaderIcon className="h-8 w-8 animate-spin" />
            <span className="mr-3">جاري التحميل...</span>
          </div>
        ) : tableNotFound ? (
          <div className="py-8">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-right">
                <p className="font-semibold mb-2">معرض الصور غير مفعّل بعد</p>
                <p className="text-sm text-muted-foreground mb-3">
                  لتفعيل ميزة معرض الصور المرفوعة، يجب تشغيل السكريبت التالي من قائمة السكريبتات:
                </p>
                <code className="block bg-muted p-2 rounded text-sm">scripts/create_uploaded_media_table.sql</code>
                <p className="text-sm text-muted-foreground mt-3">
                  بعد تشغيل السكريبت، ستتمكن من رؤية جميع الصور التي تم رفعها على WhatsApp وإعادة استخدامها.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        ) : mediaList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
            <p>لا توجد صور مرفوعة بعد</p>
            <p className="text-sm mt-2">قم برفع صورة أولاً لتظهر هنا</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {mediaList.map((media) => (
                <button
                  key={media.id}
                  onClick={() => handleSelectMedia(media)}
                  className={`relative group rounded-lg border-2 p-3 text-right transition-all hover:border-primary hover:shadow-md ${
                    selectedMediaId === media.media_id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  {selectedMediaId === media.media_id && (
                    <div className="absolute top-2 left-2 z-10">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                  )}

                  <div className="relative flex items-center justify-center h-32 bg-muted rounded-md mb-3 overflow-hidden">
                    {media.preview_url ? (
                      <img
                        src={media.preview_url || "/placeholder.svg"}
                        alt={media.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none"
                          const parent = e.currentTarget.parentElement
                          if (parent) {
                            const icon = document.createElement("div")
                            icon.className = "flex items-center justify-center w-full h-full"
                            icon.innerHTML =
                              '<svg class="h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>'
                            parent.appendChild(icon)
                          }
                        }}
                      />
                    ) : (
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium truncate" title={media.filename}>
                      {media.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(media.file_size)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(media.uploaded_at)}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate" title={media.media_id}>
                      ID: {media.media_id.substring(0, 12)}...
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
