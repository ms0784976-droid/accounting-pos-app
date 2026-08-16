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
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const TODAY = "2026-08-16"

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
/* Seed Data — Tenants                                                 */
/* ------------------------------------------------------------------ */

const SEED_TENANTS: Tenant[] = [
  {
    id: "t_alum",
    name: "شركة الأفق للألمنيوم",
    ownerName: "محمد عبدالله",
    email: "alum@mohaseb.app",
    phone: "+972 50 111 2233",
    plan: "professional",
    status: "active",
    createdAt: "2025-03-01",
    expiresAt: "2027-03-01",
    industry: "ألمنيوم ومواد بناء",
    currency: "ILS",
  },
  {
    id: "t_grocery",
    name: "مركز النور للمواد الغذائية",
    ownerName: "فاطمة الزهراني",
    email: "grocery@mohaseb.app",
    phone: "+972 55 444 7788",
    plan: "basic",
    status: "active",
    createdAt: "2025-06-10",
    expiresAt: "2026-06-10",
    industry: "مواد غذائية وتجزئة",
    currency: "ILS",
  },
  {
    id: "t_auto",
    name: "ورشة كريم للسيارات",
    ownerName: "كريم الأحمدي",
    email: "auto@mohaseb.app",
    phone: "+972 54 999 3344",
    plan: "basic",
    status: "trial",
    createdAt: "2026-07-15",
    expiresAt: "2026-08-15",
    industry: "قطع غيار سيارات",
    currency: "ILS",
  },
  {
    id: "t_textiles",
    name: "شركة نور للمنسوجات",
    ownerName: "نور العتيبي",
    email: "textiles@mohaseb.app",
    phone: "+972 53 222 9900",
    plan: "enterprise",
    status: "active",
    createdAt: "2024-11-20",
    expiresAt: "2027-11-20",
    industry: "منسوجات وخامات",
    currency: "ILS",
  },
  {
    id: "t_frozen",
    name: "متجر الأمل",
    ownerName: "أحمد الشهري",
    email: "frozen@mohaseb.app",
    phone: "+972 50 777 1122",
    plan: "basic",
    status: "frozen",
    createdAt: "2025-01-01",
    expiresAt: "2025-12-31",
    industry: "تجزئة عامة",
    currency: "ILS",
  },
]

/* ------------------------------------------------------------------ */
/* Seed Data — Auth Accounts                                           */
/* ------------------------------------------------------------------ */

const SEED_AUTH_USERS: AuthUser[] = [
  { id: "auth_owner",   tenantId: null,       systemRole: "owner",  name: "مشرف المنصة",     email: "owner@mohaseb.app",   username: "owner"   },
  { id: "auth_alum",    tenantId: "t_alum",   systemRole: "client", name: "محمد عبدالله",    email: "alum@mohaseb.app",    username: "alum"    },
  { id: "auth_grocery", tenantId: "t_grocery",systemRole: "client", name: "فاطمة الزهراني", email: "grocery@mohaseb.app", username: "grocery" },
  { id: "auth_auto",    tenantId: "t_auto",   systemRole: "client", name: "كريم الأحمدي",   email: "auto@mohaseb.app",    username: "auto"    },
]

/* ------------------------------------------------------------------ */
/* Seed Data — Tenant Users                                            */
/* ------------------------------------------------------------------ */

const SEED_TENANT_USERS: TenantUser[] = [
  { id: "u_alum_admin", tenantId: "t_alum",    name: "محمد عبدالله",   username: "m.abdallah", email: "m@alum.com",     role: "admin",      status: "active", createdAt: "2025-03-01", lastActive: TODAY },
  { id: "u_alum_acc",   tenantId: "t_alum",    name: "رنا القحطاني",   username: "rana.acc",   email: "rana@alum.com",  role: "accountant", status: "active", createdAt: "2025-04-01", lastActive: TODAY },
  { id: "u_alum_cash",  tenantId: "t_alum",    name: "عمر نبيل",       username: "omar.cash",  email: "omar@alum.com",  role: "cashier",    status: "active", createdAt: "2025-05-10", lastActive: TODAY },
  { id: "u_groc_admin", tenantId: "t_grocery", name: "فاطمة الزهراني", username: "fatima.admin",email: "fatima@grocery.com",role: "admin",   status: "active", createdAt: "2025-06-10", lastActive: TODAY },
  { id: "u_groc_cash",  tenantId: "t_grocery", name: "سارة خليل",      username: "sara.cash",  email: "sara@grocery.com",role: "cashier",   status: "active", createdAt: "2025-07-01", lastActive: TODAY },
]

