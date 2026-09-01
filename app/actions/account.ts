"use server"

// ================================================================
// حساب المستخدم — كلمة المرور والملف الشخصي والتفضيلات
// ================================================================

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { requireSession, requirePermission } from "@/lib/auth/guard"

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MyAccount {
  userId: string
  email: string
  username: string
  fullName: string
  phone: string
  theme: "light" | "dark" | "system"
  role: string | null
  systemRole: string
  lastLoginAt: string | null
  mustChangePassword: boolean
}

export async function fetchMyAccountAction(): Promise<MyAccount> {
  const s = await requireSession()
  const supabase = await createServerSupabase()

  const { data } = await supabase
    .from("profiles")
    .select("username, full_name, phone, theme, last_login_at, must_change_password, system_role")
    .eq("id", s.userId)
    .maybeSingle()

  return {
    userId: s.userId,
    email: s.email,
    username: data?.username ?? "",
    fullName: data?.full_name ?? "",
    phone: data?.phone ?? "",
    theme: (data?.theme as MyAccount["theme"]) ?? "system",
    role: s.role,
    systemRole: data?.system_role ?? s.systemRole,
    lastLoginAt: data?.last_login_at ?? null,
    mustChangePassword: data?.must_change_password ?? false,
  }
}

export async function updateMyProfileAction(patch: {
  fullName?: string
  phone?: string
  theme?: "light" | "dark" | "system"
}): Promise<void> {
  const s = await requireSession()
  const supabase = await createServerSupabase()

  const db: Record<string, unknown> = {}
  if (patch.fullName !== undefined) {
    if (!patch.fullName.trim()) throw new Error("الاسم مطلوب")
    db.full_name = patch.fullName.trim()
  }
  if (patch.phone !== undefined) db.phone = patch.phone.trim()
  if (patch.theme !== undefined) db.theme = patch.theme
  if (Object.keys(db).length === 0) return

  const { error } = await supabase.from("profiles").update(db).eq("id", s.userId)
  if (error) throw new Error(error.message)

  // نُبقي اسم المستخدم داخل الشركة متطابقاً مع ملفه الشخصي
  if (db.full_name && s.tenantId) {
    await supabase
      .from("tenant_users")
      .update({ name: db.full_name })
      .eq("auth_user_id", s.userId)
      .eq("tenant_id", s.tenantId)
  }
}

/**
 * تغيير كلمة المرور.
 * نتحقق من كلمة المرور الحالية بمحاولة تسجيل دخول مستقلة أولاً —
 * بدون هذا التحقق، أي جهاز تُرك مفتوحاً يستطيع تغيير كلمة المرور
 * وإقصاء صاحب الحساب.
 */
export async function changeMyPasswordAction(input: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  const s = await requireSession()

  if (!input.currentPassword) throw new Error("كلمة المرور الحالية مطلوبة")

  const pwError = validatePassword(input.newPassword)
  if (pwError) throw new Error(pwError)

  if (input.currentPassword === input.newPassword) {
    throw new Error("كلمة المرور الجديدة مطابقة للحالية")
  }

  // عميل منفصل بلا جلسة — حتى لا نُبطل جلسة المستخدم الحالية أثناء الفحص
  const checker = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { error: signInError } = await checker.auth.signInWithPassword({
    email: s.email,
    password: input.currentPassword,
  })
  if (signInError) throw new Error("كلمة المرور الحالية غير صحيحة")
  await checker.auth.signOut()

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.updateUser({ password: input.newPassword })
  if (error) throw new Error(`تعذّر تغيير كلمة المرور: ${error.message}`)

  await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", s.userId)
}

/** يسجّل وقت آخر دخول — يُستدعى مرة بعد تسجيل الدخول */
export async function touchLastLoginAction(): Promise<void> {
  try {
    const supabase = await createServerSupabase()
    await supabase.rpc("touch_last_login")
  } catch {
    // فشل تسجيل وقت الدخول لا يجوز أن يمنع المستخدم من الدخول
  }
}

/* ================================================================ */
/* إعادة تعيين كلمة مرور مستخدم — للمدير فقط                        */
/* ================================================================ */

export async function resetUserPasswordAction(
  tenantUserId: string,
  newPassword: string
): Promise<void> {
  const s = await requirePermission("manageUsers")

  const pwError = validatePassword(newPassword)
  if (pwError) throw new Error(pwError)

  const supabase = await createServerSupabase()
  const { data: target } = await supabase
    .from("tenant_users")
    .select("auth_user_id, name")
    .eq("id", tenantUserId)
    .eq("tenant_id", s.tenantId)
    .maybeSingle()

  if (!target) throw new Error("المستخدم غير موجود")
  if (!target.auth_user_id) throw new Error("هذا المستخدم بلا حساب دخول")

  const admin = createServiceClient()
  const { error } = await admin.auth.admin.updateUserById(target.auth_user_id, {
    password: newPassword,
  })
  if (error) throw new Error(`تعذّر إعادة التعيين: ${error.message}`)

  // نُلزمه بتغييرها عند أول دخول — المدير يعرف الكلمة المؤقتة
  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", target.auth_user_id)

  await supabase.from("audit_log").insert({
    tenant_id: s.tenantId,
    user_id: s.userId,
    action: "update",
    table_name: "auth_password",
    record_id: tenantUserId,
    new_data: { reset_for: target.name },
  })
}

/* ================================================================ */

function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
  if (pw.length > 72)       return "كلمة المرور طويلة جداً (الحد 72 حرفاً)"
  if (!/[A-Za-z\u0600-\u06FF]/.test(pw)) return "كلمة المرور يجب أن تحتوي حرفاً واحداً على الأقل"
  if (!/[0-9]/.test(pw))    return "كلمة المرور يجب أن تحتوي رقماً واحداً على الأقل"

  const weak = ["12345678", "password", "11111111", "qwertyui", "abcd1234", "00000000"]
  if (weak.includes(pw.toLowerCase())) return "كلمة المرور شائعة جداً — اختر واحدة أقوى"

  return null
}

/** يقيس قوة كلمة المرور للعرض في الواجهة */
export async function scorePasswordAction(pw: string): Promise<{
  score: 0 | 1 | 2 | 3 | 4
  label: string
  hint: string | null
}> {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  const capped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4
  const labels = ["ضعيفة جداً", "ضعيفة", "متوسطة", "جيدة", "قوية"]

  return {
    score: capped,
    label: labels[capped],
    hint: validatePassword(pw),
  }
}
