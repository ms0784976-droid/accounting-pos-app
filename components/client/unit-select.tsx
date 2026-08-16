"use client"

import { UNIT_GROUPS, unitShort } from "@/lib/units"
import type { UnitCode } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Props {
  value: UnitCode
  onChange: (v: UnitCode) => void
  className?: string
}

export function UnitSelect({ value, onChange, className }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as UnitCode)}
      className={cn(
        "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground",
        "focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition",
        className
      )}
    >
      {UNIT_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.units.map((u) => (
            <option key={u.code} value={u.code}>
              {u.label} ({u.short})
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

export function UnitBadge({ unit }: { unit: UnitCode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {unitShort(unit)}
    </span>
  )
}
