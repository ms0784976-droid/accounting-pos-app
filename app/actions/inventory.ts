"use server"

// ================================================================
// المخزون — الأصناف، الحركات، الرصيد الافتتاحي، والجرد الفعلي
// ================================================================

import { createServerSupabase } from "@/lib/supabase/server"
import { requireTenant, requirePermission } from "@/lib/auth/guard"
import type {
  Product, ProductCategory, ProductType, UnitCode, StockMove,
} from "@/lib/types"

/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToProduct(r: any): Product {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    sku: r.sku ?? "",
    barcode: r.barcode ?? "",
    unit: (r.unit as UnitCode) ?? "pcs",
    type: (r.type as ProductType) ?? "product",
    category: r.product_categories?.name ?? r.category ?? "",
    categoryId: r.category_id ?? null,
    lastCost: Number(r.last_cost ?? 0),
    lastPrice: Number(r.last_price ?? 0),
    stockQty: Number(r.stock_qty ?? 0),
    avgCost: Number(r.avg_cost ?? 0),
    minQty: Number(r.min_qty ?? 0),
    taxPercent: r.tax_percent === null || r.tax_percent === undefined ? null : Number(r.tax_percent),
    isActive: r.is_active ?? true,
    allowNegativeStock: r.allow_negative_stock ?? false,
    notes: r.notes ?? "",
    createdAt: r.created_at?.split("T")[0] ?? "",
  }
}

/* ================================================================ */
/* الأصناف                                                           */
/* ================================================================ */

export async function fetchProductsFullAction(opts?: {
  search?: string
  categoryId?: string
  activeOnly?: boolean
}): Promise<Product[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  let q = supabase
    .from("products").select("*, product_categories(name)")
    .eq("tenant_id", s.tenantId).order("name")

  if (opts?.activeOnly !== false) q = q.eq("is_active", true)
  if (opts?.categoryId)           q = q.eq("category_id", opts.categoryId)
  if (opts?.search) {
    q = q.or(`name.ilike.%${opts.search}%,sku.ilike.%${opts.search}%,barcode.ilike.%${opts.search}%`)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToProduct)
}

/** بحث بالباركود — يستخدمه الماسح الضوئي في شاشة البيع */
export async function findProductByBarcodeAction(code: string): Promise<Product | null> {
  const s = await requireTenant()
  if (!code?.trim()) return null

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("products").select("*, product_categories(name)")
    .eq("tenant_id", s.tenantId).eq("is_active", true)
    .or(`barcode.eq.${code.trim()},sku.eq.${code.trim()}`)
    .limit(1).maybeSingle()

  return data ? rowToProduct(data) : null
}

