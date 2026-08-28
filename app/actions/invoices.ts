"use server"

// ================================================================
// الفواتير — بيع، شراء، ومرتجعات
// ================================================================
// كل فاتورة تُنشأ كمسودّة أولاً، ثم تُؤكَّد.
// التأكيد هو ما يحرّك المخزون ويولّد القيد المحاسبي — عملية واحدة ذرّية
// داخل قاعدة البيانات، فلا يمكن أن يتحرك المخزون بلا قيد أو العكس.

import { createServerSupabase } from "@/lib/supabase/server"
import { requireTenant, requirePermission } from "@/lib/auth/guard"
import type {
  Invoice, InvoiceLine, InvoiceWithLines, InvoiceDraft,
  InvoiceType, InvoiceStatus, PaymentMethod, UnitCode,
} from "@/lib/types"

/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToInvoice(r: any): Invoice {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    invoiceNo: r.invoice_no,
    type: r.type as InvoiceType,
    partyId: r.party_id,
    partyName: r.parties?.name ?? "",
    date: r.date,
    dueDate: r.due_date,
    paymentMethod: r.payment_method as PaymentMethod,
    cashAccountId: r.cash_account_id,
    originInvoiceId: r.origin_invoice_id,
    subtotal: Number(r.subtotal ?? 0),
    discountAmount: Number(r.discount_amount ?? 0),
    taxAmount: Number(r.tax_amount ?? 0),
    total: Number(r.total ?? 0),
    costTotal: Number(r.cost_total ?? 0),
    paidAmount: Number(r.paid_amount ?? 0),
    status: r.status as InvoiceStatus,
    journalEntryId: r.journal_entry_id,
    notes: r.notes ?? "",
    reference: r.reference ?? "",
    createdBy: r.created_by ?? "",
    createdAt: r.created_at ?? "",
    cancelReason: r.cancel_reason ?? "",
  }
}

function rowToLine(r: any): InvoiceLine {
  return {
    id: r.id,
    invoiceId: r.invoice_id,
    productId: r.product_id,
    itemName: r.item_name,
    sku: r.sku ?? "",
    unit: (r.unit as UnitCode) ?? "pcs",
    quantity: Number(r.quantity ?? 0),
    unitPrice: Number(r.unit_price ?? 0),
    discountPercent: Number(r.discount_percent ?? 0),
    discountAmount: Number(r.discount_amount ?? 0),
    taxPercent: Number(r.tax_percent ?? 0),
    taxAmount: Number(r.tax_amount ?? 0),
    lineSubtotal: Number(r.line_subtotal ?? 0),
    lineTotal: Number(r.line_total ?? 0),
    unitCost: Number(r.unit_cost ?? 0),
    lineNo: Number(r.line_no ?? 1),
  }
}

/* ── القراءة ─────────────────────────────────────────────────── */

export async function fetchInvoicesAction(opts?: {
  type?: InvoiceType
  status?: InvoiceStatus
  partyId?: string
  from?: string
  to?: string
  search?: string
  limit?: number
}): Promise<Invoice[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  let q = supabase
    .from("invoices")
    .select("*, parties(name)")
    .eq("tenant_id", s.tenantId)
    .order("date", { ascending: false })
    .order("invoice_no", { ascending: false })
    .limit(opts?.limit ?? 300)

  if (opts?.type)     q = q.eq("type", opts.type)
  if (opts?.status)   q = q.eq("status", opts.status)
  if (opts?.partyId)  q = q.eq("party_id", opts.partyId)
  if (opts?.from)     q = q.gte("date", opts.from)
  if (opts?.to)       q = q.lte("date", opts.to)
  if (opts?.search)   q = q.or(`invoice_no.ilike.%${opts.search}%,reference.ilike.%${opts.search}%`)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToInvoice)
}

export async function fetchInvoiceAction(id: string): Promise<InvoiceWithLines | null> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from("invoices").select("*, parties(name)")
    .eq("id", id).eq("tenant_id", s.tenantId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const { data: lines, error: linesError } = await supabase
    .from("invoice_lines").select("*")
    .eq("invoice_id", id).order("line_no")
  if (linesError) throw new Error(linesError.message)

  return { ...rowToInvoice(data), lines: (lines ?? []).map(rowToLine) }
}

/* ── الإنشاء والتأكيد ────────────────────────────────────────── */

/**
 * ينشئ الفاتورة وأسطرها ثم يؤكّدها في مسار واحد.
 * لو فشل التأكيد (كمية غير كافية مثلاً) تُحذف المسودّة ولا يبقى أثر.
 */
