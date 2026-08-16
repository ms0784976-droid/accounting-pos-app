"use client"

import { useMemo, useState } from "react"
import { ShoppingCart, Printer, Search } from "lucide-react"
import { useClientStore } from "@/lib/store"
import { unitShort, unitLabel } from "@/lib/units"
import type { PaymentMethod, UnitCode } from "@/lib/types"
import { SectionCard, EmptyState, MethodBadge, StatCard, Btn, Modal, Field, TextInput } from "./ui"
import { UnitSelect } from "./unit-select"
import { Banknote, CreditCard, HandCoins } from "lucide-react"
import { cn } from "@/lib/utils"

/* ── فاتورة طباعة ──────────────────────────────────────────────────── */
function InvoicePrintModal({
  sale, onClose,
}: { sale: ReturnType<typeof useClientStore>["sales"][0] | null; onClose: () => void }) {
  const { fmt, userName } = useClientStore()
  if (!sale) return null
  const total = sale.quantity * sale.unitPrice

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white text-black rounded-2xl shadow-2xl overflow-hidden">
        <div id="invoice-print" className="p-6 space-y-4" dir="rtl">
          <div className="text-center border-b pb-4">
            <h1 className="text-2xl font-black">مُحاسِب</h1>
            <p className="text-xs text-gray-500 mt-1">فاتورة مبيعات</p>
          </div>
          <div className="text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-gray-500">رقم الفاتورة:</span><span className="font-mono font-bold">{sale.id.slice(0, 10)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">التاريخ:</span><span>{sale.date}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">الكاشير:</span><span>{userName(sale.userId)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">المشتري:</span><span className="font-semibold">{sale.buyer}</span></div>
          </div>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">
                <th className="px-3 py-2 text-right">الصنف</th>
                <th className="px-3 py-2 text-center">الكمية</th>
                <th className="px-3 py-2 text-left">السعر</th>
              </tr></thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-3 py-2">
                    {sale.itemName}
                    <br />
                    <span className="text-xs text-gray-400 font-mono">{sale.sku}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {sale.quantity} {unitShort(sale.unit)}
                  </td>
                  <td className="px-3 py-2 text-left">
                    {fmt(sale.unitPrice)}/{unitShort(sale.unit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center border-t pt-3">
            <span className="text-base font-bold">الإجمالي</span>
            <span className="text-xl font-black">{fmt(total)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>طريقة الدفع:</span>
            <span>{sale.method === "cash" ? "نقدي" : sale.method === "card" ? "بطاقة" : "آجل"}</span>
          </div>
          <div className="text-center pt-2 text-xs text-gray-400 border-t">شكراً لتعاملكم معنا</div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">إغلاق</button>
          <button
            onClick={() => window.print()}
            className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-500 transition"
          >
            <Printer className="size-4" />طباعة
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── نموذج بيع جديد مع دعم الكتالوج + الوحدات ─────────────────────── */
const emptyForm = {
  itemName: "", sku: "", unit: "pcs" as UnitCode,
  quantity: "", unitPrice: "", buyer: "", method: "cash" as PaymentMethod,
}

function NewSaleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addSale, currentTenantUser, today, products, fmt } = useClientStore()
  const [form, setForm] = useState({ ...emptyForm })
  const [showCatalog, setShowCatalog] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState("")

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const qty = Number(form.quantity) || 0
  const price = Number(form.unitPrice) || 0
  const total = qty * price
  const canSubmit = form.itemName.trim() && qty > 0 && price > 0 && form.buyer.trim()

  // اختيار صنف من الكتالوج
  function pickProduct(p: typeof products[0]) {
    setForm((f) => ({
      ...f,
      itemName: p.name,
      sku: p.sku,
      unit: p.unit,
      unitPrice: p.lastPrice > 0 ? String(p.lastPrice) : f.unitPrice,
    }))
    setShowCatalog(false)
    setCatalogSearch("")
  }

  const filteredProds = useMemo(() => {
    const q = catalogSearch.toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
  }, [products, catalogSearch])

  function handleSubmit() {
    if (!canSubmit) return
    addSale({
      itemName: form.itemName.trim(),
      sku: form.sku.trim() || form.itemName.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 12),
      unit: form.unit,
      quantity: qty, unitPrice: price,
      buyer: form.buyer.trim(), method: form.method,
      date: today, userId: currentTenantUser.id,
    })
    setForm({ ...emptyForm })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="فاتورة بيع جديدة"
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
          <Btn disabled={!canSubmit} onClick={handleSubmit}>
            <ShoppingCart className="size-4" />حفظ الفاتورة
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        {/* ── اختيار من الكتالوج ── */}
        <div>
          <button
            type="button"
            onClick={() => setShowCatalog((v) => !v)}
            className="w-full h-10 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 transition flex items-center justify-center gap-2"
          >
            <Search className="size-4" />
            {form.itemName ? `الصنف: ${form.itemName}` : "اختر صنفاً من كتالوج الأصناف"}
          </button>

          {showCatalog && (
            <div className="mt-2 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    autoFocus
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="ابحث في الأصناف..."
                    className="h-9 w-full rounded-lg border border-input bg-background pr-9 pl-3 text-sm focus:outline-none focus:border-ring"
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-border">
                {filteredProds.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProduct(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-right hover:bg-muted transition"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.sku} · {unitLabel(p.unit)}</p>
                    </div>
                    <span className="text-xs text-success font-semibold">
                      {p.lastPrice > 0 ? `${p.lastPrice} / ${unitShort(p.unit)}` : "—"}
                    </span>
                  </button>
                ))}
                {filteredProds.length === 0 && (
                  <div className="px-4 py-3 text-sm text-muted-foreground text-center">لا يوجد تطابق</div>
                )}
              </div>
              <div className="p-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCatalog(false)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition py-1"
                >
                  أو أدخل الصنف يدوياً بالأسفل ↓
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── البيانات اليدوية ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="اسم الصنف">
            <TextInput
              value={form.itemName}
              onChange={(e) => set("itemName", e.target.value)}
              placeholder="اسم البضاعة"
            />
          </Field>

          <Field label="كود الصنف (SKU)">
            <TextInput
              value={form.sku}
              onChange={(e) => set("sku", e.target.value.toUpperCase())}
              placeholder="يُحدد تلقائياً"
              className="font-mono"
            />
          </Field>

          <Field label="وحدة القياس">
            <UnitSelect
              value={form.unit}
              onChange={(v) => setForm((f) => ({ ...f, unit: v }))}
            />
          </Field>

          <Field label="الكمية">
            <div className="relative">
              <TextInput
                type="number" min={0.01} step="0.01"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                placeholder="0"
                className="pl-14"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary">
                {unitShort(form.unit)}
              </span>
            </div>
          </Field>

          <Field label={`سعر البيع / ${unitShort(form.unit)}`}>
            <TextInput
              type="number" min={0} step="0.01"
              value={form.unitPrice}
              onChange={(e) => set("unitPrice", e.target.value)}
              placeholder="0.00"
            />
          </Field>

          <Field label="اسم المشتري">
            <TextInput
              value={form.buyer}
              onChange={(e) => set("buyer", e.target.value)}
              placeholder="اسم الزبون"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="طريقة الدفع">
              <div className="flex gap-2">
                {(["cash", "card", "debt"] as PaymentMethod[]).map((m) => {
                  const labels = { cash: "💵 نقدي", card: "💳 بطاقة", debt: "📋 آجل" }
                  return (
                    <button
                      key={m} type="button"
                      onClick={() => set("method", m)}
                      className={cn(
                        "flex-1 h-10 rounded-xl border text-sm font-medium transition",
                        form.method === m
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {labels[m]}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>
        </div>

        {/* ── ملخص ── */}
        <div className="rounded-xl border border-border bg-muted/40 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {qty > 0 && price > 0
                ? <span>{qty} {unitShort(form.unit)} × {fmt(price)} = </span>
                : <span>الإجمالي</span>}
            </div>
            <span className="text-2xl font-black tabular-nums text-foreground">
              {fmt(total)}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ── الصفحة الرئيسية للمبيعات ─────────────────────────────────────── */
export function SalesTab({ search }: { search: string }) {
  const { sales, fmt, userName, today } = useClientStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [printSale, setPrintSale] = useState<typeof sales[0] | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sales
    return sales.filter((s) =>
      s.itemName.toLowerCase().includes(q) ||
      s.buyer.toLowerCase().includes(q) ||
      s.sku.toLowerCase().includes(q)
    )
  }, [sales, search])

  const totals = useMemo(() => {
    const td = sales.filter((s) => s.date === today)
    const sum = (arr: typeof sales) => arr.reduce((a, s) => a + s.quantity * s.unitPrice, 0)
    return {
      cash: sum(td.filter((s) => s.method === "cash")),
      card: sum(td.filter((s) => s.method === "card")),
      credit: sum(td.filter((s) => s.method === "debt")),
    }
  }, [sales, today])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="نقدي اليوم"  value={fmt(totals.cash)}   icon={Banknote}    tone="success" />
        <StatCard label="بطاقة اليوم" value={fmt(totals.card)}   icon={CreditCard}  tone="info"    />
        <StatCard label="آجل اليوم"   value={fmt(totals.credit)} icon={HandCoins}   tone="danger"  />
      </div>

      <SectionCard
        title="المبيعات ونقاط البيع (POS)"
        description="فاتورة لأي بضاعة بأي وحدة قياس"
        action={
          <Btn onClick={() => setModalOpen(true)}>
            <ShoppingCart className="size-4" />فاتورة جديدة
          </Btn>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState message="لا توجد مبيعات تطابق البحث" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 text-right">الصنف</th>
                  <th className="px-5 py-3 text-right">الكمية</th>
                  <th className="px-5 py-3 text-right">سعر البيع</th>
                  <th className="px-5 py-3 text-right">الإجمالي</th>
                  <th className="px-5 py-3 text-right">المشتري</th>
                  <th className="px-5 py-3 text-right">الدفع</th>
                  <th className="px-5 py-3 text-right">الكاشير</th>
                  <th className="px-5 py-3 text-right">التاريخ</th>
                  <th className="px-5 py-3 text-right">طباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/40 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{s.itemName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{s.sku}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="tabular-nums text-foreground font-semibold">{s.quantity}</span>
                      <span className="text-xs text-muted-foreground mr-1">{unitShort(s.unit)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground tabular-nums">
                      {fmt(s.unitPrice)}<span className="text-xs">/{unitShort(s.unit)}</span>
                    </td>
                    <td className="px-5 py-3.5 font-bold tabular-nums text-foreground">{fmt(s.quantity * s.unitPrice)}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{s.buyer}</td>
                    <td className="px-5 py-3.5"><MethodBadge method={s.method} /></td>
                    <td className="px-5 py-3.5 text-muted-foreground">{userName(s.userId)}</td>
                    <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{s.date}</td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setPrintSale(s)}
                        className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition"
                      >
                        <Printer className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <NewSaleModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <InvoicePrintModal sale={printSale} onClose={() => setPrintSale(null)} />
    </div>
  )
}
