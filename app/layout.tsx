import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'مُحاسِب — نظام المحاسبة ونقاط البيع',
  description: 'منصة مُحاسِب السحابية للمحاسبة وإدارة نقاط البيع — متعدد المستأجرين',
}

export const viewport: Viewport = {
  // صريحة حتى لا يُصغّر الهاتف الصفحة ويجعل الخط غير مقروء
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1117' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className="bg-background" suppressHydrationWarning>
      <head>
        {/* preconnect يوفّر ~100 مللي ثانية على أول تحميل للخط */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/*
          استعادة السمة المحفوظة قبل أول رسم.
          كان الوضع الليلي يُنسى مع كل تحديث للصفحة. هذا السطر يقرأ
          الاختيار المحفوظ (أو تفضيل نظام التشغيل إن لم يوجد اختيار)
          ويطبّقه فوراً — بلا رمشة بيضاء عند التحميل.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('mohaseb-theme');" +
              "if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches))" +
              "{document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
