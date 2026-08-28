"use client"

// ================================================================
// حسابي — الملف الشخصي وكلمة المرور والتفضيلات
// ================================================================
// شاشة خاصة بالمستخدم نفسه، منفصلة عن إعدادات الشركة. أي مستخدم
// مهما كان دوره يستطيع تغيير كلمة مروره وبياناته — ولا يستطيع أحد
// تغيير دوره من هنا.

import { useState, useEffect } from "react"
import { useSession, useAsyncData } from "@/lib/session"
import {
  fetchMyAccountAction, updateMyProfileAction, changeMyPasswordAction,
} from "@/app/actions/account"
import {
  PageHeader, SectionCard, InlineError, InfoNote, Field, TextInput,
  SelectInput, Btn, Badge, TableSkeleton, useToast, formatDateTime,
} from "./ui"
import { ROLE_META } from "@/lib/constants"
import type { ClientRole } from "@/lib/types"
import { Save, KeyRound, Eye, EyeOff, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function AccountTab() {
  const account = useAsyncData(() => fetchMyAccountAction(), [])

  if (account.loading) return <TableSkeleton rows={6} cols={2} />
  if (account.error) return <InlineError message={account.error} />
  if (!account.data) return null

  const me = account.data

  return (
    <div className="space-y-5">
      <PageHeader
        title="حسابي"
        subtitle="بياناتك الشخصية وكلمة المرور — لا تشمل إعدادات الشركة"
      />

      {me.mustChangePassword && (
        <InlineError
          message="أُعيد تعيين كلمة مرورك من قِبل مدير النظام. غيّرها الآن إلى كلمة تعرفها أنت وحدك."
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <ProfileCard me={me} onSaved={account.reload} />
        <div className="space-y-4">
          <PasswordCard onDone={account.reload} />
          <IdentityCard me={me} />
        </div>
      </div>
    </div>
  )
}

/* ================================================================ */
/* الملف الشخصي                                                      */
/* ================================================================ */

function ProfileCard({ me, onSaved }: {
  me: Awaited<ReturnType<typeof fetchMyAccountAction>>
  onSaved: () => void
}) {
  const { notify } = useToast()
  const [fullName, setFullName] = useState(me.fullName)
  const [phone, setPhone] = useState(me.phone)
  const [theme, setTheme] = useState(me.theme)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // السمة تُطبَّق فوراً — الانتظار للحفظ يجعل الاختيار يبدو معطّلاً
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const dark = theme === "dark" || (theme === "system" && prefersDark)
    document.documentElement.classList.toggle("dark", dark)
  }, [theme])

  const save = async () => {
    setError("")
    if (!fullName.trim()) { setError("الاسم مطلوب"); return }

    setBusy(true)
    try {
      await updateMyProfileAction({ fullName, phone, theme })
      onSaved()
      notify("تم حفظ بياناتك")
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ")
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard title="البيانات الشخصية" padded>
      <div className="space-y-4">
        <Field label="الاسم الكامل" required hint="يظهر في سجل التدقيق وعلى المستندات التي تسجّلها">
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>

        <Field label="رقم الهاتف">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)}
                     dir="ltr" className="text-left num" placeholder="0598575834" />
        </Field>

        <Field label="اسم المستخدم" hint="لا يمكن تغييره — مدير النظام فقط يعدّله">
          <TextInput value={me.username} disabled dir="ltr" className="text-left" />
        </Field>

        <Field label="البريد الإلكتروني" hint="لا يمكن تغييره — يُستخدم لتسجيل الدخول">
          <TextInput value={me.email} disabled dir="ltr" className="text-left" />
        </Field>

        <Field label="مظهر الواجهة">
          <SelectInput value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
            <option value="system">حسب إعدادات الجهاز</option>
            <option value="light">فاتح</option>
            <option value="dark">داكن</option>
          </SelectInput>
        </Field>

        {error && <InlineError message={error} />}

        <Btn icon={Save} onClick={save} loading={busy}>حفظ البيانات</Btn>
      </div>
    </SectionCard>
  )
}

/* ================================================================ */
/* كلمة المرور                                                       */
/* ================================================================ */

