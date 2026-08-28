"use client"

// ================================================================
// التقارير
// ================================================================
// النسخة السابقة كان فيها تقريران فقط، وأحدهما يحسب "الربح" على أنه
// المبيعات ناقص المشتريات. هنا ستة تقارير محاسبية حقيقية مبنية على
// القيود، كلها قابلة للطباعة والتصدير.

import { useState } from "react"
import { useSession, useAsyncData, resolvePreset } from "@/lib/session"
import {
  fetchProfitAndLossAction, fetchBalanceSheetAction, fetchTrialBalanceAction,
  fetchTopProductsAction, fetchVatReportAction, fetchSalesTrendAction,
} from "@/app/actions/reports"
import { fetchPartiesAction, fetchPartyStatementAction } from "@/app/actions/parties"
import {
  PageHeader, SectionCard, DataTable, Th, Td, Tr, TotalRow, Money,
  EmptyState, TableSkeleton, InlineError, InfoNote, DateRangePicker,
  SelectInput, TabBar, Btn, StatCard, Badge, BalanceBadge, SearchBox,
  formatDate, formatQty, exportToCsv, printArea,
} from "./ui"
import { DATE_PRESETS, ACCOUNT_TYPE_META, PARTY_KIND_META } from "@/lib/constants"
import type { FinancialLine } from "@/lib/types"
import {
  Download, Printer, TrendingUp, Landmark, Receipt, FileText, User,
} from "lucide-react"

type ReportId = "statement" | "pnl" | "balance" | "trial" | "products" | "vat" | "trend"

const REPORTS: { id: ReportId; label: string }[] = [
  { id: "statement", label: "كشف حساب زبون / مورد" },
  { id: "pnl",      label: "الأرباح والخسائر" },
  { id: "balance",  label: "الميزانية العمومية" },
  { id: "trial",    label: "ميزان المراجعة" },
  { id: "products", label: "أكثر الأصناف مبيعاً" },
  { id: "trend",    label: "حركة المبيعات" },
  { id: "vat",      label: "التقرير الضريبي" },
]

