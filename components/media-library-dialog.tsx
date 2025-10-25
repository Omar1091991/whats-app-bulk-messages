"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LoaderIcon, Upload, AlertCircle, Trash2, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface UploadedMedia {
  id: string
  media_id: string
  filename: string
  mime_type: string
  file_size: number
  uploaded_at: string
  preview_url?: string
}

interface MediaLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MediaLibraryDialog({ open, onOpenChange }: MediaLibraryDialogProps) {
  const [mediaList, setMediaList] = useState<UploadedMedia[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [tableNotFound, setTableNotFound] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [mediaToDelete, setMediaToDelete] = useState<UploadedMedia | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل الصور",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار ملف صورة فقط",
        variant: "destructive",
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "خطأ",
        description: "حجم الملف يجب أن يكون أقل من 5 ميجابايت",
        variant: "destructive",
      })
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload-media", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "✅ تم الرفع بنجاح",
          description: `تم رفع الصورة: ${file.name}`,
          duration: 3000,
        })
        fetchMedia()
      } else {
        toast({
          title: "❌ فشل الرفع",
          description: data.error || "حدث خطأ أثناء رفع الصورة",
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      toast({
        title: "❌ خطأ",
        description: "حدث خطأ أثناء رفع الصورة",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const confirmDelete = (media: UploadedMedia) => {
    setMediaToDelete(media)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!mediaToDelete) return

    const mediaToDeleteCopy = { ...mediaToDelete }

    setDeleteDialogOpen(false)
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/uploaded-media?id=${mediaToDeleteCopy.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        setMediaList((prev) => prev.filter((item) => item.id !== mediaToDeleteCopy.id))

        toast({
          title: "✅ تم الحذف بنجاح",
          description: `تم حذف الصورة: ${mediaToDeleteCopy.filename}`,
          duration: 10000,
        })
      } else {
        toast({
          title: "❌ فشل الحذف",
          description: data.error || "حدث خطأ أثناء حذف الصورة",
          variant: "destructive",
          duration: 10000,
        })
      }
    } catch (error) {
      toast({
        title: "❌ خطأ",
        description: "حدث خطأ أثناء حذف الصورة",
        variant: "destructive",
        duration: 10000,
      })
    } finally {
      setIsDeleting(false)
      setMediaToDelete(null)
    }
  }

  const cancelDelete = () => {
    setDeleteDialogOpen(false)
    setMediaToDelete(null)
  }

  const copyMediaId = (mediaId: string) => {
    navigator.clipboard.writeText(mediaId)
    setCopiedId(mediaId)
    toast({
      title: "✅ تم النسخ",
      description: "تم نسخ Media ID إلى الحافظة",
      duration: 2000,
    })
    setTimeout(() => setCopiedId(null), 2000)
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

  const getMediaUrl = (media: UploadedMedia) => {
    if (media.preview_url) {
      return media.preview_url
    }
    return `/placeholder.svg?height=200&width=200&query=${encodeURIComponent(media.filename)}`
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl">مكتبة الصور المرفوعة</DialogTitle>
            <DialogDescription>معاينة وإدارة جميع الصور المرفوعة على WhatsApp</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{mediaList.length} صورة مرفوعة</p>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading || tableNotFound}
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading || tableNotFound} size="sm">
                  {uploading ? (
                    <>
                      <LoaderIcon className="ml-2 h-4 w-4 animate-spin" />
                      جاري الرفع...
                    </>
                  ) : (
                    <>
                      <Upload className="ml-2 h-4 w-4" />
                      رفع صورة جديدة
                    </>
                  )}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoaderIcon className="h-8 w-8 animate-spin" />
                <span className="mr-3">جاري التحميل...</span>
              </div>
            ) : tableNotFound ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-right">
                  <p className="font-semibold mb-2">مكتبة الصور غير مفعّلة بعد</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    لتفعيل ميزة مكتبة الصور، يجب تشغيل السكريبت التالي:
                  </p>
                  <code className="block bg-muted p-2 rounded text-sm">scripts/create_uploaded_media_table.sql</code>
                </AlertDescription>
              </Alert>
            ) : mediaList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                <Upload className="h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium">لا توجد صور مرفوعة بعد</p>
                <p className="text-sm mt-2">قم برفع صورة أولاً لتظهر هنا</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mediaList.map((media) => (
                    <div
                      key={media.id}
                      className="relative group rounded-lg border-2 border-border overflow-hidden transition-all hover:border-primary hover:shadow-lg"
                    >
                      <div className="relative aspect-square bg-muted">
                        <img
                          src={getMediaUrl(media) || "/placeholder.svg"}
                          alt={media.filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = `/placeholder.svg?height=200&width=200&query=${encodeURIComponent(media.filename)}`
                          }}
                        />

                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => copyMediaId(media.media_id)}
                            className="h-8"
                            disabled={isDeleting}
                          >
                            {copiedId === media.media_id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => confirmDelete(media)}
                            className="h-8"
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="p-3 space-y-1 bg-card">
                        <p className="text-sm font-medium truncate" title={media.filename}>
                          {media.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(media.file_size)} • {formatDate(media.uploaded_at)}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate" title={media.media_id}>
                          {media.media_id.substring(0, 16)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">⚠️ تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-2">
              <div>هل أنت متأكد من حذف الصورة "{mediaToDelete?.filename}"؟</div>
              <div className="text-destructive font-medium">
                ⚠️ تنبيه: لن تتمكن من استخدام هذه الصورة في الرسائل بعد الحذف.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={cancelDelete}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
