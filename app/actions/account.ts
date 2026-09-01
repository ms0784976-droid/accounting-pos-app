"use server"

// ================================================================
// إصلاح جذري: addTenantUserAction
// المشكلة: auth_user_id كان بيبقى null لأن الإيميل أو كلمة المرور
//           ما كانوا يتمرّروا للدالة، فالمستخدم ما يقدر يسجّل دخول.
// الحل: نجعل الإيميل وكلمة المرور إجبارية، وننشئ profile تلقائياً.
// ================================================================

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server"
import { requireTenant, requirePermission } from "@/lib/auth/guard"
import type {
  Product, Purchase, Sale, Customer, TenantUser,
  UnitCode, PaymentMethod, ClientRole, UserStatus, ProductType,
} from "@/lib/types"

/* ── محوّلات الصفوف (نفس الكود القديم) ─────────────────────────── */

function rowToProduct(r: any): Product {
  return {
    id: r.id, tenantId: r.tenant_id, name: r.name, sku: r.sku,
    unit: r.unit as UnitCode, type: (r.type as ProductType) ?? "product",
    category: r.category ?? "",
    lastCost: Number(r.last_cost), lastPrice: Number(r.last_price),
    notes: r.notes ?? "", createdAt: r.created_at?.split("T")[0] ?? "",
  }
}

function rowToPurchase(r: any): Purchase {
  return {
    id: r.id, tenantId: r.tenant_id, itemName: r.item_name, sku: r.sku,
    unit: r.unit as UnitCode, supplier: r.supplier,
    quantity: Number(r.quantity), unitCost: Number(r.unit_cost),
    warehouse: r.warehouse ?? "", batch: r.batch ?? "", date: r.date,
    userId: r.user_id ?? "",
  }
}

function rowToSale(r: any): Sale {
  return {
    id: r.id, tenantId: r.tenant_id, itemName: r.item_name, sku: r.sku,
    unit: r.unit as UnitCode, quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price), buyer: r.buyer,
    method: r.method as PaymentMethod, date: r.date, userId: r.user_id ?? "",
  }
}

