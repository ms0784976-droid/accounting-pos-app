"use client"

// ================================================================
// صفحة الدخول — مع إعادة تعيين كلمة المرور
// ================================================================
// ثلاث شاشات في مكوّن واحد:
//   login   → تسجيل الدخول
//   forgot  → طلب رابط إعادة التعيين
//   reset   → تعيين كلمة مرور جديدة (بعد فتح الرابط من البريد)
//
// شاشة reset تظهر تلقائياً عندما يعود المستخدم من رابط البريد،
// لأن Supabase يضع رمز الاسترداد في hash الرابط (#type=recovery).

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/store"
import { requestPasswordResetAction, completePasswordResetAction } from "@/app/actions/auth"
import { getClient } from "@/lib/supabase/client"
import {
  Eye, EyeOff, Lock, User, Calculator, Mail, ArrowRight, CheckCircle2,
  Phone, MessageCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { describeError } from "@/lib/errors"

type Screen = "login" | "forgot" | "reset"

export function LoginPage() {
  const [screen, setScreen] = useState<Screen>("login")

  // Supabase يعيد المستخدم برابط فيه #access_token&type=recovery
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes("type=recovery")) setScreen("reset")

    // احتياطاً: لو تعامل عميل Supabase مع الرابط قبل قراءتنا للـ hash
    const supabase = getClient()
    const { data: sub } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY") setScreen("reset")
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-5"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-2xl shadow-blue-600/40 mb-4">
            <Calculator className="size-8 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">مُحاسِب</h1>
          <p className="text-blue-300/80 text-sm mt-1">نظام المحاسبة السحابي ونقاط البيع</p>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
          {screen === "login"  && <LoginForm onForgot={() => setScreen("forgot")} />}
          {screen === "forgot" && <ForgotForm onBack={() => setScreen("login")} />}
          {screen === "reset"  && <ResetForm onDone={() => setScreen("login")} />}
        </div>

        <SupportFooter />
      </div>
    </div>
  )
}

/* ================================================================ */
/* عناصر مشتركة                                                      */
/* ================================================================ */

const FIELD =
  "w-full h-12 rounded-xl bg-white/10 border border-white/10 pr-10 pl-4 text-white " +
  "placeholder:text-white/30 focus:outline-none focus:border-blue-400 " +
  "focus:ring-2 focus:ring-blue-400/30 transition text-sm"

function SubmitBtn({ loading, disabled, children }: {
  loading: boolean
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        "w-full h-12 rounded-xl font-bold text-sm transition-all",
        disabled || loading
          ? "bg-blue-600/40 text-blue-300/50 cursor-not-allowed"
          : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/40 active:scale-[0.98]"
      )}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          جارٍ التنفيذ...
        </span>
      ) : children}
    </button>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-500/20 border border-red-400/30 px-4 py-3 text-sm text-red-300"
         role="alert">
      {message}
    </div>
  )
}

/* ================================================================ */
/* تسجيل الدخول                                                      */
/* ================================================================ */

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!identifier.trim() || !password.trim()) {
      setError("يرجى إدخال اسم المستخدم وكلمة المرور")
      return
    }
    setError("")
    setLoading(true)
    const err = await login(identifier.trim(), password.trim())
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <>
      <h2 className="text-xl font-bold text-white mb-6">تسجيل الدخول</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-blue-200 mb-1.5">
            البريد الإلكتروني / اسم المستخدم
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-blue-400" />
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="أدخل البريد الإلكتروني أو اسم المستخدم"
              className={FIELD}
              autoComplete="username"
              dir="ltr"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-blue-200">كلمة المرور</label>
            <button
              type="button"
              onClick={onForgot}
              className="text-xs text-blue-300 hover:text-blue-100 transition"
            >
              نسيت كلمة المرور؟
            </button>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-blue-400" />
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              className={cn(FIELD, "pl-10")}
              autoComplete="current-password"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-200 transition"
            >
              {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {error && <ErrorBox message={error} />}

        <SubmitBtn loading={loading} disabled={!identifier.trim() || !password.trim()}>
          دخول
        </SubmitBtn>
      </form>
    </>
  )
}

/* ================================================================ */
/* طلب إعادة التعيين                                                 */
/* ================================================================ */

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [identifier, setIdentifier] = useState("")
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!identifier.trim()) {
      setError("أدخل البريد الإلكتروني أو اسم المستخدم")
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = await requestPasswordResetAction(
        identifier.trim(),
        `${window.location.origin}`
      )
      setMessage(res.message)
      setSent(true)
    } catch (err) {
      setError(describeError(err, "تعذّر إرسال الرابط"))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center size-12 rounded-full bg-green-500/20">
          <Mail className="size-6 text-green-400" />
        </div>
        <h2 className="text-lg font-bold text-white">تحقّق من بريدك</h2>
        <p className="text-sm text-blue-200/80 leading-relaxed">{message}</p>
        <p className="text-xs text-blue-300/50 leading-relaxed">
          الرابط صالح لمدة ساعة. إن لم تجد الرسالة، تحقّق من مجلد البريد المزعج (Spam).
        </p>
        <button
          onClick={onBack}
          className="w-full h-11 rounded-xl border border-white/15 text-blue-200
                     hover:bg-white/5 transition text-sm font-medium"
        >
          العودة لتسجيل الدخول
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-100 transition mb-4"
      >
        <ArrowRight className="size-3.5" />
        رجوع
      </button>

      <h2 className="text-xl font-bold text-white mb-2">إعادة تعيين كلمة المرور</h2>
      <p className="text-sm text-blue-200/70 mb-6 leading-relaxed">
        أدخل بريدك الإلكتروني أو اسم المستخدم، وسنرسل لك رابطاً لتعيين كلمة مرور جديدة.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-blue-200 mb-1.5">
            البريد الإلكتروني / اسم المستخدم
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-blue-400" />
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="أدخل بريدك أو اسم المستخدم"
              className={FIELD}
              autoComplete="username"
              dir="ltr"
              autoFocus
            />
          </div>
        </div>

        {error && <ErrorBox message={error} />}

        <SubmitBtn loading={loading} disabled={!identifier.trim()}>
          إرسال الرابط
        </SubmitBtn>
      </form>
    </>
  )
}

