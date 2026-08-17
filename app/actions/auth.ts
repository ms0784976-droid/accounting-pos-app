"use server"

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server"
import type { AuthUser } from "@/lib/types"

/* ------------------------------------------------------------------ */
/* resolveEmail — يحوّل username → email                              */
/* يستخدم Service Role لتجاوز RLS عند البحث بـ username              */
/* ------------------------------------------------------------------ */
async function resolveEmail(identifier: string): Promise<string> {
  const input = identifier.trim().toLowerCase()
  if (input.includes("@")) return input

  // استخدام Service Role لأن هذا استعلام pre-auth (بدون جلسة)
  const admin = createServiceClient()
  const { data, error } = await admin.rpc("get_email_by_username", {
    p_username: input,
  })

  if (error || !data) {
    throw new Error("لم يُعثر على حساب بهذا الاسم")
  }

  return data as string
}

/* ------------------------------------------------------------------ */
/* buildAuthUser — جلب بيانات المستخدم بعد التحقق من هويته           */
/* يستخدم Service Role لضمان القراءة بدون مشاكل RLS                  */
/* ------------------------------------------------------------------ */
async function buildAuthUser(
  userId: string,
  userEmail: string
): Promise<{ user: AuthUser; tenantId: string | null } | { error: string }> {
  // Service Role يتجاوز RLS — مضمون للقراءة بعد signInWithPassword
  const admin = createServiceClient()

  // جلب الـ profile
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("username, full_name, system_role")
    .eq("id", userId)
    .single()

  if (profileError || !profile) {
    console.error("Profile fetch error:", profileError)
    return { error: "لم يُعثر على ملف المستخدم. تأكد من تشغيل SQL الخاص بالإعداد." }
  }

  const systemRole = profile.system_role as "owner" | "client"
  let tenantId: string | null = null

  if (systemRole === "client") {
    // هل هو صاحب شركة؟
    const { data: ownerTenant } = await admin
      .from("tenants")
      .select("id, status")
      .eq("auth_user_id", userId)
      .single()

    if (ownerTenant) {
      if (ownerTenant.status === "frozen") {
        return { error: "تم تجميد هذا الحساب. يرجى التواصل مع المشرف." }
      }
      tenantId = ownerTenant.id
    } else {
      // هل هو موظف في شركة؟
      const { data: tenantUser } = await admin
        .from("tenant_users")
        .select("tenant_id, status, tenants(status)")
        .eq("auth_user_id", userId)
        .single()

      if (tenantUser) {
        const tenantStatus = (tenantUser as any).tenants?.status
        if (tenantUser.status === "frozen" || tenantStatus === "frozen") {
          return { error: "تم تجميد هذا الحساب. يرجى التواصل مع المشرف." }
        }
        tenantId = tenantUser.tenant_id
      }
    }
  }

  return {
    user: {
      id: userId,
      tenantId,
      systemRole,
      name: profile.full_name || userEmail,
      email: userEmail,
      username: profile.username || "",
    },
    tenantId,
  }
}

/* ------------------------------------------------------------------ */
/* loginAction                                                         */
/* ------------------------------------------------------------------ */
export async function loginAction(
  identifier: string,
  password: string
): Promise<{ user: AuthUser; tenantId: string | null } | { error: string }> {
  try {
    // 1. حل الـ email من username إذا لزم
    const email = await resolveEmail(identifier)

    // 2. تسجيل الدخول عبر Supabase Auth (يحفظ الـ session cookie)
    const supabase = await createServerSupabase()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }
    }

    // 3. جلب بيانات المستخدم بـ Service Role (يتجاوز مشكلة RLS بعد signIn)
    return await buildAuthUser(authData.user.id, authData.user.email ?? "")
  } catch (err: any) {
    console.error("loginAction error:", err)
    return { error: err.message || "حدث خطأ أثناء تسجيل الدخول" }
  }
}

/* ------------------------------------------------------------------ */
/* logoutAction                                                        */
/* ------------------------------------------------------------------ */
export async function logoutAction(): Promise<void> {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
}

/* ------------------------------------------------------------------ */
/* getSessionAction — استعادة الجلسة عند إعادة تحميل الصفحة          */
/* ------------------------------------------------------------------ */
export async function getSessionAction(): Promise<{
  user: AuthUser
  tenantId: string | null
} | null> {
  try {
    // 1. التحقق من الجلسة المحفوظة في cookies
    const supabase = await createServerSupabase()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) return null

    // 2. جلب بيانات المستخدم بـ Service Role
    const result = await buildAuthUser(user.id, user.email ?? "")
    if ("error" in result) return null

    return result
  } catch {
    return null
  }
}