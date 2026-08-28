"use client"

// ================================================================
// حسابي والإعدادات
// ================================================================

import { useState } from "react"
import { useSession, useAsyncData, todayIn } from "@/lib/session"
import {
  updateTenantProfileAction, lockPeriodAction,
  runIntegrityCheckAction, exportBackupAction, fetchAuditLogAction,
} from "@/app/actions/reports"
import {
  PageHeader, SectionCard, DataTable, Th, Td, Tr, Badge,
  EmptyState, TableSkeleton, InlineError, InfoNote, ConfirmDialog,
  Field, TextInput, NumberInput, SelectInput, TabBar, Btn,
  useToast, formatDate, formatDateTime, downloadFile,
} from "./ui"
import { DocumentSettings, NumberingSettings } from "./settings-documents"
import { CURRENCIES, PLAN_META, TENANT_STATUS_META } from "@/lib/constants"
import {
  Save, Download, ShieldCheck, Lock, Unlock, History,
  CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react"

type View = "company" | "documents" | "numbering" | "safety" | "audit"

export function SettingsTab() {
  const { can } = useSession()
  const [view, setView] = useState<View>("company")

  const tabs = [
    { id: "company" as const, label: "بيانات الشركة" },
    ...(can("manageSettings")
      ? [{ id: "documents" as const, label: "المستندات والطباعة" },
         { id: "numbering" as const, label: "الترقيم" }] : []),
    ...(can("manageBackup")
      ? [{ id: "safety" as const, label: "السلامة والنسخ الاحتياطي" }] : []),
    ...(can("manageUsers")
      ? [{ id: "audit" as const, label: "سجل التدقيق" }] : []),
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="حسابي والإعدادات" />
      <TabBar<View> tabs={tabs} active={view} onChange={setView} />
      {view === "company"   && <CompanySettings />}
      {view === "documents" && <DocumentSettings />}
      {view === "numbering" && <NumberingSettings />}
      {view === "safety"  && <SafetyPanel />}
      {view === "audit"   && <AuditLog />}
    </div>
  )
}

/* ================================================================ */
/* بيانات الشركة                                                     */
/* ================================================================ */

function CompanySettings() {
  const { company, refreshCompany, can } = useSession()
  const { notify } = useToast()

  const [form, setForm] = useState(() => ({
    name: company?.name ?? "",
    phone: company?.phone ?? "",
    address: company?.address ?? "",
    taxNumber: company?.taxNumber ?? "",
    logoUrl: company?.logoUrl ?? "",
    currency: company?.currency ?? "ILS",
    vatEnabled: company?.vatEnabled ?? false,
    vatRate: String(company?.vatRate ?? 16),
    timezone: company?.timezone ?? "Asia/Hebron",
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setError("")
    if (!form.name.trim()) { setError("اسم الشركة مطلوب"); return }

    setBusy(true)
    try {
      await updateTenantProfileAction({
        name: form.name,
        phone: form.phone,
        address: form.address,
        taxNumber: form.taxNumber,
        logoUrl: form.logoUrl,
        currency: form.currency,
        vatEnabled: form.vatEnabled,
        vatRate: Number(form.vatRate) || 0,
        timezone: form.timezone,
      })
      await refreshCompany()
      notify("تم حفظ الإعدادات")
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ")
    } finally {
      setBusy(false)
    }
  }

  if (!company) return <TableSkeleton rows={5} cols={2} />

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px] items-start">
      <SectionCard title="بيانات الشركة"
                   description="تظهر على الفواتير والتقارير المطبوعة" padded>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم النشاط التجاري" required>
              <TextInput value={form.name} onChange={(e) => set("name", e.target.value)}
                         disabled={!can("manageSettings")} />
            </Field>
            <Field label="الهاتف">
              <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)}
                         dir="ltr" className="text-left num"
                         disabled={!can("manageSettings")} />
            </Field>
            <Field label="العنوان">
              <TextInput value={form.address} onChange={(e) => set("address", e.target.value)}
                         disabled={!can("manageSettings")} />
            </Field>
            <Field label="الرقم الضريبي" hint="يظهر على الفاتورة الرسمية">
              <TextInput value={form.taxNumber} onChange={(e) => set("taxNumber", e.target.value)}
                         dir="ltr" className="text-left num"
                         disabled={!can("manageSettings")} />
            </Field>
            <Field label="رابط الشعار"
                   hint="رابط صورة مباشر — يظهر أعلى الفاتورة المطبوعة">
              <TextInput value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)}
                         dir="ltr" className="text-left" placeholder="https://…"
                         disabled={!can("manageSettings")} />
            </Field>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">العملة والضريبة</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="العملة"
                     hint="تغيير العملة يغيّر رمز العرض فقط ولا يحوّل المبالغ المسجّلة">
                <SelectInput value={form.currency} onChange={(e) => set("currency", e.target.value)}
                             disabled={!can("manageSettings")}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label} ({c.symbol})</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="المنطقة الزمنية"
                     hint="تحدد تاريخ اليوم في الفواتير — مهم لنقاط البيع الليلية">
                <SelectInput value={form.timezone} onChange={(e) => set("timezone", e.target.value)}
                             disabled={!can("manageSettings")}>
                  <option value="Asia/Hebron">فلسطين (Asia/Hebron)</option>
                  <option value="Asia/Amman">الأردن (Asia/Amman)</option>
                  <option value="Asia/Riyadh">السعودية (Asia/Riyadh)</option>
                  <option value="Asia/Dubai">الإمارات (Asia/Dubai)</option>
                </SelectInput>
              </Field>
            </div>

            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={form.vatEnabled}
                     onChange={(e) => set("vatEnabled", e.target.checked)}
                     disabled={!can("manageSettings")}
                     className="size-4 accent-[var(--primary)]" />
              <span className="text-foreground/85">الشركة مسجّلة في ضريبة القيمة المضافة</span>
            </label>

            {form.vatEnabled && (
              <Field label="نسبة الضريبة %" hint="النسبة في فلسطين 16%">
                <NumberInput value={form.vatRate} onChange={(e) => set("vatRate", e.target.value)}
                             min={0} max={100} step="0.01"
                             disabled={!can("manageSettings")} className="w-32" />
              </Field>
            )}
          </div>

          {error && <InlineError message={error} />}

          {can("manageSettings") && (
            <Btn icon={Save} onClick={save} loading={busy}>حفظ الإعدادات</Btn>
          )}
        </div>
      </SectionCard>

      <SectionCard title="الاشتراك" padded>
        <dl className="space-y-3 text-sm">
          <Row label="الخطة">
            <Badge label={PLAN_META[company.plan].label} tint={PLAN_META[company.plan].color} />
          </Row>
          <Row label="الحالة">
            <Badge label={TENANT_STATUS_META[company.status].label}
                   tint={TENANT_STATUS_META[company.status].color} />
          </Row>
          <Row label="تاريخ الانتهاء">
            <span className="num text-xs">{company.expiresAt ? formatDate(company.expiresAt) : "—"}</span>
          </Row>
          <Row label="أقصى عدد مستخدمين">
            <span className="num text-xs">{PLAN_META[company.plan].maxUsers}</span>
          </Row>
          <Row label="تاريخ التسجيل">
            <span className="num text-xs">{formatDate(company.createdAt)}</span>
          </Row>
        </dl>
      </SectionCard>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/* ================================================================ */
