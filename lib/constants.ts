import type {
  ClientRole, SubscriptionPlan, TenantStatus, ProductType,
  AccountType, InvoiceType, InvoiceStatus, PaymentMethod,
  PartyKind, VoucherType, VoucherMethod, CashAccountKind,
} from "./types"

/* ================================================================ */
/* التبويبات                                                         */
/* ================================================================ */

export type TabId =
  // لوحة القيادة
  | "overview"
  // الجداول الأساسية
  | "catalog" | "parties" | "cash-accounts" | "tables"
  // العمليات
  | "sales" | "purchases" | "expenses" | "revenues" | "vouchers"
  // المخزون
  | "inventory" | "stock-take"
  // المحاسبة
  | "accounting" | "ledger"
  // التقارير
  | "reports" | "statements"
  // الإدارة
  | "users" | "settings" | "audit" | "account"
  // متوافق مع القديم
  | "customers"

export type OwnerTabId = "tenants" | "add-tenant"

export const TAB_LABELS: Record<TabId, string> = {
  overview:        "الرئيسية",
  catalog:         "الأصناف",
  parties:         "الزبائن والموردون",
  customers:       "الزبائن والموردون",
  "cash-accounts": "الصناديق والبنوك",
  tables:          "الجداول الأساسية",
  sales:           "المبيعات",
  purchases:       "المشتريات",
  expenses:        "المصروفات",
  revenues:        "الإيرادات",
  vouchers:        "سندات القبض والصرف",
  inventory:       "المخزون",
  "stock-take":    "الجرد",
  accounting:      "المحاسبة",
  ledger:          "دفتر الأستاذ",
  reports:         "التقارير",
  statements:      "كشوف الحسابات",
  users:           "المستخدمون",
  settings:        "إعدادات الشركة",
  account:         "حسابي",
  audit:           "سجل التدقيق",
}

/** أيقونة كل تبويب — من lucide-react */
export const TAB_ICONS: Record<TabId, string> = {
  overview:        "LayoutDashboard",
  catalog:         "Package",
  parties:         "Users",
  customers:       "Users",
  "cash-accounts": "Wallet",
  tables:          "Table2",
  sales:           "ShoppingCart",
  purchases:       "Truck",
  expenses:        "TrendingDown",
  revenues:        "TrendingUp",
  vouchers:        "Receipt",
  inventory:       "Boxes",
  "stock-take":    "ClipboardCheck",
  accounting:      "BookOpen",
  ledger:          "ScrollText",
  reports:         "BarChart3",
  statements:      "FileText",
  users:           "UserCog",
  settings:        "Settings",
  account:         "CircleUser",
  audit:           "History",
}

/** تجميع القائمة الجانبية بمجموعات — أوضح من قائمة طويلة مسطّحة */
export interface NavGroup {
  id: string
  label: string
  tabs: TabId[]
}

export const NAV_GROUPS: NavGroup[] = [
  { id: "main",       label: "",                tabs: ["overview"] },
  { id: "operations", label: "العمليات اليومية", tabs: ["sales", "purchases", "vouchers", "expenses", "revenues"] },
  { id: "data",       label: "البيانات",         tabs: ["parties", "catalog", "inventory", "stock-take"] },
  { id: "accounting", label: "المحاسبة",         tabs: ["accounting", "ledger", "cash-accounts"] },
  { id: "insights",   label: "التقارير",         tabs: ["reports", "statements"] },
  { id: "admin",      label: "الإدارة",          tabs: ["users", "audit", "settings"] },
  { id: "me",         label: "",                tabs: ["account"] },
]

/* ================================================================ */
/* الأدوار والصلاحيات                                                */
/* ================================================================ */

export const ROLE_META: Record<ClientRole, { label: string; tint: string; hint: string }> = {
  admin:      { label: "مدير النظام",  tint: "bg-primary/12 text-primary",       hint: "صلاحية كاملة على كل شي" },
  accountant: { label: "محاسب",         tint: "bg-sky-500/12 text-sky-700",       hint: "المحاسبة والتقارير والسندات" },
  inventory:  { label: "أمين المخزن",  tint: "bg-amber-500/12 text-amber-700",   hint: "الأصناف والمخزون والمشتريات" },
  cashier:    { label: "كاشير",         tint: "bg-emerald-500/12 text-emerald-700", hint: "البيع فقط، بلا تقارير مالية" },
}

/**
 * التبويبات الظاهرة لكل دور.
 * ⚠️ هذا للعرض فقط — الصلاحية الحقيقية مفروضة على السيرفر
 *    في lib/auth/guard.ts وفي سياسات RLS.
 */
