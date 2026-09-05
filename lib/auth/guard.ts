import "server-only"

/**
 * lib/auth/guard.ts — طبقة الحراسة على السيرفر
 * ================================================================
 * القاعدة الذهبية: لا تثق أبداً بـ tenantId قادم من المتصفح.
 *
 * Server Actions في Next.js هي endpoints عامة يمكن استدعاؤها من أي جهة.
 * كل دالة تلمس بيانات شركة يجب أن تمرّ من هنا أولاً.
 */

import { cache } from "react"
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server"
import type { ClientRole } from "@/lib/types"

export type Session = {
  userId: string
  email: string
  systemRole: "owner" | "client"
  tenantId: string | null
  role: ClientRole | null
}

/**
 * يقرأ الجلسة الموثوقة من الكوكيز — لا يقبل أي مُدخل من العميل.
 *
 * ⚡ تسريع بلا أي تغيير في المنطق أو الأمان:
 *
 * 1) كانت تنفّذ 4 رحلات شبكة *متتابعة*، كل واحدة تنتظر السابقة:
 *      getUser() → profiles → tenants → tenant_users
 *    صارت رحلتين: getUser() ثم الثلاثة الباقية معاً بـ Promise.all.
 *    آمن تماماً لأن الاستعلامات الثلاثة كلها تعتمد على user.id فقط،
 *    ولا يعتمد أيٌّ منها على نتيجة الآخر.
 *
 * 2) ترتيب الأولوية محفوظ حرفياً كما كان: مشرف المنصة أولاً، ثم
 *    صاحب الشركة، ثم الموظف — نقرأ الثلاثة معاً ونقرّر بعدها.
 *
 * 3) cache() من React تمنع تكرار الفحص داخل الطلب الواحد: أي عدد من
 *    استدعاءات requireTenant/requirePermission في نفس الطلب تنفّذه مرة.
 */
export const getSession = cache(async function getSession(): Promise<Session | null> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  const userId = data.user.id
  const email = data.user.email ?? ""
  const admin = createServiceClient()

  const [profileRes, ownTenantRes, memberRes] = await Promise.all([
    admin.from("profiles").select("system_role").eq("id", userId).maybeSingle(),
    admin.from("tenants").select("id, status").eq("auth_user_id", userId).maybeSingle(),
    admin
      .from("tenant_users")
      .select("tenant_id, role, status, tenants(status)")
      .eq("auth_user_id", userId)
      .maybeSingle(),
  ])

  const systemRole = (profileRes.data?.system_role as "owner" | "client") ?? "client"

  if (systemRole === "owner") {
    return { userId, email, systemRole: "owner", tenantId: null, role: null }
  }

  // صاحب الشركة نفسه
  const ownTenant = ownTenantRes.data
  if (ownTenant) {
    if (ownTenant.status === "frozen") return null
    return { userId, email, systemRole: "client", tenantId: ownTenant.id, role: "admin" }
  }

  // موظف داخل شركة
  const member = memberRes.data
  if (!member) return null
  const tenantStatus = (member as unknown as { tenants?: { status?: string } }).tenants?.status
  if (member.status !== "active" || tenantStatus === "frozen") return null

  return {
    userId,
    email,
    systemRole: "client",
    tenantId: member.tenant_id as string,
    role: member.role as ClientRole,
  }
})

/** يتطلب جلسة صالحة */
export async function requireSession(): Promise<Session> {
  const s = await getSession()
  if (!s) throw new Error("غير مصرّح: الرجاء تسجيل الدخول")
  return s
}

/** يتطلب أن يكون المستدعي مشرف المنصة */
export async function requireOwner(): Promise<Session> {
  const s = await requireSession()
  if (s.systemRole !== "owner") throw new Error("غير مصرّح: هذا الإجراء لمشرف المنصة فقط")
  return s
}

/**
 * يرجّع tenantId الموثوق من الجلسة.
 * إذا مرّر المشرف tenantId صراحةً نسمح له (لأغراض الدعم الفني فقط).
 */
export async function requireTenant(explicitTenantId?: string): Promise<Session & { tenantId: string }> {
  const s = await requireSession()

  if (s.systemRole === "owner") {
    if (!explicitTenantId) throw new Error("يجب تحديد الشركة")
    return { ...s, tenantId: explicitTenantId }
  }

  if (!s.tenantId) throw new Error("حسابك غير مرتبط بأي شركة")

  // إذا حاول العميل تمرير شركة غير شركته → رفض صريح
  if (explicitTenantId && explicitTenantId !== s.tenantId) {
    throw new Error("غير مصرّح: محاولة الوصول لبيانات شركة أخرى")
  }

  return { ...s, tenantId: s.tenantId }
}

/** صلاحيات الأدوار داخل الشركة — مصدر الحقيقة الوحيد (وليس الواجهة) */
export const PERMISSIONS = {
  viewFinancials: ["admin", "accountant"],
  manageUsers:    ["admin"],
  manageSettings: ["admin"],
  editCosts:      ["admin", "accountant", "inventory"],
  createSale:     ["admin", "accountant", "cashier"],
  createPurchase: ["admin", "accountant", "inventory"],
  managePayments: ["admin", "accountant"],
  manageExpenses: ["admin", "accountant"],
  manageJournal:  ["admin", "accountant"],
  cancelDocument: ["admin", "accountant"],
  manageProducts: ["admin", "accountant", "inventory"],
  viewReports:    ["admin", "accountant"],
  manageBackup:   ["admin"],
} as const satisfies Record<string, readonly ClientRole[]>

export type Permission = keyof typeof PERMISSIONS

/** يتطلب صلاحية معيّنة — يُفرض على السيرفر، لا يمكن تجاوزه من المتصفح */
export async function requirePermission(
  perm: Permission,
  explicitTenantId?: string
): Promise<Session & { tenantId: string }> {
  const s = await requireTenant(explicitTenantId)

  // المشرف يتجاوز صلاحيات الشركة (للدعم الفني)
  if (s.systemRole === "owner") return s

  const allowed = PERMISSIONS[perm] as readonly string[]
  if (!s.role || !allowed.includes(s.role)) {
    throw new Error("غير مصرّح: ليست لديك صلاحية لتنفيذ هذا الإجراء")
  }
  return s
}

/** يتحقق أن سجلاً معيّناً يخصّ شركة المستخدم قبل التعديل عليه */
export async function assertRecordInTenant(
  table: string,
  id: string,
  tenantId: string
): Promise<void> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from(table)
    .select("tenant_id")
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("السجل غير موجود")
  if (data.tenant_id !== tenantId) {
    throw new Error("غير مصرّح: هذا السجل يخصّ شركة أخرى")
  }
}

/** تاريخ اليوم بتوقيت الشركة — لا بتوقيت UTC ولا بتوقيت متصفح المستخدم */
export function todayInTimezone(timeZone = "Asia/Hebron"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}
