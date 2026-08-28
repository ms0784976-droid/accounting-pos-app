"use client"

// ================================================================
// المحاسبة — دليل الحسابات وقيود اليومية
// ================================================================
// هذا القسم كان غائباً تماماً. "دفتر الأستاذ" القديم كان مجرد دمج
// لقائمتي المشتريات والمبيعات يُحسب في المتصفح — بلا مدين ودائن
// وبلا حسابات. هنا القيد المزدوج حقيقي، والتوازن مفروض في قاعدة
// البيانات نفسها فلا يمكن حفظ قيد غير متوازن.

import { useState, useMemo } from "react"
import { useSession, useAsyncData, resolvePreset, todayIn } from "@/lib/session"
import {
  fetchAccountTreeAction, fetchAccountsAction, addAccountAction,
  deleteAccountAction,
  fetchJournalEntriesAction, fetchJournalEntryAction,
  createJournalEntryAction, reverseJournalEntryAction,
  fetchAccountLedgerAction,
} from "@/app/actions/accounting"
import { fetchPartiesAction } from "@/app/actions/parties"
import {
  PageHeader, SectionCard, DataTable, Th, Td, Tr, TotalRow, Money, Badge,
  EmptyState, TableSkeleton, InlineError, InfoNote, Modal, Drawer, ConfirmDialog,
  Field, TextInput, NumberInput, SelectInput, SearchBox, DateRangePicker,
  TabBar, Btn, IconBtn, useToast, formatDate, exportToCsv, printArea,
} from "./ui"
import { ACCOUNT_TYPE_META, JOURNAL_SOURCE_LABELS } from "@/lib/constants"
import type { Account, AccountType } from "@/lib/types"
import {
  Plus, Trash2, ChevronDown, ChevronLeft, Undo2,
  Download, Printer, ScrollText, Lock,
} from "lucide-react"

type View = "chart" | "journal"

export function AccountingTab() {
  const [view, setView] = useState<View>("chart")

  return (
    <div className="space-y-5">
      <PageHeader
        title="المحاسبة"
        subtitle="القيد المزدوج — التوازن مفروض على مستوى قاعدة البيانات"
      />
      <TabBar<View>
        tabs={[
          { id: "chart", label: "دليل الحسابات" },
          { id: "journal", label: "قيود اليومية" },
        ]}
        active={view}
        onChange={setView}
      />
      {view === "chart" ? <ChartOfAccounts /> : <JournalList />}
    </div>
  )
}

/* ================================================================ */
/* دليل الحسابات                                                     */
/* ================================================================ */

