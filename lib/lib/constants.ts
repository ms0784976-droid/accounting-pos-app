import type {
  ClientRole, SubscriptionPlan, TenantStatus, ProductType,
  AccountType, InvoiceType, InvoiceStatus, PaymentMethod,
  PartyKind, VoucherType, VoucherMethod, CashAccountKind,
} from "./types"

/* ================================================================ */
/* حماية من القيم غير المتوقّعة                                       */
/* ================================================================ */
/**
 * الواجهة تفهرس هذه الخرائط بقيم قادمة من قاعدة البيانات مباشرة
 * (مثل products.type أو tenant_users.role). لو ظهرت قيمة قديمة أو
 * غير متوقّعة، كان `MAP[value].label` ينهار بـ
 * "Cannot read properties of undefined" ويُبيّض الشاشة كاملة أمام
 * المستخدم. هذا الغلاف يُرجع قيمة افتراضية آمنة بدل الانهيار.
 */
function withFallback<T extends object>(map: T, fallbackKey: keyof T): T {
  return new Proxy(map, {
    get(target, prop, receiver) {
      if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver)
      if (typeof prop === "string") return target[fallbackKey]
      return undefined
    },
  })
}

/* ================================================================ */
/* التبويبات                                                         */
/* ================================================================ */

export type TabId =
  // لوحة القيادة
  | "overview"
  // العمليات اليومية
  | "sales" | "purchases" | "vouchers" | "expenses" | "revenues"
  // البيانات
  | "customers" | "suppliers" | "catalog" | "inventory"
  // المحاسبة
  | "accounting" | "cash-accounts"
  // التقارير
  | "reports"
  // الإدارة
  | "users" | "settings" | "account"

export type OwnerTabId = "tenants" | "add-tenant"

export const TAB_LABELS: Record<TabId, string> = {
  overview:        "الرئيسية",
  sales:           "المبيعات",
  purchases:       "المشتريات",
  vouchers:        "سندات القبض والصرف",
  expenses:        "المصروفات",
  revenues:        "الإيرادات",
  customers:       "الزبائن",
  suppliers:       "الموردون",
  catalog:         "الأصناف",
  inventory:       "المخزون والجرد",
  accounting:      "المحاسبة والقيود",
  "cash-accounts": "الصناديق والبنوك",
  reports:         "التقارير",
  users:           "المستخدمون",
  settings:        "إعدادات الشركة",
  account:         "حسابي",
}

/** أيقونة كل تبويب — من lucide-react */
export const TAB_ICONS: Record<TabId, string> = {
  overview:        "LayoutDashboard",
  sales:           "ShoppingCart",
  purchases:       "Truck",
  vouchers:        "Receipt",
  expenses:        "TrendingDown",
  revenues:        "TrendingUp",
  customers:       "Users",
  suppliers:       "Factory",
  catalog:         "Package",
  inventory:       "Boxes",
  accounting:      "BookOpen",
  "cash-accounts": "Wallet",
  reports:         "BarChart3",
  users:           "UserCog",
  settings:        "Settings",
  account:         "CircleUser",
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
  { id: "data",       label: "البيانات",         tabs: ["customers", "suppliers", "catalog", "inventory"] },
  { id: "accounting", label: "المحاسبة",         tabs: ["accounting", "cash-accounts", "reports"] },
  { id: "admin",      label: "الإدارة",          tabs: ["users", "settings", "account"] },
]

/* ================================================================ */
/* الأدوار والصلاحيات                                                */
/* ================================================================ */

export const ROLE_META: Record<ClientRole, { label: string; tint: string; hint: string }> = withFallback({
  admin:      { label: "مدير النظام",  tint: "bg-primary/12 text-primary",       hint: "صلاحية كاملة على كل شي" },
  accountant: { label: "محاسب",         tint: "bg-sky-500/12 text-sky-700",       hint: "المحاسبة والتقارير والسندات" },
  inventory:  { label: "أمين المخزن",  tint: "bg-amber-500/12 text-amber-700",   hint: "الأصناف والمخزون والمشتريات" },
  cashier:    { label: "كاشير",         tint: "bg-emerald-500/12 text-emerald-700", hint: "البيع فقط، بلا تقارير مالية" },
}, "cashier")

/**
 * التبويبات الظاهرة لكل دور.
 * ⚠️ هذا للعرض فقط — الصلاحية الحقيقية مفروضة على السيرفر
 *    في lib/auth/guard.ts وفي سياسات RLS.
 */
export const ROLE_TABS: Record<ClientRole, TabId[]> = withFallback({
  admin: [
    "overview", "sales", "purchases", "vouchers", "expenses", "revenues",
    "customers", "suppliers", "catalog", "inventory",
    "accounting", "cash-accounts", "reports",
    "users", "settings", "account",
  ],
  accountant: [
    "overview", "sales", "purchases", "vouchers", "expenses", "revenues",
    "customers", "suppliers", "catalog", "inventory",
    "accounting", "cash-accounts", "reports",
    "settings", "account",
  ],
  inventory: [
    "overview", "purchases", "suppliers", "catalog", "inventory", "account",
  ],
  cashier: [
    "sales", "customers", "catalog", "account",
  ],
}, "cashier")

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
> = withFallback({
  sale:            { label: "فاتورة مبيعات",  short: "مبيعات",  tint: "bg-emerald-500/12 text-emerald-700", partyLabel: "الزبون", sign:  1 },
  purchase:        { label: "فاتورة مشتريات", short: "مشتريات", tint: "bg-sky-500/12 text-sky-700",         partyLabel: "المورد", sign:  1 },
  sale_return:     { label: "مرتجع مبيعات",   short: "مرتجع بيع",  tint: "bg-amber-500/12 text-amber-700",  partyLabel: "الزبون", sign: -1 },
  purchase_return: { label: "مرتجع مشتريات",  short: "مرتجع شراء", tint: "bg-orange-500/12 text-orange-700", partyLabel: "المورد", sign: -1 },
}, "sale")

