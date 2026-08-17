"use client"

import { useEffect } from "react"
import { AuthProvider, OwnerStoreProvider, useAuth } from "@/lib/store"
import { LoginPage } from "@/components/auth/login-page"
import { OwnerShell } from "@/components/owner/owner-shell"
import { ClientShell } from "@/components/client/client-shell"

function AppRouter() {
  const { authUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <svg className="animate-spin size-10 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    )
  }

  if (!authUser) return <LoginPage />
  if (authUser.systemRole === "owner") return <OwnerShell />
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
