"use server"

// ================================================================
// سندات القبض والصرف · الصناديق والبنوك · المصروفات والإيرادات
// ================================================================

import { createServerSupabase } from "@/lib/supabase/server"
import { requireTenant, requirePermission } from "@/lib/auth/guard"
import type {
  PaymentVoucher, VoucherType, VoucherMethod,
  CashAccount, CashAccountKind,
  Expense, ExpenseCategory, ExpenseKind,
} from "@/lib/types"

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ================================================================ */
/* الصناديق والبنوك                                                  */
/* ================================================================ */

export async function fetchCashAccountsAction(): Promise<CashAccount[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const [accRes, balRes] = await Promise.all([
    supabase.from("cash_accounts").select("*")
      .eq("tenant_id", s.tenantId).order("is_default", { ascending: false }).order("name"),
    supabase.from("v_cash_balances").select("cash_account_id, balance")
      .eq("tenant_id", s.tenantId),
  ])
  if (accRes.error) throw new Error(accRes.error.message)

  const balMap = new Map<string, number>(
    (balRes.data ?? []).map((b: any) => [b.cash_account_id, Number(b.balance ?? 0)])
  )

  return (accRes.data ?? []).map((r: any) => ({
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    kind: r.kind as CashAccountKind,
    accountNumber: r.account_number ?? "",
    openingBalance: Number(r.opening_balance ?? 0),
    balance: balMap.get(r.id) ?? Number(r.opening_balance ?? 0),
    isDefault: r.is_default ?? false,
    isActive: r.is_active ?? true,
  }))
}

export async function addCashAccountAction(input: {
  name: string
  kind: CashAccountKind
  accountNumber?: string
  openingBalance?: number
  openingDate?: string
  isDefault?: boolean
}): Promise<CashAccount> {
  const s = await requirePermission("manageSettings")
  if (!input.name?.trim()) throw new Error("اسم الصندوق مطلوب")

  const supabase = await createServerSupabase()

  // صندوق افتراضي واحد فقط
  if (input.isDefault) {
    await supabase.from("cash_accounts")
      .update({ is_default: false }).eq("tenant_id", s.tenantId)
  }

  const { data, error } = await supabase
    .from("cash_accounts")
    .insert({
      tenant_id: s.tenantId,
      name: input.name.trim(),
      kind: input.kind,
      account_number: input.accountNumber ?? "",
      is_default: input.isDefault ?? false,
    })
    .select("*").single()
  if (error) throw new Error(error.message)

  if (input.openingBalance && input.openingBalance !== 0) {
    const { error: obError } = await supabase.rpc("post_cash_opening_balance", {
      p_cash: data.id,
      p_amount: input.openingBalance,
      p_date: input.openingDate ?? new Date().toISOString().split("T")[0],
    })
    if (obError) throw new Error(`تعذّر تسجيل الرصيد الافتتاحي: ${obError.message}`)
  }

  return {
    id: data.id, tenantId: data.tenant_id, name: data.name,
    kind: data.kind, accountNumber: data.account_number ?? "",
    openingBalance: Number(data.opening_balance ?? 0),
    balance: Number(data.opening_balance ?? 0),
    isDefault: data.is_default, isActive: data.is_active,
  }
}

export async function updateCashAccountAction(
  id: string,
  patch: { name?: string; accountNumber?: string; isActive?: boolean; isDefault?: boolean }
): Promise<void> {
  const s = await requirePermission("manageSettings")
  const supabase = await createServerSupabase()

  if (patch.isDefault) {
    await supabase.from("cash_accounts")
      .update({ is_default: false }).eq("tenant_id", s.tenantId)
  }

  const db: Record<string, unknown> = {}
  if (patch.name !== undefined)          db.name = patch.name.trim()
  if (patch.accountNumber !== undefined) db.account_number = patch.accountNumber
  if (patch.isActive !== undefined)      db.is_active = patch.isActive
  if (patch.isDefault !== undefined)     db.is_default = patch.isDefault
  if (Object.keys(db).length === 0) return

  const { error } = await supabase
    .from("cash_accounts").update(db).eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* سندات القبض والصرف                                                */
/* ================================================================ */

function rowToVoucher(r: any): PaymentVoucher {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    voucherNo: r.voucher_no,
    type: r.type as VoucherType,
    partyId: r.party_id,
    partyName: r.parties?.name ?? "",
    cashAccountId: r.cash_account_id,
    cashAccountName: r.cash_accounts?.name ?? "",
    date: r.date,
    amount: Number(r.amount ?? 0),
    method: r.method as VoucherMethod,
    reference: r.reference ?? "",
    chequeDueDate: r.cheque_due_date,
    notes: r.notes ?? "",
    status: r.status,
    createdAt: r.created_at ?? "",
  }
}

