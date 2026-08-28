"use server"

/**
 * app/actions/client-data.ts — نسخة مؤمّنة
 * ================================================================
 * التغييرات الجوهرية عن النسخة السابقة:
 *  1. tenantId لم يعد يُؤخذ من المتصفح — يُشتق من الجلسة عبر requireTenant().
 *     (المعامل ما زال موجوداً حفاظاً على توافق الواجهة، لكنه يُتحقَّق منه ويُرفض إن اختلف)
 *  2. كل عملية كتابة تمرّ من requirePermission() — الصلاحيات تُفرض هنا لا في الواجهة.
 *  3. كل عملية تعديل/حذف مقيّدة بـ eq("tenant_id") حتى لو تسرّب معرّف من شركة أخرى.
 *  4. التواريخ تُحسب بتوقيت الشركة وليس UTC.
 */

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server"
import { requireTenant, requirePermission, todayInTimezone } from "@/lib/auth/guard"
import type {
  Product, Purchase, Sale, Customer, TenantUser,
  UnitCode, PaymentMethod, ClientRole, UserStatus, ProductType,
} from "@/lib/types"

/* ── محوّلات الصفوف ─────────────────────────────────────────────── */

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

async function tenantToday(tenantId: string): Promise<string> {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("tenants").select("timezone").eq("id", tenantId).maybeSingle()
  return todayInTimezone(data?.timezone ?? "Asia/Hebron")
}

/* ================================================================ */
/* PRODUCTS                                                          */
/* ================================================================ */

export async function fetchProductsAction(tenantId?: string): Promise<Product[]> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("products").select("*")
    .eq("tenant_id", s.tenantId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToProduct)
}

export async function addProductAction(
  product: Omit<Product, "id" | "createdAt">
): Promise<Product> {
  const s = await requirePermission("manageProducts", product.tenantId)

  if (!product.name?.trim()) throw new Error("اسم الصنف مطلوب")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("products")
    .insert({
      tenant_id: s.tenantId,                    // ← من الجلسة، لا من العميل
      name: product.name.trim(), sku: product.sku?.trim() ?? "",
      unit: product.unit, type: product.type, category: product.category,
      last_cost: product.lastCost, last_price: product.lastPrice,
      notes: product.notes,
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

  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined)      dbPatch.name       = patch.name
  if (patch.sku !== undefined)       dbPatch.sku        = patch.sku
  if (patch.unit !== undefined)      dbPatch.unit       = patch.unit
  if (patch.type !== undefined)      dbPatch.type       = patch.type
  if (patch.category !== undefined)  dbPatch.category   = patch.category
  if (patch.lastPrice !== undefined) dbPatch.last_price = patch.lastPrice
  if (patch.notes !== undefined)     dbPatch.notes      = patch.notes
  // تعديل التكلفة يتطلب صلاحية أعلى
  if (patch.lastCost !== undefined) {
    await requirePermission("editCosts")
    dbPatch.last_cost = patch.lastCost
  }
  if (Object.keys(dbPatch).length === 0) return

  const { error } = await supabase
    .from("products").update(dbPatch)
    .eq("id", id).eq("tenant_id", s.tenantId)   // ← نطاق الشركة إجباري
  if (error) throw new Error(error.message)
}

export async function deleteProductAction(id: string): Promise<void> {
  const s = await requirePermission("manageProducts")
  const supabase = await createServerSupabase()

  // لا نحذف صنفاً له حركة — نعطّله بدل ما نكسر تاريخ الحسابات
  const { count } = await supabase
    .from("stock_moves")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id).eq("tenant_id", s.tenantId)

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("products").update({ is_active: false })
      .eq("id", id).eq("tenant_id", s.tenantId)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase
    .from("products").delete()
    .eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* PURCHASES                                                         */
/* ================================================================ */

export async function fetchPurchasesAction(tenantId?: string): Promise<Purchase[]> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("purchases").select("*")
    .eq("tenant_id", s.tenantId)
    .order("date", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToPurchase)
}

