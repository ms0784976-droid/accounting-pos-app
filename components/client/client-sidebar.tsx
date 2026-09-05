"use client"

// ================================================================
// الشريط الجانبي — قائمة مجمّعة بدل قائمة مسطّحة طويلة
// ================================================================
// 📱 دعم الهاتف:
// كان الشريط ثابتاً في مكانه دائماً، فعلى شاشة الهاتف يأكل 240 بكسل
// من عرض 360 — أي ثلثي الشاشة — ويصير الجدول غير قابل للقراءة.
//
// الآن:
//   • على الهاتف (أقل من lg): الشريط مخفي، ويُفتح بزر القائمة في
//     الشريط العلوي كطبقة فوق المحتوى مع خلفية معتمة. يُغلق تلقائياً
//     بمجرد اختيار شاشة، وبزر ×، وبالضغط على الخلفية، وبمفتاح Esc.
//   • على الكمبيوتر (lg فأكثر): كما كان تماماً — ثابت في مكانه مع
//     زر "طيّ القائمة" الذي يصغّره إلى أيقونات فقط.

import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { NAV_GROUPS, TAB_LABELS, type TabId } from "@/lib/constants"
import { useSession } from "@/lib/session"
import {
  LayoutDashboard, ShoppingCart, Truck, Receipt, TrendingDown, TrendingUp,
  Users, Factory, Package, Boxes, BookOpen, Wallet, BarChart3,
  UserCog, Settings, CircleUser,
  PanelRightClose, PanelRightOpen, X,
} from "lucide-react"

const ICONS: Record<TabId, React.ElementType> = {
  overview: LayoutDashboard,
  sales: ShoppingCart,
  purchases: Truck,
  vouchers: Receipt,
  expenses: TrendingDown,
  revenues: TrendingUp,
  customers: Users,
  suppliers: Factory,
  catalog: Package,
  inventory: Boxes,
  accounting: BookOpen,
  "cash-accounts": Wallet,
  reports: BarChart3,
  users: UserCog,
  settings: Settings,
  account: CircleUser,
}

