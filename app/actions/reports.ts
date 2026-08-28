"use server"

// ================================================================
// التقارير المالية · لوحة القيادة · الإعدادات · النسخ الاحتياطي
// ================================================================

import { createServerSupabase } from "@/lib/supabase/server"
import { requireTenant, requirePermission, todayInTimezone } from "@/lib/auth/guard"
import type {
  TrialBalanceRow, ProfitAndLoss, BalanceSheet, FinancialLine,
  TopProduct, VatReport, LowStockItem, IntegrityCheck,
  TenantProfile, AuditEntry, AccountType, UnitCode,
} from "@/lib/types"

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ================================================================ */
/* ميزان المراجعة                                                    */
/* ================================================================ */

export async function fetchTrialBalanceAction(
  from: string,
  to: string
): Promise<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; isBalanced: boolean }> {
  const s = await requirePermission("viewReports")
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc("trial_balance", {
    p_tenant: s.tenantId, p_from: from, p_to: to,
  })
  if (error) throw new Error(error.message)

  const rows: TrialBalanceRow[] = (data ?? []).map((r: any) => ({
    accountCode: r.account_code,
    accountName: r.account_name,
    accountType: r.account_type as AccountType,
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    balance: Number(r.balance ?? 0),
  }))

  const totalDebit  = rows.reduce((s2, r) => s2 + r.debit, 0)
  const totalCredit = rows.reduce((s2, r) => s2 + r.credit, 0)

  return {
    rows,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  }
}

/* ================================================================ */
/* قائمة الدخل — الربح الحقيقي                                       */
/* ================================================================ */

export async function fetchProfitAndLossAction(
  from: string,
  to: string
): Promise<ProfitAndLoss> {
  const s = await requirePermission("viewReports")
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc("profit_and_loss", {
    p_tenant: s.tenantId, p_from: from, p_to: to,
  })
  if (error) throw new Error(error.message)

  const all: FinancialLine[] = (data ?? []).map((r: any) => ({
    section: r.section,
    accountCode: r.account_code,
    accountName: r.account_name,
    amount: Number(r.amount ?? 0),
  }))

  const revenue  = all.filter((l) => l.section === "revenue")
  const cogs     = all.filter((l) => l.section === "cogs")
  const expenses = all.filter((l) => l.section === "expense")

  const sum = (arr: FinancialLine[]) => arr.reduce((s2, l) => s2 + l.amount, 0)
  const totalRevenue  = sum(revenue)
  const totalCogs     = sum(cogs)
  const totalExpenses = sum(expenses)
  const grossProfit   = totalRevenue - totalCogs

  return {
    revenue, cogs, expenses,
    totalRevenue, totalCogs, grossProfit, totalExpenses,
    netProfit: grossProfit - totalExpenses,
  }
}

/* ================================================================ */
/* الميزانية العمومية                                                */
/* ================================================================ */

export async function fetchBalanceSheetAction(asOf: string): Promise<BalanceSheet> {
  const s = await requirePermission("viewReports")
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc("balance_sheet", {
    p_tenant: s.tenantId, p_as_of: asOf,
  })
  if (error) throw new Error(error.message)

  const all: FinancialLine[] = (data ?? []).map((r: any) => ({
    section: r.section,
    accountCode: r.account_code,
    accountName: r.account_name,
    amount: Number(r.amount ?? 0),
  }))

  const assets      = all.filter((l) => l.section === "asset")
  const liabilities = all.filter((l) => l.section === "liability")
  const equity      = all.filter((l) => l.section === "equity")

  const sum = (arr: FinancialLine[]) => arr.reduce((s2, l) => s2 + l.amount, 0)
  const totalAssets      = sum(assets)
  const totalLiabilities = sum(liabilities)
  const totalEquity      = sum(equity)

  return {
    assets, liabilities, equity,
    totalAssets, totalLiabilities, totalEquity,
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  }
}

/* ================================================================ */
/* أكثر الأصناف مبيعاً · الضريبة · المخزون المنخفض                   */
/* ================================================================ */

