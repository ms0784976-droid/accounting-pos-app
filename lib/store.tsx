"use client"

/**
 * lib/store.tsx — النسخة السحابية الكاملة
 * جميع البيانات تُجلب من Supabase وتُرسل إليه عبر Server Actions
 * لا يوجد أي استخدام لـ localStorage
 */

import {
  createContext, useCallback, useContext, useMemo,
  useState, useEffect, useTransition, type ReactNode,
} from "react"
import type {
  AuthUser, Customer, LedgerEntry, PaymentStatus,
  Product, Purchase, Sale, StockItem, Tenant,
  TenantUser, TenantStatus, UnitCode,
} from "./types"
import { CURRENCIES } from "./constants"
import { getClient } from "@/lib/supabase/client"
import { buildAuthUser, resolveEmailAction, logoutAction } from "@/app/actions/auth"
import {
  fetchTenantsAction, addTenantAction, updateTenantAction,
  toggleTenantStatusAction, deleteTenantAction,
} from "@/app/actions/tenants"
import {
  fetchProductsAction, addProductAction, updateProductAction, deleteProductAction,
  fetchPurchasesAction, addPurchaseAction,
  fetchSalesAction, addSaleAction,
  fetchCustomersAction, addCustomerAction, recordPaymentAction,
  fetchTenantUsersAction, addTenantUserAction, updateTenantUserAction,
  toggleTenantUserStatusAction, deleteTenantUserAction,
  fetchTenantCurrencyAction, updateTenantCurrencyAction,
} from "@/app/actions/client-data"

/* ── Helpers ──────────────────────────────────────────────────── */
export const TODAY = new Date().toISOString().split("T")[0]

export function remainingBalance(c: Customer): number {
  return Math.max(0, c.totalCharged - c.amountPaid)
}

export function paymentStatus(c: Customer, today: string): PaymentStatus {
  const remaining = remainingBalance(c)
  if (remaining <= 0) return "paid"
  if (c.dueDate < today) return "overdue"
  return "partial"
}

function buildLedger(purchases: Purchase[], sales: Sale[], tenantId: string): LedgerEntry[] {
  const fromP: LedgerEntry[] = purchases
    .filter((p) => p.tenantId === tenantId)
    .map((p) => ({
      id: `l_${p.id}`, tenantId, type: "purchase" as const,
      itemName: p.itemName, sku: p.sku, unit: p.unit,
      quantity: p.quantity, amount: p.quantity * p.unitCost,
      party: p.supplier, userId: p.userId, date: p.date,
    }))
  const fromS: LedgerEntry[] = sales
    .filter((s) => s.tenantId === tenantId)
    .map((s) => ({
      id: `l_${s.id}`, tenantId, type: "sale" as const,
      itemName: s.itemName, sku: s.sku, unit: s.unit,
      quantity: s.quantity, amount: s.quantity * s.unitPrice,
      party: s.buyer, userId: s.userId, method: s.method, date: s.date,
    }))
  return [...fromP, ...fromS].sort((a, b) => (a.date < b.date ? 1 : -1))
}

function buildStock(purchases: Purchase[], sales: Sale[], tenantId: string): StockItem[] {
  const map = new Map<string, StockItem>()
  for (const p of purchases.filter((x) => x.tenantId === tenantId)) {
    const ex = map.get(p.sku) ?? { sku: p.sku, itemName: p.itemName, unit: p.unit, incoming: 0, outgoing: 0, balance: 0, lastCost: 0, lastPrice: 0 }
    ex.incoming += p.quantity; ex.lastCost = p.unitCost
    ex.itemName = p.itemName; ex.unit = p.unit
    map.set(p.sku, ex)
  }
  for (const s of sales.filter((x) => x.tenantId === tenantId)) {
    const ex = map.get(s.sku) ?? { sku: s.sku, itemName: s.itemName, unit: s.unit, incoming: 0, outgoing: 0, balance: 0, lastCost: 0, lastPrice: 0 }
    ex.outgoing += s.quantity; ex.lastPrice = s.unitPrice
    ex.itemName = s.itemName; ex.unit = s.unit
    map.set(s.sku, ex)
  }
  const items = Array.from(map.values())
  for (const item of items) item.balance = item.incoming - item.outgoing
  return items
}

const numberFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })

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
/* CLIENT STORE                                                      */
/* ================================================================ */

