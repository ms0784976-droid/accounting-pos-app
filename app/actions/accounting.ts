"use server"

// ================================================================
// المحاسبة — دليل الحسابات وقيود اليومية
// ================================================================

import { createServerSupabase } from "@/lib/supabase/server"
import { requireTenant, requirePermission } from "@/lib/auth/guard"
import type {
  Account, AccountType,
  JournalEntry, JournalEntryWithLines, JournalLine, JournalDraft,
} from "@/lib/types"

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ================================================================ */
/* دليل الحسابات                                                     */
/* ================================================================ */

function rowToAccount(r: any): Account {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    code: r.code,
    name: r.name,
    type: r.type as AccountType,
    parentId: r.parent_id,
    systemKey: r.system_key,
    isGroup: r.is_group ?? false,
    isActive: r.is_active ?? true,
  }
}

export async function fetchAccountsAction(opts?: {
  type?: AccountType
  postableOnly?: boolean
}): Promise<Account[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  let q = supabase.from("accounts").select("*").eq("tenant_id", s.tenantId).order("code")
  if (opts?.type) q = q.eq("type", opts.type)
  if (opts?.postableOnly) q = q.eq("is_group", false).eq("is_active", true)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToAccount)
}

/** دليل الحسابات بشكل شجري جاهز للعرض */
export async function fetchAccountTreeAction(): Promise<
  (Account & { children: Account[]; balance: number })[]
> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const [accRes, balRes] = await Promise.all([
    supabase.from("accounts").select("*").eq("tenant_id", s.tenantId).order("code"),
    supabase.from("journal_lines").select("account_id, debit, credit").eq("tenant_id", s.tenantId),
  ])
  if (accRes.error) throw new Error(accRes.error.message)

  const balances = new Map<string, number>()
  for (const l of balRes.data ?? []) {
    const cur = balances.get((l as any).account_id) ?? 0
    balances.set((l as any).account_id, cur + Number((l as any).debit ?? 0) - Number((l as any).credit ?? 0))
  }

  const accounts = (accRes.data ?? []).map(rowToAccount)
  const groups = accounts.filter((a) => a.isGroup)
  const leaves = accounts.filter((a) => !a.isGroup)

  const tree = groups.map((g) => {
    const children = leaves.filter((l) => l.parentId === g.id)
    const balance = children.reduce((sum, c) => sum + (balances.get(c.id) ?? 0), 0)
    return { ...g, children, balance }
  })

  // حسابات لا أب لها — نعرضها كي لا تختفي
  const orphans = leaves.filter((l) => !l.parentId)
  if (orphans.length) {
    tree.push({
      id: "__orphans__", tenantId: s.tenantId, code: "9999",
      name: "حسابات غير مصنّفة", type: "asset", parentId: null,
      systemKey: null, isGroup: true, isActive: true,
      children: orphans,
      balance: orphans.reduce((sum, c) => sum + (balances.get(c.id) ?? 0), 0),
    })
  }

  return tree
}

export async function addAccountAction(input: {
  code: string
  name: string
  type: AccountType
  parentId?: string | null
}): Promise<Account> {
  const s = await requirePermission("manageJournal")
  if (!input.code?.trim()) throw new Error("رقم الحساب مطلوب")
  if (!input.name?.trim()) throw new Error("اسم الحساب مطلوب")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      tenant_id: s.tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      type: input.type,
      parent_id: input.parentId ?? null,
      is_group: false,
    })
    .select("*").single()

  if (error) {
    if (error.code === "23505") throw new Error("رقم الحساب مستخدم مسبقاً")
    throw new Error(error.message)
  }
  return rowToAccount(data)
}

