"use client"

// ================================================================
// الأصناف
// ================================================================
// أضيف: الباركود، الحد الأدنى الحقيقي، التصنيف كجدول قابل للتحرير،
// نسبة ضريبة لكل صنف، والرصيد الافتتاحي كقيد محاسبي — لا كمشترى وهمي
// باسم مورد "رصيد افتتاحي" كما كان يحدث سابقاً.

import { useState, useMemo } from "react"
import { useSession, useAsyncData, todayIn } from "@/lib/session"
import {
  fetchProductsFullAction, addProductFullAction, updateProductFullAction,
  fetchProductCategoriesAction, addProductCategoryAction, deleteProductCategoryAction,
  applyStockTakeAction,
} from "@/app/actions/inventory"
import {
  PageHeader, SectionCard, DataTable, Th, Td, Tr, TotalRow, Money, Badge,
  EmptyState, TableSkeleton, InlineError, InfoNote, Modal, ConfirmDialog,
  Field, TextInput, NumberInput, SelectInput, TextArea, SearchBox,
  StatCard, Btn, IconBtn, TabBar, useToast, formatQty, exportToCsv,
} from "./ui"
import { UNITS } from "@/lib/units"
import { PRODUCT_TYPE_META } from "@/lib/constants"
import type { Product, ProductType, UnitCode } from "@/lib/types"
import {
  Plus, Pencil, Package, Tags, Download, PackageX, EyeOff, Coins, ChevronDown,
} from "lucide-react"
import { describeError } from "@/lib/errors"

type View = "active" | "low" | "inactive"