interface ClientStoreValue {
  today: string
  tenantId: string
  tenantUsers: TenantUser[]
  products: Product[]
  customers: Customer[]
  purchases: Purchase[]
  sales: Sale[]
  ledger: LedgerEntry[]
  stock: StockItem[]
  loading: boolean
  currentTenantUser: TenantUser | null
  setCurrentTenantUserId: (id: string) => void
  currency: (typeof CURRENCIES)[number]
  setCurrencyCode: (code: string) => Promise<void>
  fmt: (amount: number) => string
  userName: (id: string) => string
  // Products
  addProduct: (p: Omit<Product, "id" | "createdAt">) => Promise<void>
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  // Users
  addTenantUser: (u: Omit<TenantUser, "id" | "createdAt" | "lastActive" | "status"> & { tempPassword?: string }) => Promise<void>
  updateTenantUser: (id: string, patch: Partial<TenantUser>) => Promise<void>
  toggleTenantUserStatus: (id: string) => Promise<void>
  deleteTenantUser: (id: string) => Promise<void>
  // Financials
  addPurchase: (p: Omit<Purchase, "id" | "tenantId">) => Promise<void>
  addSale: (s: Omit<Sale, "id" | "tenantId">) => Promise<void>
  recordPayment: (customerId: string, amount: number) => Promise<void>
  addCustomer: (c: Omit<Customer, "id" | "updatedAt" | "tenantId">) => Promise<void>
  refetchAll: () => Promise<void>
}

const ClientStoreContext = createContext<ClientStoreValue | null>(null)

