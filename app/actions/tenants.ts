"use server"

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server"
import type { Tenant, SubscriptionPlan, TenantStatus } from "@/lib/types"

/* ── نوع مساعد لبيانات صف tenant من Supabase ─────────────────── */
interface TenantRow {
  id: string
  name: string
  owner_name: string
  email: string
  phone: string
  plan: string
  status: string
  industry: string
  currency: string
  expires_at: string
  created_at: string
  auth_user_id: string | null
}

function rowToTenant(row: TenantRow): Tenant & { tempPassword?: string } {
  return {
    id: row.id,
    name: row.name,
    ownerName: row.owner_name,
    email: row.email,
    phone: row.phone,
    plan: row.plan as SubscriptionPlan,
    status: row.status as TenantStatus,
    industry: row.industry,
    currency: row.currency,
    expiresAt: row.expires_at,
    createdAt: row.created_at?.split("T")[0] ?? "",
  }
}

/* ------------------------------------------------------------------ */
/* fetchTenants                                                        */
/* ------------------------------------------------------------------ */
export async function fetchTenantsAction(): Promise<Tenant[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTenant)
}

/* ------------------------------------------------------------------ */
/* addTenant — ينشئ auth.user جديد ثم tenant مرتبط به               */
/* ------------------------------------------------------------------ */
export async function addTenantAction(input: {
  name: string
  ownerName: string
  email: string
  phone: string
  tempPassword: string
  plan: SubscriptionPlan
  status: TenantStatus
  industry: string
  currency: string
  expiresAt: string
}): Promise<{ tenant: Tenant; error?: string }> {
  // استخدام Service Role لإنشاء مستخدم بدون تسجيل دخول
  const adminClient = createServiceClient()

  // 1. إنشاء auth.user جديد للعميل
  const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.tempPassword || "Mohaseb@2026",
    email_confirm: true,
    user_metadata: {
      full_name: input.ownerName,
      username: input.ownerName.toLowerCase().replace(/\s+/g, "_"),
      system_role: "client",
    },
  })

  if (userError || !newUser.user) {
    return { tenant: {} as Tenant, error: `خطأ في إنشاء الحساب: ${userError?.message}` }
  }

  const authUserId = newUser.user.id

  // 2. تحديث الـ profile بـ username صحيح
  await adminClient.from("profiles").upsert({
    id: authUserId,
    username: input.ownerName.toLowerCase().replace(/\s+/g, "_"),
    full_name: input.ownerName,
    system_role: "client",
  })

  // 3. إنشاء سجل الـ tenant
  const supabase = await createServerSupabase()
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      name: input.name,
      owner_name: input.ownerName,
      email: input.email,
      phone: input.phone,
      plan: input.plan,
      status: input.status,
      industry: input.industry,
      currency: input.currency,
      expires_at: input.expiresAt,
      auth_user_id: authUserId,
    })
    .select("*")
    .single()

  if (tenantError || !tenant) {
    // تراجع: حذف المستخدم إذا فشل إنشاء الـ tenant
    await adminClient.auth.admin.deleteUser(authUserId)
    return { tenant: {} as Tenant, error: `خطأ في إنشاء الشركة: ${tenantError?.message}` }
  }

  return { tenant: rowToTenant(tenant as TenantRow) }
}

/* ------------------------------------------------------------------ */
/* updateTenant                                                        */
/* ------------------------------------------------------------------ */
export async function updateTenantAction(
  id: string,
  patch: Partial<{
    name: string
    ownerName: string
    email: string
    phone: string
    plan: string
    status: string
    industry: string
    currency: string
    expiresAt: string
  }>
): Promise<void> {
  const supabase = await createServerSupabase()
  const dbPatch: Record<string, unknown> = {}
  if (patch.name)       dbPatch.name       = patch.name
  if (patch.ownerName)  dbPatch.owner_name = patch.ownerName
  if (patch.email)      dbPatch.email      = patch.email
  if (patch.phone)      dbPatch.phone      = patch.phone
  if (patch.plan)       dbPatch.plan       = patch.plan
  if (patch.status)     dbPatch.status     = patch.status
  if (patch.industry)   dbPatch.industry   = patch.industry
  if (patch.currency)   dbPatch.currency   = patch.currency
  if (patch.expiresAt)  dbPatch.expires_at = patch.expiresAt

  const { error } = await supabase.from("tenants").update(dbPatch).eq("id", id)
  if (error) throw new Error(error.message)
}

/* ------------------------------------------------------------------ */
/* toggleTenantStatus                                                  */
/* ------------------------------------------------------------------ */
export async function toggleTenantStatusAction(
  id: string,
  currentStatus: TenantStatus
): Promise<TenantStatus> {
  const supabase = await createServerSupabase()

  // حماية: يُمنع تجميد/تفعيل حساب مشرف المنصة نفسه
  const { data: tenant } = await supabase
    .from("tenants")
    .select("auth_user_id")
    .eq("id", id)
    .single()
  if (tenant?.auth_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("system_role")
      .eq("id", tenant.auth_user_id)
      .single()
    if (profile?.system_role === "owner") {
      throw new Error("لا يمكن تجميد حساب مشرف المنصة")
    }
  }

  const newStatus: TenantStatus = currentStatus === "active" ? "frozen" : "active"
  const { error } = await supabase
    .from("tenants")
    .update({ status: newStatus })
    .eq("id", id)
  if (error) throw new Error(error.message)
  return newStatus
}

/* ------------------------------------------------------------------ */
/* deleteTenant                                                        */
/* ------------------------------------------------------------------ */
export async function deleteTenantAction(id: string): Promise<void> {
  const supabase = await createServerSupabase()
  // جلب auth_user_id قبل الحذف
  const { data: tenant } = await supabase
    .from("tenants")
    .select("auth_user_id")
    .eq("id", id)
    .single()

  // حماية: يُمنع حذف حساب مشرف المنصة نفسه مهما كان مصدر الطلب
  if (tenant?.auth_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("system_role")
      .eq("id", tenant.auth_user_id)
      .single()
    if (profile?.system_role === "owner") {
      throw new Error("لا يمكن حذف حساب مشرف المنصة")
    }
  }

  const { error } = await supabase.from("tenants").delete().eq("id", id)
  if (error) throw new Error(error.message)

  // حذف auth.user المرتبط (اختياري)
  if (tenant?.auth_user_id) {
    const adminClient = createServiceClient()
    await adminClient.auth.admin.deleteUser(tenant.auth_user_id)
  }
}
