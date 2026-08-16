"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type {
  AuthUser,
  Customer,
  LedgerEntry,
  PaymentStatus,
  Product,
  Purchase,
  Sale,
  StockItem,
  Tenant,
  TenantUser,
  TenantStatus,
  UnitCode,
} from "./types"
import { CURRENCIES } from "./constants"

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const TODAY = new Date().toISOString().split("T")[0]

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).slice(2)}`

export function remainingBalance(c: Customer): number {
  return Math.max(0, c.totalCharged - c.amountPaid)
}

export function paymentStatus(c: Customer, today: string): PaymentStatus {
  const remaining = remainingBalance(c)
  if (remaining <= 0) return "paid"
  if (c.dueDate < today) return "overdue"
  return "partial"
}

/* ------------------------------------------------------------------ */
/* Accounts & Data (Empty Production Initialization)                  */
/* ------------------------------------------------------------------ */

// حساب الآدمن الأساسي الوحيد للوحة تحكم المشرف (Owner)
const SYSTEM_OWNER_USER: AuthUser = {
  id: "auth_owner",
  tenantId: null,
  systemRole: "owner",
  name: "مشرف المنصة",
  email: "owner@mohaseb.app",
  username: "owner",
}

/* ------------------------------------------------------------------ */
/* Derived: Ledger + Stock                                            */
/* ------------------------------------------------------------------ */

function buildLedger(purchases: Purchase[], sales: Sale[], tenantId: string): LedgerEntry[] {
  const fromP: LedgerEntry[] = purchases
    .filter((p) => p.tenantId === tenantId)
    .map((p) => ({ id: `l_${p.id}`, tenantId, type: "purchase" as const, itemName: p.itemName, sku: p.sku, unit: p.unit, quantity: p.quantity, amount: p.quantity * p.unitCost, party: p.supplier, userId: p.userId, date: p.date }))
  const fromS: LedgerEntry[] = sales
    .filter((s) => s.tenantId === tenantId)
    .map((s) => ({ id: `l_${s.id}`, tenantId, type: "sale" as const, itemName: s.itemName, sku: s.sku, unit: s.unit, quantity: s.quantity, amount: s.quantity * s.unitPrice, party: s.buyer, userId: s.userId, method: s.method, date: s.date }))
  return [...fromP, ...fromS].sort((a, b) => (a.date < b.date ? 1 : -1))
}

function buildStock(purchases: Purchase[], sales: Sale[], tenantId: string): StockItem[] {
  const map = new Map<string, StockItem>()
  for (const p of purchases.filter((x) => x.tenantId === tenantId)) {
    const ex = map.get(p.sku) ?? { sku: p.sku, itemName: p.itemName, unit: p.unit, incoming: 0, outgoing: 0, balance: 0, lastCost: 0, lastPrice: 0 }
    ex.incoming += p.quantity
    ex.lastCost = p.unitCost
    ex.itemName = p.itemName
    ex.unit = p.unit
    map.set(p.sku, ex)
  }
  for (const s of sales.filter((x) => x.tenantId === tenantId)) {
    const ex = map.get(s.sku) ?? { sku: s.sku, itemName: s.itemName, unit: s.unit, incoming: 0, outgoing: 0, balance: 0, lastCost: 0, lastPrice: 0 }
    ex.outgoing += s.quantity
    ex.lastPrice = s.unitPrice
    ex.itemName = s.itemName
    ex.unit = s.unit
    map.set(s.sku, ex)
  }
  const items = Array.from(map.values())
  for (const item of items) item.balance = item.incoming - item.outgoing
  return items
}

/* ------------------------------------------------------------------ */
/* Owner Store Context                                                */
/* ------------------------------------------------------------------ */

interface OwnerStoreValue {
  tenants: Tenant[]
  addTenant: (t: Omit<Tenant, "id" | "createdAt">) => void
  updateTenant: (id: string, patch: Partial<Tenant>) => void
  toggleTenantStatus: (id: string) => void
  deleteTenant: (id: string) => void
}

const OwnerStoreContext = createContext<OwnerStoreValue | null>(null)

export function useOwnerStore(): OwnerStoreValue {
  const ctx = useContext(OwnerStoreContext)
  if (!ctx) throw new Error("useOwnerStore must be inside OwnerStoreProvider")
  return ctx
}

/* ------------------------------------------------------------------ */
/* Auth Context                                                       */
/* ------------------------------------------------------------------ */

interface AuthContextValue {
  authUser: AuthUser | null
  login: (username: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const ownerStore = useContext(OwnerStoreContext)

  const login = useCallback((username: string, _password: string): boolean => {
    const cleanUser = username.trim().toLowerCase()

    // 1. حساب المشرف الرئيسي للنظام
    if (cleanUser === SYSTEM_OWNER_USER.username || cleanUser === SYSTEM_OWNER_USER.email) {
      setAuthUser(SYSTEM_OWNER_USER)
      return true
    }

    // 2. الفحص من العملاء المُضافين في المنصة
    if (ownerStore) {
      const tenant = ownerStore.tenants.find(
        (t) =>
          t.email.toLowerCase() === cleanUser ||
          t.ownerName.toLowerCase() === cleanUser ||
          t.name.toLowerCase() === cleanUser
      )

      if (tenant) {
        if (tenant.status === "frozen") return false

        setAuthUser({
          id: `auth_${tenant.id}`,
          tenantId: tenant.id,
          systemRole: "client",
          name: tenant.ownerName,
          email: tenant.email,
          username: tenant.email,
        })
        return true
      }
    }

    return false
  }, [ownerStore])

  const logout = useCallback(() => setAuthUser(null), [])
  return <AuthContext.Provider value={{ authUser, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be inside AuthProvider")
  return ctx
}

/* ------------------------------------------------------------------ */
/* Owner Store Provider Component                                     */
/* ------------------------------------------------------------------ */

export function OwnerStoreProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([])

  const addTenant: OwnerStoreValue["addTenant"] = useCallback((t) => {
    setTenants((prev) => [{ ...t, id: genId(), createdAt: TODAY }, ...prev])
  }, [])
  const updateTenant: OwnerStoreValue["updateTenant"] = useCallback((id, patch) => {
    setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])
  const toggleTenantStatus: OwnerStoreValue["toggleTenantStatus"] = useCallback((id) => {
    setTenants((prev) => prev.map((t) => t.id === id ? { ...t, status: (t.status === "active" ? "frozen" : "active") as Tenant["status"] } : t))
  }, [])
  const deleteTenant: OwnerStoreValue["deleteTenant"] = useCallback((id) => {
    setTenants((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <OwnerStoreContext.Provider value={{ tenants, addTenant, updateTenant, toggleTenantStatus, deleteTenant }}>
      {children}
    </OwnerStoreContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/* Client (Tenant) Store Context                                       */
/* ------------------------------------------------------------------ */

const numberFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })

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
  currentTenantUser: TenantUser | null
  setCurrentTenantUserId: (id: string) => void
  currency: (typeof CURRENCIES)[number]
  setCurrencyCode: (code: string) => void
  fmt: (amount: number) => string
  userName: (id: string) => string
  // Product actions
  addProduct: (p: Omit<Product, "id" | "createdAt">) => void
  updateProduct: (id: string, patch: Partial<Product>) => void
  deleteProduct: (id: string) => void
  // Financial actions
  addTenantUser: (u: Omit<TenantUser, "id" | "createdAt" | "lastActive" | "status">) => void
  updateTenantUser: (id: string, patch: Partial<TenantUser>) => void
  toggleTenantUserStatus: (id: string) => void
  deleteTenantUser: (id: string) => void
  addPurchase: (p: Omit<Purchase, "id" | "tenantId">) => void
  addSale: (s: Omit<Sale, "id" | "tenantId">) => void
  recordPayment: (customerId: string, amount: number) => void
  addCustomer: (c: Omit<Customer, "id" | "updatedAt" | "tenantId">) => void
}

const ClientStoreContext = createContext<ClientStoreValue | null>(null)

export function ClientStoreProvider({
  tenantId, initialCurrency, children,
}: { tenantId: string; initialCurrency?: string; children: ReactNode }) {
  const [tenantUsers, setTenantUsers]   = useState<TenantUser[]>([])
  const [products, setProducts]         = useState<Product[]>([])
  const [customers, setCustomers]       = useState<Customer[]>([])
  const [purchases, setPurchases]       = useState<Purchase[]>([])
  const [sales, setSales]               = useState<Sale[]>([])
  const [currentTenantUserId, setCurrentTenantUserId] = useState<string>("")
  const [currencyCode, setCurrencyCode] = useState<string>(initialCurrency ?? "ILS")

  const currency = useMemo(() => CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0], [currencyCode])
  const fmt = useCallback((amount: number) => `${numberFmt.format(amount)} ${currency.symbol}`, [currency])
  const currentTenantUser = useMemo(() => tenantUsers.find((u) => u.id === currentTenantUserId) ?? tenantUsers[0] ?? null, [tenantUsers, currentTenantUserId])
  const ledger = useMemo(() => buildLedger(purchases, sales, tenantId), [purchases, sales, tenantId])
  const stock  = useMemo(() => buildStock(purchases, sales, tenantId),  [purchases, sales, tenantId])
  const userName = useCallback((id: string) => tenantUsers.find((u) => u.id === id)?.name ?? "غير معروف", [tenantUsers])

  // ── Product CRUD ────────────────────────────────────────────────
  const addProduct = useCallback((p: Omit<Product, "id" | "createdAt">) => {
    setProducts((prev) => [{ ...p, id: genId(), createdAt: TODAY }, ...prev])
  }, [])
  const updateProduct = useCallback((id: string, patch: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])
  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // ── User CRUD ────────────────────────────────────────────────────
  const addTenantUser = useCallback((u: Omit<TenantUser, "id" | "createdAt" | "lastActive" | "status">) => {
    setTenantUsers((prev) => [{ ...u, id: genId(), status: "active", createdAt: TODAY, lastActive: TODAY }, ...prev])
  }, [])
  const updateTenantUser = useCallback((id: string, patch: Partial<TenantUser>) => {
    setTenantUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }, [])
  const toggleTenantUserStatus = useCallback((id: string) => {
    setTenantUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: u.status === "active" ? "frozen" : "active" } : u))
  }, [])
  const deleteTenantUser = useCallback((id: string) => {
    setTenantUsers((prev) => prev.filter((u) => u.id !== id))
  }, [])

  // ── Purchase / Sale ──────────────────────────────────────────────
  const addPurchase = useCallback((p: Omit<Purchase, "id" | "tenantId">) => {
    setPurchases((prev) => [{ ...p, id: genId(), tenantId }, ...prev])
    setProducts((prev) => prev.map((prod) => prod.sku === p.sku ? { ...prod, lastCost: p.unitCost } : prod))
  }, [tenantId])

  const addSale = useCallback((s: Omit<Sale, "id" | "tenantId">) => {
    const newSale: Sale = { ...s, id: genId(), tenantId }
    setSales((prev) => [newSale, ...prev])
    setProducts((prev) => prev.map((prod) => prod.sku === s.sku ? { ...prod, lastPrice: s.unitPrice } : prod))
    if (s.method === "debt") {
      const total = s.quantity * s.unitPrice
      setCustomers((prev) => {
        const match = prev.find((c) => c.name.toLowerCase() === s.buyer.toLowerCase())
        if (match) {
          return prev.map((c) => c.id === match.id ? {
            ...c,
            itemsDetail: c.itemsDetail ? `${c.itemsDetail}، ${s.quantity} ${s.unit} ${s.itemName}` : `${s.quantity} ${s.unit} ${s.itemName}`,
            totalCharged: c.totalCharged + total,
            updatedAt: TODAY,
          } : c)
        }
        return [{ id: genId(), tenantId, name: s.buyer, phone: "—", accountId: `ACC-${Math.floor(1000 + Math.random() * 9000)}`, itemsDetail: `${s.quantity} ${s.unit} ${s.itemName}`, totalCharged: total, amountPaid: 0, dueDate: TODAY, updatedAt: TODAY }, ...prev]
      })
    }
  }, [tenantId])

  const recordPayment = useCallback((customerId: string, amount: number) => {
    setCustomers((prev) => prev.map((c) => c.id === customerId ? { ...c, amountPaid: Math.min(c.totalCharged, c.amountPaid + amount), updatedAt: TODAY } : c))
  }, [])

  const addCustomer = useCallback((c: Omit<Customer, "id" | "updatedAt" | "tenantId">) => {
    setCustomers((prev) => [{ ...c, id: genId(), tenantId, updatedAt: TODAY }, ...prev])
  }, [tenantId])

  const value: ClientStoreValue = {
    today: TODAY, tenantId, tenantUsers, products, customers, purchases, sales, ledger, stock,
    currentTenantUser, setCurrentTenantUserId, currency, setCurrencyCode, fmt, userName,
    addProduct, updateProduct, deleteProduct,
    addTenantUser, updateTenantUser, toggleTenantUserStatus, deleteTenantUser,
    addPurchase, addSale, recordPayment, addCustomer,
  }
  return <ClientStoreContext.Provider value={value}>{children}</ClientStoreContext.Provider>
}

export function useClientStore(): ClientStoreValue {
  const ctx = useContext(ClientStoreContext)
  if (!ctx) throw new Error("useClientStore must be inside ClientStoreProvider")
  return ctx
}