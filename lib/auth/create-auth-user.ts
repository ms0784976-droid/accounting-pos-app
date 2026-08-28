import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_")
}

function usernameFromEmail(email: string): string {
  const [local = "user", domain = ""] = email.split("@")
  const domainPart = domain.replace(/\./g, "_")
  return normalizeUsername(domainPart ? `${local}_${domainPart}` : local)
}

function mapCreateUserError(message: string): string {
  const msg = message.toLowerCase()
  if (
    msg.includes("already been registered") ||
    msg.includes("already registered") ||
    msg.includes("user already exists") ||
    msg.includes("duplicate")
  ) {
    return "هذا البريد الإلكتروني مسجّل مسبقاً. استخدم بريداً آخر."
  }
  if (msg.includes("database error creating new user")) {
    return "تعذّر إنشاء الحساب لأن اسم المستخدم أو البريد مكرر في النظام. غيّر البريد أو اسم صاحب النشاط ثم أعد المحاولة."
  }
  if (msg.includes("password")) {
    return "كلمة المرور لا تستوفي شروط النظام (8 أحرف على الأقل)."
  }
  if (msg.includes("invalid") && msg.includes("email")) {
    return "البريد الإلكتروني غير صالح."
  }
  return message
}

async function usernameTaken(admin: SupabaseClient, username: string): Promise<boolean> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle()
  return Boolean(data)
}

async function allocateUsername(
  admin: SupabaseClient,
  preferred: string,
  email: string
): Promise<string> {
  const candidates = [
    normalizeUsername(preferred),
    normalizeUsername(email.split("@")[0] ?? ""),
    usernameFromEmail(email),
  ].filter((v, i, arr) => v.length > 0 && arr.indexOf(v) === i)

  for (const candidate of candidates) {
    if (!(await usernameTaken(admin, candidate))) return candidate
  }

  const base = candidates[candidates.length - 1] || "user"
  for (let i = 2; i <= 30; i++) {
    const candidate = `${base}_${i}`
    if (!(await usernameTaken(admin, candidate))) return candidate
  }

  return `${base}_${Date.now().toString(36)}`
}

async function emailAlreadyInAuth(
  admin: SupabaseClient,
  email: string
): Promise<boolean> {
  const { data: tenants } = await admin
    .from("tenants")
    .select("id")
    .eq("email", email)
    .limit(1)
  if (tenants && tenants.length > 0) return true

  const { data: tenantUsers } = await admin
    .from("tenant_users")
    .select("id")
    .eq("email", email)
    .limit(1)
  if (tenantUsers && tenantUsers.length > 0) return true

  return false
}

/** إنشاء مستخدم Auth مؤكَّد البريد + اسم مستخدم غير مكرر في profiles */
export async function createConfirmedAuthUser(
  admin: SupabaseClient,
  input: {
    email: string
    password: string
    fullName: string
    preferredUsername: string
  }
): Promise<{ id: string; username: string }> {
  const email = input.email.trim().toLowerCase()
  if (await emailAlreadyInAuth(admin, email)) {
    throw new Error("هذا البريد الإلكتروني مسجّل مسبقاً. استخدم بريداً آخر.")
  }

  let username = await allocateUsername(admin, input.preferredUsername, email)
  let lastMessage = ""

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) {
      username = `${usernameFromEmail(email)}_${Date.now().toString(36)}`
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
        username,
        system_role: "client",
      },
    })

    if (!error && data.user?.id) {
      return { id: data.user.id, username }
    }

    lastMessage = error?.message ?? "فشل إنشاء الحساب"
    console.error("createConfirmedAuthUser failed:", lastMessage, {
      email,
      username,
      attempt,
    })

    if (!/database error creating new user/i.test(lastMessage)) break
  }

  throw new Error(mapCreateUserError(lastMessage))
}
