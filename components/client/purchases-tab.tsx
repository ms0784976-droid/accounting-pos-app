"use client"

import { useMemo, useState } from "react"
import { PackagePlus, Search } from "lucide-react"
import { useClientStore } from "@/lib/store"
import { CAN_EDIT_COSTS } from "@/lib/constants"
import { unitShort, unitLabel } from "@/lib/units"
import type { UnitCode } from "@/lib/types"
import { SectionCard, EmptyState, Btn, Modal, Field, TextInput, SelectInput } from "./ui"
import { UnitSelect } from "./unit-select"
import { cn } from "@/lib/utils"

const emptyForm = {
  itemName: "", sku: "", unit: "pcs" as UnitCode,
  supplier: "", quantity: "", unitCost: "",
  warehouse: "المستودع الرئيسي - A1", batch: "",
}

function NewPurchaseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addPurchase, currentTenantUser, today, products, fmt } = useClientStore()
  const [form, setForm] = useState({ ...emptyForm })
  const [showCatalog, setShowCatalog] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState("")

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const qty = Number(form.quantity) || 0
  const cost = Number(form.unitCost) || 0
  const canSubmit = form.itemName.trim() && form.supplier.trim() && qty > 0 && cost > 0

  function pickProduct(p: typeof products[0]) {
    setForm((f) => ({
      ...f,
      itemName: p.name, sku: p.sku, unit: p.unit,
      unitCost: p.lastCost > 0 ? String(p.lastCost) : f.unitCost,
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
    addPurchase({
      itemName: form.itemName.trim(),
      sku: form.sku.trim() || form.itemName.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 12),
      unit: form.unit,
      supplier: form.supplier.trim(), quantity: qty, unitCost: cost,
      warehouse: form.warehouse,
      batch: form.batch.trim() || `B-${Math.floor(1000 + Math.random() * 9000)}`,
      date: today, userId: currentTenantUser.id,
    })
    setForm({ ...emptyForm })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تسجيل مشتريات جديدة"
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
          <Btn disabled={!canSubmit} onClick={handleSubmit}>
            <PackagePlus className="size-4" />حفظ المشتريات
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        {/* Catalog picker */}
        <div>
          <button
            type="button"
            onClick={() => setShowCatalog((v) => !v)}
            className="w-full h-10 rounded-xl border border-dashed border-warning/50 bg-warning/5 text-sm font-medium text-warning hover:bg-warning/10 transition flex items-center justify-center gap-2"
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
                    key={p.id} type="button"
                    onClick={() => pickProduct(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-right hover:bg-muted transition"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.sku} · {unitLabel(p.unit)}</p>
                    </div>
                    <span className="text-xs text-warning font-semibold">
                      {p.lastCost > 0 ? `${p.lastCost} / ${unitShort(p.unit)}` : "—"}
                    </span>
                  </button>
                ))}
                {filteredProds.length === 0 && (
                  <div className="px-4 py-3 text-sm text-muted-foreground text-center">لا يوجد تطابق</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Manual fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="اسم الصنف">
            <TextInput value={form.itemName} onChange={(e) => set("itemName", e.target.value)} placeholder="اسم البضاعة" />
          </Field>
          <Field label="كود الصنف (SKU)">
            <TextInput value={form.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} placeholder="يُحدد تلقائياً" className="font-mono" />
          </Field>

          <Field label="وحدة القياس">
            <UnitSelect value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} />
          </Field>

          <Field label="اسم المورد">
            <TextInput value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="اسم شركة المورد" />
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
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-warning">
                {unitShort(form.unit)}
              </span>
            </div>
          </Field>

          <Field label={`سعر التكلفة / ${unitShort(form.unit)}`}>
            <TextInput
              type="number" min={0} step="0.01"
              value={form.unitCost}
              onChange={(e) => set("unitCost", e.target.value)}
              placeholder="0.00"
            />
          </Field>

          <Field label="المستودع">
            <SelectInput value={form.warehouse} onChange={(e) => set("warehouse", e.target.value)}>
              <option>المستودع الرئيسي - A1</option>
              <option>المستودع الرئيسي - A2</option>
              <option>المستودع الرئيسي - B2</option>
              <option>المستودع الفرعي - C1</option>
            </SelectInput>
          </Field>

          <Field label="رقم الدفعة">
            <TextInput value={form.batch} onChange={(e) => set("batch", e.target.value)} placeholder="يُحدد تلقائياً" />
          </Field>
        </div>

        {/* Total */}
        <div className="rounded-xl border border-border bg-muted/40 px-5 py-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {qty > 0 && cost > 0
              ? <span>{qty} {unitShort(form.unit)} × {cost} = </span>
              : <span>إجمالي التكلفة</span>}
          </div>
          <span className="text-2xl font-black tabular-nums text-warning">{(qty * cost).toLocaleString("en-US")}</span>
        </div>
      </div>
    </Modal>
  )
}

export function PurchasesTab({ search }: { search: string }) {
  const { purchases, fmt, userName, currentTenantUser } = useClientStore()
  const [open, setOpen] = useState(false)
  const canSeeCost = CAN_EDIT_COSTS.includes(currentTenantUser.role)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return purchases
    return purchases.filter((p) =>
      p.itemName.toLowerCase().includes(q) ||
      p.supplier.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    )
  }, [purchases, search])

  return (
    <SectionCard
      title="المشتريات والبضاعة الداخلة"
      description="أي بضاعة بأي وحدة قياس مع تحديث الكتالوج تلقائياً"
      action={<Btn onClick={() => setOpen(true)}><PackagePlus className="size-4" />تسجيل مشتريات</Btn>}
    >
      {filtered.length === 0 ? <EmptyState message="لا توجد مشتريات تطابق البحث" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 text-right">الصنف</th>
                <th className="px-5 py-3 text-right">المورد</th>
                <th className="px-5 py-3 text-right">الكمية</th>
                {canSeeCost && <th className="px-5 py-3 text-right">سعر التكلفة</th>}
                {canSeeCost && <th className="px-5 py-3 text-right">الإجمالي</th>}
                <th className="px-5 py-3 text-right">المستودع</th>
                <th className="px-5 py-3 text-right">الدفعة / التاريخ</th>
                <th className="px-5 py-3 text-right">المستقبِل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/40 transition">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-foreground">{p.itemName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{p.supplier}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-semibold tabular-nums text-foreground">{p.quantity}</span>
                    <span className="text-xs text-muted-foreground mr-1">{unitShort(p.unit)}</span>
                  </td>
                  {canSeeCost && (
                    <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                      {fmt(p.unitCost)}<span className="text-xs">/{unitShort(p.unit)}</span>
                    </td>
                  )}
                  {canSeeCost && (
                    <td className="px-5 py-3.5 font-bold tabular-nums text-foreground">{fmt(p.quantity * p.unitCost)}</td>
                  )}
                  <td className="px-5 py-3.5 text-muted-foreground">{p.warehouse}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    <p>{p.batch}</p>
                    <p className="text-xs tabular-nums">{p.date}</p>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{userName(p.userId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NewPurchaseModal open={open} onClose={() => setOpen(false)} />
    </SectionCard>
  )
}
