"use client"

// شاشة المبيعات — غلاف رفيع حول قائمة الفواتير المشتركة
import { InvoiceList } from "./invoice-list"

export function SalesTab() {
  return <InvoiceList kind="sale" />
}
