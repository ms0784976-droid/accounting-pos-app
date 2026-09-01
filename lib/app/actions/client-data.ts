"use server"

// ================================================================
// الطبقة القديمة (Legacy) — الأصناف/المشتريات/المبيعات/الزبائن/المستخدمون
// ================================================================
// ⚠️ إصلاح أمني جذري:
//   كانت كل دالة هنا تستقبل tenantId من المتصفح وتثق فيه بلا أي تحقق.
//   Server Actions في Next.js نقاط نهاية عامة — أي شخص يستطيع استدعاءها
//   مباشرة، فكان بإمكانه قراءة وتعديل بيانات أي شركة أخرى، بل وإنشاء
//   وحذف حسابات دخول بمفتاح Service Role.
//
//   الآن: كل دالة تمرّ من requireTenant()/requirePermission() أولاً،
//   وtenantId يُؤخذ من الجلسة على السيرفر لا من المُدخل. الوسيط
//   tenantId بقي اختيارياً للتوافق مع الاستدعاءات القائمة، ويُرفض
//   صراحةً إن خالف شركة المستخدم.
//
//   كذلك أُصلح خطأ وقت التشغيل: supabase.rpc(...).catch(...) —
//   الـ query builder ليس Promise حقيقياً ولا يملك .catch، فكان
//   الاستدعاء ينهار بـ "catch is not a function".

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server"
import { requireTenant, requirePermission } from "@/lib/auth/guard"
import type {
  Product, Purchase, Sale, Customer, TenantUser,
  UnitCode, LegacyPaymentMethod, ClientRole, UserStatus, ProductType,
} from "@/lib/types"

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ── محوّلات الصفوف ────────────────────────────────────────────── */

function rowToProduct(r: any): Product {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    sku: r.sku ?? "",
    barcode: r.barcode ?? "",
    unit: (r.unit as UnitCode) ?? "pcs",
    type: (r.type as ProductType) ?? "product",
    category: r.category ?? "",
    categoryId: r.category_id ?? null,
    lastCost: Number(r.last_cost ?? 0),
    lastPrice: Number(r.last_price ?? 0),
    stockQty: Number(r.stock_qty ?? 0),
    avgCost: Number(r.avg_cost ?? 0),
    minQty: Number(r.min_qty ?? 0),
    taxPercent:
      r.tax_percent === null || r.tax_percent === undefined ? null : Number(r.tax_percent),
    isActive: r.is_active ?? true,
    allowNegativeStock: r.allow_negative_stock ?? false,
    notes: r.notes ?? "",
    createdAt: r.created_at?.split("T")[0] ?? "",
  }
}

function rowToPurchase(r: any): Purchase {
  return {
    id: r.id, tenantId: r.tenant_id, itemName: r.item_name, sku: r.sku ?? "",
    unit: (r.unit as UnitCode) ?? "pcs", supplier: r.supplier ?? "",
    quantity: Number(r.quantity ?? 0), unitCost: Number(r.unit_cost ?? 0),
    warehouse: r.warehouse ?? "", batch: r.batch ?? "", date: r.date,
    userId: r.user_id ?? "",
  }
}

/** الطبقة القديمة تعرف ثلاث طرق دفع فقط: نقد/بطاقة/آجل */
function toLegacyMethod(v: unknown): LegacyPaymentMethod {
  return v === "card" ? "card" : v === "debt" || v === "credit" ? "debt" : "cash"
}

function rowToSale(r: any): Sale {
  return {
    id: r.id, tenantId: r.tenant_id, itemName: r.item_name, sku: r.sku ?? "",
    unit: (r.unit as UnitCode) ?? "pcs", quantity: Number(r.quantity ?? 0),
    unitPrice: Number(r.unit_price ?? 0), buyer: r.buyer ?? "",
    method: toLegacyMethod(r.method), date: r.date, userId: r.user_id ?? "",
  }
}

function rowToCustomer(r: any): Customer {
  return {
    id: r.id, tenantId: r.tenant_id, name: r.name, phone: r.phone ?? "",
    accountId: r.account_id ?? "", itemsDetail: r.items_detail ?? "",
    totalCharged: Number(r.total_charged ?? 0), amountPaid: Number(r.amount_paid ?? 0),
    dueDate: r.due_date, updatedAt: r.updated_at?.split("T")[0] ?? "",
  }
}

