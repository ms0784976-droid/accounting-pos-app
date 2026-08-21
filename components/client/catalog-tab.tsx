"use client"

import { useMemo, useState } from "react"
import { Pencil, Trash2, PackagePlus, Tag } from "lucide-react"
import { useClientStore } from "@/lib/store"
import { unitLabel, unitShort } from "@/lib/units"
import type { Product, UnitCode, ProductType } from "@/lib/types"
import { PRODUCT_TYPE_META } from "@/lib/constants"
import { SectionCard, EmptyState, Btn, Modal, Field, TextInput, SelectInput } from "./ui"
import { UnitSelect } from "./unit-select"
import { cn } from "@/lib/utils"

/* ── نموذج إضافة/تعديل صنف ────────────────────────────────────────── */
const emptyForm = {
  name: "", sku: "", unit: "pcs" as UnitCode, type: "product" as ProductType,
  category: "", lastCost: "", lastPrice: "", notes: "",
}

function ProductModal({ open, onClose, editProduct }: {
  open: boolean; onClose: () => void; editProduct?: Product
}) {
  const { addProduct, updateProduct, tenantId } = useClientStore()
  const [form, setForm] = useState(editProduct ? {
    name: editProduct.name, sku: editProduct.sku, unit: editProduct.unit,
    type: editProduct.type, category: editProduct.category, lastCost: String(editProduct.lastCost),
    lastPrice: String(editProduct.lastPrice), notes: editProduct.notes,
  } : { ...emptyForm })

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const canSubmit = form.name.trim() && form.sku.trim()

  function handleSave() {
    if (!canSubmit) return
    const data = {
      tenantId,
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      unit: form.unit,
      type: form.type,
      category: form.category.trim(),
      lastCost: Number(form.lastCost) || 0,
      lastPrice: Number(form.lastPrice) || 0,
      notes: form.notes.trim(),
    }
    if (editProduct) updateProduct(editProduct.id, data)
    else addProduct(data)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editProduct ? "تعديل بيانات الصنف" : "إضافة صنف جديد"}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
          <Btn disabled={!canSubmit} onClick={handleSave}>
            {editProduct ? "حفظ التعديلات" : "إضافة الصنف"}
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="اسم الصنف / البضاعة">
          <TextInput
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="مثال: بروفيل ألمنيوم 6 متر"
          />
        </Field>

        <Field label="كود الصنف (SKU)">
          <TextInput
            value={form.sku}
            onChange={(e) => set("sku", e.target.value.toUpperCase())}
            placeholder="ALU-PRF-6M"
            className="font-mono uppercase"
          />
        </Field>

        <Field label="وحدة القياس">
          <UnitSelect
            value={form.unit}
            onChange={(v) => setForm((f) => ({ ...f, unit: v }))}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="نوع الصنف">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PRODUCT_TYPE_META) as ProductType[]).map((t) => {
                const meta = PRODUCT_TYPE_META[t]
                return (
                  <button
                    key={t} type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={cn(
                      "rounded-xl border p-3 text-right transition",
                      form.type === t
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{meta.hint}</p>
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        <Field label="التصنيف / المجموعة">
          <TextInput
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="مثال: ألمنيوم، بقالة، أدوات..."
          />
        </Field>

        <Field label="سعر التكلفة (للوحدة)">
          <div className="relative">
            <TextInput
              type="number" min={0} step="0.01"
              value={form.lastCost}
              onChange={(e) => set("lastCost", e.target.value)}
              placeholder="0.00"
              className="pl-16"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
              لكل {unitShort(form.unit)}
            </span>
          </div>
        </Field>

        <Field label="سعر البيع (للوحدة)">
          <div className="relative">
            <TextInput
              type="number" min={0} step="0.01"
              value={form.lastPrice}
              onChange={(e) => set("lastPrice", e.target.value)}
              placeholder="0.00"
              className="pl-16"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
              لكل {unitShort(form.unit)}
            </span>
          </div>
        </Field>

        <div className="sm:col-span-2">
          <Field label="ملاحظات (اختياري)">
            <TextInput
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="مثال: صندوق 24 علبة، وزن الكيس 50 كجم..."
            />
          </Field>
        </div>
      </div>

      {/* Preview */}
      {form.name && (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">معاينة: {form.name}</p>
          <p>الوحدة: <strong>{unitLabel(form.unit)}</strong> ({unitShort(form.unit)}) · سعر البيع: <strong>{form.lastPrice || "—"}</strong> / {unitShort(form.unit)}</p>
        </div>
      )}
    </Modal>
  )
}

/* ── الصفحة الرئيسية للكتالوج ──────────────────────────────────────── */
export function CatalogTab({ search }: { search: string }) {
  const { products, deleteProduct, fmt } = useClientStore()
  const [open, setOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | undefined>()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  }, [products, search])

  // تجميع حسب التصنيف
  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const p of filtered) {
      const cat = p.category || "غير مصنّف"
      const arr = map.get(cat) ?? []
      arr.push(p)
      map.set(cat, arr)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "ar"))
  }, [filtered])

  return (
    <>
      <SectionCard
        title="كتالوج الأصناف والبضائع"
        description={`${products.length} صنف مسجّل — يمكن تسجيل أي بضاعة بوحدة قياسها المناسبة`}
        action={
          <Btn onClick={() => { setEditProduct(undefined); setOpen(true) }}>
            <PackagePlus className="size-4" />صنف جديد
          </Btn>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState message="لا توجد أصناف — أضف صنفاً جديداً للبدء" />
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                {/* Category header */}
                <div className="flex items-center gap-2 bg-muted/40 px-5 py-2">
                  <Tag className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</span>
                  <span className="text-xs text-muted-foreground/60">({items.length})</span>
                </div>

                {/* Items */}
                {items.map((prod) => (
                  <div key={prod.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition">
                    {/* Icon */}
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                      {unitShort(prod.unit)}
                    </div>

                    {/* Name + SKU */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">{prod.name}</p>
                        <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground">{prod.sku}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", PRODUCT_TYPE_META[prod.type]?.color)}>
                          {PRODUCT_TYPE_META[prod.type]?.label ?? prod.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        الوحدة: <strong className="text-foreground">{unitLabel(prod.unit)}</strong>
                        {prod.notes && <span> · {prod.notes}</span>}
                      </p>
                    </div>

                    {/* Prices */}
                    <div className="hidden sm:flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">سعر التكلفة</p>
                        <p className="font-semibold text-warning tabular-nums">{fmt(prod.lastCost)}</p>
                        <p className="text-[10px] text-muted-foreground">/ {unitShort(prod.unit)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">سعر البيع</p>
                        <p className="font-semibold text-success tabular-nums">{fmt(prod.lastPrice)}</p>
                        <p className="text-[10px] text-muted-foreground">/ {unitShort(prod.unit)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">هامش الربح</p>
                        <p className={cn("font-bold tabular-nums", prod.lastPrice > prod.lastCost ? "text-success" : "text-danger")}>
                          {prod.lastCost > 0
                            ? `${(((prod.lastPrice - prod.lastCost) / prod.lastCost) * 100).toFixed(1)}%`
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditProduct(prod); setOpen(true) }}
                        className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition"
                        title="تعديل"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => deleteProduct(prod.id)}
                        className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 transition"
                        title="حذف"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <ProductModal
        open={open}
        onClose={() => { setOpen(false); setEditProduct(undefined) }}
        editProduct={editProduct}
      />
    </>
  )
}
