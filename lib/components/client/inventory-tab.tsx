"use client"

// ================================================================
// المخزون — الأرصدة والحركات والجرد الفعلي
// ================================================================
// الرصيد هنا مصدره جدول حركات المخزون، لا حساب يُعاد في المتصفح
// من المشتريات ناقص المبيعات كما كان سابقاً. كل حركة مسجّلة برصيدها
// وتكلفتها المرجّحة لحظة وقوعها، فيمكن تتبّع أي رقم لمصدره.

import { useState, useMemo } from "react"
import { useSession, useAsyncData, resolvePreset, todayIn } from "@/lib/session"
import {
  fetchProductsFullAction, fetchStockMovesAction,
  fetchStockTakeSheetAction, applyStockTakeAction,
} from "@/app/actions/inventory"
import { fetchLowStockAction } from "@/app/actions/reports"
import {
  PageHeader, SectionCard, DataTable, Th, Td, Tr, TotalRow, Money, Badge,
  EmptyState, TableSkeleton, InlineError, InfoNote, Drawer, Modal,
  Field, TextInput, NumberInput, TextArea, SearchBox, DateRangePicker,
  StatCard, TabBar, Btn, IconBtn, useToast,
  formatDate, formatQty, exportToCsv, printArea,
} from "./ui"
import { unitShort } from "@/lib/units"
import { PRODUCT_TYPE_META } from "@/lib/constants"
import type { Product, StockMove } from "@/lib/types"
import {
  Boxes, PackageX, Coins, Download, ClipboardCheck, History, Printer, AlertTriangle,
} from "lucide-react"
import { describeError } from "@/lib/errors"

/** ترجمة مصدر الحركة — الرقم بلا مصدر لا قيمة له في التدقيق */
const SOURCE_LABELS: Record<string, string> = {
  opening: "رصيد افتتاحي",
  purchase: "فاتورة شراء",
  sale: "فاتورة بيع",
  sale_return: "مرتجع بيع",
  purchase_return: "مرتجع شراء",
  adjustment: "تسوية / إلغاء",
  stock_take: "جرد فعلي",
}

type View = "balances" | "moves" | "low"

