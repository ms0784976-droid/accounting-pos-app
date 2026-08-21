"use client"

import { useMemo, useState } from "react"
import { Boxes, PackageCheck, PackageX, PlusCircle, AlertTriangle, Search } from "lucide-react"
import { useClientStore } from "@/lib/store"
import { unitShort } from "@/lib/units"
import { PRODUCT_TYPE_META } from "@/lib/constants"
import type { Product } from "@/lib/types"
import { SectionCard, EmptyState, StatCard, Btn, Modal, Field, TextInput } from "./ui"
import { cn } from "@/lib/utils"

/* ── نموذج تسجيل رصيد أولي / تسوية مخزون ─────────────────────────── */
function OpeningBalanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { products, addPurchase, currentTenantUser, today } = useClientStore()
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [cost, setCost] = useState("")
  const [search, setSearch] = useState("")
  const [showList, setShowList] = useState(false)

  const trackable = useMemo(
    () => products.filter((p) => PRODUCT_TYPE_META[p.type]?.tracksStock !== false),
    [products]
  )
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return trackable
    return trackable.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
  }, [trackable, search])

  const selected = trackable.find((p) => p.id === productId) || null
  const canSubmit = !!selected && Number(quantity) > 0

  function reset() {
    setProductId(""); setQuantity(""); setCost(""); setSearch(""); setShowList(false)
  }

  function handleSave() {
    if (!selected || !canSubmit) return
    addPurchase({
      itemName: selected.name,
      sku: selected.sku,
      unit: selected.unit,
      supplier: "رصيد افتتاحي",
      quantity: Number(quantity),
      unitCost: Number(cost) || selected.lastCost || 0,
      warehouse: "",
      batch: "رصيد أولي",
      date: today,
      userId: currentTenantUser?.id ?? "",
    })
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="تسجيل رصيد مخزون (بضاعة موجودة مسبقاً)"
      footer={
        <>
          <Btn variant="outline" onClick={() => { reset(); onClose() }}>إلغاء</Btn>
          <Btn disabled={!canSubmit} onClick={handleSave}>
            <PlusCircle className="size-4" />إضافة إلى المخزون
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-4 py-3 leading-relaxed">
          استخدم هذا الخيار عندما يبدأ عميل بتسجيل بضاعة موجودة عنده مسبقاً بالمحل.
          فقط سجّل <strong>الكمية الحالية</strong> — سعر الشراء اختياري، إذا لم تتذكره اتركه فارغاً.
        </p>

        <Field label="اختر الصنف">
          <button
            type="button"
            onClick={() => setShowList((v) => !v)}
            className="w-full h-10 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 transition flex items-center justify-center gap-2"
          >
            <Search className="size-4" />
            {selected ? `${selected.name} (${unitShort(selected.unit)})` : "ابحث عن صنف من الكتالوج"}
          </button>

          {showList && (
            <div className="mt-2 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
              <div className="p-2 border-b border-border">
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو الكود..."
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:border-ring"
                />
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-border">
                {filtered.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground">لا توجد أصناف تُتابع بالمخزون — أضف صنفاً من "كتالوج الأصناف" أولاً</p>
                ) : filtered.map((p) => (
                  <button
                    key={p.id} type="button"
                    onClick={() => { setProductId(p.id); setShowList(false); setSearch("") }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-right hover:bg-muted transition"
                  >
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={`الكمية الحالية ${selected ? `(${unitShort(selected.unit)})` : ""}`}>
            <TextInput
              type="number" min={0.01} step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="سعر الشراء (اختياري)">
            <TextInput
              type="number" min={0} step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="اتركه فارغاً إذا لم تتذكر"
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

/* ── الصفحة الرئيسية للمخزون ──────────────────────────────────────── */
export function InventoryTab({ search }: { search: string }) {
  const { stock, products, fmt } = useClientStore()
  const [modalOpen, setModalOpen] = useState(false)

  // ربط عناصر المخزون بنوع الصنف من الكتالوج (لإخفاء الخدمات/الحرف التي لا تُتابع كمخزون)
  const productBySku = useMemo(() => {
    const map = new Map<string, Product>()
    for (const p of products) map.set(p.sku, p)
    return map
  }, [products])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stock
      .filter((s) => {
        const prod = productBySku.get(s.sku)
        // اعرض فقط الأصناف القابلة للتتبع (منتج/بضاعة)؛ الأصناف غير الموجودة بالكتالوج تُعرض أيضاً احتياطاً
        return !prod || PRODUCT_TYPE_META[prod.type]?.tracksStock !== false
      })
      .filter((s) => !q || s.itemName.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q))
      .sort((a, b) => a.balance - b.balance)
  }, [stock, productBySku, search])

  const stats = useMemo(() => {
    const low = rows.filter((r) => r.balance <= 0).length
    const totalValue = rows.reduce((acc, r) => acc + Math.max(0, r.balance) * (r.lastCost || 0), 0)
    return { items: rows.length, low, totalValue }
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="أصناف بالمخزون"     value={String(stats.items)}   icon={Boxes}      tone="primary" />
        <StatCard label="نافدة أو سالبة"     value={String(stats.low)}     icon={PackageX}   tone="danger"  />
        <StatCard label="قيمة المخزون التقديرية" value={fmt(stats.totalValue)} icon={PackageCheck} tone="success" />
      </div>

      <SectionCard
        title="أرصدة المخزون"
        description="يُحدَّث تلقائياً مع كل عملية بيع أو شراء — يمكنك أيضاً تسجيل بضاعة موجودة مسبقاً"
        action={
          <Btn onClick={() => setModalOpen(true)}>
            <PlusCircle className="size-4" />تسجيل بضاعة موجودة
          </Btn>
        }
      >
        {rows.length === 0 ? (
          <EmptyState message="لا توجد حركات مخزون بعد — سجّل مشتريات أو بضاعة موجودة لديك للبدء" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 text-right">الصنف</th>
                  <th className="px-5 py-3 text-right">الوارد</th>
                  <th className="px-5 py-3 text-right">الصادر</th>
                  <th className="px-5 py-3 text-right">الرصيد الحالي</th>
                  <th className="px-5 py-3 text-right">آخر تكلفة</th>
                  <th className="px-5 py-3 text-right">آخر سعر بيع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const isLow = r.balance <= 0
                  return (
                    <tr key={r.sku} className={cn("hover:bg-muted/40 transition", isLow && "bg-danger/5")}>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-foreground">{r.itemName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{r.sku}</p>
                      </td>
                      <td className="px-5 py-3.5 text-success tabular-nums">
                        {r.incoming} <span className="text-xs text-muted-foreground">{unitShort(r.unit)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground tabular-nums">
                        {r.outgoing} <span className="text-xs">{unitShort(r.unit)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
                          isLow ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
                        )}>
                          {isLow && <AlertTriangle className="size-3" />}
                          {r.balance} {unitShort(r.unit)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{fmt(r.lastCost)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{fmt(r.lastPrice)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <OpeningBalanceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
