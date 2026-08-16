// ================================================================
// مُحاسِب — Types & Interfaces
// ================================================================

// --- Auth & Multi-Tenancy ---
export type SystemRole = "owner" | "client"
export type TenantStatus = "active" | "frozen" | "trial"
export type SubscriptionPlan = "basic" | "professional" | "enterprise"

export interface Tenant {
  id: string
  name: string
  ownerName: string
  email: string
  phone: string
  plan: SubscriptionPlan
  status: TenantStatus
  createdAt: string
  expiresAt: string
  industry: string
  currency: string
}

export interface AuthUser {
  id: string
  tenantId: string | null
  systemRole: SystemRole
  name: string
  email: string
  username: string
}

// --- Internal roles within a tenant ---
export type ClientRole = "admin" | "accountant" | "cashier" | "inventory"
export type UserStatus = "active" | "frozen"

export interface TenantUser {
  id: string
  tenantId: string
  name: string
  username: string
  email: string
  role: ClientRole
  status: UserStatus
  tempPassword?: string
  createdAt: string
  lastActive: string
}

// --- Units of Measure ---
// كل صنف له وحدة قياس خاصة به
export type UnitCode =
  | "pcs"    // حبة / قطعة
  | "kg"     // كيلوغرام
  | "g"      // غرام
  | "ton"    // طن
  | "m"      // متر طولي
  | "m2"     // متر مربع
  | "m3"     // متر مكعب
  | "liter"  // لتر
  | "box"    // صندوق / كرتون
  | "pack"   // ربطة / طقم
  | "bag"    // كيس
  | "roll"   // رولو / بكرة
  | "pair"   // زوج
  | "dozen"  // دزينة (12)
  | "hour"   // ساعة (خدمات)
  | "day"    // يوم (خدمات)

// --- Product Catalog (كتالوج الأصناف) ---
export interface Product {
  id: string
  tenantId: string
  name: string          // اسم الصنف
  sku: string           // كود
  unit: UnitCode        // وحدة القياس
  category: string      // تصنيف (اختياري)
  lastCost: number      // آخر سعر شراء
  lastPrice: number     // آخر سعر بيع
  notes: string
  createdAt: string
}

// --- Financial Data ---
export type PaymentStatus = "paid" | "partial" | "overdue"

export interface Customer {
  id: string
  tenantId: string
  name: string
  phone: string
  accountId: string
  itemsDetail: string
  totalCharged: number
  amountPaid: number
  dueDate: string
  updatedAt: string
}

export interface Purchase {
  id: string
  tenantId: string
  itemName: string
  sku: string
  unit: UnitCode        // ← جديد
  supplier: string
  quantity: number
  unitCost: number
  warehouse: string
  batch: string
  date: string
  userId: string
}

export type PaymentMethod = "cash" | "card" | "debt"

export interface Sale {
  id: string
  tenantId: string
  itemName: string
  sku: string
  unit: UnitCode        // ← جديد
  quantity: number
  unitPrice: number
  buyer: string
  method: PaymentMethod
  date: string
  userId: string
}

export type LedgerType = "purchase" | "sale" | "return" | "adjustment"

export interface LedgerEntry {
  id: string
  tenantId: string
  type: LedgerType
  itemName: string
  sku: string
  unit: UnitCode        // ← جديد
  quantity: number
  amount: number
  party: string
  userId: string
  method?: PaymentMethod
  date: string
}

export interface StockItem {
  sku: string
  itemName: string
  unit: UnitCode        // ← جديد
  incoming: number
  outgoing: number
  balance: number
  lastCost: number
  lastPrice: number
}

// --- Report Filters ---
export interface ReportFilter {
  fromDate: string
  toDate: string
  customerId?: string
}
