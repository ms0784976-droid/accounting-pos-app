"use client"

import { useMemo } from "react"
import { AlertTriangle, Boxes, Coins, TrendingUp, Wallet, ArrowUpRight } from "lucide-react"
import { paymentStatus, remainingBalance, useClientStore } from "@/lib/store"
import { CAN_VIEW_PROFIT } from "@/lib/constants"
import { StatCard, SectionCard, PaymentStatusBadge, LedgerTypeBadge } from "./ui"
import { cn } from "@/lib/utils"

export function OverviewTab() {
  const { sales, purchases, customers, stock, ledger, currentTenantUser, today, fmt, userName } = useClientStore()
  const canViewProfit = CAN_VIEW_PROFIT.includes(currentTenantUser.role)

  const metrics = useMemo(() => {
    const totalSales = sales.reduce((a, s) => a + s.quantity * s.unitPrice, 0)
    const totalPurchases = purchases.reduce((a, p) => a + p.quantity * p.unitCost, 0)
    const outstanding = customers.reduce((a, c) => a + remainingBalance(c), 0)
    const todayRevenue = sales.filter((s) => s.date === today).reduce((a, s) => a + s.quantity * s.unitPrice, 0)
    const stockUnits = stock.reduce((a, i) => a + i.balance, 0)
    const costMap = new Map(stock.map((i) => [i.sku, i.lastCost]))
    const grossProfit = sales.reduce((a, s) => a + (s.unitPrice - (costMap.get(s.sku) ?? 0)) * s.quantity, 0)
    const overdueCount = customers.filter((c) => paymentStatus(c, today) === "overdue").length
    return { totalSales, totalPurchases, outstanding, todayRevenue, stockUnits, grossProfit, overdueCount }
  }, [sales, purchases, customers, stock, today])

  const maxIncoming = Math.max(1, ...stock.map((s) => s.incoming))
  const debtors = useMemo(
    () => [...customers].filter((c) => remainingBalance(c) > 0)
      .sort((a, b) => remainingBalance(b) - remainingBalance(a)).slice(0, 5),
    [customers]
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إيراد اليوم" value={fmt(metrics.todayRevenue)}
          hint="مبيعات نقدية وبطاقة وآجل" icon={Wallet} tone="primary" />
        <StatCard label="إجمالي الذمم" value={fmt(metrics.outstanding)}
          hint={`${metrics.overdueCount} عميل متأخر`} icon={Coins} tone="danger" />
        <StatCard label="رصيد المخزن" value={`${metrics.stockUnits.toLocaleString("en-US")} وحدة`}
          hint={`${stock.length} صنف مختلف`} icon={Boxes} tone="info" />
        {canViewProfit ? (
          <StatCard label="إجمالي الربح" value={fmt(metrics.grossProfit)}
            hint={`المبيعات ${fmt(metrics.totalSales)}`} icon={TrendingUp} tone="success" />
        ) : (
          <StatCard label="إجمالي المشتريات" value={fmt(metrics.totalPurchases)}
            hint="تكلفة شراء البضاعة" icon={ArrowUpRight} tone="warning" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="مستوى المخزون اللحظي"
          description="الكمية الداخلة مقابل الرصيد المتبقي"
        >
          <div className="divide-y divide-border">
            {stock.map((item) => {
              const low = item.balance <= item.incoming * 0.2
              return (
                <div key={item.sku} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-44 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.itemName}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{item.sku}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", low ? "bg-danger" : "bg-primary")}
                        style={{ width: `${Math.max(4, (item.balance / maxIncoming) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex w-24 items-center justify-start gap-1.5">
                    <span className="text-sm font-semibold tabular-nums text-foreground">{item.balance}</span>
                    {low && <AlertTriangle className="size-4 text-danger" />}
                  </div>
                </div>
              )
            })}
            {stock.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">لا توجد بيانات مخزون</div>}
          </div>
        </SectionCard>

        <SectionCard title="أكبر المدينين" description="أعلى الأرصدة المستحقة">
          <div className="divide-y divide-border">
            {debtors.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                  <div className="mt-1"><PaymentStatusBadge status={paymentStatus(c, today)} /></div>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-danger">
                  {fmt(remainingBalance(c))}
                </span>
              </div>
            ))}
            {debtors.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">لا توجد ذمم مستحقة 🎉</div>}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="آخر الحركات" description="سجل الأستاذ الأخير">
        <div className="divide-y divide-border">
          {ledger.slice(0, 8).map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <LedgerTypeBadge type={entry.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {entry.quantity}× {entry.itemName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.party} · بواسطة {userName(entry.userId)} · {entry.date}
                </p>
              </div>
              <span className={cn("text-sm font-bold tabular-nums", entry.type === "sale" ? "text-success" : "text-foreground")}>
                {entry.type === "sale" ? "+" : "−"}{fmt(entry.amount)}
              </span>
            </div>
          ))}
          {ledger.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">لا توجد حركات بعد</div>}
        </div>
      </SectionCard>
    </div>
  )
}
