"use client"

// ================================================================
// المستخدمون والصلاحيات
// ================================================================
// الصلاحيات هنا وصف لما يُفرض على السيرفر، لا مصدره. حتى لو تجاوز
// أحد هذه الشاشة، كل Server Action يفحص الدور بنفسه قبل التنفيذ.

import { useState, useMemo } from "react"
import { useSession, useAsyncData } from "@/lib/session"
import {
  fetchTenantUsersAction, addTenantUserAction, updateTenantUserAction,
  toggleTenantUserStatusAction, deleteTenantUserAction,
} from "@/app/actions/client-data"
import {
  PageHeader, SectionCard, DataTable, Th, Td, Tr, Badge,
  EmptyState, TableSkeleton, InlineError, InfoNote, Modal, ConfirmDialog,
  Field, TextInput, SelectInput, SearchBox, StatCard, Btn, IconBtn,
  useToast, formatDate,
} from "./ui"
import { ROLE_META, PLAN_META, ROLE_TABS, TAB_LABELS } from "@/lib/constants"
import type { ClientRole, TenantUser } from "@/lib/types"
import { resetUserPasswordAction } from "@/app/actions/account"
import { Plus, Pencil, Trash2, UserCog, ShieldCheck, Snowflake, Play, KeyRound } from "lucide-react"
import { describeError } from "@/lib/errors"

