"use client"

import { useMemo, useState } from "react"
import { Pencil, ShieldPlus, Trash2, CheckCircle, XCircle } from "lucide-react"
import { useClientStore } from "@/lib/store"
import { SectionCard, EmptyState, RoleBadge, Btn, Modal, Field, TextInput, SelectInput } from "./ui"
import type { ClientRole, TenantUser } from "@/lib/types"
import { cn } from "@/lib/utils"

const ROLES: { value: ClientRole; label: string }[] = [
  { value: "admin",      label: "مدير النظام" },
  { value: "accountant", label: "محاسب" },
  { value: "inventory",  label: "أمين المخزن" },
  { value: "cashier",    label: "كاشير" },
]

const emptyForm = { name: "", username: "", email: "", role: "cashier" as ClientRole, tempPassword: "" }

function UserModal({ open, onClose, editUser, onSave }: {
  open: boolean; onClose: () => void; editUser?: TenantUser; onSave: (f: typeof emptyForm) => void
}) {
  const [form, setForm] = useState(editUser ? {
    name: editUser.name, username: editUser.username, email: editUser.email,
    role: editUser.role, tempPassword: editUser.tempPassword ?? "",
  } : { ...emptyForm })

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Modal open={open} onClose={onClose} title={editUser ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}
      footer={<>
        <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        <Btn onClick={() => { if (form.name.trim() && form.username.trim()) { onSave(form); onClose() } }}>
          {editUser ? "حفظ التعديلات" : "إضافة الموظف"}
        </Btn>
      </>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="الاسم الكامل"><TextInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="اسم الموظف" /></Field>
        <Field label="اسم المستخدم"><TextInput value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="username" /></Field>
        <Field label="البريد الإلكتروني"><TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" /></Field>
        <Field label="الدور الوظيفي">
          <SelectInput value={form.role} onChange={(e) => set("role", e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </SelectInput>
        </Field>
        <div className="sm:col-span-2">
          <Field label="كلمة مرور مؤقتة (اختياري)">
            <TextInput value={form.tempPassword} onChange={(e) => set("tempPassword", e.target.value)} placeholder="اتركه فارغاً إذا لم تكن بحاجة لتغييرها" />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

export function UsersTab({ search }: { search: string }) {
  const { tenantUsers, addTenantUser, updateTenantUser, toggleTenantUserStatus, deleteTenantUser, currentTenantUser } = useClientStore()
  const [open, setOpen] = useState(false)
  const [editUser, setEditUser] = useState<TenantUser | undefined>()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tenantUsers
    return tenantUsers.filter((u) =>
      u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [tenantUsers, search])

  function handleSave(form: typeof emptyForm) {
    if (editUser) {
      updateTenantUser(editUser.id, {
        name: form.name.trim(), username: form.username.trim(),
        email: form.email.trim(), role: form.role,
        tempPassword: form.tempPassword.trim() || undefined,
      })
    } else {
      addTenantUser({
        tenantId: currentTenantUser.tenantId,
        name: form.name.trim(), username: form.username.trim(),
        email: form.email.trim(), role: form.role,
        tempPassword: form.tempPassword.trim() || undefined,
      })
    }
    setEditUser(undefined)
  }

  return (
    <>
      <SectionCard
        title="إدارة المستخدمين والصلاحيات"
        description="إضافة وتعديل موظفي النشاط وأدوارهم"
        action={<Btn onClick={() => { setEditUser(undefined); setOpen(true) }}><ShieldPlus className="size-4" />موظف جديد</Btn>}
      >
        {filtered.length === 0 ? <EmptyState message="لا يوجد موظفون يطابقون البحث" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 text-right">الموظف</th>
                  <th className="px-5 py-3 text-right">اسم المستخدم</th>
                  <th className="px-5 py-3 text-right">الدور الوظيفي</th>
                  <th className="px-5 py-3 text-right">الحالة</th>
                  <th className="px-5 py-3 text-right">آخر نشاط</th>
                  <th className="px-5 py-3 text-right">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => {
                  const isSelf = u.id === currentTenantUser.id
                  const initials = u.name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("")
                  return (
                    <tr key={u.id} className="hover:bg-muted/40 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-muted-foreground">{u.username}</td>
                      <td className="px-5 py-3.5"><RoleBadge role={u.role} /></td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                          u.status === "active" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                        )}>
                          {u.status === "active" ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
                          {u.status === "active" ? "نشط" : "مجمّد"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{u.lastActive}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditUser(u); setOpen(true) }}
                            className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition">
                            <Pencil className="size-3.5" />
                          </button>
                          {!isSelf && (
                            <>
                              <button onClick={() => toggleTenantUserStatus(u.id)}
                                className={cn("size-8 rounded-lg flex items-center justify-center transition",
                                  u.status === "active"
                                    ? "text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                    : "text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                                )}>
                                {u.status === "active" ? <XCircle className="size-3.5" /> : <CheckCircle className="size-3.5" />}
                              </button>
                              <button onClick={() => deleteTenantUser(u.id)}
                                className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 transition">
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <UserModal
        open={open}
        onClose={() => { setOpen(false); setEditUser(undefined) }}
        editUser={editUser}
        onSave={handleSave}
      />
    </>
  )
}
