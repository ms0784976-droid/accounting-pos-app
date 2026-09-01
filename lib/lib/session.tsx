"use client"

// ================================================================
// lib/session.tsx — سياق الجلسة وبيانات الشركة
// ================================================================
// يستبدل الأجزاء غير الآمنة من store.tsx القديم.
//
// ⚠️ التغيير الجوهري: الدور يأتي من الجلسة على السيرفر فقط.
// النسخة السابقة كانت تسمح بتبديل المستخدم من الشريط العلوي بنقرة
// واحدة بلا كلمة مرور، ما جعل كل الصلاحيات ديكوراً.

import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from "react"
import type { AuthUser, TenantProfile, ClientRole } from "./types"
import { describeError } from "./errors"
import { ROLE_TABS, type TabId } from "./constants"
import { fetchTenantProfileAction } from "@/app/actions/reports"

/* ================================================================ */

interface SessionValue {
  user: AuthUser
  company: TenantProfile | null
  currency: string
  loading: boolean
  /** يعيد تحميل بيانات الشركة بعد تعديل الإعدادات */
  refreshCompany: () => Promise<void>
  /** هل التبويب متاح لدور المستخدم الحالي */
  canSee: (tab: TabId) => boolean
  /** صلاحيات وظيفية — مرآة لما يُفرض على السيرفر */
  can: (permission: Permission) => boolean
}

export type Permission =
  | "viewFinancials" | "manageUsers" | "manageSettings" | "editCosts"
  | "createSale" | "createPurchase" | "managePayments" | "manageExpenses"
  | "manageJournal" | "cancelDocument" | "manageProducts" | "viewReports"
  | "manageBackup"

const PERMISSIONS: Record<Permission, ClientRole[]> = {
  viewFinancials: ["admin", "accountant"],
  manageUsers:    ["admin"],
  manageSettings: ["admin"],
  editCosts:      ["admin", "accountant", "inventory"],
  createSale:     ["admin", "accountant", "cashier"],
  createPurchase: ["admin", "accountant", "inventory"],
  managePayments: ["admin", "accountant"],
  manageExpenses: ["admin", "accountant"],
  manageJournal:  ["admin", "accountant"],
  cancelDocument: ["admin", "accountant"],
  manageProducts: ["admin", "accountant", "inventory"],
  viewReports:    ["admin", "accountant"],
  manageBackup:   ["admin"],
}

const SessionCtx = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const ctx = useContext(SessionCtx)
  if (!ctx) throw new Error("useSession يجب أن يُستخدم داخل SessionProvider")
  return ctx
}

export function SessionProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const [company, setCompany] = useState<TenantProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshCompany = useCallback(async () => {
    try {
      setCompany(await fetchTenantProfileAction())
    } catch {
      setCompany(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refreshCompany() }, [refreshCompany])

  const role = user.role
  const canSee = useCallback(
    (tab: TabId) => (role ? ROLE_TABS[role].includes(tab) : false),
    [role]
  )
  const can = useCallback(
    (p: Permission) => (role ? PERMISSIONS[p].includes(role) : false),
    [role]
  )

  return (
    <SessionCtx.Provider
      value={{
        user,
        company,
        currency: company?.currency ?? "ILS",
        loading,
        refreshCompany,
        canSee,
        can,
      }}
    >
      {children}
    </SessionCtx.Provider>
  )
}

/* ================================================================ */
/* أدوات التواريخ — بتوقيت الشركة، لا بتوقيت UTC                     */
/* ================================================================ */

export function todayIn(timeZone = "Asia/Hebron"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date())
}

/** يحوّل الفترات الجاهزة إلى تاريخين */
export function resolvePreset(preset: string, tz = "Asia/Hebron"): { from: string; to: string } {
  const today = todayIn(tz)
  const d = new Date(today + "T12:00:00")
  const iso = (x: Date) => x.toISOString().split("T")[0]

  switch (preset) {
    case "today":
      return { from: today, to: today }
    case "yesterday": {
      const y = new Date(d); y.setDate(y.getDate() - 1)
      return { from: iso(y), to: iso(y) }
    }
    case "this-week": {
      const start = new Date(d)
      start.setDate(start.getDate() - ((start.getDay() + 1) % 7))  // الأسبوع يبدأ السبت
      return { from: iso(start), to: today }
    }
    case "this-month":
      return { from: today.slice(0, 8) + "01", to: today }
    case "last-month": {
      const start = new Date(d.getFullYear(), d.getMonth() - 1, 1)
      const end = new Date(d.getFullYear(), d.getMonth(), 0)
      return { from: iso(start), to: iso(end) }
    }
    case "quarter": {
      const q = Math.floor(d.getMonth() / 3)
      return { from: iso(new Date(d.getFullYear(), q * 3, 1)), to: today }
    }
    case "this-year":
      return { from: `${d.getFullYear()}-01-01`, to: today }
    default:
      return { from: today.slice(0, 8) + "01", to: today }
  }
}

/* ================================================================ */
/* خطاف مساعد لجلب البيانات مع حالات التحميل والخطأ                  */
/* ================================================================ */

export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = []
): { data: T | null; loading: boolean; error: string; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")

    loader()
      .then((result) => { if (!cancelled) setData(result) })
      .catch((e) => {
        console.error("useAsyncData:", e)
        if (!cancelled) setError(describeError(e, "تعذّر تحميل البيانات"))
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, loading, error, reload: () => setTick((t) => t + 1) }
}
