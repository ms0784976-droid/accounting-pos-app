"use client"

import { useState } from "react"
import { useAuth } from "@/lib/store"
import { Eye, EyeOff, Lock, User, Calculator } from "lucide-react"
import { cn } from "@/lib/utils"

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))
    const ok = login(username.trim(), password)
    if (!ok) setError("اسم المستخدم أو كلمة المرور غير صحيحة")
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="pointer-events-none fixed inset-0 opacity-5"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }}
      />

      <div className="w-full max-w-md relative">
        {/* Logo + Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-2xl shadow-blue-600/40 mb-4">
            <Calculator className="size-8 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">مُحاسِب</h1>
          <p className="text-blue-300/80 text-sm mt-1">نظام المحاسبة السحابي ونقاط البيع</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">تسجيل الدخول</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">
                البريد الإلكتروني / اسم المستخدم
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-blue-400" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  className="w-full h-12 rounded-xl bg-white/10 border border-white/10 pr-10 pl-4 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition text-sm"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-blue-400" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className="w-full h-12 rounded-xl bg-white/10 border border-white/10 pr-10 pl-10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition text-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-200 transition"
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/20 border border-red-400/30 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username}
              className={cn(
                "w-full h-12 rounded-xl font-bold text-sm transition-all",
                loading || !username
                  ? "bg-blue-600/40 text-blue-300/50 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/40 active:scale-[0.98]"
              )}
            >
              {loading ? "جارٍ تسجيل الدخول..." : "دخول"}
            </button>
          </form>
        </div>

        <p className="text-center text-blue-400/40 text-xs mt-6">
          مُحاسِب © 2026 — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  )
}