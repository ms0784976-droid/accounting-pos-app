"use client"

import { useState, useEffect } from "react"
import { useAuth, useOwnerStore } from "@/lib/store"
import { PLAN_META, TENANT_STATUS_META } from "@/lib/constants"
import type { Tenant, SubscriptionPlan, TenantStatus } from "@/lib/types"
import {
  Calculator, LogOut, Plus, Building2, Users, Activity,
  CheckCircle, XCircle, Clock, Pencil, Trash2, Moon, Sun,
  Crown, Shield, Key
} from "lucide-react"
import { cn } from "@/lib/utils"

const TODAY = "2026-08-16"

// ── Stat Card ────────────────────────────────────────────────────────────
function StatBox({ label, value, icon: Icon, tone }: {
  label: string; value: string | number; icon: typeof Building2; tone: string
}) {
  return (
    <div className={cn("rounded-2xl border p-5 flex items-center gap-4", "bg-card border-border")}>
      <div className={cn("size-12 rounded-xl flex items-center justify-center shrink-0", tone)}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

// ── Plan Badge ───────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: SubscriptionPlan }) {
  const meta = PLAN_META[plan]
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", meta.color)}>
      {meta.label}
    </span>
  )
}

// ── Status Badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TenantStatus }) {
  const meta = TENANT_STATUS_META[status]
  const Icon = status === "active" ? CheckCircle : status === "frozen" ? XCircle : Clock
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", meta.color)}>
      <Icon className="size-3" />
      {meta.label}
    </span>
  )
}

// ── Add/Edit Tenant Modal ────────────────────────────────────────────────
const emptyForm = {
  name: "", ownerName: "", email: "", phone: "", tempPassword: "",
  plan: "basic" as SubscriptionPlan, status: "active" as TenantStatus,
  industry: "", currency: "SAR", expiresAt: "2027-08-16",
}

