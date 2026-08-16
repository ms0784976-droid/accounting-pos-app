// ================================================================
// مُحاسِب — وحدات القياس
// ================================================================
import type { UnitCode } from "./types"

export interface UnitMeta {
  code: UnitCode
  label: string        // اسم الوحدة عربي
  short: string        // اختصار (يظهر في الجداول)
  category: "count" | "weight" | "length" | "area" | "volume" | "service" | "pack"
}

export const UNITS: UnitMeta[] = [
  // ── العدد / الحبات
  { code: "pcs",   label: "حبة / قطعة",     short: "حبة",   category: "count"   },
  { code: "dozen", label: "دزينة (12 حبة)",  short: "دزينة", category: "count"   },
  { code: "pair",  label: "زوج",             short: "زوج",   category: "count"   },
  // ── الوزن
  { code: "g",     label: "غرام",            short: "غ",     category: "weight"  },
  { code: "kg",    label: "كيلوغرام",        short: "كجم",   category: "weight"  },
  { code: "ton",   label: "طن",              short: "طن",    category: "weight"  },
  // ── الطول / المساحة / الحجم
  { code: "m",     label: "متر",             short: "م",     category: "length"  },
  { code: "m2",    label: "متر مربع",        short: "م²",    category: "area"    },
  { code: "m3",    label: "متر مكعب",        short: "م³",    category: "volume"  },
  { code: "liter", label: "لتر",             short: "ل",     category: "volume"  },
  // ── التعبئة / التغليف
  { code: "box",   label: "صندوق / كرتون",  short: "صندوق", category: "pack"    },
  { code: "pack",  label: "ربطة / طقم",     short: "طقم",   category: "pack"    },
  { code: "bag",   label: "كيس",            short: "كيس",   category: "pack"    },
  { code: "roll",  label: "رولو / بكرة",    short: "رولو",  category: "pack"    },
  // ── الخدمات
  { code: "hour",  label: "ساعة",           short: "ساعة",  category: "service" },
  { code: "day",   label: "يوم",            short: "يوم",   category: "service" },
]

export const UNIT_MAP = new Map<UnitCode, UnitMeta>(UNITS.map((u) => [u.code, u]))

export function unitLabel(code: UnitCode): string {
  return UNIT_MAP.get(code)?.label ?? code
}

export function unitShort(code: UnitCode): string {
  return UNIT_MAP.get(code)?.short ?? code
}

// تجميع الوحدات حسب الفئة (للعرض في قوائم منظمة)
export const UNIT_GROUPS: { label: string; units: UnitMeta[] }[] = [
  { label: "العدد / الحبات",          units: UNITS.filter((u) => u.category === "count")   },
  { label: "الوزن",                    units: UNITS.filter((u) => u.category === "weight")  },
  { label: "الطول والمساحة والحجم",   units: UNITS.filter((u) => u.category === "length" || u.category === "area" || u.category === "volume") },
  { label: "التعبئة والتغليف",        units: UNITS.filter((u) => u.category === "pack")    },
  { label: "الخدمات",                  units: UNITS.filter((u) => u.category === "service") },
]
