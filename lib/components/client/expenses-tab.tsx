"use client"

// ================================================================
// المصروفات والإيرادات
// ================================================================
// كان القسمان غائبين تماماً عن النظام. كل سند هنا يُنشئ قيداً
// محاسبياً تلقائياً على الحساب المربوط بالتصنيف — فالمصروف يظهر
// في قائمة الأرباح والخسائر بلا أي خطوة يدوية.

import { useState, useMemo } from "react"
import { useSession, useAsyncData, resolvePreset, todayIn } from "@/lib/session"
import {
  fetchExpensesAction, createExpenseAction, cancelExpenseAction,
  fetchExpenseCategoriesAction, addExpenseCategoryAction, updateExpenseCategoryAction,
  fetchExpenseSummaryAction, fetchCashAccountsAction,
} from "@/app/actions/treasury"
import { fetchAccountsAction } from "@/app/actions/accounting"
import { fetchPartiesAction } from "@/app/actions/parties"
import {
  PageHeader, SectionCard, DataTable, Th, Td, Tr, TotalRow, Money, Badge,
  EmptyState, TableSkeleton, InlineError, InfoNote, Modal, ConfirmDialog,
  Field, TextInput, NumberInput, SelectInput, TextArea, SearchBox,
  DateRangePicker, StatCard, Btn, IconBtn, useToast,
  formatDate, exportToCsv,
} from "./ui"
import type { ExpenseKind, Expense } from "@/lib/types"
import {
  Plus, Ban, Download, Tags, TrendingDown, TrendingUp, Receipt,
} from "lucide-react"
import { describeError } from "@/lib/errors"

