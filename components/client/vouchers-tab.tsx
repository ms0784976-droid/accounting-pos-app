"use client"

// ================================================================
// سندات القبض والصرف · الصناديق والبنوك
// ================================================================
// النسخة السابقة كانت تسجّل الدفعة كمجرد زيادة في عمود amount_paid:
// بلا تاريخ، بلا طريقة، بلا رقم سند، وبلا أثر في كشف الحساب.
// هنا كل دفعة مستند مرقّم له قيد محاسبي، والفلوس تدخل صندوقاً محدداً.

import { useState, useMemo } from "react"
import { useSession, useAsyncData, resolvePreset, todayIn } from "@/lib/session"
import {
  fetchVouchersAction, createVoucherAction, cancelVoucherAction,
  fetchCashAccountsAction, addCashAccountAction, updateCashAccountAction,
} from "@/app/actions/treasury"
import { fetchPartiesAction } from "@/app/actions/parties"
import {
  PageHeader, SectionCard, DataTable, Th, Td, Tr, TotalRow, Money, Badge,
  EmptyState, TableSkeleton, InlineError, InfoNote, Modal, ConfirmDialog,
  Field, TextInput, NumberInput, SelectInput, TextArea, SearchBox,
  DateRangePicker, StatCard, TabBar, Btn, IconBtn, useToast,
  formatDate, exportToCsv,
} from "./ui"
import { VOUCHER_TYPE_META, VOUCHER_METHOD_META, CASH_ACCOUNT_KIND_META } from "@/lib/constants"
import type { PaymentVoucher, VoucherType, CashAccountKind } from "@/lib/types"
import {
  Plus, Ban, Download, Wallet, ArrowDownLeft, ArrowUpRight, Landmark, Pencil,
} from "lucide-react"

type View = "all" | VoucherType

/* ================================================================ */
/* السندات                                                           */
/* ================================================================ */

