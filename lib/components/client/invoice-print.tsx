"use client"

// ================================================================
// الفاتورة المطبوعة — A4 رسمية
// ================================================================

import { useEffect, useState } from "react"
import { fetchInvoiceForPrintAction } from "@/app/actions/invoices"
import { fetchTenantSettingsAction, type PrintSettings } from "@/app/actions/settings"
import { Btn, formatDate, formatQty, InlineError, printArea } from "./ui"
import { INVOICE_TYPE_META } from "@/lib/constants"
import { unitShort } from "@/lib/units"
import { Printer, X } from "lucide-react"
import { describeError } from "@/lib/errors"

type PrintData = Awaited<ReturnType<typeof fetchInvoiceForPrintAction>>

export function InvoicePrint({ invoiceId, onClose }: {
  invoiceId: string
  onClose: () => void
}) {
  const [data, setData] = useState<PrintData | null>(null)
  const [print, setPrint] = useState<PrintSettings | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      fetchInvoiceForPrintAction(invoiceId),
      fetchTenantSettingsAction(),
    ])
      .then(([inv, settings]) => { setData(inv); setPrint(settings.print) })
      .catch((e) => setError(describeError(e, "تعذّر تحميل الفاتورة")))
  }, [invoiceId])

  // الطابعة الحرارية 80mm لا تتسع للتوقيعات ولا للتفقيط
  const thermal = print?.paperSize === "thermal80"

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/50 backdrop-blur-[2px] p-4 print:p-0 print:bg-white print:static">
      <div className="mx-auto max-w-3xl">
        {/* شريط الأدوات — لا يُطبع */}
        <div className="no-print flex items-center justify-end gap-2 mb-3">
          <Btn variant="outline" size="sm" icon={Printer} onClick={printArea}>طباعة</Btn>
          <Btn variant="ghost" size="sm" icon={X} onClick={onClose}>إغلاق</Btn>
        </div>

        {error && <div className="no-print"><InlineError message={error} /></div>}

        {data && print && (
          <article
            className={`print-area bg-white text-black rounded-xl print:rounded-none
                        shadow-overlay print:shadow-none p-8 print:p-0
                        ${thermal ? "thermal-receipt mx-auto" : ""}`}
          >
            <Header data={data} showLogo={print.showLogo} />
            <PartyBlock data={data} />
            <LinesTable data={data} />
            <TotalsBlock data={data} showWords={print.showAmountInWords && !thermal} />
            <Footer data={data} settings={print} thermal={thermal} />
          </article>
        )}
      </div>
    </div>
  )
}

/* ── الترويسة ─────────────────────────────────────────────────── */

