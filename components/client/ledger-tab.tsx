"use client"

import { useMemo } from "react"
import { useClientStore } from "@/lib/store"
import { SectionCard, EmptyState, LedgerTypeBadge, MethodBadge } from "./ui"
import { cn } from "@/lib/utils"

export function LedgerTab({ search }: { search: string }) {
  const { ledger, fmt, userName } = useClientStore()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ledger
    return ledger.filter(
      (e) =>
        e.itemName.toLowerCase().includes(q) ||
        e.party.toLowerCase().includes(q) ||
        e.sku.toLowerCase().includes(q)
    )
  }, [ledger, search])

  const totals = useMemo(() => ({
    sales: ledger.filter((e) => e.type === "sale").reduce((a, e) => a + e.amount, 0),
    purchases: ledger.filter((e) => e.type === "purchase").reduce((a, e) => a + e.amount, 0),
  }), [ledger])

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-success/10 border border-success/20 p-5">
          <p className="text-sm font-medium text-muted-foreground mb-1">إجمالي المبيعات</p>
          <p className="text-2xl font-black tabular-nums text-success">{fmt(totals.sales)}</p>
        </div>
        <div className="rounded-2xl bg-warning/10 border border-warning/20 p-5">
          <p className="text-sm font-medium text-muted-foreground mb-1">إجمالي المشتريات</p>
          <p className="text-2xl font-black tabular-nums text-warning">{fmt(totals.purchases)}</p>
        </div>
        <div className="rounded-2xl bg-primary/10 border border-primary/20 p-5">
          <p className="text-sm font-medium text-muted-foreground mb-1">صافي الحركة</p>
          <p className={cn("text-2xl font-black tabular-nums", totals.sales - totals.purchases >= 0 ? "text-success" : "text-danger")}>
            {fmt(totals.sales - totals.purchases)}
          </p>
        </div>
      </div>

      <SectionCard title="دفتر الأستاذ العام" description="سجل جميع الحركات المالية مرتبة زمنياً">
        {filtered.length === 0 ? <EmptyState message="لا توجد حركات تطابق البحث" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 text-right">النوع</th>
                  <th className="px-5 py-3 text-right">الصنف</th>
                  <th className="px-5 py-3 text-right">الطرف</th>
                  <th className="px-5 py-3 text-right">الكمية</th>
                  <th className="px-5 py-3 text-right">المبلغ</th>
                  <th className="px-5 py-3 text-right">الدفع</th>
                  <th className="px-5 py-3 text-right">بواسطة</th>
                  <th className="px-5 py-3 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/40 transition">
                    <td className="px-5 py-3.5"><LedgerTypeBadge type={entry.type} /></td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{entry.itemName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{entry.sku}</p>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{entry.party}</td>
                    <td className="px-5 py-3.5 tabular-nums text-foreground">{entry.quantity} {entry.unit ? `${entry.unit}` : ""}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn("font-bold tabular-nums", entry.type === "sale" ? "text-success" : "text-foreground")}>
                        {entry.type === "sale" ? "+" : "−"}{fmt(entry.amount)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">{entry.method ? <MethodBadge method={entry.method} /> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{userName(entry.userId)}</td>
                    <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{entry.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