function rowToTenantUser(r: any): TenantUser {
  return {
    id: r.id, tenantId: r.tenant_id,
    name: r.name, username: r.username, email: r.email ?? "",
    role: r.role as ClientRole, status: r.status as UserStatus,
    createdAt: r.created_at?.split("T")[0] ?? "",
    lastActive: r.last_active ?? "",
  }
}

/* ================================================================ */
/* المنتجات                                                          */
/* ================================================================ */

export async function fetchProductsAction(tenantId?: string): Promise<Product[]> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("products").select("*").eq("tenant_id", s.tenantId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToProduct)
}

export async function addProductAction(
  product: Omit<Product, "id" | "createdAt">
): Promise<Product> {
  const s = await requirePermission("manageProducts", product.tenantId || undefined)
  if (!product.name?.trim()) throw new Error("اسم الصنف مطلوب")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("products")
    .insert({
      tenant_id: s.tenantId, name: product.name.trim(), sku: product.sku ?? "",
      unit: product.unit, type: product.type, category: product.category ?? "",
      last_cost: product.lastCost ?? 0, last_price: product.lastPrice ?? 0,
      notes: product.notes ?? "",
    })
    .select("*").single()
  if (error) {
    if (error.code === "23505") throw new Error("كود الصنف (SKU) مستخدم مسبقاً")
    throw new Error(error.message)
  }
  return rowToProduct(data)
}

export async function updateProductAction(
  id: string,
  patch: Partial<Omit<Product, "id" | "tenantId" | "createdAt">>
): Promise<void> {
  const s = await requirePermission("manageProducts")
  const supabase = await createServerSupabase()

  const db: Record<string, unknown> = {}
  if (patch.name !== undefined)      db.name       = patch.name
  if (patch.sku !== undefined)       db.sku        = patch.sku
  if (patch.unit !== undefined)      db.unit       = patch.unit
  if (patch.type !== undefined)      db.type       = patch.type
  if (patch.category !== undefined)  db.category   = patch.category
  if (patch.lastCost !== undefined)  db.last_cost  = patch.lastCost
  if (patch.lastPrice !== undefined) db.last_price = patch.lastPrice
  if (patch.notes !== undefined)     db.notes      = patch.notes
  if (Object.keys(db).length === 0) return

  const { error } = await supabase
    .from("products").update(db).eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

export async function deleteProductAction(id: string): Promise<void> {
  const s = await requirePermission("manageProducts")
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("products").delete().eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* المشتريات                                                         */
/* ================================================================ */

export async function fetchPurchasesAction(tenantId?: string): Promise<Purchase[]> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("purchases").select("*").eq("tenant_id", s.tenantId)
    .order("date", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToPurchase)
}

export async function addPurchaseAction(
  purchase: Omit<Purchase, "id"> & { tenantId: string }
): Promise<Purchase> {
  const s = await requirePermission("createPurchase", purchase.tenantId || undefined)
  if (!(purchase.quantity > 0)) throw new Error("الكمية يجب أن تكون أكبر من صفر")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("purchases")
    .insert({
      tenant_id: s.tenantId, item_name: purchase.itemName,
      sku: purchase.sku, unit: purchase.unit, supplier: purchase.supplier,
      quantity: purchase.quantity, unit_cost: purchase.unitCost,
      warehouse: purchase.warehouse, batch: purchase.batch,
      date: purchase.date, user_id: purchase.userId || null,
    })
    .select("*").single()
  if (error) throw new Error(error.message)

  if (purchase.sku) {
    await supabase
      .from("products").update({ last_cost: purchase.unitCost })
      .eq("tenant_id", s.tenantId).eq("sku", purchase.sku)
  }
  return rowToPurchase(data)
}

/* ================================================================ */
/* المبيعات                                                          */
/* ================================================================ */

export async function fetchSalesAction(tenantId?: string): Promise<Sale[]> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("sales").select("*").eq("tenant_id", s.tenantId)
    .order("date", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToSale)
}

