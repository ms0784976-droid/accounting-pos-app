"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ClientStoreProvider, useAuth, useClientStore } from "@/lib/store"
import { ClientSidebar } from "./client-sidebar"
import { ClientTopbar } from "./client-topbar"
import { OverviewTab } from "./overview-tab"
import { CatalogTab } from "./catalog-tab"
import { SalesTab } from "./sales-tab"
import { PurchasesTab } from "./purchases-tab"
import { CustomersTab } from "./customers-tab"
import { LedgerTab } from "./ledger-tab"
import { ReportsTab } from "./reports-tab"
import { UsersTab } from "./users-tab"
import { ROLE_TABS, TAB_LABELS, type TabId } from "@/lib/constants"
import type { ClientRole } from "@/lib/types"

/* Loading skeleton */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <svg className="animate-spin size-10 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-sm text-muted-foreground">جارٍ تحميل البيانات من السحابة...</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* إعداد المستخدم الأول عند أول دخول لشركة جديدة                     */
/* ------------------------------------------------------------------ */
function FirstTimeSetup({ tenantId }: { tenantId: string }) {
  const { addTenantUser, refetchAll } = useClientStore()
  const { authUser } = useAuth()
  const [name, setName] = useState(authUser?.name ?? "")
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    await addTenantUser({
      tenantId,
      name: name.trim(),
      username: authUser?.username ?? authUser?.email?.split("@")[0] ?? "admin",
      email: authUser?.email ?? "",
      role: "admin",
    })
    await refetchAll()
    setSaving(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-xl text-center space-y-5">
        <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <svg className="size-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-foreground">إعداد الحساب الأول</h2>
        <p className="text-sm text-muted-foreground">
          أدخل اسمك لإنشاء حساب مدير النظام وبدء استخدام المنصة.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="الاسم الكامل"
          className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
        />
        <button
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {saving ? "جارٍ الحفظ..." : "ابدأ الآن"}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* واجهة التطبيق الرئيسية                                             */
/* ------------------------------------------------------------------ */
function ClientApp({ tenantId }: { tenantId: string }) {
  const { currentTenantUser, loading } = useClientStore()
  const [tab, setTab] = useState<TabId>("overview")
  const [collapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [theme, setTheme] = useState<"light" | "dark">("light")

  if (loading) return <LoadingScreen />
  if (!currentTenantUser) return <FirstTimeSetup tenantId={tenantId} />

  const allowedTabs = ROLE_TABS[currentTenantUser.role as ClientRole] ?? ROLE_TABS["cashier"]
  const activeTab = allowedTabs.includes(tab) ? tab : allowedTabs[0]

  return (
    <div className="flex min-h-svh bg-background text-foreground" dir="rtl">
      <ClientSidebar
        allowedTabs={allowedTabs}
        active={activeTab}
        onSelect={setTab}
        collapsed={collapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <ClientTopbar
          title={TAB_LABELS[activeTab]}
          search={search}
          onSearch={setSearch}
          onOpenMobile={() => setMobileOpen(true)}
          theme={theme}
          onToggleTheme={() => {
            const next = theme === "dark" ? "light" : "dark"
            setTheme(next)
            document.documentElement.classList.toggle("dark", next === "dark")
          }}
          onNewSale={() => setTab("sales")}
        />

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {activeTab === "overview"  && <OverviewTab />}
                {activeTab === "catalog"   && <CatalogTab search={search} />}
                {activeTab === "sales"     && <SalesTab search={search} />}
                {activeTab === "purchases" && <PurchasesTab search={search} />}
                {activeTab === "customers" && <CustomersTab search={search} />}
                {activeTab === "ledger"    && <LedgerTab search={search} />}
                {activeTab === "reports"   && <ReportsTab />}
                {activeTab === "users" && currentTenantUser.role === "admin" && (
                  <UsersTab search={search} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shell Wrapper                                                        */
/* ------------------------------------------------------------------ */
export function ClientShell({ tenantId }: { tenantId: string }) {
  return (
    <ClientStoreProvider tenantId={tenantId}>
      <ClientApp tenantId={tenantId} />
    </ClientStoreProvider>
  )
}
