"use server"

// ================================================================
// إعدادات المستندات والطباعة والافتراضيات والترقيم
// ================================================================

import { createServerSupabase } from "@/lib/supabase/server"
import { requireTenant, requirePermission } from "@/lib/auth/guard"
import { DOC_TYPE_LABELS } from "@/lib/constants"

/* eslint-disable @typescript-eslint/no-explicit-any */

export type PaperSize = "a4" | "thermal80"

export interface PrintSettings {
  paperSize: PaperSize
  showSignatures: boolean
  showAmountInWords: boolean
  showLogo: boolean
  footerText: string
  termsText: string
  copies: number
}

export interface DefaultSettings {
  paymentMethod: "cash" | "card" | "credit"
  cashAccountId: string | null
  applyTaxOnNewProducts: boolean
  requirePartyOnSale: boolean
  allowNegativeStock: boolean
  decimals: number
}

export interface AlertSettings {
  lowStock: boolean
  overdueInvoices: boolean
  subscriptionExpiry: boolean
}

export interface TenantSettings {
  print: PrintSettings
  defaults: DefaultSettings
  alerts: AlertSettings
}

/** قيم افتراضية آمنة — تُستخدم لأي مفتاح ناقص بدل الانهيار */
const FALLBACK: TenantSettings = {
  print: {
    paperSize: "a4",
    showSignatures: true,
    showAmountInWords: true,
    showLogo: true,
    footerText: "",
    termsText: "",
    copies: 1,
  },
  defaults: {
    paymentMethod: "cash",
    cashAccountId: null,
    applyTaxOnNewProducts: true,
    requirePartyOnSale: false,
    allowNegativeStock: false,
    decimals: 2,
  },
  alerts: {
    lowStock: true,
    overdueInvoices: true,
    subscriptionExpiry: true,
  },
}

function merge(raw: any): TenantSettings {
  return {
    print:    { ...FALLBACK.print,    ...(raw?.print    ?? {}) },
    defaults: { ...FALLBACK.defaults, ...(raw?.defaults ?? {}) },
    alerts:   { ...FALLBACK.alerts,   ...(raw?.alerts   ?? {}) },
  }
}

export async function fetchTenantSettingsAction(): Promise<TenantSettings> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from("tenants").select("settings").eq("id", s.tenantId).maybeSingle()
  if (error) throw new Error(error.message)

  return merge(data?.settings)
}

/** تحديث قسم واحد — الدمج عميق في قاعدة البيانات فلا تُمسح المفاتيح الأخرى */
export async function updateTenantSettingsAction(
  patch: Partial<{
    print: Partial<PrintSettings>
    defaults: Partial<DefaultSettings>
    alerts: Partial<AlertSettings>
  }>
): Promise<TenantSettings> {
  const s = await requirePermission("manageSettings")

  if (patch.print?.copies !== undefined) {
    const c = patch.print.copies
    if (!Number.isInteger(c) || c < 1 || c > 5) {
      throw new Error("عدد النسخ يجب أن يكون بين 1 و 5")
    }
  }
  if (patch.defaults?.decimals !== undefined) {
    const d = patch.defaults.decimals
    if (!Number.isInteger(d) || d < 0 || d > 3) {
      throw new Error("عدد المنازل العشرية يجب أن يكون بين 0 و 3")
    }
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.rpc("update_tenant_settings", {
    p_tenant: s.tenantId,
    p_patch: patch,
  })
  if (error) throw new Error(error.message)

  return merge(data)
}

/* ================================================================ */
/* ترقيم المستندات                                                   */
/* ================================================================ */

export interface NumberSequence {
  docType: string
  label: string
  prefix: string
  nextNumber: number
  padding: number
  usedCount: number
  preview: string
}

export async function fetchNumberSequencesAction(): Promise<NumberSequence[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc("list_number_sequences", { p_tenant: s.tenantId })
  if (error) throw new Error(error.message)

  const rows = (data ?? []).map((r: any) => {
    const prefix = r.prefix ?? ""
    const padding = Number(r.padding ?? 6)
    const next = Number(r.next_number ?? 1)
    return {
      docType: r.doc_type,
      label: DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type,
      prefix,
      nextNumber: next,
      padding,
      usedCount: Number(r.used_count ?? 0),
      preview: prefix + String(next).padStart(padding, "0"),
    }
  })

  // الأنواع التي لم يصدر منها مستند بعد لا يوجد لها صف — نعرضها بقيمها الافتراضية
  const existing = new Set(rows.map((r: NumberSequence) => r.docType))
  const defaults: Record<string, string> = {
    sale_invoice: "INV-", purchase_invoice: "PUR-", sale_return: "SRT-",
    purchase_return: "PRT-", receipt: "RCV-", payment: "PAY-",
    expense: "EXP-", revenue: "REV-", journal: "JV-", party: "ACC-",
  }
  for (const [docType, prefix] of Object.entries(defaults)) {
    if (existing.has(docType)) continue
    rows.push({
      docType,
      label: DOC_TYPE_LABELS[docType] ?? docType,
      prefix,
      nextNumber: 1,
      padding: 6,
      usedCount: 0,
      preview: prefix + "000001",
    })
  }

  const order = Object.keys(DOC_TYPE_LABELS)
  return rows.sort(
    (a: NumberSequence, b: NumberSequence) =>
      order.indexOf(a.docType) - order.indexOf(b.docType)
  )
}

export async function updateNumberSequenceAction(input: {
  docType: string
  prefix: string
  nextNumber: number
  padding?: number
}): Promise<void> {
  const s = await requirePermission("manageSettings")

  if (!Number.isInteger(input.nextNumber) || input.nextNumber < 1) {
    throw new Error("رقم البداية يجب أن يكون 1 أو أكثر")
  }
  if (input.prefix.length > 10) {
    throw new Error("البادئة طويلة — الحد 10 أحرف")
  }
  if (/[\s/\\'"]/.test(input.prefix)) {
    throw new Error("البادئة لا يمكن أن تحتوي مسافات أو شرطات مائلة أو علامات اقتباس")
  }
  if (input.padding !== undefined && (input.padding < 1 || input.padding > 10)) {
    throw new Error("عدد الخانات يجب أن يكون بين 1 و 10")
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.rpc("update_number_sequence", {
    p_tenant: s.tenantId,
    p_doc: input.docType,
    p_prefix: input.prefix,
    p_next: input.nextNumber,
    p_padding: input.padding ?? null,
  })
  if (error) throw new Error(error.message)
}
