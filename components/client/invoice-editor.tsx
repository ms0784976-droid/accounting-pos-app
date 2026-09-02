"use client"

// ================================================================
// محرّر الفاتورة — يخدم البيع والشراء والمرتجعات
// ================================================================
// الفرق الجوهري عن النسخة السابقة: الفاتورة صارت مستنداً حقيقياً
// متعدد الأصناف بضريبة وخصم وترقيم تسلسلي، بدل تسجيل صنف واحد
// لكل عملية.
//
// كل الحسابات المعروضة هنا للعرض الفوري فقط. المبالغ المعتمدة
// تُعاد حسابتها في قاعدة البيانات عند الحفظ — لا نثق بحساب المتصفح.

import { useState, useMemo, useEffect, useRef } from "react"
import { useSession, useAsyncData, todayIn } from "@/lib/session"
import { createInvoiceAction } from "@/app/actions/invoices"
import { fetchProductsFullAction, findProductByBarcodeAction } from "@/app/actions/inventory"
import { fetchPartiesAction } from "@/app/actions/parties"
import { fetchCashAccountsAction } from "@/app/actions/treasury"
import {
  SectionCard, DataTable, Th, Td, Money, Field, TextInput, NumberInput,
  SelectInput, TextArea, Btn, IconBtn, InlineError, InfoNote, EmptyState,
  useToast, formatQty,
} from "./ui"
import { UNITS } from "@/lib/units"
import { INVOICE_TYPE_META, CURRENCY_MAP } from "@/lib/constants"
import type {
  InvoiceType, PaymentMethod, UnitCode, Product, InvoiceWithLines,
} from "@/lib/types"
import { Plus, Trash2, ScanLine, Search, Save, X } from "lucide-react"
import { describeError } from "@/lib/errors"

interface Line {
  key: string
  productId: string | null
  itemName: string
  sku: string
  unit: UnitCode
  quantity: string
  unitPrice: string
  /** "percent" = خصم بالنسبة · "amount" = خصم بمبلغ ثابت بالعملة */
  discountMode: "percent" | "amount"
  discountValue: string
  taxPercent: string
  stockQty: number
}

/** خصم السطر بالعملة — مصدر واحد للحقيقة يستخدمه العرض والحفظ */
function lineDiscount(l: Line): number {
  const gross = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)
  const value = Number(l.discountValue) || 0
  if (value <= 0) return 0
  const raw = l.discountMode === "amount" ? value : gross * (value / 100)
  return Math.min(Math.round(raw * 100) / 100, Math.round(gross * 100) / 100)
}

