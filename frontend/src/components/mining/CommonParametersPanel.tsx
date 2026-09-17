import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { CommonParameters, ValidationIssue } from '../../mining/types'
import { unitAddonClass, unitInputClass } from './unitField'

export type OccurrenceParameterKey = 'dipAngle' | 'trueThickness' | 'oreDensity' | 'wasteDensity'

const OCCURRENCE_FIELDS: Array<{ key: OccurrenceParameterKey; label: string; unit: string }> = [
  { key: 'dipAngle', label: '矿体倾角', unit: '°' },
  { key: 'trueThickness', label: '矿体真厚', unit: 'm' },
  { key: 'oreDensity', label: '矿体密度', unit: 't/m³' },
  { key: 'wasteDensity', label: '围岩密度', unit: 't/m³' },
]

export interface OreBodyParametersPanelProps {
  common: CommonParameters
  issues?: ValidationIssue[]
  occurrenceCollapsed: boolean
  darkMode: boolean
  onChange: (key: OccurrenceParameterKey, value: number | null) => void
  onToggleOccurrence: () => void
}

function formatValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return ''
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)))
}

function parseValue(raw: string): number | null {
  if (!raw.trim()) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export default function OreBodyParametersPanel({
  common,
  issues = [],
  occurrenceCollapsed,
  darkMode,
  onChange,
  onToggleOccurrence,
}: OreBodyParametersPanelProps) {
  const locallyEdited = useRef(new Set<string>())
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})

  useEffect(() => {
    setDraftValues((previous) => {
      const next = { ...previous }
      for (const field of OCCURRENCE_FIELDS) {
        if (locallyEdited.current.has(field.key)) {
          locallyEdited.current.delete(field.key)
        } else {
          next[field.key] = formatValue(common[field.key])
        }
      }
      return next
    })
  }, [common])

  const surface = darkMode ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500'
  const inputSurface = darkMode
    ? 'border-gray-600 bg-gray-900 text-gray-100 placeholder:text-gray-500'
    : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400'

  return (
    <section className={`rounded-lg border shadow-sm ${surface}`} data-testid="ore-body-parameters-panel">
      <button
        type="button"
        onClick={onToggleOccurrence}
        className={`flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left ${darkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}`}
        aria-expanded={!occurrenceCollapsed}
        aria-controls="ore-body-parameters-content"
      >
        {occurrenceCollapsed ? <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="font-semibold">矿体参数</span>
      </button>

      {!occurrenceCollapsed ? (
        <div id="ore-body-parameters-content" className="border-t border-inherit px-4 pb-4 pt-3 space-y-3">
          <p className={`text-sm leading-6 ${muted}`} data-testid="ore-body-parameters-intro">
            引用项目基础参数中的矿体倾角、真厚度及密度，供本方法计算使用。
          </p>
          <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            {OCCURRENCE_FIELDS.map((field) => {
              const draft = draftValues[field.key] ?? formatValue(common[field.key])
              const parsedDraft = parseValue(draft)
              const issue = issues.find((item) => item.field === field.key)
              const localInvalid = draft.trim() !== '' && parsedDraft == null
              const invalid = Boolean(issue) || localInvalid
              const message = localInvalid ? '请输入有效数字' : issue && issue.code !== 'required' ? issue.message : null
              return (
                <label key={field.key} className="flex min-w-0 flex-col gap-1">
                  <span className="block truncate text-sm font-medium leading-none">{field.label}</span>
                  <span className="flex h-[38px] min-w-0 items-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      data-testid={`common-${field.key}`}
                      aria-label={field.label}
                      aria-invalid={invalid}
                      value={draft}
                      onChange={(event) => {
                        const raw = event.target.value
                        locallyEdited.current.add(field.key)
                        setDraftValues((previous) => ({ ...previous, [field.key]: raw }))
                        onChange(field.key, parseValue(raw))
                      }}
                      className={`${unitInputClass(`focus:ring-2 ${inputSurface}`)} ${
                        invalid ? 'border-red-500 focus:ring-red-400/30' : 'focus:border-blue-500 focus:ring-blue-500/30'
                      }`}
                    />
                    <span className={unitAddonClass(darkMode)}>{field.unit}</span>
                  </span>
                  {message ? <span className="block truncate text-sm text-red-600 dark:text-red-300">{message}</span> : null}
                </label>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}
