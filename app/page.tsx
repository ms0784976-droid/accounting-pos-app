"use client"

import { AuthProvider, OwnerStoreProvider, useAuth } from "@/lib/store"
import { LoginPage } from "@/components/auth/login-page"
import { OwnerShell } from "@/components/owner/owner-shell"
import { ClientShell } from "@/components/client/client-shell"

function AppRouter() {
  const { authUser } = useAuth()

  if (!authUser) return <LoginPage />
  if (authUser.systemRole === "owner") return <OwnerShell />
  // Client — tenantId is guaranteed non-null when systemRole === "client"
  return <ClientShell tenantId={authUser.tenantId!} />
}

export default function Page() {
  return (
    <AuthProvider>
      <OwnerStoreProvider>
        <AppRouter />
      </OwnerStoreProvider>
    </AuthProvider>
  )
}