export async function fetchVouchersAction(opts?: {
  type?: VoucherType
  partyId?: string
  from?: string
  to?: string
  limit?: number
}): Promise<PaymentVoucher[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  let q = supabase
    .from("payments")
    .select("*, parties(name), cash_accounts(name)")
    .eq("tenant_id", s.tenantId)
    .order("date", { ascending: false })
    .limit(opts?.limit ?? 300)

  if (opts?.type)    q = q.eq("type", opts.type)
  if (opts?.partyId) q = q.eq("party_id", opts.partyId)
  if (opts?.from)    q = q.gte("date", opts.from)
  if (opts?.to)      q = q.lte("date", opts.to)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToVoucher)
}

export async function createVoucherAction(input: {
  type: VoucherType
  partyId: string
  cashAccountId: string
  date: string
  amount: number
  method: VoucherMethod
  reference?: string
  chequeDueDate?: string
  notes?: string
}): Promise<PaymentVoucher> {
  const s = await requirePermission("managePayments")

  if (!(input.amount > 0)) throw new Error("المبلغ يجب أن يكون أكبر من صفر")
  if (!input.partyId)      throw new Error("يجب تحديد الزبون أو المورد")
  if (!input.cashAccountId) throw new Error("يجب تحديد الصندوق أو البنك")
  if (input.method === "cheque" && !input.reference?.trim()) {
    throw new Error("رقم الشيك مطلوب")
  }

  const supabase = await createServerSupabase()

  // تحذير منطقي: لا نقبض من زبون رصيده صفر أو دائن
  if (input.type === "receipt") {
    const { data: bal } = await supabase
      .from("v_party_balances").select("balance, name")
      .eq("party_id", input.partyId).maybeSingle()
    const balance = Number(bal?.balance ?? 0)
    if (balance <= 0) {
      throw new Error(`الزبون "${bal?.name ?? ""}" ليس عليه رصيد مستحق (الرصيد: ${balance.toFixed(2)})`)
    }
    if (input.amount > balance + 0.009) {
      throw new Error(
        `مبلغ السند (${input.amount.toFixed(2)}) أكبر من رصيد الزبون المستحق (${balance.toFixed(2)})`
      )
    }
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      tenant_id: s.tenantId,
      type: input.type,
      party_id: input.partyId,
      cash_account_id: input.cashAccountId,
      date: input.date,
      amount: input.amount,
      method: input.method,
      reference: input.reference ?? "",
      cheque_due_date: input.chequeDueDate ?? null,
      notes: input.notes ?? "",
      created_by: s.userId,
    })
    .select("*, parties(name), cash_accounts(name)").single()
  if (error) throw new Error(error.message)

  return rowToVoucher(data)
}

export async function cancelVoucherAction(id: string): Promise<void> {
  const s = await requirePermission("cancelDocument")
  const supabase = await createServerSupabase()

  const { data } = await supabase
    .from("payments").select("id").eq("id", id).eq("tenant_id", s.tenantId).maybeSingle()
  if (!data) throw new Error("السند غير موجود")

  const { error } = await supabase.rpc("cancel_payment", { p_payment: id })
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* تصنيفات المصروفات والإيرادات                                      */
/* ================================================================ */

export async function fetchExpenseCategoriesAction(
  kind?: ExpenseKind
): Promise<ExpenseCategory[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  let q = supabase
    .from("expense_categories")
    .select("*, accounts(code, name)")
    .eq("tenant_id", s.tenantId).order("name")
  if (kind) q = q.eq("kind", kind)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    kind: r.kind as ExpenseKind,
    accountId: r.account_id,
    accountName: r.accounts ? `${r.accounts.code} — ${r.accounts.name}` : "",
    isActive: r.is_active ?? true,
  }))
}

export async function addExpenseCategoryAction(input: {
  name: string
  kind: ExpenseKind
  accountId: string
}): Promise<ExpenseCategory> {
  const s = await requirePermission("manageSettings")
  if (!input.name?.trim()) throw new Error("اسم التصنيف مطلوب")
  if (!input.accountId)    throw new Error("يجب ربط التصنيف بحساب في دليل الحسابات")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("expense_categories")
    .insert({
      tenant_id: s.tenantId,
      name: input.name.trim(),
      kind: input.kind,
      account_id: input.accountId,
    })
    .select("*, accounts(code, name)").single()

  if (error) {
    if (error.code === "23505") throw new Error("يوجد تصنيف بنفس الاسم")
    throw new Error(error.message)
  }

  return {
    id: data.id, tenantId: data.tenant_id, name: data.name,
    kind: data.kind, accountId: data.account_id,
    accountName: data.accounts ? `${data.accounts.code} — ${data.accounts.name}` : "",
    isActive: data.is_active,
  }
}

