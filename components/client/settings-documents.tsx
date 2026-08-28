"use client"

// ================================================================
// إعدادات المستندات والطباعة والافتراضيات والترقيم
// ================================================================

import { useState } from "react"
import { useAsyncData } from "@/lib/session"
import {
  fetchTenantSettingsAction, updateTenantSettingsAction,
  fetchNumberSequencesAction, updateNumberSequenceAction,
  type PrintSettings, type DefaultSettings, type AlertSettings, type NumberSequence,
} from "@/app/actions/settings"
import { fetchCashAccountsAction } from "@/app/actions/treasury"
import {
  SectionCard, DataTable, Th, Td, Tr, InlineError, InfoNote, Modal,
  Field, TextInput, NumberInput, SelectInput, TextArea, Btn, IconBtn,
  EmptyState, TableSkeleton, useToast,
} from "./ui"
import { Save, Pencil } from "lucide-react"

/* ================================================================ */
/* المستندات والطباعة                                                */
/* ================================================================ */

export function DocumentSettings() {
  const { notify } = useToast()
  const settings = useAsyncData(() => fetchTenantSettingsAction(), [])

  if (settings.loading) return <TableSkeleton rows={6} cols={2} />
  if (settings.error) return <InlineError message={settings.error} />
  if (!settings.data) return null

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <PrintCard
        initial={settings.data.print}
        onSaved={() => { settings.reload(); notify("تم حفظ إعدادات الطباعة") }}
      />
      <div className="space-y-4">
        <DefaultsCard
          initial={settings.data.defaults}
          onSaved={() => { settings.reload(); notify("تم حفظ الافتراضيات") }}
        />
        <AlertsCard
          initial={settings.data.alerts}
          onSaved={() => { settings.reload(); notify("تم حفظ التنبيهات") }}
        />
      </div>
    </div>
  )
}

function PrintCard({ initial, onSaved }: {
  initial: PrintSettings
  onSaved: () => void
}) {
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const set = <K extends keyof PrintSettings>(k: K, v: PrintSettings[K]) =>
    setF((x) => ({ ...x, [k]: v }))

  const save = async () => {
    setError("")
    setBusy(true)
    try {
      await updateTenantSettingsAction({ print: f })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ")
    } finally {
      setBusy(false)
    }
  }

  const thermal = f.paperSize === "thermal80"

  return (
    <SectionCard title="الطباعة" description="شكل الفاتورة المطبوعة" padded>
      <div className="space-y-4">
        <Field label="حجم الورق"
               hint={thermal ? "الطابعة الحرارية تخفي التوقيعات والتفقيط تلقائياً" : undefined}>
          <SelectInput value={f.paperSize}
                       onChange={(e) => set("paperSize", e.target.value as PrintSettings["paperSize"])}>
            <option value="a4">A4 — فاتورة رسمية</option>
            <option value="thermal80">حرارية 80mm — نقاط البيع</option>
          </SelectInput>
        </Field>

        <div className="space-y-2.5">
          <Toggle label="إظهار شعار الشركة" checked={f.showLogo}
                  onChange={(v) => set("showLogo", v)} />
          <Toggle label="إظهار المبلغ كتابةً (التفقيط)" checked={f.showAmountInWords}
                  onChange={(v) => set("showAmountInWords", v)} disabled={thermal} />
          <Toggle label="إظهار خانات التوقيع" checked={f.showSignatures}
                  onChange={(v) => set("showSignatures", v)} disabled={thermal} />
        </div>

        <Field label="نص التذييل" hint="يظهر أسفل كل فاتورة">
          <TextInput value={f.footerText} onChange={(e) => set("footerText", e.target.value)}
                     placeholder="شكراً لتعاملكم معنا" />
        </Field>

        <Field label="الشروط والأحكام" hint="نص قصير يظهر على الفاتورة">
          <TextArea value={f.termsText} onChange={(e) => set("termsText", e.target.value)}
                    placeholder="البضاعة المباعة لا تُرد ولا تُستبدل بعد 3 أيام"
                    className="min-h-16" />
        </Field>

        <Field label="عدد النسخ" hint="مثلاً: نسخة للزبون ونسخة للمحل">
          <NumberInput value={String(f.copies)}
                       onChange={(e) => set("copies", Number(e.target.value) || 1)}
                       min={1} max={5} className="w-24" />
        </Field>

        {error && <InlineError message={error} />}
        <Btn icon={Save} onClick={save} loading={busy}>حفظ</Btn>
      </div>
    </SectionCard>
  )
}

