"use server"

// ================================================================
// app/actions/auth.ts — النسخة المصلَّحة
// ================================================================
// المشكلة الجذر التي كانت تمنع الدخول:
//   client-shell.tsx يفحص `!authUser.role` — لكن buildAuthUser
//   لم يكن يُرجع الحقل `role` إطلاقاً، فيبقى undefined دائماً
//   وتظهر شاشة "حسابك غير مرتبط بشركة" لكل مستخدم مهما كانت
//   بياناته صحيحة في قاعدة البيانات.
//
// الإصلاحات هنا:
//   1. إرجاع `role` في كل المسارات.
//   2. .maybeSingle() بدل .single() — لا يرمي خطأ عند تعدّد الصفوف.
//   3. إنشاء profile تلقائياً إن كان ناقصاً.
//   4. رسائل خطأ تشخيصية بدل رسالة عامة واحدة.
//   5. إعادة تعيين كلمة المرور عبر البريد.

import { createServiceClient, createServerSupabase } from "@/lib/supabase/server"
import { requireOwner } from "@/lib/auth/guard"
import type { AuthUser, ClientRole } from "@/lib/types"

/* ================================================================ */
/* بناء المستخدم — يُبنى من userId فقط بدون اعتماد على cookies       */
/* ================================================================ */

export async function buildAuthUser(
  requestedUserId: string,
  requestedEmail: string
): Promise<{ user: AuthUser; tenantId: string | null } | { error: string }> {
  const admin = createServiceClient()

  /* ── 0) التحقق من الهوية ──
     هذه Server Action نقطة نهاية عامة. نأخذ الهوية من جلسة الكوكيز
     كلما توفّرت، ولا نثق بالمُعرّف القادم من المتصفح.
     نُبقي المُدخل كمسار احتياطي فقط للحظة التي لم تُكتب فيها كوكيز
     الجلسة بعد مباشرة عقب تسجيل الدخول — حتى لا ينكسر الدخول. */
  let userId = requestedUserId
  let userEmail = requestedEmail

  try {
    const supabase = await createServerSupabase()
    const { data: sessionData } = await supabase.auth.getUser()
    if (sessionData?.user) {
      if (sessionData.user.id !== requestedUserId) {
        return { error: "غير مصرّح: محاولة قراءة بيانات مستخدم آخر" }
      }
      userId = sessionData.user.id
      userEmail = sessionData.user.email ?? requestedEmail
    }
  } catch {
    // تعذّر قراءة الجلسة — نكمل بالمسار الاحتياطي
  }

  if (!userId) return { error: "معرّف المستخدم مفقود" }

  /* ── 1) الملف الشخصي ── */
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("username, full_name, system_role")
    .eq("id", userId)
    .maybeSingle()

  if (profileError) {
    return { error: `خطأ في قراءة الملف الشخصي: ${profileError.message}` }
  }

  // مستخدم في auth بلا profile — نُنشئه بدل رفض الدخول
  let prof = profile
  if (!prof) {
    const username = userEmail.split("@")[0]
    const { data: created, error: createError } = await admin
      .from("profiles")
      .insert({ id: userId, username, full_name: username, system_role: "client" })
      .select("username, full_name, system_role")
      .single()

    if (createError || !created) {
      return { error: `تعذّر إنشاء ملف المستخدم: ${createError?.message ?? "خطأ غير معروف"}` }
    }
    prof = created
  }

  const systemRole = prof.system_role as "owner" | "client"
  const baseUser = {
    id: userId,
    name: prof.full_name || userEmail,
    email: userEmail,
    username: prof.username || "",
  }

  /* ── 2) مشرف المنصة — لا يحتاج شركة ── */
  if (systemRole === "owner") {
    return {
      user: { ...baseUser, tenantId: null, systemRole: "owner", role: null },
      tenantId: null,
    }
  }

  /* ── 3) صاحب شركة ──
     limit(1) يمنع خطأ تعدّد الصفوف، و maybeSingle يمنع خطأ الصفر صفوف.
     .single() القديمة كانت ترمي خطأ في الحالتين. */
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
        ...baseUser,
        tenantId: ownerTenant.id,
        systemRole: "client",
        role: "admin" as ClientRole,   // ← صاحب الشركة مدير دائماً
      },
      tenantId: ownerTenant.id,
    }
  }

  /* ── 4) موظّف داخل شركة ── */
  const { data: member, error: memberError } = await admin
    .from("tenant_users")
    .select("tenant_id, role, status, tenants(name, status)")
    .eq("auth_user_id", userId)
    .limit(1)
    .maybeSingle()

  if (memberError) {
    return { error: `خطأ في قراءة بيانات المستخدم: ${memberError.message}` }
  }

  if (member) {
    const tenant = (member as any).tenants as { name?: string; status?: string } | null

    if (member.status === "frozen") {
      return { error: "حسابك مجمّد داخل الشركة. يرجى التواصل مع مدير النظام." }
    }
    if (tenant?.status === "frozen") {
      return { error: `تم تجميد اشتراك "${tenant?.name ?? ""}". يرجى التواصل مع المشرف.` }
    }

    return {
      user: {
        ...baseUser,
        tenantId: member.tenant_id as string,
        systemRole: "client",
        role: (member.role as ClientRole) ?? "cashier",   // ← الحقل الناقص
      },
      tenantId: member.tenant_id as string,
    }
  }

  /* ── 5) لا شركة ولا عضوية ── */
  return {
    error:
      `الحساب ${userEmail} غير مرتبط بأي شركة. ` +
      `يحتاج سجلاً في جدول tenants (كصاحب شركة) أو في tenant_users (كموظّف).`,
  }
}