export function InventoryTab() {
  const { currency, company, can } = useSession()
  const { notify } = useToast()
  const tz = company?.timezone ?? "Asia/Hebron"
  const month = useMemo(() => resolvePreset("this-month", tz), [tz])

  const [view, setView] = useState<View>("balances")
  const [search, setSearch] = useState("")
  const [range, setRange] = useState(month)
  const [cardFor, setCardFor] = useState<Product | null>(null)
  const [taking, setTaking] = useState(false)

  const products = useAsyncData(() => fetchProductsFullAction({ activeOnly: true }), [])
  const low = useAsyncData(() => fetchLowStockAction(), [])
  const moves = useAsyncData(
    () => (view === "moves"
      ? fetchStockMovesAction({ from: range.from, to: range.to, limit: 500 })
      : Promise.resolve([] as StockMove[])),
    [view, range.from, range.to]
  )

  const tracked = useMemo(
    () => (products.data ?? []).filter((p) => p.type !== "service"),
    [products.data]
  )

  const balanceRows = useMemo(() => {
    let list = tracked
    if (view === "low") {
      const ids = new Set((low.data ?? []).map((l) => l.productId))
      list = list.filter((p) => ids.has(p.id))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) ||
               p.sku.toLowerCase().includes(q) ||
               p.barcode.includes(q)
      )
    }
    return list
  }, [tracked, low.data, view, search])

  const moveRows = useMemo(() => {
    let list = moves.data ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (m) => m.productName.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q)
      )
    }
    return list
  }, [moves.data, search])

  const stats = useMemo(() => ({
    items: tracked.length,
    value: tracked.reduce((s, p) => s + p.stockQty * p.avgCost, 0),
    low: low.data?.length ?? 0,
    negative: tracked.filter((p) => p.stockQty < 0).length,
  }), [tracked, low.data])

  const handleExport = () => {
    if (view === "moves") {
      exportToCsv(
        `حركات-المخزون-${range.from}_${range.to}.csv`,
        ["التاريخ", "الصنف", "الكود", "المصدر", "وارد", "صادر", "التكلفة", "الرصيد بعد"],
        moveRows.map((m) => [
          m.date, m.productName, m.sku, SOURCE_LABELS[m.sourceType] ?? m.sourceType,
          m.qtyIn.toString(), m.qtyOut.toString(),
          m.unitCost.toFixed(4), m.balanceAfter.toString(),
        ])
      )
    } else {
      exportToCsv(
        `أرصدة-المخزون-${todayIn(tz)}.csv`,
        ["الصنف", "الكود", "الوحدة", "الرصيد", "الحد الأدنى", "التكلفة المرجحة", "القيمة"],
        balanceRows.map((p) => [
          p.name, p.sku, p.unit, p.stockQty.toString(), p.minQty.toString(),
          p.avgCost.toFixed(4), (p.stockQty * p.avgCost).toFixed(2),
        ])
      )
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="المخزون"
        subtitle="الأرصدة والتكاليف محسوبة من الحركات بالمتوسط المرجّح"
        actions={
          <>
            <Btn variant="outline" size="sm" icon={Download} onClick={handleExport}>تصدير</Btn>
            {can("editCosts") && (
              <Btn icon={ClipboardCheck} onClick={() => setTaking(true)}>جرد فعلي</Btn>
            )}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard label="أصناف متابَعة" value={String(stats.items)} icon={Boxes} />
        <StatCard label="قيمة المخزون" value={compact(stats.value, currency)}
                  hint="بالتكلفة المرجّحة" icon={Coins} />
        <StatCard label="تحت الحد الأدنى" value={String(stats.low)}
                  tone={stats.low > 0 ? "warning" : "neutral"} icon={PackageX}
                  onClick={() => setView("low")} />
        <StatCard label="رصيد سالب" value={String(stats.negative)}
                  hint={stats.negative > 0 ? "يحتاج تسوية بجرد" : "لا مشاكل"}
                  tone={stats.negative > 0 ? "danger" : "neutral"} icon={AlertTriangle} />
      </div>

      {stats.negative > 0 && (
        <InlineError
          message={`${stats.negative} صنف برصيد سالب — يعني بيعاً تمّ قبل تسجيل الشراء. شغّل جرداً فعلياً لتسويته بقيد محاسبي.`}
        />
      )}

      <SectionCard>
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
          <TabBar<View>
            tabs={[
              { id: "balances", label: "الأرصدة", count: tracked.length },
              { id: "low", label: "تحت الحد الأدنى", count: stats.low },
              { id: "moves", label: "الحركات" },
            ]}
            active={view}
            onChange={setView}
          />
          <div className="flex flex-wrap items-center gap-2">
            {view === "moves" && (
              <DateRangePicker from={range.from} to={range.to}
                               onChange={(from, to) => setRange({ from, to })} />
            )}
            <div className="w-56">
              <SearchBox value={search} onChange={setSearch} placeholder="اسم الصنف أو الكود…" />
            </div>
          </div>
        </div>

        {products.error && <div className="px-5 pb-4"><InlineError message={products.error} /></div>}

        {view === "moves" ? (
          moves.loading ? (
            <TableSkeleton rows={7} cols={7} />
          ) : !moveRows.length ? (
            <EmptyState message="لا حركات في هذه الفترة" />
          ) : (
            <DataTable>
              <thead className="sticky-head">
                <tr>
                  <Th width="95px">التاريخ</Th>
                  <Th>الصنف</Th>
                  <Th width="120px">المصدر</Th>
                  <Th align="left" width="95px">وارد</Th>
                  <Th align="left" width="95px">صادر</Th>
                  {can("viewFinancials") && <Th align="left" width="100px">التكلفة</Th>}
                  <Th align="left" width="105px">الرصيد بعد</Th>
                </tr>
              </thead>
              <tbody>
                {moveRows.map((m) => (
                  <Tr key={m.id}>
                    <Td mono className="text-xs">{formatDate(m.date)}</Td>
                    <Td>
                      <div className="text-sm">{m.productName}</div>
                      {m.note && <div className="text-[10px] text-muted-foreground">{m.note}</div>}
                    </Td>
                    <Td>
                      <Badge
                        label={SOURCE_LABELS[m.sourceType] ?? m.sourceType}
                        tint={m.qtyIn > 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}
                      />
                    </Td>
                    <Td align="left" mono className="text-success">
                      {m.qtyIn > 0 ? formatQty(m.qtyIn) : "—"}
                    </Td>
                    <Td align="left" mono className="text-danger">
                      {m.qtyOut > 0 ? formatQty(m.qtyOut) : "—"}
                    </Td>
                    {can("viewFinancials") && (
                      <Td align="left" mono className="text-xs text-muted-foreground">
                        {m.unitCost.toFixed(4)}
                      </Td>
                    )}
                    <Td align="left" mono className="font-medium">
                      {formatQty(m.balanceAfter)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )
        ) : products.loading ? (
          <TableSkeleton rows={7} cols={6} />
        ) : !balanceRows.length ? (
          <EmptyState
            message={view === "low" ? "لا أصناف تحت الحد الأدنى" : "لا أصناف في المخزون"}
          />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th>الصنف</Th>
                <Th width="90px">النوع</Th>
                <Th align="left" width="110px">الرصيد</Th>
                <Th align="left" width="100px">الحد الأدنى</Th>
                {can("viewFinancials") && <Th align="left" width="110px">التكلفة</Th>}
                {can("viewFinancials") && <Th align="left" width="120px">القيمة</Th>}
                <Th align="center" width="60px" />
              </tr>
            </thead>
            <tbody>
              {balanceRows.map((p) => {
                const isLow = p.minQty > 0 && p.stockQty <= p.minQty
                const isNeg = p.stockQty < 0
                return (
                  <Tr key={p.id} onClick={() => setCardFor(p)}>
                    <Td>
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground num">
                        {p.sku || "—"} · {unitShort(p.unit)}
                      </div>
                    </Td>
                    <Td>
                      <Badge label={PRODUCT_TYPE_META[p.type].label}
                             tint={PRODUCT_TYPE_META[p.type].color} />
                    </Td>
                    <Td align="left" mono>
                      <span className={isNeg ? "text-danger font-semibold"
                                     : isLow ? "text-warning font-semibold" : ""}>
                        {formatQty(p.stockQty)}
                      </span>
                    </Td>
                    <Td align="left" mono className="text-xs text-muted-foreground">
                      {p.minQty > 0 ? formatQty(p.minQty) : "—"}
                    </Td>
                    {can("viewFinancials") && (
                      <Td align="left" className="text-muted-foreground">
                        <Money value={p.avgCost} currency={currency} />
                      </Td>
                    )}
                    {can("viewFinancials") && (
                      <Td align="left">
                        <Money value={p.stockQty * p.avgCost} currency={currency} />
                      </Td>
                    )}
                    <Td align="center">
                      <div onClick={(e) => e.stopPropagation()}>
                        <IconBtn icon={History} label="كرت الصنف" onClick={() => setCardFor(p)} />
                      </div>
                    </Td>
                  </Tr>
                )
              })}
              {can("viewFinancials") && (
                <TotalRow>
                  <Td colSpan={5}>إجمالي القيمة ({balanceRows.length} صنف)</Td>
                  <Td align="left" colSpan={2}>
                    <Money
                      value={balanceRows.reduce((s, p) => s + p.stockQty * p.avgCost, 0)}
                      currency={currency} bold
                    />
                  </Td>
                </TotalRow>
              )}
            </tbody>
          </DataTable>
        )}
      </SectionCard>

      {cardFor && <ItemCard product={cardFor} onClose={() => setCardFor(null)} />}

      {taking && (
        <StockTakeModal
          onClose={() => setTaking(false)}
          onDone={(adjusted) => {
            products.reload(); low.reload(); moves.reload()
            notify(adjusted > 0 ? `تمت تسوية ${adjusted} صنف` : "لا فروقات — المخزون مطابق")
          }}
        />
      )}
    </div>
  )
}

/* ================================================================ */
/* كرت الصنف — كل حركة على الصنف من أول يوم                          */
/* ================================================================ */

function ItemCard({ product, onClose }: { product: Product; onClose: () => void }) {
  const { currency, can } = useSession()
  const moves = useAsyncData(
    () => fetchStockMovesAction({ productId: product.id, limit: 300 }),
    [product.id]
  )

  const totals = useMemo(() => {
    const list = moves.data ?? []
    return {
      in: list.reduce((s, m) => s + m.qtyIn, 0),
      out: list.reduce((s, m) => s + m.qtyOut, 0),
    }
  }, [moves.data])

  const handleExport = () => {
    if (!moves.data) return
    exportToCsv(
      `كرت-صنف-${product.name}.csv`,
      ["التاريخ", "المصدر", "وارد", "صادر", "التكلفة", "الرصيد بعد"],
      moves.data.map((m) => [
        m.date, SOURCE_LABELS[m.sourceType] ?? m.sourceType,
        m.qtyIn.toString(), m.qtyOut.toString(),
        m.unitCost.toFixed(4), m.balanceAfter.toString(),
      ])
    )
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`كرت الصنف: ${product.name}`}
      description={`${product.sku || "بلا كود"} · ${unitShort(product.unit)}`}
      footer={
        <>
          <Btn variant="outline" size="sm" icon={Download} onClick={handleExport}>تصدير</Btn>
          <Btn variant="outline" size="sm" icon={Printer} onClick={printArea}>طباعة</Btn>
          <Btn variant="ghost" size="sm" onClick={onClose}>إغلاق</Btn>
        </>
      }
    >
      <div className="print-area">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b border-border">
          <Mini label="الرصيد الحالي" value={formatQty(product.stockQty)}
                tone={product.stockQty < 0 ? "danger" : undefined} />
          <Mini label="إجمالي الوارد" value={formatQty(totals.in)} />
          <Mini label="إجمالي الصادر" value={formatQty(totals.out)} />
          {can("viewFinancials") && (
            <Mini label="التكلفة المرجّحة" value={product.avgCost.toFixed(4)} />
          )}
        </div>

        {moves.loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : !moves.data?.length ? (
          <EmptyState message="لا حركات على هذا الصنف" />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th width="95px">التاريخ</Th>
                <Th width="120px">المصدر</Th>
                <Th align="left" width="85px">وارد</Th>
                <Th align="left" width="85px">صادر</Th>
                {can("viewFinancials") && <Th align="left" width="95px">التكلفة</Th>}
                <Th align="left" width="95px">الرصيد</Th>
              </tr>
            </thead>
            <tbody>
              {[...moves.data].reverse().map((m) => (
                <Tr key={m.id}>
                  <Td mono className="text-xs">{formatDate(m.date)}</Td>
                  <Td className="text-xs">
                    {SOURCE_LABELS[m.sourceType] ?? m.sourceType}
                    {m.note && <div className="text-[10px] text-muted-foreground">{m.note}</div>}
                  </Td>
                  <Td align="left" mono className="text-success">
                    {m.qtyIn > 0 ? formatQty(m.qtyIn) : "—"}
                  </Td>
                  <Td align="left" mono className="text-danger">
                    {m.qtyOut > 0 ? formatQty(m.qtyOut) : "—"}
                  </Td>
                  {can("viewFinancials") && (
                    <Td align="left" mono className="text-xs text-muted-foreground">
                      {m.unitCost.toFixed(4)}
                    </Td>
                  )}
                  <Td align="left" mono className="font-medium">{formatQty(m.balanceAfter)}</Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
    </Drawer>
  )
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-base font-semibold num ${tone === "danger" ? "text-danger" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  )
}

/* ================================================================ */
/* الجرد الفعلي                                                      */
/* ================================================================ */

function StockTakeModal({ onClose, onDone }: {
  onClose: () => void
  onDone: (adjusted: number) => void
}) {
  const { currency, company } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"

  const sheet = useAsyncData(() => fetchStockTakeSheetAction(), [])
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [date, setDate] = useState(todayIn(tz))
  const [note, setNote] = useState("")
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const rows = useMemo(() => {
    let list = sheet.data ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
      )
    }
    return list
  }, [sheet.data, search])

  /** الفروقات فقط — ما لم يُعدّ يُترك كما هو ولا يُصفَّر */
  const diffs = useMemo(() => {
    return (sheet.data ?? [])
      .filter((r) => counted[r.productId] !== undefined && counted[r.productId] !== "")
      .map((r) => {
        const c = Number(counted[r.productId])
        return { ...r, countedQty: c, diff: c - r.systemQty, value: (c - r.systemQty) * r.avgCost }
      })
      .filter((r) => Math.abs(r.diff) > 0.0001)
  }, [sheet.data, counted])

  const totalValue = diffs.reduce((s, d) => s + d.value, 0)

  const apply = async () => {
    setError("")
    if (!diffs.length) { setError("لا توجد فروقات لتسويتها"); return }

    setBusy(true)
    try {
      const res = await applyStockTakeAction(
        date,
        diffs.map((d) => ({ productId: d.productId, countedQty: d.countedQty })),
        note
      )
      onDone(res.adjusted)
      onClose()
    } catch (e) {
      setError(describeError(e, "تعذّر تطبيق الجرد"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="الجرد الفعلي"
      description="أدخل الكمية المعدودة فعلياً — الأصناف غير المعبّأة تبقى كما هي"
      size="xl"
      footer={
        <>
          <Btn variant="outline" size="sm" icon={Printer} onClick={printArea}>طباعة ورقة العد</Btn>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn onClick={apply} loading={busy} disabled={!diffs.length}>
            تطبيق التسوية ({diffs.length})
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <InfoNote>
          الفروقات تُسجَّل كحركات مخزون وقيد محاسبي واحد على حساب «فروقات الجرد».
          الزيادة تُضاف لقيمة المخزون، والعجز يُحمَّل كمصروف — وهكذا تبقى الدفاتر متوازنة
          بدل تعديل الأرصدة يدوياً بلا أثر محاسبي.
        </InfoNote>

        <div className="grid gap-3 sm:grid-cols-[150px_1fr] items-end">
          <Field label="تاريخ الجرد" required>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)}
                       className="num" />
          </Field>
          <div className="no-print">
            <Field label="بحث">
              <SearchBox value={search} onChange={setSearch} placeholder="اسم الصنف أو الكود…" />
            </Field>
          </div>
        </div>

        <div className="surface overflow-hidden max-h-80 overflow-y-auto">
          {sheet.loading ? (
            <TableSkeleton rows={6} cols={4} />
          ) : !rows.length ? (
            <EmptyState message="لا أصناف متابَعة للجرد" />
          ) : (
            <DataTable>
              <thead className="sticky-head">
                <tr>
                  <Th>الصنف</Th>
                  <Th align="left" width="100px">الدفتري</Th>
                  <Th align="left" width="110px">المعدود</Th>
                  <Th align="left" width="100px">الفرق</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const raw = counted[r.productId]
                  const has = raw !== undefined && raw !== ""
                  const diff = has ? Number(raw) - r.systemQty : 0
                  return (
                    <Tr key={r.productId}>
                      <Td>
                        <div className="text-sm">{r.name}</div>
                        <div className="text-[10px] text-muted-foreground num">
                          {r.sku || "—"} · {unitShort(r.unit)}
                        </div>
                      </Td>
                      <Td align="left" mono className="text-muted-foreground">
                        {formatQty(r.systemQty)}
                      </Td>
                      <Td align="left">
                        <NumberInput
                          value={raw ?? ""}
                          onChange={(e) =>
                            setCounted((c) => ({ ...c, [r.productId]: e.target.value }))
                          }
                          step="0.001" placeholder="—" className="h-8"
                        />
                      </Td>
                      <Td align="left" mono>
                        {!has ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : Math.abs(diff) < 0.0001 ? (
                          <span className="text-success text-xs">مطابق</span>
                        ) : (
                          <span className={diff > 0 ? "text-success font-medium" : "text-danger font-medium"}>
                            {diff > 0 ? "+" : ""}{formatQty(diff)}
                          </span>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </DataTable>
          )}
        </div>

        {!!diffs.length && (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2.5">
              ملخص التسوية ({diffs.length} صنف)
            </h3>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {diffs.map((d) => (
                <div key={d.productId} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-foreground/85">{d.name}</span>
                  <span className="shrink-0 flex items-center gap-3">
                    <span className={`num ${d.diff > 0 ? "text-success" : "text-danger"}`}>
                      {d.diff > 0 ? "+" : ""}{formatQty(d.diff)}
                    </span>
                    <Money value={d.value} currency={currency} colored />
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 pt-2.5 mt-2.5
                            border-t border-warning/30 text-sm">
              <span className="font-semibold">
                {totalValue >= 0 ? "زيادة جرد" : "عجز جرد"}
              </span>
              <Money value={totalValue} currency={currency} colored bold />
            </div>
          </div>
        )}

        <Field label="ملاحظات الجرد">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="جرد نهاية شهر آب — بحضور أمين المخزن"
                    className="min-h-16" />
        </Field>

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}

function compact(v: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)
    + " " + ({ ILS: "₪", USD: "$", JOD: "د.أ", EUR: "€" }[currency] ?? "")
}
