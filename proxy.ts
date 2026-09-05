import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// يُشغَّل تلقائياً قبل كل طلب — يحافظ على تحديث Cookies الجلسة
// (Access Token / Refresh Token) حتى لا تنتهي صلاحية الجلسة أثناء استخدام التطبيق.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // هذا الاستدعاء ضروري — يقرأ الجلسة الحالية ويجدّدها إن لزم
  await supabase.auth.getUser()

  return response
}

/**
 * ⚡ المسار ضُيّق.
 *
 * كان يشمل تقريباً كل طلب — بما فيه ملفات CSS و JS والخطوط —
 * فكان كل واحد منها يدفع رحلة شبكة زائدة إلى Supabase لتجديد الجلسة.
 * صفحة واحدة فيها 8 ملفات = 8 رحلات لا لزوم لها.
 *
 * الآن يعمل على طلبات الصفحات فقط. تجديد الجلسة يحصل مرة واحدة
 * عند فتح الصفحة، وهذا كل ما كان يحتاجه فعلاً — و Server Actions
 * لها فحصها المستقل في lib/auth/guard.ts على أي حال.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|otf|eot|json|txt|pdf)$).*)",
  ],
}
