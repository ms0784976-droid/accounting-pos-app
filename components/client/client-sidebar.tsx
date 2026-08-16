"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  BarChart3, BookText, ChevronRight, LayoutDashboard,
  PackagePlus, PanelRight, Receipt, Users, UsersRound,
  Calculator, Archive,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { TabId } from "@/lib/constants"
import { TAB_LABELS } from "@/lib/constants"
import type { LucideIcon } from "lucide-react"

const TAB_ICONS: Record<TabId, LucideIcon> = {
  overview:  LayoutDashboard,
  catalog:   Archive,
  sales:     Receipt,
  purchases: PackagePlus,
  customers: Users,
  ledger:    BookText,
  reports:   BarChart3,
  users:     UsersRound,
}

function NavList({ tabs, active, onSelect, collapsed }: {
  tabs: TabId[]; active: TabId; onSelect: (id: TabId) => void; collapsed: boolean
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {tabs.map((tabId) => {
        const Icon = TAB_ICONS[tabId]
        const isActive = active === tabId
        return (
          <button
            key={tabId} type="button"
            onClick={() => onSelect(tabId)}
            title={collapsed ? TAB_LABELS[tabId] : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="nav-active"
                className="absolute right-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-sidebar-primary"
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
              />
            )}
            <Icon className="size-5 shrink-0" />
            {!collapsed && <span className="truncate">{TAB_LABELS[tabId]}</span>}
          </button>
        )
      })}
    </nav>
  )
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5 px-5 py-5", collapsed && "justify-center px-0")}>
      <div className="size-9 shrink-0 rounded-xl bg-sidebar-primary flex items-center justify-center">
        <Calculator className="size-5 text-sidebar-primary-foreground" />
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-foreground">مُحاسِب</p>
          <p className="text-xs text-sidebar-foreground/50">محاسبة ونقاط البيع</p>
        </div>
      )}
    </div>
  )
}

export function ClientSidebar({ allowedTabs, active, onSelect, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: {
  allowedTabs: TabId[]; active: TabId; onSelect: (id: TabId) => void
  collapsed: boolean; onToggleCollapse: () => void; mobileOpen: boolean; onCloseMobile: () => void
}) {
  return (
    <>
      <aside className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-l border-sidebar-border bg-sidebar transition-[width] duration-300 lg:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}>
        <Brand collapsed={collapsed} />
        <NavList tabs={allowedTabs} active={active} onSelect={onSelect} collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button" onClick={onToggleCollapse}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent/50",
              collapsed && "justify-center px-0"
            )}
          >
            <ChevronRight className={cn("size-5 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span>طي القائمة</span>}
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onCloseMobile}
            />
            <motion.aside
              initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="absolute right-0 flex h-full w-64 flex-col border-l border-sidebar-border bg-sidebar"
            >
              <div className="flex items-center justify-between pl-3">
                <Brand collapsed={false} />
                <button
                  type="button" onClick={onCloseMobile}
                  className="size-8 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 flex items-center justify-center"
                >
                  <PanelRight className="size-4" />
                </button>
              </div>
              <NavList
                tabs={allowedTabs} active={active}
                onSelect={(id) => { onSelect(id); onCloseMobile() }}
                collapsed={false}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
