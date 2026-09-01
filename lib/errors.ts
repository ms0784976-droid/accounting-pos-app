/**
 * lib/errors.ts — ترجمة أخطاء Server Actions إلى رسائل مفهومة
 * ================================================================
 * في وضع الإنتاج، Next.js يُخفي نص أي خطأ يقع على السيرفر ويستبدله
 * برسالة مبهمة مثل:
 *
 *   "Minified React error #441 …"
 *   "An error occurred in the Server Components render…"
 *
 * هذا مقصود (حتى لا تتسرّب تفاصيل داخلية للمتصفح)، لكنه يترك
 * المستخدم أمام شاشة لا تقول شيئاً. هنا نستبدلها برسالة عربية
 * واضحة، ونُظهر رمز التتبّع (digest) الذي يربطها بالسطر المقابل
 * في سجلات Vercel:
 *
 *   Vercel → Project → Logs → ابحث عن الـ digest
 */

/** أخطاء Next.js المبهمة التي لا تفيد المستخدم بشيء */
const OPAQUE_PATTERNS = [
  /minified react error/i,
  /an error occurred in the server components render/i,
  /an error occurred in the server action/i,
  /^failed to fetch$/i,
  /unexpected response from the server/i,
]

function isOpaque(message: string): boolean {
  return !message.trim() || OPAQUE_PATTERNS.some((re) => re.test(message))
}

/**
 * يحوّل أي خطأ إلى نص صالح للعرض.
 * @param error   الخطأ الملتقط
 * @param fallback رسالة عربية تصف العملية التي فشلت
 */
export function describeError(error: unknown, fallback = "تعذّر تنفيذ العملية"): string {
  if (!(error instanceof Error)) {
    return typeof error === "string" && error.trim() ? error : fallback
  }

  const digest = (error as Error & { digest?: string }).digest

  if (isOpaque(error.message)) {
    const base =
      `${fallback} — وقع خطأ على الخادم ولم تُعرض تفاصيله لأسباب أمنية.`
    return digest
      ? `${base} رمز التتبّع: ${digest} (ابحث عنه في سجلات Vercel لمعرفة السبب الدقيق).`
      : `${base} راجع سجلات Vercel لمعرفة السبب الدقيق.`
  }

  return error.message
}