export function ClientSidebar({
  active, onNavigate, badges,
  collapsed, onToggleCollapsed,
  mobileOpen, onCloseMobile,
}: {
  active: TabId
  onNavigate: (tab: TabId) => void
  /** أرقام تنبيه بجانب التبويبات، مثل عدد الأصناف تحت الحد الأدنى */
  badges?: Partial<Record<TabId, number>>
  /** مطويّ إلى أيقونات فقط — على الكمبيوتر */
  collapsed: boolean
  onToggleCollapsed: () => void
  /** مفتوح كطبقة فوق المحتوى — على الهاتف */
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const { user, company, canSee } = useSession()

  const groups = NAV_GROUPS
    .map((g) => ({ ...g, tabs: g.tabs.filter(canSee) }))
    .filter((g) => g.tabs.length > 0)

  /* Esc يغلق القائمة على الهاتف، ونمنع تمرير الصفحة خلفها */
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseMobile() }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [mobileOpen, onCloseMobile])

  /** اختيار شاشة على الهاتف يُغلق القائمة مباشرة */
  const pick = (tab: TabId) => {
    onNavigate(tab)
    onCloseMobile()
  }

  return (
    <>
      {/* الخلفية المعتمة — على الهاتف فقط */}
      {mobileOpen && (
        <button
          aria-label="إغلاق القائمة"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-foreground/50 backdrop-blur-[2px] lg:hidden no-print"
        />
      )}

      <aside
        className={cn(
          "sidebar no-print flex flex-col bg-sidebar text-sidebar-foreground",
          "border-l border-sidebar-border",
          // ── الهاتف: طبقة منزلقة من اليمين ──
          "fixed inset-y-0 right-0 z-50 w-64 shadow-2xl",
          "transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "translate-x-full",
          // ── الكمبيوتر: ثابت في مكانه كما كان ──
          "lg:static lg:z-auto lg:translate-x-0 lg:shadow-none lg:shrink-0",
          "lg:transition-[width] lg:duration-200",
          collapsed ? "lg:w-16" : "lg:w-60"
        )}
      >
        {/* ── الهوية ── */}
        <div className={cn(
          "flex items-center gap-2.5 px-3 py-4 border-b border-sidebar-border",
          collapsed && "lg:justify-center lg:px-0"
        )}>
          <div className="size-8 shrink-0 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground
                          flex items-center justify-center font-bold text-sm">
            م
          </div>
          <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
            <p className="text-sm font-semibold text-sidebar-accent-foreground truncate">مُحاسِب</p>
            <p className="text-[11px] text-sidebar-muted truncate">{company?.name ?? "…"}</p>
          </div>

          {/* زر الإغلاق — على الهاتف فقط */}
          <button
            onClick={onCloseMobile}
            aria-label="إغلاق القائمة"
            className="lg:hidden -ml-1 flex size-8 shrink-0 items-center justify-center rounded-lg
                       text-sidebar-foreground/70 transition hover:bg-sidebar-accent/60
                       hover:text-sidebar-accent-foreground"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        {/* ── القائمة ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {groups.map((group) => (
            <div key={group.id}>
              {group.label && (
                <p className={cn(
                  "px-2.5 pb-1.5 text-[11px] font-medium text-sidebar-muted",
                  collapsed && "lg:hidden"
                )}>
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.tabs.map((tab) => {
                  const Icon = ICONS[tab]
                  const isActive = active === tab
                  const badge = badges?.[tab]

                  return (
                    <button
                      key={tab}
                      onClick={() => pick(tab)}
                      title={collapsed ? TAB_LABELS[tab] : undefined}
                      className={cn(
                        "group relative w-full flex items-center gap-2.5 rounded-lg px-2.5",
                        // مساحة لمس أكبر على الهاتف — الأصابع لا تصيب 32 بكسل بدقة
                        "py-2.5 lg:py-2 text-[14px] lg:text-[13px] font-medium transition text-right",
                        collapsed && "lg:justify-center lg:px-0",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {isActive && (
                        <span className="absolute right-0 inset-y-1.5 w-0.5 rounded-l bg-sidebar-primary" />
                      )}
                      <Icon className="size-[18px] shrink-0" />
                      <span className={cn("flex-1 truncate", collapsed && "lg:hidden")}>
                        {TAB_LABELS[tab]}
                      </span>
                      {badge !== undefined && badge > 0 && (
                        <>
                          <span className={cn(
                            "num shrink-0 rounded-full bg-warning/25 text-warning",
                            "px-1.5 py-0.5 text-[10px] font-semibold",
                            collapsed && "lg:hidden"
                          )}>
                            {badge}
                          </span>
                          {collapsed && (
                            <span className="hidden lg:block absolute top-1 left-1 size-1.5 rounded-full bg-warning" />
                          )}
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── المستخدم الحالي (عرض فقط — لا تبديل) ── */}
        <div className="border-t border-sidebar-border p-2">
          <div className={cn("flex items-center gap-2.5 px-1.5 py-2 mb-1", collapsed && "lg:hidden")}>
            <div className="size-7 shrink-0 rounded-full bg-sidebar-accent
                            flex items-center justify-center text-[11px] font-semibold
                            text-sidebar-accent-foreground">
              {user.name.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-sidebar-muted truncate">{roleLabel(user.role)}</p>
            </div>
          </div>

          {/* زر الطيّ — على الكمبيوتر فقط، فعلى الهاتف القائمة تُغلق كاملة */}
          <button
            onClick={onToggleCollapsed}
            className={cn(
              "hidden lg:flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
              "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed
              ? <PanelRightOpen className="size-[18px]" />
              : <><PanelRightClose className="size-[18px]" /><span>طيّ القائمة</span></>}
          </button>
        </div>
      </aside>
    </>
  )
}

function roleLabel(role: string | null): string {
  return {
    admin: "مدير النظام",
    accountant: "محاسب",
    inventory: "أمين المخزن",
    cashier: "كاشير",
  }[role ?? ""] ?? "مستخدم"
}
