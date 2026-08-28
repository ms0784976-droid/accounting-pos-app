"use client"

// ================================================================
// الزبائن والموردون
// ================================================================
// كل جهة تعامل لها رصيد محسوب من القيود مباشرة — لا من عمود مخزّن
// يمكن أن يتزحلق. الرصيد الموجب = عليه لنا، السالب = لنا عليه.

import { useState, useMemo } from "react"
import { useSession, useAsyncData, todayIn, resolvePreset } from "@/lib/session"
import {
  fetchPartiesAction, addPartyAction, updatePartyAction, deletePartyAction,
  fetchPartyStatementAction, fetchPartyInvoicesAction, setPartyOpeningBalanceAction,
} from "@/app/actions/parties"
import { fetchCashAccountsAction, createVoucherAction } from "@/app/actions/treasury"
import {
  PageHeader, SectionCard, DataTable, Th, Td, Tr, TotalRow, Money, Badge, BalanceBadge,
  EmptyState, TableSkeleton, InlineError, InfoNote, Modal, Drawer, ConfirmDialog,
  Field, TextInput, NumberInput, SelectInput, TextArea, SearchBox, DateRangePicker,
  Btn, IconBtn, TabBar, StatCard, useToast, formatDate, exportToCsv, printArea,
} from "./ui"
import { PARTY_KIND_META, INVOICE_TYPE_META, INVOICE_STATUS_META } from "@/lib/constants"
import type { PartyKind, PartyWithBalance } from "@/lib/types"
import {
  Plus, Pencil, Trash2, FileText, Receipt, Printer, Download,
  ArrowDownLeft, ArrowUpRight, Users,
} from "lucide-react"

type View = "all" | "customer" | "supplier"

