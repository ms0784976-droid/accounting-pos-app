"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ClientStoreProvider } from "@/lib/store"
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
import { useClientStore } from "@/lib/store"
import { ROLE_TABS, TAB_LABELS, type TabId } from "@/lib/constants"

function ClientApp() {
  const { currentTenantUser } = useClientStore()
  const [tab, setTab] = useState<TabId>("overview")
  const [collapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [theme, setTheme] = useState<"light" | "dark">("light")

  const allowedTabs = ROLE_TABS[currentTenantUser.role]

  useEffect(() => {
    if (!allowedTabs.includes(tab)) setTab(allowedTabs[0])
  }, [allowedTabs, tab])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  return (
    <div className="flex min-h-svh bg-background text-foreground" dir="rtl">
      <ClientSidebar
        allowedTabs={allowedTabs}
        active={tab}
        onSelect={setTab}
        collapsed={collapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <ClientTopbar
          title={TAB_LABELS[tab]}
          search={search}
          onSearch={setSearch}
          onOpenMobile={() => setMobileOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          onNewSale={() => setTab("sales")}
        />

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {tab === "overview"  && <OverviewTab />}
                {tab === "catalog"   && <CatalogTab search={search} />}
                {tab === "sales"     && <SalesTab search={search} />}
                {tab === "purchases" && <PurchasesTab search={search} />}
                {tab === "customers" && <CustomersTab search={search} />}
                {tab === "ledger"    && <LedgerTab search={search} />}
                {tab === "reports"   && <ReportsTab />}
                {tab === "users"     && currentTenantUser.role === "admin" && <UsersTab search={search} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}

export function ClientShell({ tenantId }: { tenantId: string }) {
  return (
    <ClientStoreProvider tenantId={tenantId} initialCurrency="ILS">
      <ClientApp />
    </ClientStoreProvider>
  )
}