export function ReportsTab() {
  const { company } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"

  const [report, setReport] = useState<ReportId>("pnl")
  const [preset, setPreset] = useState("this-month")
  const [range, setRange] = useState(() => resolvePreset("this-month", tz))

  const applyPreset = (id: string) => {
    setPreset(id)
    if (id !== "custom") setRange(resolvePreset(id, tz))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="التقارير"
        subtitle="كل الأرقام مصدرها القيود المحاسبية — لا حسابات تقريبية"
        actions={<Btn variant="outline" size="sm" icon={Printer} onClick={printArea}>طباعة</Btn>}
      />

      <SectionCard>
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
          <TabBar<ReportId> tabs={REPORTS} active={report} onChange={setReport} />
          <div className="flex flex-wrap items-center gap-2">
            <SelectInput value={preset} onChange={(e) => applyPreset(e.target.value)}
                         className="w-36">
              {DATE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </SelectInput>
            <DateRangePicker
              from={range.from} to={range.to}
              onChange={(from, to) => { setPreset("custom"); setRange({ from, to }) }}
            />
          </div>
        </div>

        <div className="print-area">
          <div className="hidden print:block px-5 pb-3 border-b border-border">
            <h2 className="text-base font-bold">{REPORTS.find((r) => r.id === report)?.label}</h2>
            <p className="text-xs text-muted-foreground">
              {company?.name} · من {formatDate(range.from)} إلى {formatDate(range.to)}
            </p>
          </div>

          {report === "statement" && <PartyStatementReport range={range} />}
          {report === "pnl"      && <ProfitLoss range={range} />}
          {report === "balance"  && <BalanceSheetReport asOf={range.to} />}
          {report === "trial"    && <TrialBalance range={range} />}
          {report === "products" && <TopProducts range={range} />}
          {report === "trend"    && <SalesTrend range={range} />}
          {report === "vat"      && <VatReport range={range} />}
        </div>
      </SectionCard>
    </div>
  )
}

type Range = { from: string; to: string }

/* ================================================================ */
/* الأرباح والخسائر                                                  */
/* ================================================================ */

function ProfitLoss({ range }: { range: Range }) {
  const { currency } = useSession()
  const pnl = useAsyncData(
    () => fetchProfitAndLossAction(range.from, range.to),
    [range.from, range.to]
  )

  const d = pnl.data

  const handleExport = () => {
    if (!d) return
    const rows: (string | number)[][] = []
    const push = (section: string, lines: FinancialLine[]) =>
      lines.forEach((l) => rows.push([section, l.accountCode, l.accountName, l.amount.toFixed(2)]))
    push("الإيرادات", d.revenue)
    rows.push(["", "", "إجمالي الإيرادات", d.totalRevenue.toFixed(2)])
    push("تكلفة المبيعات", d.cogs)
    rows.push(["", "", "مجمل الربح", d.grossProfit.toFixed(2)])
    push("المصاريف التشغيلية", d.expenses)
    rows.push(["", "", "صافي الربح", d.netProfit.toFixed(2)])
    exportToCsv(`أرباح-وخسائر-${range.from}_${range.to}.csv`,
                ["القسم", "رقم الحساب", "الحساب", "المبلغ"], rows)
  }

  if (pnl.loading) return <TableSkeleton rows={8} cols={3} />
  if (pnl.error) return <div className="p-5"><InlineError message={pnl.error} /></div>
  if (!d) return null

  const margin = d.totalRevenue > 0 ? (d.netProfit / d.totalRevenue) * 100 : 0

  return (
    <div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 p-5">
        <StatCard label="الإيرادات" value={fmt(d.totalRevenue, currency)} icon={TrendingUp} />
        <StatCard label="مجمل الربح" value={fmt(d.grossProfit, currency)}
                  hint="بعد تكلفة البضاعة" tone={d.grossProfit < 0 ? "danger" : "success"} />
        <StatCard label="المصاريف" value={fmt(d.totalExpenses, currency)} tone="danger" />
        <StatCard label="صافي الربح" value={fmt(d.netProfit, currency)}
                  hint={`هامش ${margin.toFixed(1)}%`}
                  tone={d.netProfit < 0 ? "danger" : "success"} />
      </div>

      <DataTable>
        <tbody>
          <Section title="الإيرادات" />
          {d.revenue.map((l) => <Line key={l.accountCode} line={l} currency={currency} />)}
          <Subtotal label="إجمالي الإيرادات" value={d.totalRevenue} currency={currency} />

          <Section title="تكلفة المبيعات" />
          {d.cogs.length ? (
            d.cogs.map((l) => <Line key={l.accountCode} line={l} currency={currency} />)
          ) : (
            <tr className="border-t border-border">
              <Td colSpan={2} className="text-xs text-muted-foreground">لا تكلفة مسجّلة</Td>
              <Td align="left">—</Td>
            </tr>
          )}
          <Subtotal label="مجمل الربح" value={d.grossProfit} currency={currency} strong />

          <Section title="المصاريف التشغيلية" />
          {d.expenses.map((l) => <Line key={l.accountCode} line={l} currency={currency} />)}
          <Subtotal label="إجمالي المصاريف" value={d.totalExpenses} currency={currency} />

          <TotalRow>
            <Td colSpan={2} className="text-base">صافي الربح (الخسارة)</Td>
            <Td align="left">
              <Money value={d.netProfit} currency={currency} colored bold className="text-base" />
            </Td>
          </TotalRow>
        </tbody>
      </DataTable>

      <div className="p-5 no-print">
        <Btn variant="outline" size="sm" icon={Download} onClick={handleExport}>تصدير Excel</Btn>
      </div>
    </div>
  )
}

function Section({ title }: { title: string }) {
  return (
    <tr className="bg-muted/50 border-t border-border">
      <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-foreground">{title}</td>
    </tr>
  )
}

function Line({ line, currency }: { line: FinancialLine; currency: string }) {
  return (
    <Tr>
      <Td mono className="text-xs text-muted-foreground w-20">{line.accountCode}</Td>
      <Td className="text-sm">{line.accountName}</Td>
      <Td align="left" className="w-36"><Money value={line.amount} currency={currency} /></Td>
    </Tr>
  )
}

function Subtotal({ label, value, currency, strong }: {
  label: string; value: number; currency: string; strong?: boolean
}) {
  return (
    <tr className="border-t border-border-strong">
      <Td colSpan={2} className={strong ? "font-semibold" : "font-medium text-muted-foreground"}>
        {label}
      </Td>
      <Td align="left"><Money value={value} currency={currency} bold colored={strong} /></Td>
    </tr>
  )
}

/* ================================================================ */
/* الميزانية العمومية                                                */
/* ================================================================ */

function BalanceSheetReport({ asOf }: { asOf: string }) {
  const { currency } = useSession()
  const bs = useAsyncData(() => fetchBalanceSheetAction(asOf), [asOf])
  const d = bs.data

  if (bs.loading) return <TableSkeleton rows={8} cols={3} />
  if (bs.error) return <div className="p-5"><InlineError message={bs.error} /></div>
  if (!d) return null

  const handleExport = () => {
    const rows: (string | number)[][] = []
    const push = (s: string, lines: FinancialLine[]) =>
      lines.forEach((l) => rows.push([s, l.accountCode, l.accountName, l.amount.toFixed(2)]))
    push("الأصول", d.assets)
    push("الالتزامات", d.liabilities)
    push("حقوق الملكية", d.equity)
    exportToCsv(`ميزانية-${asOf}.csv`, ["القسم", "رقم الحساب", "الحساب", "المبلغ"], rows)
  }

  return (
    <div>
      <div className="p-5">
        {d.isBalanced ? (
          <InfoNote>
            الميزانية متوازنة: الأصول <strong className="num">{d.totalAssets.toFixed(2)}</strong> =
            الالتزامات + حقوق الملكية <strong className="num">
              {(d.totalLiabilities + d.totalEquity).toFixed(2)}
            </strong>
          </InfoNote>
        ) : (
          <InlineError
            message={`الميزانية غير متوازنة — الفرق ${(d.totalAssets - d.totalLiabilities - d.totalEquity).toFixed(2)}. شغّل فحص السلامة من الإعدادات.`}
          />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-px bg-border">
        <div className="bg-card">
          <DataTable>
            <tbody>
              <Section title="الأصول" />
              {d.assets.map((l) => <Line key={l.accountCode} line={l} currency={currency} />)}
              <TotalRow>
                <Td colSpan={2}>إجمالي الأصول</Td>
                <Td align="left"><Money value={d.totalAssets} currency={currency} bold /></Td>
              </TotalRow>
            </tbody>
          </DataTable>
        </div>

        <div className="bg-card">
          <DataTable>
            <tbody>
              <Section title="الالتزامات" />
              {d.liabilities.length ? (
                d.liabilities.map((l) => <Line key={l.accountCode} line={l} currency={currency} />)
              ) : (
                <tr className="border-t border-border">
                  <Td colSpan={3} className="text-xs text-muted-foreground">لا التزامات</Td>
                </tr>
              )}
              <Subtotal label="إجمالي الالتزامات" value={d.totalLiabilities} currency={currency} />

              <Section title="حقوق الملكية" />
              {d.equity.map((l) => <Line key={l.accountCode} line={l} currency={currency} />)}
              <Subtotal label="إجمالي حقوق الملكية" value={d.totalEquity} currency={currency} />

              <TotalRow>
                <Td colSpan={2}>الالتزامات + حقوق الملكية</Td>
                <Td align="left">
                  <Money value={d.totalLiabilities + d.totalEquity} currency={currency} bold />
                </Td>
              </TotalRow>
            </tbody>
          </DataTable>
        </div>
      </div>

      <div className="p-5 no-print">
        <Btn variant="outline" size="sm" icon={Download} onClick={handleExport}>تصدير Excel</Btn>
      </div>
    </div>
  )
}

/* ================================================================ */
/* ميزان المراجعة                                                    */
/* ================================================================ */

function TrialBalance({ range }: { range: Range }) {
  const { currency } = useSession()
  const tb = useAsyncData(
    () => fetchTrialBalanceAction(range.from, range.to),
    [range.from, range.to]
  )
  const d = tb.data

  if (tb.loading) return <TableSkeleton rows={9} cols={5} />
  if (tb.error) return <div className="p-5"><InlineError message={tb.error} /></div>
  if (!d) return null

  return (
    <div>
      <div className="p-5">
        {d.isBalanced ? (
          <InfoNote>ميزان المراجعة متوازن — مجموع المدين يساوي مجموع الدائن.</InfoNote>
        ) : (
          <InlineError message={`الميزان غير متوازن — الفرق ${(d.totalDebit - d.totalCredit).toFixed(2)}`} />
        )}
      </div>

      {!d.rows.length ? (
        <EmptyState message="لا حركات في هذه الفترة" />
      ) : (
        <DataTable>
          <thead className="sticky-head">
            <tr>
              <Th width="80px">الرقم</Th>
              <Th>الحساب</Th>
              <Th width="110px">النوع</Th>
              <Th align="left" width="130px">مدين</Th>
              <Th align="left" width="130px">دائن</Th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r) => (
              <Tr key={r.accountCode}>
                <Td mono className="text-xs text-muted-foreground">{r.accountCode}</Td>
                <Td className="text-sm">{r.accountName}</Td>
                <Td className="text-xs text-muted-foreground">
                  {ACCOUNT_TYPE_META[r.accountType].label}
                </Td>
                <Td align="left">{r.debit ? <Money value={r.debit} currency={currency} /> : "—"}</Td>
                <Td align="left">{r.credit ? <Money value={r.credit} currency={currency} /> : "—"}</Td>
              </Tr>
            ))}
            <TotalRow>
              <Td colSpan={3}>الإجمالي</Td>
              <Td align="left"><Money value={d.totalDebit} currency={currency} bold /></Td>
              <Td align="left"><Money value={d.totalCredit} currency={currency} bold /></Td>
            </TotalRow>
          </tbody>
        </DataTable>
      )}

      <div className="p-5 no-print">
        <Btn variant="outline" size="sm" icon={Download}
             onClick={() => exportToCsv(
               `ميزان-المراجعة-${range.from}_${range.to}.csv`,
               ["رقم الحساب", "الحساب", "النوع", "مدين", "دائن"],
               d.rows.map((r) => [
                 r.accountCode, r.accountName, ACCOUNT_TYPE_META[r.accountType].label,
                 r.debit.toFixed(2), r.credit.toFixed(2),
               ])
             )}>
          تصدير Excel
        </Btn>
      </div>
    </div>
  )
}