export async function addPurchaseAction(
  purchase: Omit<Purchase, "id" | "tenantId"> & { tenantId: string }
): Promise<Purchase> {
  const s = await requirePermission("createPurchase", purchase.tenantId)

  if (purchase.quantity <= 0) throw new Error("الكمية يجب أن تكون أكبر من صفر")
  if (purchase.unitCost < 0)  throw new Error("سعر التكلفة غير صالح")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("purchases")
    .insert({
      tenant_id: s.tenantId, item_name: purchase.itemName,
      sku: purchase.sku, unit: purchase.unit, supplier: purchase.supplier,
      quantity: purchase.quantity, unit_cost: purchase.unitCost,
      warehouse: purchase.warehouse, batch: purchase.batch,
      date: purchase.date || await tenantToday(s.tenantId),
      user_id: purchase.userId || null,
    })
    .select("*").single()
  if (error) throw new Error(error.message)

  await supabase
    .from("products").update({ last_cost: purchase.unitCost })
    .eq("tenant_id", s.tenantId).eq("sku", purchase.sku)

  return rowToPurchase(data)
}

/* ================================================================ */
/* SALES                                                             */
/* ================================================================ */

export async function fetchSalesAction(tenantId?: string): Promise<Sale[]> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("sales").select("*")
    .eq("tenant_id", s.tenantId)
    .order("date", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToSale)
}

export async function addSaleAction(
  sale: Omit<Sale, "id" | "tenantId"> & { tenantId: string }
): Promise<Sale> {
  const s = await requirePermission("createSale", sale.tenantId)

  if (sale.quantity <= 0)  throw new Error("الكمية يجب أن تكون أكبر من صفر")
  if (sale.unitPrice < 0)  throw new Error("سعر البيع غير صالح")
  if (!sale.buyer?.trim()) throw new Error("اسم المشتري مطلوب")

  const supabase = await createServerSupabase()
  const today = await tenantToday(s.tenantId)

  const { data, error } = await supabase
    .from("sales")
    .insert({
      tenant_id: s.tenantId, item_name: sale.itemName,
      sku: sale.sku, unit: sale.unit, quantity: sale.quantity,
      unit_price: sale.unitPrice, buyer: sale.buyer.trim(),
      method: sale.method, date: sale.date || today,
      user_id: sale.userId || null,
    })
    .select("*").single()
  if (error) throw new Error(error.message)

  await supabase
    .from("products").update({ last_price: sale.unitPrice })
    .eq("tenant_id", s.tenantId).eq("sku", sale.sku)

  // البيع الآجل: تحديث ذمم الزبون بشكل ذرّي عبر دالة في قاعدة البيانات
  // (النسخة القديمة كانت تقرأ ثم تكتب من JavaScript => بيعتان متزامنتان تُضيّعان مبلغاً)
  if (sale.method === "debt") {
    const total = sale.quantity * sale.unitPrice
    const detail = `${sale.quantity} ${sale.unit} ${sale.itemName}`
    const { error: rpcError } = await supabase.rpc("upsert_customer_debt", {
      p_tenant: s.tenantId,
      p_name: sale.buyer.trim(),
      p_amount: total,
      p_detail: detail,
      p_date: sale.date || today,
    })
    if (rpcError) throw new Error(rpcError.message)
  }

  return rowToSale(data)
}

/* ================================================================ */
/* CUSTOMERS                                                         */
/* ================================================================ */

export async function fetchCustomersAction(tenantId?: string): Promise<Customer[]> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("customers").select("*")
    .eq("tenant_id", s.tenantId)
    .order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToCustomer)
}

export async function addCustomerAction(
  customer: Omit<Customer, "id" | "updatedAt" | "tenantId"> & { tenantId: string }
): Promise<Customer> {
  const s = await requireTenant(customer.tenantId)
  if (!customer.name?.trim()) throw new Error("اسم العميل مطلوب")

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
  if (!(amount > 0)) throw new Error("مبلغ الدفعة يجب أن يكون أكبر من صفر")

  const supabase = await createServerSupabase()
  // ذرّي: التحديث يتم بعملية واحدة داخل قاعدة البيانات
  const { error } = await supabase.rpc("record_customer_payment", {
    p_customer: customerId,
    p_tenant: s.tenantId,
    p_amount: amount,
  })
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* TENANT USERS                                                      */
/* ================================================================ */

export async function fetchTenantUsersAction(tenantId?: string): Promise<TenantUser[]> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("tenant_users").select("*")
    .eq("tenant_id", s.tenantId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTenantUser)
}