export async function addSaleAction(
  sale: Omit<Sale, "id"> & { tenantId: string }
): Promise<Sale> {
  const s = await requirePermission("createSale", sale.tenantId || undefined)
  if (!(sale.quantity > 0)) throw new Error("الكمية يجب أن تكون أكبر من صفر")

  const supabase = await createServerSupabase()
  const today = new Date().toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("sales")
    .insert({
      tenant_id: s.tenantId, item_name: sale.itemName,
      sku: sale.sku, unit: sale.unit, quantity: sale.quantity,
      unit_price: sale.unitPrice, buyer: sale.buyer,
      method: sale.method, date: sale.date || today,
      user_id: sale.userId || null,
    })
    .select("*").single()
  if (error) throw new Error(error.message)

  if (sale.sku) {
    await supabase
      .from("products").update({ last_price: sale.unitPrice })
      .eq("tenant_id", s.tenantId).eq("sku", sale.sku)
  }

  if (sale.method === "debt") {
    const total = sale.quantity * sale.unitPrice
    const detail = `${sale.quantity} ${sale.unit} ${sale.itemName}`
    // ملاحظة: هذا query builder وليس Promise — لا يملك .catch()
    const { error: debtError } = await supabase.rpc("upsert_customer_debt", {
      p_tenant: s.tenantId, p_name: sale.buyer,
      p_amount: total, p_detail: detail, p_date: sale.date || today,
    })
    if (debtError) {
      console.error("upsert_customer_debt failed:", debtError.message)
    }
  }

  return rowToSale(data)
}

/* ================================================================ */
/* الزبائن                                                           */
/* ================================================================ */

export async function fetchCustomersAction(tenantId?: string): Promise<Customer[]> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("customers").select("*").eq("tenant_id", s.tenantId)
    .order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToCustomer)
}

export async function addCustomerAction(
  customer: Omit<Customer, "id" | "updatedAt"> & { tenantId: string }
): Promise<Customer> {
  const s = await requireTenant(customer.tenantId || undefined)
  if (!customer.name?.trim()) throw new Error("اسم الزبون مطلوب")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("customers")
    .insert({
      tenant_id: s.tenantId, name: customer.name.trim(),
      phone: customer.phone, account_id: customer.accountId,
      items_detail: customer.itemsDetail,
      total_charged: customer.totalCharged,
      amount_paid: customer.amountPaid, due_date: customer.dueDate,
    })
    .select("*").single()
  if (error) throw new Error(error.message)
  return rowToCustomer(data)
}

export async function recordPaymentAction(
  customerId: string,
  amount: number
): Promise<void> {
  const s = await requirePermission("managePayments")
  if (!(amount > 0)) throw new Error("المبلغ يجب أن يكون أكبر من صفر")

  const supabase = await createServerSupabase()

  // تأكيد أن الزبون يخصّ شركة المستخدم قبل أي تعديل
  const { data: customer } = await supabase
    .from("customers").select("id, amount_paid, total_charged")
    .eq("id", customerId).eq("tenant_id", s.tenantId).maybeSingle()
  if (!customer) throw new Error("الزبون غير موجود")

  const { error } = await supabase.rpc("record_customer_payment", {
    p_customer: customerId,
    p_tenant: s.tenantId,
    p_amount: amount,
  })

  // مسار احتياطي لو الدالة غير متاحة لهذا المستخدم
  if (error) {
    const { error: updateError } = await supabase
      .from("customers")
      .update({ amount_paid: Number(customer.amount_paid ?? 0) + amount })
      .eq("id", customerId).eq("tenant_id", s.tenantId)
    if (updateError) throw new Error(updateError.message)
  }
}

/* ================================================================ */
/* المستخدمون                                                        */
/* ================================================================ */

export async function fetchTenantUsersAction(tenantId?: string): Promise<TenantUser[]> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("tenant_users").select("*").eq("tenant_id", s.tenantId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTenantUser)
}

/**
 * إضافة مستخدم جديد.
 * الإيميل وكلمة المرور إجباريان، وإلا يبقى auth_user_id فارغاً
 * ولا يستطيع المستخدم تسجيل الدخول أبداً.
 * إذا فشل حفظ tenant_users نحذف حساب الـ Auth فوراً (rollback).
 */
