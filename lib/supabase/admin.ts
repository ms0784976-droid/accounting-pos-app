// عميل Supabase بصلاحيات service_role — يتجاوز RLS بالكامل.
// ⚠️ يُستخدم فقط داخل ملفات Server Actions ("use server") — لا تستورده أبداً
// في أي ملف "use client"، وإلا سيتم تضمين المفتاح السري في الحزمة المُرسلة للمتصفح.
//
// نحتاجه تحديداً لعملية واحدة: supabase.auth.admin.createUser() و deleteUser()
// لأن إنشاء/حذف مستخدم Auth بواسطة طرف آخر (المالك) غير مسموح بمفتاح anon.

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