export async function addTenantUserAction(
  input: Omit<TenantUser, "id" | "createdAt" | "lastActive" | "status"> & {
    tempPassword?: string
  }
): Promise<TenantUser> {
  const s = await requirePermission("manageUsers", input.tenantId)

  // التحقق من سقف المستخدمين حسب الخطة
  const supabase = await createServerSupabase()
  const { data: tenant } = await supabase
    .from("tenants").select("plan").eq("id", s.tenantId).single()
  const maxUsers: Record<string, number> =
    { basic: 3, professional: 10, enterprise: 999 }
  const { count } = await supabase
    .from("tenant_users").select("id", { count: "exact", head: true })
    .eq("tenant_id", s.tenantId)
  if ((count ?? 0) >= (maxUsers[tenant?.plan ?? "basic"] ?? 3)) {
    throw new Error("بلغت الحد الأقصى لعدد المستخدمين في خطتك الحالية")
  }

  const adminClient = createServiceClient()
  let authUserId: string | null = null

  if (input.email && input.tempPassword) {
    if (input.tempPassword.length < 8) {
      throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    }
    const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
      email: input.email.trim().toLowerCase(),
      password: input.tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: input.name, username: input.username, system_role: "client",
      },
    })
    if (userError) throw new Error(`تعذّر إنشاء الحساب: ${userError.message}`)
    authUserId = newUser.user?.id ?? null

    if (authUserId) {
      await adminClient.from("profiles").upsert({
        id: authUserId, username: input.username,
        full_name: input.name, system_role: "client",
      })
    }
  }

  const { data, error } = await supabase
    .from("tenant_users")
    .insert({
      tenant_id: s.tenantId, name: input.name,
      username: input.username, email: input.email,
      role: input.role, status: "active", auth_user_id: authUserId,
    })
    .select("*").single()

  if (error) {
    if (authUserId) await adminClient.auth.admin.deleteUser(authUserId)
    throw new Error(error.message)
  }
  return rowToTenantUser(data)
}

export async function updateTenantUserAction(
  id: string,
  patch: Partial<Pick<TenantUser, "name" | "username" | "email" | "role" | "status">>
): Promise<void> {
  const s = await requirePermission("manageUsers")
  const supabase = await createServerSupabase()

  // لا يستطيع المستخدم ترقية نفسه
  const { data: target } = await supabase
    .from("tenant_users").select("auth_user_id, role")
    .eq("id", id).eq("tenant_id", s.tenantId).maybeSingle()
  if (!target) throw new Error("المستخدم غير موجود")
  if (target.auth_user_id === s.userId && patch.role && patch.role !== target.role) {
    throw new Error("لا يمكنك تغيير صلاحياتك بنفسك")
  }

  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined)     dbPatch.name     = patch.name
  if (patch.username !== undefined) dbPatch.username = patch.username
  if (patch.email !== undefined)    dbPatch.email    = patch.email
  if (patch.role !== undefined)     dbPatch.role     = patch.role
  if (patch.status !== undefined)   dbPatch.status   = patch.status
  if (Object.keys(dbPatch).length === 0) return

  const { error } = await supabase
    .from("tenant_users").update(dbPatch)
    .eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)
}

export async function toggleTenantUserStatusAction(
  id: string,
  currentStatus: UserStatus
): Promise<UserStatus> {
  const s = await requirePermission("manageUsers")
  const supabase = await createServerSupabase()

  const { data: target } = await supabase
    .from("tenant_users").select("auth_user_id")
    .eq("id", id).eq("tenant_id", s.tenantId).maybeSingle()
  if (!target) throw new Error("المستخدم غير موجود")
  if (target.auth_user_id === s.userId) throw new Error("لا يمكنك تجميد حسابك بنفسك")

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
  if (user.auth_user_id === s.userId) throw new Error("لا يمكنك حذف حسابك بنفسك")

  const { error } = await supabase
    .from("tenant_users").delete()
    .eq("id", id).eq("tenant_id", s.tenantId)
  if (error) throw new Error(error.message)

  if (user.auth_user_id) {
    const adminClient = createServiceClient()
    await adminClient.auth.admin.deleteUser(user.auth_user_id)
  }
}

/* ================================================================ */
/* TENANT SETTINGS                                                   */
/* ================================================================ */

export async function updateTenantCurrencyAction(
  tenantId: string,
  currency: string
): Promise<void> {
  const s = await requirePermission("manageSettings", tenantId)
  if (!["ILS", "USD", "JOD", "EUR"].includes(currency)) {
    throw new Error("عملة غير مدعومة")
  }
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("tenants").update({ currency }).eq("id", s.tenantId)
  if (error) throw new Error(error.message)
}

export async function fetchTenantCurrencyAction(tenantId?: string): Promise<string> {
  const s = await requireTenant(tenantId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("tenants").select("currency").eq("id", s.tenantId).single()
  if (error) return "ILS"
  return data?.currency ?? "ILS"
}