function Header({ data, showLogo }: { data: PrintData; showLogo: boolean }) {
  const { company, invoice } = data
  const meta = INVOICE_TYPE_META[invoice.type]
  const cancelled = invoice.status === "cancelled"

  return (
    <header className="relative border-b-2 border-neutral-800 pb-4 mb-5">
      {cancelled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-5xl font-black text-red-600/25 rotate-[-12deg] tracking-widest">
            ملغاة
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {showLogo && company.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt="" className="h-12 mb-2 object-contain" />
          )}
          <h1 className="text-xl font-bold text-neutral-900">{company.name}</h1>
          {company.address && (
            <p className="text-xs text-neutral-600 mt-1">{company.address}</p>
          )}
          <p className="text-xs text-neutral-600 num" dir="ltr" style={{ textAlign: "right" }}>
            {[company.phone, company.email].filter(Boolean).join(" · ")}
          </p>
          {company.taxNumber && (
            <p className="text-xs text-neutral-600 mt-0.5">
              الرقم الضريبي: <span className="num">{company.taxNumber}</span>
            </p>
          )}
        </div>

        <div className="shrink-0 text-left">
          <h2 className="text-base font-bold text-neutral-900">{meta.label}</h2>
          <table className="mt-2 text-xs text-neutral-700">
            <tbody>
              <tr>
                <td className="pl-3 text-neutral-500">الرقم</td>
                <td className="num font-semibold">{invoice.invoiceNo}</td>
              </tr>
              <tr>
                <td className="pl-3 text-neutral-500">التاريخ</td>
                <td className="num">{formatDate(invoice.date)}</td>
              </tr>
              {invoice.dueDate && (
                <tr>
                  <td className="pl-3 text-neutral-500">الاستحقاق</td>
                  <td className="num">{formatDate(invoice.dueDate)}</td>
                </tr>
              )}
              {invoice.reference && (
                <tr>
                  <td className="pl-3 text-neutral-500">مرجع</td>
                  <td className="num">{invoice.reference}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </header>
  )
}

/* ── بيانات الطرف الآخر ───────────────────────────────────────── */

function PartyBlock({ data }: { data: PrintData }) {
  const { party, invoice } = data
  const meta = INVOICE_TYPE_META[invoice.type]
  const methodLabel = { cash: "نقدي", card: "بطاقة", credit: "آجل" }[invoice.paymentMethod]

  return (
    <section className="grid grid-cols-2 gap-4 mb-5 text-xs">
      <div className="border border-neutral-300 rounded p-3">
        <p className="text-neutral-500 mb-1">{meta.partyLabel}</p>
        <p className="font-semibold text-sm text-neutral-900">
          {party?.name ?? "زبون نقدي"}
        </p>
        {party?.phone && <p className="text-neutral-600 num mt-0.5">{party.phone}</p>}
        {party?.address && <p className="text-neutral-600 mt-0.5">{party.address}</p>}
        {party?.tax_number && (
          <p className="text-neutral-600 mt-0.5">
            الرقم الضريبي: <span className="num">{party.tax_number}</span>
          </p>
        )}
      </div>

      <div className="border border-neutral-300 rounded p-3">
        <p className="text-neutral-500 mb-1">بيانات الدفع</p>
        <p className="text-neutral-800">طريقة الدفع: <span className="font-medium">{methodLabel}</span></p>
        {party?.code && (
          <p className="text-neutral-600 mt-0.5">رقم الحساب: <span className="num">{party.code}</span></p>
        )}
      </div>
    </section>
  )
}

/* ── جدول الأصناف ─────────────────────────────────────────────── */

function LinesTable({ data }: { data: PrintData }) {
  const { invoice, company } = data
  const hasDiscount = invoice.lines.some((l) => l.discountAmount > 0)
  const hasTax = invoice.lines.some((l) => l.taxAmount > 0)

  return (
    <table className="w-full text-xs tabular border-collapse mb-4">
      <thead>
        <tr className="bg-neutral-100">
          <th className="border border-neutral-300 px-2 py-1.5 w-8 text-center">#</th>
          <th className="border border-neutral-300 px-2 py-1.5 text-right">الصنف</th>
          <th className="border border-neutral-300 px-2 py-1.5 w-16 text-center">الوحدة</th>
          <th className="border border-neutral-300 px-2 py-1.5 w-20 text-left">الكمية</th>
          <th className="border border-neutral-300 px-2 py-1.5 w-24 text-left">السعر</th>
          {hasDiscount && <th className="border border-neutral-300 px-2 py-1.5 w-20 text-left">الخصم</th>}
          {hasTax && <th className="border border-neutral-300 px-2 py-1.5 w-20 text-left">الضريبة</th>}
          <th className="border border-neutral-300 px-2 py-1.5 w-28 text-left">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        {invoice.lines.map((l, i) => (
          <tr key={l.id}>
            <td className="border border-neutral-300 px-2 py-1.5 text-center num">{i + 1}</td>
            <td className="border border-neutral-300 px-2 py-1.5">
              {l.itemName}
              {l.sku && <span className="text-neutral-500 num"> · {l.sku}</span>}
            </td>
            <td className="border border-neutral-300 px-2 py-1.5 text-center">{unitShort(l.unit)}</td>
            <td className="border border-neutral-300 px-2 py-1.5 text-left num">{formatQty(l.quantity)}</td>
            <td className="border border-neutral-300 px-2 py-1.5 text-left num">{l.unitPrice.toFixed(2)}</td>
            {hasDiscount && (
              <td className="border border-neutral-300 px-2 py-1.5 text-left num">
                {l.discountAmount ? l.discountAmount.toFixed(2) : "—"}
              </td>
            )}
            {hasTax && (
              <td className="border border-neutral-300 px-2 py-1.5 text-left num">
                {l.taxAmount ? l.taxAmount.toFixed(2) : "—"}
              </td>
            )}
            <td className="border border-neutral-300 px-2 py-1.5 text-left num font-medium">
              {l.lineTotal.toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ── الإجماليات ───────────────────────────────────────────────── */

function TotalsBlock({ data, showWords }: { data: PrintData; showWords: boolean }) {
  const { invoice, company } = data
  const net = invoice.subtotal - invoice.discountAmount

  return (
    <section className="flex justify-between gap-6 items-start mb-6">
      <div className="flex-1 border border-neutral-300 rounded p-3">
        {showWords && (
          <>
            <p className="text-[11px] text-neutral-500 mb-1">المبلغ كتابةً</p>
            <p className="text-xs font-medium text-neutral-900 leading-relaxed">
              {amountInWords(invoice.total, company.currency)}
            </p>
          </>
        )}
        {invoice.notes && (
          <>
            <p className="text-[11px] text-neutral-500 mt-3 mb-1">ملاحظات</p>
            <p className="text-xs text-neutral-700 leading-relaxed">{invoice.notes}</p>
          </>
        )}
      </div>

      <table className="text-xs tabular w-64 shrink-0">
        <tbody>
          <tr>
            <td className="py-1 text-neutral-600">المجموع</td>
            <td className="py-1 text-left num">{invoice.subtotal.toFixed(2)}</td>
          </tr>
          {invoice.discountAmount > 0 && (
            <tr>
              <td className="py-1 text-neutral-600">الخصم</td>
              <td className="py-1 text-left num">−{invoice.discountAmount.toFixed(2)}</td>
            </tr>
          )}
          {invoice.discountAmount > 0 && (
            <tr className="border-t border-neutral-200">
              <td className="py-1 text-neutral-600">الصافي</td>
              <td className="py-1 text-left num">{net.toFixed(2)}</td>
            </tr>
          )}
          {invoice.taxAmount > 0 && (
            <tr>
              <td className="py-1 text-neutral-600">
                ضريبة القيمة المضافة <span className="num">{company.vatRate}%</span>
              </td>
              <td className="py-1 text-left num">{invoice.taxAmount.toFixed(2)}</td>
            </tr>
          )}
          <tr className="border-t-2 border-neutral-800">
            <td className="py-2 font-bold text-sm">الإجمالي المستحق</td>
            <td className="py-2 text-left num font-bold text-sm">
              {invoice.total.toFixed(2)} {currencySymbol(company.currency)}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

/* ── التذييل ──────────────────────────────────────────────────── */

function Footer({ data, settings, thermal }: {
  data: PrintData
  settings: PrintSettings
  thermal: boolean
}) {
  return (
    <footer className="border-t border-neutral-300 pt-4">
      {settings.showSignatures && !thermal && (
        <div className="grid grid-cols-2 gap-8 mb-6">
          <div>
            <p className="text-[11px] text-neutral-500 mb-6">توقيع المستلم</p>
            <div className="border-b border-neutral-400" />
          </div>
          <div>
            <p className="text-[11px] text-neutral-500 mb-6">توقيع وختم الشركة</p>
            <div className="border-b border-neutral-400" />
          </div>
        </div>
      )}

      {settings.termsText && (
        <p className="text-[10px] text-neutral-600 leading-relaxed mb-3 whitespace-pre-line">
          {settings.termsText}
        </p>
      )}

      {settings.footerText && (
        <p className="text-center text-[11px] text-neutral-700 mb-2">{settings.footerText}</p>
      )}

      <p className="text-center text-[10px] text-neutral-400">
        {data.company.name}
        {data.company.phone && <span className="num"> · {data.company.phone}</span>}
      </p>
    </footer>
  )
}

/* ================================================================ */
/* تفقيط المبلغ — كتابة الرقم بالعربية                               */
/* ================================================================ */

const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"]
const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"]
const HUNDREDS = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة",
  "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"]

function under1000(n: number): string {
  if (n === 0) return ""
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (h) parts.push(HUNDREDS[h])
  if (rest) {
    if (rest < 20) parts.push(ONES[rest])
    else {
      const ones = rest % 10
      const tens = Math.floor(rest / 10)
      parts.push(ones ? `${ONES[ones]} و${TENS[tens]}` : TENS[tens])
    }
  }
  return parts.join(" و")
}

function group(n: number, one: string, two: string, plural: string, many: string): string {
  if (n === 0) return ""
  if (n === 1) return one
  if (n === 2) return two
  if (n <= 10) return `${under1000(n)} ${plural}`
  return `${under1000(n)} ${many}`
}

/** يحوّل الرقم إلى نص عربي — مطلوب على الفواتير الرسمية */
export function amountInWords(value: number, currency = "ILS"): string {
  const names: Record<string, [string, string]> = {
    ILS: ["شيقل", "أغورة"],
    JOD: ["دينار", "قرش"],
    USD: ["دولار", "سنت"],
    EUR: ["يورو", "سنت"],
  }
  const [major, minor] = names[currency] ?? ["وحدة", "جزء"]

  const rounded = Math.round(Math.abs(value) * 100) / 100
  const whole = Math.floor(rounded)
  const frac = Math.round((rounded - whole) * 100)

  if (whole === 0 && frac === 0) return `صفر ${major} فقط لا غير`

  const parts: string[] = []
  const millions = Math.floor(whole / 1_000_000)
  const thousands = Math.floor((whole % 1_000_000) / 1000)
  const remainder = whole % 1000

  if (millions) parts.push(group(millions, "مليون", "مليونان", "ملايين", "مليون"))
  if (thousands) parts.push(group(thousands, "ألف", "ألفان", "آلاف", "ألف"))
  if (remainder) parts.push(under1000(remainder))

  let text = parts.filter(Boolean).join(" و")
  if (whole > 0) text += ` ${major}`
  if (frac > 0) text += `${whole > 0 ? " و" : ""}${under1000(frac)} ${minor}`

  return `${value < 0 ? "سالب " : ""}${text} فقط لا غير`
}

function currencySymbol(code: string): string {
  return { ILS: "₪", JOD: "د.أ", USD: "$", EUR: "€" }[code] ?? code
}
