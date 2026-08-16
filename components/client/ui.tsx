"use client"

import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

// ── Section Card ─────────────────────────────────────────────────────────
export function SectionCard({ title, description, action, children, className }: {
  title: string
  description?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-2xl bg-card border border-border overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────
const toneMap = {
  primary: { bg: "bg-primary/10", text: "text-primary", val: "text-foreground" },
  success: { bg: "bg-success/10", text: "text-success", val: "text-success" },
  danger:  { bg: "bg-danger/10",  text: "text-danger",  val: "text-danger" },
  warning: { bg: "bg-warning/10", text: "text-warning", val: "text-foreground" },
  info:    { bg: "bg-blue-500/10",text: "text-blue-600",val: "text-foreground" },
}
type Tone = keyof typeof toneMap

export function StatCard({ label, value, hint, icon: Icon, tone = "primary" }: {
  label: string; value: string; hint?: string; icon: React.ElementType; tone?: Tone
}) {
  const t = toneMap[tone]
  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={cn("size-9 rounded-xl flex items-center justify-center", t.bg)}>
          <Icon className={cn("size-4", t.text)} />
        </div>
      </div>
      <p className={cn("text-2xl font-bold tabular-nums", t.val)}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────
export function EmptyState({ message = "لا توجد بيانات" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-1">
        <span className="text-2xl opacity-40">📋</span>
      </div>
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, footer, children }: {
  open: boolean; onClose: () => void; title: string; footer?: ReactNode; children?: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-5">{title}</h2>
        {children}
        {footer && (
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Field ──────────────────────────────────────────────────────────────────
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ── Text Input ────────────────────────────────────────────────────────────
export function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition",
        className
      )}
    />
  )
}

// ── Select Input ──────────────────────────────────────────────────────────
export function SelectInput({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition",
        className
      )}
    >
      {children}
    </select>
  )
}

// ── Badges ───────────────────────────────────────────────────────────────
export function PaymentStatusBadge({ status }: { status: "paid" | "partial" | "overdue" }) {
  const cfg = {
    paid:    { label: "مسدّد",   cls: "bg-success/10 text-success" },
    partial: { label: "جزئي",   cls: "bg-warning/10 text-warning" },
    overdue: { label: "متأخر",  cls: "bg-danger/10 text-danger" },
  }[status]
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.cls)}>{cfg.label}</span>
}

export function MethodBadge({ method }: { method: "cash" | "card" | "debt" }) {
  const cfg = {
    cash: { label: "نقدي",      cls: "bg-success/10 text-success" },
    card: { label: "بطاقة",     cls: "bg-blue-500/10 text-blue-600" },
    debt: { label: "آجل/دين",   cls: "bg-danger/10 text-danger" },
  }[method]
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.cls)}>{cfg.label}</span>
}

export function LedgerTypeBadge({ type }: { type: "purchase" | "sale" | "return" | "adjustment" }) {
  const cfg = {
    purchase:   { label: "مشتريات", cls: "bg-warning/10 text-warning" },
    sale:       { label: "مبيعات",  cls: "bg-success/10 text-success" },
    return:     { label: "مردودات", cls: "bg-blue-500/10 text-blue-600" },
    adjustment: { label: "تعديل",  cls: "bg-muted text-muted-foreground" },
  }[type]
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.cls)}>{cfg.label}</span>
}

export function RoleBadge({ role }: { role: string }) {
  const labels: Record<string, { label: string; cls: string }> = {
    admin:      { label: "مدير النظام", cls: "bg-primary/10 text-primary" },
    accountant: { label: "محاسب",       cls: "bg-blue-500/10 text-blue-600" },
    inventory:  { label: "أمين المخزن", cls: "bg-amber-500/10 text-amber-600" },
    cashier:    { label: "كاشير",        cls: "bg-green-500/10 text-green-600" },
  }
  const cfg = labels[role] ?? { label: role, cls: "bg-muted text-muted-foreground" }
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.cls)}>{cfg.label}</span>
}

// ── Btn ───────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = "primary", disabled, size = "md", className }: {
  children: ReactNode
  onClick?: () => void
  variant?: "primary" | "outline" | "ghost" | "danger"
  disabled?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-border bg-transparent hover:bg-muted text-foreground",
    ghost:   "bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground",
    danger:  "bg-danger/10 text-danger hover:bg-danger/20",
  }
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-11 px-6 text-sm" }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </button>
  )
}
