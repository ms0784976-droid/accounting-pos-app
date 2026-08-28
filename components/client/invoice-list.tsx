"use client"

// ================================================================
// قائمة الفواتير — مشتركة بين المبيعات والمشتريات
// ================================================================
// شاشة واحدة تخدم النوعين بدل تكرار الكود مرتين. الفرق بينهما
// بيانات وصفية فقط (اسم الطرف، اتجاه المرتجع، الصلاحية المطلوبة).

import { useState, useMemo } from "react"
import { useSession, useAsyncData, resolvePreset, todayIn } from "@/lib/session"
import {
  fetchInvoicesAction, fetchInvoiceAction,
  cancelInvoiceAction, createReturnAction,
} from "@/app/actions/invoices"
import {
  PageHeader, SectionCard, DataTable, Th, Td, Tr, TotalRow, Money, Badge,
  EmptyState, TableSkeleton, InlineError, InfoNote, Drawer, Modal, ConfirmDialog,
  Field, NumberInput, TextInput, TextArea, SearchBox, DateRangePicker, TabBar,
  StatCard, Btn, IconBtn, useToast, formatDate, formatQty, exportToCsv,
} from "./ui"
import { InvoiceEditor } from "./invoice-editor"
import { InvoicePrint } from "./invoice-print"
import { INVOICE_TYPE_META, INVOICE_STATUS_META, PAYMENT_METHOD_META } from "@/lib/constants"
import { unitShort } from "@/lib/units"
import type { Invoice, InvoiceWithLines, InvoiceType, InvoiceStatus } from "@/lib/types"
import {
  Plus, Printer, Ban, Undo2, Download, FileText, Receipt, TrendingUp, Coins,
} from "lucide-react"

type Filter = "all" | InvoiceStatus