export async function createInvoiceAction(
  draft: InvoiceDraft,
  confirm = true
): Promise<InvoiceWithLines> {
  const perm = draft.type === "sale" || draft.type === "sale_return"
    ? "createSale" as const
    : "createPurchase" as const
  const s = await requirePermission(perm)
  const supabase = await createServerSupabase()

  /* ── التحقق قبل أي كتابة ── */
  if (!draft.lines?.length) throw new Error("لا يمكن إنشاء فاتورة بلا أصناف")
  if (draft.paymentMethod === "credit" && !draft.partyId) {
    throw new Error("الفاتورة الآجلة تتطلب تحديد الزبون أو المورد")
  }
  for (const [i, ln] of draft.lines.entries()) {
    if (!ln.itemName?.trim()) throw new Error(`السطر ${i + 1}: اسم الصنف مطلوب`)
    if (!(ln.quantity > 0))   throw new Error(`السطر ${i + 1}: الكمية يجب أن تكون أكبر من صفر`)
    if (ln.unitPrice < 0)     throw new Error(`السطر ${i + 1}: السعر غير صالح`)
    if ((ln.discountPercent ?? 0) < 0 || (ln.discountPercent ?? 0) > 100) {
      throw new Error(`السطر ${i + 1}: نسبة الخصم يجب أن تكون بين 0 و 100`)
    }
  }

  // فحص سقف الائتمان قبل البيع الآجل
  if (draft.paymentMethod === "credit" && draft.partyId && draft.type === "sale") {
    await assertCreditLimit(draft, s.tenantId)
  }

  /* ── إنشاء رأس الفاتورة ── */
  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      tenant_id: s.tenantId,
      type: draft.type,
      party_id: draft.partyId,
      date: draft.date,
      due_date: draft.dueDate ?? null,
      payment_method: draft.paymentMethod,
      cash_account_id: draft.cashAccountId ?? null,
      origin_invoice_id: draft.originInvoiceId ?? null,
      notes: draft.notes ?? "",
      reference: draft.reference ?? "",
      created_by: s.userId,
    })
    .select("*").single()
  if (error) throw new Error(error.message)

  /* ── الأسطر ── */
  const lineRows = draft.lines.map((ln, i) => ({
    invoice_id: inv.id,
    tenant_id: s.tenantId,
    product_id: ln.productId,
    item_name: ln.itemName.trim(),
    sku: ln.sku ?? "",
    unit: ln.unit,
    quantity: ln.quantity,
    unit_price: ln.unitPrice,
    discount_percent: ln.discountPercent ?? 0,
    tax_percent: ln.taxPercent ?? 0,
    line_no: i + 1,
  }))

  const { error: linesError } = await supabase.from("invoice_lines").insert(lineRows)
  if (linesError) {
    await supabase.from("invoices").delete().eq("id", inv.id)
    throw new Error(linesError.message)
  }

  /* ── التأكيد ── */
  if (confirm) {
    const { error: confirmError } = await supabase.rpc("confirm_invoice", { p_invoice: inv.id })
    if (confirmError) {
      // المسودّة لم تحرّك شيئاً بعد، فحذفها آمن ونظيف
      await supabase.from("invoices").delete().eq("id", inv.id)
      throw new Error(confirmError.message)
    }
  }

  const result = await fetchInvoiceAction(inv.id)
  if (!result) throw new Error("تعذّر قراءة الفاتورة بعد الإنشاء")
  return result
}

export async function confirmInvoiceAction(id: string): Promise<void> {
  await requireTenant()
  const supabase = await createServerSupabase()
  const { error } = await supabase.rpc("confirm_invoice", { p_invoice: id })
  if (error) throw new Error(error.message)
}

/** الإلغاء بقيد عكسي — الفاتورة تبقى في السجل ولا تُحذف أبداً */
export async function cancelInvoiceAction(id: string, reason: string): Promise<void> {
  const s = await requirePermission("cancelDocument")
  if (!reason?.trim()) throw new Error("سبب الإلغاء مطلوب")

  const supabase = await createServerSupabase()
  const { data: inv } = await supabase
    .from("invoices").select("id").eq("id", id).eq("tenant_id", s.tenantId).maybeSingle()
  if (!inv) throw new Error("الفاتورة غير موجودة")

  const { error } = await supabase.rpc("cancel_invoice", {
    p_invoice: id, p_reason: reason.trim(),
  })
  if (error) throw new Error(error.message)
}