/* ================================================================ */
/* أكثر الأصناف مبيعاً                                               */
/* ================================================================ */

function TopProducts({ range }: { range: Range }) {
  const { currency, can } = useSession()
  const top = useAsyncData(
    () => fetchTopProductsAction(range.from, range.to, 50),
    [range.from, range.to]
  )

  if (top.loading) return <TableSkeleton rows={8} cols={6} />
  if (top.error) return <div className="p-5"><InlineError message={top.error} /></div>
  if (!top.data?.length) return <EmptyState message="لا مبيعات في هذه الفترة" />

  const totals = top.data.reduce(
    (s, p) => ({ revenue: s.revenue + p.revenue, cost: s.cost + p.cost, profit: s.profit + p.profit }),
    { revenue: 0, cost: 0, profit: 0 }
  )

  return (
    <div>
      <DataTable>
        <thead className="sticky-head">
          <tr>
            <Th width="45px" align="center">#</Th>
            <Th>الصنف</Th>
            <Th align="left" width="100px">الكمية</Th>
            <Th align="left" width="125px">الإيراد</Th>
            {can("viewFinancials") && <Th align="left" width="125px">التكلفة</Th>}
            {can("viewFinancials") && <Th align="left" width="125px">الربح</Th>}
            {can("viewFinancials") && <Th align="left" width="80px">الهامش</Th>}
          </tr>
        </thead>
        <tbody>
          {top.data.map((p, i) => {
            const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
            return (
              <Tr key={p.productId ?? p.itemName}>
                <Td align="center" mono className="text-xs text-muted-foreground">{i + 1}</Td>
                <Td>
                  <div className="text-sm font-medium">{p.itemName}</div>
                  {p.sku && <div className="text-[10px] text-muted-foreground num">{p.sku}</div>}
                </Td>
                <Td align="left" mono>{formatQty(p.qtySold)}</Td>
                <Td align="left"><Money value={p.revenue} currency={currency} /></Td>
                {can("viewFinancials") && (
                  <Td align="left" className="text-muted-foreground">
                    <Money value={p.cost} currency={currency} />
                  </Td>
                )}
                {can("viewFinancials") && (
                  <Td align="left"><Money value={p.profit} currency={currency} colored bold /></Td>
                )}
                {can("viewFinancials") && (
                  <Td align="left" mono className={margin < 0 ? "text-danger" : "text-muted-foreground"}>
                    {margin.toFixed(0)}%
                  </Td>
                )}
              </Tr>
            )
          })}
          <TotalRow>
            <Td colSpan={3}>الإجمالي</Td>
            <Td align="left"><Money value={totals.revenue} currency={currency} bold /></Td>
            {can("viewFinancials") && (
              <Td align="left"><Money value={totals.cost} currency={currency} bold /></Td>
            )}
            {can("viewFinancials") && (
              <Td align="left"><Money value={totals.profit} currency={currency} colored bold /></Td>
            )}
            {can("viewFinancials") && <Td />}
          </TotalRow>
        </tbody>
      </DataTable>

      <div className="p-5 no-print">
        <Btn variant="outline" size="sm" icon={Download}
             onClick={() => exportToCsv(
               `أكثر-الأصناف-مبيعاً-${range.from}_${range.to}.csv`,
               ["الصنف", "الكود", "الكمية", "الإيراد", "التكلفة", "الربح"],
               top.data!.map((p) => [
                 p.itemName, p.sku, p.qtySold.toString(),
                 p.revenue.toFixed(2), p.cost.toFixed(2), p.profit.toFixed(2),
               ])
             )}>
          تصدير Excel
        </Btn>
      </div>
    </div>
  )
}

