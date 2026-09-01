/** @type {import('next').NextConfig} */
const nextConfig = {
  // ملاحظة: كان هنا `typescript: { ignoreBuildErrors: true }`.
  // هذا الإعداد كان يُخفي 10 أخطاء حقيقية في الأنواع ويسمح بنشر
  // نسخة مكسورة على Vercel بلا أي تحذير. أُزيل عمداً — أي خطأ أنواع
  // يجب أن يوقف البناء قبل أن يصل للعملاء.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