export function CatalogTab() {
  const { currency, company, can } = useSession()
  const { notify } = useToast()

  const [view, setView] = useState<View>("active")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [managingCats, setManagingCats] = useState(false)

  const products = useAsyncData(
    () => fetchProductsFullAction({ activeOnly: false }), []
  )

  const rows = useMemo(() => {
    let list = products.data ?? []

    if (view === "active")   list = list.filter((p) => p.isActive)
    if (view === "inactive") list = list.filter((p) => !p.isActive)
    if (view === "low") {
      list = list.filter(
        (p) => p.isActive && p.type !== "service" && p.minQty > 0 && p.stockQty <= p.minQty
      )
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.category.toLowerCase().includes(q)
      )
    }
    return list
  }, [products.data, view, search])

  const stats = useMemo(() => {
    const list = (products.data ?? []).filter((p) => p.isActive)
    const tracked = list.filter((p) => p.type !== "service")
    return {
      total: list.length,
      services: list.length - tracked.length,
      value: tracked.reduce((s, p) => s + p.stockQty * p.avgCost, 0),
      low: tracked.filter((p) => p.minQty > 0 && p.stockQty <= p.minQty).length,
    }
  }, [products.data])

  const handleExport = () => {
    exportToCsv(
      `الأصناف-${todayIn(company?.timezone)}.csv`,
      ["الاسم", "الوصف", "الكود", "الباركود", "التصنيف", "النوع", "الوحدة", "الرصيد", "الحد الأدنى", "التكلفة المرجحة", "سعر البيع"],
      rows.map((p) => [
        p.name, p.notes, p.sku, p.barcode, p.category, PRODUCT_TYPE_META[p.type].label,
        p.unit, p.stockQty.toString(), p.minQty.toString(),
        p.avgCost.toFixed(4), p.lastPrice.toFixed(2),
      ])
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="الأصناف"
        subtitle="الرصيد والتكلفة المرجّحة يُحدَّثان تلقائياً من حركات المخزون"
        actions={
          <>
            <Btn variant="outline" size="sm" icon={Download} onClick={handleExport}>تصدير</Btn>
            {can("manageProducts") && (
              <>
                <Btn variant="outline" size="sm" icon={Tags} onClick={() => setManagingCats(true)}>
                  التصنيفات
                </Btn>
                <Btn icon={Plus} onClick={() => setCreating(true)}>صنف جديد</Btn>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard label="عدد الأصناف" value={String(stats.total)} icon={Package} />
        <StatCard label="قيمة المخزون" value={compact(stats.value, currency)}
                  hint="بالتكلفة المرجّحة" icon={Coins} />
        <StatCard label="تحت الحد الأدنى" value={String(stats.low)}
                  tone={stats.low > 0 ? "warning" : "neutral"} icon={PackageX}
                  onClick={() => setView("low")} />
        <StatCard label="خدمات (بلا مخزون)" value={String(stats.services)} icon={Package} />
      </div>

      <SectionCard>
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
          <TabBar<View>
            tabs={[
              { id: "active", label: "النشطة" },
              { id: "low", label: "تحت الحد الأدنى", count: stats.low },
              { id: "inactive", label: "المعطّلة" },
            ]}
            active={view}
            onChange={setView}
          />
          <div className="w-full sm:w-72">
            <SearchBox value={search} onChange={setSearch}
                       placeholder="الاسم أو الكود أو الباركود…" />
          </div>
        </div>

        {products.error && <div className="px-5 pb-4"><InlineError message={products.error} /></div>}

        {products.loading ? (
          <TableSkeleton rows={7} cols={7} />
        ) : !rows.length ? (
          <EmptyState
            message={search ? "لا نتائج" : view === "low" ? "لا أصناف تحت الحد الأدنى" : "لا أصناف"}
            hint={view === "active" && !search ? "ابدأ بإضافة أصنافك مع أرصدتها الافتتاحية" : undefined}
            action={can("manageProducts") && view === "active" && !search &&
              <Btn size="sm" icon={Plus} onClick={() => setCreating(true)}>صنف جديد</Btn>}
          />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th>الصنف</Th>
                <Th width="110px">التصنيف</Th>
                <Th width="95px">النوع</Th>
                <Th align="left" width="110px">الرصيد</Th>
                <Th align="left" width="95px">الحد الأدنى</Th>
                {can("viewFinancials") && <Th align="left" width="105px">التكلفة</Th>}
                <Th align="left" width="105px">سعر البيع</Th>
                <Th align="center" width="60px" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const tracks = p.type !== "service"
                const low = tracks && p.minQty > 0 && p.stockQty <= p.minQty
                const negative = tracks && p.stockQty < 0

                return (
                  <Tr key={p.id} muted={!p.isActive}
                      onClick={can("manageProducts") ? () => setEditing(p) : undefined}>
                    <Td>
                      <div className="font-medium text-sm">{p.name}</div>
                      {p.notes && (
                        <div className="text-[11px] text-foreground/70 leading-snug mt-0.5"
                             title={p.notes}>
                          {p.notes}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground num">
                        {p.sku || "—"}
                        {p.barcode && ` · ${p.barcode}`}
                      </div>
                    </Td>
                    <Td className="text-xs text-muted-foreground">{p.category || "—"}</Td>
                    <Td>
                      <Badge label={PRODUCT_TYPE_META[p.type].label}
                             tint={PRODUCT_TYPE_META[p.type].color} />
                    </Td>
                    <Td align="left" mono>
                      {tracks ? (
                        <span className={negative ? "text-danger font-semibold"
                                       : low ? "text-warning font-semibold" : ""}>
                          {formatQty(p.stockQty)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </Td>
                    <Td align="left" mono className="text-xs text-muted-foreground">
                      {tracks && p.minQty > 0 ? formatQty(p.minQty) : "—"}
                    </Td>
                    {can("viewFinancials") && (
                      <Td align="left" className="text-muted-foreground">
                        {tracks ? <Money value={p.avgCost} currency={currency} /> : "—"}
                      </Td>
                    )}
                    <Td align="left"><Money value={p.lastPrice} currency={currency} /></Td>
                    <Td align="center">
                      {can("manageProducts") && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <IconBtn icon={Pencil} label="تعديل" onClick={() => setEditing(p)} />
                        </div>
                      )}
                    </Td>
                  </Tr>
                )
              })}
              {can("viewFinancials") && (
                <TotalRow>
                  <Td colSpan={5}>قيمة المخزون ({rows.length} صنف)</Td>
                  <Td align="left" colSpan={3}>
                    <Money
                      value={rows.filter((p) => p.type !== "service")
                                 .reduce((s, p) => s + p.stockQty * p.avgCost, 0)}
                      currency={currency} bold
                    />
                  </Td>
                </TotalRow>
              )}
            </tbody>
          </DataTable>
        )}
      </SectionCard>

      {(creating || editing) && (
        <ProductForm
          product={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { products.reload(); notify("تم الحفظ") }}
        />
      )}

      {managingCats && (
        <CategoriesModal onClose={() => { setManagingCats(false); products.reload() }} />
      )}
    </div>
  )
}

/* ================================================================ */
/* نموذج الصنف                                                       */
/* ================================================================ */

function ProductForm({ product, onClose, onSaved }: {
  product: Product | null
  onClose: () => void
  onSaved: () => void
}) {
  const { currency, company, can } = useSession()
  const { notify } = useToast()
  const tz = company?.timezone ?? "Asia/Hebron"

  const cats = useAsyncData(() => fetchProductCategoriesAction(), [])

  const [form, setForm] = useState(() => ({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    unit: (product?.unit ?? "pcs") as UnitCode,
    type: (product?.type ?? "product") as ProductType,
    categoryId: product?.categoryId ?? "",
    lastCost: product ? String(product.lastCost) : "",
    lastPrice: product ? String(product.lastPrice) : "",
    minQty: product ? String(product.minQty || "") : "",
    taxPercent: product?.taxPercent !== null && product?.taxPercent !== undefined
      ? String(product.taxPercent) : "",
    notes: product?.notes ?? "",
    allowNegativeStock: product?.allowNegativeStock ?? false,
    isActive: product?.isActive ?? true,
  }))

  const [opening, setOpening] = useState({ qty: "", cost: "", date: todayIn(tz) })
  // تصحيح رصيد صنف قائم — نُدخل الرصيد الفعلي، والنظام يسجّل الفرق فقط
  const [adjust, setAdjust] = useState({ qty: "", date: todayIn(tz), note: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  /** الخيارات المتقدمة مطوية افتراضياً — تُفتح تلقائياً عند التعديل
      إذا كان الصنف يحمل قيماً فيها، حتى لا تختفي عن المستخدم */
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    () => !!product && !!(product.barcode || product.sku || product.categoryId || product.minQty)
  )

  /** الفرق بين الرصيد الفعلي المُدخل والرصيد الدفتري — null إذا لم يُدخل شيء */
  const adjustDiff = useMemo(() => {
    if (!product || adjust.qty.trim() === "") return null
    const target = Number(adjust.qty)
    if (!Number.isFinite(target)) return null
    const diff = target - product.stockQty
    return Math.abs(diff) < 0.0001 ? 0 : diff
  }, [product, adjust.qty])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const tracks = form.type !== "service"
  const margin = Number(form.lastPrice) - Number(form.lastCost)
  const marginPct = Number(form.lastCost) > 0
    ? (margin / Number(form.lastCost)) * 100 : 0

  const save = async () => {
    setError("")
    if (!form.name.trim()) { setError("اسم الصنف مطلوب"); return }
    if (Number(form.lastPrice) < 0 || Number(form.lastCost) < 0) {
      setError("السعر أو التكلفة غير صالحة"); return
    }

    setBusy(true)
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        barcode: form.barcode,
        unit: form.unit,
        type: form.type,
        categoryId: form.categoryId || null,
        lastPrice: Number(form.lastPrice) || 0,
        minQty: Number(form.minQty) || 0,
        taxPercent: form.taxPercent === "" ? null : Number(form.taxPercent),
        notes: form.notes,
        allowNegativeStock: form.allowNegativeStock,
      }

      if (product) {
        await updateProductFullAction(product.id, {
          ...payload,
          isActive: form.isActive,
          ...(can("editCosts") ? { lastCost: Number(form.lastCost) || 0 } : {}),
        })

        // تصحيح الرصيد: نسجّل الفرق كتسوية جرد — لا نضيف الرقم على الرصيد
        if (adjustDiff !== null && adjustDiff !== 0) {
          await applyStockTakeAction(
            adjust.date,
            [{ productId: product.id, countedQty: Number(adjust.qty) }],
            adjust.note.trim() || "تصحيح رصيد من شاشة الأصناف"
          )
          notify(
            `تم تعديل الرصيد إلى ${formatQty(Number(adjust.qty))} ` +
            `(تسوية ${adjustDiff > 0 ? "+" : ""}${formatQty(adjustDiff)})`
          )
        }
      } else {
        await addProductFullAction({
          ...payload,
          lastCost: Number(form.lastCost) || 0,
          openingQty: Number(opening.qty) || 0,
          openingCost: Number(opening.cost) || Number(form.lastCost) || 0,
          openingDate: opening.date,
        })
      }

      onSaved()
      onClose()
    } catch (e) {
      setError(describeError(e, "تعذّر الحفظ"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? `تعديل: ${product.name}` : "صنف جديد"}
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn onClick={save} loading={busy}>حفظ</Btn>
        </>
      }
    >
      <div className="space-y-4">
        {/* ══ الأساسي — أربعة حقول فقط ══
            كانت الشاشة تعرض عشرين حقلاً دفعة واحدة، فيتوقّف من يُدخل
            صنفه الأول لا يدري أيّها مطلوب. الظاهر الآن هو ما يلزم
            فعلاً: الاسم، سعر البيع، سعر التكلفة، والكمية الحالية.
            الباقي كما هو بالضبط لكن تحت "خيارات متقدمة" — لم يُحذف
            حقل واحد ولم يتغيّر أي حساب. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم الصنف" required>
            <TextInput value={form.name} onChange={(e) => set("name", e.target.value)}
                       placeholder="رز بسمتي 5 كغم" autoFocus />
          </Field>

          <Field label="سعر البيع">
            <NumberInput value={form.lastPrice}
                         onChange={(e) => set("lastPrice", e.target.value)}
                         min={0} step="0.01" />
          </Field>

          <Field
            label="سعر التكلفة"
            hint={
              product && !can("editCosts")
                ? "تحتاج صلاحية أعلى"
                : Number(form.lastCost) > 0
                  ? `الربح ${margin.toFixed(2)} (${marginPct.toFixed(0)}%)`
                  : "يُحدَّث تلقائياً من المشتريات"
            }
          >
            <NumberInput
              value={form.lastCost}
              onChange={(e) => set("lastCost", e.target.value)}
              min={0} step="0.01"
              disabled={!!product && !can("editCosts")}
            />
          </Field>

          {tracks && !product && (
            <Field label="الكمية الموجودة عندك الآن"
                   hint="اتركها فارغة إذا كان الصنف جديداً ولم يصل بعد">
              <NumberInput value={opening.qty}
                           onChange={(e) => setOpening((o) => ({ ...o, qty: e.target.value }))}
                           min={0} step="0.001" placeholder="0" />
            </Field>
          )}

          {tracks && product && (
            <Field label="الرصيد الحالي">
              <div className="h-9 flex items-center px-3 rounded-lg bg-muted text-sm num">
                {formatQty(product.stockQty)}
                <span className="text-xs text-muted-foreground mr-2">
                  بتكلفة {product.avgCost.toFixed(4)}
                </span>
              </div>
            </Field>
          )}
        </div>

        {/* ══ خيارات متقدمة — مطوية افتراضياً ══ */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="flex w-full items-center gap-2 rounded-lg border border-border
                     px-3.5 py-2.5 text-right text-sm font-medium text-foreground/85
                     transition hover:border-border-strong hover:bg-muted/50"
        >
          <ChevronDown className={`size-4 shrink-0 transition-transform ${showAdvanced ? "" : "-rotate-90"}`} />
          خيارات متقدمة
          <span className="mr-auto text-[11px] font-normal text-muted-foreground">
            الباركود · الوحدة · التصنيف · الضريبة · الحد الأدنى
          </span>
        </button>

        {showAdvanced && (
        <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نوع الصنف" required hint={PRODUCT_TYPE_META[form.type].hint}>
            <SelectInput value={form.type}
                         onChange={(e) => set("type", e.target.value as ProductType)}>
              {(Object.keys(PRODUCT_TYPE_META) as ProductType[]).map((t) => (
                <option key={t} value={t}>{PRODUCT_TYPE_META[t].label}</option>
              ))}
            </SelectInput>
          </Field>

          <Field label="كود الصنف (SKU)" hint="فريد داخل الشركة">
            <TextInput value={form.sku} onChange={(e) => set("sku", e.target.value)}
                       dir="ltr" className="text-left num" placeholder="R-001" />
          </Field>

          <Field label="الباركود" hint="يُستخدم مع الماسح الضوئي في شاشة البيع">
            <TextInput value={form.barcode} onChange={(e) => set("barcode", e.target.value)}
                       dir="ltr" className="text-left num" />
          </Field>

          <Field label="وحدة القياس" required>
            <SelectInput value={form.unit}
                         onChange={(e) => set("unit", e.target.value as UnitCode)}>
              {UNITS.map((u) => (
                <option key={u.code} value={u.code}>{u.label}</option>
              ))}
            </SelectInput>
          </Field>

          <Field label="التصنيف">
            <SelectInput value={form.categoryId}
                         onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">— بدون —</option>
              {(cats.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectInput>
          </Field>

          {company?.vatEnabled && (
            <Field label="نسبة الضريبة الخاصة بالصنف"
                   hint={`اتركه فارغاً لاستخدام نسبة الشركة (${company.vatRate}%)`}>
              <NumberInput value={form.taxPercent}
                           onChange={(e) => set("taxPercent", e.target.value)}
                           min={0} max={100} step="0.01"
                           placeholder={String(company.vatRate)} />
            </Field>
          )}
        </div>

        {/* ── المخزون ── */}
        {tracks && (
          <div className="rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">المخزون</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="الحد الأدنى للتنبيه"
                     hint="ينبّهك عند نزول الرصيد لهذا الحد. صفر = بلا تنبيه">
                <NumberInput value={form.minQty} onChange={(e) => set("minQty", e.target.value)}
                             min={0} step="0.001" placeholder="0" />
              </Field>

            </div>

            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.allowNegativeStock}
                onChange={(e) => set("allowNegativeStock", e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              <span className="text-foreground/85">السماح بالبيع عند نفاد الرصيد</span>
            </label>

            {/* صنف جديد → رصيد افتتاحي. صنف قائم → تصحيح رصيد بالفرق. */}
            {!product ? (
              <div className="rounded-lg bg-muted/40 p-3 space-y-3">
                <InfoNote>
                  الرصيد الافتتاحي يسجّل الكمية الموجودة فعلاً قبل استخدام البرنامج،
                  كقيد محاسبي — لا كفاتورة شراء وهمية.
                </InfoNote>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="تكلفة الوحدة">
                    <NumberInput value={opening.cost}
                                 onChange={(e) => setOpening((o) => ({ ...o, cost: e.target.value }))}
                                 min={0} step="0.01"
                                 placeholder={form.lastCost || "0.00"} />
                  </Field>
                  <Field label="التاريخ">
                    <TextInput type="date" value={opening.date}
                               onChange={(e) => setOpening((o) => ({ ...o, date: e.target.value }))}
                               className="num" />
                  </Field>
                </div>
              </div>
            ) : can("editCosts") ? (
              <div className="rounded-lg bg-muted/40 p-3 space-y-3">
                <InfoNote>
                  اكتب الرصيد <strong>الفعلي</strong> الموجود عندك الآن. النظام يسجّل
                  الفرق فقط كتسوية مخزون بقيد محاسبي — ولا يجمع الرقم على الرصيد الحالي.
                  اتركه فارغاً إن لم ترد تعديل الرصيد.
                </InfoNote>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="الرصيد الفعلي الآن"
                         hint={`الرصيد الدفتري ${formatQty(product.stockQty)}`}>
                    <NumberInput value={adjust.qty}
                                 onChange={(e) => setAdjust((a) => ({ ...a, qty: e.target.value }))}
                                 step="0.001"
                                 placeholder={formatQty(product.stockQty)} />
                  </Field>
                  <Field label="التاريخ">
                    <TextInput type="date" value={adjust.date}
                               onChange={(e) => setAdjust((a) => ({ ...a, date: e.target.value }))}
                               className="num" />
                  </Field>
                  <Field label="سبب التعديل">
                    <TextInput value={adjust.note}
                               onChange={(e) => setAdjust((a) => ({ ...a, note: e.target.value }))}
                               placeholder="جرد فعلي / تصحيح إدخال" />
                  </Field>
                </div>

                {adjustDiff !== null && (
                  <p className={`text-xs num ${
                    adjustDiff === 0 ? "text-muted-foreground"
                    : adjustDiff > 0 ? "text-success" : "text-warning"
                  }`}>
                    {adjustDiff === 0
                      ? "لا فرق — لن تُسجَّل أي حركة."
                      : `سيتم تسجيل تسوية ${adjustDiff > 0 ? "زيادة" : "نقص"} بمقدار ${formatQty(Math.abs(adjustDiff))} ` +
                        `(من ${formatQty(product.stockQty)} إلى ${formatQty(Number(adjust.qty))}).`}
                  </p>
                )}
              </div>
            ) : (
              <InfoNote>تعديل رصيد المخزون يحتاج صلاحية أعلى.</InfoNote>
            )}
          </div>
        )}

        <Field label="ملاحظات">
          <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)}
                    className="min-h-16" />
        </Field>
        </div>
        )}

        {product && (
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            <span className="text-foreground/85">الصنف نشط ويظهر في شاشات البيع</span>
          </label>
        )}

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}

/* ================================================================ */
/* تصنيفات الأصناف                                                   */
/* ================================================================ */

function CategoriesModal({ onClose }: { onClose: () => void }) {
  const { notify } = useToast()
  const cats = useAsyncData(() => fetchProductCategoriesAction(), [])

  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null)

  const add = async () => {
    setError("")
    if (!name.trim()) { setError("اسم التصنيف مطلوب"); return }
    setBusy(true)
    try {
      await addProductCategoryAction(name)
      setName("")
      cats.reload()
      notify("تمت الإضافة")
    } catch (e) {
      setError(describeError(e, "تعذّرت الإضافة"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title="تصنيفات الأصناف"
             footer={<Btn variant="ghost" onClick={onClose}>إغلاق</Btn>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
            <Field label="اسم التصنيف">
              <TextInput value={name} onChange={(e) => setName(e.target.value)}
                         placeholder="مواد غذائية"
                         onKeyDown={(e) => e.key === "Enter" && add()} />
            </Field>
            <Btn icon={Plus} onClick={add} loading={busy}>إضافة</Btn>
          </div>

          {error && <InlineError message={error} />}

          <div className="surface overflow-hidden">
            {cats.loading ? (
              <TableSkeleton rows={3} cols={2} />
            ) : !cats.data?.length ? (
              <EmptyState message="لا تصنيفات بعد" />
            ) : (
              <ul className="divide-y divide-border">
                {cats.data.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-sm">{c.name}</span>
                    <IconBtn icon={EyeOff} label="حذف التصنيف" tone="danger"
                             onClick={() => setDeleting({ id: c.id, name: c.name })} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف التصنيف"
        message={deleting
          ? `سيتم حذف "${deleting.name}" وإزالة التصنيف عن الأصناف المرتبطة به. الأصناف نفسها لن تُحذف.`
          : ""}
        confirmLabel="حذف"
        onConfirm={async () => {
          if (!deleting) return
          await deleteProductCategoryAction(deleting.id)
          cats.reload()
          notify("تم الحذف")
        }}
      />
    </>
  )
}

function compact(v: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)
    + " " + ({ ILS: "₪", USD: "$", JOD: "د.أ", EUR: "€" }[currency] ?? "")
}