export async function updateExpenseCategoryAction(
  id: string,
  patch: { name?: string; accountId?: string; isActive?: boolean }
): Promise<void> {
  const s = await requirePermission("manageSettings")
  const supabase = await createServerSupabase()

  const db: Record<string, unknown> = {}
  if (patch.name !== undefined)      db.name = patch.name.trim()
  if (patch.accountId !== undefined) db.account_id = patch.accountId
  if (patch.isActive !== undefined)  db.is_active = patch.isActive
  if (Object.keys(db).length === 0) return

  const { error } = await supabase
    .from("expense_categories").update(db).eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* المصروفات والإيرادات                                              */
/* ================================================================ */

function rowToExpense(r: any): Expense {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    voucherNo: r.voucher_no,
    kind: r.kind as ExpenseKind,
    categoryId: r.category_id,
    categoryName: r.expense_categories?.name ?? "",
    cashAccountId: r.cash_account_id,
    cashAccountName: r.cash_accounts?.name ?? "",
    partyId: r.party_id,
    partyName: r.parties?.name ?? "",
    date: r.date,
    amount: Number(r.amount ?? 0),
    taxAmount: Number(r.tax_amount ?? 0),
    total: Number(r.total ?? 0),
    description: r.description ?? "",
    status: r.status,
    createdAt: r.created_at ?? "",
  }
}

export async function fetchExpensesAction(opts?: {
  kind?: ExpenseKind
  categoryId?: string
  from?: string
  to?: string
  limit?: number
}): Promise<Expense[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  let q = supabase
    .from("expenses")
    .select("*, expense_categories(name), cash_accounts(name), parties(name)")
    .eq("tenant_id", s.tenantId)
    .order("date", { ascending: false })
    .limit(opts?.limit ?? 300)

  if (opts?.kind)       q = q.eq("kind", opts.kind)
  if (opts?.categoryId) q = q.eq("category_id", opts.categoryId)
  if (opts?.from)       q = q.gte("date", opts.from)
  if (opts?.to)         q = q.lte("date", opts.to)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToExpense)
}

export async function createExpenseAction(input: {
  kind: ExpenseKind
  categoryId: string
  cashAccountId: string
  partyId?: string | null
  date: string
  amount: number
  taxAmount?: number
  description?: string
}): Promise<Expense> {
  const s = await requirePermission("manageExpenses")

  if (!(input.amount > 0))  throw new Error("المبلغ يجب أن يكون أكبر من صفر")
  if (!input.categoryId)    throw new Error("يجب اختيار التصنيف")
  if (!input.cashAccountId) throw new Error("يجب تحديد الصندوق أو البنك")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      tenant_id: s.tenantId,
      kind: input.kind,
      category_id: input.categoryId,
      cash_account_id: input.cashAccountId,
      party_id: input.partyId ?? null,
      date: input.date,
      amount: input.amount,
      tax_amount: input.taxAmount ?? 0,
      description: input.description ?? "",
      created_by: s.userId,
    })
    .select("*, expense_categories(name), cash_accounts(name), parties(name)").single()
  if (error) throw new Error(error.message)

  return rowToExpense(data)
}

export async function cancelExpenseAction(id: string): Promise<void> {
  const s = await requirePermission("cancelDocument")
  const supabase = await createServerSupabase()

  const { data: exp } = await supabase
    .from("expenses").select("journal_entry_id, status")
    .eq("id", id).eq("tenant_id", s.tenantId).maybeSingle()
  if (!exp) throw new Error("السند غير موجود")
  if (exp.status === "cancelled") throw new Error("السند ملغى مسبقاً")

  if (exp.journal_entry_id) {
    const { error } = await supabase.rpc("reverse_journal", {
      p_entry: exp.journal_entry_id,
      p_date: new Date().toISOString().split("T")[0],
    })
    if (error) throw new Error(error.message)
  }

  const { error } = await supabase
    .from("expenses").update({ status: "cancelled" })
    .eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

/** ملخص المصروفات حسب التصنيف — لرسم المخطط الدائري */
export async function fetchExpenseSummaryAction(
  kind: ExpenseKind,
  from: string,
  to: string
): Promise<{ categoryName: string; total: number; count: number }[]> {
  await requirePermission("viewReports")
  const rows = await fetchExpensesAction({ kind, from, to, limit: 5000 })

  const map = new Map<string, { total: number; count: number }>()
  for (const e of rows) {
    if (e.status !== "confirmed") continue
    const cur = map.get(e.categoryName) ?? { total: 0, count: 0 }
    map.set(e.categoryName, { total: cur.total + e.total, count: cur.count + 1 })
  }

  return [...map.entries()]
    .map(([categoryName, v]) => ({ categoryName, ...v }))
    .sort((a, b) => b.total - a.total)
}
