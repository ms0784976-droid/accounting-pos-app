"use server"

// ================================================================
// حِزَم الاستدعاءات — تسريع بلا تغيير أي منطق
// ================================================================
// المشكلة التي تحلّها هذه الملف:
//
// كل Server Action هي طلب HTTP مستقل من المتصفح. الشاشة الرئيسية
// كانت تُطلق ستة طلبات، ومحرّر الفاتورة ثلاثة، وشاشة الزبائن أربعة.
// كل طلب يدفع ثمن الشبكة (ذهاب وإياب إلى Vercel) وثمن فحص الجلسة
// من جديد. النتيجة: عشرات الرحلات قبل ظهور أول رقم على الشاشة.
//
// الحل هنا: طلب واحد يجمعها. الدوال الأصلية لم تتغيّر ولم تُنسخ —
// نستدعيها كما هي بالتوازي داخل السيرفر. وبفضل React.cache على
// getSession، فحص الجلسة ينفَّذ مرة واحدة للحزمة كلها بدل مرة لكل
// دالة.
//
// ⚠️ لم يتغيّر أي استعلام ولا أي حساب. نفس البيانات بالضبط، لكن
//    في رحلة شبكة واحدة بدل ست.

import { requireTenant } from "@/lib/auth/guard"
import {
  fetchDashboardAction, fetchLowStockAction,
  fetchSalesTrendAction, fetchTopProductsAction,
  type DashboardData,
} from "./reports"
import { fetchInvoicesAction } from "./invoices"
import { fetchCashAccountsAction } from "./treasury"
import { fetchProductsFullAction } from "./inventory"
import { fetchPartiesAction } from "./parties"
import type {
  LowStockItem, CashAccount, Invoice, TopProduct, Product, PartyWithBalance,
} from "@/lib/types"

/** يبتلع الأخطاء المتوقّعة (نقص صلاحية مثلاً) ويُرجع قيمة فارغة آمنة */
async function soft<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}

/* ================================================================ */
/* الشاشة الرئيسية — كانت 6 طلبات، صارت 1                            */
/* ================================================================ */

export interface HomeBundle {
  dashboard: DashboardData | null
  lowStock: LowStockItem[]
  cashAccounts: CashAccount[]
  recentInvoices: Invoice[]
  trend: { period: string; sales: number; cost: number; profit: number; count: number }[]
  topProducts: TopProduct[]
  /** ما فشل تحميله — لعرض تنبيه لطيف بدل شاشة بيضاء */
  failed: string[]
}

export async function fetchHomeBundleAction(
  from: string,
  to: string
): Promise<HomeBundle> {
  const s = await requireTenant()
  const canReports = s.systemRole === "owner" || s.role === "admin" || s.role === "accountant"

  const [dashboard, lowStock, cashAccounts, recentInvoices, trend, topProducts] =
    await Promise.all([
      soft(fetchDashboardAction(), null as DashboardData | null),
      soft(fetchLowStockAction(), [] as LowStockItem[]),
      soft(fetchCashAccountsAction(), [] as CashAccount[]),
      soft(fetchInvoicesAction({ type: "sale", limit: 6 }), [] as Invoice[]),
      canReports
        ? soft(fetchSalesTrendAction(from, to, "day"), [])
        : Promise.resolve([]),
      canReports
        ? soft(fetchTopProductsAction(from, to, 5), [] as TopProduct[])
        : Promise.resolve([] as TopProduct[]),
    ])

  const failed: string[] = []
  if (!dashboard) failed.push("المؤشرات")

  return { dashboard, lowStock, cashAccounts, recentInvoices, trend, topProducts, failed }
}

/* ================================================================ */
/* محرّر الفاتورة — كان 3 طلبات، صار 1                                */
/* ================================================================ */

export interface InvoiceEditorBundle {
  products: Product[]
  parties: PartyWithBalance[]
  cashAccounts: CashAccount[]
}

export async function fetchInvoiceEditorBundleAction(
  isSale: boolean
): Promise<InvoiceEditorBundle> {
  await requireTenant()

  const [products, parties, cashAccounts] = await Promise.all([
    soft(fetchProductsFullAction({ activeOnly: true }), [] as Product[]),
    soft(fetchPartiesAction(isSale ? "customer" : "supplier"), [] as PartyWithBalance[]),
    soft(fetchCashAccountsAction(), [] as CashAccount[]),
  ])

  return { products, parties, cashAccounts }
}

/* ================================================================ */
/* البحث العام (Ctrl+K) — طلب واحد يغطّي كل شيء                      */
/* ================================================================ */

export interface SearchHit {
  kind: "product" | "party" | "invoice"
  id: string
  title: string
  subtitle: string
  amount: number | null
}

export async function globalSearchAction(term: string): Promise<SearchHit[]> {
  const q = term.trim()
  if (q.length < 2) return []
  await requireTenant()

  const [products, parties, invoices] = await Promise.all([
    soft(fetchProductsFullAction({ search: q, activeOnly: true }), [] as Product[]),
    soft(fetchPartiesAction("all"), [] as PartyWithBalance[]),
    soft(fetchInvoicesAction({ search: q, limit: 8 }), [] as Invoice[]),
  ])

  const low = q.toLowerCase()
  const hits: SearchHit[] = []

  for (const p of products.slice(0, 6)) {
    hits.push({
      kind: "product",
      id: p.id,
      title: p.name,
      subtitle: `${p.sku || "بلا كود"} · الرصيد ${p.stockQty}`,
      amount: p.lastPrice,
    })
  }

  for (const p of parties) {
    if (
      p.name.toLowerCase().includes(low) ||
      p.phone.includes(q) ||
      p.code.toLowerCase().includes(low)
    ) {
      hits.push({
        kind: "party",
        id: p.id,
        title: p.name,
        subtitle: p.phone || p.code || "جهة تعامل",
        amount: p.balance,
      })
      if (hits.filter((h) => h.kind === "party").length >= 6) break
    }
  }

  for (const inv of invoices.slice(0, 6)) {
    hits.push({
      kind: "invoice",
      id: inv.id,
      title: inv.invoiceNo,
      subtitle: `${inv.partyName || "زبون نقدي"} · ${inv.date}`,
      amount: inv.total,
    })
  }

  return hits
}