/* ------------------------------------------------------------------ */
/* Seed Data — Product Catalog (كتالوج الأصناف)                       */
/* ------------------------------------------------------------------ */

const SEED_PRODUCTS: Product[] = [
  // ── شركة الألمنيوم
  { id: "prod_1", tenantId: "t_alum", name: "بروفيل ألمنيوم 6 متر",    sku: "ALU-PRF-6M",  unit: "m",   category: "ألمنيوم",  lastCost: 45,  lastPrice: 75,  notes: "", createdAt: "2025-03-01" },
  { id: "prod_2", tenantId: "t_alum", name: "زجاج مزدوج 6+9+6",        sku: "GLS-DUO-6",   unit: "m2",  category: "زجاج",     lastCost: 180, lastPrice: 290, notes: "", createdAt: "2025-03-01" },
  { id: "prod_3", tenantId: "t_alum", name: "خامة ملء ألمنيوم",        sku: "ALU-FILL",    unit: "kg",  category: "مواد",     lastCost: 22,  lastPrice: 40,  notes: "", createdAt: "2025-03-01" },
  { id: "prod_4", tenantId: "t_alum", name: "بروفيل باب انزلاق",       sku: "ALU-DOOR-SLD", unit: "pcs", category: "ألمنيوم",  lastCost: 120, lastPrice: 195, notes: "", createdAt: "2025-04-01" },
  { id: "prod_5", tenantId: "t_alum", name: "سيليكون إكساء",           sku: "SIL-COT",     unit: "pcs", category: "مواد",     lastCost: 18,  lastPrice: 32,  notes: "", createdAt: "2025-04-01" },
  // ── مركز المواد الغذائية
  { id: "prod_6", tenantId: "t_grocery", name: "زيت نباتي 5 لتر",      sku: "OIL-5L",      unit: "pcs", category: "زيوت",     lastCost: 38,  lastPrice: 58,  notes: "", createdAt: "2025-06-10" },
  { id: "prod_7", tenantId: "t_grocery", name: "سكر أبيض",             sku: "SGR-KG",      unit: "kg",  category: "بقالة",    lastCost: 2.4, lastPrice: 3.5, notes: "", createdAt: "2025-06-10" },
  { id: "prod_8", tenantId: "t_grocery", name: "أرز بسمتي",            sku: "RCE-BSM",     unit: "kg",  category: "بقالة",    lastCost: 6,   lastPrice: 9,   notes: "", createdAt: "2025-07-01" },
  { id: "prod_9", tenantId: "t_grocery", name: "معلبات طماطم",         sku: "TOM-CAN",     unit: "box", category: "معلبات",   lastCost: 45,  lastPrice: 70,  notes: "صندوق 24 علبة", createdAt: "2025-07-01" },
]

/* ------------------------------------------------------------------ */
/* Seed Data — Purchases                                               */
/* ------------------------------------------------------------------ */

const SEED_PURCHASES: Purchase[] = [
  { id: "p_1", tenantId: "t_alum",    itemName: "بروفيل ألمنيوم 6 متر", sku: "ALU-PRF-6M",  unit: "m",   supplier: "مصنع الخليج للألمنيوم",   quantity: 500, unitCost: 45,  warehouse: "المستودع الرئيسي - A1", batch: "B-2601", date: "2026-08-02", userId: "u_alum_admin" },
  { id: "p_2", tenantId: "t_alum",    itemName: "زجاج مزدوج 6+9+6",     sku: "GLS-DUO-6",   unit: "m2",  supplier: "شركة الزجاج الحديث",       quantity: 200, unitCost: 180, warehouse: "المستودع الرئيسي - B2", batch: "B-2602", date: "2026-08-05", userId: "u_alum_admin" },
  { id: "p_3", tenantId: "t_alum",    itemName: "خامة ملء ألمنيوم",     sku: "ALU-FILL",    unit: "kg",  supplier: "مورد المواد المساعدة",     quantity: 100, unitCost: 22,  warehouse: "المستودع الفرعي - C1",  batch: "B-2603", date: "2026-08-07", userId: "u_alum_acc"  },
  { id: "p_4", tenantId: "t_grocery", itemName: "زيت نباتي 5 لتر",      sku: "OIL-5L",      unit: "pcs", supplier: "شركة المطاحن الذهبية",     quantity: 300, unitCost: 38,  warehouse: "المستودع الرئيسي",     batch: "B-3001", date: "2026-08-01", userId: "u_groc_admin" },
  { id: "p_5", tenantId: "t_grocery", itemName: "سكر أبيض",             sku: "SGR-KG",      unit: "kg",  supplier: "مصنع السكر الوطني",        quantity: 500, unitCost: 2.4, warehouse: "المستودع الرئيسي",     batch: "B-3002", date: "2026-08-03", userId: "u_groc_admin" },
]