export function InvoiceEditor({ type, onSaved, onCancel }: {
  type: InvoiceType
  onSaved: (invoice: InvoiceWithLines) => void
  onCancel?: () => void
}) {
  const { currency, company } = useSession()
  const { notify } = useToast()
  const tz = company?.timezone ?? "Asia/Hebron"
  const meta = INVOICE_TYPE_META[type]
  const currencySymbol = CURRENCY_MAP.get(currency)?.symbol ?? currency
  const isSale = type === "sale" || type === "sale_return"
  const defaultTax = company?.vatEnabled ? company.vatRate : 0

  const products = useAsyncData(() => fetchProductsFullAction({ activeOnly: true }), [])
  const parties = useAsyncData(
    () => fetchPartiesAction(isSale ? "customer" : "supplier"), [isSale]
  )
  const cash = useAsyncData(() => fetchCashAccountsAction(), [])

  const [partyId, setPartyId] = useState("")
  const [date, setDate] = useState(todayIn(tz))
  const [dueDate, setDueDate] = useState("")
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [cashId, setCashId] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [picker, setPicker] = useState(false)

  const defaultCash = cash.data?.find((c) => c.isDefault) ?? cash.data?.[0]
  const selectedCash = cashId || defaultCash?.id || ""
  const selectedParty = parties.data?.find((p) => p.id === partyId)

  // مهلة السداد تحدد تاريخ الاستحقاق تلقائياً
  useEffect(() => {
    if (method === "credit" && selectedParty?.paymentTermsDays) {
      const d = new Date(date + "T12:00:00")
      d.setDate(d.getDate() + selectedParty.paymentTermsDays)
      setDueDate(d.toISOString().split("T")[0])
    }
  }, [method, selectedParty, date])

  /* ── إدارة الأسطر ── */

  const addLine = (product?: Product) => {
    setLines((ls) => [
      ...ls,
      {
        key: Math.random().toString(36).slice(2),
        productId: product?.id ?? null,
        itemName: product?.name ?? "",
        sku: product?.sku ?? "",
        unit: product?.unit ?? "pcs",
        quantity: "1",
        unitPrice: String(
          product ? (isSale ? product.lastPrice : product.lastCost) || "" : ""
        ),
        discountMode: "amount",
        discountValue: "",
        taxPercent: String(product?.taxPercent ?? defaultTax ?? 0),
        stockQty: product?.stockQty ?? 0,
      },
    ])
    setPicker(false)
  }

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const removeLine = (key: string) =>
    setLines((ls) => ls.filter((l) => l.key !== key))

  /* ── الإجماليات (عرض فوري) ── */

  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, tax = 0
    for (const l of lines) {
      const gross = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)
      const disc = lineDiscount(l)
      const net = gross - disc
      subtotal += gross
      discount += disc
      tax += net * ((Number(l.taxPercent) || 0) / 100)
    }
    return {
      subtotal,
      discount,
      tax,
      total: subtotal - discount + tax,
    }
  }, [lines])

  /* ── تحذيرات قبل الحفظ ── */

  const warnings = useMemo(() => {
    const out: string[] = []
    if (isSale && type === "sale") {
      for (const l of lines) {
        if (!l.productId) continue
        const qty = Number(l.quantity) || 0
        if (qty > l.stockQty) {
          out.push(`"${l.itemName}": الكمية المطلوبة ${formatQty(qty)} والرصيد ${formatQty(l.stockQty)}`)
        }
      }
    }
    if (method === "credit" && selectedParty && selectedParty.creditLimit > 0) {
      const after = selectedParty.balance + totals.total
      if (after > selectedParty.creditLimit) {
        out.push(
          `سقف ائتمان "${selectedParty.name}" ${selectedParty.creditLimit.toFixed(2)} ` +
          `والرصيد بعد الفاتورة سيصبح ${after.toFixed(2)}`
        )
      }
    }
    return out
  }, [lines, isSale, type, method, selectedParty, totals.total])

  /* ── الحفظ ── */

  const save = async () => {
    setError("")
    if (!lines.length) { setError("أضف صنفاً واحداً على الأقل"); return }
    if (method === "credit" && !partyId) {
      setError(`الفاتورة الآجلة تتطلب تحديد ${meta.partyLabel}`); return
    }
    for (const [i, l] of lines.entries()) {
      if (!l.itemName.trim())      { setError(`السطر ${i + 1}: اسم الصنف مطلوب`); return }
      if (!(Number(l.quantity) > 0)) { setError(`السطر ${i + 1}: الكمية يجب أن تكون أكبر من صفر`); return }

      const gross = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)
      const value = Number(l.discountValue) || 0
      if (value < 0) {
        setError(`السطر ${i + 1}: الخصم لا يمكن أن يكون سالباً`); return
      }
      if (l.discountMode === "percent" && value > 100) {
        setError(`السطر ${i + 1}: نسبة الخصم يجب أن تكون بين 0 و 100`); return
      }
      if (l.discountMode === "amount" && value > gross + 0.001) {
        setError(
          `السطر ${i + 1}: الخصم (${value.toFixed(2)}) أكبر من قيمة السطر (${gross.toFixed(2)})`
        ); return
      }
    }

    setBusy(true)
    try {
      const invoice = await createInvoiceAction({
        type,
        partyId: partyId || null,
        date,
        dueDate: method === "credit" ? dueDate || null : null,
        paymentMethod: method,
        cashAccountId: method === "credit" ? null : selectedCash,
        reference,
        notes,
        lines: lines.map((l) => ({
          productId: l.productId,
          itemName: l.itemName.trim(),
          sku: l.sku,
          unit: l.unit,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice) || 0,
          discountPercent:
            l.discountMode === "percent" ? Number(l.discountValue) || 0 : 0,
          discountAmount:
            l.discountMode === "amount" ? lineDiscount(l) : 0,
          taxPercent: Number(l.taxPercent) || 0,
        })),
      })
      notify(`تم حفظ الفاتورة ${invoice.invoiceNo}`)
      onSaved(invoice)
    } catch (e) {
      setError(describeError(e, "تعذّر حفظ الفاتورة"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
      {/* ── الأصناف ── */}
      <div className="space-y-4">
        <SectionCard
          title="أصناف الفاتورة"
          description={`${lines.length} سطر`}
          action={
            <div className="flex gap-2">
              <Btn size="sm" variant="outline" icon={Search} onClick={() => setPicker(true)}>
                اختيار صنف
              </Btn>
              <Btn size="sm" variant="ghost" icon={Plus} onClick={() => addLine()}>
                سطر يدوي
              </Btn>
            </div>
          }
        >
          {!lines.length ? (
            <EmptyState
              message="لا أصناف بعد"
              hint="اختر صنفاً من الكتالوج أو امسح الباركود"
              action={<Btn size="sm" icon={Search} onClick={() => setPicker(true)}>اختيار صنف</Btn>}
            />
          ) : (
            <DataTable>
              <thead className="sticky-head">
                <tr>
                  <Th width="34px" align="center">#</Th>
                  <Th>الصنف</Th>
                  <Th width="90px">الوحدة</Th>
                  <Th align="left" width="90px">الكمية</Th>
                  <Th align="left" width="105px">السعر</Th>
                  <Th align="left" width="128px">الخصم</Th>
                  <Th align="left" width="80px">ضريبة %</Th>
                  <Th align="left" width="115px">الإجمالي</Th>
                  <Th width="40px" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const gross = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)
                  const net = gross - lineDiscount(l)
                  const lineTotal = net + net * ((Number(l.taxPercent) || 0) / 100)
                  const short = isSale && type === "sale" && l.productId &&
                                (Number(l.quantity) || 0) > l.stockQty

                  return (
                    <tr key={l.key} className="border-t border-border">
                      <Td align="center" className="text-xs text-muted-foreground num">{i + 1}</Td>
                      <Td>
                        <TextInput
                          value={l.itemName}
                          onChange={(e) => updateLine(l.key, { itemName: e.target.value })}
                          placeholder="اسم الصنف"
                          className="h-8"
                        />
                        {l.productId && (
                          <p className={`text-[10px] mt-0.5 num ${short ? "text-danger" : "text-muted-foreground"}`}>
                            {l.sku && `${l.sku} · `}الرصيد {formatQty(l.stockQty)}
                          </p>
                        )}
                      </Td>
                      <Td>
                        <SelectInput
                          value={l.unit}
                          onChange={(e) => updateLine(l.key, { unit: e.target.value as UnitCode })}
                          className="h-8 text-xs"
                        >
                          {UNITS.map((u) => (
                            <option key={u.code} value={u.code}>{u.short}</option>
                          ))}
                        </SelectInput>
                      </Td>
                      <Td>
                        <NumberInput
                          value={l.quantity}
                          onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                          min={0} step="0.001"
                          className={`h-8 ${short ? "border-danger" : ""}`}
                        />
                      </Td>
                      <Td>
                        <NumberInput
                          value={l.unitPrice}
                          onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })}
                          min={0} step="0.01" className="h-8"
                        />
                      </Td>
                      <Td>
                        <div className="flex items-stretch gap-1">
                          <NumberInput
                            value={l.discountValue}
                            onChange={(e) => updateLine(l.key, { discountValue: e.target.value })}
                            min={0}
                            max={l.discountMode === "percent" ? 100 : undefined}
                            step="0.01" placeholder="0" className="h-8"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateLine(l.key, {
                                discountMode: l.discountMode === "amount" ? "percent" : "amount",
                              })
                            }
                            title={l.discountMode === "amount"
                              ? "خصم بالمبلغ — اضغط للتحويل إلى نسبة مئوية"
                              : "خصم بالنسبة — اضغط للتحويل إلى مبلغ"}
                            aria-label="تبديل نوع الخصم"
                            className="h-8 w-8 shrink-0 rounded-lg border border-border
                                       bg-muted text-sm font-semibold
                                       hover:bg-muted/70 transition"
                          >
                            {l.discountMode === "amount" ? currencySymbol : "%"}
                          </button>
                        </div>
                        {l.discountMode === "percent" && lineDiscount(l) > 0 && (
                          <p className="text-[10px] text-muted-foreground num mt-0.5">
                            = {lineDiscount(l).toFixed(2)}
                          </p>
                        )}
                      </Td>
                      <Td>
                        <NumberInput
                          value={l.taxPercent}
                          onChange={(e) => updateLine(l.key, { taxPercent: e.target.value })}
                          min={0} max={100} step="0.01" className="h-8"
                        />
                      </Td>
                      <Td align="left">
                        <Money value={lineTotal} currency={currency} bold />
                      </Td>
                      <Td align="center">
                        <IconBtn icon={Trash2} label="حذف السطر" tone="danger"
                                 onClick={() => removeLine(l.key)} />
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
          )}
        </SectionCard>

        {!!warnings.length && (
          <div className="space-y-2">
            {warnings.map((w, i) => <InlineError key={i} message={w} />)}
          </div>
        )}
      </div>

      {/* ── تفاصيل الفاتورة ── */}
      <div className="space-y-4 lg:sticky lg:top-20">
        <SectionCard title={meta.label} padded>
          <div className="space-y-3.5">
            <Field label={meta.partyLabel} required={method === "credit"}>
              <SelectInput value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                <option value="">{isSale ? "زبون نقدي" : "بدون مورد"}</option>
                {(parties.data ?? []).filter((p) => p.isActive).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{Math.abs(p.balance) > 0.009 ? ` (${p.balance.toFixed(2)})` : ""}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="التاريخ" required>
                <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)}
                           className="num" />
              </Field>
              <Field label="طريقة الدفع" required>
                <SelectInput value={method}
                             onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="credit">آجل</option>
                </SelectInput>
              </Field>
            </div>

            {method === "credit" ? (
              <Field label="تاريخ الاستحقاق"
                     hint={selectedParty?.paymentTermsDays ? `مهلة ${selectedParty.paymentTermsDays} يوم` : undefined}>
                <TextInput type="date" value={dueDate}
                           onChange={(e) => setDueDate(e.target.value)} className="num" />
              </Field>
            ) : (
              <Field label="الصندوق / البنك" required>
                <SelectInput value={selectedCash} onChange={(e) => setCashId(e.target.value)}>
                  {(cash.data ?? []).filter((c) => c.isActive).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </SelectInput>
              </Field>
            )}

            <Field label="مرجع خارجي" hint={isSale ? "رقم أمر الشراء" : "رقم فاتورة المورد"}>
              <TextInput value={reference} onChange={(e) => setReference(e.target.value)}
                         dir="ltr" className="text-left" />
            </Field>

            <Field label="ملاحظات">
              <TextArea value={notes} onChange={(e) => setNotes(e.target.value)}
                        className="min-h-16" />
            </Field>
          </div>
        </SectionCard>

        {/* ── الإجماليات ── */}
        <SectionCard padded className="border-primary/25">
          <dl className="space-y-2 text-sm">
            <Row label="المجموع قبل الخصم" value={totals.subtotal} currency={currency} />
            {totals.discount > 0 && (
              <Row label="الخصم" value={-totals.discount} currency={currency} tone="danger" />
            )}
            {totals.tax > 0 && (
              <Row label={`ضريبة القيمة المضافة`} value={totals.tax} currency={currency} />
            )}
            <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-border-strong">
              <dt className="font-semibold text-foreground">الإجمالي</dt>
              <dd><Money value={totals.total} currency={currency} bold className="text-base" /></dd>
            </div>
          </dl>

          {!company?.vatEnabled && (
            <div className="mt-3">
              <InfoNote>
                ضريبة القيمة المضافة معطّلة في إعدادات الشركة. فعّلها من &quot;حسابي&quot; إن كنت مسجّلاً ضريبياً.
              </InfoNote>
            </div>
          )}

          {error && <div className="mt-3"><InlineError message={error} /></div>}

          <div className="flex gap-2 mt-4">
            {onCancel && (
              <Btn variant="ghost" icon={X} onClick={onCancel} className="flex-1">إلغاء</Btn>
            )}
            <Btn icon={Save} onClick={save} loading={busy}
                 disabled={!lines.length} className="flex-1">
              حفظ وتأكيد
            </Btn>
          </div>

          <p className="text-[11px] text-muted-foreground mt-2.5 leading-relaxed">
            الحفظ يحرّك المخزون وينشئ القيد المحاسبي معاً. لا يمكن تعديل الفاتورة بعد
            التأكيد — يمكن إلغاؤها بقيد عكسي أو إنشاء مرتجع.
          </p>
        </SectionCard>
      </div>

      {picker && (
        <ProductPicker
          products={products.data ?? []}
          loading={products.loading}
          isSale={isSale}
          onPick={addLine}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  )
}

function Row({ label, value, currency, tone }: {
  label: string; value: number; currency: string; tone?: "danger"
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={tone === "danger" ? "text-danger" : ""}>
        <Money value={value} currency={currency} />
      </dd>
    </div>
  )
}

/* ================================================================ */
/* منتقي الأصناف — بحث بالاسم أو الكود أو الباركود                   */
/* ================================================================ */

function ProductPicker({ products, loading, isSale, onPick, onClose }: {
  products: Product[]
  loading: boolean
  isSale: boolean
  onPick: (p: Product) => void
  onClose: () => void
}) {
  const [term, setTerm] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase()
    if (!q) return products.slice(0, 60)
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q)
    ).slice(0, 60)
  }, [products, term])

  // مسح الباركود: إدخال سريع ينتهي بـ Enter
  const onKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    const exact = products.find((p) => p.barcode === term.trim() || p.sku === term.trim())
    if (exact) { onPick(exact); return }
    const remote = await findProductByBarcodeAction(term.trim())
    if (remote) onPick(remote)
    else if (filtered.length === 1) onPick(filtered[0])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 no-print">
      <div className="absolute inset-0 bg-foreground/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl
                      shadow-overlay overflow-hidden animate-rise">
        <div className="relative border-b border-border">
          <ScanLine className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2
                               size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKey}
            placeholder="ابحث بالاسم أو الكود، أو امسح الباركود…"
            className="w-full h-12 bg-transparent pr-11 pl-4 text-sm text-foreground
                       placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-11 rounded-lg" />)}
            </div>
          ) : !filtered.length ? (
            <EmptyState message="لا نتائج" hint="جرّب اسماً أو كوداً آخر" />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => onPick(p)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5
                               text-right hover:bg-muted transition"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      {p.notes && (
                        <p className="text-[11px] text-foreground/70 truncate" title={p.notes}>
                          {p.notes}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground num">
                        {p.sku || "—"}
                        {p.type !== "service" && ` · الرصيد ${formatQty(p.stockQty)}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-left">
                      <p className="text-sm num text-foreground">
                        {(isSale ? p.lastPrice : p.lastCost).toFixed(2)}
                      </p>
                      {p.type !== "service" && p.stockQty <= p.minQty && p.minQty > 0 && (
                        <p className="text-[10px] text-warning">تحت الحد الأدنى</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            اضغط Enter بعد مسح الباركود لإضافة الصنف مباشرة
          </p>
          <Btn size="sm" variant="ghost" onClick={onClose}>إغلاق</Btn>
        </div>
      </div>
    </div>
  )
}