function TenantModal({
  open, onClose, initial, onSave,
}: {
  open: boolean
  onClose: () => void
  initial?: Tenant
  onSave: (data: typeof emptyForm) => void
}) {
  const [form, setForm] = useState(initial ? {
    name: initial.name, ownerName: initial.ownerName, email: initial.email,
    phone: initial.phone, tempPassword: (initial as any).tempPassword || "",
    plan: initial.plan, status: initial.status,
    industry: initial.industry, currency: initial.currency, expiresAt: initial.expiresAt,
  } : { ...emptyForm })

  useEffect(() => {
    if (open) setForm(initial ? {
      name: initial.name, ownerName: initial.ownerName, email: initial.email,
      phone: initial.phone, tempPassword: (initial as any).tempPassword || "",
      plan: initial.plan, status: initial.status,
      industry: initial.industry, currency: initial.currency, expiresAt: initial.expiresAt,
    } : { ...emptyForm })
  }, [open, initial])

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-foreground mb-5">
          {initial ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ["name", "اسم النشاط التجاري"],
            ["ownerName", "اسم صاحب النشاط"],
            ["email", "البريد الإلكتروني"],
            ["phone", "رقم الجوال"],
            ["tempPassword", "كلمة المرور للحساب"],
            ["industry", "القطاع / المجال"],
            ["expiresAt", "تاريخ الانتهاء"],
          ] as [keyof typeof form, string][]).map(([k, label]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
              <input
                type="text"
                value={String(form[k])}
                onChange={(e) => set(k, e.target.value)}
                placeholder={k === "tempPassword" ? "كلمة سر الحساب" : ""}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">خطة الاشتراك</label>
            <select
              value={form.plan}
              onChange={(e) => set("plan", e.target.value)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:border-ring"
            >
              <option value="basic">أساسي</option>
              <option value="professional">احترافي</option>
              <option value="enterprise">مؤسسي</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">حالة الحساب</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:border-ring"
            >
              <option value="active">نشط</option>
              <option value="frozen">مجمّد</option>
              <option value="trial">تجريبي</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition"
          >
            إلغاء
          </button>
          <button
            onClick={() => { if (form.name.trim()) { onSave(form); onClose() } }}
            className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition"
          >
            {initial ? "حفظ التعديلات" : "إضافة العميل"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Owner Shell ─────────────────────────────────────────────────────
export function OwnerShell() {
  const { authUser, logout } = useAuth()
  const { tenants, addTenant, updateTenant, toggleTenantStatus, deleteTenant } = useOwnerStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTenant, setEditTenant] = useState<Tenant | undefined>()
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [search, setSearch] = useState("")

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === "active").length,
    trial: tenants.filter((t) => t.status === "trial").length,
    expiringSoon: tenants.filter((t) => t.expiresAt <= "2026-09-16" && t.status === "active").length,
  }

  function handleSave(data: typeof emptyForm) {
    if (editTenant) {
      updateTenant(editTenant.id, data)
    } else {
      addTenant(data as any)
    }
    setEditTenant(undefined)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center">
              <Calculator className="size-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">مُحاسِب</p>
              <p className="text-xs text-muted-foreground mt-0.5">لوحة إدارة المنصة</p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في العملاء..."
              className="h-9 w-56 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/50"
            />

            <button
              onClick={() => setTheme((t) => t === "dark" ? "light" : "dark")}
              className="size-9 rounded-xl border border-input bg-card flex items-center justify-center text-muted-foreground hover:bg-muted transition"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-1.5">
              <div className="size-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Crown className="size-3 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-foreground">{authUser?.name}</span>
            </div>

            <button
              onClick={logout}
              className="size-9 rounded-xl border border-input bg-card flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Privacy notice */}
        <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-400/20 rounded-2xl px-5 py-3.5">
          <Shield className="size-5 text-purple-500 shrink-0" />
          <p className="text-sm text-purple-700 dark:text-purple-300">
            <strong>خصوصية تامة:</strong> هذه اللوحة مخصصة لإدارة العملاء المشتركين فقط. لا يمكن الاطلاع على أي بيانات مالية أو حركات خاصة بأي عميل.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBox label="إجمالي العملاء" value={stats.total} icon={Building2} tone="bg-blue-500/10 text-blue-600" />
          <StatBox label="عملاء نشطون" value={stats.active} icon={CheckCircle} tone="bg-green-500/10 text-green-600" />
          <StatBox label="حسابات تجريبية" value={stats.trial} icon={Clock} tone="bg-amber-500/10 text-amber-600" />
          <StatBox label="تنتهي قريباً" value={stats.expiringSoon} icon={Activity} tone="bg-red-500/10 text-red-600" />
        </div>

        {/* Tenants Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-base font-bold text-foreground">العملاء المشتركون</h2>
              <p className="text-sm text-muted-foreground">إدارة اشتراكات وحسابات العملاء</p>
            </div>
            <button
              onClick={() => { setEditTenant(undefined); setModalOpen(true) }}
              className="flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition"
            >
              <Plus className="size-4" />
              عميل جديد
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3 text-right">النشاط التجاري</th>
                  <th className="px-6 py-3 text-right">صاحب النشاط</th>
                  <th className="px-6 py-3 text-right">كلمة المرور</th>
                  <th className="px-6 py-3 text-right">القطاع</th>
                  <th className="px-6 py-3 text-right">الخطة</th>
                  <th className="px-6 py-3 text-right">الحالة</th>
                  <th className="px-6 py-3 text-right">تاريخ الانتهاء</th>
                  <th className="px-6 py-3 text-right">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((t) => {
                  const expiringSoon = t.expiresAt <= "2026-09-16" && t.status === "active"
                  const tempPass = (t as any).tempPassword
                  return (
                    <tr key={t.id} className="hover:bg-muted/40 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="size-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{t.name}</p>
                            <p className="text-xs text-muted-foreground">{t.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground">{t.ownerName}</td>
                      <td className="px-6 py-4">
                        {tempPass ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs bg-muted px-2.5 py-1 rounded-lg text-foreground font-semibold border border-border">
                            <Key className="size-3 text-primary" /> {tempPass}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{t.industry}</td>
                      <td className="px-6 py-4"><PlanBadge plan={t.plan} /></td>
                      <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                      <td className="px-6 py-4">
                        <span className={cn("text-sm tabular-nums", expiringSoon ? "text-danger font-semibold" : "text-muted-foreground")}>
                          {t.expiresAt}
                          {expiringSoon && <span className="block text-xs">⚠ ينتهي قريباً</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditTenant(t); setModalOpen(true) }}
                            className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition"
                            title="تعديل"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => toggleTenantStatus(t.id)}
                            className={cn(
                              "size-8 rounded-lg flex items-center justify-center transition",
                              t.status === "active"
                                ? "text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                : "text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                            )}
                            title={t.status === "active" ? "تجميد" : "تفعيل"}
                          >
                            {t.status === "active" ? <XCircle className="size-3.5" /> : <CheckCircle className="size-3.5" />}
                          </button>
                          <button
                            onClick={() => deleteTenant(t.id)}
                            className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 transition"
                            title="حذف"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Users className="size-10 mb-3 opacity-30" />
                <p className="text-sm">لا توجد نتائج</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <TenantModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTenant(undefined) }}
        initial={editTenant}
        onSave={handleSave}
      />
    </div>
  )
}