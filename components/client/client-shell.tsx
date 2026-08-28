"use client"

// ================================================================
// الهيكل الرئيسي — يربط كل الشاشات
// ================================================================

import { useState, useEffect, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useAuth } from "@/lib/store"
import { SessionProvider, useSession, useAsyncData } from "@/lib/session"
import { fetchLowStockAction } from "@/app/actions/reports"
import { ToastProvider, Btn, EmptyState } from "./ui"

import { ClientSidebar } from "./client-sidebar"
import { ClientTopbar } from "./client-topbar"
import { OverviewTab } from "./overview-tab"
import { PartiesTab } from "./parties-tab"
import { SalesTab } from "./sales-tab"
import { PurchasesTab } from "./purchases-tab"
import { ExpensesTab } from "./expenses-tab"
import { CatalogTab } from "./catalog-tab"
import { InventoryTab } from "./inventory-tab"
import { AccountingTab } from "./accounting-tab"
import { VouchersTab, CashAccountsTab } from "./vouchers-tab"
import { ReportsTab } from "./reports-tab"
import { SettingsTab } from "./settings-tab"
import { AccountTab } from "./account-tab"
import { UsersTab } from "./users-tab"

import { ROLE_TABS } from "@/lib/constants"
import type { TabId } from "@/lib/constants"
import type { AuthUser } from "@/lib/types"
import { ShieldOff, Loader2 } from "lucide-react"

/* ================================================================ */

export function ClientShell() {
  const { authUser, logout } = useAuth()

  if (!authUser) return <LoadingScreen />
  if (!authUser.tenantId || !authUser.role) return <NoAccess onLogout={logout} />

  return (
    <ToastProvider>
      <SessionProvider user={authUser}>
        <Workspace user={authUser} onLogout={logout} />
      </SessionProvider>
    </ToastProvider>
  )
}

/* ================================================================ */

function Workspace({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { canSee, loading } = useSession()

  // أول تبويب مسموح لهذا الدور — الكاشير مثلاً يبدأ من المبيعات لا الرئيسية
  const firstTab = useMemo<TabId>(
    () => (user.role ? ROLE_TABS[user.role][0] : "overview"),
    [user.role]
  )
  const [tab, setTab] = useState<TabId>(firstTab)

  // حارس إضافي: لو غُيّر الدور أثناء الجلسة، نعيده لتبويب مسموح
  useEffect(() => {
    if (!canSee(tab)) setTab(firstTab)
  }, [tab, canSee, firstTab])

  const low = useAsyncData(
    () => (canSee("inventory") ? fetchLowStockAction() : Promise.resolve([])),
    [canSee("inventory")]
  )

  if (loading) return <LoadingScreen />

  return (
    <div className="flex h-screen overflow-hidden bg-canvas paper-grain">
      <ClientSidebar
        active={tab}
        onNavigate={setTab}
        badges={{ inventory: low.data?.length ?? 0 }}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <ClientTopbar active={tab} onLogout={onLogout} onNavigate={setTab} />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-5 lg:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                <TabContent tab={tab} onNavigate={setTab} />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}

/* ================================================================ */

function TabContent({ tab, onNavigate }: {
  tab: TabId
  onNavigate: (t: TabId) => void
}) {
  const { canSee } = useSession()

  // الواجهة تخفي، والسيرفر يمنع. هذا الفحص للتنقّل السلس لا للأمان.
  if (!canSee(tab)) {
    return (
      <EmptyState
        icon={ShieldOff}
        message="لا تملك صلاحية للوصول لهذه الشاشة"
        hint="تواصل مع مدير النظام إن كنت تحتاج هذه الصلاحية"
      />
    )
  }

  switch (tab) {
    case "overview":       return <OverviewTab onNavigate={onNavigate} />
    case "sales":          return <SalesTab />
    case "purchases":      return <PurchasesTab />
    case "vouchers":       return <VouchersTab />
    case "expenses":       return <ExpensesTab kind="expense" />
    case "revenues":       return <ExpensesTab kind="revenue" />
    case "customers":      return <PartiesTab kind="customer" />
    case "suppliers":      return <PartiesTab kind="supplier" />
    case "catalog":        return <CatalogTab />
    case "inventory":      return <InventoryTab />
    case "accounting":     return <AccountingTab />
    case "cash-accounts":  return <CashAccountsTab />
    case "reports":        return <ReportsTab />
    case "users":          return <UsersTab />
    case "settings":       return <SettingsTab />
    case "account":        return <AccountTab />
    default:               return <EmptyState message="شاشة غير معروفة" />
  }
}

/* ================================================================ */

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas paper-grain">
      <div className="flex flex-col items-center gap-4">
        <div className="size-11 rounded-xl bg-primary text-primary-foreground
                        flex items-center justify-center font-bold">
          م
        </div>
        <Loader2 className="size-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">جارٍ تحميل بيانات الشركة…</p>
      </div>
    </div>
  )
}

function NoAccess({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas paper-grain p-6">
      <div className="surface p-8 max-w-sm w-full text-center space-y-4">
        <div className="size-11 mx-auto rounded-xl bg-danger/10 flex items-center justify-center">
          <ShieldOff className="size-5 text-danger" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground">حسابك غير مرتبط بشركة</h1>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            قد يكون الاشتراك مجمّداً أو الحساب غير مفعّل. تواصل مع مدير النظام.
          </p>
        </div>
        <Btn variant="outline" onClick={onLogout} className="w-full">تسجيل الخروج</Btn>
      </div>
    </div>
  )
}