export async function updateAccountAction(
  id: string,
  patch: { name?: string; parentId?: string | null; isActive?: boolean }
): Promise<void> {
  const s = await requirePermission("manageJournal")
  const supabase = await createServerSupabase()

  // الحسابات النظامية لا يُغيَّر ربطها — الأتمتة تعتمد عليها
  const { data: acc } = await supabase
    .from("accounts").select("system_key")
    .eq("id", id).eq("tenant_id", s.tenantId).maybeSingle()
  if (!acc) throw new Error("الحساب غير موجود")
  if (acc.system_key && patch.isActive === false) {
    throw new Error("لا يمكن تعطيل حساب نظامي يعتمد عليه الترحيل التلقائي")
  }

  const db: Record<string, unknown> = {}
  if (patch.name !== undefined)     db.name = patch.name.trim()
  if (patch.parentId !== undefined) db.parent_id = patch.parentId
  if (patch.isActive !== undefined) db.is_active = patch.isActive
  if (Object.keys(db).length === 0) return

  const { error } = await supabase
    .from("accounts").update(db).eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

export async function deleteAccountAction(id: string): Promise<void> {
  const s = await requirePermission("manageJournal")
  const supabase = await createServerSupabase()

  const { data: acc } = await supabase
    .from("accounts").select("system_key, name")
    .eq("id", id).eq("tenant_id", s.tenantId).maybeSingle()
  if (!acc) throw new Error("الحساب غير موجود")
  if (acc.system_key) throw new Error("لا يمكن حذف حساب نظامي")

  const { count } = await supabase
    .from("journal_lines").select("id", { count: "exact", head: true }).eq("account_id", id)
  if ((count ?? 0) > 0) {
    throw new Error(`الحساب "${acc.name}" عليه حركات محاسبية — يمكنك تعطيله بدل حذفه`)
  }

  const { error } = await supabase
    .from("accounts").delete().eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* قيود اليومية                                                      */
/* ================================================================ */

function rowToEntry(r: any): JournalEntry {
  const lines = (r.journal_lines ?? []) as any[]
  return {
    id: r.id,
    tenantId: r.tenant_id,
    entryNo: r.entry_no,
    date: r.date,
    description: r.description ?? "",
    sourceType: r.source_type ?? "manual",
    sourceId: r.source_id,
    isReversal: r.is_reversal ?? false,
    reversesId: r.reverses_id,
    totalDebit: lines.reduce((s, l) => s + Number(l.debit ?? 0), 0),
    totalCredit: lines.reduce((s, l) => s + Number(l.credit ?? 0), 0),
    createdAt: r.created_at ?? "",
  }
}

function rowToJournalLine(r: any): JournalLine {
  return {
    id: r.id,
    entryId: r.entry_id,
    accountId: r.account_id,
    accountCode: r.accounts?.code ?? "",
    accountName: r.accounts?.name ?? "",
    partyId: r.party_id,
    partyName: r.parties?.name ?? "",
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    description: r.description ?? "",
    lineNo: Number(r.line_no ?? 1),
  }
}

export async function fetchJournalEntriesAction(opts?: {
  from?: string
  to?: string
  sourceType?: string
  search?: string
  limit?: number
}): Promise<JournalEntry[]> {
  await requirePermission("viewReports")
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  let q = supabase
    .from("journal_entries")
    .select("*, journal_lines(debit, credit)")
    .eq("tenant_id", s.tenantId)
    .order("date", { ascending: false })
    .order("entry_no", { ascending: false })
    .limit(opts?.limit ?? 200)

  if (opts?.from)       q = q.gte("date", opts.from)
  if (opts?.to)         q = q.lte("date", opts.to)
  if (opts?.sourceType) q = q.eq("source_type", opts.sourceType)
  if (opts?.search)     q = q.or(`entry_no.ilike.%${opts.search}%,description.ilike.%${opts.search}%`)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToEntry)
}

export async function fetchJournalEntryAction(
  id: string
): Promise<JournalEntryWithLines | null> {
  await requirePermission("viewReports")
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from("journal_entries").select("*, journal_lines(debit, credit)")
    .eq("id", id).eq("tenant_id", s.tenantId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const { data: lines, error: linesError } = await supabase
    .from("journal_lines")
    .select("*, accounts(code, name), parties(name)")
    .eq("entry_id", id).order("line_no")
  if (linesError) throw new Error(linesError.message)

  return { ...rowToEntry(data), lines: (lines ?? []).map(rowToJournalLine) }
}

/** قيد يدوي — التوازن مفروض في قاعدة البيانات، ونتحقق هنا أيضاً لرسالة أوضح */
export async function createJournalEntryAction(draft: JournalDraft): Promise<string> {
  const s = await requirePermission("manageJournal")

  if (!draft.lines?.length || draft.lines.length < 2) {
    throw new Error("القيد يحتاج سطرين على الأقل")
  }

  const round2 = (n: number) => Math.round(n * 100) / 100
  const totalDebit  = round2(draft.lines.reduce((sum, l) => sum + (l.debit || 0), 0))
  const totalCredit = round2(draft.lines.reduce((sum, l) => sum + (l.credit || 0), 0))

  if (totalDebit === 0) throw new Error("لا يمكن حفظ قيد بقيمة صفر")
  if (totalDebit !== totalCredit) {
    throw new Error(
      `القيد غير متوازن: مجموع المدين ${totalDebit.toFixed(2)} ≠ مجموع الدائن ${totalCredit.toFixed(2)}`
    )
  }
  for (const [i, l] of draft.lines.entries()) {
    if ((l.debit || 0) > 0 && (l.credit || 0) > 0) {
      throw new Error(`السطر ${i + 1}: لا يمكن أن يكون مديناً ودائناً في آن واحد`)
    }
    if (!l.accountId) throw new Error(`السطر ${i + 1}: يجب اختيار الحساب`)
  }

  const supabase = await createServerSupabase()
  const payload = draft.lines
    .filter((l) => (l.debit || 0) > 0 || (l.credit || 0) > 0)
    .map((l) => ({
      account_id: l.accountId,
      party: l.partyId ?? null,
      debit: l.debit || 0,
      credit: l.credit || 0,
      desc: l.description ?? "",
    }))

  const { data, error } = await supabase.rpc("post_journal", {
    p_tenant: s.tenantId,
    p_date: draft.date,
    p_desc: draft.description || "قيد يدوي",
    p_source_type: "manual",
    p_source_id: null,
    p_lines: payload,
  })
  if (error) throw new Error(error.message)
  return data as string
}

/** القيود لا تُحذف — تُعكس بقيد مضاد */
export async function reverseJournalEntryAction(
  entryId: string,
  date: string
): Promise<string> {
  const s = await requirePermission("manageJournal")
  const supabase = await createServerSupabase()

  const { data: entry } = await supabase
    .from("journal_entries").select("id, source_type, is_reversal")
    .eq("id", entryId).eq("tenant_id", s.tenantId).maybeSingle()
  if (!entry) throw new Error("القيد غير موجود")
  if (entry.is_reversal) throw new Error("لا يمكن عكس قيد عكسي")
  if (entry.source_type !== "manual") {
    throw new Error("هذا القيد مولَّد من مستند — ألغِ المستند نفسه بدل عكس القيد")
  }

  const { data, error } = await supabase.rpc("reverse_journal", {
    p_entry: entryId, p_date: date,
  })
  if (error) throw new Error(error.message)
  return data as string
}

/** حركة حساب معيّن — دفتر الأستاذ الحقيقي */
export async function fetchAccountLedgerAction(
  accountId: string,
  from: string,
  to: string
): Promise<{ opening: number; rows: (JournalLine & { date: string; entryNo: string; running: number })[] }> {
  await requirePermission("viewReports")
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data: prior } = await supabase
    .from("journal_lines")
    .select("debit, credit, journal_entries!inner(date)")
    .eq("tenant_id", s.tenantId).eq("account_id", accountId)
    .lt("journal_entries.date", from)

  const opening = (prior ?? []).reduce(
    (sum, l: any) => sum + Number(l.debit ?? 0) - Number(l.credit ?? 0), 0
  )

  const { data, error } = await supabase
    .from("journal_lines")
    .select("*, accounts(code, name), parties(name), journal_entries!inner(date, entry_no)")
    .eq("tenant_id", s.tenantId).eq("account_id", accountId)
    .gte("journal_entries.date", from).lte("journal_entries.date", to)
    .order("date", { referencedTable: "journal_entries", ascending: true })
  if (error) throw new Error(error.message)

  let running = opening
  const rows = (data ?? []).map((r: any) => {
    running += Number(r.debit ?? 0) - Number(r.credit ?? 0)
    return {
      ...rowToJournalLine(r),
      date: r.journal_entries?.date ?? "",
      entryNo: r.journal_entries?.entry_no ?? "",
      running,
    }
  })

  return { opening, rows }
}