export function ExpensesTab({ kind }: { kind: ExpenseKind }) {
  const { currency, company, can } = useSession()
  const { notify } = useToast()
  const tz = company?.timezone ?? "Asia/Hebron"

  const isExpense = kind === "expense"
  const title = isExpense ? "المصروفات" : "الإيرادات الأخرى"
  const month = useMemo(() => resolvePreset("this-month", tz), [tz])

  const [range, setRange] = useState(month)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [managingCats, setManagingCats] = useState(false)
  const [cancelling, setCancelling] = useState<Expense | null>(null)

  const expenses = useAsyncData(
    () => fetchExpensesAction({ kind, from: range.from, to: range.to, limit: 500 }),
    [kind, range.from, range.to]
  )
  const summary = useAsyncData(
    () => (can("viewReports")
      ? fetchExpenseSummaryAction(kind, range.from, range.to)
      : Promise.resolve([])),
    [kind, range.from, range.to]
  )

  const rows = useMemo(() => {
    let list = expenses.data ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (e) =>
          e.voucherNo.toLowerCase().includes(q) ||
          e.categoryName.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.partyName.toLowerCase().includes(q)
      )
    }
    return list
  }, [expenses.data, search])

  const totals = useMemo(() => {
    const live = rows.filter((e) => e.status === "confirmed")
    return {
      count: live.length,
      amount: live.reduce((s, e) => s + e.amount, 0),
      tax: live.reduce((s, e) => s + e.taxAmount, 0),
      total: live.reduce((s, e) => s + e.total, 0),
    }
  }, [rows])

  const topCategory = summary.data?.[0]

  const handleExport = () => {
    exportToCsv(
      `${title}-${range.from}_${range.to}.csv`,
      ["رقم السند", "التاريخ", "التصنيف", "البيان", "الصندوق", "المبلغ", "الضريبة", "الإجمالي", "الحالة"],
      rows.map((e) => [
        e.voucherNo, e.date, e.categoryName, e.description, e.cashAccountName,
        e.amount.toFixed(2), e.taxAmount.toFixed(2), e.total.toFixed(2),
        e.status === "confirmed" ? "مؤكّد" : "ملغى",
      ])
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle={`${formatDate(range.from)} — ${formatDate(range.to)}`}
        actions={
          <>
            <Btn variant="outline" size="sm" icon={Download} onClick={handleExport}>تصدير</Btn>
            {can("manageSettings") && (
              <Btn variant="outline" size="sm" icon={Tags} onClick={() => setManagingCats(true)}>
                التصنيفات
              </Btn>
            )}
            {can("manageExpenses") && (
              <Btn icon={Plus} onClick={() => setCreating(true)}>
                {isExpense ? "سند مصروف" : "سند إيراد"}
              </Btn>
            )}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`إجمالي ${title}`}
          value={compact(totals.total, currency)}
          hint={`${totals.count} سند`}
          tone={isExpense ? "danger" : "success"}
          icon={isExpense ? TrendingDown : TrendingUp}
        />
        <StatCard
          label="قبل الضريبة"
          value={compact(totals.amount, currency)}
          icon={Receipt}
        />
        <StatCard
          label="الضريبة"
          value={compact(totals.tax, currency)}
          hint={isExpense ? "قابلة للخصم" : "مستحقة علينا"}
          icon={Receipt}
        />
        <StatCard
          label="أعلى تصنيف"
          value={topCategory ? compact(topCategory.total, currency) : "—"}
          hint={topCategory?.categoryName}
          icon={Tags}
        />
      </div>

      {/* ── التوزيع حسب التصنيف ── */}
      {can("viewReports") && !!summary.data?.length && (
        <SectionCard title="التوزيع حسب التصنيف" padded>
          <div className="space-y-2.5">
            {summary.data.map((s) => {
              const pct = totals.total > 0 ? (s.total / totals.total) * 100 : 0
              return (
                <div key={s.categoryName}>
                  <div className="flex items-center justify-between gap-3 text-xs mb-1">
                    <span className="text-foreground/85">{s.categoryName}</span>
                    <span className="shrink-0 flex items-center gap-2">
                      <span className="text-muted-foreground num">{pct.toFixed(0)}%</span>
                      <Money value={s.total} currency={currency} />
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={isExpense ? "h-full bg-danger/70" : "h-full bg-success/70"}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
          <DateRangePicker from={range.from} to={range.to}
                           onChange={(from, to) => setRange({ from, to })} />
          <div className="w-full sm:w-64">
            <SearchBox value={search} onChange={setSearch} placeholder="بحث بالتصنيف أو البيان…" />
          </div>
        </div>

        {expenses.error && <div className="px-5 pb-4"><InlineError message={expenses.error} /></div>}

        {expenses.loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : !rows.length ? (
          <EmptyState
            message={`لا ${isExpense ? "مصروفات" : "إيرادات"} في هذه الفترة`}
            hint={can("manageExpenses") ? "سجّل أول سند لتظهر في قائمة الأرباح والخسائر" : undefined}
            action={can("manageExpenses") &&
              <Btn size="sm" icon={Plus} onClick={() => setCreating(true)}>سند جديد</Btn>}
          />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th width="110px">رقم السند</Th>
                <Th width="95px">التاريخ</Th>
                <Th width="150px">التصنيف</Th>
                <Th>البيان</Th>
                <Th width="130px">الصندوق</Th>
                <Th align="left" width="110px">المبلغ</Th>
                <Th align="center" width="60px" />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const cancelled = e.status === "cancelled"
                return (
                  <Tr key={e.id} muted={cancelled}>
                    <Td mono className="text-xs">{e.voucherNo}</Td>
                    <Td mono className="text-xs">{formatDate(e.date)}</Td>
                    <Td>
                      <Badge label={e.categoryName || "—"}
                             tint={isExpense ? "bg-danger/10 text-danger" : "bg-success/10 text-success"} />
                    </Td>
                    <Td className={`text-xs ${cancelled ? "line-through" : ""}`}>
                      {e.description || "—"}
                      {e.partyName && (
                        <span className="mr-2 text-[10px] text-muted-foreground">{e.partyName}</span>
                      )}
                    </Td>
                    <Td className="text-xs text-muted-foreground">{e.cashAccountName}</Td>
                    <Td align="left">
                      <Money value={e.total} currency={currency} />
                      {e.taxAmount > 0 && (
                        <div className="text-[10px] text-muted-foreground num">
                          ضريبة {e.taxAmount.toFixed(2)}
                        </div>
                      )}
                    </Td>
                    <Td align="center">
                      {!cancelled && can("cancelDocument") && (
                        <IconBtn icon={Ban} label="إلغاء السند" tone="danger"
                                 onClick={() => setCancelling(e)} />
                      )}
                      {cancelled && <Badge label="ملغى" tint="bg-muted text-muted-foreground" />}
                    </Td>
                  </Tr>
                )
              })}
              <TotalRow>
                <Td colSpan={5}>الإجمالي المؤكّد ({totals.count})</Td>
                <Td align="left"><Money value={totals.total} currency={currency} /></Td>
                <Td />
              </TotalRow>
            </tbody>
          </DataTable>
        )}
      </SectionCard>

      {creating && (
        <ExpenseForm
          kind={kind}
          onClose={() => setCreating(false)}
          onSaved={() => { expenses.reload(); summary.reload(); notify("تم حفظ السند") }}
        />
      )}

      {managingCats && (
        <CategoriesModal kind={kind} onClose={() => setManagingCats(false)} />
      )}

      <ConfirmDialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title="إلغاء السند"
        message="سيتم إنشاء قيد عكسي يلغي أثر السند على الحسابات. السند نفسه يبقى في السجل ولا يُحذف."
        confirmLabel="تأكيد الإلغاء"
        onConfirm={async () => {
          if (!cancelling) return
          await cancelExpenseAction(cancelling.id)
          expenses.reload()
          summary.reload()
          notify("تم إلغاء السند")
        }}
      />
    </div>
  )
}

/* ================================================================ */
/* نموذج السند                                                       */
/* ================================================================ */

function ExpenseForm({ kind, onClose, onSaved }: {
  kind: ExpenseKind
  onClose: () => void
  onSaved: () => void
}) {
  const { currency, company } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"
  const isExpense = kind === "expense"

  const cats = useAsyncData(() => fetchExpenseCategoriesAction(kind), [kind])
  const cash = useAsyncData(() => fetchCashAccountsAction(), [])
  const parties = useAsyncData(() => fetchPartiesAction("all"), [])

  const [categoryId, setCategoryId] = useState("")
  const [cashId, setCashId] = useState("")
  const [partyId, setPartyId] = useState("")
  const [date, setDate] = useState(todayIn(tz))
  const [amount, setAmount] = useState("")
  const [withTax, setWithTax] = useState(false)
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const defaultCash = cash.data?.find((c) => c.isDefault) ?? cash.data?.[0]
  const selectedCash = cashId || defaultCash?.id || ""
  const vatRate = company?.vatRate ?? 16

  const net = Number(amount) || 0
  const tax = withTax ? Math.round(net * (vatRate / 100) * 100) / 100 : 0

  const save = async () => {
    setError("")
    if (!(net > 0))      { setError("المبلغ يجب أن يكون أكبر من صفر"); return }
    if (!categoryId)     { setError("اختر التصنيف"); return }
    if (!selectedCash)   { setError("اختر الصندوق أو البنك"); return }

    setBusy(true)
    try {
      await createExpenseAction({
        kind,
        categoryId,
        cashAccountId: selectedCash,
        partyId: partyId || null,
        date,
        amount: net,
        taxAmount: tax,
        description,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(describeError(e, "تعذّر حفظ السند"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isExpense ? "سند مصروف" : "سند إيراد"}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn onClick={save} loading={busy}>حفظ</Btn>
        </>
      }
    >
      <div className="space-y-4">
        {!cats.loading && !cats.data?.length && (
          <InlineError message="لا توجد تصنيفات. أضف تصنيفاً أولاً من زر «التصنيفات»." />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="التصنيف" required>
            <SelectInput value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— اختر —</option>
              {(cats.data ?? []).filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectInput>
          </Field>

          <Field label="التاريخ" required>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="num" />
          </Field>

          <Field label="المبلغ (قبل الضريبة)" required>
            <NumberInput value={amount} onChange={(e) => setAmount(e.target.value)}
                         min={0} step="0.01" autoFocus />
          </Field>

          <Field label={isExpense ? "من صندوق" : "إلى صندوق"} required>
            <SelectInput value={selectedCash} onChange={(e) => setCashId(e.target.value)}>
              {(cash.data ?? []).filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectInput>
          </Field>

          <Field label="جهة التعامل" hint="اختياري — للربط بمورد أو زبون">
            <SelectInput value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">— بدون —</option>
              {(parties.data ?? []).filter((p) => p.isActive).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {company?.vatEnabled && (
          <label className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={withTax}
              onChange={(e) => setWithTax(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            <span className="text-sm text-foreground">
              يشمل ضريبة قيمة مضافة <span className="num">{vatRate}%</span>
            </span>
          </label>
        )}

        <Field label="البيان">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="إيجار شهر آب، فاتورة كهرباء…" className="min-h-16" />
        </Field>

        {net > 0 && (
          <div className="rounded-lg bg-muted/50 px-3 py-2.5 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">المبلغ</span>
              <Money value={net} currency={currency} />
            </div>
            {tax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الضريبة</span>
                <Money value={tax} currency={currency} />
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-border font-semibold">
              <span>الإجمالي</span>
              <Money value={net + tax} currency={currency} bold />
            </div>
          </div>
        )}

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}

/* ================================================================ */
/* إدارة التصنيفات                                                   */
/* ================================================================ */

function CategoriesModal({ kind, onClose }: { kind: ExpenseKind; onClose: () => void }) {
  const { notify } = useToast()
  const isExpense = kind === "expense"

  const cats = useAsyncData(() => fetchExpenseCategoriesAction(kind), [kind])
  const accounts = useAsyncData(
    () => fetchAccountsAction({ type: isExpense ? "expense" : "revenue", postableOnly: true }),
    [isExpense]
  )

  const [name, setName] = useState("")
  const [accountId, setAccountId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const add = async () => {
    setError("")
    if (!name.trim())  { setError("اسم التصنيف مطلوب"); return }
    if (!accountId)    { setError("اربط التصنيف بحساب في دليل الحسابات"); return }

    setBusy(true)
    try {
      await addExpenseCategoryAction({ name, kind, accountId })
      setName(""); setAccountId("")
      cats.reload()
      notify("تمت الإضافة")
    } catch (e) {
      setError(describeError(e, "تعذّرت الإضافة"))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (id: string, isActive: boolean) => {
    await updateExpenseCategoryAction(id, { isActive: !isActive })
    cats.reload()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`تصنيفات ${isExpense ? "المصروفات" : "الإيرادات"}`}
      size="lg"
      footer={<Btn variant="ghost" onClick={onClose}>إغلاق</Btn>}
    >
      <div className="space-y-4">
        <InfoNote>
          كل تصنيف مربوط بحساب في دليل الحسابات. هذا الربط هو ما يجعل السند يظهر
          تلقائياً في مكانه الصحيح داخل قائمة الأرباح والخسائر.
        </InfoNote>

        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] items-end">
          <Field label="اسم التصنيف">
            <TextInput value={name} onChange={(e) => setName(e.target.value)}
                       placeholder="صيانة سيارات" />
          </Field>
          <Field label="الحساب المرتبط">
            <SelectInput value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— اختر —</option>
              {(accounts.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </SelectInput>
          </Field>
          <Btn icon={Plus} onClick={add} loading={busy}>إضافة</Btn>
        </div>

        {error && <InlineError message={error} />}

        <div className="surface overflow-hidden">
          {cats.loading ? (
            <TableSkeleton rows={4} cols={3} />
          ) : !cats.data?.length ? (
            <EmptyState message="لا تصنيفات بعد" />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <Th>التصنيف</Th>
                  <Th>الحساب</Th>
                  <Th align="center" width="90px">الحالة</Th>
                </tr>
              </thead>
              <tbody>
                {cats.data.map((c) => (
                  <Tr key={c.id} muted={!c.isActive}>
                    <Td className="text-sm">{c.name}</Td>
                    <Td className="text-xs text-muted-foreground num">{c.accountName}</Td>
                    <Td align="center">
                      <button
                        onClick={() => toggle(c.id, c.isActive)}
                        className="text-xs text-primary hover:underline"
                      >
                        {c.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
      </div>
    </Modal>
  )
}

function compact(v: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)
    + " " + ({ ILS: "₪", USD: "$", JOD: "د.أ", EUR: "€" }[currency] ?? "")
}