export async function addProductFullAction(input: {
  name: string
  sku?: string
  barcode?: string
  unit: UnitCode
  type: ProductType
  categoryId?: string | null
  lastCost?: number
  lastPrice?: number
  minQty?: number
  taxPercent?: number | null
  notes?: string
  allowNegativeStock?: boolean
  openingQty?: number
  openingCost?: number
  openingDate?: string
}): Promise<Product> {
  const s = await requirePermission("manageProducts")
  if (!input.name?.trim()) throw new Error("اسم الصنف مطلوب")
  if ((input.lastPrice ?? 0) < 0 || (input.lastCost ?? 0) < 0) {
    throw new Error("السعر أو التكلفة غير صالحة")
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("products")
    .insert({
      tenant_id: s.tenantId,
      name: input.name.trim(),
      sku: input.sku?.trim() ?? "",
      barcode: input.barcode?.trim() ?? "",
      unit: input.unit,
      type: input.type,
      category_id: input.categoryId ?? null,
      last_cost: input.lastCost ?? 0,
      last_price: input.lastPrice ?? 0,
      min_qty: input.minQty ?? 0,
      tax_percent: input.taxPercent ?? null,
      notes: input.notes ?? "",
      // كان هذا الحقل مفقوداً: خانة "السماح بالبيع عند نفاد الرصيد"
      // كانت تُتجاهل تماماً عند إنشاء صنف جديد.
      allow_negative_stock: input.allowNegativeStock ?? false,
    })
    .select("*, product_categories(name)").single()

  if (error) {
    if (error.code === "23505") throw new Error("كود الصنف (SKU) مستخدم مسبقاً")
    throw new Error(error.message)
  }

  // الرصيد الافتتاحي: حركة مخزون + قيد محاسبي مقابل حقوق الملكية
  if (input.openingQty && input.openingQty > 0 && input.type !== "service") {
    const { error: obError } = await supabase.rpc("post_stock_opening_balance", {
      p_product: data.id,
      p_qty: input.openingQty,
      p_unit_cost: input.openingCost ?? input.lastCost ?? 0,
      p_date: input.openingDate ?? new Date().toISOString().split("T")[0],
    })
    if (obError) throw new Error(`تعذّر تسجيل الرصيد الافتتاحي: ${obError.message}`)

    const fresh = await supabase
      .from("products").select("*, product_categories(name)").eq("id", data.id).single()
    return rowToProduct(fresh.data)
  }

  return rowToProduct(data)
}

export async function updateProductFullAction(
  id: string,
  patch: Partial<{
    name: string
    sku: string
    barcode: string
    unit: UnitCode
    type: ProductType
    categoryId: string | null
    lastPrice: number
    lastCost: number
    minQty: number
    taxPercent: number | null
    notes: string
    isActive: boolean
    allowNegativeStock: boolean
  }>
): Promise<void> {
  const s = await requirePermission("manageProducts")
  const supabase = await createServerSupabase()

  const db: Record<string, unknown> = {}
  if (patch.name !== undefined)       db.name = patch.name.trim()
  if (patch.sku !== undefined)        db.sku = patch.sku.trim()
  if (patch.barcode !== undefined)    db.barcode = patch.barcode.trim()
  if (patch.unit !== undefined)       db.unit = patch.unit
  if (patch.type !== undefined)       db.type = patch.type
  if (patch.categoryId !== undefined) db.category_id = patch.categoryId
  if (patch.lastPrice !== undefined)  db.last_price = patch.lastPrice
  if (patch.minQty !== undefined)     db.min_qty = patch.minQty
  if (patch.taxPercent !== undefined) db.tax_percent = patch.taxPercent
  if (patch.notes !== undefined)      db.notes = patch.notes
  if (patch.isActive !== undefined)   db.is_active = patch.isActive
  if (patch.allowNegativeStock !== undefined) db.allow_negative_stock = patch.allowNegativeStock

  // تعديل التكلفة يدوياً يتطلب صلاحية أعلى
  if (patch.lastCost !== undefined) {
    await requirePermission("editCosts")
    db.last_cost = patch.lastCost
  }
  if (Object.keys(db).length === 0) return

  const { error } = await supabase
    .from("products").update(db).eq("id", id).eq("tenant_id", s.tenantId)
  if (error) {
    if (error.code === "23505") throw new Error("كود الصنف (SKU) مستخدم مسبقاً")
    throw new Error(error.message)
  }
}

/* ================================================================ */
/* تصنيفات الأصناف                                                   */
/* ================================================================ */

export async function fetchProductCategoriesAction(): Promise<ProductCategory[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from("product_categories").select("*").eq("tenant_id", s.tenantId).order("name")
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    id: r.id, tenantId: r.tenant_id, name: r.name,
  }))
}

export async function addProductCategoryAction(name: string): Promise<ProductCategory> {
  const s = await requirePermission("manageProducts")
  if (!name?.trim()) throw new Error("اسم التصنيف مطلوب")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("product_categories")
    .insert({ tenant_id: s.tenantId, name: name.trim() })
    .select("*").single()

  if (error) {
    if (error.code === "23505") throw new Error("التصنيف موجود مسبقاً")
    throw new Error(error.message)
  }
  return { id: data.id, tenantId: data.tenant_id, name: data.name }
}

export async function deleteProductCategoryAction(id: string): Promise<void> {
  const s = await requirePermission("manageProducts")
  const supabase = await createServerSupabase()

  await supabase.from("products").update({ category_id: null })
    .eq("category_id", id).eq("tenant_id", s.tenantId)

  const { error } = await supabase
    .from("product_categories").delete().eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* حركات المخزون                                                     */
/* ================================================================ */

export async function fetchStockMovesAction(opts?: {
  productId?: string
  from?: string
  to?: string
  limit?: number
}): Promise<StockMove[]> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  let q = supabase
    .from("stock_moves").select("*, products(name, sku, unit)")
    .eq("tenant_id", s.tenantId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 300)

  if (opts?.productId) q = q.eq("product_id", opts.productId)
  if (opts?.from)      q = q.gte("date", opts.from)
  if (opts?.to)        q = q.lte("date", opts.to)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    id: r.id,
    tenantId: r.tenant_id,
    productId: r.product_id,
    productName: r.products?.name ?? "",
    sku: r.products?.sku ?? "",
    unit: (r.products?.unit as UnitCode) ?? "pcs",
    date: r.date,
    qtyIn: Number(r.qty_in ?? 0),
    qtyOut: Number(r.qty_out ?? 0),
    unitCost: Number(r.unit_cost ?? 0),
    sourceType: r.source_type,
    sourceId: r.source_id,
    note: r.note ?? "",
    balanceAfter: Number(r.balance_after ?? 0),
    avgCostAfter: Number(r.avg_cost_after ?? 0),
  }))
}