export function InvoiceList({ kind }: { kind: "sale" | "purchase" }) {
  const { currency, company, can } = useSession()
  const { notify } = useToast()
  const tz = company?.timezone ?? "Asia/Hebron"

  const mainType: InvoiceType = kind
  const returnType: InvoiceType = kind === "sale" ? "sale_return" : "purchase_return"
  const meta = INVOICE_TYPE_META[mainType]
  const canCreate = can(kind === "sale" ? "createSale" : "createPurchase")

  const month = useMemo(() => resolvePreset("this-month", tz), [tz])
  const [range, setRange] = useState(month)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")

  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [printId, setPrintId] = useState<string | null>(null)

  const invoices = useAsyncData(
    () => fetchInvoicesAction({ from: range.from, to: range.to, limit: 500 }),
    [range.from, range.to]
  )

  const rows = useMemo(() => {
    let list = (invoices.data ?? []).filter(
      (i) => i.type === mainType || i.type === returnType
    )
    if (filter !== "all") list = list.filter((i) => i.status === filter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.invoiceNo.toLowerCase().includes(q) ||
          i.partyName.toLowerCase().includes(q) ||
          i.reference.toLowerCase().includes(q)
      )
    }
    return list
  }, [invoices.data, mainType, returnType, filter, search])

  /* الإجماليات تحسب المرتجع بالسالب — وإلا الأرقام تكذب */
  const totals = useMemo(() => {
    const live = rows.filter((i) => i.status === "confirmed")
    const sign = (i: Invoice) => (i.type === mainType ? 1 : -1)
    return {
      count: live.length,
      net: live.reduce((s, i) => s + sign(i) * (i.subtotal - i.discountAmount), 0),
      tax: live.reduce((s, i) => s + sign(i) * i.taxAmount, 0),
      total: live.reduce((s, i) => s + sign(i) * i.total, 0),
      cost: live.reduce((s, i) => s + sign(i) * i.costTotal, 0),
      credit: live.filter((i) => i.paymentMethod === "credit")
                  .reduce((s, i) => s + sign(i) * i.total, 0),
    }
  }, [rows, mainType])

  const handleExport = () => {
    exportToCsv(
      `${kind === "sale" ? "المبيعات" : "المشتريات"}-${range.from}_${range.to}.csv`,
      ["الرقم", "النوع", "التاريخ", meta.partyLabel, "الدفع", "الحالة", "الصافي", "الضريبة", "الإجمالي"],
      rows.map((i) => [
        i.invoiceNo,
        INVOICE_TYPE_META[i.type].short,
        i.date,
        i.partyName || "—",
        PAYMENT_METHOD_META[i.paymentMethod].label,
        INVOICE_STATUS_META[i.status].label,
        (i.subtotal - i.discountAmount).toFixed(2),
        i.taxAmount.toFixed(2),
        i.total.toFixed(2),
      ])
    )
  }

  if (creating) {
    return (
      <div className="space-y-5">
        <PageHeader
          title={meta.label}
          subtitle="أضف الأصناف ثم احفظ — الحفظ يحرّك المخزون وينشئ القيد معاً"
        />
        <InvoiceEditor
          type={mainType}
          onCancel={() => setCreating(false)}
          onSaved={(inv) => {
            setCreating(false)
            invoices.reload()
            setPrintId(inv.id)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={kind === "sale" ? "المبيعات" : "المشتريات"}
        subtitle={`${formatDate(range.from)} — ${formatDate(range.to)}`}
        actions={
          <>
            <Btn variant="outline" size="sm" icon={Download} onClick={handleExport}>تصدير</Btn>
            {canCreate && (
              <Btn icon={Plus} onClick={() => setCreating(true)}>{meta.label}</Btn>
            )}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={kind === "sale" ? "صافي المبيعات" : "صافي المشتريات"}
          value={compact(totals.net, currency)}
          hint={`${totals.count} فاتورة مؤكّدة`}
          icon={kind === "sale" ? TrendingUp : Receipt}
        />
        {kind === "sale" && can("viewFinancials") && (
          <StatCard
            label="مجمل الربح"
            value={compact(totals.net - totals.cost, currency)}
            hint="قبل المصاريف التشغيلية"
            tone={totals.net - totals.cost < 0 ? "danger" : "success"}
            icon={Coins}
          />
        )}
        <StatCard
          label="الضريبة"
          value={compact(totals.tax, currency)}
          hint={company?.vatEnabled ? `نسبة ${company.vatRate}%` : "الضريبة معطّلة"}
          icon={FileText}
        />
        <StatCard
          label="آجل غير مسدّد"
          value={compact(totals.credit, currency)}
          tone={totals.credit > 0 ? "warning" : "neutral"}
          icon={Receipt}
        />
      </div>

      <SectionCard>
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
          <TabBar<Filter>
            tabs={[
              { id: "all", label: "الكل", count: rows.length },
              { id: "confirmed", label: "مؤكّدة" },
              { id: "cancelled", label: "ملغاة" },
            ]}
            active={filter}
            onChange={setFilter}
          />
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker from={range.from} to={range.to}
                             onChange={(from, to) => setRange({ from, to })} />
            <div className="w-52">
              <SearchBox value={search} onChange={setSearch} placeholder="رقم الفاتورة أو الاسم…" />
            </div>
          </div>
        </div>

        {invoices.error && <div className="px-5 pb-4"><InlineError message={invoices.error} /></div>}

        {invoices.loading ? (
          <TableSkeleton rows={7} cols={7} />
        ) : !rows.length ? (
          <EmptyState
            message="لا فواتير في هذه الفترة"
            hint={canCreate ? "ابدأ بتسجيل فاتورة جديدة" : undefined}
            action={canCreate && <Btn size="sm" icon={Plus} onClick={() => setCreating(true)}>فاتورة جديدة</Btn>}
          />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th width="115px">الرقم</Th>
                <Th width="105px">النوع</Th>
                <Th>{meta.partyLabel}</Th>
                <Th width="95px">التاريخ</Th>
                <Th width="75px">الدفع</Th>
                <Th width="80px">الحالة</Th>
                <Th align="left" width="115px">الإجمالي</Th>
                <Th align="center" width="110px">إجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const isReturn = inv.type === returnType
                const cancelled = inv.status === "cancelled"
                return (
                  <Tr key={inv.id} muted={cancelled} onClick={() => setDetailId(inv.id)}>
                    <Td mono className="text-xs">{inv.invoiceNo}</Td>
                    <Td>
                      <Badge label={INVOICE_TYPE_META[inv.type].short}
                             tint={INVOICE_TYPE_META[inv.type].tint} />
                    </Td>
                    <Td>
                      <span className={cancelled ? "line-through" : ""}>
                        {inv.partyName || (kind === "sale" ? "زبون نقدي" : "—")}
                      </span>
                      {inv.reference && (
                        <span className="mr-2 text-[10px] text-muted-foreground num">
                          {inv.reference}
                        </span>
                      )}
                    </Td>
                    <Td mono className="text-xs">{formatDate(inv.date)}</Td>
                    <Td>
                      <Badge label={PAYMENT_METHOD_META[inv.paymentMethod].label}
                             tint={PAYMENT_METHOD_META[inv.paymentMethod].tint} />
                    </Td>
                    <Td>
                      <Badge label={INVOICE_STATUS_META[inv.status].label}
                             tint={INVOICE_STATUS_META[inv.status].tint} />
                    </Td>
                    <Td align="left">
                      <Money value={isReturn ? -inv.total : inv.total} currency={currency} />
                    </Td>
                    <Td align="center">
                      <div className="flex items-center justify-center gap-0.5"
                           onClick={(e) => e.stopPropagation()}>
                        <IconBtn icon={Printer} label="طباعة" onClick={() => setPrintId(inv.id)} />
                        <IconBtn icon={FileText} label="التفاصيل" onClick={() => setDetailId(inv.id)} />
                      </div>
                    </Td>
                  </Tr>
                )
              })}
              <TotalRow>
                <Td colSpan={6}>الإجمالي المؤكّد ({totals.count})</Td>
                <Td align="left"><Money value={totals.total} currency={currency} colored /></Td>
                <Td />
              </TotalRow>
            </tbody>
          </DataTable>
        )}
      </SectionCard>

      {detailId && (
        <InvoiceDetail
          invoiceId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => { invoices.reload(); notify("تم التنفيذ") }}
          onPrint={() => { setPrintId(detailId); setDetailId(null) }}
        />
      )}

      {printId && <InvoicePrint invoiceId={printId} onClose={() => setPrintId(null)} />}
    </div>
  )
}