/* ================================================================ */
/* تحويل اسم المستخدم إلى بريد                                       */
/* ================================================================ */

export async function resolveEmailAction(identifier: string): Promise<string> {
  const input = identifier.trim().toLowerCase()
  if (!input) throw new Error("أدخل اسم المستخدم أو البريد الإلكتروني")
  if (input.includes("@")) return input

  const admin = createServiceClient()

  // المسار الأساسي: دالة RPC
  const { data, error } = await admin.rpc("get_email_by_username", { p_username: input })
  if (!error && data) return data as string

  // مسار احتياطي 1: جدول profiles
  const { data: prof } = await admin
    .from("profiles").select("id").ilike("username", input).limit(1).maybeSingle()

  if (prof?.id) {
    const { data: authUser } = await admin.auth.admin.getUserById(prof.id)
    if (authUser?.user?.email) return authUser.user.email
  }

  // مسار احتياطي 2: جدول tenant_users
  const { data: member } = await admin
    .from("tenant_users").select("email").ilike("username", input).limit(1).maybeSingle()

  if (member?.email) return member.email as string

  throw new Error(`لم يُعثر على حساب باسم "${identifier}"`)
}

/* ================================================================ */
/* تسجيل الخروج                                                      */
/* ================================================================ */

export async function logoutAction(): Promise<void> {
  try {
    const supabase = await createServerSupabase()
    await supabase.auth.signOut()
  } catch {
    // الجلسة تُمسح في المتصفح أصلاً — هذا للتأكيد فقط
  }
}

/* ================================================================ */
/* إعادة تعيين كلمة المرور                                           */
/* ================================================================ */

/**
 * يُرسل رابط إعادة التعيين على البريد.
 *
 * ملاحظة أمنية مهمة: نُرجع نجاحاً دائماً حتى لو الحساب غير موجود.
 * لو أخبرنا المستخدم "هذا البريد غير مسجّل"، صار بإمكان أي شخص
 * تجربة قائمة عناوين ومعرفة أيّها مسجّل في نظامك.
 */
export async function requestPasswordResetAction(
  identifier: string,
  redirectTo: string
): Promise<{ ok: true; message: string }> {
  const generic = {
    ok: true as const,
    message: "إذا كان الحساب موجوداً، أُرسل رابط إعادة التعيين إلى بريده الإلكتروني.",
  }

  const input = identifier.trim().toLowerCase()
  if (!input) throw new Error("أدخل اسم المستخدم أو البريد الإلكتروني")

  let email: string
  try {
    email = await resolveEmailAction(input)
  } catch {
    return generic   // لا نكشف أن الحساب غير موجود
  }

  try {
    const supabase = await createServerSupabase()
    await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  } catch {
    // حتى لو فشل الإرسال لا نكشف تفاصيل
  }

  return generic
}

/** يُحدّث كلمة المرور بعد فتح رابط إعادة التعيين */
export async function completePasswordResetAction(
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }
  }
  if (!/[A-Za-z\u0600-\u06FF]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return { ok: false, error: "كلمة المرور يجب أن تحتوي حرفاً ورقماً على الأقل" }
  }

  const supabase = await createServerSupabase()
  const { data: session } = await supabase.auth.getUser()
  if (!session?.user) {
    return { ok: false, error: "رابط إعادة التعيين منتهي الصلاحية. اطلب رابطاً جديداً." }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error: `تعذّر تغيير كلمة المرور: ${error.message}` }

  // ألغِ علامة "يجب تغيير كلمة المرور" إن كانت موجودة
  await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", session.user.id)
    .then(() => null, () => null)

  return { ok: true }
}

/* ================================================================ */
/* أداة تشخيص — لمعرفة سبب فشل دخول أي حساب                          */
/* ================================================================ */

export async function diagnoseAccountAction(email: string): Promise<{
  email: string
  authUserExists: boolean
  authUserId: string | null
  hasProfile: boolean
  systemRole: string | null
  ownsTenants: { id: string; name: string; status: string }[]
  memberOf: { tenantId: string; role: string; status: string }[]
  verdict: string
}> {
  // أداة تشخيص تكشف وجود الحسابات وأدوارها — لمشرف المنصة وحده
  await requireOwner()

  const admin = createServiceClient()
  const target = email.trim().toLowerCase()

  const { data: list } = await admin.auth.admin.listUsers()
  const authUser = list?.users.find((u: { email?: string | null }) =>
    u.email?.toLowerCase() === target
  )

  if (!authUser) {
    return {
      email: target, authUserExists: false, authUserId: null,
      hasProfile: false, systemRole: null, ownsTenants: [], memberOf: [],
      verdict: "لا يوجد حساب دخول بهذا البريد في auth.users",
    }
  }

  const { data: profile } = await admin
    .from("profiles").select("system_role").eq("id", authUser.id).maybeSingle()
  const { data: owned } = await admin
    .from("tenants").select("id, name, status").eq("auth_user_id", authUser.id)
  const { data: member } = await admin
    .from("tenant_users").select("tenant_id, role, status").eq("auth_user_id", authUser.id)

  const ownsTenants = (owned ?? []) as { id: string; name: string; status: string }[]
  const memberOf = (member ?? []).map((m: any) => ({
    tenantId: m.tenant_id, role: m.role, status: m.status,
  }))

  let verdict = "الحساب سليم ويجب أن يعمل"
  if (!profile) verdict = "ناقص سجل في جدول profiles"
  else if (profile.system_role === "owner") verdict = "مشرف منصة — لا يحتاج شركة"
  else if (ownsTenants.length > 1) verdict = `مرتبط بـ ${ownsTenants.length} شركات — يجب أن تكون واحدة`
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
