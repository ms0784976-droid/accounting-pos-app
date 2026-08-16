"use client"

import { useMemo, useState } from "react"
import { UserPlus, HandCoins } from "lucide-react"
import { paymentStatus, remainingBalance, useClientStore } from "@/lib/store"
import { SectionCard, EmptyState, PaymentStatusBadge, Btn, Modal, Field, TextInput } from "./ui"
import type { Customer } from "@/lib/types"

function RecordPaymentModal({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const { recordPayment, fmt } = useClientStore()
  const [amount, setAmount] = useState("")

  function submit() {
    const n = Number(amount)
    if (customer && n > 0) { recordPayment(customer.id, n); onClose(); setAmount("") }
  }

  if (!customer) return null
  const remaining = remainingBalance(customer)

  return (
    <Modal open={!!customer} onClose={onClose} title="تسجيل دفعة"
      footer={<><Btn variant="outline" onClick={onClose}>إلغاء</Btn><Btn onClick={submit} disabled={!amount || Number(amount) <= 0}>تأكيد الدفعة</Btn></>}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">العميل:</span><span className="font-semibold">{customer.name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">إجمالي المديونية:</span><span className="font-bold text-danger">{fmt(remaining)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">المسدّد:</span><span>{fmt(customer.amountPaid)}</span></div>
        </div>
        <Field label="مبلغ الدفعة">
          <TextInput type="number" min={1} max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
      </div>
    </Modal>
  )
}

function AddCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addCustomer, today } = useClientStore()
  const [form, setForm] = useState({ name: "", phone: "", itemsDetail: "", totalCharged: "" })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  function submit() {
    if (!form.name.trim()) return
    addCustomer({ name: form.name.trim(), phone: form.phone.trim() || "—", accountId: `ACC-${Math.floor(1000 + Math.random() * 9000)}`, itemsDetail: form.itemsDetail.trim() || "—", totalCharged: Number(form.totalCharged) || 0, amountPaid: 0, dueDate: today })
    setForm({ name: "", phone: "", itemsDetail: "", totalCharged: "" })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="إضافة عميل جديد"
      footer={<><Btn variant="outline" onClick={onClose}>إلغاء</Btn><Btn onClick={submit} disabled={!form.name.trim()}>إضافة العميل</Btn></>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="اسم العميل"><TextInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="الاسم الكامل" /></Field>
        <Field label="رقم الجوال"><TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+966 50 ..." /></Field>
        <Field label="تفاصيل البضاعة المأخوذة"><TextInput value={form.itemsDetail} onChange={(e) => set("itemsDetail", e.target.value)} placeholder="مثال: 10 ألواح ألمنيوم" /></Field>
        <Field label="مبلغ المديونية الأولي"><TextInput type="number" min={0} value={form.totalCharged} onChange={(e) => set("totalCharged", e.target.value)} placeholder="0" /></Field>
      </div>
    </Modal>
  )
}

export function CustomersTab({ search }: { search: string }) {
  const { customers, today, fmt } = useClientStore()
  const [payTarget, setPayTarget] = useState<Customer | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.accountId.toLowerCase().includes(q)
    )
  }, [customers, search])

  return (
    <>
      <SectionCard
        title="العملاء وإدارة الذمم"
        description="متابعة المديونيات والدفعات والأرصدة"
        action={<Btn onClick={() => setAddOpen(true)}><UserPlus className="size-4" />عميل جديد</Btn>}
      >
        {filtered.length === 0 ? <EmptyState message="لا يوجد عملاء يطابقون البحث" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 text-right">العميل</th>
                  <th className="px-5 py-3 text-right">التواصل</th>
                  <th className="px-5 py-3 text-right">البضاعة المأخوذة</th>
                  <th className="px-5 py-3 text-right">المجموع</th>
                  <th className="px-5 py-3 text-right">المسدّد</th>
                  <th className="px-5 py-3 text-right">المتبقي</th>
                  <th className="px-5 py-3 text-right">الحالة</th>
                  <th className="px-5 py-3 text-right">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => {
                  const remaining = remainingBalance(c)
                  const status = paymentStatus(c, today)
                  return (
                    <tr key={c.id} className="hover:bg-muted/40 transition">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{c.accountId}</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{c.phone}</td>
                      <td className="px-5 py-3.5 text-muted-foreground max-w-[200px]">
                        <p className="truncate">{c.itemsDetail}</p>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-foreground font-medium">{fmt(c.totalCharged)}</td>
                      <td className="px-5 py-3.5 tabular-nums text-success font-medium">{fmt(c.amountPaid)}</td>
                      <td className="px-5 py-3.5 tabular-nums font-bold text-danger">{fmt(remaining)}</td>
                      <td className="px-5 py-3.5"><PaymentStatusBadge status={status} /></td>
                      <td className="px-5 py-3.5">
                        {remaining > 0 && (
                          <Btn size="sm" variant="outline" onClick={() => setPayTarget(c)}>
                            <HandCoins className="size-3.5" />تسجيل دفعة
                          </Btn>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <RecordPaymentModal customer={payTarget} onClose={() => setPayTarget(null)} />
      <AddCustomerModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
