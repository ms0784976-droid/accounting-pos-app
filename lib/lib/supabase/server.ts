import "server-only"

/**
 * lib/supabase/server.ts
 * Supabase clients للاستخدام في Server Actions و Server Components فقط
 */
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    // رسالة صريحة أفضل بكثير من انهيار غامض داخل مكتبة Supabase
    throw new Error(
      `متغير البيئة ${name} غير معرَّف. أضِفه في Vercel → Project → Settings → Environment Variables ثم أعد النشر.`
    )
  }
  return value
}

export async function createServerSupabase() {
  // cookies() صارت async في Next.js 15+
  const cookieStore = await cookies()

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // استدعاء من Server Component لا يستطيع تعديل الكوكيز —
            // خطأ متوقّع ويمكن تجاهله بأمان.
          }
        },
      },
    }
  )
}

/**
 * Service Role client — يتجاوز RLS.
 * للاستخدام في Server Actions الحساسة فقط (إنشاء/حذف مستخدمي Auth).
 * ⚠️ لا تستورده أبداً في ملف "use client".
 */
export function createServiceClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