/* ------------------------------------------------------------------ */
/* Seed Data — Sales                                                   */
/* ------------------------------------------------------------------ */

const SEED_SALES: Sale[] = [
  { id: "s_1", tenantId: "t_alum",    itemName: "بروفيل ألمنيوم 6 متر", sku: "ALU-PRF-6M",  unit: "m",   quantity: 120, unitPrice: 75,  buyer: "مؤسسة الريادة للمقاولات", method: "cash",  date: "2026-08-10", userId: "u_alum_cash" },
  { id: "s_2", tenantId: "t_alum",    itemName: "زجاج مزدوج 6+9+6",     sku: "GLS-DUO-6",   unit: "m2",  quantity: 80,  unitPrice: 290, buyer: "شركة البناء الحديث",       method: "debt",  date: "2026-08-11", userId: "u_alum_cash" },
  { id: "s_3", tenantId: "t_alum",    itemName: "بروفيل ألمنيوم 6 متر", sku: "ALU-PRF-6M",  unit: "m",   quantity: 50,  unitPrice: 75,  buyer: "مقاولات الخليج",           method: "card",  date: "2026-08-12", userId: "u_alum_cash" },
  { id: "s_4", tenantId: "t_alum",    itemName: "خامة ملء ألمنيوم",     sku: "ALU-FILL",    unit: "kg",  quantity: 30,  unitPrice: 40,  buyer: "إنشاءات الأمل",            method: "debt",  date: "2026-08-13", userId: "u_alum_cash" },
  { id: "s_5", tenantId: "t_alum",    itemName: "بروفيل ألمنيوم 6 متر", sku: "ALU-PRF-6M",  unit: "m",   quantity: 20,  unitPrice: 80,  buyer: "زبون نقدي",                method: "cash",  date: TODAY,        userId: "u_alum_cash" },
  { id: "s_6", tenantId: "t_grocery", itemName: "زيت نباتي 5 لتر",      sku: "OIL-5L",      unit: "pcs", quantity: 50,  unitPrice: 58,  buyer: "مطعم البيت الكبير",        method: "debt",  date: "2026-08-14", userId: "u_groc_cash" },
  { id: "s_7", tenantId: "t_grocery", itemName: "سكر أبيض",             sku: "SGR-KG",      unit: "kg",  quantity: 200, unitPrice: 3.5, buyer: "زبون نقدي",                method: "cash",  date: TODAY,        userId: "u_groc_cash" },
]

/* ------------------------------------------------------------------ */
/* Seed Data — Customers                                               */
/* ------------------------------------------------------------------ */

const SEED_CUSTOMERS: Customer[] = [
  { id: "c_1", tenantId: "t_alum",    name: "مؤسسة الريادة للمقاولات", phone: "+972 50 123 4567", accountId: "ACC-1001", itemsDetail: "120 م بروفيل ألمنيوم",           totalCharged: 28500, amountPaid: 28500, dueDate: "2026-07-20", updatedAt: "2026-08-10" },
  { id: "c_2", tenantId: "t_alum",    name: "شركة البناء الحديث",      phone: "+972 55 234 5678", accountId: "ACC-1002", itemsDetail: "80 م² زجاج مزدوج",               totalCharged: 85000, amountPaid: 40000, dueDate: "2026-09-01", updatedAt: "2026-08-12" },
  { id: "c_3", tenantId: "t_alum",    name: "مقاولات الخليج",          phone: "+972 54 345 6789", accountId: "ACC-1003", itemsDetail: "50 م بروفيل ألمنيوم",            totalCharged: 12400, amountPaid: 3000,  dueDate: "2026-07-01", updatedAt: "2026-08-08" },
  { id: "c_4", tenantId: "t_alum",    name: "إنشاءات الأمل",           phone: "+972 53 456 7890", accountId: "ACC-1004", itemsDetail: "30 كجم خامة ملء ألمنيوم",        totalCharged: 31000, amountPaid: 15000, dueDate: "2026-09-10", updatedAt: "2026-08-13" },
  { id: "c_5", tenantId: "t_grocery", name: "مطعم البيت الكبير",       phone: "+972 50 987 6543", accountId: "ACC-2001", itemsDetail: "50 حبة زيت نباتي 5 لتر",         totalCharged: 4200,  amountPaid: 2100,  dueDate: "2026-08-30", updatedAt: "2026-08-14" },
]