/* ================================================================ */
/* حركة المبيعات                                                     */
/* ================================================================ */

function SalesTrend({ range }: { range: Range }) {
  const { currency, can } = useSession()
  const [groupBy, setGroupBy] = useState<"day" | "month">("day")

  const trend = useAsyncData(
    () => fetchSalesTrendAction(range.from, range.to, groupBy),
    [range.from, range.to, groupBy]
  )

  if (trend.loading) return <TableSkeleton rows={8} cols={5} />
  if (trend.error) return <div className="p-5"><InlineError message={trend.error} /></div>
  if (!trend.data?.length) return <EmptyState message="لا مبيعات في هذه الفترة" />

  const max = Math.max(...trend.data.map((d) => d.sales), 1)
  const totals = trend.data.reduce(
    (s, d) => ({ sales: s.sales + d.sales, cost: s.cost + d.cost, count: s.count + d.count }),
    { sales: 0, cost: 0, count: 0 }
  )

  return (
    <div>
      <div className="px-5 pt-4 no-print">
        <SelectInput value={groupBy} onChange={(e) => setGroupBy(e.target.value as "day" | "month")}
                     className="w-32">
          <option value="day">يومي</option>
          <option value="month">شهري</option>
        </SelectInput>
      </div>

      <div className="p-5">
        <div className="flex items-end gap-1 h-40">
          {trend.data.map((d) => (
            <div key={d.period} className="flex-1 group relative flex flex-col justify-end h-full">
              <div
                className="w-full rounded-t bg-primary/70 group-hover:bg-primary transition-colors min-h-[2px]"
                style={{ height: `${Math.max((d.sales / max) * 100, 1)}%` }}
              />
              <div className="pointer-events-none absolute bottom-full mb-1.5 right-1/2 translate-x-1/2
                              whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-[11px]
                              text-background opacity-0 group-hover:opacity-100 transition z-10">
                <span className="num">{d.period}</span> · <span className="num">{d.sales.toFixed(0)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DataTable>
        <thead className="sticky-head">
          <tr>
            <Th width="120px">الفترة</Th>
            <Th align="left" width="90px">الفواتير</Th>
            <Th align="left" width="130px">المبيعات</Th>
            {can("viewFinancials") && <Th align="left" width="130px">التكلفة</Th>}
            {can("viewFinancials") && <Th align="left" width="130px">مجمل الربح</Th>}
          </tr>
        </thead>
        <tbody>
          {trend.data.map((d) => (
            <Tr key={d.period}>
              <Td mono className="text-xs">{d.period}</Td>
              <Td align="left" mono>{d.count}</Td>
              <Td align="left"><Money value={d.sales} currency={currency} /></Td>
              {can("viewFinancials") && (
                <Td align="left" className="text-muted-foreground">
                  <Money value={d.cost} currency={currency} />
                </Td>
              )}
              {can("viewFinancials") && (
                <Td align="left"><Money value={d.profit} currency={currency} colored /></Td>
              )}
            </Tr>
          ))}
          <TotalRow>
            <Td>الإجمالي</Td>
            <Td align="left" mono>{totals.count}</Td>
            <Td align="left"><Money value={totals.sales} currency={currency} bold /></Td>
            {can("viewFinancials") && (
              <Td align="left"><Money value={totals.cost} currency={currency} bold /></Td>
            )}
            {can("viewFinancials") && (
              <Td align="left">
                <Money value={totals.sales - totals.cost} currency={currency} colored bold />
              </Td>
            )}
          </TotalRow>
        </tbody>
      </DataTable>
    </div>
  )
}

/* ================================================================ */
/* التقرير الضريبي                                                   */
/* ================================================================ */

function VatReport({ range }: { range: Range }) {
  const { currency, company } = useSession()
  const vat = useAsyncData(
    () => fetchVatReportAction(range.from, range.to),
    [range.from, range.to]
  )

  if (vat.loading) return <TableSkeleton rows={3} cols={2} />
  if (vat.error) return <div className="p-5"><InlineError message={vat.error} /></div>
  if (!vat.data) return null

  const d = vat.data

  return (
    <div className="p-5 space-y-5">
      {!company?.vatEnabled && (
        <InfoNote>
          ضريبة القيمة المضافة معطّلة في إعدادات الشركة. فعّلها من &quot;حسابي&quot;
          إن كنت مسجّلاً ضريبياً حتى تُحتسب على الفواتير.
        </InfoNote>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="ضريبة المخرجات" value={fmt(d.outputTax, currency)}
                  hint="محصّلة من المبيعات" icon={Receipt} />
        <StatCard label="ضريبة المدخلات" value={fmt(d.inputTax, currency)}
                  hint="مدفوعة على المشتريات" icon={Receipt} />
        <StatCard
          label={d.netDue >= 0 ? "المستحق للضريبة" : "رصيد لصالحك"}
          value={fmt(Math.abs(d.netDue), currency)}
          tone={d.netDue > 0 ? "danger" : "success"}
          icon={Landmark}
        />
      </div>

      <div className="surface overflow-hidden">
        <DataTable>
          <tbody>
            <Tr>
              <Td>ضريبة القيمة المضافة على المبيعات (مخرجات)</Td>
              <Td align="left" className="w-40"><Money value={d.outputTax} currency={currency} /></Td>
            </Tr>
            <Tr>
              <Td>ناقص: ضريبة القيمة المضافة على المشتريات (مدخلات)</Td>
              <Td align="left"><Money value={-d.inputTax} currency={currency} /></Td>
            </Tr>
            <TotalRow>
              <Td>{d.netDue >= 0 ? "صافي المستحق للسلطة الضريبية" : "صافي الرصيد لصالحك"}</Td>
              <Td align="left">
                <Money value={Math.abs(d.netDue)} currency={currency} bold />
              </Td>
            </TotalRow>
          </tbody>
        </DataTable>
      </div>

      <InfoNote>
        هذا التقرير مبني على القيود المرحّلة إلى حسابي ضريبة المدخلات والمخرجات.
        راجعه مع محاسبك القانوني قبل التقديم — البرنامج أداة مساعدة لا بديل عن المراجعة المهنية.
      </InfoNote>
    </div>
  )
}

/* ================================================================ */
/* كشف حساب زبون أو مورد                                             */
/* ================================================================ */
// تقرير مستقل قابل للطباعة والتصدير، بترويسة تحمل بيانات الشركة
// وجهة التعامل — حتى يصلح كمستند يُرسل للزبون لا مجرد شاشة داخلية.

function PartyStatementReport({ range }: { range: Range }) {
  const { currency, company } = useSession()
  const [partyId, setPartyId] = useState("")
  const [search, setSearch] = useState("")

  const parties = useAsyncData(() => fetchPartiesAction("all"), [])

  const statement = useAsyncData(
    () => (partyId
      ? fetchPartyStatementAction(partyId, range.from, range.to)
      : Promise.resolve([])),
    [partyId, range.from, range.to]
  )

  const party = parties.data?.find((p) => p.id === partyId) ?? null

  const filtered = (parties.data ?? []).filter((p) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return p.name.toLowerCase().includes(q) ||
           p.code.toLowerCase().includes(q) ||
           p.phone.includes(q)
  })

  const rows = statement.data ?? []
  const totals = rows.reduce(
    (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
    { debit: 0, credit: 0 }
  )
  const closing = rows.length ? rows[rows.length - 1].runningBalance : 0
  const opening = rows.length ? rows[0].runningBalance : 0

  const handleExport = () => {
    if (!party || !rows.length) return
    exportToCsv(
      `كشف-حساب-${party.name}-${range.from}_${range.to}.csv`,
      ["التاريخ", "المستند", "البيان", "مدين", "دائن", "الرصيد"],
      rows.map((r) => [
        r.date ?? "", r.docNo, r.description,
        r.debit.toFixed(2), r.credit.toFixed(2), r.runningBalance.toFixed(2),
      ])
    )
  }

  return (
    <div>
      {/* ── اختيار الجهة — لا يُطبع ── */}
      <div className="no-print px-5 py-4 border-b border-border grid gap-3 sm:grid-cols-[1fr_1.3fr]">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            بحث سريع
          </label>
          <SearchBox value={search} onChange={setSearch} placeholder="الاسم أو الكود أو الهاتف…" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            اختر الزبون أو المورد
          </label>
          <SelectInput value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">— اختر —</option>
            {filtered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {PARTY_KIND_META[p.kind].label}
                {Math.abs(p.balance) > 0.009 ? ` (${p.balance.toFixed(2)})` : ""}
              </option>
            ))}
          </SelectInput>
        </div>
      </div>

      {!partyId ? (
        <EmptyState
          icon={User}
          message="اختر زبوناً أو مورداً"
          hint="سيظهر كشف حساب تفصيلي بكل الحركات والأرصدة المتراكمة، جاهز للطباعة أو الإرسال"
        />
      ) : statement.loading ? (
        <TableSkeleton rows={7} cols={6} />
      ) : statement.error ? (
        <div className="p-5"><InlineError message={statement.error} /></div>
      ) : (
        <>
          {/* ── ترويسة تُطبع ── */}
          <div className="px-5 py-4 border-b border-border">
            <div className="hidden print:block mb-4 pb-3 border-b-2 border-neutral-800">
              <h2 className="text-lg font-bold">كشف حساب</h2>
              <p className="text-xs mt-1">
                {company?.name}
                {company?.phone && <span className="num"> · {company.phone}</span>}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5">جهة التعامل</p>
                <p className="text-sm font-semibold text-foreground">{party?.name}</p>
                <p className="text-[11px] text-muted-foreground num">
                  {party?.code}
                  {party?.phone && ` · ${party.phone}`}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5">الفترة</p>
                <p className="text-sm num">
                  {formatDate(range.from)} — {formatDate(range.to)}
                </p>
                {party && (
                  <Badge label={PARTY_KIND_META[party.kind].label}
                         tint={PARTY_KIND_META[party.kind].tint} />
                )}
              </div>
              <div className="sm:text-left">
                <p className="text-[11px] text-muted-foreground mb-0.5">الرصيد الختامي</p>
                <BalanceBadge balance={closing} currency={currency} />
              </div>
            </div>
          </div>

          {!rows.length ? (
            <EmptyState message="لا حركات على هذا الحساب في الفترة المحددة" />
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 p-5">
                <StatCard label="الرصيد السابق" value={fmt(opening, currency)} icon={FileText} />
                <StatCard label="مجموع المدين" value={fmt(totals.debit, currency)} />
                <StatCard label="مجموع الدائن" value={fmt(totals.credit, currency)} />
                <StatCard
                  label={closing > 0 ? "المستحق عليه" : closing < 0 ? "المستحق له" : "الرصيد"}
                  value={fmt(Math.abs(closing), currency)}
                  tone={closing > 0 ? "danger" : closing < 0 ? "success" : "neutral"}
                />
              </div>

              <DataTable>
                <thead className="sticky-head">
                  <tr>
                    <Th width="95px">التاريخ</Th>
                    <Th width="110px">المستند</Th>
                    <Th>البيان</Th>
                    <Th align="left" width="115px">مدين</Th>
                    <Th align="left" width="115px">دائن</Th>
                    <Th align="left" width="130px">الرصيد</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <Tr key={i} className={r.docType === "opening" ? "bg-muted/40" : ""}>
                      <Td mono className="text-xs">{r.date ? formatDate(r.date) : "—"}</Td>
                      <Td mono className="text-xs text-muted-foreground">{r.docNo}</Td>
                      <Td className="text-xs">{r.description}</Td>
                      <Td align="left">
                        {r.debit ? <Money value={r.debit} currency={currency} /> : "—"}
                      </Td>
                      <Td align="left">
                        {r.credit ? <Money value={r.credit} currency={currency} /> : "—"}
                      </Td>
                      <Td align="left">
                        <Money value={r.runningBalance} currency={currency} colored bold />
                      </Td>
                    </Tr>
                  ))}
                  <TotalRow>
                    <Td colSpan={3}>الإجمالي</Td>
                    <Td align="left"><Money value={totals.debit} currency={currency} bold /></Td>
                    <Td align="left"><Money value={totals.credit} currency={currency} bold /></Td>
                    <Td align="left"><Money value={closing} currency={currency} colored bold /></Td>
                  </TotalRow>
                </tbody>
              </DataTable>

              <div className="hidden print:block px-5 py-6 mt-4 border-t border-neutral-300">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[11px] text-neutral-500 mb-6">توقيع المستلم</p>
                    <div className="border-b border-neutral-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-neutral-500 mb-6">توقيع وختم الشركة</p>
                    <div className="border-b border-neutral-400" />
                  </div>
                </div>
              </div>

              <div className="p-5 no-print flex gap-2">
                <Btn variant="outline" size="sm" icon={Download} onClick={handleExport}>
                  تصدير Excel
                </Btn>
                <Btn variant="outline" size="sm" icon={Printer} onClick={printArea}>
                  طباعة الكشف
                </Btn>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function fmt(v: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)
    + " " + ({ ILS: "₪", USD: "$", JOD: "د.أ", EUR: "€" }[currency] ?? "")
}
