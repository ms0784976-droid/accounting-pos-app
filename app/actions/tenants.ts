"use server"

/**
 * app/actions/tenants.ts — نسخة مؤمّنة
 * ================================================================
 * التغيير الجوهري: كل دالة هنا تبدأ بـ requireOwner().
 * قبل هذا التعديل كان بإمكان أي شخص استدعاء addTenantAction مباشرة
 * وإنشاء حسابات Auth باستخدام مفتاح Service Role.
 */

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server"
import { requireOwner } from "@/lib/auth/guard"
import type { Tenant, SubscriptionPlan, TenantStatus } from "@/lib/types"

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
  tax_number?: string
  address?: string
  vat_rate?: number
  vat_enabled?: boolean
}

function rowToTenant(row: TenantRow): Tenant {
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
    expiresAt: row.expires_at ?? "",
    createdAt: row.created_at?.split("T")[0] ?? "",
  }
}

/** قراءة كل الشركات — للمشرف فقط */
export async function fetchTenantsAction(): Promise<Tenant[]> {
  await requireOwner()
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTenant)
}

/** إنشاء شركة جديدة + حساب دخول لصاحبها */
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
  await requireOwner()

  const email = input.email.trim().toLowerCase()
  const password = input.tempPassword?.trim()

  if (!email.includes("@")) {
    return { tenant: {} as Tenant, error: "البريد الإلكتروني غير صالح" }
  }
  if (!password || password.length < 8) {
    return { tenant: {} as Tenant, error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }
  }
  if (!input.name.trim()) {
    return { tenant: {} as Tenant, error: "اسم النشاط التجاري مطلوب" }
  }

  const adminClient = createServiceClient()
  const username = input.ownerName.trim().toLowerCase().replace(/\s+/g, "_")

  const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.ownerName, username, system_role: "client" },
  })

  if (userError || !newUser.user) {
    return { tenant: {} as Tenant, error: `خطأ في إنشاء الحساب: ${userError?.message}` }
  }

  const authUserId = newUser.user.id

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: authUserId,
    username,
    full_name: input.ownerName,
    system_role: "client",
  })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUserId)
    return { tenant: {} as Tenant, error: `خطأ في إنشاء الملف الشخصي: ${profileError.message}` }
  }

  const { data: tenant, error: tenantError } = await adminClient
    .from("tenants")
    .insert({
      name: input.name.trim(),
      owner_name: input.ownerName.trim(),
      email,
      phone: input.phone,
      plan: input.plan,
      status: input.status,
      industry: input.industry,
      currency: input.currency,
      expires_at: input.expiresAt || null,
      auth_user_id: authUserId,
    })
    .select("*")
    .single()

  if (tenantError || !tenant) {
    await adminClient.auth.admin.deleteUser(authUserId)
    return { tenant: {} as Tenant, error: `خطأ في إنشاء الشركة: ${tenantError?.message}` }
  }

  // دليل الحسابات يُنشأ تلقائياً عبر trigger، والتصنيفات نستدعيها هنا
  await adminClient.rpc("seed_expense_categories", { p_tenant: tenant.id })

  return { tenant: rowToTenant(tenant as TenantRow) }
}

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
  await requireOwner()

  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined)      dbPatch.name       = patch.name
  if (patch.ownerName !== undefined) dbPatch.owner_name = patch.ownerName
  if (patch.email !== undefined)     dbPatch.email      = patch.email.trim().toLowerCase()
  if (patch.phone !== undefined)     dbPatch.phone      = patch.phone
  if (patch.plan !== undefined)      dbPatch.plan       = patch.plan
  if (patch.status !== undefined)    dbPatch.status     = patch.status
  if (patch.industry !== undefined)  dbPatch.industry   = patch.industry
  if (patch.currency !== undefined)  dbPatch.currency   = patch.currency
  if (patch.expiresAt !== undefined) dbPatch.expires_at = patch.expiresAt || null

  if (Object.keys(dbPatch).length === 0) return

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("tenants").update(dbPatch).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function toggleTenantStatusAction(
  id: string,
  currentStatus: TenantStatus
): Promise<TenantStatus> {
  await requireOwner()
  const supabase = await createServerSupabase()

  await assertNotPlatformOwnerTenant(id)

  const newStatus: TenantStatus = currentStatus === "active" ? "frozen" : "active"
  const { error } = await supabase.from("tenants").update({ status: newStatus }).eq("id", id)
  if (error) throw new Error(error.message)
  return newStatus
}

export async function deleteTenantAction(id: string): Promise<void> {
  await requireOwner()
  const supabase = await createServerSupabase()

  await assertNotPlatformOwnerTenant(id)

  const { data: tenant } = await supabase
    .from("tenants")
    .select("auth_user_id")
    .eq("id", id)
    .maybeSingle()

  const { error } = await supabase.from("tenants").delete().eq("id", id)
  if (error) throw new Error(error.message)

  if (tenant?.auth_user_id) {
    const adminClient = createServiceClient()
    await adminClient.auth.admin.deleteUser(tenant.auth_user_id)
  }
}

/** حماية: لا يمكن تجميد أو حذف حساب مشرف المنصة نفسه */
async function assertNotPlatformOwnerTenant(tenantId: string): Promise<void> {
  const admin = createServiceClient()
  const { data: tenant } = await admin
    .from("tenants")
    .select("auth_user_id")
    .eq("id", tenantId)
    .maybeSingle()

  if (!tenant?.auth_user_id) return

  const { data: profile } = await admin
    .from("profiles")
    .select("system_role")
    .eq("id", tenant.auth_user_id)
    .maybeSingle()

  if (profile?.system_role === "owner") {
    throw new Error("لا يمكن تجميد أو حذف حساب مشرف المنصة")
  }
}