function rowToCustomer(r: any): Customer {
  return {
    id: r.id, tenantId: r.tenant_id, name: r.name, phone: r.phone,
    accountId: r.account_id, itemsDetail: r.items_detail ?? "",
    totalCharged: Number(r.total_charged), amountPaid: Number(r.amount_paid),
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
  const sess = await requireTenant(product.tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("products")
    .insert({
      tenant_id: sess.tenantId, name: product.name, sku: product.sku ?? "",
      unit: product.unit, type: product.type, category: product.category,
      last_cost: product.lastCost, last_price: product.lastPrice,
      notes: product.notes,
    })
    .select("*").single()
  if (error) throw new Error(error.message)
  return rowToProduct(data)
}

export async function updateProductAction(
  id: string,
  patch: Partial<Omit<Product, "id" | "tenantId" | "createdAt">>
): Promise<void> {
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
  const { error } = await supabase.from("products").update(db).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteProductAction(id: string): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from("products").delete().eq("id", id)
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
  const sess = await requireTenant(purchase.tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("purchases")
    .insert({
      tenant_id: sess.tenantId, item_name: purchase.itemName,
      sku: purchase.sku, unit: purchase.unit, supplier: purchase.supplier,
      quantity: purchase.quantity, unit_cost: purchase.unitCost,
      warehouse: purchase.warehouse, batch: purchase.batch,
      date: purchase.date, user_id: purchase.userId || null,
    })
    .select("*").single()
  if (error) throw new Error(error.message)
  await supabase
    .from("products").update({ last_cost: purchase.unitCost })
    .eq("tenant_id", sess.tenantId).eq("sku", purchase.sku)
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
  const sess = await requireTenant(sale.tenantId)
  const supabase = await createServerSupabase()
  const today = new Date().toISOString().split("T")[0]
  const { data, error } = await supabase
    .from("sales")
    .insert({
      tenant_id: sess.tenantId, item_name: sale.itemName,
      sku: sale.sku, unit: sale.unit, quantity: sale.quantity,
      unit_price: sale.unitPrice, buyer: sale.buyer,
      method: sale.method, date: sale.date || today,
      user_id: sale.userId || null,
    })
    .select("*").single()
  if (error) throw new Error(error.message)
  await supabase
    .from("products").update({ last_price: sale.unitPrice })
    .eq("tenant_id", sess.tenantId).eq("sku", sale.sku)
  if (sale.method === "debt") {
    const total = sale.quantity * sale.unitPrice
    const detail = `${sale.quantity} ${sale.unit} ${sale.itemName}`
    await supabase.rpc("upsert_customer_debt", {
      p_tenant: sess.tenantId, p_name: sale.buyer,
      p_amount: total, p_detail: detail, p_date: sale.date || today,
    }).catch(() => null)
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
  const sess = await requireTenant(customer.tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("customers")
    .insert({
      tenant_id: sess.tenantId, name: customer.name,
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
  // p_tenant كان يُمرَّر null، والدالة في قاعدة البيانات ترفضه.
  // نأخذه من الجلسة، ونُبقي مساراً احتياطياً لو لم تُنشأ الدالة بعد.
  const s = await requirePermission("managePayments")
  if (!(amount > 0)) throw new Error("مبلغ الدفعة يجب أن يكون أكبر من صفر")

  const supabase = await createServerSupabase()
  const { error } = await supabase.rpc("record_customer_payment", {
    p_customer: customerId,
    p_tenant: s.tenantId,
    p_amount: amount,
  })

  if (!error) return

  // احتياطي: تحديث مباشر مقيَّد بنطاق الشركة
  const { data: c } = await supabase
    .from("customers")
    .select("amount_paid, total_charged")
    .eq("id", customerId).eq("tenant_id", s.tenantId).maybeSingle()

  if (!c) throw new Error("العميل غير موجود")

  const remaining = Number(c.total_charged) - Number(c.amount_paid)
  if (amount > remaining + 0.009) {
    throw new Error(`مبلغ الدفعة أكبر من المتبقي على العميل (${remaining.toFixed(2)})`)
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update({ amount_paid: Number(c.amount_paid) + amount, updated_at: new Date().toISOString() })
    .eq("id", customerId).eq("tenant_id", s.tenantId)

  if (updateError) throw new Error(updateError.message)
}

/* ================================================================ */
/* المستخدمون — الإصلاح الجذري                                       */
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
 * إضافة مستخدم جديد — الإصلاح الجذري.
 *
 * المشكلة القديمة:
 *   إذا كان email أو tempPassword فارغاً، كان auth_user_id يبقى null
 *   وما يقدر المستخدم يسجّل دخول أبداً.
 *
 * الحل:
 *   1. نجعل email وتempPassword إجباريين — نرفض الطلب إذا ناقصين.
 *   2. ننشئ profile تلقائياً في جدول profiles.
 *   3. إذا فشل إنشاء tenant_users نحذف auth user فوراً (rollback).
 */
export async function addTenantUserAction(
  input: Omit<TenantUser, "id" | "createdAt" | "lastActive" | "status"> & {
    tempPassword?: string
  }
): Promise<TenantUser> {
  // التحقق الإجباري
  const email = input.email?.trim().toLowerCase()
  const password = input.tempPassword?.trim()

  if (!email || !email.includes("@")) {
    throw new Error("البريد الإلكتروني مطلوب ولازم يكون صحيحاً")
  }
  if (!password || password.length < 8) {
    throw new Error("كلمة المرور مطلوبة (8 أحرف على الأقل)")
  }
  if (!input.name?.trim()) {
    throw new Error("اسم المستخدم مطلوب")
  }
  if (!input.username?.trim()) {
    throw new Error("اسم الدخول (username) مطلوب")
  }

  const sess = await requirePermission("manageUsers", input.tenantId || undefined)
  const adminClient = createServiceClient()

  // 1) أنشئ حساب Auth
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

  if (userError || !newUser.user) {
    const msg = userError?.message ?? "تعذّر إنشاء حساب الدخول"
    // لو الإيميل مستخدَم مسبقاً
    if (msg.toLowerCase().includes("already registered") || msg.includes("already been registered")) {
      throw new Error(`الإيميل ${email} مسجّل مسبقاً في النظام`)
    }
    throw new Error(`خطأ في إنشاء حساب الدخول: ${msg}`)
  }

  const authUserId = newUser.user.id

  // 2) أنشئ profile حتى تشتغل دوال الصلاحية
  await adminClient.from("profiles").upsert({
    id: authUserId,
    username: input.username,
    full_name: input.name,
    system_role: "client",
  })

  // 3) أضف المستخدم لجدول الشركة
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("tenant_users")
    .insert({
      tenant_id: sess.tenantId,
      name: input.name,
      username: input.username,
      email,
      role: input.role,
      status: "active",
      auth_user_id: authUserId,   // ← دائماً مش null هسا
    })
    .select("*")
    .single()

  if (error) {
    // Rollback: احذف auth user حتى ما يبقى حساب معلّق
    await adminClient.auth.admin.deleteUser(authUserId)
    throw new Error(`خطأ في حفظ بيانات المستخدم: ${error.message}`)
  }

  return rowToTenantUser(data)
}

export async function updateTenantUserAction(
  id: string,
  patch: Partial<Pick<TenantUser, "name" | "username" | "email" | "role" | "status">>
): Promise<void> {
  const supabase = await createServerSupabase()
  const db: Record<string, unknown> = {}
  if (patch.name !== undefined)     db.name     = patch.name
  if (patch.username !== undefined) db.username = patch.username
  if (patch.email !== undefined)    db.email    = patch.email
  if (patch.role !== undefined)     db.role     = patch.role
  if (patch.status !== undefined)   db.status   = patch.status
  if (Object.keys(db).length === 0) return
  const { error } = await supabase.from("tenant_users").update(db).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function toggleTenantUserStatusAction(
  id: string,
  currentStatus: UserStatus
): Promise<UserStatus> {
  const supabase = await createServerSupabase()
  const newStatus: UserStatus = currentStatus === "active" ? "frozen" : "active"
  const { error } = await supabase
    .from("tenant_users").update({ status: newStatus }).eq("id", id)
  if (error) throw new Error(error.message)
  return newStatus
}

export async function deleteTenantUserAction(id: string): Promise<void> {
  const supabase = await createServerSupabase()
  const { data: user } = await supabase
    .from("tenant_users").select("auth_user_id").eq("id", id).maybeSingle()

  const { error } = await supabase.from("tenant_users").delete().eq("id", id)
  if (error) throw new Error(error.message)

  if (user?.auth_user_id) {
    const adminClient = createServiceClient()
    await adminClient.auth.admin.deleteUser(user.auth_user_id).catch(() => null)
  }
}

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
  const s = await requirePermission("manageSettings", tenantId)
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("tenants").update({ currency }).eq("id", s.tenantId)
  if (error) throw new Error(error.message)
}