export async function fetchTopProductsAction(
  from: string,
  to: string,
  limit = 20
): Promise<TopProduct[]> {
  const s = await requirePermission("viewReports")
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc("top_products", {
    p_tenant: s.tenantId, p_from: from, p_to: to, p_limit: limit,
  })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    productId: r.product_id,
    itemName: r.item_name ?? "",
    sku: r.sku ?? "",
    unit: (r.unit as UnitCode) ?? "pcs",
    qtySold: Number(r.qty_sold ?? 0),
    revenue: Number(r.revenue ?? 0),
    cost: Number(r.cost ?? 0),
    profit: Number(r.profit ?? 0),
  }))
}

export async function fetchVatReportAction(from: string, to: string): Promise<VatReport> {
  const s = await requirePermission("viewReports")
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc("vat_report", {
    p_tenant: s.tenantId, p_from: from, p_to: to,
  })
  if (error) throw new Error(error.message)

  const r = (data ?? [])[0] ?? {}
  return {
    outputTax: Number(r.output_tax ?? 0),
    inputTax: Number(r.input_tax ?? 0),
    netDue: Number(r.net_due ?? 0),
  }
}

export async function fetchLowStockAction(): Promise<LowStockItem[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from("v_low_stock").select("*")
    .eq("tenant_id", s.tenantId).order("shortage", { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    productId: r.product_id,
    name: r.name,
    sku: r.sku ?? "",
    unit: (r.unit as UnitCode) ?? "pcs",
    stockQty: Number(r.stock_qty ?? 0),
    minQty: Number(r.min_qty ?? 0),
    avgCost: Number(r.avg_cost ?? 0),
    shortage: Number(r.shortage ?? 0),
  }))
}

/* ================================================================ */
/* مبيعات حسب الفترة — لرسم المخطط                                   */
/* ================================================================ */

