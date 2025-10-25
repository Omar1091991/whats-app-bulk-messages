"use client"

import { usePathname } from "next/navigation"
import { Send, Users, MessageSquare, Settings, MessageCircle } from "lucide-react"

export function NavLinks() {
  const pathname = usePathname()

  const links = [
    { href: "/", label: "إرسال رسالة", icon: Send },
    { href: "/bulk", label: "إرسال جماعي", icon: Users },
    { href: "/free-messages", label: "رسائل حرة", icon: MessageCircle },
    { href: "/inbox", label: "صندوق الوارد", icon: MessageSquare },
    { href: "/settings", label: "الإعدادات", icon: Settings },
  ]

  // ... rest of code here ...

  return <nav>{/* Render navigation links here */}</nav>
}
