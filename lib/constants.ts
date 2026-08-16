import type { ClientRole, SubscriptionPlan, TenantStatus } from "./types"

export type TabId =
  | "overview"
  | "catalog"
  | "customers"
  | "purchases"
  | "sales"
  | "ledger"
  | "reports"
  | "users"

export type OwnerTabId = "tenants" | "add-tenant"

export const ROLE_META: Record<ClientRole, { label: string; tint: string }> = {
  admin:      { label: "مدير النظام",  tint: "bg-primary/15 text-primary" },
  accountant: { label: "محاسب",        tint: "bg-blue-500/15 text-blue-600" },
  inventory:  { label: "أمين المخزن", tint: "bg-amber-500/15 text-amber-600" },
  cashier:    { label: "كاشير",        tint: "bg-green-500/15 text-green-600" },
}

export const ROLE_TABS: Record<ClientRole, TabId[]> = {
  admin:      ["overview", "catalog", "customers", "purchases", "sales", "ledger", "reports", "users"],
  accountant: ["overview", "catalog", "customers", "purchases", "sales", "ledger", "reports"],
  inventory:  ["overview", "catalog", "purchases", "ledger"],
  cashier:    ["catalog", "sales"],
}

export const CAN_VIEW_PROFIT: ClientRole[] = ["admin", "accountant"]
export const CAN_MANAGE_USERS: ClientRole[] = ["admin"]
export const CAN_EDIT_COSTS: ClientRole[] = ["admin", "accountant", "inventory"]

export const PLAN_META: Record<SubscriptionPlan, { label: string; color: string; maxUsers: number }> = {
  basic:        { label: "أساسي",   color: "bg-gray-100 text-gray-700",       maxUsers: 3   },
  professional: { label: "احترافي", color: "bg-blue-100 text-blue-700",        maxUsers: 10  },
  enterprise:   { label: "مؤسسي",   color: "bg-purple-100 text-purple-700",   maxUsers: 999 },
}

export const TENANT_STATUS_META: Record<TenantStatus, { label: string; color: string }> = {
  active: { label: "نشط",    color: "bg-green-100 text-green-700" },
  frozen: { label: "مجمّد",  color: "bg-red-100 text-red-700"    },
  trial:  { label: "تجريبي", color: "bg-amber-100 text-amber-700" },
}

export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "ILS", symbol: "₪", label: "شيقل إسرائيلي" },
  { code: "USD", symbol: "$", label: "دولار أمريكي"  },
]

export const TAB_LABELS: Record<TabId, string> = {
  overview:  "نظرة عامة",
  catalog:   "كتالوج الأصناف",
  sales:     "المبيعات / POS",
  purchases: "المشتريات",
  customers: "العملاء والذمم",
  ledger:    "دفتر الأستاذ",
  reports:   "التقارير",
  users:     "المستخدمون",
}