/** رصيد افتتاحي لصنف قائم */
export async function setStockOpeningBalanceAction(
  productId: string,
  qty: number,
  unitCost: number,
  date: string
): Promise<void> {
  await requirePermission("editCosts")
  if (!(qty > 0)) throw new Error("الكمية الافتتاحية يجب أن تكون أكبر من صفر")

  const supabase = await createServerSupabase()
  const { error } = await supabase.rpc("post_stock_opening_balance", {
    p_product: productId, p_qty: qty, p_unit_cost: unitCost, p_date: date,
  })
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* الجرد الفعلي                                                      */
/* ================================================================ */

export interface StockTakeLineInput {
  productId: string
  countedQty: number
}

/**
 * يطبّق الجرد: يقارن الرصيد الدفتري بالفعلي ويسجّل حركة تسوية
 * لكل صنف فيه فرق، مع قيد محاسبي مقابل حساب "فروقات الجرد".
 */
export async function applyStockTakeAction(
  date: string,
  lines: StockTakeLineInput[],
  note = ""
): Promise<{ adjusted: number; totalValue: number }> {
  const s = await requirePermission("editCosts")
  const supabase = await createServerSupabase()

  if (!lines.length) throw new Error("لا توجد أصناف في الجرد")

  const { data: products, error } = await supabase
    .from("products").select("id, name, stock_qty, avg_cost, type")
    .eq("tenant_id", s.tenantId)
    .in("id", lines.map((l) => l.productId))
  if (error) throw new Error(error.message)

  const prodMap = new Map((products ?? []).map((p: any) => [p.id, p]))

  const { data: take, error: takeError } = await supabase
    .from("stock_takes")
    .insert({ tenant_id: s.tenantId, date, note, status: "applied", created_by: s.userId })
    .select("id").single()
  if (takeError) throw new Error(takeError.message)

  let adjusted = 0
  let totalValue = 0

  for (const line of lines) {
    const p = prodMap.get(line.productId)
    if (!p || p.type === "service") continue

    const systemQty = Number(p.stock_qty ?? 0)
    const diff = line.countedQty - systemQty
    if (Math.abs(diff) < 0.0001) continue

    const cost = Number(p.avg_cost ?? 0)

    await supabase.from("stock_take_lines").insert({
      stock_take_id: take.id,
      tenant_id: s.tenantId,
      product_id: line.productId,
      system_qty: systemQty,
      counted_qty: line.countedQty,
      unit_cost: cost,
    })

    await supabase.from("stock_moves").insert({
      tenant_id: s.tenantId,
      product_id: line.productId,
      date,
      qty_in: diff > 0 ? diff : 0,
      qty_out: diff < 0 ? -diff : 0,
      unit_cost: cost,
      source_type: "stock_take",
      source_id: take.id,
      note: `جرد فعلي: دفتري ${systemQty} / فعلي ${line.countedQty}`,
      created_by: s.userId,
    })

    adjusted++
    totalValue += diff * cost
  }

  // قيد التسوية الإجمالي — زيادة تُضاف للمخزون، نقص يُحمَّل على فروقات الجرد
  if (Math.abs(totalValue) >= 0.01) {
    const value = Math.abs(totalValue)
    const lines_ = totalValue > 0
      ? [
          { key: "inventory", debit: value, desc: "زيادة جرد" },
          { key: "inventory_adjustment", credit: value },
        ]
      : [
          { key: "inventory_adjustment", debit: value, desc: "عجز جرد" },
          { key: "inventory", credit: value },
        ]

    const { error: jError } = await supabase.rpc("post_journal", {
      p_tenant: s.tenantId,
      p_date: date,
      p_desc: `تسوية جرد فعلي بتاريخ ${date}`,
      p_source_type: "stock_take",
      p_source_id: take.id,
      p_lines: lines_,
    })
    if (jError) throw new Error(jError.message)
  }

  return { adjusted, totalValue }
}

/** ورقة الجرد — كل الأصناف مع رصيدها الدفتري للطباعة والعدّ */
export async function fetchStockTakeSheetAction(): Promise<
  { productId: string; name: string; sku: string; unit: UnitCode; systemQty: number; avgCost: number }[]
> {
  const s = await requireTenant()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from("products").select("id, name, sku, unit, stock_qty, avg_cost")
    .eq("tenant_id", s.tenantId).eq("is_active", true).neq("type", "service")
    .order("name")
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    productId: r.id,
    name: r.name,
    sku: r.sku ?? "",
    unit: (r.unit as UnitCode) ?? "pcs",
    systemQty: Number(r.stock_qty ?? 0),
    avgCost: Number(r.avg_cost ?? 0),
  }))
}
