"use client"

// ================================================================
// الشريط العلوي
// ================================================================
// ⚠️ أُزيل مبدّل المستخدمين نهائياً. النسخة السابقة كانت تسمح لأي شخص
// باختيار حساب المدير من قائمة منسدلة بلا كلمة مرور — وهذا تصعيد
// صلاحيات كامل بنقرة واحدة. الهوية الآن تأتي من الجلسة فقط.

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/session"
import { TAB_LABELS, type TabId } from "@/lib/constants"
import { Btn, IconBtn } from "./ui"
import { LogOut, Moon, Sun, Lock, AlertTriangle } from "lucide-react"

export function ClientTopbar({ active, onLogout, onNavigate }: {
  active: TabId
  onLogout: () => void
  onNavigate: (tab: TabId) => void
}) {
  const { user, company } = useSession()
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = document.documentElement.classList.contains("dark")
    setDark(saved)
  }, [])

  const toggleTheme = () => {
    const next = !dark
    document.documentElement.classList.toggle("dark", next)
    setDark(next)
  }

  const expiringSoon = daysUntil(company?.expiresAt) !== null && daysUntil(company?.expiresAt)! <= 14

  return (
    <header className="no-print sticky top-0 z-30 bg-canvas/85 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between gap-4 px-6 h-14">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-foreground truncate">
            {TAB_LABELS[active]}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {company?.lockedUntil && (
            <span
              title={`الفترة مقفلة حتى ${company.lockedUntil} — لا يمكن التسجيل قبل هذا التاريخ`}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-muted
                         px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            >
              <Lock className="size-3" />
              مقفل حتى <span className="num">{company.lockedUntil}</span>
            </span>
          )}

          {expiringSoon && (
            <button
              onClick={() => onNavigate("settings")}
              className="inline-flex items-center gap-1.5 rounded-md bg-warning/15
                         px-2.5 py-1 text-[11px] font-medium text-warning"
            >
              <AlertTriangle className="size-3" />
              الاشتراك ينتهي خلال <span className="num">{daysUntil(company?.expiresAt)}</span> يوم
            </button>
          )}

          <IconBtn icon={dark ? Sun : Moon} label="تبديل السمة" onClick={toggleTheme} />

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="hidden sm:block text-left leading-tight">
            <p className="text-xs font-medium text-foreground">{user.name}</p>
            <p className="text-[10px] text-muted-foreground">{user.username}</p>
          </div>

          <Btn variant="ghost" size="sm" icon={LogOut} onClick={onLogout}>
            <span className="hidden sm:inline">خروج</span>
          </Btn>
        </div>
      </div>
      <div className="brand-rule" />
    </header>
  )
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  if (isNaN(diff)) return null
  const days = Math.ceil(diff / 86_400_000)
  return days < 0 ? 0 : days
}