export async function addTenantUserAction(
  input: Omit<TenantUser, "id" | "createdAt" | "lastActive" | "status"> & {
    tempPassword?: string
  }
): Promise<TenantUser> {
  const s = await requirePermission("manageUsers", input.tenantId || undefined)

  const email = input.email?.trim().toLowerCase()
  const password = input.tempPassword?.trim()

  if (!email || !email.includes("@")) {
    throw new Error("البريد الإلكتروني مطلوب ولازم يكون صحيحاً")
  }
  if (!password || password.length < 8) {
    throw new Error("كلمة المرور مطلوبة (8 أحرف على الأقل)")
  }
  if (!input.name?.trim())     throw new Error("اسم المستخدم مطلوب")
  if (!input.username?.trim()) throw new Error("اسم الدخول (username) مطلوب")

  const adminClient = createServiceClient()

  // 1) حساب Auth
  const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: input.name,
      username: input.username,
      system_role: "client",
    },
  })

  if (userError || !newUser?.user) {
    const msg = userError?.message ?? "تعذّر إنشاء حساب الدخول"
    if (msg.toLowerCase().includes("already registered") || msg.includes("already been registered")) {
      throw new Error(`الإيميل ${email} مسجّل مسبقاً في النظام`)
    }
    throw new Error(`خطأ في إنشاء حساب الدخول: ${msg}`)
  }

  const authUserId = newUser.user.id

  // 2) profile — تعتمد عليه دوال الصلاحية
  await adminClient.from("profiles").upsert({
    id: authUserId,
    username: input.username,
    full_name: input.name,
    system_role: "client",
  })

  // 3) عضوية الشركة
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("tenant_users")
    .insert({
      tenant_id: s.tenantId,
      name: input.name,
      username: input.username,
      email,
      role: input.role,
      status: "active",
      auth_user_id: authUserId,
    })
    .select("*")
    .single()

  if (error) {
    await adminClient.auth.admin.deleteUser(authUserId)
    throw new Error(`خطأ في حفظ بيانات المستخدم: ${error.message}`)
  }

  return rowToTenantUser(data)
}

export async function updateTenantUserAction(
  id: string,
  patch: Partial<Pick<TenantUser, "name" | "username" | "email" | "role" | "status">>
): Promise<void> {
  const s = await requirePermission("manageUsers")
  const supabase = await createServerSupabase()

  const db: Record<string, unknown> = {}
  if (patch.name !== undefined)     db.name     = patch.name
  if (patch.username !== undefined) db.username = patch.username
  if (patch.email !== undefined)    db.email    = patch.email.trim().toLowerCase()
  if (patch.role !== undefined)     db.role     = patch.role
  if (patch.status !== undefined)   db.status   = patch.status
  if (Object.keys(db).length === 0) return

  const { error } = await supabase
    .from("tenant_users").update(db).eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

export async function toggleTenantUserStatusAction(
  id: string,
  currentStatus: UserStatus
): Promise<UserStatus> {
  const s = await requirePermission("manageUsers")
  const supabase = await createServerSupabase()

  const newStatus: UserStatus = currentStatus === "active" ? "frozen" : "active"
  const { error } = await supabase
    .from("tenant_users").update({ status: newStatus })
    .eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
  return newStatus
}

export async function deleteTenantUserAction(id: string): Promise<void> {
  const s = await requirePermission("manageUsers")
  const supabase = await createServerSupabase()

  const { data: user } = await supabase
    .from("tenant_users").select("auth_user_id")
    .eq("id", id).eq("tenant_id", s.tenantId).maybeSingle()
  if (!user) throw new Error("المستخدم غير موجود")

  // لا يحذف المستخدم نفسه ويقفل الشركة على نفسه
  if (user.auth_user_id === s.userId) {
    throw new Error("لا يمكنك حذف حسابك أنت")
  }

  const { error } = await supabase
    .from("tenant_users").delete().eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)

  if (user.auth_user_id) {
    const adminClient = createServiceClient()
    const { error: authError } = await adminClient.auth.admin.deleteUser(user.auth_user_id)
    if (authError) console.error("deleteUser failed:", authError.message)
  }
}

/* ================================================================ */
/* عملة الشركة                                                       */
/* ================================================================ */

export async function fetchTenantCurrencyAction(tenantId?: string): Promise<string> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("tenants").select("currency").eq("id", s.tenantId).maybeSingle()
  return data?.currency ?? "ILS"
}

export async function updateTenantCurrencyAction(
  tenantId: string | undefined,
  currency: string
): Promise<void> {
  const s = await requirePermission("manageSettings", tenantId || undefined)
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("tenants").update({ currency }).eq("id", s.tenantId)
  if (error) throw new Error(error.message)
}