export function VouchersTab() {
  const { currency, company, can } = useSession()
  const { notify } = useToast()
  const tz = company?.timezone ?? "Asia/Hebron"
  const month = useMemo(() => resolvePreset("this-month", tz), [tz])

  const [range, setRange] = useState(month)
  const [view, setView] = useState<View>("all")
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState<VoucherType | null>(null)
  const [cancelling, setCancelling] = useState<PaymentVoucher | null>(null)

  const vouchers = useAsyncData(
    () => fetchVouchersAction({ from: range.from, to: range.to, limit: 500 }),
    [range.from, range.to]
  )

  const rows = useMemo(() => {
    let list = vouchers.data ?? []
    if (view !== "all") list = list.filter((v) => v.type === view)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (v) =>
          v.voucherNo.toLowerCase().includes(q) ||
          v.partyName.toLowerCase().includes(q) ||
          v.reference.toLowerCase().includes(q)
      )
    }
    return list
  }, [vouchers.data, view, search])

  const totals = useMemo(() => {
    const live = (vouchers.data ?? []).filter((v) => v.status === "confirmed")
    return {
      received: live.filter((v) => v.type === "receipt").reduce((s, v) => s + v.amount, 0),
      paid: live.filter((v) => v.type === "payment").reduce((s, v) => s + v.amount, 0),
      cheques: live.filter((v) => v.method === "cheque").length,
    }
  }, [vouchers.data])

  return (
    <div className="space-y-5">
      <PageHeader
        title="سندات القبض والصرف"
        subtitle="كل دفعة مستند مرقّم بقيد محاسبي — لا مجرد رقم يزيد"
        actions={
          <>
            <Btn variant="outline" size="sm" icon={Download}
                 onClick={() => exportToCsv(
                   `السندات-${range.from}_${range.to}.csv`,
                   ["رقم السند", "النوع", "التاريخ", "الطرف", "الطريقة", "المرجع", "الصندوق", "المبلغ", "الحالة"],
                   rows.map((v) => [
                     v.voucherNo, VOUCHER_TYPE_META[v.type].label, v.date, v.partyName,
                     VOUCHER_METHOD_META[v.method], v.reference, v.cashAccountName,
                     v.amount.toFixed(2), v.status === "confirmed" ? "مؤكّد" : "ملغى",
                   ])
                 )}>
              تصدير
            </Btn>
            {can("managePayments") && (
              <>
                <Btn variant="outline" size="sm" icon={ArrowUpRight}
                     onClick={() => setCreating("payment")}>سند صرف</Btn>
                <Btn icon={ArrowDownLeft} onClick={() => setCreating("receipt")}>سند قبض</Btn>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard label="المقبوض" value={fmt(totals.received, currency)}
                  tone="success" icon={ArrowDownLeft} />
        <StatCard label="المدفوع" value={fmt(totals.paid, currency)}
                  tone="danger" icon={ArrowUpRight} />
        <StatCard label="صافي الحركة" value={fmt(totals.received - totals.paid, currency)}
                  tone={totals.received - totals.paid < 0 ? "danger" : "success"} icon={Wallet} />
        <StatCard label="شيكات" value={String(totals.cheques)}
                  hint="تحتاج متابعة استحقاق" icon={Landmark} />
      </div>

      <SectionCard>
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
          <TabBar<View>
            tabs={[
              { id: "all", label: "الكل", count: rows.length },
              { id: "receipt", label: "قبض" },
              { id: "payment", label: "صرف" },
            ]}
            active={view}
            onChange={setView}
          />
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker from={range.from} to={range.to}
                             onChange={(from, to) => setRange({ from, to })} />
            <div className="w-52">
              <SearchBox value={search} onChange={setSearch} placeholder="رقم السند أو الاسم…" />
            </div>
          </div>
        </div>

        {vouchers.error && <div className="px-5 pb-4"><InlineError message={vouchers.error} /></div>}

        {vouchers.loading ? (
          <TableSkeleton rows={7} cols={7} />
        ) : !rows.length ? (
          <EmptyState message="لا سندات في هذه الفترة" />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th width="110px">رقم السند</Th>
                <Th width="85px">النوع</Th>
                <Th width="95px">التاريخ</Th>
                <Th>الطرف</Th>
                <Th width="110px">الطريقة</Th>
                <Th width="125px">الصندوق</Th>
                <Th align="left" width="115px">المبلغ</Th>
                <Th align="center" width="55px" />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const cancelled = v.status === "cancelled"
                const meta = VOUCHER_TYPE_META[v.type]
                return (
                  <Tr key={v.id} muted={cancelled}>
                    <Td mono className="text-xs">{v.voucherNo}</Td>
                    <Td><Badge label={meta.label} tint={meta.tint} /></Td>
                    <Td mono className="text-xs">{formatDate(v.date)}</Td>
                    <Td className={cancelled ? "line-through" : ""}>{v.partyName}</Td>
                    <Td className="text-xs text-muted-foreground">
                      {VOUCHER_METHOD_META[v.method]}
                      {v.reference && <div className="num text-[10px]">{v.reference}</div>}
                    </Td>
                    <Td className="text-xs text-muted-foreground">{v.cashAccountName}</Td>
                    <Td align="left">
                      <span className={v.type === "receipt" ? "text-success" : "text-danger"}>
                        {meta.sign} <Money value={v.amount} currency={currency} />
                      </span>
                    </Td>
                    <Td align="center">
                      {!cancelled && can("cancelDocument") ? (
                        <IconBtn icon={Ban} label="إلغاء السند" tone="danger"
                                 onClick={() => setCancelling(v)} />
                      ) : cancelled ? (
                        <Badge label="ملغى" tint="bg-muted text-muted-foreground" />
                      ) : null}
                    </Td>
                  </Tr>
                )
              })}
              <TotalRow>
                <Td colSpan={6}>صافي الحركة</Td>
                <Td align="left">
                  <Money value={totals.received - totals.paid} currency={currency} colored bold />
                </Td>
                <Td />
              </TotalRow>
            </tbody>
          </DataTable>
        )}
      </SectionCard>

      {creating && (
        <VoucherForm
          type={creating}
          onClose={() => setCreating(null)}
          onSaved={() => { vouchers.reload(); notify("تم حفظ السند") }}
        />
      )}

      <ConfirmDialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title="إلغاء السند"
        message="سيُنشأ قيد عكسي يلغي أثر السند على رصيد الطرف والصندوق. السند يبقى في السجل."
        confirmLabel="تأكيد الإلغاء"
        onConfirm={async () => {
          if (!cancelling) return
          await cancelVoucherAction(cancelling.id)
          vouchers.reload()
          notify("تم إلغاء السند")
        }}
      />
    </div>
  )
}

/* ── نموذج السند ──────────────────────────────────────────────── */

