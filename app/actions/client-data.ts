"use server"

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server"
import type {
  Product, Purchase, Sale, Customer, TenantUser,
  UnitCode, PaymentMethod, ClientRole, UserStatus,
} from "@/lib/types"

// ── تحويل الصفوف من snake_case إلى camelCase ────────────────────

function rowToProduct(r: any): Product {
  return {
    id: r.id, tenantId: r.tenant_id, name: r.name, sku: r.sku,
    unit: r.unit as UnitCode, category: r.category ?? "",
    lastCost: Number(r.last_cost), lastPrice: Number(r.last_price),
    notes: r.notes ?? "", createdAt: r.created_at?.split("T")[0] ?? "",
  }
}

function rowToPurchase(r: any): Purchase {
  return {
    id: r.id, tenantId: r.tenant_id, itemName: r.item_name, sku: r.sku,
    unit: r.unit as UnitCode, supplier: r.supplier,
    quantity: Number(r.quantity), unitCost: Number(r.unit_cost),
    warehouse: r.warehouse, batch: r.batch, date: r.date,
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
    accountId: r.account_id, itemsDetail: r.items_detail,
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
/* PRODUCTS                                                          */
/* ================================================================ */

export async function fetchProductsAction(tenantId: string): Promise<Product[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToProduct)
}

export async function addProductAction(
  product: Omit<Product, "id" | "createdAt">
): Promise<Product> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("products")
    .insert({
      tenant_id: product.tenantId, name: product.name, sku: product.sku,
      unit: product.unit, category: product.category,
      last_cost: product.lastCost, last_price: product.lastPrice,
      notes: product.notes,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return rowToProduct(data)
}

export async function updateProductAction(
  id: string,
  patch: Partial<Omit<Product, "id" | "tenantId" | "createdAt">>
): Promise<void> {
  const supabase = await createServerSupabase()
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined)       dbPatch.name        = patch.name
  if (patch.sku !== undefined)        dbPatch.sku         = patch.sku
  if (patch.unit !== undefined)       dbPatch.unit        = patch.unit
  if (patch.category !== undefined)   dbPatch.category    = patch.category
  if (patch.lastCost !== undefined)   dbPatch.last_cost   = patch.lastCost
  if (patch.lastPrice !== undefined)  dbPatch.last_price  = patch.lastPrice
  if (patch.notes !== undefined)      dbPatch.notes       = patch.notes
  const { error } = await supabase.from("products").update(dbPatch).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteProductAction(id: string): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* PURCHASES                                                         */
/* ================================================================ */

export async function fetchPurchasesAction(tenantId: string): Promise<Purchase[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("date", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToPurchase)
}

export async function addPurchaseAction(
  purchase: Omit<Purchase, "id" | "tenantId"> & { tenantId: string }
): Promise<Purchase> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("purchases")
    .insert({
      tenant_id: purchase.tenantId, item_name: purchase.itemName,
      sku: purchase.sku, unit: purchase.unit, supplier: purchase.supplier,
      quantity: purchase.quantity, unit_cost: purchase.unitCost,
      warehouse: purchase.warehouse, batch: purchase.batch,
      date: purchase.date, user_id: purchase.userId || null,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  // تحديث آخر سعر شراء في المنتج
  await supabase
    .from("products")
    .update({ last_cost: purchase.unitCost })
    .eq("tenant_id", purchase.tenantId)
    .eq("sku", purchase.sku)

  return rowToPurchase(data)
}

/* ================================================================ */
/* SALES                                                             */
/* ================================================================ */

export async function fetchSalesAction(tenantId: string): Promise<Sale[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("date", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToSale)
}

export async function addSaleAction(
  sale: Omit<Sale, "id" | "tenantId"> & { tenantId: string }
): Promise<Sale> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("sales")
    .insert({
      tenant_id: sale.tenantId, item_name: sale.itemName,
      sku: sale.sku, unit: sale.unit, quantity: sale.quantity,
      unit_price: sale.unitPrice, buyer: sale.buyer,
      method: sale.method, date: sale.date, user_id: sale.userId || null,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  // تحديث آخر سعر بيع في المنتج
  await supabase
    .from("products")
    .update({ last_price: sale.unitPrice })
    .eq("tenant_id", sale.tenantId)
    .eq("sku", sale.sku)

  // إذا كان بيعاً آجلاً: تحديث أو إنشاء عميل في الذمم
  if (sale.method === "debt") {
    const total = sale.quantity * sale.unitPrice
    const detail = `${sale.quantity} ${sale.unit} ${sale.itemName}`

    const { data: existing } = await supabase
      .from("customers")
      .select("id, total_charged, items_detail")
      .eq("tenant_id", sale.tenantId)
      .ilike("name", sale.buyer)
      .single()

    if (existing) {
      await supabase
        .from("customers")
        .update({
          total_charged: Number(existing.total_charged) + total,
          items_detail: existing.items_detail
            ? `${existing.items_detail}، ${detail}`
            : detail,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
    } else {
      const accId = `ACC-${Math.floor(1000 + Math.random() * 9000)}`
      await supabase.from("customers").insert({
        tenant_id: sale.tenantId, name: sale.buyer, phone: "—",
        account_id: accId, items_detail: detail,
        total_charged: total, amount_paid: 0,
        due_date: sale.date,
      })
    }
  }

  return rowToSale(data)
}

/* ================================================================ */
/* CUSTOMERS                                                         */
/* ================================================================ */

export async function fetchCustomersAction(tenantId: string): Promise<Customer[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToCustomer)
}

export async function addCustomerAction(
  customer: Omit<Customer, "id" | "updatedAt" | "tenantId"> & { tenantId: string }
): Promise<Customer> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("customers")
    .insert({
      tenant_id: customer.tenantId, name: customer.name,
      phone: customer.phone, account_id: customer.accountId,
      items_detail: customer.itemsDetail,
      total_charged: customer.totalCharged,
      amount_paid: customer.amountPaid, due_date: customer.dueDate,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return rowToCustomer(data)
}

export async function recordPaymentAction(
  customerId: string,
  amount: number
): Promise<void> {
  const supabase = await createServerSupabase()
  const { data: cur, error: fetchError } = await supabase
    .from("customers")
    .select("total_charged, amount_paid")
    .eq("id", customerId)
    .single()
  if (fetchError || !cur) throw new Error("لم يُعثر على العميل")

  const newPaid = Math.min(Number(cur.total_charged), Number(cur.amount_paid) + amount)
  const { error } = await supabase
    .from("customers")
    .update({ amount_paid: newPaid, updated_at: new Date().toISOString() })
    .eq("id", customerId)
  if (error) throw new Error(error.message)
}

/* ================================================================ */
/* TENANT USERS                                                      */
/* ================================================================ */

export async function fetchTenantUsersAction(tenantId: string): Promise<TenantUser[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("tenant_users")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTenantUser)
}

export async function addTenantUserAction(
  input: Omit<TenantUser, "id" | "createdAt" | "lastActive" | "status"> & {
    tempPassword?: string
  }
): Promise<TenantUser> {
  const adminClient = createServiceClient()

  // إنشاء auth.user للموظف إذا لم يكن موجوداً
  let authUserId: string | null = null
  if (input.email && input.tempPassword) {
    const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
      email: input.email,
      password: input.tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: input.name,
        username: input.username,
        system_role: "client",
      },
    })
    if (!userError && newUser.user) {
      authUserId = newUser.user.id
    }
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("tenant_users")
    .insert({
      tenant_id: input.tenantId, name: input.name,
      username: input.username, email: input.email,
      role: input.role, status: "active",
      auth_user_id: authUserId,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return rowToTenantUser(data)
}

export async function updateTenantUserAction(
  id: string,
  patch: Partial<Pick<TenantUser, "name" | "username" | "email" | "role" | "status">>
): Promise<void> {
  const supabase = await createServerSupabase()
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined)     dbPatch.name     = patch.name
  if (patch.username !== undefined) dbPatch.username = patch.username
  if (patch.email !== undefined)    dbPatch.email    = patch.email
  if (patch.role !== undefined)     dbPatch.role     = patch.role
  if (patch.status !== undefined)   dbPatch.status   = patch.status
  const { error } = await supabase.from("tenant_users").update(dbPatch).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function toggleTenantUserStatusAction(
  id: string,
  currentStatus: UserStatus
): Promise<UserStatus> {
  const newStatus: UserStatus = currentStatus === "active" ? "frozen" : "active"
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("tenant_users")
    .update({ status: newStatus })
    .eq("id", id)
  if (error) throw new Error(error.message)
  return newStatus
}

export async function deleteTenantUserAction(id: string): Promise<void> {
  const supabase = await createServerSupabase()
  const { data: user } = await supabase
    .from("tenant_users")
    .select("auth_user_id")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("tenant_users").delete().eq("id", id)
  if (error) throw new Error(error.message)

  if (user?.auth_user_id) {
    const adminClient = createServiceClient()
    await adminClient.auth.admin.deleteUser(user.auth_user_id)
  }
}

/* ================================================================ */
/* TENANT CURRENCY                                                   */
/* ================================================================ */

export async function updateTenantCurrencyAction(
  tenantId: string,
  currency: string
): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("tenants")
    .update({ currency })
    .eq("id", tenantId)
  if (error) throw new Error(error.message)
}

export async function fetchTenantCurrencyAction(tenantId: string): Promise<string> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("tenants")
    .select("currency")
    .eq("id", tenantId)
    .single()
  if (error) return "ILS"
  return data?.currency ?? "ILS"
}
