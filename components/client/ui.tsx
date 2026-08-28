"use client"

// ================================================================
// مُحاسِب — مكتبة العناصر المشتركة
// ================================================================

import { cn } from "@/lib/utils"
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react"
import { X, Search, Check, AlertTriangle, Info, Loader2, ChevronDown, Inbox } from "lucide-react"
import { CURRENCY_MAP } from "@/lib/constants"

/* ================================================================ */
/* تنسيق الأرقام والتواريخ                                           */
/* ================================================================ */

/** يعرض المبلغ بأرقام إنجليزية مصطفّة عمودياً — المعيار في التقارير المالية */
export function formatMoney(value: number, currency = "ILS", showSymbol = true): string {
  const meta = CURRENCY_MAP.get(currency)
  const decimals = meta?.decimals ?? 2
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value))

  const sign = value < 0 ? "−" : ""
  return showSymbol ? `${sign}${formatted} ${meta?.symbol ?? ""}`.trim() : `${sign}${formatted}`
}

export function formatQty(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value)
}

export function formatDate(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d)
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(d)
}

/** رقم مالي جاهز للعرض — يتلوّن حسب الإشارة عند الطلب */
export function Money({ value, currency = "ILS", colored = false, bold = false, className }: {
  value: number
  currency?: string
  colored?: boolean
  bold?: boolean
  className?: string
}) {
  const tone = !colored ? "" : value > 0 ? "text-success" : value < 0 ? "text-danger" : "text-muted-foreground"
  return (
    <span className={cn("num tabular", bold && "font-semibold", tone, className)}>
      {formatMoney(value, currency)}
    </span>
  )
}

/* ================================================================ */
/* الهيكل                                                            */
/* ================================================================ */

export function PageHeader({ title, subtitle, actions, children }: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

export function SectionCard({ title, description, action, children, className, padded = false }: {
  title?: string
  description?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={cn("surface overflow-hidden", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  )
}

/* ================================================================ */
/* بطاقات المؤشرات                                                   */
/* ================================================================ */

const TONES = {
  neutral: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  danger:  "text-danger",
  warning: "text-warning",
} as const

export function StatCard({ label, value, hint, hintTone, icon: Icon, tone = "neutral", onClick }: {
  label: string
  value: string
  hint?: string
  hintTone?: keyof typeof TONES
  icon?: React.ElementType
  tone?: keyof typeof TONES
  onClick?: () => void
}) {
  const Wrapper = onClick ? "button" : "div"
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "surface p-4 text-right w-full",
        onClick && "transition hover:border-border-strong hover:shadow-raised cursor-pointer"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground/70 shrink-0" />}
      </div>
      <p className={cn("text-xl font-semibold num tabular", TONES[tone])}>{value}</p>
      {hint && (
        <p className={cn("text-[11px] mt-1", TONES[hintTone ?? "neutral"], !hintTone && "text-muted-foreground")}>
          {hint}
        </p>
      )}
    </Wrapper>
  )
}

/* ================================================================ */
/* الجداول                                                           */
/* ================================================================ */

export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm tabular">{children}</table>
    </div>
  )
}

export function Th({ children, align = "right", width, className, colSpan }: {
  children?: ReactNode
  align?: "right" | "left" | "center"
  width?: string
  className?: string
  colSpan?: number
}) {
  return (
    <th
      colSpan={colSpan}
      style={width ? { width } : undefined}
      className={cn(
        "px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap",
        align === "left" && "text-left",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, align = "right", mono, className, colSpan, rowSpan, onClick }: {
  children?: ReactNode
  align?: "right" | "left" | "center"
  mono?: boolean
  className?: string
  /** يجب تمريرها للـ <td> فعلياً — تجاهلها يسبّب React error #441 */
  colSpan?: number
  rowSpan?: number
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void
}) {
  return (
    <td
      colSpan={colSpan}
      rowSpan={rowSpan}
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 text-foreground",
        align === "left" && "text-left",
        align === "center" && "text-center",
        mono && "num",
        className
      )}
    >
      {children}
    </td>
  )
}

export function Tr({ children, onClick, muted, className }: {
  children: ReactNode
  onClick?: () => void
  muted?: boolean
  className?: string
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-t border-border",
        onClick && "row-hover cursor-pointer",
        muted && "text-muted-foreground",
        className
      )}
    >
      {children}
    </tr>
  )
}