function VoucherForm({ type, onClose, onSaved }: {
  type: VoucherType
  onClose: () => void
  onSaved: () => void
}) {
  const { currency, company } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"
  const isReceipt = type === "receipt"

  const parties = useAsyncData(() => fetchPartiesAction("all"), [])
  const cash = useAsyncData(() => fetchCashAccountsAction(), [])

  const [partyId, setPartyId] = useState("")
  const [cashId, setCashId] = useState("")
  const [date, setDate] = useState(todayIn(tz))
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("cash")
  const [reference, setReference] = useState("")
  const [chequeDue, setChequeDue] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const defaultCash = cash.data?.find((c) => c.isDefault) ?? cash.data?.[0]
  const selectedCash = cashId || defaultCash?.id || ""
  const party = parties.data?.find((p) => p.id === partyId)

  // القبض من المدينين فقط، والصرف للدائنين فقط
  const eligible = useMemo(
    () => (parties.data ?? []).filter((p) =>
      p.isActive && (isReceipt ? p.balance > 0.009 : p.balance < -0.009)
    ),
    [parties.data, isReceipt]
  )

  const maxAmount = party ? Math.abs(party.balance) : 0

  const save = async () => {
    setError("")
    const value = Number(amount)
    if (!partyId)        { setError("اختر الطرف"); return }
    if (!(value > 0))    { setError("المبلغ يجب أن يكون أكبر من صفر"); return }
    if (!selectedCash)   { setError("اختر الصندوق أو البنك"); return }
    if (method === "cheque" && !reference.trim()) { setError("رقم الشيك مطلوب"); return }

    setBusy(true)
    try {
      await createVoucherAction({
        type, partyId, cashAccountId: selectedCash, date,
        amount: value,
        method: method as "cash" | "card" | "bank" | "cheque",
        reference,
        chequeDueDate: method === "cheque" ? chequeDue || undefined : undefined,
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
      open onClose={onClose}
      title={isReceipt ? "سند قبض" : "سند صرف"}
      description={isReceipt ? "قبض من زبون عليه رصيد" : "صرف لمورد له رصيد"}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn variant={isReceipt ? "success" : "primary"} onClick={save} loading={busy}>
            حفظ السند
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        {!parties.loading && !eligible.length && (
          <InlineError
            message={isReceipt
              ? "لا يوجد زبائن عليهم رصيد مستحق حالياً"
              : "لا يوجد موردون لهم رصيد مستحق حالياً"}
          />
        )}

        <Field label={isReceipt ? "الزبون" : "المورد"} required>
          <SelectInput value={partyId}
                       onChange={(e) => {
                         setPartyId(e.target.value)
                         const p = parties.data?.find((x) => x.id === e.target.value)
                         if (p) setAmount(Math.abs(p.balance).toFixed(2))
                       }}>
            <option value="">— اختر —</option>
            {eligible.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({Math.abs(p.balance).toFixed(2)})
              </option>
            ))}
          </SelectInput>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المبلغ" required
                 hint={party ? `المستحق ${maxAmount.toFixed(2)}` : undefined}>
            <NumberInput value={amount} onChange={(e) => setAmount(e.target.value)}
                         min={0} max={maxAmount || undefined} step="0.01" />
          </Field>
          <Field label="التاريخ" required>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)}
                       className="num" />
          </Field>
          <Field label={isReceipt ? "إلى صندوق" : "من صندوق"} required>
            <SelectInput value={selectedCash} onChange={(e) => setCashId(e.target.value)}>
              {(cash.data ?? []).filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="طريقة الدفع" required>
            <SelectInput value={method} onChange={(e) => setMethod(e.target.value)}>
              {Object.entries(VOUCHER_METHOD_META).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {(method === "cheque" || method === "bank") && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={method === "cheque" ? "رقم الشيك" : "رقم الحوالة"}
                   required={method === "cheque"}>
              <TextInput value={reference} onChange={(e) => setReference(e.target.value)}
                         dir="ltr" className="text-left num" />
            </Field>
            {method === "cheque" && (
              <Field label="تاريخ استحقاق الشيك">
                <TextInput type="date" value={chequeDue}
                           onChange={(e) => setChequeDue(e.target.value)} className="num" />
              </Field>
            )}
          </div>
        )}

        <Field label="ملاحظات">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
        </Field>

        {party && Number(amount) > 0 && (
          <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs flex justify-between">
            <span className="text-muted-foreground">رصيد {party.name} بعد السند</span>
            <Money
              value={isReceipt
                ? party.balance - Number(amount)
                : party.balance + Number(amount)}
              currency={currency} colored bold
            />
          </div>
        )}

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}

/* ================================================================ */
/* الصناديق والبنوك                                                  */
/* ================================================================ */

export function CashAccountsTab() {
  const { currency, company, can } = useSession()
  const { notify } = useToast()
  const tz = company?.timezone ?? "Asia/Hebron"

  const cash = useAsyncData(() => fetchCashAccountsAction(), [])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const total = (cash.data ?? []).filter((c) => c.isActive)
    .reduce((s, c) => s + c.balance, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="الصناديق والبنوك"
        subtitle="وين بتروح وبتيجي الفلوس فعلياً"
        actions={can("manageSettings") && (
          <Btn icon={Plus} onClick={() => setAdding(true)}>صندوق جديد</Btn>
        )}
      />

      <InfoNote>
        كل عملية نقدية — بيع، شراء، سند، مصروف — تُنسب لصندوق محدد. هذا ما يجعل
        الرصيد النقدي في الميزانية رقماً حقيقياً قابلاً للجرد، لا تقديراً.
      </InfoNote>

      {cash.loading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : cash.error ? (
        <InlineError message={cash.error} />
      ) : !cash.data?.length ? (
        <EmptyState message="لا صناديق" hint="أضف صندوقاً نقدياً أو حساباً بنكياً" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cash.data.map((acc) => {
              const meta = CASH_ACCOUNT_KIND_META[acc.kind]
              return (
                <div key={acc.id}
                     className={`surface p-4 ${!acc.isActive ? "opacity-55" : ""}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {acc.name}
                        {acc.isDefault && (
                          <Badge label="افتراضي" tint="bg-primary/12 text-primary" className="mr-2" />
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {meta.label}
                        {acc.accountNumber && <span className="num"> · {acc.accountNumber}</span>}
                      </p>
                    </div>
                    {can("manageSettings") && (
                      <IconBtn icon={Pencil} label="تعديل" onClick={() => setEditing(acc.id)} />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-0.5">الرصيد الحالي</p>
                  <Money value={acc.balance} currency={currency} bold colored
                         className="text-lg" />
                  {acc.openingBalance !== 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      افتتاحي <span className="num">{acc.openingBalance.toFixed(2)}</span>
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <SectionCard padded>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">إجمالي النقدية</span>
              <Money value={total} currency={currency} bold colored className="text-lg" />
            </div>
          </SectionCard>
        </>
      )}

      {(adding || editing) && (
        <CashAccountForm
          account={editing ? cash.data?.find((c) => c.id === editing) ?? null : null}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { cash.reload(); notify("تم الحفظ") }}
        />
      )}
    </div>
  )
}

function CashAccountForm({ account, onClose, onSaved }: {
  account: { id: string; name: string; kind: CashAccountKind; accountNumber: string;
             isDefault: boolean; isActive: boolean } | null
  onClose: () => void
  onSaved: () => void
}) {
  const { company } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"

  const [name, setName] = useState(account?.name ?? "")
  const [kind, setKind] = useState<CashAccountKind>(account?.kind ?? "cash")
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "")
  const [isDefault, setIsDefault] = useState(account?.isDefault ?? false)
  const [isActive, setIsActive] = useState(account?.isActive ?? true)
  const [opening, setOpening] = useState("")
  const [openingDate, setOpeningDate] = useState(todayIn(tz))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const save = async () => {
    setError("")
    if (!name.trim()) { setError("اسم الصندوق مطلوب"); return }

    setBusy(true)
    try {
      if (account) {
        await updateCashAccountAction(account.id, { name, accountNumber, isDefault, isActive })
      } else {
        await addCashAccountAction({
          name, kind, accountNumber, isDefault,
          openingBalance: Number(opening) || 0,
          openingDate,
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

  return (
    <Modal
      open onClose={onClose}
      title={account ? `تعديل: ${account.name}` : "صندوق جديد"}
      footer={<><Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
               <Btn onClick={save} loading={busy}>حفظ</Btn></>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)}
                       placeholder="الصندوق الرئيسي / بنك القدس" />
          </Field>
          <Field label="النوع" required>
            <SelectInput value={kind} onChange={(e) => setKind(e.target.value as CashAccountKind)}
                         disabled={!!account}>
              {Object.entries(CASH_ACCOUNT_KIND_META).map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {kind !== "cash" && (
          <Field label="رقم الحساب">
            <TextInput value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                       dir="ltr" className="text-left num" />
          </Field>
        )}

        {!account && (
          <div className="rounded-xl bg-muted/40 p-4 space-y-3">
            <InfoNote>
              الرصيد الافتتاحي يُسجَّل كقيد محاسبي مقابل حساب حقوق الملكية.
            </InfoNote>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="الرصيد الافتتاحي">
                <NumberInput value={opening} onChange={(e) => setOpening(e.target.value)}
                             step="0.01" placeholder="0.00" />
              </Field>
              <Field label="التاريخ">
                <TextInput type="date" value={openingDate}
                           onChange={(e) => setOpeningDate(e.target.value)} className="num" />
              </Field>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={isDefault}
                 onChange={(e) => setIsDefault(e.target.checked)}
                 className="size-4 accent-[var(--primary)]" />
          <span className="text-foreground/85">الصندوق الافتراضي للعمليات النقدية</span>
        </label>

        {account && (
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={isActive}
                   onChange={(e) => setIsActive(e.target.checked)}
                   className="size-4 accent-[var(--primary)]" />
            <span className="text-foreground/85">الصندوق نشط</span>
          </label>
        )}

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}

function fmt(v: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)
    + " " + ({ ILS: "₪", USD: "$", JOD: "د.أ", EUR: "€" }[currency] ?? "")
}