export async function fetchSalesTrendAction(
  from: string,
  to: string,
  groupBy: "day" | "month" = "day"
): Promise<{ period: string; sales: number; cost: number; profit: number; count: number }[]> {
  const s = await requirePermission("viewReports")
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from("invoices")
    .select("date, type, subtotal, discount_amount, cost_total")
    .eq("tenant_id", s.tenantId).eq("status", "confirmed")
    .in("type", ["sale", "sale_return"])
    .gte("date", from).lte("date", to)
    .order("date")
  if (error) throw new Error(error.message)

  const map = new Map<string, { sales: number; cost: number; count: number }>()
  for (const inv of data ?? []) {
    const key = groupBy === "month" ? (inv as any).date.slice(0, 7) : (inv as any).date
    const sign = (inv as any).type === "sale" ? 1 : -1
    const net = Number((inv as any).subtotal ?? 0) - Number((inv as any).discount_amount ?? 0)
    const cur = map.get(key) ?? { sales: 0, cost: 0, count: 0 }
    map.set(key, {
      sales: cur.sales + sign * net,
      cost: cur.cost + sign * Number((inv as any).cost_total ?? 0),
      count: cur.count + 1,
    })
  }

  return [...map.entries()]
    .map(([period, v]) => ({ period, ...v, profit: v.sales - v.cost }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

/* ================================================================ */
/* لوحة القيادة                                                      */
/* ================================================================ */

export interface DashboardData {
  today: string
  salesToday: number
  salesMonth: number
  profitMonth: number
  expensesMonth: number
  cashTotal: number
  receivables: number
  payables: number
  invoiceCountToday: number
  lowStockCount: number
  overdueCount: number
  inventoryValue: number
}

export async function fetchDashboardAction(): Promise<DashboardData> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data: tenant } = await supabase
    .from("tenants").select("timezone").eq("id", s.tenantId).maybeSingle()
  const today = todayInTimezone(tenant?.timezone ?? "Asia/Hebron")
  const monthStart = today.slice(0, 8) + "01"

  const [invRes, expRes, cashRes, balRes, lowRes, prodRes] = await Promise.all([
    supabase.from("invoices")
      .select("date, type, subtotal, discount_amount, cost_total, due_date, payment_method, status")
      .eq("tenant_id", s.tenantId).eq("status", "confirmed")
      .gte("date", monthStart).lte("date", today),
    supabase.from("expenses")
      .select("total, kind").eq("tenant_id", s.tenantId).eq("status", "confirmed")
      .eq("kind", "expense").gte("date", monthStart).lte("date", today),
    supabase.from("v_cash_balances").select("balance").eq("tenant_id", s.tenantId),
    supabase.from("v_party_balances").select("balance").eq("tenant_id", s.tenantId),
    supabase.from("v_low_stock").select("product_id", { count: "exact", head: true })
      .eq("tenant_id", s.tenantId),
    supabase.from("products").select("stock_qty, avg_cost")
      .eq("tenant_id", s.tenantId).eq("is_active", true),
  ])

  const invoices = invRes.data ?? []
  const net = (i: any) => Number(i.subtotal ?? 0) - Number(i.discount_amount ?? 0)
  const sign = (i: any) => (i.type === "sale" ? 1 : i.type === "sale_return" ? -1 : 0)

  const salesMonth = invoices.reduce((sum, i: any) => sum + sign(i) * net(i), 0)
  const cogsMonth  = invoices.reduce((sum, i: any) => sum + sign(i) * Number(i.cost_total ?? 0), 0)
  const salesToday = invoices
    .filter((i: any) => i.date === today)
    .reduce((sum, i: any) => sum + sign(i) * net(i), 0)
  const invoiceCountToday = invoices.filter((i: any) => i.date === today && i.type === "sale").length

  const expensesMonth = (expRes.data ?? []).reduce((sum, e: any) => sum + Number(e.total ?? 0), 0)

  const partyBalances = (balRes.data ?? []).map((b: any) => Number(b.balance ?? 0))
  const receivables = partyBalances.filter((b) => b > 0).reduce((a, b) => a + b, 0)
  const payables    = Math.abs(partyBalances.filter((b) => b < 0).reduce((a, b) => a + b, 0))

  const overdueCount = invoices.filter(
    (i: any) => i.payment_method === "credit" && i.due_date && i.due_date < today
  ).length

  const inventoryValue = (prodRes.data ?? []).reduce(
    (sum, p: any) => sum + Number(p.stock_qty ?? 0) * Number(p.avg_cost ?? 0), 0
  )

  return {
    today,
    salesToday,
    salesMonth,
    profitMonth: salesMonth - cogsMonth - expensesMonth,
    expensesMonth,
    cashTotal: (cashRes.data ?? []).reduce((sum, c: any) => sum + Number(c.balance ?? 0), 0),
    receivables,
    payables,
    invoiceCountToday,
    lowStockCount: lowRes.count ?? 0,
    overdueCount,
    inventoryValue,
  }
}

/* ================================================================ */
/* بيانات الشركة والإعدادات                                          */
/* ================================================================ */

export async function fetchTenantProfileAction(): Promise<TenantProfile> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from("tenants").select("*").eq("id", s.tenantId).single()
  if (error) throw new Error(error.message)

  return {
    id: data.id,
    name: data.name,
    ownerName: data.owner_name ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    plan: data.plan,
    status: data.status,
    createdAt: data.created_at?.split("T")[0] ?? "",
    expiresAt: data.expires_at ?? "",
    industry: data.industry ?? "",
    currency: data.currency ?? "ILS",
    taxNumber: data.tax_number ?? "",
    address: data.address ?? "",
    logoUrl: data.logo_url ?? "",
    vatRate: Number(data.vat_rate ?? 16),
    vatEnabled: data.vat_enabled ?? false,
    fiscalYearStart: data.fiscal_year_start ?? "",
    lockedUntil: data.locked_until ?? null,
    timezone: data.timezone ?? "Asia/Hebron",
  }
}

