"use server"

// ================================================================
// جهات التعامل — الزبائن والموردون
// ================================================================

import { createServerSupabase } from "@/lib/supabase/server"
import { requireTenant, requirePermission } from "@/lib/auth/guard"
import type { Party, PartyWithBalance, PartyKind, StatementRow } from "@/lib/types"

/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToParty(r: any): Party {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    code: r.code ?? "",
    name: r.name,
    kind: (r.kind as PartyKind) ?? "customer",
    phone: r.phone ?? "",
    email: r.email ?? "",
    address: r.address ?? "",
    taxNumber: r.tax_number ?? "",
    openingBalance: Number(r.opening_balance ?? 0),
    openingBalanceDate: r.opening_balance_date ?? null,
    creditLimit: Number(r.credit_limit ?? 0),
    paymentTermsDays: Number(r.payment_terms_days ?? 0),
    notes: r.notes ?? "",
    isActive: r.is_active ?? true,
    createdAt: r.created_at?.split("T")[0] ?? "",
  }
}

/** قائمة جهات التعامل مع أرصدتها المحسوبة من القيود */
export async function fetchPartiesAction(
  kind?: PartyKind | "all"
): Promise<PartyWithBalance[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const [partiesRes, balancesRes] = await Promise.all([
    supabase.from("parties").select("*").eq("tenant_id", s.tenantId).order("name"),
    supabase.from("v_party_balances").select("*").eq("tenant_id", s.tenantId),
  ])

  if (partiesRes.error) throw new Error(partiesRes.error.message)

  const balMap = new Map<string, { d: number; c: number; b: number }>(
    (balancesRes.data ?? []).map((b: any) => [
      b.party_id,
      { d: Number(b.total_debit ?? 0), c: Number(b.total_credit ?? 0), b: Number(b.balance ?? 0) },
    ])
  )

  let rows = (partiesRes.data ?? []).map((r: any) => {
    const bal = balMap.get(r.id) ?? { d: 0, c: 0, b: 0 }
    return { ...rowToParty(r), totalDebit: bal.d, totalCredit: bal.c, balance: bal.b }
  })

  if (kind && kind !== "all") {
    rows = rows.filter((p) => p.kind === kind || p.kind === "both")
  }
  return rows
}

export async function fetchPartyAction(id: string): Promise<PartyWithBalance | null> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from("parties").select("*")
    .eq("id", id).eq("tenant_id", s.tenantId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const { data: bal } = await supabase
    .from("v_party_balances").select("*").eq("party_id", id).maybeSingle()

  return {
    ...rowToParty(data),
    totalDebit: Number(bal?.total_debit ?? 0),
    totalCredit: Number(bal?.total_credit ?? 0),
    balance: Number(bal?.balance ?? 0),
  }
}

export async function addPartyAction(input: {
  name: string
  kind: PartyKind
  phone?: string
  email?: string
  address?: string
  taxNumber?: string
  creditLimit?: number
  paymentTermsDays?: number
  notes?: string
  openingBalance?: number
  openingBalanceDate?: string
}): Promise<Party> {
  const s = await requireTenant()
  if (!input.name?.trim()) throw new Error("اسم جهة التعامل مطلوب")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("parties")
    .insert({
      tenant_id: s.tenantId,
      name: input.name.trim(),
      kind: input.kind,
      phone: input.phone ?? "",
      email: input.email ?? "",
      address: input.address ?? "",
      tax_number: input.taxNumber ?? "",
      credit_limit: input.creditLimit ?? 0,
      payment_terms_days: input.paymentTermsDays ?? 0,
      notes: input.notes ?? "",
    })
    .select("*").single()

  if (error) {
    if (error.code === "23505") throw new Error("يوجد جهة تعامل بنفس الاسم مسبقاً")
    throw new Error(error.message)
  }

  // الرصيد الافتتاحي يُسجَّل كقيد محاسبي حقيقي
  if (input.openingBalance && input.openingBalance !== 0) {
    await requirePermission("manageJournal")
    const { error: obError } = await supabase.rpc("post_party_opening_balance", {
      p_party: data.id,
      p_amount: input.openingBalance,
      p_date: input.openingBalanceDate ?? new Date().toISOString().split("T")[0],
      p_note: "",
    })
    if (obError) throw new Error(`تعذّر تسجيل الرصيد الافتتاحي: ${obError.message}`)
  }

  return rowToParty(data)
}