/* ================================================================ */
/* تعيين كلمة مرور جديدة                                             */
/* ================================================================ */

function ResetForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const mismatch = confirm.length > 0 && password !== confirm
  const strength = scorePassword(password)
  const BARS = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-green-500", "bg-green-500"]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين")
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = await completePasswordResetAction(password)
      if (!res.ok) {
        setError(res.error ?? "تعذّر تغيير كلمة المرور")
        return
      }
      setDone(true)
      // نظّف الـ hash حتى لا تعود الشاشة عند التحديث
      window.history.replaceState(null, "", window.location.pathname)
      setTimeout(onDone, 2500)
    } catch (err) {
      setError(describeError(err, "تعذّر تغيير كلمة المرور"))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center size-12 rounded-full bg-green-500/20">
          <CheckCircle2 className="size-6 text-green-400" />
        </div>
        <h2 className="text-lg font-bold text-white">تم تغيير كلمة المرور</h2>
        <p className="text-sm text-blue-200/80">
          يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
        </p>
      </div>
    )
  }

  return (
    <>
      <h2 className="text-xl font-bold text-white mb-2">كلمة مرور جديدة</h2>
      <p className="text-sm text-blue-200/70 mb-6 leading-relaxed">
        اختر كلمة مرور قوية لا تستخدمها في مكان آخر.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-blue-200 mb-1.5">
            كلمة المرور الجديدة
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-blue-400" />
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 أحرف على الأقل، وتحتوي حرفاً ورقماً"
              className={cn(FIELD, "pl-10")}
              autoComplete="new-password"
              dir="ltr"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-200 transition"
            >
              {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      i < strength.score ? BARS[strength.score] : "bg-white/15"
                    )}
                  />
                ))}
              </div>
              <p className="text-[11px] text-blue-300/70">
                قوة كلمة المرور: <span className="text-blue-100">{strength.label}</span>
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-200 mb-1.5">
            تأكيد كلمة المرور
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-blue-400" />
            <input
              type={showPass ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="أعد كتابة كلمة المرور"
              className={cn(FIELD, mismatch && "border-red-400/50")}
              autoComplete="new-password"
              dir="ltr"
            />
          </div>
          {mismatch && (
            <p className="text-[11px] text-red-300 mt-1">كلمتا المرور غير متطابقتين</p>
          )}
        </div>

        {error && <ErrorBox message={error} />}

        <SubmitBtn
          loading={loading}
          disabled={!password || !confirm || mismatch || password.length < 8}
        >
          تعيين كلمة المرور
        </SubmitBtn>
      </form>
    </>
  )
}

/* ================================================================ */
/* الدعم الفني                                                       */
/* ================================================================ */
// موضوع أسفل البطاقة لا فوقها: لا يزاحم حقول الدخول، ويبقى ظاهراً
// لمن يحتاجه. الرقم رابط فعلي — نقرة واحدة تتصل أو تفتح واتساب،
// وهذا أهم من مجرد عرضه كنص على الهاتف.

const SUPPORT_NAME = "محمد سعد"
const SUPPORT_PHONE = "0569198115"
const SUPPORT_INTL = "970569198115"   // للواتساب — بلا صفر وبمقدمة الدولة

function SupportFooter() {
  return (
    <div className="mt-6 text-center space-y-3">
      <div className="flex items-center justify-center gap-2">
        <a
          href={`tel:+${SUPPORT_INTL}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10
                     bg-white/5 px-3 py-1.5 text-xs text-blue-200
                     hover:bg-white/10 hover:text-white transition"
        >
          <Phone className="size-3.5" />
          <span dir="ltr" className="tabular-nums">{SUPPORT_PHONE}</span>
        </a>

        <a
          href={`https://wa.me/${SUPPORT_INTL}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20
                     bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300
                     hover:bg-emerald-500/20 hover:text-emerald-200 transition"
        >
          <MessageCircle className="size-3.5" />
          واتساب
        </a>
      </div>

      <p className="text-blue-400/50 text-[11px]">
        للدعم الفني: {SUPPORT_NAME}
      </p>

      <p className="text-blue-400/30 text-[11px]">
        مُحاسِب © 2026 — جميع الحقوق محفوظة
      </p>
    </div>
  )
}

function scorePassword(pw: string): { score: number; label: string } {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  const capped = Math.min(s, 4)
  return { score: capped, label: ["ضعيفة جداً", "ضعيفة", "متوسطة", "جيدة", "قوية"][capped] }
}