export function UsersTab() {
  const { company, user, can } = useSession()
  const { notify } = useToast()

  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<TenantUser | null>(null)
  const [deleting, setDeleting] = useState<TenantUser | null>(null)
  const [resetting, setResetting] = useState<TenantUser | null>(null)

  const users = useAsyncData(() => fetchTenantUsersAction(), [])

  const rows = useMemo(() => {
    let list = users.data ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
    }
    return list
  }, [users.data, search])

  const maxUsers = company ? PLAN_META[company.plan].maxUsers : 3
  const activeCount = (users.data ?? []).filter((u) => u.status === "active").length
  const atLimit = (users.data?.length ?? 0) >= maxUsers

  const toggle = async (u: TenantUser) => {
    try {
      await toggleTenantUserStatusAction(u.id, u.status)
      users.reload()
      notify(u.status === "active" ? "تم تجميد المستخدم" : "تم تفعيل المستخدم")
    } catch (e) {
      notify(describeError(e, "تعذّر التنفيذ"), "error")
    }
  }

  if (!can("manageUsers")) {
    return (
      <EmptyState
        icon={UserCog}
        message="إدارة المستخدمين متاحة لمدير النظام فقط"
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="المستخدمون"
        subtitle="كل مستخدم بحساب دخول مستقل ودور محدد"
        actions={
          <Btn icon={Plus} onClick={() => setCreating(true)} disabled={atLimit}>
            مستخدم جديد
          </Btn>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <StatCard label="المستخدمون" value={`${users.data?.length ?? 0} / ${maxUsers}`}
                  hint={company ? `خطة ${PLAN_META[company.plan].label}` : undefined}
                  tone={atLimit ? "warning" : "neutral"} icon={UserCog} />
        <StatCard label="نشطون" value={String(activeCount)} icon={ShieldCheck} />
        <StatCard label="مجمّدون"
                  value={String((users.data?.length ?? 0) - activeCount)}
                  icon={Snowflake} />
      </div>

      {atLimit && (
        <InlineError message={`بلغت الحد الأقصى لخطتك (${maxUsers} مستخدمين). رقّ خطتك لإضافة المزيد.`} />
      )}

      <SectionCard>
        <div className="px-5 pt-4 pb-3">
          <div className="w-full sm:w-72">
            <SearchBox value={search} onChange={setSearch} placeholder="الاسم أو اسم المستخدم…" />
          </div>
        </div>

        {users.error && <div className="px-5 pb-4"><InlineError message={users.error} /></div>}

        {users.loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : !rows.length ? (
          <EmptyState message="لا مستخدمين" />
        ) : (
          <DataTable>
            <thead className="sticky-head">
              <tr>
                <Th>الاسم</Th>
                <Th width="140px">اسم المستخدم</Th>
                <Th width="130px">الدور</Th>
                <Th width="90px">الحالة</Th>
                <Th width="100px">أُضيف</Th>
                <Th align="center" width="110px">إجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSelf = u.email === user.email
                const meta = ROLE_META[u.role]
                return (
                  <Tr key={u.id} muted={u.status !== "active"}>
                    <Td>
                      <div className="text-sm font-medium">
                        {u.name}
                        {isSelf && (
                          <span className="mr-2 text-[10px] text-primary">(أنت)</span>
                        )}
                      </div>
                      {u.email && (
                        <div className="text-[10px] text-muted-foreground" dir="ltr"
                             style={{ textAlign: "right" }}>{u.email}</div>
                      )}
                    </Td>
                    <Td mono className="text-xs text-muted-foreground">{u.username}</Td>
                    <Td>
                      <Badge label={meta.label} tint={meta.tint} />
                      <div className="text-[10px] text-muted-foreground mt-0.5">{meta.hint}</div>
                    </Td>
                    <Td>
                      <Badge
                        label={u.status === "active" ? "نشط" : "مجمّد"}
                        tint={u.status === "active"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"}
                      />
                    </Td>
                    <Td mono className="text-xs">{formatDate(u.createdAt)}</Td>
                    <Td align="center">
                      <div className="flex items-center justify-center gap-0.5">
                        <IconBtn icon={Pencil} label="تعديل" onClick={() => setEditing(u)} />
                        {!isSelf && (
                          <>
                            <IconBtn icon={KeyRound} label="إعادة تعيين كلمة المرور"
                                     onClick={() => setResetting(u)} />
                            <IconBtn
                              icon={u.status === "active" ? Snowflake : Play}
                              label={u.status === "active" ? "تجميد" : "تفعيل"}
                              onClick={() => toggle(u)}
                            />
                            <IconBtn icon={Trash2} label="حذف" tone="danger"
                                     onClick={() => setDeleting(u)} />
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </DataTable>
        )}
      </SectionCard>

      <RolesLegend />

      {(creating || editing) && (
        <UserForm
          user={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { users.reload(); notify("تم الحفظ") }}
        />
      )}

      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={() => notify("تم تعيين كلمة مرور جديدة")}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف المستخدم"
        message={deleting
          ? `سيُحذف "${deleting.name}" وحساب دخوله نهائياً. الحركات التي سجّلها تبقى في الدفاتر وسجل التدقيق.`
          : ""}
        confirmLabel="حذف"
        onConfirm={async () => {
          if (!deleting) return
          await deleteTenantUserAction(deleting.id)
          users.reload()
          notify("تم حذف المستخدم")
        }}
      />
    </div>
  )
}

/* ── نموذج المستخدم ───────────────────────────────────────────── */

function UserForm({ user, onClose, onSaved }: {
  user: TenantUser | null
  onClose: () => void
  onSaved: () => void
}) {
  const { user: current } = useSession()

  const [name, setName] = useState(user?.name ?? "")
  const [username, setUsername] = useState(user?.username ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [role, setRole] = useState<ClientRole>(user?.role ?? "cashier")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const isSelf = user?.email === current.email

  const save = async () => {
    setError("")
    if (!name.trim())     { setError("الاسم مطلوب"); return }
    if (!username.trim()) { setError("اسم المستخدم مطلوب"); return }

    if (!user) {
      if (!email.includes("@"))  { setError("البريد الإلكتروني غير صالح"); return }
      if (password.length < 8)   { setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return }
    }

    setBusy(true)
    try {
      if (user) {
        await updateTenantUserAction(user.id, {
          name, username, email,
          ...(isSelf ? {} : { role }),
        })
      } else {
        await addTenantUserAction({
          tenantId: "",           // يُشتق من الجلسة على السيرفر
          name, username, email, role,
          tempPassword: password,
        })
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(describeError(e, "تعذّر الحفظ"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open onClose={onClose}
      title={user ? `تعديل: ${user.name}` : "مستخدم جديد"}
      footer={<><Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
               <Btn onClick={save} loading={busy}>حفظ</Btn></>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم الكامل" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="اسم المستخدم" required hint="يُستخدم لتسجيل الدخول">
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)}
                       dir="ltr" className="text-left" />
          </Field>
        </div>

        <Field label="البريد الإلكتروني" required={!user}>
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     dir="ltr" className="text-left" disabled={!!user} />
        </Field>

        {!user && (
          <Field label="كلمة المرور المؤقتة" required
                 hint="8 أحرف على الأقل — بلّغها للمستخدم واطلب منه تغييرها">
            <TextInput type="text" value={password} onChange={(e) => setPassword(e.target.value)}
                       dir="ltr" className="text-left" />
          </Field>
        )}

        <Field
          label="الدور"
          required
          hint={isSelf ? "لا يمكنك تغيير صلاحياتك بنفسك" : ROLE_META[role].hint}
        >
          <SelectInput value={role} onChange={(e) => setRole(e.target.value as ClientRole)}
                       disabled={isSelf}>
            {(Object.keys(ROLE_META) as ClientRole[]).map((r) => (
              <option key={r} value={r}>{ROLE_META[r].label}</option>
            ))}
          </SelectInput>
        </Field>

        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground mb-1.5">الشاشات المتاحة لهذا الدور</p>
          <div className="flex flex-wrap gap-1">
            {ROLE_TABS[role].map((t) => (
              <span key={t} className="rounded bg-card border border-border px-1.5 py-0.5 text-[10px]">
                {TAB_LABELS[t]}
              </span>
            ))}
          </div>
        </div>

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}

/* ── شرح الأدوار ──────────────────────────────────────────────── */

function RolesLegend() {
  return (
    <SectionCard title="الأدوار والصلاحيات" padded>
      <InfoNote>
        إخفاء الشاشة في الواجهة ليس حماية. كل عملية تُفحص على السيرفر أيضاً،
        فلا يمكن لكاشير تنفيذ إجراء محاسبي حتى لو وصل لرابطه.
      </InfoNote>
      <div className="grid gap-3 sm:grid-cols-2 mt-4">
        {(Object.keys(ROLE_META) as ClientRole[]).map((r) => (
          <div key={r} className="rounded-xl border border-border p-3">
            <Badge label={ROLE_META[r].label} tint={ROLE_META[r].tint} />
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {ROLE_META[r].hint}
            </p>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

/* ── إعادة تعيين كلمة مرور مستخدم ─────────────────────────────── */

function ResetPasswordModal({ user, onClose, onDone }: {
  user: TenantUser
  onClose: () => void
  onDone: () => void
}) {
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const generate = () => {
    // كلمة مؤقتة مقروءة: لا أحرف متشابهة تُربك النطق (0/O و 1/l)
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    const bytes = new Uint32Array(12)
    crypto.getRandomValues(bytes)
    setPassword([...bytes].map((b) => chars[b % chars.length]).join(""))
  }

  const submit = async () => {
    setError("")
    setBusy(true)
    try {
      await resetUserPasswordAction(user.id, password)
      onDone()
      onClose()
    } catch (e) {
      setError(describeError(e, "تعذّرت إعادة التعيين"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open onClose={onClose}
      title={`إعادة تعيين كلمة مرور: ${user.name}`}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
          <Btn onClick={submit} loading={busy} disabled={password.length < 8}>
            تعيين
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <InfoNote>
          ستُطلب من المستخدم كلمة مرور جديدة عند أول دخول. بلّغه الكلمة المؤقتة
          بقناة آمنة — لا ترسلها في مجموعة عامة.
        </InfoNote>

        <Field label="كلمة المرور المؤقتة" required
               hint="8 أحرف على الأقل، وتحتوي حرفاً ورقماً">
          <div className="flex gap-2">
            <TextInput value={password} onChange={(e) => setPassword(e.target.value)}
                       dir="ltr" className="text-left num" />
            <Btn variant="outline" onClick={generate}>توليد</Btn>
          </div>
        </Field>

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  )
}