export async function updatePartyAction(
  id: string,
  patch: Partial<Omit<Party, "id" | "tenantId" | "code" | "createdAt" | "openingBalance">>
): Promise<void> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const db: Record<string, unknown> = {}
  if (patch.name !== undefined)             db.name = patch.name.trim()
  if (patch.kind !== undefined)             db.kind = patch.kind
  if (patch.phone !== undefined)            db.phone = patch.phone
  if (patch.email !== undefined)            db.email = patch.email
  if (patch.address !== undefined)          db.address = patch.address
  if (patch.taxNumber !== undefined)        db.tax_number = patch.taxNumber
  if (patch.creditLimit !== undefined)      db.credit_limit = patch.creditLimit
  if (patch.paymentTermsDays !== undefined) db.payment_terms_days = patch.paymentTermsDays
  if (patch.notes !== undefined)            db.notes = patch.notes
  if (patch.isActive !== undefined)         db.is_active = patch.isActive
  if (Object.keys(db).length === 0) return

  const { error } = await supabase
    .from("parties").update(db).eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

/**
 * لا نحذف جهة تعامل لها حركة — نعطّلها.
 * حذفها فعلياً يكسر تاريخ الحسابات ويجعل القيود بلا طرف.
 */
export async function deletePartyAction(id: string): Promise<{ deactivated: boolean }> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { count } = await supabase
    .from("journal_lines").select("id", { count: "exact", head: true })
    .eq("party_id", id).eq("tenant_id", s.tenantId)

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("parties").update({ is_active: false })
      .eq("id", id).eq("tenant_id", s.tenantId)
    if (error) throw new Error(error.message)
    return { deactivated: true }
  }

  const { error } = await supabase
    .from("parties").delete().eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
  return { deactivated: false }
}

/** تعديل الرصيد الافتتاحي — يعكس القيد القديم ويسجّل واحداً جديداً */
export async function setPartyOpeningBalanceAction(
  partyId: string,
  amount: number,
  date: string,
  note = ""
): Promise<void> {
  const s = await requirePermission("manageJournal")
  const supabase = await createServerSupabase()

  const { data: existing } = await supabase
    .from("journal_entries").select("id")
    .eq("tenant_id", s.tenantId)
    .eq("source_type", "opening_party").eq("source_id", partyId)
    .eq("is_reversal", false)

  for (const e of existing ?? []) {
    await supabase.rpc("reverse_journal", { p_entry: e.id, p_date: date })
  }

  const { error } = await supabase.rpc("post_party_opening_balance", {
    p_party: partyId, p_amount: amount, p_date: date, p_note: note,
  })
  if (error) throw new Error(error.message)
}

/** كشف الحساب التفصيلي مع الأرصدة المتراكمة */
export async function fetchPartyStatementAction(
  partyId: string,
  from: string,
  to: string
): Promise<StatementRow[]> {
  await requirePermission("viewReports")
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc("party_statement", {
    p_party: partyId, p_from: from, p_to: to,
  })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    date: r.entry_date,
    docNo: r.doc_no ?? "",
    docType: r.doc_type ?? "",
    description: r.description ?? "",
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    runningBalance: Number(r.running_balance ?? 0),
  }))
}

/** فواتير جهة تعامل معيّنة */
export async function fetchPartyInvoicesAction(partyId: string) {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_no, type, date, due_date, payment_method, total, status")
    .eq("tenant_id", s.tenantId).eq("party_id", partyId)
    .order("date", { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    id: r.id,
    invoiceNo: r.invoice_no,
    type: r.type,
    date: r.date,
    dueDate: r.due_date,
    paymentMethod: r.payment_method,
    total: Number(r.total ?? 0),
    status: r.status,
  }))
}

/** بحث سريع للاقتراح التلقائي أثناء كتابة الفاتورة */
export async function searchPartiesAction(
  term: string,
  kind?: PartyKind
): Promise<Party[]> {
  const s = await requireTenant()
  if (!term.trim()) return []

  const supabase = await createServerSupabase()
  let q = supabase
    .from("parties").select("*")
    .eq("tenant_id", s.tenantId).eq("is_active", true)
    .or(`name.ilike.%${term}%,phone.ilike.%${term}%,code.ilike.%${term}%`)
    .limit(10)

  if (kind) q = q.in("kind", [kind, "both"])

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToParty)
}
