// ================================================================
// مُحاسِب — Types & Interfaces
// ================================================================

/* ── المصادقة وتعدد الشركات ─────────────────────────────────── */
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

/** بيانات الشركة الكاملة — تُستخدم في الفواتير والتقارير الرسمية */
export interface TenantProfile extends Tenant {
  taxNumber: string
  address: string
  logoUrl: string
  vatRate: number
  vatEnabled: boolean
  fiscalYearStart: string
  lockedUntil: string | null
  timezone: string
}

export interface AuthUser {
  id: string
  tenantId: string | null
  systemRole: SystemRole
  name: string
  email: string
  username: string
  role: ClientRole | null
}

/* ── الأدوار داخل الشركة ────────────────────────────────────── */
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

/* ── وحدات القياس ───────────────────────────────────────────── */
export type UnitCode =
  | "pcs" | "kg" | "g" | "ton" | "m" | "m2" | "m3" | "liter"
  | "box" | "pack" | "bag" | "roll" | "pair" | "dozen" | "hour" | "day"

/* ── الأصناف ────────────────────────────────────────────────── */
export type ProductType = "product" | "goods" | "service"

export interface Product {
  id: string
  tenantId: string
  name: string
  sku: string
  barcode: string
  unit: UnitCode
  type: ProductType
  category: string
  categoryId: string | null
  lastCost: number
  lastPrice: number
  /** الرصيد اللحظي — مصدره حركات المخزون، لا يُعدَّل يدوياً */
  stockQty: number
  /** التكلفة بالمتوسط المرجّح */
  avgCost: number
  minQty: number
  taxPercent: number | null
  isActive: boolean
  allowNegativeStock: boolean
  notes: string
  createdAt: string
}

export interface ProductCategory {
  id: string
  tenantId: string
  name: string
}

/* ── جهات التعامل: زبائن وموردون في كيان واحد ───────────────── */
export type PartyKind = "customer" | "supplier" | "both"

export interface Party {
  id: string
  tenantId: string
  code: string
  name: string
  kind: PartyKind
  phone: string
  email: string
  address: string
  taxNumber: string
  /** موجب = عليه لنا (مدين) | سالب = لنا عليه (دائن) */
  openingBalance: number
  openingBalanceDate: string | null
  creditLimit: number
  paymentTermsDays: number
  notes: string
  isActive: boolean
  createdAt: string
}

/** جهة التعامل مع رصيدها المحسوب من القيود */
export interface PartyWithBalance extends Party {
  totalDebit: number
  totalCredit: number
  balance: number
}

/** سطر في كشف الحساب */
export interface StatementRow {
  date: string | null
  docNo: string
  docType: string
  description: string
  debit: number
  credit: number
  runningBalance: number
}

/* ── الصناديق والبنوك ───────────────────────────────────────── */
export type CashAccountKind = "cash" | "bank" | "card"

export interface CashAccount {
  id: string
  tenantId: string
  name: string
  kind: CashAccountKind
  accountNumber: string
  openingBalance: number
  balance: number
  isDefault: boolean
  isActive: boolean
}

/* ── الفواتير ───────────────────────────────────────────────── */
export type InvoiceType = "sale" | "purchase" | "sale_return" | "purchase_return"
export type InvoiceStatus = "draft" | "confirmed" | "cancelled"
export type PaymentMethod = "cash" | "card" | "credit"

export interface InvoiceLine {
  id: string
  invoiceId: string
  productId: string | null
  itemName: string
  sku: string
  unit: UnitCode
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  taxPercent: number
  taxAmount: number
  lineSubtotal: number
  lineTotal: number
  unitCost: number
  lineNo: number
}

export interface Invoice {
  id: string
  tenantId: string
  invoiceNo: string
  type: InvoiceType
  partyId: string | null
  partyName: string
  date: string
  dueDate: string | null
  paymentMethod: PaymentMethod
  cashAccountId: string | null
  originInvoiceId: string | null
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  costTotal: number
  paidAmount: number
  status: InvoiceStatus
  journalEntryId: string | null
  notes: string
  reference: string
  createdBy: string
  createdAt: string
  cancelReason: string
}

export interface InvoiceWithLines extends Invoice {
  lines: InvoiceLine[]
}

/** مُدخل إنشاء فاتورة جديدة */
export interface InvoiceDraft {
  type: InvoiceType
  partyId: string | null
  date: string
  dueDate?: string | null
  paymentMethod: PaymentMethod
  cashAccountId?: string | null
  originInvoiceId?: string | null
  notes?: string
  reference?: string
  lines: InvoiceLineDraft[]
}

export interface InvoiceLineDraft {
  productId: string | null
  itemName: string
  sku: string
  unit: UnitCode
  quantity: number
  unitPrice: number
  /** خصم بالنسبة المئوية — يُستخدم إذا كان أكبر من صفر */
  discountPercent?: number
  /**
   * خصم بمبلغ ثابت بعملة الفاتورة.
   * يُطبَّق كما هو فقط عندما تكون discountPercent صفراً — هذا ما تفعله
   * دالة fn_invoice_line_calc في قاعدة البيانات، فلا تقريب ولا فروقات قروش.
   */
  discountAmount?: number
  taxPercent?: number
}

