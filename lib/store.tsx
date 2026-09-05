"use client"

/**
 * lib/store.tsx — النسخة السحابية الكاملة
 * جميع البيانات تُجلب من Supabase وتُرسل إليه عبر Server Actions
 * لا يوجد أي استخدام لـ localStorage
 */

import {
  createContext, useCallback, useContext,
  useState, useEffect, type ReactNode,
} from "react"
import type { AuthUser, Tenant } from "./types"
import { getClient } from "@/lib/supabase/client"
import { buildAuthUser, resolveEmailAction, logoutAction } from "@/app/actions/auth"
import {
  fetchTenantsAction, addTenantAction, updateTenantAction,
  toggleTenantStatusAction, deleteTenantAction,
} from "@/app/actions/tenants"

/* ── Helpers ──────────────────────────────────────────────────── */
export const TODAY = new Date().toISOString().split("T")[0]

/* ================================================================ */
/* AUTH CONTEXT                                                      */
/* ================================================================ */

interface AuthContextValue {
  authUser: AuthUser | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // ── استعادة الجلسة عبر Browser Client (يعمل على Vercel بدون مشاكل cookies) ──
  useEffect(() => {
    const supabase = getClient()

    // جلب الجلسة الحالية من localStorage (Browser Client يديرها تلقائياً)
    supabase.auth.getSession().then(async (res: any) => {
      const session = res?.data?.session
      if (session?.user) {
        const result = await buildAuthUser(session.user.id, session.user.email ?? "")
        if (!("error" in result)) setAuthUser(result.user)
      }
      setLoading(false)
    })

    // الاستماع لتغييرات الجلسة (تسجيل دخول/خروج)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        if (event === "SIGNED_OUT" || !session) {
          setAuthUser(null)
          return
        }
        if (session?.user && event === "SIGNED_IN") {
          const result = await buildAuthUser(session.user.id, session.user.email ?? "")
          if (!("error" in result)) setAuthUser(result.user)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (identifier: string, password: string): Promise<string | null> => {
    try {
      // 1. حل الـ email من username إذا لزم (Server Action)
      const email = await resolveEmailAction(identifier)

      // 2. تسجيل الدخول عبر Browser Client مباشرة (يحفظ الجلسة في localStorage)
      const supabase = getClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error || !data.user) {
        return "البريد الإلكتروني أو كلمة المرور غير صحيحة"
      }

      // 3. جلب بيانات المستخدم (Server Action بـ Service Role)
      const result = await buildAuthUser(data.user.id, data.user.email ?? "")
      if ("error" in result) return result.error

      setAuthUser(result.user)
      return null
    } catch (err: any) {
      return err.message || "حدث خطأ أثناء تسجيل الدخول"
    }
  }, [])

  const logout = useCallback(async () => {
    const supabase = getClient()
    await supabase.auth.signOut()      // يمسح localStorage
    await logoutAction().catch(() => {}) // يمسح cookies (اختياري)
    setAuthUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ authUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be inside AuthProvider")
  return ctx
}

/* ================================================================ */
/* OWNER STORE                                                       */
/* ================================================================ */

interface OwnerStoreValue {
  tenants: Tenant[]
  loading: boolean
  addTenant: (t: Omit<Tenant, "id" | "createdAt"> & { tempPassword?: string }) => Promise<string | null>
  updateTenant: (id: string, patch: Partial<Tenant>) => Promise<void>
  toggleTenantStatus: (id: string) => Promise<void>
  deleteTenant: (id: string) => Promise<void>
  refetch: () => Promise<void>
}

const OwnerStoreContext = createContext<OwnerStoreValue | null>(null)

export function OwnerStoreProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const { authUser } = useAuth()

  const refetch = useCallback(async () => {
    if (authUser?.systemRole !== "owner") return
    try {
      const data = await fetchTenantsAction()
      setTenants(data)
    } catch (e) {
      console.error("fetchTenants error:", e)
    }
  }, [authUser])

  useEffect(() => {
    if (authUser?.systemRole === "owner") {
      setLoading(true)
      refetch().finally(() => setLoading(false))
    }
  }, [authUser, refetch])

  const addTenant = useCallback(async (
    t: Omit<Tenant, "id" | "createdAt"> & { tempPassword?: string }
  ): Promise<string | null> => {
    const result = await addTenantAction({
      name: t.name,
      ownerName: t.ownerName,
      email: t.email,
      phone: t.phone,
      tempPassword: t.tempPassword ?? "Mohaseb@2026",
      plan: t.plan,
      status: t.status,
      industry: t.industry,
      currency: t.currency,
      expiresAt: t.expiresAt,
    })
    if (result.error) return result.error
    setTenants((prev) => [result.tenant, ...prev])
    return null
  }, [])

  const updateTenant = useCallback(async (id: string, patch: Partial<Tenant>) => {
    await updateTenantAction(id, {
      name: patch.name,
      ownerName: patch.ownerName,
      email: patch.email,
      phone: patch.phone,
      plan: patch.plan,
      status: patch.status,
      industry: patch.industry,
      currency: patch.currency,
      expiresAt: patch.expiresAt,
    })
    setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const toggleTenantStatus = useCallback(async (id: string) => {
    const current = tenants.find((t) => t.id === id)
    if (!current) return
    const newStatus = await toggleTenantStatusAction(id, current.status)
    setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)))
  }, [tenants])

  const deleteTenant = useCallback(async (id: string) => {
    await deleteTenantAction(id)
    setTenants((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <OwnerStoreContext.Provider value={{ tenants, loading, addTenant, updateTenant, toggleTenantStatus, deleteTenant, refetch }}>
      {children}
    </OwnerStoreContext.Provider>
  )
}

export function useOwnerStore(): OwnerStoreValue {
  const ctx = useContext(OwnerStoreContext)
  if (!ctx) throw new Error("useOwnerStore must be inside OwnerStoreProvider")
  return ctx
}

/* ================================================================ */
/* ملاحظة: CLIENT STORE حُذف                                          */
/* ================================================================ */
/*
 * كان هنا ClientStoreProvider و useClientStore — حوالي 180 سطراً
 * لم يستدعِها أي ملف في المشروع إطلاقاً (تحقّقنا بالبحث الكامل).
 * وكانت تسحب معها الجيل القديم من البيانات: Customer و Sale و
 * Purchase و StockItem و LedgerEntry، وهي جداول موازية للنظام
 * الحالي (Party / Invoice / JournalEntry) وتُربك أي قارئ للمشروع.
 *
 * ⚠️ الحذف في الكود فقط. الجداول القديمة في قاعدة البيانات لم
 *    تُمَس ولم يُحذف منها صف واحد — تركناها كما هي تماماً.
 *
 * ما بقي في هذا الملف: AuthProvider (تسجيل الدخول والجلسة)
 * و OwnerStoreProvider (شاشة مشرف المنصة) — وكلاهما مستعمَل فعلاً.
 */
