"use server"

// ================================================================
// app/actions/auth.ts — نسخة مصلَّحة
// ================================================================
// الخطأ الذي كان يمنع الدخول:
//   .single() يرمي خطأ إذا رجع أكثر من صف أو صفر صفوف.
//   حساب owner كان مربوطاً بشركتين، فيفشل الاستعلام ويُعامَل
//   المستخدم كأنه بلا شركة → "حسابك غير مرتبط بشركة".
//
// الحل: .maybeSingle() مع .limit(1) — لا يرمي خطأ في الحالتين.
// وأضفنا رسائل خطأ تشرح السبب الحقيقي بدل رسالة عامة واحدة.

import { createServiceClient } from "@/lib/supabase/server"
import type { AuthUser } from "@/lib/types"

/* ------------------------------------------------------------------ */
/* buildAuthUser — يُبنى من userId فقط بدون اعتماد على cookies/session  */
/* ------------------------------------------------------------------ */

export async function buildAuthUser(
  userId: string,
  userEmail: string
): Promise<{ user: AuthUser; tenantId: string | null } | { error: string }> {
  const admin = createServiceClient()

  /* ── 1) الملف الشخصي ── */
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("username, full_name, system_role")
    .eq("id", userId)
    .maybeSingle()

  if (profileError) {
    return { error: `خطأ في قراءة الملف الشخصي: ${profileError.message}` }
  }

  // مستخدم موجود في auth بلا profile — نُنشئه بدل رفض الدخول
  let resolvedProfile = profile
  if (!resolvedProfile) {
    const username = userEmail.split("@")[0]
    const { data: created, error: createError } = await admin
      .from("profiles")
      .insert({
        id: userId,
        username,
        full_name: username,
        system_role: "client",
      })
      .select("username, full_name, system_role")
      .single()

    if (createError || !created) {
      return { error: "لم يُعثر على ملف المستخدم وتعذّر إنشاؤه تلقائياً" }
    }
    resolvedProfile = created
  }

  const systemRole = resolvedProfile.system_role as "owner" | "client"

  /* ── 2) مشرف المنصة لا يحتاج شركة ── */
  if (systemRole === "owner") {
    return {
      user: {
        id: userId,
        tenantId: null,
        systemRole: "owner",
        name: resolvedProfile.full_name || userEmail,
        email: userEmail,
        username: resolvedProfile.username || "",
      },
      tenantId: null,
    }
  }

  /* ── 3) هل هو صاحب شركة؟ ──
     limit(1) يمنع خطأ تعدّد الصفوف، و maybeSingle يمنع خطأ الصفر صفوف.
     هذان السطران هما جوهر الإصلاح. */
  const { data: ownerTenant, error: ownerError } = await admin
    .from("tenants")
    .select("id, name, status")
    .eq("auth_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (ownerError) {
    return { error: `خطأ في قراءة بيانات الشركة: ${ownerError.message}` }
  }

  if (ownerTenant) {
    if (ownerTenant.status === "frozen") {
      return { error: `تم تجميد اشتراك "${ownerTenant.name}". يرجى التواصل مع المشرف.` }
    }
    return {
      user: {
        id: userId,
        tenantId: ownerTenant.id,
        systemRole: "client",
        name: resolvedProfile.full_name || userEmail,
        email: userEmail,
        username: resolvedProfile.username || "",
      },
      tenantId: ownerTenant.id,
    }
  }

  /* ── 4) هل هو موظّف داخل شركة؟ ── */
  const { data: tenantUser, error: memberError } = await admin
    .from("tenant_users")
    .select("tenant_id, status, tenants(name, status)")
    .eq("auth_user_id", userId)
    .limit(1)
    .maybeSingle()

  if (memberError) {
    return { error: `خطأ في قراءة بيانات المستخدم: ${memberError.message}` }
  }

  if (tenantUser) {
    const tenant = (tenantUser as any).tenants as
      | { name?: string; status?: string }
      | null

    if (tenantUser.status === "frozen") {
      return { error: "حسابك مجمّد داخل الشركة. يرجى التواصل مع مدير النظام." }
    }
    if (tenant?.status === "frozen") {
      return { error: `تم تجميد اشتراك "${tenant?.name ?? ""}". يرجى التواصل مع المشرف.` }
    }

    return {
      user: {
        id: userId,
        tenantId: tenantUser.tenant_id as string,
        systemRole: "client",
        name: resolvedProfile.full_name || userEmail,
        email: userEmail,
        username: resolvedProfile.username || "",
      },
      tenantId: tenantUser.tenant_id as string,
    }
  }

  /* ── 5) لا شركة ولا عضوية — رسالة تشخيصية واضحة ── */
  return {
    error:
      `الحساب ${userEmail} غير مرتبط بأي شركة. ` +
      `يحتاج سجلاً في جدول tenants (كصاحب شركة) أو في tenant_users (كموظّف).`,
  }
}

