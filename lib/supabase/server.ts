import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )

  const client = supabase as any

  // إضافة دعم raw SQL queries (للتوافق مع Neon API)
  client.query = async (sql: string, params?: any[]) => {
    // Supabase لا يدعم raw SQL مباشرة، لذا سنستخدم RPC
    // لكن هذا يتطلب إنشاء stored procedure في قاعدة البيانات
    // للآن، سنرمي خطأ واضح
    throw new Error(
      "Raw SQL queries are not supported with Supabase. Please use query builder methods (.from(), .select(), etc.)",
    )
  }

  return client
}
