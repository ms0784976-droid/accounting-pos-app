"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, Menu, Moon, Plus, Search, Sun, LogOut } from "lucide-react"
import { useClientStore, useAuth } from "@/lib/store"
import { CURRENCIES, ROLE_META } from "@/lib/constants"
import { cn } from "@/lib/utils"

export function ClientTopbar({ title, search, onSearch, onOpenMobile, theme, onToggleTheme, onNewSale }: {
  title: string
  search: string
  onSearch: (v: string) => void
  onOpenMobile: () => void
  theme: "light" | "dark"
  onToggleTheme: () => void
  onNewSale: () => void
}) {
  const { currentTenantUser, tenantUsers, setCurrentTenantUserId, currency, setCurrencyCode } = useClientStore()
  const { logout } = useAuth()
  const [userOpen, setUserOpen] = useState(false)
  const [curOpen, setCurOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)
  const curRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
      if (curRef.current && !curRef.current.contains(e.target as Node)) setCurOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const meta = ROLE_META[currentTenantUser.role]
  const initials = currentTenantUser.name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("")

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        {/* Mobile menu */}
        <button
          type="button"
          onClick={onOpenMobile}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        {/* Title */}
        <div className="hidden md:block min-w-0">
          <h1 className="truncate text-base font-bold text-foreground">{title}</h1>
        </div>

        {/* Search */}
        <div className="relative flex-1 md:mx-4 md:max-w-md">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="بحث..."
            className="h-10 w-full rounded-xl border border-input bg-card pr-9 pl-3 text-sm text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Currency picker */}
          <div ref={curRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setCurOpen((v) => !v)}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-input bg-card px-3 text-sm font-medium hover:bg-muted transition"
            >
              <span className="text-muted-foreground">{currency.symbol}</span>
              {currency.code}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
            <AnimatePresence>
              {curOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg"
                >
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setCurrencyCode(c.code); setCurOpen(false) }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted transition"
                    >
                      <span>
                        <span className="ml-2 text-muted-foreground">{c.symbol}</span>
                        {c.code} — {c.label}
                      </span>
                      {c.code === currency.code && <Check className="size-4 text-primary" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-input bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          {/* New sale button */}
          <button
            type="button"
            onClick={onNewSale}
            className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">فاتورة جديدة</span>
          </button>

          {/* User switcher */}
          <div ref={userRef} className="relative">
            <button
              type="button"
              onClick={() => setUserOpen((v) => !v)}
              className="flex h-10 items-center gap-2 rounded-xl border border-input bg-card pr-1.5 pl-2 shadow-sm hover:bg-muted transition"
            >
              <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {initials}
              </span>
              <span className="hidden text-right leading-tight sm:block">
                <span className="block max-w-28 truncate text-sm font-medium text-foreground">{currentTenantUser.name}</span>
                <span className="block text-xs text-muted-foreground">{meta.label}</span>
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>

            <AnimatePresence>
              {userOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg"
                >
                  <p className="px-3 py-2 text-xs font-medium text-muted-foreground">تبديل المستخدم (تجريبي)</p>
                  {tenantUsers.map((u) => {
                    const m = ROLE_META[u.role]
                    const isActive = u.id === currentTenantUser.id
                    const uInitials = u.name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("")
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setCurrentTenantUserId(u.id); setUserOpen(false) }}
                        className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-right hover:bg-muted transition", isActive && "bg-muted")}
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{uInitials}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-popover-foreground">{u.name}</span>
                          <span className="block text-xs text-muted-foreground">{m.label}</span>
                        </span>
                        {isActive && <Check className="size-4 text-primary" />}
                      </button>
                    )
                  })}
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-right text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition"
                    >
                      <LogOut className="size-4" />
                      تسجيل الخروج
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