export function ClientStoreProvider({
  tenantId, children,
}: { tenantId: string; children: ReactNode }) {
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [products, setProducts]       = useState<Product[]>([])
  const [customers, setCustomers]     = useState<Customer[]>([])
  const [purchases, setPurchases]     = useState<Purchase[]>([])
  const [sales, setSales]             = useState<Sale[]>([])
  const [currencyCode, setCurrencyCodeState] = useState<string>("ILS")
  const [currentTenantUserId, setCurrentTenantUserId] = useState<string>("")
  const [loading, setLoading] = useState(true)

  // جلب كل البيانات من Supabase
  const refetchAll = useCallback(async () => {
    try {
      const [users, prods, custs, purcs, sls, cur] = await Promise.all([
        fetchTenantUsersAction(tenantId),
        fetchProductsAction(tenantId),
        fetchCustomersAction(tenantId),
        fetchPurchasesAction(tenantId),
        fetchSalesAction(tenantId),
        fetchTenantCurrencyAction(tenantId),
      ])
      setTenantUsers(users)
      setProducts(prods)
      setCustomers(custs)
      setPurchases(purcs)
      setSales(sls)
      setCurrencyCodeState(cur)
    } catch (e) {
      console.error("refetchAll error:", e)
    }
  }, [tenantId])

  useEffect(() => {
    setLoading(true)
    refetchAll().finally(() => setLoading(false))
  }, [refetchAll])

  const currency = useMemo(
    () => CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0],
    [currencyCode]
  )
  const fmt = useCallback(
    (amount: number) => `${numberFmt.format(amount)} ${currency.symbol}`,
    [currency]
  )
  const currentTenantUser = useMemo(
    () => tenantUsers.find((u) => u.id === currentTenantUserId) ?? tenantUsers[0] ?? null,
    [tenantUsers, currentTenantUserId]
  )
  const ledger = useMemo(() => buildLedger(purchases, sales, tenantId), [purchases, sales, tenantId])
  const stock  = useMemo(() => buildStock(purchases, sales, tenantId),  [purchases, sales, tenantId])
  const userName = useCallback(
    (id: string) => tenantUsers.find((u) => u.id === id)?.name ?? "غير معروف",
    [tenantUsers]
  )

  const setCurrencyCode = useCallback(async (code: string) => {
    setCurrencyCodeState(code)
    await updateTenantCurrencyAction(tenantId, code)
  }, [tenantId])

  // ── Products ──
  const addProduct = useCallback(async (p: Omit<Product, "id" | "createdAt">) => {
    const created = await addProductAction(p)
    setProducts((prev) => [created, ...prev])
  }, [])

  const updateProduct = useCallback(async (id: string, patch: Partial<Product>) => {
    await updateProductAction(id, patch)
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const deleteProduct = useCallback(async (id: string) => {
    await deleteProductAction(id)
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // ── TenantUsers ──
  const addTenantUser = useCallback(async (
    u: Omit<TenantUser, "id" | "createdAt" | "lastActive" | "status"> & { tempPassword?: string }
  ) => {
    const created = await addTenantUserAction(u)
    setTenantUsers((prev) => [created, ...prev])
  }, [])

  const updateTenantUser = useCallback(async (id: string, patch: Partial<TenantUser>) => {
    await updateTenantUserAction(id, patch)
    setTenantUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }, [])

  const toggleTenantUserStatus = useCallback(async (id: string) => {
    const user = tenantUsers.find((u) => u.id === id)
    if (!user) return
    const newStatus = await toggleTenantUserStatusAction(id, user.status)
    setTenantUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: newStatus } : u)))
  }, [tenantUsers])

  const deleteTenantUser = useCallback(async (id: string) => {
    await deleteTenantUserAction(id)
    setTenantUsers((prev) => prev.filter((u) => u.id !== id))
  }, [])

  // ── Purchases ──
  const addPurchase = useCallback(async (p: Omit<Purchase, "id" | "tenantId">) => {
    const created = await addPurchaseAction({ ...p, tenantId })
    setPurchases((prev) => [created, ...prev])
    // تحديث آخر سعر في قائمة المنتجات محلياً
    setProducts((prev) => prev.map((prod) =>
      prod.sku === p.sku ? { ...prod, lastCost: p.unitCost } : prod
    ))
  }, [tenantId])

  // ── Sales ──
  const addSale = useCallback(async (s: Omit<Sale, "id" | "tenantId">) => {
    const created = await addSaleAction({ ...s, tenantId })
    setSales((prev) => [created, ...prev])
    setProducts((prev) => prev.map((prod) =>
      prod.sku === s.sku ? { ...prod, lastPrice: s.unitPrice } : prod
    ))
    // تحديث الذمم محلياً إذا كان بيعاً آجلاً
    if (s.method === "debt") {
      const total = s.quantity * s.unitPrice
      const detail = `${s.quantity} ${s.unit} ${s.itemName}`
      setCustomers((prev) => {
        const match = prev.find((c) => c.name.toLowerCase() === s.buyer.toLowerCase())
        if (match) {
          return prev.map((c) => c.id === match.id ? {
            ...c,
            itemsDetail: c.itemsDetail ? `${c.itemsDetail}، ${detail}` : detail,
            totalCharged: c.totalCharged + total,
            updatedAt: TODAY,
          } : c)
        }
        // سيتم جلب العميل الجديد عند refetch؛ حالياً نضيف مبدئياً
        return [{
          id: `temp_${Date.now()}`, tenantId, name: s.buyer, phone: "—",
          accountId: `ACC-${Math.floor(1000 + Math.random() * 9000)}`,
          itemsDetail: detail, totalCharged: total, amountPaid: 0,
          dueDate: TODAY, updatedAt: TODAY,
        }, ...prev]
      })
    }
  }, [tenantId])

  // ── Customers ──
  const recordPayment = useCallback(async (customerId: string, amount: number) => {
    await recordPaymentAction(customerId, amount)
    setCustomers((prev) => prev.map((c) =>
      c.id === customerId
        ? { ...c, amountPaid: Math.min(c.totalCharged, c.amountPaid + amount), updatedAt: TODAY }
        : c
    ))
  }, [])

  const addCustomer = useCallback(async (c: Omit<Customer, "id" | "updatedAt" | "tenantId">) => {
    const created = await addCustomerAction({ ...c, tenantId })
    setCustomers((prev) => [created, ...prev])
  }, [tenantId])

  const value: ClientStoreValue = {
    today: TODAY, tenantId, tenantUsers, products, customers, purchases, sales,
    ledger, stock, loading, currentTenantUser, setCurrentTenantUserId,
    currency, setCurrencyCode, fmt, userName,
    addProduct, updateProduct, deleteProduct,
    addTenantUser, updateTenantUser, toggleTenantUserStatus, deleteTenantUser,
    addPurchase, addSale, recordPayment, addCustomer, refetchAll,
  }

  return <ClientStoreContext.Provider value={value}>{children}</ClientStoreContext.Provider>
}

export function useClientStore(): ClientStoreValue {
  const ctx = useContext(ClientStoreContext)
  if (!ctx) throw new Error("useClientStore must be inside ClientStoreProvider")
  return ctx
}