function ChartOfAccounts() {
  const { currency, can } = useSession()
  const { notify } = useToast()

  const tree = useAsyncData(() => fetchAccountTreeAction(), [])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const [ledgerFor, setLedgerFor] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const groups = useMemo(() => {
    const list = tree.data ?? []
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list
      .map((g) => ({
        ...g,
        children: g.children.filter(
          (c) => c.name.toLowerCase().includes(q) || c.code.includes(q)
        ),
      }))
      .filter((g) => g.children.length > 0 || g.name.toLowerCase().includes(q))
  }, [tree.data, search])

  // البحث يفتح المجموعات تلقائياً وإلا النتائج تبقى مخفية
  const expanded = search.trim() ? new Set(groups.map((g) => g.id)) : open

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <SearchBox value={search} onChange={setSearch} placeholder="رقم الحساب أو اسمه…" />
          </div>
          {can("manageJournal") && (
            <Btn size="sm" icon={Plus} onClick={() => setAdding(true)}>حساب فرعي</Btn>
          )}
        </div>

        {tree.error && <div className="px-5 pb-4"><InlineError message={tree.error} /></div>}

        {tree.loading ? (
          <TableSkeleton rows={8} cols={3} />
        ) : !groups.length ? (
          <EmptyState message="لا نتائج" />
        ) : (
          <div className="divide-y divide-border">
            {groups.map((g) => {
              const isOpen = expanded.has(g.id)
              const meta = ACCOUNT_TYPE_META[g.type]
              return (
                <div key={g.id}>
                  <button
                    onClick={() => toggle(g.id)}
                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-muted transition text-right"
                  >
                    {isOpen ? <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                            : <ChevronLeft className="size-4 text-muted-foreground shrink-0" />}
                    <span className="num text-xs text-muted-foreground w-12 shrink-0">{g.code}</span>
                    <span className="flex-1 text-sm font-medium text-foreground text-right">{g.name}</span>
                    <Badge label={meta.label} tint={meta.tint} />
                    <span className="w-32 text-left shrink-0">
                      <Money value={Math.abs(g.balance)} currency={currency} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="bg-muted/25">
                      {!g.children.length ? (
                        <p className="px-5 py-3 pr-14 text-xs text-muted-foreground">
                          لا حسابات فرعية
                        </p>
                      ) : (
                        g.children.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-3 px-5 py-2 pr-14 hover:bg-muted transition"
                          >
                            <span className="num text-xs text-muted-foreground w-12 shrink-0">{c.code}</span>
                            <button
                              onClick={() => setLedgerFor(c)}
                              className="flex-1 text-sm text-right hover:text-primary hover:underline"
                            >
                              {c.name}
                              {!c.isActive && (
                                <span className="mr-2 text-[10px] text-muted-foreground">(معطّل)</span>
                              )}
                            </button>
                            {c.systemKey && (
                              <span title="حساب نظامي يعتمد عليه الترحيل التلقائي">
                                <Lock className="size-3 text-muted-foreground/60" />
                              </span>
                            )}
                            <div className="flex items-center gap-0.5 w-16 justify-end shrink-0">
                              <IconBtn icon={ScrollText} label="دفتر الأستاذ"
                                       onClick={() => setLedgerFor(c)} />
                              {can("manageJournal") && !c.systemKey && (
                                <IconBtn icon={Trash2} label="حذف" tone="danger"
                                         onClick={() => setDeleting(c)} />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <InfoNote>
        الحسابات المقفلة <Lock className="inline size-3" /> نظامية — الترحيل التلقائي للفواتير
        والسندات يعتمد عليها، فلا يمكن حذفها. يمكنك إضافة حسابات فرعية خاصة بنشاطك بحرية.
      </InfoNote>

      {adding && (
        <AccountForm
          onClose={() => setAdding(false)}
          onSaved={() => { tree.reload(); notify("تمت إضافة الحساب") }}
        />
      )}

      {ledgerFor && (
        <AccountLedger account={ledgerFor} onClose={() => setLedgerFor(null)} />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف الحساب"
        message={deleting
          ? `حذف "${deleting.name}". إذا كانت عليه حركات محاسبية سيُرفض الحذف — يمكنك تعطيله بدلاً من ذلك.`
          : ""}
        confirmLabel="حذف"
        onConfirm={async () => {
          if (!deleting) return
          await deleteAccountAction(deleting.id)
          tree.reload()
          notify("تم حذف الحساب")
        }}
      />
    </div>
  )
}

function AccountForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const accounts = useAsyncData(() => fetchAccountsAction(), [])
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [type, setType] = useState<AccountType>("expense")
  const [parentId, setParentId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const groups = (accounts.data ?? []).filter((a) => a.isGroup && a.type === type)

  const save = async () => {
    setError("")
    if (!code.trim()) { setError("رقم الحساب مطلوب"); return }
    if (!name.trim()) { setError("اسم الحساب مطلوب"); return }

    setBusy(true)
    try {
      await addAccountAction({ code, name, type, parentId: parentId || null })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّرت الإضافة")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open onClose={onClose} title="حساب فرعي جديد"
      footer={<><Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
               <Btn onClick={save} loading={busy}>إضافة</Btn></>}
    >
      <div className="space-y-4">
        <InfoNote>
          اتبع ترقيم الدليل: الأصول 1xxx، الالتزامات 2xxx، حقوق الملكية 3xxx،
          الإيرادات 4xxx، المصروفات 5xxx و6xxx.
        </InfoNote>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رقم الحساب" required>
            <TextInput value={code} onChange={(e) => setCode(e.target.value)}
                       dir="ltr" className="text-left num" placeholder="6200" />
          </Field>
          <Field label="نوع الحساب" required>
            <SelectInput value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {(Object.keys(ACCOUNT_TYPE_META) as AccountType[]).map((t) => (
                <option key={t} value={t}>{ACCOUNT_TYPE_META[t].label}</option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <Field label="اسم الحساب" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)}
                     placeholder="مصاريف دعاية وإعلان" />
        </Field>

        <Field label="الحساب الأب">
          <SelectInput value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— بدون —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
            ))}
          </SelectInput>
        </Field>

        <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          الطبيعة: <strong className="text-foreground">
            {ACCOUNT_TYPE_META[type].normalSide === "debit" ? "مدينة" : "دائنة"}
          </strong>
        </div>

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}

/* ================================================================ */
/* دفتر أستاذ الحساب                                                 */
/* ================================================================ */

function AccountLedger({ account, onClose }: { account: Account; onClose: () => void }) {
  const { currency, company } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"
  const year = useMemo(() => resolvePreset("this-year", tz), [tz])
  const [range, setRange] = useState(year)

  const ledger = useAsyncData(
    () => fetchAccountLedgerAction(account.id, range.from, range.to),
    [account.id, range.from, range.to]
  )

  const handleExport = () => {
    if (!ledger.data) return
    exportToCsv(
      `دفتر-${account.code}-${account.name}.csv`,
      ["التاريخ", "رقم القيد", "البيان", "الطرف", "مدين", "دائن", "الرصيد"],
      ledger.data.rows.map((r) => [
        r.date, r.entryNo, r.description, r.partyName,
        r.debit.toFixed(2), r.credit.toFixed(2), r.running.toFixed(2),
      ])
    )
  }

  return (
    <Drawer
      open onClose={onClose}
      title={`دفتر الأستاذ: ${account.name}`}
      description={`${account.code} · ${ACCOUNT_TYPE_META[account.type].label}`}
      footer={
        <>
          <Btn variant="outline" size="sm" icon={Download} onClick={handleExport}>تصدير</Btn>
          <Btn variant="outline" size="sm" icon={Printer} onClick={printArea}>طباعة</Btn>
          <Btn variant="ghost" size="sm" onClick={onClose}>إغلاق</Btn>
        </>
      }
    >
      <div className="print-area">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <DateRangePicker from={range.from} to={range.to}
                           onChange={(from, to) => setRange({ from, to })} />
          {ledger.data && (
            <div className="text-left">
              <p className="text-[11px] text-muted-foreground">الرصيد المدوّر</p>
              <Money value={ledger.data.opening} currency={currency} colored bold />
            </div>
          )}
        </div>

        {ledger.loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : ledger.error ? (
          <div className="p-5"><InlineError message={ledger.error} /></div>
        ) : !ledger.data?.rows.length ? (
          <EmptyState message="لا حركات على هذا الحساب في الفترة" />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th width="95px">التاريخ</Th>
                <Th width="95px">رقم القيد</Th>
                <Th>البيان</Th>
                <Th align="left" width="100px">مدين</Th>
                <Th align="left" width="100px">دائن</Th>
                <Th align="left" width="115px">الرصيد</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.data.rows.map((r) => (
                <Tr key={r.id}>
                  <Td mono className="text-xs">{formatDate(r.date)}</Td>
                  <Td mono className="text-xs text-muted-foreground">{r.entryNo}</Td>
                  <Td className="text-xs">
                    {r.description || "—"}
                    {r.partyName && (
                      <span className="mr-2 text-[10px] text-muted-foreground">{r.partyName}</span>
                    )}
                  </Td>
                  <Td align="left">{r.debit ? <Money value={r.debit} currency={currency} /> : "—"}</Td>
                  <Td align="left">{r.credit ? <Money value={r.credit} currency={currency} /> : "—"}</Td>
                  <Td align="left"><Money value={r.running} currency={currency} colored /></Td>
                </Tr>
              ))}
              <TotalRow>
                <Td colSpan={3}>الإجمالي</Td>
                <Td align="left">
                  <Money value={ledger.data.rows.reduce((s, r) => s + r.debit, 0)} currency={currency} />
                </Td>
                <Td align="left">
                  <Money value={ledger.data.rows.reduce((s, r) => s + r.credit, 0)} currency={currency} />
                </Td>
                <Td align="left">
                  <Money value={ledger.data.rows[ledger.data.rows.length - 1]?.running ?? 0}
                         currency={currency} colored bold />
                </Td>
              </TotalRow>
            </tbody>
          </DataTable>
        )}
      </div>
    </Drawer>
  )
}

/* ================================================================ */
/* قيود اليومية                                                      */
/* ================================================================ */

function JournalList() {
  const { currency, company, can } = useSession()
  const { notify } = useToast()
  const tz = company?.timezone ?? "Asia/Hebron"
  const month = useMemo(() => resolvePreset("this-month", tz), [tz])

  const [range, setRange] = useState(month)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const entries = useAsyncData(
    () => fetchJournalEntriesAction({ from: range.from, to: range.to, limit: 300 }),
    [range.from, range.to]
  )

  const rows = useMemo(() => {
    let list = entries.data ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (e) => e.entryNo.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      )
    }
    return list
  }, [entries.data, search])

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker from={range.from} to={range.to}
                             onChange={(from, to) => setRange({ from, to })} />
            <div className="w-52">
              <SearchBox value={search} onChange={setSearch} placeholder="رقم القيد أو البيان…" />
            </div>
          </div>
          {can("manageJournal") && (
            <Btn size="sm" icon={Plus} onClick={() => setCreating(true)}>قيد يدوي</Btn>
          )}
        </div>

        {entries.error && <div className="px-5 pb-4"><InlineError message={entries.error} /></div>}

        {entries.loading ? (
          <TableSkeleton rows={7} cols={5} />
        ) : !rows.length ? (
          <EmptyState
            message="لا قيود في هذه الفترة"
            hint="القيود تُنشأ تلقائياً من الفواتير والسندات، ويمكن إضافة قيود يدوية"
          />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th width="100px">رقم القيد</Th>
                <Th width="95px">التاريخ</Th>
                <Th>البيان</Th>
                <Th width="130px">المصدر</Th>
                <Th align="left" width="120px">القيمة</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <Tr key={e.id} onClick={() => setDetailId(e.id)} muted={e.isReversal}>
                  <Td mono className="text-xs">{e.entryNo}</Td>
                  <Td mono className="text-xs">{formatDate(e.date)}</Td>
                  <Td className="text-sm">{e.description || "—"}</Td>
                  <Td>
                    <Badge
                      label={JOURNAL_SOURCE_LABELS[e.sourceType] ?? e.sourceType}
                      tint={e.sourceType === "manual"
                        ? "bg-violet-500/12 text-violet-700"
                        : "bg-muted text-muted-foreground"}
                    />
                    {e.isReversal && <Badge label="عكسي" tint="bg-danger/10 text-danger" className="mr-1" />}
                  </Td>
                  <Td align="left"><Money value={e.totalDebit} currency={currency} /></Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </SectionCard>

      {creating && (
        <JournalForm
          onClose={() => setCreating(false)}
          onSaved={() => { entries.reload(); notify("تم حفظ القيد") }}
        />
      )}

      {detailId && (
        <JournalDetail
          entryId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => { entries.reload(); notify("تم عكس القيد") }}
        />
      )}
    </div>
  )
}

/* ── تفاصيل القيد ─────────────────────────────────────────────── */

function JournalDetail({ entryId, onClose, onChanged }: {
  entryId: string
  onClose: () => void
  onChanged: () => void
}) {
  const { currency, company, can } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"
  const [reversing, setReversing] = useState(false)

  const entry = useAsyncData(() => fetchJournalEntryAction(entryId), [entryId])
  const d = entry.data
  const canReverse = d && !d.isReversal && d.sourceType === "manual" && can("manageJournal")

  return (
    <>
      <Drawer
        open onClose={onClose}
        title={d ? `القيد ${d.entryNo}` : "…"}
        description={d ? `${formatDate(d.date)} · ${JOURNAL_SOURCE_LABELS[d.sourceType] ?? d.sourceType}` : undefined}
        footer={
          <>
            {canReverse && (
              <Btn variant="danger" size="sm" icon={Undo2} onClick={() => setReversing(true)}>
                عكس القيد
              </Btn>
            )}
            <Btn variant="outline" size="sm" icon={Printer} onClick={printArea}>طباعة</Btn>
            <Btn variant="ghost" size="sm" onClick={onClose}>إغلاق</Btn>
          </>
        }
      >
        {entry.loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : !d ? (
          <EmptyState message="القيد غير موجود" />
        ) : (
          <div className="print-area">
            {d.sourceType !== "manual" && (
              <div className="p-5 pb-0">
                <InfoNote>
                  هذا القيد مولَّد تلقائياً من مستند. لتعديله ألغِ المستند نفسه —
                  عكس القيد وحده يترك المستند والمخزون بلا تطابق.
                </InfoNote>
              </div>
            )}

            <div className="p-5">
              <p className="text-sm text-foreground mb-4">{d.description}</p>

              <div className="surface overflow-hidden">
                <DataTable>
                  <thead>
                    <tr>
                      <Th width="70px">الرقم</Th>
                      <Th>الحساب</Th>
                      <Th align="left" width="115px">مدين</Th>
                      <Th align="left" width="115px">دائن</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l) => (
                      <Tr key={l.id}>
                        <Td mono className="text-xs text-muted-foreground">{l.accountCode}</Td>
                        <Td>
                          <div className="text-sm">{l.accountName}</div>
                          {(l.partyName || l.description) && (
                            <div className="text-[10px] text-muted-foreground">
                              {[l.partyName, l.description].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </Td>
                        <Td align="left">
                          {l.debit ? <Money value={l.debit} currency={currency} /> : "—"}
                        </Td>
                        <Td align="left">
                          {l.credit ? <Money value={l.credit} currency={currency} /> : "—"}
                        </Td>
                      </Tr>
                    ))}
                    <TotalRow>
                      <Td colSpan={2}>الإجمالي</Td>
                      <Td align="left"><Money value={d.totalDebit} currency={currency} bold /></Td>
                      <Td align="left"><Money value={d.totalCredit} currency={currency} bold /></Td>
                    </TotalRow>
                  </tbody>
                </DataTable>
              </div>

              <p className="mt-3 text-xs text-success">
                ✓ القيد متوازن — مدين {d.totalDebit.toFixed(2)} = دائن {d.totalCredit.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={reversing}
        onClose={() => setReversing(false)}
        title="عكس القيد"
        message="سيُنشأ قيد مضاد يلغي أثر هذا القيد. القيد الأصلي يبقى في الدفاتر كما هو — المحاسبة لا تُمحى."
        confirmLabel="عكس القيد"
        onConfirm={async () => {
          await reverseJournalEntryAction(entryId, todayIn(tz))
          onChanged()
          onClose()
        }}
      />
    </>
  )
}

/* ── القيد اليدوي ─────────────────────────────────────────────── */

interface DraftLine {
  key: string
  accountId: string
  partyId: string
  debit: string
  credit: string
  description: string
}

function JournalForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { currency, company } = useSession()
  const tz = company?.timezone ?? "Asia/Hebron"

  const accounts = useAsyncData(() => fetchAccountsAction({ postableOnly: true }), [])
  const parties = useAsyncData(() => fetchPartiesAction("all"), [])

  const [date, setDate] = useState(todayIn(tz))
  const [description, setDescription] = useState("")
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine(), newLine()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
    return {
      debit,
      credit,
      diff: Math.round((debit - credit) * 100) / 100,
    }
  }, [lines])

  const balanced = totals.diff === 0 && totals.debit > 0

  const save = async () => {
    setError("")
    setBusy(true)
    try {
      await createJournalEntryAction({
        date,
        description,
        lines: lines
          .filter((l) => l.accountId && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0))
          .map((l) => ({
            accountId: l.accountId,
            partyId: l.partyId || null,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description,
          })),
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ القيد")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open onClose={onClose} title="قيد يومية يدوي" size="xl"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn onClick={save} loading={busy} disabled={!balanced}>حفظ القيد</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <Field label="التاريخ" required>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)}
                       className="num" />
          </Field>
          <Field label="بيان القيد" required>
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)}
                       placeholder="تسوية رصيد، إثبات مصروف مستحق…" />
          </Field>
        </div>

        <div className="surface overflow-hidden">
          <DataTable>
            <thead>
              <tr>
                <Th>الحساب</Th>
                <Th width="150px">الطرف</Th>
                <Th align="left" width="115px">مدين</Th>
                <Th align="left" width="115px">دائن</Th>
                <Th width="40px" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-t border-border">
                  <Td>
                    <SelectInput
                      value={l.accountId}
                      onChange={(e) => update(l.key, { accountId: e.target.value })}
                      className="h-8 text-xs"
                    >
                      <option value="">— اختر الحساب —</option>
                      {(accounts.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </SelectInput>
                  </Td>
                  <Td>
                    <SelectInput
                      value={l.partyId}
                      onChange={(e) => update(l.key, { partyId: e.target.value })}
                      className="h-8 text-xs"
                    >
                      <option value="">—</option>
                      {(parties.data ?? []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </SelectInput>
                  </Td>
                  <Td>
                    <NumberInput
                      value={l.debit}
                      onChange={(e) => update(l.key, { debit: e.target.value, credit: "" })}
                      min={0} step="0.01" className="h-8"
                    />
                  </Td>
                  <Td>
                    <NumberInput
                      value={l.credit}
                      onChange={(e) => update(l.key, { credit: e.target.value, debit: "" })}
                      min={0} step="0.01" className="h-8"
                    />
                  </Td>
                  <Td align="center">
                    {lines.length > 2 && (
                      <IconBtn icon={Trash2} label="حذف السطر" tone="danger"
                               onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
                    )}
                  </Td>
                </tr>
              ))}
              <TotalRow>
                <Td colSpan={2}>الإجمالي</Td>
                <Td align="left"><Money value={totals.debit} currency={currency} bold /></Td>
                <Td align="left"><Money value={totals.credit} currency={currency} bold /></Td>
                <Td />
              </TotalRow>
            </tbody>
          </DataTable>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Btn size="sm" variant="ghost" icon={Plus}
               onClick={() => setLines((ls) => [...ls, newLine()])}>
            إضافة سطر
          </Btn>

          {totals.debit > 0 || totals.credit > 0 ? (
            balanced ? (
              <p className="text-xs text-success font-medium">✓ القيد متوازن</p>
            ) : (
              <p className="text-xs text-danger font-medium">
                غير متوازن — الفرق <span className="num">{Math.abs(totals.diff).toFixed(2)}</span>
                {totals.diff > 0 ? " ينقص من الدائن" : " ينقص من المدين"}
              </p>
            )
          ) : null}
        </div>

        <InfoNote>
          كل سطر إما مدين أو دائن — لا الاثنان معاً. قاعدة البيانات ترفض أي قيد
          غير متوازن حتى لو تجاوزت هذه الشاشة.
        </InfoNote>

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}

function newLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    accountId: "", partyId: "", debit: "", credit: "", description: "",
  }
}