/* ------------------------------------------------------------------ */
/* resolveEmail — username → email عبر Service Role                    */
/* ------------------------------------------------------------------ */

export async function resolveEmailAction(identifier: string): Promise<string> {
  const input = identifier.trim().toLowerCase()
  if (!input) throw new Error("أدخل اسم المستخدم أو البريد الإلكتروني")
  if (input.includes("@")) return input

  const admin = createServiceClient()

  // المسار الأساسي: دالة RPC
  const { data, error } = await admin.rpc("get_email_by_username", {
    p_username: input,
  })
  if (!error && data) return data as string

  // مسار احتياطي: البحث المباشر في profiles ثم auth.users
  // (لو كانت دالة RPC غير موجودة أو فشلت لأي سبب)
  const { data: prof } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", input)
    .limit(1)
    .maybeSingle()

  if (prof?.id) {
    const { data: authUser } = await admin.auth.admin.getUserById(prof.id)
    if (authUser?.user?.email) return authUser.user.email
  }

  // مسار ثالث: جدول tenant_users
  const { data: member } = await admin
    .from("tenant_users")
    .select("email")
    .ilike("username", input)
    .limit(1)
    .maybeSingle()

  if (member?.email) return member.email as string

  throw new Error(`لم يُعثر على حساب باسم "${identifier}"`)
}

/* ------------------------------------------------------------------ */
/* logoutAction                                                        */
/* ------------------------------------------------------------------ */

export async function logoutAction(): Promise<void> {
  try {
    const { createServerSupabase } = await import("@/lib/supabase/server")
    const supabase = await createServerSupabase()
    await supabase.auth.signOut()
  } catch {
    // مسح الجلسة يتم في المتصفح أصلاً — هذا للتأكيد فقط
  }
}

/* ------------------------------------------------------------------ */
/* أداة تشخيص — استدعِها مؤقتاً لمعرفة سبب فشل دخول أي حساب            */
/* ------------------------------------------------------------------ */

export async function diagnoseAccountAction(email: string): Promise<{
  email: string
  authUserExists: boolean
  authUserId: string | null
  hasProfile: boolean
  systemRole: string | null
  ownsTenants: { id: string; name: string; status: string }[]
  memberOf: { tenantId: string; status: string }[]
  verdict: string
}> {
  const admin = createServiceClient()
  const target = email.trim().toLowerCase()

  const { data: list } = await admin.auth.admin.listUsers()
  const authUser = list?.users.find((u) => u.email?.toLowerCase() === target)

  if (!authUser) {
    return {
      email: target,
      authUserExists: false,
      authUserId: null,
      hasProfile: false,
      systemRole: null,
      ownsTenants: [],
      memberOf: [],
      verdict: "لا يوجد حساب دخول بهذا البريد في auth.users",
    }
  }

  const { data: profile } = await admin
    .from("profiles").select("system_role").eq("id", authUser.id).maybeSingle()

  const { data: owned } = await admin
    .from("tenants").select("id, name, status").eq("auth_user_id", authUser.id)

  const { data: member } = await admin
    .from("tenant_users").select("tenant_id, status").eq("auth_user_id", authUser.id)

  const ownsTenants = (owned ?? []) as { id: string; name: string; status: string }[]
  const memberOf = (member ?? []).map((m: any) => ({
    tenantId: m.tenant_id, status: m.status,
  }))

  let verdict = "الحساب سليم ويجب أن يعمل"
  if (!profile) verdict = "ناقص سجل في جدول profiles"
  else if (profile.system_role === "owner") verdict = "مشرف منصة — لا يحتاج شركة"
  else if (ownsTenants.length > 1) verdict = `مرتبط بـ ${ownsTenants.length} شركات — يجب أن تكون واحدة فقط`
  else if (ownsTenants.length === 0 && memberOf.length === 0) verdict = "غير مرتبط بأي شركة"
  else if (ownsTenants[0]?.status === "frozen") verdict = "الشركة مجمّدة"

  return {
    email: target,
    authUserExists: true,
    authUserId: authUser.id,
    hasProfile: !!profile,
    systemRole: profile?.system_role ?? null,
    ownsTenants,
    memberOf,
    verdict,
  }
}