function DefaultsCard({ initial, onSaved }: {
  initial: DefaultSettings
  onSaved: () => void
}) {
  const cash = useAsyncData(() => fetchCashAccountsAction(), [])
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const set = <K extends keyof DefaultSettings>(k: K, v: DefaultSettings[K]) =>
    setF((x) => ({ ...x, [k]: v }))

  const save = async () => {
    setError("")
    setBusy(true)
    try {
      await updateTenantSettingsAction({ defaults: f })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ")
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard title="الافتراضيات التشغيلية"
                 description="تُطبَّق على الشاشات الجديدة لتقليل النقرات" padded>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="طريقة الدفع الافتراضية">
            <SelectInput value={f.paymentMethod}
                         onChange={(e) => set("paymentMethod", e.target.value as DefaultSettings["paymentMethod"])}>
              <option value="cash">نقدي</option>
              <option value="card">بطاقة</option>
              <option value="credit">آجل</option>
            </SelectInput>
          </Field>

          <Field label="الصندوق الافتراضي">
            <SelectInput value={f.cashAccountId ?? ""}
                         onChange={(e) => set("cashAccountId", e.target.value || null)}>
              <option value="">— الصندوق المعلَّم كافتراضي —</option>
              {(cash.data ?? []).filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <Field label="عدد المنازل العشرية" hint="الدينار الأردني يحتاج 3، والشيقل 2">
          <NumberInput value={String(f.decimals)}
                       onChange={(e) => set("decimals", Number(e.target.value) || 0)}
                       min={0} max={3} className="w-24" />
        </Field>

        <div className="space-y-2.5">
          <Toggle
            label="تطبيق الضريبة تلقائياً على الأصناف الجديدة"
            checked={f.applyTaxOnNewProducts}
            onChange={(v) => set("applyTaxOnNewProducts", v)}
          />
          <Toggle
            label="إلزام تحديد الزبون في كل فاتورة بيع"
            checked={f.requirePartyOnSale}
            onChange={(v) => set("requirePartyOnSale", v)}
            hint="يمنع البيع باسم «زبون نقدي» — مفيد لمن يريد كشف حساب لكل عملية"
          />
          <Toggle
            label="السماح بالبيع عند نفاد الرصيد"
            checked={f.allowNegativeStock}
            onChange={(v) => set("allowNegativeStock", v)}
            hint="يُنتج رصيداً سالباً يحتاج تسوية بجرد. اتركه مغلقاً إن أمكن"
          />
        </div>

        {error && <InlineError message={error} />}
        <Btn icon={Save} onClick={save} loading={busy}>حفظ</Btn>
      </div>
    </SectionCard>
  )
}

function AlertsCard({ initial, onSaved }: {
  initial: AlertSettings
  onSaved: () => void
}) {
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await updateTenantSettingsAction({ alerts: f })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard title="التنبيهات" padded>
      <div className="space-y-2.5">
        <Toggle label="تنبيه المخزون تحت الحد الأدنى" checked={f.lowStock}
                onChange={(v) => setF((x) => ({ ...x, lowStock: v }))} />
        <Toggle label="تنبيه الفواتير الآجلة المتأخرة" checked={f.overdueInvoices}
                onChange={(v) => setF((x) => ({ ...x, overdueInvoices: v }))} />
        <Toggle label="تنبيه قرب انتهاء الاشتراك" checked={f.subscriptionExpiry}
                onChange={(v) => setF((x) => ({ ...x, subscriptionExpiry: v }))} />
      </div>
      <div className="mt-4">
        <Btn icon={Save} onClick={save} loading={busy} size="sm">حفظ</Btn>
      </div>
    </SectionCard>
  )
}

/* ================================================================ */
/* ترقيم المستندات                                                   */
/* ================================================================ */

export function NumberingSettings() {
  const { notify } = useToast()
  const seqs = useAsyncData(() => fetchNumberSequencesAction(), [])
  const [editing, setEditing] = useState<NumberSequence | null>(null)

  return (
    <div className="space-y-4">
      <InfoNote>
        البادئة ورقم البداية قابلان للتعديل، لكن <strong>لا يمكن إرجاع العدّاد للخلف</strong> —
        رقم مستخدَم مسبقاً يعني فاتورتين بنفس الرقم، وهذا يُبطل التسلسل ويربك أي تدقيق.
      </InfoNote>

      <SectionCard title="ترقيم المستندات">
        {seqs.loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : seqs.error ? (
          <div className="p-5"><InlineError message={seqs.error} /></div>
        ) : !seqs.data?.length ? (
          <EmptyState message="لا سلاسل ترقيم" />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th>نوع المستند</Th>
                <Th width="100px">البادئة</Th>
                <Th align="left" width="110px">الرقم القادم</Th>
                <Th width="130px">المعاينة</Th>
                <Th align="left" width="90px">صادر</Th>
                <Th align="center" width="55px" />
              </tr>
            </thead>
            <tbody>
              {seqs.data.map((s) => (
                <Tr key={s.docType}>
                  <Td className="text-sm">{s.label}</Td>
                  <Td mono className="text-xs">{s.prefix || "—"}</Td>
                  <Td align="left" mono>{s.nextNumber}</Td>
                  <Td mono className="text-xs text-primary">{s.preview}</Td>
                  <Td align="left" mono className="text-xs text-muted-foreground">
                    {s.usedCount}
                  </Td>
                  <Td align="center">
                    <IconBtn icon={Pencil} label="تعديل" onClick={() => setEditing(s)} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </SectionCard>

      {editing && (
        <SequenceForm
          seq={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { seqs.reload(); notify("تم تحديث الترقيم") }}
        />
      )}
    </div>
  )
}

function SequenceForm({ seq, onClose, onSaved }: {
  seq: NumberSequence
  onClose: () => void
  onSaved: () => void
}) {
  const [prefix, setPrefix] = useState(seq.prefix)
  const [next, setNext] = useState(String(seq.nextNumber))
  const [padding, setPadding] = useState(String(seq.padding))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const pad = Math.min(Math.max(Number(padding) || 1, 1), 10)
  const preview = prefix + String(Number(next) || 1).padStart(pad, "0")
  const goingBack = Number(next) < seq.nextNumber

  const save = async () => {
    setError("")
    setBusy(true)
    try {
      await updateNumberSequenceAction({
        docType: seq.docType,
        prefix,
        nextNumber: Number(next),
        padding: pad,
      })
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
      title={`ترقيم ${seq.label}`}
      description={`صدر منها ${seq.usedCount} مستند`}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn onClick={save} loading={busy} disabled={goingBack}>حفظ</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="البادئة" hint="بلا مسافات">
            <TextInput value={prefix} onChange={(e) => setPrefix(e.target.value)}
                       dir="ltr" className="text-left num" placeholder="INV-" maxLength={10} />
          </Field>
          <Field label="الرقم القادم">
            <NumberInput value={next} onChange={(e) => setNext(e.target.value)} min={1} />
          </Field>
          <Field label="عدد الخانات">
            <NumberInput value={padding} onChange={(e) => setPadding(e.target.value)}
                         min={1} max={10} />
          </Field>
        </div>

        <div className="rounded-lg bg-muted/50 px-3 py-3 text-center">
          <p className="text-[11px] text-muted-foreground mb-1">المستند القادم سيحمل الرقم</p>
          <p className="text-lg font-semibold num text-primary">{preview}</p>
        </div>

        {goingBack && (
          <InlineError
            message={`لا يمكن إرجاع العدّاد إلى ${next} لأن الرقم الحالي ${seq.nextNumber}. اختر رقماً أكبر أو مساوياً.`}
          />
        )}

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}

/* ================================================================ */

function Toggle({ label, checked, onChange, hint, disabled }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
  disabled?: boolean
}) {
  return (
    <label className={`flex items-start gap-2.5 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 mt-0.5 shrink-0 accent-[var(--primary)]"
      />
      <span>
        <span className="text-sm text-foreground/85">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>}
      </span>
    </label>
  )
}
