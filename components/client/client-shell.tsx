"use client"

// ================================================================
// الهيكل الرئيسي — يربط كل الشاشات
// ================================================================

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { useAuth } from "@/lib/store"
import { SessionProvider, useSession, useAsyncData } from "@/lib/session"
import { fetchLowStockAction } from "@/app/actions/reports"
import { ToastProvider, Btn, EmptyState } from "./ui"

import { ClientSidebar } from "./client-sidebar"
import { ClientTopbar } from "./client-topbar"

import { ROLE_TABS } from "@/lib/constants"
import type { TabId } from "@/lib/constants"
import type { AuthUser } from "@/lib/types"
import { ShieldOff, Loader2 } from "lucide-react"

/* ================================================================ */
/* ⚡ تحميل الشاشات عند الطلب — لا كلها دفعة واحدة                    */
/* ================================================================ */
/**
 * كان هذا الملف يستورد الشاشات الست عشرة استيراداً مباشراً، فكانت
 * جافاسكربت كلها (~712 كيلوبايت في حزمة واحدة) تنزل قبل ظهور شاشة
 * الدخول أصلاً — والكاشير الذي يعمل على المبيعات فقط كان يحمّل شاشة
 * القيود والميزانية والجرد بلا أي سبب.
 *
 * dynamic() يجعل كل شاشة حزمة منفصلة تُطلب عند فتحها أول مرة فقط،
 * وتبقى محمّلة بعدها. أول تحميل صار أخفّ بكثير.
 *
 * ssr:false لأنها شاشات عميل بالكامل كما كانت تماماً — لم يتغيّر أي
 * سلوك، فقط توقيت التحميل.
 */
const ScreenLoading = () => (
  <div className="flex items-center justify-center py-24">
    <Loader2 className="size-5 animate-spin text-primary" />
  </div>
)

const OverviewTab     = dynamic(() => import("./overview-tab").then((m) => m.OverviewTab),        { ssr: false, loading: ScreenLoading })
const PartiesTab      = dynamic(() => import("./parties-tab").then((m) => m.PartiesTab),          { ssr: false, loading: ScreenLoading })
const SalesTab        = dynamic(() => import("./sales-tab").then((m) => m.SalesTab),              { ssr: false, loading: ScreenLoading })
const PurchasesTab    = dynamic(() => import("./purchases-tab").then((m) => m.PurchasesTab),      { ssr: false, loading: ScreenLoading })
const ExpensesTab     = dynamic(() => import("./expenses-tab").then((m) => m.ExpensesTab),        { ssr: false, loading: ScreenLoading })
const CatalogTab      = dynamic(() => import("./catalog-tab").then((m) => m.CatalogTab),          { ssr: false, loading: ScreenLoading })
const InventoryTab    = dynamic(() => import("./inventory-tab").then((m) => m.InventoryTab),      { ssr: false, loading: ScreenLoading })
const AccountingTab   = dynamic(() => import("./accounting-tab").then((m) => m.AccountingTab),    { ssr: false, loading: ScreenLoading })
const VouchersTab     = dynamic(() => import("./vouchers-tab").then((m) => m.VouchersTab),        { ssr: false, loading: ScreenLoading })
const CashAccountsTab = dynamic(() => import("./vouchers-tab").then((m) => m.CashAccountsTab),    { ssr: false, loading: ScreenLoading })
const ReportsTab      = dynamic(() => import("./reports-tab").then((m) => m.ReportsTab),          { ssr: false, loading: ScreenLoading })
const SettingsTab     = dynamic(() => import("./settings-tab").then((m) => m.SettingsTab),        { ssr: false, loading: ScreenLoading })
const AccountTab      = dynamic(() => import("./account-tab").then((m) => m.AccountTab),          { ssr: false, loading: ScreenLoading })
const UsersTab        = dynamic(() => import("./users-tab").then((m) => m.UsersTab),              { ssr: false, loading: ScreenLoading })

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

  /* 📱 حالة القائمة الجانبية:
     collapsed  = مطويّة إلى أيقونات على الكمبيوتر (كما كانت)
     mobileOpen = مفتوحة كطبقة فوق المحتوى على الهاتف */
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <ClientTopbar
          active={tab}
          onLogout={onLogout}
          onNavigate={setTab}
          onOpenMenu={() => setMobileOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {/* حشوة أصغر على الهاتف — كل بكسل يفرق على شاشة 360 */}
          <div className="mx-auto max-w-[1400px] p-3 sm:p-5 lg:p-6">
            {/*
              ⚡ كانت هذه الحركة البسيطة (تلاشٍ 0.16 ثانية) تستدعي
              مكتبة framer-motion كاملة — أكثر من 100 كيلوبايت تنزل
              مع كل زيارة من أجل تأثير واحد. استبدلناها بأنيميشن CSS
              موجود أصلاً في globals.css. نفس الشكل تماماً، بلا مكتبة.
            */}
            <div key={tab} className="animate-rise">
              <TabContent tab={tab} onNavigate={setTab} />
            </div>
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
