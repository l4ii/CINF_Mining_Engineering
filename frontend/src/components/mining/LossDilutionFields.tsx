import { useEffect, useRef, useState } from 'react'
import type { LossDilutionIndicator, ValidationIssue } from '../../mining/types'
import { unitAddonClass, unitInputClass } from './unitField'

export function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return ''
  const display = value * 100
  return Number.isInteger(display) ? String(display) : String(Number(display.toFixed(6)))
}

export function parsePercent(raw: string): number | null {
  if (!raw.trim()) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed / 100 : null
}

export interface LossDilutionFieldsProps {
  labelPrefix: string
  indicator: LossDilutionIndicator
  fieldPrefix: string
  issues?: ValidationIssue[]
  darkMode: boolean
  onChange: (field: keyof LossDilutionIndicator, value: number | null) => void
}

export default function LossDilutionFields({
  labelPrefix,
  indicator,
  fieldPrefix,
  issues = [],
  darkMode,
  onChange,
}: LossDilutionFieldsProps) {
  const locallyEdited = useRef(new Set<string>())
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    setDrafts((previous) => {
      const next = { ...previous }
      for (const field of ['dilutionRate', 'lossRate'] as const) {
        const key = `${fieldPrefix}.${field}`
        if (locallyEdited.current.has(key)) {
          locallyEdited.current.delete(key)
        } else {
          next[key] = formatPercent(indicator[field])
        }
      }
      return next
    })
  }, [indicator, fieldPrefix])

  const inputSurface = darkMode
    ? 'border-gray-600 bg-gray-900 text-gray-100'
    : 'border-gray-300 bg-white text-gray-900'

  const renderRate = (field: keyof LossDilutionIndicator, label: string) => {
    const key = `${fieldPrefix}.${field}`
    const draft = drafts[key] ?? formatPercent(indicator[field])
    const parsed = parsePercent(draft)
    const issue = issues.find((item) => item.field === key)
    const localInvalid = draft.trim() !== '' && parsed == null
    const invalid = Boolean(issue) || localInvalid
    return (
      <label className="flex items-center gap-1.5">
        <span className={`shrink-0 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{label}</span>
        <span className="flex h-8 w-[7.5rem] items-stretch">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${labelPrefix}${label}`}
            aria-invalid={invalid}
            data-testid={`${fieldPrefix}-${field}`}
            value={draft}
            onChange={(event) => {
              locallyEdited.current.add(key)
              setDrafts((previous) => ({ ...previous, [key]: event.target.value }))
              onChange(field, parsePercent(event.target.value))
            }}
            className={`${unitInputClass(invalid ? `border-red-500 ${inputSurface}` : `focus:border-blue-500 ${inputSurface}`, 'h-8')}`}
          />
          <span className={unitAddonClass(darkMode, 'h-8')}>%</span>
        </span>
      </label>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid={`${fieldPrefix}-rates`}>
      {renderRate('dilutionRate', '贫化率')}
      {renderRate('lossRate', '损失率')}
    </div>
  )
}
