"use client"

// ================================================================
// الشريط الجانبي — قائمة مجمّعة بدل قائمة مسطّحة طويلة
// ================================================================

import { useState } from "react"
import { cn } from "@/lib/utils"
import { NAV_GROUPS, TAB_LABELS, type TabId } from "@/lib/constants"
import { useSession } from "@/lib/session"
import {
  LayoutDashboard, ShoppingCart, Truck, Receipt, TrendingDown, TrendingUp,
  Users, Factory, Package, Boxes, BookOpen, Wallet, BarChart3,
  UserCog, Settings, CircleUser,
  PanelRightClose, PanelRightOpen,
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

export function ClientSidebar({ active, onNavigate, badges }: {
  active: TabId
  onNavigate: (tab: TabId) => void
  /** أرقام تنبيه بجانب التبويبات، مثل عدد الأصناف تحت الحد الأدنى */
  badges?: Partial<Record<TabId, number>>
}) {
  const { user, company, canSee } = useSession()
  const [collapsed, setCollapsed] = useState(false)

  const groups = NAV_GROUPS
    .map((g) => ({ ...g, tabs: g.tabs.filter(canSee) }))
    .filter((g) => g.tabs.length > 0)

  return (
    <aside
      className={cn(
        "sidebar no-print flex flex-col shrink-0 bg-sidebar text-sidebar-foreground",
        "border-l border-sidebar-border transition-[width] duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* ── الهوية ── */}
      <div className={cn(
        "flex items-center gap-2.5 px-3 py-4 border-b border-sidebar-border",
        collapsed && "justify-center px-0"
      )}>
        <div className="size-8 shrink-0 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground
                        flex items-center justify-center font-bold text-sm">
          م
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-sidebar-accent-foreground truncate">مُحاسِب</p>
            <p className="text-[11px] text-sidebar-muted truncate">{company?.name ?? "…"}</p>
          </div>
        )}
      </div>

      {/* ── القائمة ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {groups.map((group) => (
          <div key={group.id}>
            {group.label && !collapsed && (
              <p className="px-2.5 pb-1.5 text-[11px] font-medium text-sidebar-muted">
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
                    onClick={() => onNavigate(tab)}
                    title={collapsed ? TAB_LABELS[tab] : undefined}
                    className={cn(
                      "group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2",
                      "text-[13px] font-medium transition text-right",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {isActive && (
                      <span className="absolute right-0 inset-y-1.5 w-0.5 rounded-l bg-sidebar-primary" />
                    )}
                    <Icon className="size-[18px] shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{TAB_LABELS[tab]}</span>}
                    {!collapsed && badge !== undefined && badge > 0 && (
                      <span className="num shrink-0 rounded-full bg-warning/25 text-warning
                                       px-1.5 py-0.5 text-[10px] font-semibold">
                        {badge}
                      </span>
                    )}
                    {collapsed && badge !== undefined && badge > 0 && (
                      <span className="absolute top-1 left-1 size-1.5 rounded-full bg-warning" />
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
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-1.5 py-2 mb-1">
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
        )}

        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
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