/** إنشاء مرتجع مبني على فاتورة أصلية */
export async function createReturnAction(
  originInvoiceId: string,
  lines: { lineId: string; quantity: number }[],
  date: string,
  reason = ""
): Promise<InvoiceWithLines> {
  await requirePermission("cancelDocument")

  const origin = await fetchInvoiceAction(originInvoiceId)
  if (!origin) throw new Error("الفاتورة الأصلية غير موجودة")
  if (origin.status !== "confirmed") throw new Error("لا يمكن إرجاع فاتورة غير مؤكّدة")

  const returnType: InvoiceType =
    origin.type === "sale" ? "sale_return"
    : origin.type === "purchase" ? "purchase_return"
    : (() => { throw new Error("لا يمكن إرجاع فاتورة مرتجع") })()

  const alreadyReturned = await returnedQuantities(originInvoiceId)

  const draftLines = lines.map(({ lineId, quantity }) => {
    const src = origin.lines.find((l) => l.id === lineId)
    if (!src) throw new Error("سطر غير موجود في الفاتورة الأصلية")

    const remaining = src.quantity - (alreadyReturned.get(src.sku || src.itemName) ?? 0)
    if (quantity > remaining + 0.0001) {
      throw new Error(
        `الكمية المرتجعة من "${src.itemName}" (${quantity}) أكبر من المتبقي (${remaining})`
      )
    }
    return {
      productId: src.productId,
      itemName: src.itemName,
      sku: src.sku,
      unit: src.unit,
      quantity,
      unitPrice: src.unitPrice,
      discountPercent: src.discountPercent,
      taxPercent: src.taxPercent,
    }
  })

  return createInvoiceAction({
    type: returnType,
    partyId: origin.partyId,
    date,
    paymentMethod: origin.paymentMethod,
    cashAccountId: origin.cashAccountId,
    originInvoiceId,
    notes: reason,
    reference: origin.invoiceNo,
    lines: draftLines,
  })
}

/* ── مساعدات داخلية ──────────────────────────────────────────── */

/** الكميات المرتجعة سابقاً من فاتورة، حتى لا يُرجَّع أكثر من المُباع */
async function returnedQuantities(originInvoiceId: string): Promise<Map<string, number>> {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("invoices")
    .select("id, status, invoice_lines(sku, item_name, quantity)")
    .eq("origin_invoice_id", originInvoiceId)
    .eq("status", "confirmed")

  const map = new Map<string, number>()
  for (const inv of data ?? []) {
    for (const ln of (inv as any).invoice_lines ?? []) {
      const key = ln.sku || ln.item_name
      map.set(key, (map.get(key) ?? 0) + Number(ln.quantity ?? 0))
    }
  }
  return map
}

/** يمنع تجاوز سقف الائتمان المحدد للزبون */
async function assertCreditLimit(draft: InvoiceDraft, tenantId: string): Promise<void> {
  const supabase = await createServerSupabase()

  const { data: party } = await supabase
    .from("parties").select("name, credit_limit")
    .eq("id", draft.partyId!).eq("tenant_id", tenantId).maybeSingle()

  const limit = Number(party?.credit_limit ?? 0)
  if (limit <= 0) return   // صفر = بلا سقف

  const { data: bal } = await supabase
    .from("v_party_balances").select("balance").eq("party_id", draft.partyId!).maybeSingle()

  const current = Number(bal?.balance ?? 0)
  const invoiceTotal = draft.lines.reduce((sum, ln) => {
    const gross = ln.quantity * ln.unitPrice
    const net = gross - gross * ((ln.discountPercent ?? 0) / 100)
    return sum + net + net * ((ln.taxPercent ?? 0) / 100)
  }, 0)

  if (current + invoiceTotal > limit) {
    throw new Error(
      `تجاوز سقف الائتمان للزبون "${party?.name}": ` +
      `الرصيد الحالي ${current.toFixed(2)} + الفاتورة ${invoiceTotal.toFixed(2)} ` +
      `يتجاوز السقف ${limit.toFixed(2)}`
    )
  }
}

/* ── بيانات الطباعة ──────────────────────────────────────────── */

export async function fetchInvoiceForPrintAction(id: string) {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const [invoice, tenantRes] = await Promise.all([
    fetchInvoiceAction(id),
    supabase
      .from("tenants")
      .select("name, owner_name, phone, email, address, tax_number, logo_url, currency, vat_enabled, vat_rate")
      .eq("id", s.tenantId).single(),
  ])
  if (!invoice) throw new Error("الفاتورة غير موجودة")

  let party = null
  if (invoice.partyId) {
    const { data } = await supabase
      .from("parties").select("code, name, phone, address, tax_number")
      .eq("id", invoice.partyId).maybeSingle()
    party = data
  }

  return {
    invoice,
    party,
    company: {
      name: tenantRes.data?.name ?? "",
      ownerName: tenantRes.data?.owner_name ?? "",
      phone: tenantRes.data?.phone ?? "",
      email: tenantRes.data?.email ?? "",
      address: tenantRes.data?.address ?? "",
      taxNumber: tenantRes.data?.tax_number ?? "",
      logoUrl: tenantRes.data?.logo_url ?? "",
      currency: tenantRes.data?.currency ?? "ILS",
      vatEnabled: tenantRes.data?.vat_enabled ?? false,
      vatRate: Number(tenantRes.data?.vat_rate ?? 16),
    },
  }
}