export function PartiesTab() {
  const { currency, company, can } = useSession()
  const { notify } = useToast()
  const tz = company?.timezone ?? "Asia/Hebron"

  const [view, setView] = useState<View>("all")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<PartyWithBalance | null>(null)
  const [creating, setCreating] = useState<PartyKind | null>(null)
  const [statementFor, setStatementFor] = useState<PartyWithBalance | null>(null)
  const [payingFor, setPayingFor] = useState<PartyWithBalance | null>(null)
  const [deleting, setDeleting] = useState<PartyWithBalance | null>(null)

  const parties = useAsyncData(() => fetchPartiesAction("all"), [])

  const rows = useMemo(() => {
    let list = parties.data ?? []
    if (view !== "all") list = list.filter((p) => p.kind === view || p.kind === "both")
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.code.toLowerCase().includes(q)
      )
    }
    return list
  }, [parties.data, view, search])

  const totals = useMemo(() => {
    const list = parties.data ?? []
    return {
      receivable: list.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0),
      payable: Math.abs(list.filter((p) => p.balance < 0).reduce((s, p) => s + p.balance, 0)),
      customers: list.filter((p) => p.kind === "customer" || p.kind === "both").length,
      suppliers: list.filter((p) => p.kind === "supplier" || p.kind === "both").length,
    }
  }, [parties.data])

  const handleExport = () => {
    exportToCsv(
      `جهات-التعامل-${todayIn(tz)}.csv`,
      ["الكود", "الاسم", "النوع", "الهاتف", "مدين", "دائن", "الرصيد"],
      rows.map((p) => [
        p.code, p.name, PARTY_KIND_META[p.kind].label, p.phone,
        p.totalDebit.toFixed(2), p.totalCredit.toFixed(2), p.balance.toFixed(2),
      ])
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="الزبائن والموردون"
        subtitle="الأرصدة محسوبة من القيود المحاسبية مباشرة"
        actions={
          <>
            <Btn variant="outline" size="sm" icon={Download} onClick={handleExport}>تصدير</Btn>
            <Btn icon={Plus} onClick={() => setCreating("customer")}>جهة تعامل جديدة</Btn>
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard label="مستحق لنا" value={fmt(totals.receivable, currency)}
                  hint="ذمم مدينة" icon={ArrowDownLeft} tone="success" />
        <StatCard label="مستحق علينا" value={fmt(totals.payable, currency)}
                  hint="ذمم دائنة" icon={ArrowUpRight} tone="danger" />
        <StatCard label="عدد الزبائن" value={String(totals.customers)} icon={Users} />
        <StatCard label="عدد الموردين" value={String(totals.suppliers)} icon={Users} />
      </div>

      <SectionCard>
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
          <TabBar<View>
            tabs={[
              { id: "all", label: "الكل", count: parties.data?.length },
              { id: "customer", label: "الزبائن", count: totals.customers },
              { id: "supplier", label: "الموردون", count: totals.suppliers },
            ]}
            active={view}
            onChange={setView}
          />
          <div className="w-full sm:w-64">
            <SearchBox value={search} onChange={setSearch} placeholder="بحث بالاسم أو الهاتف أو الكود…" />
          </div>
        </div>

        {parties.error && <div className="px-5 pb-4"><InlineError message={parties.error} /></div>}

        {parties.loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : !rows.length ? (
          <EmptyState
            message={search ? "لا نتائج للبحث" : "لا توجد جهات تعامل"}
            hint={search ? undefined : "أضف زبائنك ومورديك لتتبّع أرصدتهم وكشوف حساباتهم"}
            action={!search && <Btn size="sm" icon={Plus} onClick={() => setCreating("customer")}>إضافة</Btn>}
          />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th width="100px">الكود</Th>
                <Th>الاسم</Th>
                <Th width="90px">النوع</Th>
                <Th width="120px">الهاتف</Th>
                <Th align="left" width="120px">مدين</Th>
                <Th align="left" width="120px">دائن</Th>
                <Th align="left" width="150px">الرصيد</Th>
                <Th align="center" width="130px">إجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <Tr key={p.id} muted={!p.isActive}>
                  <Td mono className="text-xs text-muted-foreground">{p.code}</Td>
                  <Td>
                    <button
                      onClick={() => setStatementFor(p)}
                      className="font-medium hover:text-primary hover:underline text-right"
                    >
                      {p.name}
                    </button>
                    {!p.isActive && <span className="mr-2 text-[10px] text-muted-foreground">(معطّل)</span>}
                  </Td>
                  <Td><Badge label={PARTY_KIND_META[p.kind].label} tint={PARTY_KIND_META[p.kind].tint} /></Td>
                  <Td mono className="text-xs" align="left">{p.phone || "—"}</Td>
                  <Td align="left" className="text-muted-foreground">
                    <Money value={p.totalDebit} currency={currency} />
                  </Td>
                  <Td align="left" className="text-muted-foreground">
                    <Money value={p.totalCredit} currency={currency} />
                  </Td>
                  <Td align="left"><BalanceBadge balance={p.balance} currency={currency} /></Td>
                  <Td align="center">
                    <div className="flex items-center justify-center gap-0.5">
                      <IconBtn icon={FileText} label="كشف حساب" onClick={() => setStatementFor(p)} />
                      {can("managePayments") && Math.abs(p.balance) > 0.009 && (
                        <IconBtn icon={Receipt} label="سند قبض/صرف" onClick={() => setPayingFor(p)} />
                      )}
                      <IconBtn icon={Pencil} label="تعديل" onClick={() => setEditing(p)} />
                      <IconBtn icon={Trash2} label="حذف" tone="danger" onClick={() => setDeleting(p)} />
                    </div>
                  </Td>
                </Tr>
              ))}
              <TotalRow>
                <Td colSpan={4}>الإجمالي ({rows.length})</Td>
                <Td align="left"><Money value={rows.reduce((s, p) => s + p.totalDebit, 0)} currency={currency} /></Td>
                <Td align="left"><Money value={rows.reduce((s, p) => s + p.totalCredit, 0)} currency={currency} /></Td>
                <Td align="left"><Money value={rows.reduce((s, p) => s + p.balance, 0)} currency={currency} colored /></Td>
                <Td />
              </TotalRow>
            </tbody>
          </DataTable>
        )}
      </SectionCard>

      {/* ── النوافذ ── */}
      <PartyForm
        open={creating !== null || editing !== null}
        party={editing}
        defaultKind={creating ?? "customer"}
        onClose={() => { setCreating(null); setEditing(null) }}
        onSaved={() => { parties.reload(); notify("تم الحفظ") }}
      />

      {statementFor && (
        <StatementDrawer
          party={statementFor}
          onClose={() => setStatementFor(null)}
        />
      )}

      {payingFor && (
        <VoucherModal
          party={payingFor}
          onClose={() => setPayingFor(null)}
          onSaved={() => { parties.reload(); notify("تم تسجيل السند") }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف جهة تعامل"
        message={
          deleting
            ? `هل تريد حذف "${deleting.name}"؟ إذا كانت عليها حركات محاسبية سيتم تعطيلها بدل حذفها، لأن الحذف الفعلي يترك القيود بلا طرف ويكسر كشوف الحسابات.`
            : ""
        }
        confirmLabel="حذف"
        onConfirm={async () => {
          if (!deleting) return
          const res = await deletePartyAction(deleting.id)
          notify(res.deactivated ? "تم التعطيل (عليها حركات محاسبية)" : "تم الحذف")
          parties.reload()
        }}
      />
    </div>
  )
}

/* ================================================================ */
/* نموذج جهة التعامل                                                 */
/* ================================================================ */

function PartyForm({ open, party, defaultKind, onClose, onSaved }: {
  open: boolean
  party: PartyWithBalance | null
  defaultKind: PartyKind
  onClose: () => void
  onSaved: () => void
}) {
  const { company } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"

  const [form, setForm] = useState(() => blank(defaultKind, tz))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [initialised, setInitialised] = useState(false)

  // إعادة تهيئة النموذج عند كل فتح
  if (open && !initialised) {
    setForm(
      party
        ? {
            name: party.name, kind: party.kind, phone: party.phone, email: party.email,
            address: party.address, taxNumber: party.taxNumber,
            creditLimit: String(party.creditLimit || ""), paymentTermsDays: String(party.paymentTermsDays || ""),
            notes: party.notes, openingBalance: "", openingDate: todayIn(tz),
          }
        : blank(defaultKind, tz)
    )
    setError("")
    setInitialised(true)
  }
  if (!open && initialised) setInitialised(false)

  const save = async () => {
    setError("")
    if (!form.name.trim()) { setError("الاسم مطلوب"); return }

    setBusy(true)
    try {
      const payload = {
        name: form.name,
        kind: form.kind,
        phone: form.phone,
        email: form.email,
        address: form.address,
        taxNumber: form.taxNumber,
        creditLimit: Number(form.creditLimit) || 0,
        paymentTermsDays: Number(form.paymentTermsDays) || 0,
        notes: form.notes,
      }

      if (party) {
        await updatePartyAction(party.id, payload)
        if (form.openingBalance !== "" && Number(form.openingBalance) !== party.openingBalance) {
          await setPartyOpeningBalanceAction(
            party.id, Number(form.openingBalance), form.openingDate
          )
        }
      } else {
        await addPartyAction({
          ...payload,
          openingBalance: Number(form.openingBalance) || 0,
          openingBalanceDate: form.openingDate,
        })
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ")
    } finally {
      setBusy(false)
    }
  }

  const set = (k: keyof ReturnType<typeof blank>, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={party ? `تعديل: ${party.name}` : "جهة تعامل جديدة"}
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn onClick={save} loading={busy}>حفظ</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم" required>
            <TextInput value={form.name} onChange={(e) => set("name", e.target.value)}
                       placeholder="سمير خالد / شركة النور للتوريد" />
          </Field>
          <Field label="النوع" required>
            <SelectInput value={form.kind} onChange={(e) => set("kind", e.target.value)}>
              <option value="customer">زبون</option>
              <option value="supplier">مورد</option>
              <option value="both">زبون ومورد</option>
            </SelectInput>
          </Field>
          <Field label="الهاتف">
            <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)}
                       placeholder="0598575834" dir="ltr" className="text-left num" />
          </Field>
          <Field label="البريد الإلكتروني">
            <TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                       dir="ltr" className="text-left" />
          </Field>
          <Field label="العنوان">
            <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="الرقم الضريبي" hint="يظهر على الفاتورة الرسمية">
            <TextInput value={form.taxNumber} onChange={(e) => set("taxNumber", e.target.value)}
                       dir="ltr" className="text-left num" />
          </Field>
          <Field label="سقف الائتمان" hint="صفر = بلا سقف. يُرفض البيع الآجل عند تجاوزه">
            <NumberInput value={form.creditLimit} onChange={(e) => set("creditLimit", e.target.value)}
                         min={0} step="0.01" placeholder="0" />
          </Field>
          <Field label="مهلة السداد (أيام)">
            <NumberInput value={form.paymentTermsDays} onChange={(e) => set("paymentTermsDays", e.target.value)}
                         min={0} placeholder="0" />
          </Field>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
          <InfoNote>
            الرصيد الافتتاحي يسجّل ما كان على الحساب قبل استخدام البرنامج، كقيد محاسبي
            مقابل حساب حقوق الملكية. <strong>موجب</strong> = عليه لنا (زبون مدين)،
            و<strong>سالب</strong> = لنا عليه (مورد دائن).
          </InfoNote>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الرصيد الافتتاحي">
              <NumberInput
                value={form.openingBalance}
                onChange={(e) => set("openingBalance", e.target.value)}
                step="0.01"
                placeholder={party ? String(party.openingBalance) : "0.00"}
              />
            </Field>
            <Field label="تاريخ الرصيد">
              <TextInput type="date" value={form.openingDate}
                         onChange={(e) => set("openingDate", e.target.value)} className="num" />
            </Field>
          </div>
        </div>

        <Field label="ملاحظات">
          <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}

function blank(kind: PartyKind, tz: string) {
  return {
    name: "", kind, phone: "", email: "", address: "", taxNumber: "",
    creditLimit: "", paymentTermsDays: "", notes: "",
    openingBalance: "", openingDate: todayIn(tz),
  }
}

/* ================================================================ */
/* كشف الحساب                                                        */
/* ================================================================ */

function StatementDrawer({ party, onClose }: {
  party: PartyWithBalance
  onClose: () => void
}) {
  const { currency, company } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"
  const year = useMemo(() => resolvePreset("this-year", tz), [tz])

  const [range, setRange] = useState(year)
  const [tab, setTab] = useState<"statement" | "invoices">("statement")

  const statement = useAsyncData(
    () => fetchPartyStatementAction(party.id, range.from, range.to),
    [party.id, range.from, range.to]
  )
  const invoices = useAsyncData(() => fetchPartyInvoicesAction(party.id), [party.id])

  const handleExport = () => {
    if (!statement.data) return
    exportToCsv(
      `كشف-حساب-${party.name}-${range.from}_${range.to}.csv`,
      ["التاريخ", "المستند", "البيان", "مدين", "دائن", "الرصيد"],
      statement.data.map((r) => [
        r.date ?? "", r.docNo, r.description,
        r.debit.toFixed(2), r.credit.toFixed(2), r.runningBalance.toFixed(2),
      ])
    )
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`كشف حساب: ${party.name}`}
      description={`${party.code} · ${PARTY_KIND_META[party.kind].label}${party.phone ? ` · ${party.phone}` : ""}`}
      footer={
        <>
          <Btn variant="outline" size="sm" icon={Download} onClick={handleExport}>تصدير Excel</Btn>
          <Btn variant="outline" size="sm" icon={Printer} onClick={printArea}>طباعة</Btn>
          <Btn variant="ghost" size="sm" onClick={onClose}>إغلاق</Btn>
        </>
      }
    >
      <div className="print-area">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <DateRangePicker
            from={range.from} to={range.to}
            onChange={(from, to) => setRange({ from, to })}
          />
          <div className="text-left">
            <p className="text-[11px] text-muted-foreground">الرصيد الحالي</p>
            <BalanceBadge balance={party.balance} currency={currency} />
          </div>
        </div>

        <div className="px-5 pt-3 no-print">
          <TabBar
            tabs={[
              { id: "statement" as const, label: "الحركات" },
              { id: "invoices" as const, label: "الفواتير", count: invoices.data?.length },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>

        {tab === "statement" ? (
          statement.loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : statement.error ? (
            <div className="p-5"><InlineError message={statement.error} /></div>
          ) : !statement.data?.length ? (
            <EmptyState message="لا حركات في هذه الفترة" />
          ) : (
            <DataTable>
              <thead className="sticky-head">
                <tr>
                  <Th width="95px">التاريخ</Th>
                  <Th width="105px">المستند</Th>
                  <Th>البيان</Th>
                  <Th align="left" width="105px">مدين</Th>
                  <Th align="left" width="105px">دائن</Th>
                  <Th align="left" width="120px">الرصيد</Th>
                </tr>
              </thead>
              <tbody>
                {statement.data.map((r, i) => (
                  <Tr key={i} className={r.docType === "opening" ? "bg-muted/40" : ""}>
                    <Td mono className="text-xs">{r.date ? formatDate(r.date) : "—"}</Td>
                    <Td mono className="text-xs text-muted-foreground">{r.docNo}</Td>
                    <Td className="text-xs">{r.description}</Td>
                    <Td align="left">{r.debit ? <Money value={r.debit} currency={currency} /> : "—"}</Td>
                    <Td align="left">{r.credit ? <Money value={r.credit} currency={currency} /> : "—"}</Td>
                    <Td align="left"><Money value={r.runningBalance} currency={currency} colored bold /></Td>
                  </Tr>
                ))}
                <TotalRow>
                  <Td colSpan={3}>الإجمالي</Td>
                  <Td align="left"><Money value={statement.data.reduce((s, r) => s + r.debit, 0)} currency={currency} /></Td>
                  <Td align="left"><Money value={statement.data.reduce((s, r) => s + r.credit, 0)} currency={currency} /></Td>
                  <Td align="left">
                    <Money value={statement.data[statement.data.length - 1]?.runningBalance ?? 0}
                           currency={currency} colored />
                  </Td>
                </TotalRow>
              </tbody>
            </DataTable>
          )
        ) : invoices.loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : !invoices.data?.length ? (
          <EmptyState message="لا فواتير مع هذه الجهة" />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th width="110px">الرقم</Th>
                <Th width="110px">النوع</Th>
                <Th width="95px">التاريخ</Th>
                <Th width="90px">الحالة</Th>
                <Th align="left" width="120px">المبلغ</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.data.map((inv) => (
                <Tr key={inv.id} muted={inv.status === "cancelled"}>
                  <Td mono className="text-xs">{inv.invoiceNo}</Td>
                  <Td>
                    <Badge
                      label={INVOICE_TYPE_META[inv.type as keyof typeof INVOICE_TYPE_META].short}
                      tint={INVOICE_TYPE_META[inv.type as keyof typeof INVOICE_TYPE_META].tint}
                    />
                  </Td>
                  <Td mono className="text-xs">{formatDate(inv.date)}</Td>
                  <Td>
                    <Badge
                      label={INVOICE_STATUS_META[inv.status as keyof typeof INVOICE_STATUS_META].label}
                      tint={INVOICE_STATUS_META[inv.status as keyof typeof INVOICE_STATUS_META].tint}
                    />
                  </Td>
                  <Td align="left"><Money value={inv.total} currency={currency} /></Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
    </Drawer>
  )
}

/* ================================================================ */
/* سند قبض / صرف سريع                                                */
/* ================================================================ */

function VoucherModal({ party, onClose, onSaved }: {
  party: PartyWithBalance
  onClose: () => void
  onSaved: () => void
}) {
  const { currency, company } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"

  // الرصيد الموجب يعني أنه مدين لنا ⇒ نقبض منه
  const type = party.balance > 0 ? "receipt" as const : "payment" as const
  const maxAmount = Math.abs(party.balance)

  const cash = useAsyncData(() => fetchCashAccountsAction(), [])
  const [amount, setAmount] = useState(maxAmount.toFixed(2))
  const [cashId, setCashId] = useState("")
  const [method, setMethod] = useState("cash")
  const [reference, setReference] = useState("")
  const [date, setDate] = useState(todayIn(tz))
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const defaultCash = cash.data?.find((c) => c.isDefault) ?? cash.data?.[0]
  const selectedCash = cashId || defaultCash?.id || ""

  const save = async () => {
    setError("")
    const value = Number(amount)
    if (!(value > 0)) { setError("المبلغ يجب أن يكون أكبر من صفر"); return }
    if (value > maxAmount + 0.009) {
      setError(`المبلغ أكبر من الرصيد المستحق (${maxAmount.toFixed(2)})`); return
    }
    if (!selectedCash) { setError("اختر الصندوق أو البنك"); return }

    setBusy(true)
    try {
      await createVoucherAction({
        type,
        partyId: party.id,
        cashAccountId: selectedCash,
        date,
        amount: value,
        method: method as "cash" | "card" | "bank" | "cheque",
        reference,
        notes,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ السند")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={type === "receipt" ? "سند قبض" : "سند صرف"}
      description={`${party.name} — الرصيد المستحق ${maxAmount.toFixed(2)}`}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn variant={type === "receipt" ? "success" : "primary"} onClick={save} loading={busy}>
            حفظ السند
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المبلغ" required>
            <NumberInput value={amount} onChange={(e) => setAmount(e.target.value)}
                         min={0} max={maxAmount} step="0.01" autoFocus />
          </Field>
          <Field label="التاريخ" required>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="num" />
          </Field>
          <Field label="الصندوق / البنك" required>
            <SelectInput value={selectedCash} onChange={(e) => setCashId(e.target.value)}>
              {(cash.data ?? []).filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="طريقة الدفع" required>
            <SelectInput value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">نقداً</option>
              <option value="card">بطاقة</option>
              <option value="bank">حوالة بنكية</option>
              <option value="cheque">شيك</option>
            </SelectInput>
          </Field>
        </div>

        {method === "cheque" && (
          <Field label="رقم الشيك" required>
            <TextInput value={reference} onChange={(e) => setReference(e.target.value)}
                       dir="ltr" className="text-left num" />
          </Field>
        )}

        <Field label="ملاحظات">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          الرصيد بعد السند:{" "}
          <Money
            value={type === "receipt" ? party.balance - Number(amount || 0) : party.balance + Number(amount || 0)}
            currency={currency} colored bold
          />
        </div>

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}

function fmt(v: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)
    + " " + (currency === "ILS" ? "₪" : currency === "USD" ? "$" : "")
}