/** صف الإجماليات أسفل الجدول */
export function TotalRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-t-2 border-border-strong bg-muted/50 font-semibold">
      {children}
    </tr>
  )
}

/* ================================================================ */
/* الحالات                                                           */
/* ================================================================ */

export function EmptyState({ message = "لا توجد بيانات", hint, action, icon: Icon = Inbox }: {
  message?: string
  hint?: string
  action?: ReactNode
  icon?: React.ElementType
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-2">
      <div className="size-11 rounded-xl bg-muted flex items-center justify-center mb-1">
        <Icon className="size-5 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {hint && <p className="text-xs text-muted-foreground max-w-xs">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton h-8 rounded-md flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-danger/8 border border-danger/25 px-3 py-2 text-xs text-danger">
      <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
      <span className="leading-relaxed">{message}</span>
    </div>
  )
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-primary-soft border border-primary/20 px-3 py-2 text-xs text-foreground/80">
      <Info className="size-3.5 shrink-0 mt-0.5 text-primary" />
      <span className="leading-relaxed">{children}</span>
    </div>
  )
}

/* ================================================================ */
/* الحقول                                                            */
/* ================================================================ */

export function Field({ label, hint, error, required, children }: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
    </div>
  )
}

const FIELD_BASE =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground " +
  "placeholder:text-muted-foreground/50 transition " +
  "focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 " +
  "disabled:opacity-55 disabled:cursor-not-allowed"

export function TextInput({ className, invalid, ...props }:
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
) {
  return (
    <input
      {...props}
      className={cn(FIELD_BASE, invalid && "border-danger focus:border-danger focus:ring-danger/20", className)}
    />
  )
}

/** حقل رقمي — محاذاة يسار وأرقام مصطفّة */
export function NumberInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode="decimal"
      {...props}
      className={cn(FIELD_BASE, "num text-left", className)}
    />
  )
}

export function SelectInput({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={cn(FIELD_BASE, "appearance-none pl-8", className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
    </div>
  )
}

export function TextArea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(FIELD_BASE, "h-auto min-h-20 py-2 leading-relaxed resize-y", className)}
    />
  )
}

export function SearchBox({ value, onChange, placeholder = "بحث..." }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(FIELD_BASE, "pr-9", value && "pl-8")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="مسح البحث"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function DateRangePicker({ from, to, onChange }: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="date" value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className={cn(FIELD_BASE, "w-auto num")}
      />
      <span className="text-xs text-muted-foreground">إلى</span>
      <input
        type="date" value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className={cn(FIELD_BASE, "w-auto num")}
      />
    </div>
  )
}

/* ================================================================ */
/* الأزرار                                                           */
/* ================================================================ */

export function Btn({
  children, onClick, type = "button", variant = "primary",
  disabled, loading, size = "md", className, icon: Icon,
}: {
  children?: ReactNode
  onClick?: () => void
  type?: "button" | "submit"
  variant?: "primary" | "outline" | "ghost" | "danger" | "success"
  disabled?: boolean
  loading?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
  icon?: React.ElementType
}) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-card",
    outline: "border border-border-strong bg-card hover:bg-muted text-foreground",
    ghost:   "hover:bg-muted text-muted-foreground hover:text-foreground",
    danger:  "bg-danger text-danger-foreground hover:bg-danger/90",
    success: "bg-success text-success-foreground hover:bg-success/90",
  }
  const sizes = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-9 px-4 text-sm gap-2", lg: "h-11 px-6 text-sm gap-2" }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition",
        "active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant], sizes[size], className
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" />}
      {children}
    </button>
  )
}

export function IconBtn({ icon: Icon, label, onClick, tone = "ghost" }: {
  icon: React.ElementType
  label: string
  onClick?: () => void
  tone?: "ghost" | "danger"
}) {
  return (
    <button
      type="button" onClick={onClick} title={label} aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg transition",
        tone === "danger"
          ? "text-muted-foreground hover:bg-danger/10 hover:text-danger"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}

/* ================================================================ */
/* الشارات                                                           */
/* ================================================================ */

export function Badge({ label, tint, className }: { label: string; tint?: string; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
      tint ?? "bg-muted text-muted-foreground", className
    )}>
      {label}
    </span>
  )
}

