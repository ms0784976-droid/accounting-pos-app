"use client"

// ================================================================
// الرئيسية — لوحة القيادة
// ================================================================
// الربح هنا حقيقي: الإيراد − تكلفة البضاعة المباعة − المصاريف.
// النسخة السابقة كانت تحسب "المبيعات − المشتريات" وهذا تدفق نقدي
// لا ربح، فكانت تُظهر خسارة كل شهر تُشترى فيه بضاعة.

import { useMemo } from "react"
import { useSession, useAsyncData, resolvePreset } from "@/lib/session"
import {
  fetchDashboardAction, fetchLowStockAction, fetchSalesTrendAction, fetchTopProductsAction,
} from "@/app/actions/reports"
import { fetchInvoicesAction } from "@/app/actions/invoices"
import { fetchCashAccountsAction } from "@/app/actions/treasury"
import {
  PageHeader, StatCard, SectionCard, DataTable, Th, Td, Tr, Money, Badge,
  EmptyState, TableSkeleton, InlineError, formatDate, formatQty, Btn,
} from "./ui"
import { INVOICE_STATUS_META, PAYMENT_METHOD_META } from "@/lib/constants"
import type { TabId } from "@/lib/constants"
import {
  Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, Boxes,
  AlertTriangle, Plus, PackageX,
} from "lucide-react"

