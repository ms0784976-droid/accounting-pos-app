"use client"

import { useMemo, useState } from "react"
import { Printer, FileText, TrendingUp, TrendingDown, Filter } from "lucide-react"
import { paymentStatus, remainingBalance, useClientStore } from "@/lib/store"
import { SectionCard, PaymentStatusBadge, MethodBadge, Btn, Field, TextInput, SelectInput } from "./ui"
import { cn } from "@/lib/utils"

// ─── Print Styles injected at runtime ────────────────────────────────────
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #report-print-area, #report-print-area * { visibility: visible !important; }
  #report-print-area {
    position: fixed; top: 0; right: 0; width: 100%; padding: 24px;
    background: white; color: black; font-family: 'Noto Sans Arabic', sans-serif;
  }
  .no-print { display: none !important; }
}
`

function injectPrintStyle() {
  if (typeof document === "undefined") return
  const existing = document.getElementById("report-print-style")
  if (existing) return
  const style = document.createElement("style")
  style.id = "report-print-style"
  style.textContent = PRINT_STYLE
  document.head.appendChild(style)
}

// ─── Report Header ────────────────────────────────────────────────────────
function ReportHeader({ title, from, to, customerName }: { title: string; from: string; to: string; customerName?: string }) {
  return (
    <div className="border-b-2 border-gray-200 pb-4 mb-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">مُحاسِب</h1>
          <p className="text-sm text-gray-500">نظام المحاسبة السحابي</p>
        </div>
        <div className="text-left">
          <p className="text-xs text-gray-400">تاريخ الطباعة: {new Date().toLocaleDateString("en-US")}</p>
        </div>
      </div>
      <div className="mt-4">
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">
          الفترة: من {from} إلى {to}
          {customerName && ` | العميل: ${customerName}`}
        </p>
      </div>
    </div>
  )
}

export function ReportsTab() {
  const { sales, purchases, customers, ledger, today, fmt, userName } = useClientStore()
  const [reportType, setReportType] = useState<"financial" | "customer">("financial")
  const [fromDate, setFromDate] = useState("2026-08-01")
  const [toDate, setToDate] = useState(today)
  const [selectedCustomerId, setSelectedCustomerId] = useState("")

  injectPrintStyle()

  // ── Filtered Data ───────────────────────────────────────────────────────
  const filteredSales = useMemo(
    () => sales.filter((s) => s.date >= fromDate && s.date <= toDate),
    [sales, fromDate, toDate]
  )
  const filteredPurchases = useMemo(
    () => purchases.filter((p) => p.date >= fromDate && p.date <= toDate),
    [purchases, fromDate, toDate]
  )
  const filteredLedger = useMemo(
    () => ledger.filter((e) => e.date >= fromDate && e.date <= toDate),
    [ledger, fromDate, toDate]
  )

  // ── Financial Summary ───────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalSales = filteredSales.reduce((a, s) => a + s.quantity * s.unitPrice, 0)
    const totalPurchases = filteredPurchases.reduce((a, p) => a + p.quantity * p.unitCost, 0)
    const cashSales = filteredSales.filter((s) => s.method === "cash").reduce((a, s) => a + s.quantity * s.unitPrice, 0)
    const cardSales = filteredSales.filter((s) => s.method === "card").reduce((a, s) => a + s.quantity * s.unitPrice, 0)
    const debtSales = filteredSales.filter((s) => s.method === "debt").reduce((a, s) => a + s.quantity * s.unitPrice, 0)
    return { totalSales, totalPurchases, grossProfit: totalSales - totalPurchases, cashSales, cardSales, debtSales }
  }, [filteredSales, filteredPurchases])

  // ── Customer Statement ──────────────────────────────────────────────────
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)
  const customerSales = useMemo(
    () => filteredSales.filter((s) => selectedCustomer && s.buyer.toLowerCase() === selectedCustomer.name.toLowerCase()),
    [filteredSales, selectedCustomer]
  )

  return (
    <div className="space-y-6">
      {/* Filter Panel */}
      <SectionCard title="فلاتر التقرير" description="حدد نوع التقرير والفترة الزمنية">
        <div className="px-6 py-5 space-y-5">
          {/* Report Type */}
          <div className="flex gap-3">
            {[
              { id: "financial", label: "التقرير المالي الشامل", icon: TrendingUp },
              { id: "customer",  label: "كشف حساب عميل",        icon: FileText },
            ].map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setReportType(t.id as typeof reportType)}
                  className={cn(
                    "flex items-center gap-2 flex-1 h-11 rounded-xl border px-4 text-sm font-medium transition",
                    reportType === t.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-4" />{t.label}
                </button>
              )
            })}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="من تاريخ">
              <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </Field>
            <Field label="إلى تاريخ">
              <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </Field>
            {reportType === "customer" && (
              <Field label="اختر العميل">
                <SelectInput value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                  <option value="">— اختر عميل —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </SelectInput>
              </Field>
            )}
          </div>

          <div className="flex justify-end">
            <Btn onClick={() => window.print()}>
              <Printer className="size-4" />طباعة التقرير
            </Btn>
          </div>
        </div>
      </SectionCard>

      {/* ── Print Area ─────────────────────────────────────────────────── */}
      <div id="report-print-area" dir="rtl">

        {/* Financial Report */}
        {reportType === "financial" && (
          <div className="space-y-6">
            {/* Header (print only) */}
            <div className="hidden print:block">
              <ReportHeader title="التقرير المالي الشامل" from={fromDate} to={toDate} />
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "إجمالي المبيعات",  value: summary.totalSales,    tone: "text-success" },
                { label: "إجمالي المشتريات", value: summary.totalPurchases, tone: "text-warning" },
                { label: "إجمالي الربح",     value: summary.grossProfit,   tone: summary.grossProfit >= 0 ? "text-success" : "text-danger" },
                { label: "مبيعات آجل",        value: summary.debtSales,     tone: "text-danger" },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl bg-card border border-border p-5">
                  <p className="text-sm text-muted-foreground mb-1">{card.label}</p>
                  <p className={cn("text-2xl font-black tabular-nums", card.tone)}>{fmt(card.value)}</p>
                </div>
              ))}
            </div>

            {/* Payment Method Breakdown */}
            <SectionCard title="تفصيل المبيعات حسب طريقة الدفع">
              <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border">
                {[
                  { label: "نقدي", value: summary.cashSales, cls: "text-success" },
                  { label: "بطاقة", value: summary.cardSales, cls: "text-blue-600" },
                  { label: "آجل / دين", value: summary.debtSales, cls: "text-danger" },
                ].map((m) => (
                  <div key={m.label} className="px-6 py-5 text-center">
                    <p className="text-sm text-muted-foreground">{m.label}</p>
                    <p className={cn("text-xl font-black tabular-nums mt-1", m.cls)}>{fmt(m.value)}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Sales Detail Table */}
            <SectionCard title={`سجل المبيعات (${filteredSales.length} فاتورة)`}>
              {filteredSales.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">لا توجد مبيعات في هذه الفترة</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3 text-right">التاريخ</th>
                        <th className="px-5 py-3 text-right">الصنف</th>
                        <th className="px-5 py-3 text-right">المشتري</th>
                        <th className="px-5 py-3 text-right">الكمية</th>
                        <th className="px-5 py-3 text-right">الإجمالي</th>
                        <th className="px-5 py-3 text-right">الدفع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredSales.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30 transition">
                          <td className="px-5 py-3 tabular-nums text-muted-foreground">{s.date}</td>
                          <td className="px-5 py-3 font-medium text-foreground">{s.itemName}</td>
                          <td className="px-5 py-3 text-muted-foreground">{s.buyer}</td>
                          <td className="px-5 py-3 tabular-nums">{s.quantity}</td>
                          <td className="px-5 py-3 font-bold tabular-nums text-success">{fmt(s.quantity * s.unitPrice)}</td>
                          <td className="px-5 py-3"><MethodBadge method={s.method} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border bg-muted/40">
                      <tr>
                        <td colSpan={4} className="px-5 py-3 font-bold text-foreground">الإجمالي</td>
                        <td className="px-5 py-3 font-black text-success tabular-nums">{fmt(summary.totalSales)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </SectionCard>

            {/* Purchases Detail Table */}
            <SectionCard title={`سجل المشتريات (${filteredPurchases.length} فاتورة)`}>
              {filteredPurchases.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">لا توجد مشتريات في هذه الفترة</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3 text-right">التاريخ</th>
                        <th className="px-5 py-3 text-right">الصنف</th>
                        <th className="px-5 py-3 text-right">المورد</th>
                        <th className="px-5 py-3 text-right">الكمية</th>
                        <th className="px-5 py-3 text-right">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPurchases.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/30 transition">
                          <td className="px-5 py-3 tabular-nums text-muted-foreground">{p.date}</td>
                          <td className="px-5 py-3 font-medium text-foreground">{p.itemName}</td>
                          <td className="px-5 py-3 text-muted-foreground">{p.supplier}</td>
                          <td className="px-5 py-3 tabular-nums">{p.quantity}</td>
                          <td className="px-5 py-3 font-bold tabular-nums text-warning">{fmt(p.quantity * p.unitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border bg-muted/40">
                      <tr>
                        <td colSpan={4} className="px-5 py-3 font-bold text-foreground">الإجمالي</td>
                        <td className="px-5 py-3 font-black text-warning tabular-nums">{fmt(summary.totalPurchases)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* Customer Statement */}
        {reportType === "customer" && (
          <div className="space-y-6">
            {/* Header (print only) */}
            <div className="hidden print:block">
              <ReportHeader
                title="كشف حساب عميل"
                from={fromDate}
                to={toDate}
                customerName={selectedCustomer?.name}
              />
            </div>

            {!selectedCustomer ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center text-muted-foreground">
                <FileText className="size-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">اختر عميلاً من القائمة أعلاه لعرض كشف حسابه</p>
              </div>
            ) : (
              <>
                {/* Customer Info */}
                <div className="rounded-2xl bg-card border border-border p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">اسم العميل</p>
                      <p className="font-bold text-foreground">{selectedCustomer.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">رقم الحساب</p>
                      <p className="font-mono font-semibold text-foreground">{selectedCustomer.accountId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">رقم الجوال</p>
                      <p className="text-foreground">{selectedCustomer.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">حالة الحساب</p>
                      <PaymentStatusBadge status={paymentStatus(selectedCustomer, today)} />
                    </div>
                  </div>
                </div>

                {/* Balance Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-card border border-border p-5 text-center">
                    <p className="text-xs text-muted-foreground mb-1">إجمالي المديونية</p>
                    <p className="text-2xl font-black tabular-nums text-foreground">{fmt(selectedCustomer.totalCharged)}</p>
                  </div>
                  <div className="rounded-2xl bg-success/10 border border-success/20 p-5 text-center">
                    <p className="text-xs text-muted-foreground mb-1">المبلغ المسدّد</p>
                    <p className="text-2xl font-black tabular-nums text-success">{fmt(selectedCustomer.amountPaid)}</p>
                  </div>
                  <div className="rounded-2xl bg-danger/10 border border-danger/20 p-5 text-center">
                    <p className="text-xs text-muted-foreground mb-1">المتبقي</p>
                    <p className="text-2xl font-black tabular-nums text-danger">{fmt(remainingBalance(selectedCustomer))}</p>
                  </div>
                </div>

                {/* Transactions for this customer in date range */}
                <SectionCard title={`المعاملات في الفترة المحددة (${customerSales.length} فاتورة)`}>
                  {customerSales.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                      لا توجد معاملات لهذا العميل في الفترة المحددة
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px] text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <th className="px-5 py-3 text-right">التاريخ</th>
                            <th className="px-5 py-3 text-right">الصنف</th>
                            <th className="px-5 py-3 text-right">الكمية</th>
                            <th className="px-5 py-3 text-right">المبلغ</th>
                            <th className="px-5 py-3 text-right">طريقة الدفع</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {customerSales.map((s) => (
                            <tr key={s.id} className="hover:bg-muted/30 transition">
                              <td className="px-5 py-3 tabular-nums text-muted-foreground">{s.date}</td>
                              <td className="px-5 py-3 font-medium text-foreground">{s.itemName}</td>
                              <td className="px-5 py-3 tabular-nums">{s.quantity}</td>
                              <td className="px-5 py-3 font-bold tabular-nums text-foreground">{fmt(s.quantity * s.unitPrice)}</td>
                              <td className="px-5 py-3"><MethodBadge method={s.method} /></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-border bg-muted/40">
                          <tr>
                            <td colSpan={3} className="px-5 py-3 font-bold">الإجمالي</td>
                            <td className="px-5 py-3 font-black tabular-nums text-foreground">
                              {fmt(customerSales.reduce((a, s) => a + s.quantity * s.unitPrice, 0))}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Print footer */}
                <div className="hidden print:block text-center text-xs text-gray-400 pt-6 border-t">
                  تم توليد هذا التقرير بواسطة منصة مُحاسِب — {new Date().toLocaleDateString("en-US")}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