/** شارة رصيد محاسبي: مدين / دائن / مسدّد */
export function BalanceBadge({ balance, currency = "ILS" }: { balance: number; currency?: string }) {
  if (Math.abs(balance) < 0.01) {
    return <Badge label="مسدّد" tint="bg-muted text-muted-foreground" />
  }
  const isDebit = balance > 0
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium",
      isDebit ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
    )}>
      <span className="num">{formatMoney(Math.abs(balance), currency)}</span>
      <span className="opacity-75">{isDebit ? "عليه" : "له"}</span>
    </span>
  )
}

/* ================================================================ */
/* النوافذ والأدراج                                                  */
/* ================================================================ */

export function Modal({ open, onClose, title, description, footer, size = "md", children }: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  footer?: ReactNode
  size?: "sm" | "md" | "lg" | "xl"
  children?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-foreground/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn(
        "relative w-full max-h-[88vh] flex flex-col animate-rise",
        "bg-card border border-border rounded-2xl shadow-overlay", widths[size]
      )}>
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <IconBtn icon={X} label="إغلاق" onClick={onClose} />
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-muted/30">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/** درج جانبي — لكشوف الحسابات وتفاصيل المستندات */
export function Drawer({ open, onClose, title, description, footer, children }: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  footer?: ReactNode
  children?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 no-print" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-foreground/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-full max-w-2xl flex flex-col bg-card border-l border-border shadow-overlay">
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <IconBtn icon={X} label="إغلاق" onClick={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-muted/30">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/** تأكيد الإجراءات الخطرة — يطلب سبباً عند الحاجة */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "تأكيد", tone = "danger", requireReason }: {
  open: boolean
  onClose: () => void
  onConfirm: (reason?: string) => void | Promise<void>
  title: string
  message: string
  confirmLabel?: string
  tone?: "danger" | "primary"
  requireReason?: boolean
}) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { if (open) { setReason(""); setError("") } }, [open])

  const handle = async () => {
    if (requireReason && !reason.trim()) { setError("السبب مطلوب"); return }
    setBusy(true)
    try { await onConfirm(reason.trim() || undefined); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : "حدث خطأ") }
    finally { setBusy(false) }
  }

  return (
    <Modal
      open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn variant={tone} onClick={handle} loading={busy}>{confirmLabel}</Btn>
        </>
      }
    >
      <p className="text-sm text-foreground/85 leading-relaxed">{message}</p>
      {requireReason && (
        <div className="mt-4">
          <Field label="السبب" required>
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب سبب الإلغاء — سيُحفظ في السجل"
            />
          </Field>
        </div>
      )}
      {error && <div className="mt-3"><InlineError message={error} /></div>}
    </Modal>
  )
}

/* ================================================================ */
/* التنبيهات                                                         */
/* ================================================================ */

type Toast = { id: number; message: string; tone: "success" | "error" | "info" }
const ToastCtx = createContext<{ notify: (m: string, t?: Toast["tone"]) => void }>({ notify: () => {} })

export function useToast() { return useContext(ToastCtx) }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const icons = { success: Check, error: AlertTriangle, info: Info }
  const tints = {
    success: "border-success/30 bg-success/10 text-success",
    error:   "border-danger/30 bg-danger/10 text-danger",
    info:    "border-primary/30 bg-primary-soft text-primary",
  }

  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-5 left-5 z-[60] flex flex-col gap-2 no-print">
        {toasts.map((t) => {
          const Icon = icons[t.tone]
          return (
            <div key={t.id} className={cn(
              "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-raised",
              "bg-card animate-rise max-w-sm", tints[t.tone]
            )}>
              <Icon className="size-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

/* ================================================================ */
/* التبويبات الفرعية                                                 */
/* ================================================================ */

export function TabBar<T extends string>({ tabs, active, onChange }: {
  tabs: { id: T; label: string; count?: number }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition",
            active === t.id
              ? "text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary after:rounded-t"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="mr-1.5 text-[11px] text-muted-foreground num">({t.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ================================================================ */
/* أدوات مساعدة                                                      */
/* ================================================================ */

/** ينزّل ملفاً من نص — للنسخ الاحتياطي وتصدير CSV */
export function downloadFile(filename: string, content: string, mime = "application/json") {
  const blob = new Blob(["\uFEFF" + content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** تصدير جدول إلى CSV يفتح في Excel بالعربي بلا تشويش */
export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "")
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n")
  downloadFile(filename, csv, "text/csv")
}

/** يطبع منطقة محددة فقط */
export function printArea() {
  window.print()
}