export function OverviewTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { currency, company, can } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"
  const month = useMemo(() => resolvePreset("this-month", tz), [tz])

  const dash = useAsyncData(() => fetchDashboardAction(), [])
  const low = useAsyncData(() => fetchLowStockAction(), [])
  const cash = useAsyncData(() => fetchCashAccountsAction(), [])
  const recent = useAsyncData(
    () => fetchInvoicesAction({ type: "sale", limit: 6 }), []
  )
  const trend = useAsyncData(
    () => (can("viewReports") ? fetchSalesTrendAction(month.from, month.to, "day") : Promise.resolve([])),
    [month.from, month.to]
  )
  const top = useAsyncData(
    () => (can("viewReports") ? fetchTopProductsAction(month.from, month.to, 5) : Promise.resolve([])),
    [month.from, month.to]
  )

  const d = dash.data

  return (
    <div className="space-y-5">
      <PageHeader
        title="الرئيسية"
        subtitle={d ? `${formatDate(d.today)} — ملخص ${company?.name ?? ""}` : "جارٍ التحميل…"}
        actions={
          can("createSale") && (
            <Btn icon={Plus} onClick={() => onNavigate("sales")}>فاتورة جديدة</Btn>
          )
        }
      />

      {dash.error && <InlineError message={dash.error} />}

      {/* ── المؤشرات ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="مبيعات اليوم"
          value={d ? money(d.salesToday, currency) : "…"}
          hint={d ? `${d.invoiceCountToday} فاتورة` : undefined}
          icon={TrendingUp}
        />
        <StatCard
          label="مبيعات الشهر"
          value={d ? money(d.salesMonth, currency) : "…"}
          hint={d ? `مصاريف ${money(d.expensesMonth, currency)}` : undefined}
          icon={TrendingUp}
        />
        {can("viewFinancials") && (
          <StatCard
            label="صافي ربح الشهر"
            value={d ? money(d.profitMonth, currency) : "…"}
            hint="بعد تكلفة البضاعة والمصاريف"
            tone={d && d.profitMonth < 0 ? "danger" : "success"}
            icon={TrendingUp}
          />
        )}
        <StatCard
          label="رصيد الصناديق"
          value={d ? money(d.cashTotal, currency) : "…"}
          icon={Wallet}
          onClick={() => onNavigate("cash-accounts")}
        />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ذمم الزبائن (لنا)"
          value={d ? money(d.receivables, currency) : "…"}
          hint={d && d.overdueCount > 0 ? `${d.overdueCount} فاتورة متأخرة` : "لا فواتير متأخرة"}
          hintTone={d && d.overdueCount > 0 ? "danger" : undefined}
          icon={ArrowDownLeft}
          onClick={() => onNavigate("parties")}
        />
        <StatCard
          label="ذمم الموردين (علينا)"
          value={d ? money(d.payables, currency) : "…"}
          tone={d && d.payables > 0 ? "danger" : "neutral"}
          icon={ArrowUpRight}
          onClick={() => onNavigate("parties")}
        />
        <StatCard
          label="قيمة المخزون"
          value={d ? money(d.inventoryValue, currency) : "…"}
          hint="بالتكلفة المرجّحة"
          icon={Boxes}
          onClick={() => onNavigate("inventory")}
        />
        <StatCard
          label="أصناف تحت الحد الأدنى"
          value={d ? String(d.lowStockCount) : "…"}
          tone={d && d.lowStockCount > 0 ? "warning" : "neutral"}
          icon={PackageX}
          onClick={() => onNavigate("inventory")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── آخر الفواتير ── */}
        <SectionCard
          className="lg:col-span-2"
          title="آخر فواتير المبيعات"
          action={
            <button
              onClick={() => onNavigate("sales")}
              className="text-xs text-primary hover:underline"
            >
              عرض الكل
            </button>
          }
        >
          {recent.loading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : !recent.data?.length ? (
            <EmptyState
              message="لا توجد فواتير بعد"
              hint="ابدأ بتسجيل أول عملية بيع"
              action={can("createSale") && <Btn size="sm" icon={Plus} onClick={() => onNavigate("sales")}>فاتورة جديدة</Btn>}
            />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <Th width="110px">الرقم</Th>
                  <Th>الزبون</Th>
                  <Th width="90px">التاريخ</Th>
                  <Th width="70px">الدفع</Th>
                  <Th align="left" width="110px">المبلغ</Th>
                </tr>
              </thead>
              <tbody>
                {recent.data.map((inv) => (
                  <Tr key={inv.id} muted={inv.status === "cancelled"}>
                    <Td mono className="text-xs text-muted-foreground">{inv.invoiceNo}</Td>
                    <Td>
                      <span className={inv.status === "cancelled" ? "line-through" : ""}>
                        {inv.partyName || "زبون نقدي"}
                      </span>
                    </Td>
                    <Td mono className="text-xs">{formatDate(inv.date)}</Td>
                    <Td>
                      {inv.status === "cancelled" ? (
                        <Badge label={INVOICE_STATUS_META.cancelled.label}
                               tint={INVOICE_STATUS_META.cancelled.tint} />
                      ) : (
                        <Badge
                          label={PAYMENT_METHOD_META[inv.paymentMethod].label}
                          tint={PAYMENT_METHOD_META[inv.paymentMethod].tint}
                        />
                      )}
                    </Td>
                    <Td align="left"><Money value={inv.total} currency={currency} /></Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </SectionCard>

        {/* ── تنبيهات ورصيد ── */}
        <div className="space-y-4">
          {!!low.data?.length && (
            <div className="surface border-warning/40 bg-warning/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="size-4 text-warning" />
                <h3 className="text-sm font-semibold text-foreground">مخزون تحت الحد الأدنى</h3>
              </div>
              <ul className="space-y-1.5">
                {low.data.slice(0, 5).map((item) => (
                  <li key={item.productId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground/85">{item.name}</span>
                    <span className="num shrink-0 text-warning font-medium">
                      {formatQty(item.stockQty)} / {formatQty(item.minQty)}
                    </span>
                  </li>
                ))}
              </ul>
              {low.data.length > 5 && (
                <button
                  onClick={() => onNavigate("inventory")}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  و {low.data.length - 5} صنف آخر
                </button>
              )}
            </div>
          )}

          <SectionCard title="أرصدة الصناديق" padded>
            {cash.loading ? (
              <div className="skeleton h-20 rounded-lg" />
            ) : !cash.data?.length ? (
              <p className="text-xs text-muted-foreground">لا توجد صناديق</p>
            ) : (
              <div className="space-y-2">
                {cash.data.filter((c) => c.isActive).map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground truncate">{acc.name}</span>
                    <Money value={acc.balance} currency={currency} />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 pt-2.5 mt-1
                                border-t border-border-strong text-sm">
                  <span className="font-semibold text-foreground">الإجمالي</span>
                  <Money
                    value={cash.data.reduce((s, a) => s + a.balance, 0)}
                    currency={currency} bold colored
                  />
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── أكثر الأصناف مبيعاً ── */}
      {can("viewReports") && (
        <SectionCard
          title="أكثر الأصناف مبيعاً هذا الشهر"
          description="الربح محسوب بالتكلفة المرجّحة وقت البيع"
        >
          {top.loading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : !top.data?.length ? (
            <EmptyState message="لا توجد مبيعات هذا الشهر" />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <Th>الصنف</Th>
                  <Th align="left" width="100px">الكمية</Th>
                  <Th align="left" width="120px">الإيراد</Th>
                  <Th align="left" width="120px">التكلفة</Th>
                  <Th align="left" width="120px">الربح</Th>
                </tr>
              </thead>
              <tbody>
                {top.data.map((p) => (
                  <Tr key={p.productId ?? p.itemName}>
                    <Td>
                      <div className="font-medium">{p.itemName}</div>
                      {p.sku && <div className="text-[11px] text-muted-foreground num">{p.sku}</div>}
                    </Td>
                    <Td align="left" mono>{formatQty(p.qtySold)}</Td>
                    <Td align="left"><Money value={p.revenue} currency={currency} /></Td>
                    <Td align="left" className="text-muted-foreground">
                      <Money value={p.cost} currency={currency} />
                    </Td>
                    <Td align="left"><Money value={p.profit} currency={currency} colored bold /></Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </SectionCard>
      )}

      {/* ── اتجاه المبيعات ── */}
      {can("viewReports") && !!trend.data?.length && (
        <SectionCard title="حركة المبيعات اليومية" padded>
          <SalesSparkline data={trend.data} currency={currency} />
        </SectionCard>
      )}
    </div>
  )
}

/* ── مخطط بسيط بلا مكتبات خارجية ─────────────────────────────── */

function SalesSparkline({ data, currency }: {
  data: { period: string; sales: number; profit: number }[]
  currency: string
}) {
  const max = Math.max(...data.map((d) => d.sales), 1)

  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {data.map((d) => (
          <div key={d.period} className="flex-1 group relative flex flex-col justify-end h-full">
            <div
              className="w-full rounded-t bg-primary/70 group-hover:bg-primary transition-colors min-h-[2px]"
              style={{ height: `${Math.max((d.sales / max) * 100, 1)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full mb-1.5 right-1/2 translate-x-1/2
                            whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-[11px]
                            text-background opacity-0 group-hover:opacity-100 transition z-10">
              <span className="num">{d.period.slice(5)}</span>
              {" · "}
              <span className="num">{money(d.sales, currency)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[11px] text-muted-foreground num">
        <span>{data[0]?.period.slice(5)}</span>
        <span>{data[data.length - 1]?.period.slice(5)}</span>
      </div>
    </div>
  )
}

function money(v: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v) + " " + (currency === "ILS" ? "₪" : currency === "USD" ? "$" : "")
}
