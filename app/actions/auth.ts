"use server"

import { createServiceClient } from "@/lib/supabase/server"
import type { AuthUser } from "@/lib/types"

/* ------------------------------------------------------------------ */
/* buildAuthUser — يُبنى من userId فقط بدون اعتماد على cookies/session */
/* ------------------------------------------------------------------ */
export async function buildAuthUser(
  userId: string,
  userEmail: string
): Promise<{ user: AuthUser; tenantId: string | null } | { error: string }> {
  const admin = createServiceClient()

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("username, full_name, system_role")
    .eq("id", userId)
    .single()

  if (profileError || !profile) {
    return { error: "لم يُعثر على ملف المستخدم" }
  }

  const systemRole = profile.system_role as "owner" | "client"
  let tenantId: string | null = null

  if (systemRole === "client") {
    const { data: ownerTenant } = await admin
      .from("tenants")
      .select("id, status")
      .eq("auth_user_id", userId)
      .single()

    if (ownerTenant) {
      if (ownerTenant.status === "frozen")
        return { error: "تم تجميد هذا الحساب. يرجى التواصل مع المشرف." }
      tenantId = ownerTenant.id
    } else {
      const { data: tenantUser } = await admin
        .from("tenant_users")
        .select("tenant_id, status, tenants(status)")
        .eq("auth_user_id", userId)
        .single()

      if (tenantUser) {
        const tenantStatus = (tenantUser as any).tenants?.status
        if (tenantUser.status === "frozen" || tenantStatus === "frozen")
          return { error: "تم تجميد هذا الحساب. يرجى التواصل مع المشرف." }
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
/* resolveEmail — username → email عبر Service Role                   */
/* ------------------------------------------------------------------ */
export async function resolveEmailAction(identifier: string): Promise<string> {
  const input = identifier.trim().toLowerCase()
  if (input.includes("@")) return input

  const admin = createServiceClient()
  const { data, error } = await admin.rpc("get_email_by_username", {
    p_username: input,
  })

  if (error || !data) throw new Error("لم يُعثر على حساب بهذا الاسم")
  return data as string
}

/* ------------------------------------------------------------------ */
/* logoutAction — يُستخدم للتأكد من مسح الجلسة من جانب السيرفر أيضاً */
/* ------------------------------------------------------------------ */
export async function logoutAction(): Promise<void> {
  // الجلسة تُمسح من Browser Client مباشرة، هذا للتأكد فقط
  try {
    const { createServerSupabase } = await import("@/lib/supabase/server")
    const supabase = await createServerSupabase()
    await supabase.auth.signOut()
  } catch {}
}