function PasswordCard({ onDone }: { onDone: () => void }) {
  const { notify } = useToast()

  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const strength = scoreLocal(next)
  const mismatch = confirm.length > 0 && next !== confirm

  const submit = async () => {
    setError("")
    setDone(false)

    if (next !== confirm) { setError("كلمتا المرور غير متطابقتين"); return }

    setBusy(true)
    try {
      await changeMyPasswordAction({ currentPassword: current, newPassword: next })
      setCurrent(""); setNext(""); setConfirm("")
      setDone(true)
      onDone()
      notify("تم تغيير كلمة المرور")
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تغيير كلمة المرور")
    } finally {
      setBusy(false)
    }
  }

  const BARS = ["bg-danger", "bg-danger", "bg-warning", "bg-success", "bg-success"]

  return (
    <SectionCard title="كلمة المرور" padded>
      <div className="space-y-4">
        <Field label="كلمة المرور الحالية" required>
          <div className="relative">
            <TextInput
              type={show ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              dir="ltr" className="text-left pl-9"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <Field label="كلمة المرور الجديدة" required
               hint="8 أحرف على الأقل، وتحتوي حرفاً ورقماً">
          <TextInput
            type={show ? "text" : "password"}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            dir="ltr" className="text-left"
            autoComplete="new-password"
          />
        </Field>

        {next.length > 0 && (
          <div>
            <div className="flex gap-1 mb-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < strength.score ? BARS[strength.score] : "bg-muted"
                  )}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              قوة كلمة المرور: <span className="text-foreground">{strength.label}</span>
            </p>
          </div>
        )}

        <Field label="تأكيد كلمة المرور الجديدة" required
               error={mismatch ? "الكلمتان غير متطابقتين" : undefined}>
          <TextInput
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            dir="ltr" className="text-left"
            invalid={mismatch}
            autoComplete="new-password"
          />
        </Field>

        {error && <InlineError message={error} />}

        {done && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/25
                          px-3 py-2 text-xs text-success">
            <Check className="size-3.5 shrink-0" />
            تم تغيير كلمة المرور بنجاح
          </div>
        )}

        <Btn
          icon={KeyRound}
          onClick={submit}
          loading={busy}
          disabled={!current || !next || !confirm || mismatch}
        >
          تغيير كلمة المرور
        </Btn>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          نطلب كلمة المرور الحالية للتأكد أنك أنت. بدون هذا التحقق، أي جهاز تُرك
          مفتوحاً يستطيع تغيير كلمة مرورك وإقصاءك عن حسابك.
        </p>
      </div>
    </SectionCard>
  )
}

/* ================================================================ */
/* الهوية والدور                                                     */
/* ================================================================ */

function IdentityCard({ me }: { me: Awaited<ReturnType<typeof fetchMyAccountAction>> }) {
  const { company } = useSession()
  const roleMeta = me.role ? ROLE_META[me.role as ClientRole] : null

  return (
    <SectionCard title="هويتك في النظام" padded>
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs text-muted-foreground">الشركة</dt>
          <dd className="text-sm">{company?.name ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs text-muted-foreground">دورك</dt>
          <dd>
            {roleMeta
              ? <Badge label={roleMeta.label} tint={roleMeta.tint} />
              : <Badge label="مشرف المنصة" tint="bg-violet-500/12 text-violet-700" />}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs text-muted-foreground">آخر دخول</dt>
          <dd className="text-xs num">
            {me.lastLoginAt ? formatDateTime(me.lastLoginAt) : "—"}
          </dd>
        </div>
      </dl>

      {roleMeta && (
        <div className="mt-4">
          <InfoNote>
            {roleMeta.hint}. تغيير الدور من صلاحية مدير النظام وحده — ولا يمكنك
            تغييره لنفسك حتى لو كنت مديراً.
          </InfoNote>
        </div>
      )}
    </SectionCard>
  )
}

/* ── قياس محلي لقوة كلمة المرور — بلا استدعاء للسيرفر عند كل حرف ── */
function scoreLocal(pw: string): { score: number; label: string } {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++

  const capped = Math.min(s, 4)
  return { score: capped, label: ["ضعيفة جداً", "ضعيفة", "متوسطة", "جيدة", "قوية"][capped] }
}