/* السلامة والنسخ الاحتياطي                                          */
/* ================================================================ */

function SafetyPanel() {
  const { company, refreshCompany } = useSession()
  const { notify } = useToast()

  const checks = useAsyncData(() => runIntegrityCheckAction(), [])
  const [lockDate, setLockDate] = useState(company?.lockedUntil ?? "")
  const [confirmLock, setConfirmLock] = useState(false)
  const [confirmUnlock, setConfirmUnlock] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const backup = async () => {
    setError("")
    setBusy(true)
    try {
      const { filename, json } = await exportBackupAction()
      downloadFile(filename, json)
      notify("تم تنزيل النسخة الاحتياطية")
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التصدير")
    } finally {
      setBusy(false)
    }
  }

  const ICONS = {
    "سليم": CheckCircle2,
    "تحذير": AlertTriangle,
    "خطأ": XCircle,
  } as const

  const TONES = {
    "سليم": "text-success",
    "تحذير": "text-warning",
    "خطأ": "text-danger",
  } as const

  const hasErrors = checks.data?.some((c) => c.status === "خطأ") ?? false

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      {/* ── فحص السلامة ── */}
      <SectionCard
        title="فحص سلامة الدفاتر"
        description="يتحقق أن كل قيد متوازن وأن الأرصدة تطابق حركاتها"
        action={
          <Btn size="sm" variant="ghost" icon={ShieldCheck} onClick={checks.reload}>
            إعادة الفحص
          </Btn>
        }
      >
        {checks.loading ? (
          <TableSkeleton rows={5} cols={2} />
        ) : checks.error ? (
          <div className="p-5"><InlineError message={checks.error} /></div>
        ) : (
          <ul className="divide-y divide-border">
            {(checks.data ?? []).map((c) => {
              const Icon = ICONS[c.status] ?? AlertTriangle
              return (
                <li key={c.checkName} className="flex items-start gap-3 px-5 py-3">
                  <Icon className={`size-4 shrink-0 mt-0.5 ${TONES[c.status] ?? ""}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{c.checkName}</p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>

      <div className="space-y-4">
        {/* ── النسخ الاحتياطي ── */}
        <SectionCard title="النسخة الاحتياطية"
                     description="تصدير كل بيانات الشركة كملف JSON واحد" padded>
          <InfoNote>
            النسخة تشمل الفواتير والقيود والأصناف وجهات التعامل وحركات المخزون.
            احتفظ بها خارج جهازك — نسخة على نفس الجهاز لا تحميك من عطل الجهاز.
          </InfoNote>
          <div className="mt-4">
            <Btn icon={Download} onClick={backup} loading={busy}>تنزيل نسخة احتياطية</Btn>
          </div>
          {error && <div className="mt-3"><InlineError message={error} /></div>}
        </SectionCard>

        {/* ── إقفال الفترة ── */}
        <SectionCard title="إقفال الفترة المحاسبية"
                     description="يمنع أي تسجيل أو تعديل قبل التاريخ المحدد" padded>
          {company?.lockedUntil ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 rounded-lg bg-muted px-3 py-2.5">
                <Lock className="size-4 text-muted-foreground" />
                <span className="text-sm">
                  مقفل حتى <strong className="num">{formatDate(company.lockedUntil)}</strong>
                </span>
              </div>
              <Btn variant="outline" size="sm" icon={Unlock}
                   onClick={() => setConfirmUnlock(true)}>
                فتح الفترة
              </Btn>
            </div>
          ) : (
            <div className="space-y-3">
              <InfoNote>
                بعد مراجعة حسابات فترة وإقفالها، لن يستطيع أحد — بمن فيهم المدير —
                تسجيل أو تعديل أي حركة بتاريخ سابق. هذا ما يحمي أرقاماً دُقّقت مسبقاً.
              </InfoNote>
              <Field label="إقفال حتى تاريخ">
                <TextInput type="date" value={lockDate}
                           onChange={(e) => setLockDate(e.target.value)}
                           max={todayIn(company?.timezone)} className="num w-44" />
              </Field>
              <Btn icon={Lock} onClick={() => setConfirmLock(true)} disabled={!lockDate}>
                إقفال الفترة
              </Btn>
              {hasErrors && (
                <InlineError message="لا يمكن الإقفال قبل إصلاح أخطاء فحص السلامة." />
              )}
            </div>
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        open={confirmLock}
        onClose={() => setConfirmLock(false)}
        title="إقفال الفترة المحاسبية"
        message={`سيُمنع تسجيل أو تعديل أي حركة بتاريخ ${lockDate} أو قبله. يمكن فتح الفترة لاحقاً، لكن الأفضل ألا تفعل بعد التدقيق.`}
        confirmLabel="إقفال"
        tone="primary"
        onConfirm={async () => {
          await lockPeriodAction(lockDate)
          await refreshCompany()
          notify("تم إقفال الفترة")
        }}
      />

      <ConfirmDialog
        open={confirmUnlock}
        onClose={() => setConfirmUnlock(false)}
        title="فتح الفترة"
        message="سيصبح بالإمكان التعديل على فترة سبق إقفالها. هذا إجراء استثنائي — سيُسجَّل في سجل التدقيق."
        confirmLabel="فتح"
        onConfirm={async () => {
          await lockPeriodAction(null)
          await refreshCompany()
          setLockDate("")
          notify("تم فتح الفترة")
        }}
      />
    </div>
  )
}

/* ================================================================ */
/* سجل التدقيق                                                       */
/* ================================================================ */

const TABLE_LABELS: Record<string, string> = {
  invoices: "الفواتير",
  payments: "السندات",
  expenses: "المصروفات",
  parties: "جهات التعامل",
  products: "الأصناف",
  tenant_users: "المستخدمون",
  tenants: "إعدادات الشركة",
}

const ACTION_LABELS: Record<string, { label: string; tint: string }> = {
  insert: { label: "إضافة", tint: "bg-success/10 text-success" },
  update: { label: "تعديل", tint: "bg-warning/15 text-warning" },
  delete: { label: "حذف", tint: "bg-danger/10 text-danger" },
}

function AuditLog() {
  const log = useAsyncData(() => fetchAuditLogAction({ limit: 300 }), [])

  return (
    <SectionCard
      title="سجل التدقيق"
      description="من عدّل ماذا ومتى — أهم من النسخة الاحتياطية عند الاشتباه"
    >
      {log.loading ? (
        <TableSkeleton rows={8} cols={4} />
      ) : log.error ? (
        <div className="p-5"><InlineError message={log.error} /></div>
      ) : !log.data?.length ? (
        <EmptyState message="لا سجلات بعد" icon={History} />
      ) : (
        <DataTable>
          <thead className="sticky-head">
            <tr>
              <Th width="150px">الوقت</Th>
              <Th width="140px">المستخدم</Th>
              <Th width="90px">الإجراء</Th>
              <Th>الجدول</Th>
            </tr>
          </thead>
          <tbody>
            {log.data.map((e) => {
              const action = ACTION_LABELS[e.action] ?? { label: e.action, tint: "bg-muted text-muted-foreground" }
              return (
                <Tr key={e.id}>
                  <Td mono className="text-xs">{formatDateTime(e.createdAt)}</Td>
                  <Td className="text-sm">{e.userName}</Td>
                  <Td><Badge label={action.label} tint={action.tint} /></Td>
                  <Td className="text-xs text-muted-foreground">
                    {TABLE_LABELS[e.tableName] ?? e.tableName}
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </DataTable>
      )}
    </SectionCard>
  )
}