/* ================================================================ */
/* تفاصيل الفاتورة                                                   */
/* ================================================================ */

function InvoiceDetail({ invoiceId, onClose, onChanged, onPrint }: {
  invoiceId: string
  onClose: () => void
  onChanged: () => void
  onPrint: () => void
}) {
  const { currency, can } = useSession()
  const [cancelling, setCancelling] = useState(false)
  const [returning, setReturning] = useState(false)

  const inv = useAsyncData(() => fetchInvoiceAction(invoiceId), [invoiceId])
  const data = inv.data

  const canReturn =
    data?.status === "confirmed" &&
    (data.type === "sale" || data.type === "purchase") &&
    can("cancelDocument")

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={data ? `${INVOICE_TYPE_META[data.type].label} ${data.invoiceNo}` : "…"}
        description={data ? `${formatDate(data.date)} · ${data.partyName || "بدون طرف"}` : undefined}
        footer={
          <>
            {canReturn && (
              <Btn variant="outline" size="sm" icon={Undo2} onClick={() => setReturning(true)}>
                إنشاء مرتجع
              </Btn>
            )}
            {data?.status === "confirmed" && can("cancelDocument") && (
              <Btn variant="danger" size="sm" icon={Ban} onClick={() => setCancelling(true)}>
                إلغاء الفاتورة
              </Btn>
            )}
            <Btn variant="outline" size="sm" icon={Printer} onClick={onPrint}>طباعة</Btn>
            <Btn variant="ghost" size="sm" onClick={onClose}>إغلاق</Btn>
          </>
        }
      >
        {inv.loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : inv.error ? (
          <div className="p-5"><InlineError message={inv.error} /></div>
        ) : !data ? (
          <EmptyState message="الفاتورة غير موجودة" />
        ) : (
          <div className="p-5 space-y-5">
            {data.status === "cancelled" && (
              <InlineError
                message={`هذه الفاتورة ملغاة${data.cancelReason ? ` — السبب: ${data.cancelReason}` : ""}. تم عكس قيدها المحاسبي وإرجاع المخزون، والسجل محفوظ كما هو.`}
              />
            )}

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <Meta label="الحالة">
                <Badge label={INVOICE_STATUS_META[data.status].label}
                       tint={INVOICE_STATUS_META[data.status].tint} />
              </Meta>
              <Meta label="طريقة الدفع">
                <Badge label={PAYMENT_METHOD_META[data.paymentMethod].label}
                       tint={PAYMENT_METHOD_META[data.paymentMethod].tint} />
              </Meta>
              {data.dueDate && (
                <Meta label="الاستحقاق">
                  <span className="num text-xs">{formatDate(data.dueDate)}</span>
                </Meta>
              )}
              {data.reference && (
                <Meta label="مرجع خارجي">
                  <span className="num text-xs">{data.reference}</span>
                </Meta>
              )}
              {can("viewFinancials") && data.costTotal > 0 && (
                <>
                  <Meta label="تكلفة البضاعة">
                    <Money value={data.costTotal} currency={currency} />
                  </Meta>
                  <Meta label="مجمل الربح">
                    <Money value={data.subtotal - data.discountAmount - data.costTotal}
                           currency={currency} colored bold />
                  </Meta>
                </>
              )}
            </dl>

            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">الأصناف</h3>
              <div className="surface overflow-hidden">
                <DataTable>
                  <thead>
                    <tr>
                      <Th>الصنف</Th>
                      <Th align="left" width="85px">الكمية</Th>
                      <Th align="left" width="90px">السعر</Th>
                      <Th align="left" width="80px">الخصم</Th>
                      <Th align="left" width="80px">الضريبة</Th>
                      <Th align="left" width="100px">الإجمالي</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((l) => (
                      <Tr key={l.id}>
                        <Td>
                          <div className="text-sm">{l.itemName}</div>
                          {l.sku && <div className="text-[10px] text-muted-foreground num">{l.sku}</div>}
                        </Td>
                        <Td align="left" mono className="text-xs">
                          {formatQty(l.quantity)} {unitShort(l.unit)}
                        </Td>
                        <Td align="left" mono className="text-xs">{l.unitPrice.toFixed(2)}</Td>
                        <Td align="left" mono className="text-xs text-muted-foreground">
                          {l.discountAmount ? l.discountAmount.toFixed(2) : "—"}
                        </Td>
                        <Td align="left" mono className="text-xs text-muted-foreground">
                          {l.taxAmount ? l.taxAmount.toFixed(2) : "—"}
                        </Td>
                        <Td align="left"><Money value={l.lineTotal} currency={currency} /></Td>
                      </Tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>
            </div>

            <dl className="space-y-2 text-sm max-w-xs mr-auto">
              <SumRow label="المجموع" value={data.subtotal} currency={currency} />
              {data.discountAmount > 0 && (
                <SumRow label="الخصم" value={-data.discountAmount} currency={currency} />
              )}
              {data.taxAmount > 0 && (
                <SumRow label="الضريبة" value={data.taxAmount} currency={currency} />
              )}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border-strong">
                <dt className="font-semibold">الإجمالي</dt>
                <dd><Money value={data.total} currency={currency} bold /></dd>
              </div>
            </dl>

            {data.notes && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                {data.notes}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        title="إلغاء الفاتورة"
        message="سيتم إنشاء قيد عكسي وإرجاع المخزون. الفاتورة لن تُحذف — تبقى في السجل بحالة «ملغاة» مع سبب الإلغاء."
        confirmLabel="تأكيد الإلغاء"
        requireReason
        onConfirm={async (reason) => {
          await cancelInvoiceAction(invoiceId, reason ?? "")
          onChanged()
          onClose()
        }}
      />

      {returning && data && (
        <ReturnModal
          invoice={data}
          onClose={() => setReturning(false)}
          onDone={() => { setReturning(false); onChanged(); onClose() }}
        />
      )}
    </>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground mb-1">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function SumRow({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd><Money value={value} currency={currency} /></dd>
    </div>
  )
}

/* ================================================================ */
/* المرتجع                                                           */
/* ================================================================ */

function ReturnModal({ invoice, onClose, onDone }: {
  invoice: InvoiceWithLines
  onClose: () => void
  onDone: () => void
}) {
  const { currency, company } = useSession()
  const { notify } = useToast()
  const tz = company?.timezone ?? "Asia/Hebron"

  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(invoice.lines.map((l) => [l.id, ""]))
  )
  const [date, setDate] = useState(todayIn(tz))
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const selected = invoice.lines
    .map((l) => ({ line: l, q: Number(qty[l.id]) || 0 }))
    .filter((x) => x.q > 0)

  const total = selected.reduce((s, { line, q }) => {
    const gross = q * line.unitPrice
    const net = gross - gross * (line.discountPercent / 100)
    return s + net + net * (line.taxPercent / 100)
  }, 0)

  const submit = async () => {
    setError("")
    if (!selected.length) { setError("حدّد كمية مرتجعة لصنف واحد على الأقل"); return }

    setBusy(true)
    try {
      await createReturnAction(
        invoice.id,
        selected.map(({ line, q }) => ({ lineId: line.id, quantity: q })),
        date,
        reason
      )
      notify("تم إنشاء المرتجع")
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر إنشاء المرتجع")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`مرتجع على الفاتورة ${invoice.invoiceNo}`}
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn onClick={submit} loading={busy} disabled={!selected.length}>
            إنشاء المرتجع
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <InfoNote>
          حدّد الكمية المرتجعة من كل صنف. المرتجع يُنشئ فاتورة مستقلة بقيدها الخاص
          ويعيد البضاعة للمخزن — الفاتورة الأصلية تبقى كما هي.
        </InfoNote>

        <div className="surface overflow-hidden">
          <DataTable>
            <thead>
              <tr>
                <Th>الصنف</Th>
                <Th align="left" width="90px">المُباع</Th>
                <Th align="left" width="110px">المرتجع</Th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l) => (
                <Tr key={l.id}>
                  <Td>
                    <div className="text-sm">{l.itemName}</div>
                    <div className="text-[10px] text-muted-foreground num">
                      {l.unitPrice.toFixed(2)} × {unitShort(l.unit)}
                    </div>
                  </Td>
                  <Td align="left" mono className="text-xs">{formatQty(l.quantity)}</Td>
                  <Td align="left">
                    <NumberInput
                      value={qty[l.id]}
                      onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))}
                      min={0} max={l.quantity} step="0.001"
                      placeholder="0" className="h-8"
                    />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="تاريخ المرتجع" required>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="num" />
          </Field>
          <Field label="قيمة المرتجع">
            <div className="h-9 flex items-center px-3 rounded-lg bg-muted">
              <Money value={total} currency={currency} bold />
            </div>
          </Field>
        </div>

        <Field label="سبب المرتجع">
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="بضاعة تالفة، خطأ في الطلب…" className="min-h-16" />
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