/* ------------------------------------------------------------------ */
/* Derived: Ledger + Stock                                             */
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
/* Auth Context                                                        */
/* ------------------------------------------------------------------ */

interface AuthContextValue {
  authUser: AuthUser | null
  login: (username: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const login = useCallback((username: string, _password: string): boolean => {
    const found = SEED_AUTH_USERS.find((u) => u.username === username || u.email === username)
    if (!found) return false
    setAuthUser(found)
    return true
  }, [])
  const logout = useCallback(() => setAuthUser(null), [])
  return <AuthContext.Provider value={{ authUser, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be inside AuthProvider")
  return ctx
}

/* ------------------------------------------------------------------ */
/* Owner Store Context                                                 */
/* ------------------------------------------------------------------ */

interface OwnerStoreValue {
  tenants: Tenant[]
  addTenant: (t: Omit<Tenant, "id" | "createdAt">) => void
  updateTenant: (id: string, patch: Partial<Tenant>) => void
  toggleTenantStatus: (id: string) => void
  deleteTenant: (id: string) => void
}

const OwnerStoreContext = createContext<OwnerStoreValue | null>(null)

export function OwnerStoreProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>(SEED_TENANTS)
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

export function useOwnerStore(): OwnerStoreValue {
  const ctx = useContext(OwnerStoreContext)
  if (!ctx) throw new Error("useOwnerStore must be inside OwnerStoreProvider")
  return ctx
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
  currentTenantUser: TenantUser
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
  const [tenantUsers, setTenantUsers]   = useState<TenantUser[]>(SEED_TENANT_USERS.filter((u) => u.tenantId === tenantId))
  const [products, setProducts]         = useState<Product[]>(SEED_PRODUCTS.filter((p) => p.tenantId === tenantId))
  const [customers, setCustomers]       = useState<Customer[]>(SEED_CUSTOMERS.filter((c) => c.tenantId === tenantId))
  const [purchases, setPurchases]       = useState<Purchase[]>(SEED_PURCHASES.filter((p) => p.tenantId === tenantId))
  const [sales, setSales]               = useState<Sale[]>(SEED_SALES.filter((s) => s.tenantId === tenantId))
  const [currentTenantUserId, setCurrentTenantUserId] = useState<string>(
    SEED_TENANT_USERS.find((u) => u.tenantId === tenantId && u.role === "admin")?.id ?? ""
  )
  const [currencyCode, setCurrencyCode] = useState<string>(initialCurrency ?? "ILS")

  const currency = useMemo(() => CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0], [currencyCode])
  const fmt = useCallback((amount: number) => `${numberFmt.format(amount)} ${currency.symbol}`, [currency])
  const currentTenantUser = useMemo(() => tenantUsers.find((u) => u.id === currentTenantUserId) ?? tenantUsers[0], [tenantUsers, currentTenantUserId])
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
    // update product catalog prices
    setProducts((prev) => prev.map((prod) => prod.sku === p.sku ? { ...prod, lastCost: p.unitCost } : prod))
  }, [tenantId])

  const addSale = useCallback((s: Omit<Sale, "id" | "tenantId">) => {
    const newSale: Sale = { ...s, id: genId(), tenantId }
    setSales((prev) => [newSale, ...prev])
    // update product last price
    setProducts((prev) => prev.map((prod) => prod.sku === s.sku ? { ...prod, lastPrice: s.unitPrice } : prod))
    if (s.method === "debt") {
      const total = s.quantity * s.unitPrice
      setCustomers((prev) => {
        const match = prev.find((c) => c.name.toLowerCase() === s.buyer.toLowerCase())
        if (match) {
          return prev.map((c) => c.id === match.id ? {
            ...c,
            itemsDetail: `${c.itemsDetail}، ${s.quantity} ${s.unit} ${s.itemName}`,
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