export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; tint: string }> = withFallback({
  draft:     { label: "مسودّة",  tint: "bg-muted text-muted-foreground" },
  confirmed: { label: "مؤكّدة",  tint: "bg-emerald-500/12 text-emerald-700" },
  cancelled: { label: "ملغاة",   tint: "bg-danger/12 text-danger line-through" },
}, "draft")

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string; tint: string }> = withFallback({
  cash:   { label: "نقدي",  tint: "bg-emerald-500/12 text-emerald-700" },
  card:   { label: "بطاقة", tint: "bg-sky-500/12 text-sky-700" },
  credit: { label: "آجل",   tint: "bg-amber-500/12 text-amber-700" },
}, "cash")

export const VOUCHER_TYPE_META: Record<VoucherType, { label: string; tint: string; sign: string }> = withFallback({
  receipt: { label: "سند قبض", tint: "bg-emerald-500/12 text-emerald-700", sign: "+" },
  payment: { label: "سند صرف", tint: "bg-danger/12 text-danger",           sign: "−" },
}, "receipt")

export const VOUCHER_METHOD_META: Record<VoucherMethod, string> = {
  cash:   "نقداً",
  card:   "بطاقة",
  bank:   "حوالة بنكية",
  cheque: "شيك",
}

export const PARTY_KIND_META: Record<PartyKind, { label: string; tint: string }> = withFallback({
  customer: { label: "زبون",       tint: "bg-emerald-500/12 text-emerald-700" },
  supplier: { label: "مورد",       tint: "bg-sky-500/12 text-sky-700" },
  both:     { label: "زبون ومورد", tint: "bg-violet-500/12 text-violet-700" },
}, "customer")

export const CASH_ACCOUNT_KIND_META: Record<CashAccountKind, { label: string; icon: string }> = withFallback({
  cash: { label: "صندوق نقدي", icon: "Banknote" },
  bank: { label: "حساب بنكي",  icon: "Landmark" },
  card: { label: "نقاط بيع",   icon: "CreditCard" },
}, "cash")

/* ================================================================ */
/* المحاسبة                                                          */
/* ================================================================ */

export const ACCOUNT_TYPE_META: Record<
  AccountType,
  { label: string; tint: string; normalSide: "debit" | "credit"; order: number }
> = withFallback({
  asset:     { label: "الأصول",        tint: "bg-sky-500/12 text-sky-700",         normalSide: "debit",  order: 1 },
  liability: { label: "الالتزامات",    tint: "bg-orange-500/12 text-orange-700",   normalSide: "credit", order: 2 },
  equity:    { label: "حقوق الملكية",  tint: "bg-violet-500/12 text-violet-700",   normalSide: "credit", order: 3 },
  revenue:   { label: "الإيرادات",     tint: "bg-emerald-500/12 text-emerald-700", normalSide: "credit", order: 4 },
  expense:   { label: "المصروفات",     tint: "bg-danger/12 text-danger",           normalSide: "debit",  order: 5 },
}, "asset")

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
> = withFallback({
  product: { label: "منتج جاهز",   hint: "قطعة/عبوة جاهزة، يُتابع رصيدها",             color: "bg-sky-500/12 text-sky-700",       tracksStock: true  },
  goods:   { label: "بضاعة عامة",  hint: "وزن أو حجم أو أي بضاعة عامة، يُتابع رصيدها", color: "bg-amber-500/12 text-amber-700",   tracksStock: true  },
  service: { label: "حرفة / خدمة", hint: "عمل يُحسب بالوحدة (متر، ساعة...) بلا مخزون", color: "bg-violet-500/12 text-violet-700", tracksStock: false },
}, "product")

/* ================================================================ */
/* الاشتراكات                                                        */
/* ================================================================ */

export const PLAN_META: Record<SubscriptionPlan, { label: string; color: string; maxUsers: number }> = withFallback({
  basic:        { label: "أساسي",   color: "bg-muted text-muted-foreground",   maxUsers: 3   },
  professional: { label: "احترافي", color: "bg-sky-500/12 text-sky-700",       maxUsers: 10  },
  enterprise:   { label: "مؤسسي",   color: "bg-violet-500/12 text-violet-700", maxUsers: 999 },
}, "basic")

export const TENANT_STATUS_META: Record<TenantStatus, { label: string; color: string }> = withFallback({
  active: { label: "نشط",    color: "bg-emerald-500/12 text-emerald-700" },
  frozen: { label: "مجمّد",  color: "bg-danger/12 text-danger" },
  trial:  { label: "تجريبي", color: "bg-amber-500/12 text-amber-700" },
}, "active")

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
