"use client"

// ================================================================
// البحث العام — Ctrl+K
// ================================================================
// إضافة جديدة. لم يكن في البرنامج أي بحث شامل: للوصول إلى زبون
// كان عليك فتح تبويب الزبائن ثم البحث داخله، وللوصول إلى فاتورة
// عليك معرفة شهرها أولاً لأن قائمة الفواتير تعرض الشهر الحالي.
//
// الآن: Ctrl+K (أو الضغط على شريط البحث في الأعلى) من أي مكان،
// اكتب اسم زبون أو صنف أو رقم فاتورة، واضغط Enter — ينقلك للشاشة
// المطلوبة مباشرة.
//
// الشرطة المائلة "/" تفتحه أيضاً، وهذا ما يحفظه أهل الكيبورد.

import { useState, useEffect, useRef, useCallback } from "react"
import { globalSearchAction, type SearchHit } from "@/app/actions/bundles"
import { formatMoney } from "./ui"
import { useSession } from "@/lib/session"
import type { TabId } from "@/lib/constants"
import { Search, Package, User, FileText, Loader2, CornerDownLeft } from "lucide-react"

const KIND_META: Record<SearchHit["kind"], { icon: React.ElementType; label: string; tab: TabId }> = {
  product: { icon: Package,  label: "صنف",   tab: "catalog" },
  party:   { icon: User,     label: "جهة",   tab: "customers" },
  invoice: { icon: FileText, label: "فاتورة", tab: "sales" },
}

export function GlobalSearch({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { currency } = useSession()
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [busy, setBusy] = useState(false)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  /* ── فتح وإغلاق ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(true)
        return
      }
      if (e.key === "/" && !typing) {
        e.preventDefault()
        setOpen(true)
        return
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
    setTerm("")
    setHits([])
    setCursor(0)
  }, [open])

  /* ── البحث مع مهلة قصيرة حتى لا نُرهق السيرفر بكل حرف ── */
  useEffect(() => {
    const q = term.trim()
    if (q.length < 2) {
      setHits([])
      setBusy(false)
      return
    }
    setBusy(true)
    let cancelled = false
    const t = setTimeout(() => {
      globalSearchAction(q)
        .then((res) => { if (!cancelled) { setHits(res); setCursor(0) } })
        .catch(() => { if (!cancelled) setHits([]) })
        .finally(() => { if (!cancelled) setBusy(false) })
    }, 220)
    return () => { cancelled = true; clearTimeout(t) }
  }, [term])

  const go = useCallback((hit: SearchHit) => {
    setOpen(false)
    onNavigate(KIND_META[hit.kind].tab)
  }, [onNavigate])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)) }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    if (e.key === "Enter" && hits[cursor]) { e.preventDefault(); go(hits[cursor]) }
  }

  return (
    <>
      {/* الزرّ في الشريط العلوي */}
      <button
        onClick={() => setOpen(true)}
        title="بحث شامل (Ctrl + K)"
        className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-muted/60
                   px-3 py-1.5 text-xs text-muted-foreground transition
                   hover:border-border-strong hover:bg-muted min-w-[230px]"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 text-right">ابحث عن زبون أو صنف أو فاتورة</span>
        <kbd className="rounded border border-border bg-card px-1.5 py-px text-[10px]">Ctrl K</kbd>
      </button>

      {/* زرّ مصغّر للشاشات الصغيرة */}
      <button
        onClick={() => setOpen(true)}
        aria-label="بحث شامل"
        className="md:hidden inline-flex size-8 items-center justify-center rounded-lg
                   text-muted-foreground hover:bg-muted transition"
      >
        <Search className="size-4" />
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh] no-print">
          <div className="absolute inset-0 bg-foreground/45 backdrop-blur-[2px]"
               onClick={() => setOpen(false)} />

          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border
                          bg-card shadow-overlay animate-rise">
            <div className="relative border-b border-border">
              {busy
                ? <Loader2 className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 size-4 animate-spin text-primary" />
                : <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />}
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="اسم زبون، اسم صنف، باركود، أو رقم فاتورة…"
                className="h-12 w-full bg-transparent pr-11 pl-4 text-sm text-foreground
                           placeholder:text-muted-foreground/60 focus:outline-none"
              />
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {term.trim().length < 2 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  اكتب حرفين على الأقل للبحث
                </p>
              ) : !hits.length && !busy ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  لا نتائج لـ &quot;{term.trim()}&quot;
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {hits.map((hit, i) => {
                    const meta = KIND_META[hit.kind]
                    const Icon = meta.icon
                    return (
                      <li key={`${hit.kind}-${hit.id}`}>
                        <button
                          onMouseEnter={() => setCursor(i)}
                          onClick={() => go(hit)}
                          className={
                            "flex w-full items-center gap-3 px-4 py-2.5 text-right transition " +
                            (i === cursor ? "bg-muted" : "hover:bg-muted/60")
                          }
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center
                                           rounded-lg bg-muted text-muted-foreground">
                            <Icon className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {hit.title}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground num">
                              {meta.label} · {hit.subtitle}
                            </span>
                          </span>
                          {hit.amount !== null && (
                            <span className="num shrink-0 text-xs text-foreground/80">
                              {formatMoney(hit.amount, currency)}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-2
                            text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CornerDownLeft className="size-3" /> Enter للفتح · ↑↓ للتنقّل · Esc للإغلاق
              </span>
              <span>Ctrl + K</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