export const ROLE_TABS: Record<ClientRole, TabId[]> = {
  admin: [
    "overview", "sales", "purchases", "vouchers", "expenses", "revenues",
    "parties", "catalog", "inventory", "stock-take",
    "accounting", "ledger", "cash-accounts",
    "reports", "statements",
    "users", "tables", "audit", "settings", "account",
  ],
  accountant: [
    "overview", "sales", "purchases", "vouchers", "expenses", "revenues",
    "parties", "catalog", "inventory", "stock-take",
    "accounting", "ledger", "cash-accounts",
    "reports", "statements", "settings", "account",
  ],
  inventory: [
    "overview", "purchases", "catalog", "inventory", "stock-take", "parties", "account",
  ],
  cashier: [
    "sales", "catalog", "parties", "account",
  ],
}

export const CAN_VIEW_PROFIT: ClientRole[] = ["admin", "accountant"]
export const CAN_MANAGE_USERS: ClientRole[] = ["admin"]
export const CAN_EDIT_COSTS: ClientRole[] = ["admin", "accountant", "inventory"]
export const CAN_CANCEL_DOCS: ClientRole[] = ["admin", "accountant"]

/* ================================================================ */
/* المستندات                                                         */
/* ================================================================ */

export const INVOICE_TYPE_META: Record<
  InvoiceType,
  { label: string; short: string; tint: string; partyLabel: string; sign: 1 | -1 }
> = {
  sale:            { label: "فاتورة مبيعات",  short: "مبيعات",  tint: "bg-emerald-500/12 text-emerald-700", partyLabel: "الزبون", sign:  1 },
  purchase:        { label: "فاتورة مشتريات", short: "مشتريات", tint: "bg-sky-500/12 text-sky-700",         partyLabel: "المورد", sign:  1 },
  sale_return:     { label: "مرتجع مبيعات",   short: "مرتجع بيع",  tint: "bg-amber-500/12 text-amber-700",  partyLabel: "الزبون", sign: -1 },
  purchase_return: { label: "مرتجع مشتريات",  short: "مرتجع شراء", tint: "bg-orange-500/12 text-orange-700", partyLabel: "المورد", sign: -1 },
}

export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; tint: string }> = {
  draft:     { label: "مسودّة",  tint: "bg-muted text-muted-foreground" },
  confirmed: { label: "مؤكّدة",  tint: "bg-emerald-500/12 text-emerald-700" },
  cancelled: { label: "ملغاة",   tint: "bg-danger/12 text-danger line-through" },
}

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string; tint: string }> = {
  cash:   { label: "نقدي",  tint: "bg-emerald-500/12 text-emerald-700" },
  card:   { label: "بطاقة", tint: "bg-sky-500/12 text-sky-700" },
  credit: { label: "آجل",   tint: "bg-amber-500/12 text-amber-700" },
}

export const VOUCHER_TYPE_META: Record<VoucherType, { label: string; tint: string; sign: string }> = {
  receipt: { label: "سند قبض", tint: "bg-emerald-500/12 text-emerald-700", sign: "+" },
  payment: { label: "سند صرف", tint: "bg-danger/12 text-danger",           sign: "−" },
}

export const VOUCHER_METHOD_META: Record<VoucherMethod, string> = {
  cash:   "نقداً",
  card:   "بطاقة",
  bank:   "حوالة بنكية",
  cheque: "شيك",
}

export const PARTY_KIND_META: Record<PartyKind, { label: string; tint: string }> = {
  customer: { label: "زبون",       tint: "bg-emerald-500/12 text-emerald-700" },
  supplier: { label: "مورد",       tint: "bg-sky-500/12 text-sky-700" },
  both:     { label: "زبون ومورد", tint: "bg-violet-500/12 text-violet-700" },
}

export const CASH_ACCOUNT_KIND_META: Record<CashAccountKind, { label: string; icon: string }> = {
  cash: { label: "صندوق نقدي", icon: "Banknote" },
  bank: { label: "حساب بنكي",  icon: "Landmark" },
  card: { label: "نقاط بيع",   icon: "CreditCard" },
}

/* ================================================================ */
/* المحاسبة                                                          */
/* ================================================================ */

export const ACCOUNT_TYPE_META: Record<
  AccountType,
  { label: string; tint: string; normalSide: "debit" | "credit"; order: number }
> = {
  asset:     { label: "الأصول",        tint: "bg-sky-500/12 text-sky-700",         normalSide: "debit",  order: 1 },
  liability: { label: "الالتزامات",    tint: "bg-orange-500/12 text-orange-700",   normalSide: "credit", order: 2 },
  equity:    { label: "حقوق الملكية",  tint: "bg-violet-500/12 text-violet-700",   normalSide: "credit", order: 3 },
  revenue:   { label: "الإيرادات",     tint: "bg-emerald-500/12 text-emerald-700", normalSide: "credit", order: 4 },
  expense:   { label: "المصروفات",     tint: "bg-danger/12 text-danger",           normalSide: "debit",  order: 5 },
}

