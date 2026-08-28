"use client"

// شاشة المشتريات — غلاف رفيع حول قائمة الفواتير المشتركة
import { InvoiceList } from "./invoice-list"

export function PurchasesTab() {
  return <InvoiceList kind="purchase" />
}
