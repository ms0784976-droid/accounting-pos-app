import type { StatementRow } from "./types"

/**
 * lib/statement.ts — ترتيب كشف الحساب وإعادة حساب الرصيد المتراكم
 * ================================================================
 * لماذا هذا الملف موجود:
 *
 * دالة party_statement في قاعدة البيانات تُرجع الصفوف بترتيب غير مضمون
 * عندما تحمل عدة حركات نفس التاريخ. فيظهر سند القبض قبل الفاتورة التي
 * يسدّدها، ويصير عمود "الرصيد" يقفز بلا معنى (438 → 915 → 315)،
 * ويعرض تذييل الجدول رصيد آخر صف وصل لا الرصيد الحقيقي.
 *
 * ونفس المشكلة تظهر عند تسجيل فاتورة بتاريخ قديم: تصل في آخر القائمة
 * فيبدو الكشف كأن الفاتورة حدثت بعد كل الحركات اللاحقة لها.
 *
 * الحل هنا: نرتّب الصفوف (الرصيد المدوّر أولاً، ثم بالتاريخ ثم برقم
 * المستند) ونعيد حساب الرصيد تراكمياً بأنفسنا. النتيجة عمود متسق دائماً
 * ينتهي بالرصيد الحقيقي للجهة، مهما كان ترتيب وصول الصفوف.
 *
 * هذه معالجة عرض فقط — لا تكتب ولا تعدّل أي بيانات.
 */

export interface StatementView {
  /** الصفوف مرتّبة، وقد أُعيد حساب runningBalance فيها */
  rows: StatementRow[]
  /** الرصيد المدوّر من قبل بداية الفترة */
  opening: number
  /** رصيد آخر المدة — يطابق رصيد الجهة عندما تغطّي الفترة كل الحركات */
  closing: number
  totalDebit: number
  totalCredit: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildStatementView(data: StatementRow[] | null | undefined): StatementView {
  const src = data ?? []

  // صفوف الرصيد المدوّر لا تحمل تاريخاً — تبقى في الأعلى دائماً
  const carried = src.filter((r) => !r.date)
  const moves = src
    .filter((r) => !!r.date)
    .sort((a, b) => {
      if (a.date !== b.date) return (a.date ?? "") < (b.date ?? "") ? -1 : 1
      return (a.docNo ?? "").localeCompare(b.docNo ?? "", "en")
    })

  const opening = carried.length ? carried[carried.length - 1].runningBalance : 0

  let running = opening
  const rows: StatementRow[] = [
    ...carried.map((r) => ({ ...r, runningBalance: opening })),
    ...moves.map((r) => {
      running = round2(running + r.debit - r.credit)
      return { ...r, runningBalance: running }
    }),
  ]

  return {
    rows,
    opening,
    closing: running,
    totalDebit: round2(rows.reduce((s, r) => s + r.debit, 0)),
    totalCredit: round2(rows.reduce((s, r) => s + r.credit, 0)),
  }
}