/** تسميات أنواع المستندات — ترقيم الفواتير والسندات */
export const DOC_TYPE_LABELS: Record<string, string> = {
  sale_invoice: "فواتير المبيعات",
  purchase_invoice: "فواتير المشتريات",
  sale_return: "مرتجعات المبيعات",
  purchase_return: "مرتجعات المشتريات",
  receipt: "سندات القبض",
  payment: "سندات الصرف",
  expense: "سندات المصروفات",
  revenue: "سندات الإيرادات",
  journal: "قيود اليومية",
  party: "أكواد جهات التعامل",
}

/** ترجمة مصدر القيد لعرضه بالعربي */
export const JOURNAL_SOURCE_LABELS: Record<string, string> = {
  manual:        "قيد يدوي",
  invoice:       "فاتورة",
  payment:       "سند قبض/صرف",
  expense:       "مصروف / إيراد",
  opening_party: "رصيد افتتاحي — جهة تعامل",
  opening_stock: "رصيد افتتاحي — مخزون",
  opening_cash:  "رصيد افتتاحي — صندوق",
  adjustment:    "تسوية",
  stock_take:    "جرد فعلي",
}

/* ================================================================ */
/* الأصناف                                                           */
/* ================================================================ */

export const PRODUCT_TYPE_META: Record<
  ProductType,
  { label: string; hint: string; color: string; tracksStock: boolean }
> = {
  product: { label: "منتج جاهز",   hint: "قطعة/عبوة جاهزة، يُتابع رصيدها",             color: "bg-sky-500/12 text-sky-700",       tracksStock: true  },
  goods:   { label: "بضاعة عامة",  hint: "وزن أو حجم أو أي بضاعة عامة، يُتابع رصيدها", color: "bg-amber-500/12 text-amber-700",   tracksStock: true  },
  service: { label: "حرفة / خدمة", hint: "عمل يُحسب بالوحدة (متر، ساعة...) بلا مخزون", color: "bg-violet-500/12 text-violet-700", tracksStock: false },
}

/* ================================================================ */
/* الاشتراكات                                                        */
/* ================================================================ */

export const PLAN_META: Record<SubscriptionPlan, { label: string; color: string; maxUsers: number }> = {
  basic:        { label: "أساسي",   color: "bg-muted text-muted-foreground",   maxUsers: 3   },
  professional: { label: "احترافي", color: "bg-sky-500/12 text-sky-700",       maxUsers: 10  },
  enterprise:   { label: "مؤسسي",   color: "bg-violet-500/12 text-violet-700", maxUsers: 999 },
}

export const TENANT_STATUS_META: Record<TenantStatus, { label: string; color: string }> = {
  active: { label: "نشط",    color: "bg-emerald-500/12 text-emerald-700" },
  frozen: { label: "مجمّد",  color: "bg-danger/12 text-danger" },
  trial:  { label: "تجريبي", color: "bg-amber-500/12 text-amber-700" },
}

/* ================================================================ */
/* العملات والضريبة                                                  */
/* ================================================================ */

export const CURRENCIES: { code: string; symbol: string; label: string; decimals: number }[] = [
  { code: "ILS", symbol: "₪",  label: "شيقل إسرائيلي", decimals: 2 },
  { code: "JOD", symbol: "د.أ", label: "دينار أردني",   decimals: 3 },
  { code: "USD", symbol: "$",  label: "دولار أمريكي",   decimals: 2 },
  { code: "EUR", symbol: "€",  label: "يورو",           decimals: 2 },
]

export const CURRENCY_MAP = new Map(CURRENCIES.map((c) => [c.code, c]))

/** نسبة ضريبة القيمة المضافة في فلسطين */
export const DEFAULT_VAT_RATE = 16

/* ================================================================ */
/* فترات التقارير الجاهزة                                            */
/* ================================================================ */

export const DATE_PRESETS: { id: string; label: string }[] = [
  { id: "today",      label: "اليوم" },
  { id: "yesterday",  label: "أمس" },
  { id: "this-week",  label: "هذا الأسبوع" },
  { id: "this-month", label: "هذا الشهر" },
  { id: "last-month", label: "الشهر الماضي" },
  { id: "quarter",    label: "هذا الربع" },
  { id: "this-year",  label: "هذه السنة" },
  { id: "custom",     label: "فترة مخصصة" },
]
