"use client"
// Build timestamp: 2025-01-10 - Force cache invalidation

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LoaderIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { ImageIcon, Upload, AlertCircle, Eye, Trash2 } from "lucide-react"

interface UploadedMedia {
  id: string
  media_id: string
  filename: string
  mime_type: string
  file_size: number
  uploaded_at: string
}

export function MediaManager() {
  const [mediaList, setMediaList] = useState<UploadedMedia[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [tableNotFound, setTableNotFound] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<UploadedMedia | null>(null)
  const [mediaToDelete, setMediaToDelete] = useState<UploadedMedia | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchMedia()
  }, [])

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار ملف صورة فقط",
        variant: "destructive",
      })
      return
    }

    // Validate file size (5MB max)
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
          title: "تم الرفع بنجاح",
          description: `تم رفع الصورة: ${file.name}`,
        })
        // Refresh media list
        fetchMedia()
      } else {
        toast({
          title: "فشل الرفع",
          description: data.error || "حدث خطأ أثناء رفع الصورة",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error uploading file:", error)
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء رفع الصورة",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDelete = async (media: UploadedMedia) => {
    try {
      const response = await fetch(`/api/uploaded-media?id=${media.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "تم الحذف",
          description: `تم حذف الصورة: ${media.filename}`,
        })
        // Refresh media list
        fetchMedia()
      } else {
        toast({
          title: "فشل الحذف",
          description: data.error || "حدث خطأ أثناء حذف الصورة",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting media:", error)
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف الصورة",
        variant: "destructive",
      })
    } finally {
      setMediaToDelete(null)
    }
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
    <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[1100ms]">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
              <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              إدارة الصور المرفوعة
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              رفع ومعاينة وحذف الصور المرفوعة على WhatsApp
            </CardDescription>
          </div>
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
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoaderIcon className="h-8 w-8 animate-spin" />
            <span className="mr-3">جاري التحميل...</span>
          </div>
        ) : tableNotFound ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-right">
              <p className="font-semibold mb-2">معرض الصور غير مفعّل بعد</p>
              <p className="text-sm text-muted-foreground mb-3">
                لتفعيل ميزة إدارة الصور المرفوعة، يجب تشغيل السكريبت التالي من قائمة السكريبتات:
              </p>
              <code className="block bg-muted p-2 rounded text-sm">scripts/create_uploaded_media_table.sql</code>
              <p className="text-sm text-muted-foreground mt-3">
                بعد تشغيل السكريبت، ستتمكن من رفع الصور ومعاينتها وحذفها واستخدامها في الرسائل.
              </p>
            </AlertDescription>
          </Alert>
        ) : mediaList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium">لا توجد صور مرفوعة بعد</p>
            <p className="text-sm mt-2">قم برفع صورة أولاً لتظهر هنا</p>
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="mt-4" size="sm">
              <Upload className="ml-2 h-4 w-4" />
              رفع أول صورة
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {mediaList.map((media) => (
                <div
                  key={media.id}
                  className="relative group rounded-lg border-2 border-border p-3 text-right transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={() => {
                        setSelectedMedia(media)
                        setPreviewOpen(true)
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      onClick={() => setMediaToDelete(media)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-center h-32 bg-muted rounded-md mb-3">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
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
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>معاينة الصورة</DialogTitle>
            <DialogDescription>معلومات تفصيلية عن الصورة المرفوعة</DialogDescription>
          </DialogHeader>
          {selectedMedia && (
            <div className="space-y-4">
              <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                <ImageIcon className="h-24 w-24 text-muted-foreground" />
              </div>
              <div className="space-y-2 text-right">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">اسم الملف:</span>
                  <span className="text-sm font-medium">{selectedMedia.filename}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">حجم الملف:</span>
                  <span className="text-sm font-medium">{formatFileSize(selectedMedia.file_size)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">نوع الملف:</span>
                  <span className="text-sm font-medium">{selectedMedia.mime_type}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">تاريخ الرفع:</span>
                  <span className="text-sm font-medium">{formatDate(selectedMedia.uploaded_at)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Media ID:</span>
                  <span className="text-sm font-mono">{selectedMedia.media_id}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!mediaToDelete} onOpenChange={() => setMediaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من حذف الصورة "{mediaToDelete?.filename}"؟
              <br />
              <span className="text-destructive font-medium">
                تنبيه: لن تتمكن من استخدام هذه الصورة في الرسائل بعد الحذف.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => mediaToDelete && handleDelete(mediaToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