export async function updateTenantProfileAction(patch: {
  name?: string
  phone?: string
  address?: string
  taxNumber?: string
  logoUrl?: string
  currency?: string
  vatRate?: number
  vatEnabled?: boolean
  timezone?: string
}): Promise<void> {
  const s = await requirePermission("manageSettings")
  const supabase = await createServerSupabase()

  const db: Record<string, unknown> = {}
  if (patch.name !== undefined)       db.name = patch.name.trim()
  if (patch.phone !== undefined)      db.phone = patch.phone
  if (patch.address !== undefined)    db.address = patch.address
  if (patch.taxNumber !== undefined)  db.tax_number = patch.taxNumber
  if (patch.logoUrl !== undefined)    db.logo_url = patch.logoUrl
  if (patch.currency !== undefined)   db.currency = patch.currency
  if (patch.vatEnabled !== undefined) db.vat_enabled = patch.vatEnabled
  if (patch.timezone !== undefined)   db.timezone = patch.timezone
  if (patch.vatRate !== undefined) {
    if (patch.vatRate < 0 || patch.vatRate > 100) throw new Error("نسبة الضريبة غير صالحة")
    db.vat_rate = patch.vatRate
  }
  if (Object.keys(db).length === 0) return

  const { error } = await supabase.from("tenants").update(db).eq("id", s.tenantId)
  if (error) throw new Error(error.message)
}

/** إقفال الفترة المحاسبية — يمنع أي تعديل على ما قبل التاريخ */
export async function lockPeriodAction(untilDate: string | null): Promise<void> {
  const s = await requirePermission("manageSettings")
  const supabase = await createServerSupabase()

  if (untilDate) {
    const { data: checks } = await supabase.rpc("integrity_check", { p_tenant: s.tenantId })
    const failed = (checks ?? []).filter((c: any) => c.status === "خطأ")
    if (failed.length) {
      throw new Error(
        `لا يمكن إقفال الفترة قبل إصلاح الأخطاء: ${failed.map((f: any) => f.check_name).join("، ")}`
      )
    }
  }

  const { error } = await supabase
    .from("tenants").update({ locked_until: untilDate }).eq("id", s.tenantId)
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* فحص السلامة · النسخ الاحتياطي · سجل التدقيق                       */
/* ================================================================ */

export async function runIntegrityCheckAction(): Promise<IntegrityCheck[]> {
  const s = await requirePermission("viewReports")
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc("integrity_check", { p_tenant: s.tenantId })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    checkName: r.check_name,
    status: r.status,
    detail: r.detail,
  }))
}

/** نسخة احتياطية كاملة كـ JSON */
export async function exportBackupAction(): Promise<{ filename: string; json: string }> {
  const s = await requirePermission("manageBackup")
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc("export_tenant_backup", { p_tenant: s.tenantId })
  if (error) throw new Error(error.message)

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  return {
    filename: `backup-${stamp}.json`,
    json: JSON.stringify(data, null, 2),
  }
}

export async function fetchAuditLogAction(opts?: {
  from?: string
  to?: string
  tableName?: string
  limit?: number
}): Promise<AuditEntry[]> {
  const s = await requirePermission("manageUsers")
  const supabase = await createServerSupabase()

  let q = supabase
    .from("audit_log").select("*")
    .eq("tenant_id", s.tenantId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200)

  if (opts?.from)      q = q.gte("created_at", opts.from)
  if (opts?.to)        q = q.lte("created_at", `${opts.to}T23:59:59`)
  if (opts?.tableName) q = q.eq("table_name", opts.tableName)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  // ربط المستخدمين بأسمائهم
  const userIds = [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))]
  const nameMap = new Map<string, string>()
  if (userIds.length) {
    const { data: users } = await supabase
      .from("tenant_users").select("auth_user_id, name")
      .eq("tenant_id", s.tenantId).in("auth_user_id", userIds)
    for (const u of users ?? []) nameMap.set((u as any).auth_user_id, (u as any).name)
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    tenantId: r.tenant_id,
    userId: r.user_id,
    userName: nameMap.get(r.user_id) ?? "—",
    action: r.action,
    tableName: r.table_name,
    recordId: r.record_id,
    createdAt: r.created_at,
  }))
}