/* ── سندات القبض والصرف ─────────────────────────────────────── */
export type VoucherType = "receipt" | "payment"
export type VoucherMethod = "cash" | "card" | "bank" | "cheque"

export interface PaymentVoucher {
  id: string
  tenantId: string
  voucherNo: string
  type: VoucherType
  partyId: string
  partyName: string
  cashAccountId: string
  cashAccountName: string
  date: string
  amount: number
  method: VoucherMethod
  reference: string
  chequeDueDate: string | null
  notes: string
  status: "confirmed" | "cancelled"
  createdAt: string
}

/* ── المصروفات والإيرادات ───────────────────────────────────── */
export type ExpenseKind = "expense" | "revenue"

export interface ExpenseCategory {
  id: string
  tenantId: string
  name: string
  kind: ExpenseKind
  accountId: string
  accountName: string
  isActive: boolean
}

export interface Expense {
  id: string
  tenantId: string
  voucherNo: string
  kind: ExpenseKind
  categoryId: string
  categoryName: string
  cashAccountId: string
  cashAccountName: string
  partyId: string | null
  partyName: string
  date: string
  amount: number
  taxAmount: number
  total: number
  description: string
  status: "confirmed" | "cancelled"
  createdAt: string
}

/* ── المحاسبة: دليل الحسابات والقيود ────────────────────────── */
export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense"

export interface Account {
  id: string
  tenantId: string
  code: string
  name: string
  type: AccountType
  parentId: string | null
  systemKey: string | null
  isGroup: boolean
  isActive: boolean
}

export interface JournalLine {
  id: string
  entryId: string
  accountId: string
  accountCode: string
  accountName: string
  partyId: string | null
  partyName: string
  debit: number
  credit: number
  description: string
  lineNo: number
}

export interface JournalEntry {
  id: string
  tenantId: string
  entryNo: string
  date: string
  description: string
  sourceType: string
  sourceId: string | null
  isReversal: boolean
  reversesId: string | null
  totalDebit: number
  totalCredit: number
  createdAt: string
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalLine[]
}

export interface JournalDraft {
  date: string
  description: string
  lines: { accountId: string; partyId?: string | null; debit: number; credit: number; description?: string }[]
}

/* ── المخزون ────────────────────────────────────────────────── */
export interface StockMove {
  id: string
  tenantId: string
  productId: string
  productName: string
  sku: string
  unit: UnitCode
  date: string
  qtyIn: number
  qtyOut: number
  unitCost: number
  sourceType: string
  sourceId: string | null
  note: string
  balanceAfter: number
  avgCostAfter: number
}

export interface LowStockItem {
  productId: string
  name: string
  sku: string
  unit: UnitCode
  stockQty: number
  minQty: number
  avgCost: number
  shortage: number
}

/* ── التقارير ───────────────────────────────────────────────── */
export interface DateRange {
  from: string
  to: string
}

export interface TrialBalanceRow {
  accountCode: string
  accountName: string
  accountType: AccountType
  debit: number
  credit: number
  balance: number
}

export interface FinancialLine {
  section: string
  accountCode: string
  accountName: string
  amount: number
}

/** قائمة الدخل مجمّعة وجاهزة للعرض */
export interface ProfitAndLoss {
  revenue: FinancialLine[]
  cogs: FinancialLine[]
  expenses: FinancialLine[]
  totalRevenue: number
  totalCogs: number
  grossProfit: number
  totalExpenses: number
  netProfit: number
}

export interface BalanceSheet {
  assets: FinancialLine[]
  liabilities: FinancialLine[]
  equity: FinancialLine[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  isBalanced: boolean
}

export interface TopProduct {
  productId: string
  itemName: string
  sku: string
  unit: UnitCode
  qtySold: number
  revenue: number
  cost: number
  profit: number
}

export interface VatReport {
  outputTax: number
  inputTax: number
  netDue: number
}

export interface IntegrityCheck {
  checkName: string
  status: "سليم" | "تحذير" | "خطأ"
  detail: string
}

/* ── سجل التدقيق ────────────────────────────────────────────── */
export interface AuditEntry {
  id: number
  tenantId: string
  userId: string | null
  userName: string
  action: string
  tableName: string
  recordId: string | null
  createdAt: string
}

/* ── أنواع قديمة محفوظة للتوافق مع الشاشات الحالية ──────────── */
export type PaymentStatus = "paid" | "partial" | "overdue"
export type LegacyPaymentMethod = "cash" | "card" | "debt"

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
  unit: UnitCode
  supplier: string
  quantity: number
  unitCost: number
  warehouse: string
  batch: string
  date: string
  userId: string
}

export interface Sale {
  id: string
  tenantId: string
  itemName: string
  sku: string
  unit: UnitCode
  quantity: number
  unitPrice: number
  buyer: string
  method: LegacyPaymentMethod
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
  unit: UnitCode
  quantity: number
  amount: number
  party: string
  userId: string
  method?: LegacyPaymentMethod
  date: string
}

export interface StockItem {
  sku: string
  itemName: string
  unit: UnitCode
  incoming: number
  outgoing: number
  balance: number
  lastCost: number
  lastPrice: number
}
