/**
 * lib/supabase/server.ts
 * Supabase client للاستخدام في Server Actions و Server Components فقط
 */
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createServerSupabase() {
  // استخدام await لـ cookies في Next.js 15+
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // قراءة جميع الكوكيز المتاحة
        getAll() {
          return cookieStore.getAll()
        },
        // تعيين جميع الكوكيز المطلوبة للحفاظ على الجلسة
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // في حالة كان هذا استدعاء من Server Component لا يمكن تعديل الكوكيز،
            // هذا الخطأ متوقع ويمكن تجاهله بأمان.
          }
        },
      },
    }
  )
}

/**
 * Service Role client — يتجاوز RLS
 * للاستخدام في Server Actions الحساسة فقط (مثل إنشاء أو حذف المستخدمين من الـ Auth)
 * ⚠️ تحذير: لا تستخدم هذا العميل أبداً في Client Components.
 */
export function createServiceClient() {
  const { createClient } = require("@supabase/supabase-js")
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { 
      auth: { 
        autoRefreshToken: false, 
        persistSession: false 
      } 
    }
  )
}