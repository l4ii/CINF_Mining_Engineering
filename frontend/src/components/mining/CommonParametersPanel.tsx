import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import type { CommonParameters, LossDilutionIndicator, ValidationIssue } from '../../mining/types'
import { unitAddonClass, unitInputClass } from './unitField'

export type OccurrenceParameterKey = 'dipAngle' | 'levelHeight' | 'trueThickness' | 'oreDensity' | 'wasteDensity'
export type BlockSizeKey = 'levelHeight'
export type IndicatorKey = keyof Pick<
  CommonParameters,
  | 'cuttingLossDilution'
  | 'stopingLossDilution'
  | 'crownSillLossDilution'
  | 'barrierLossDilution'
  | 'pointPillarLossDilution'
>

const OCCURRENCE_FIELDS: Array<{ key: OccurrenceParameterKey; label: string; unit: string }> = [
  { key: 'dipAngle', label: '矿体倾角', unit: '°' },
  { key: 'levelHeight', label: '中段高度', unit: 'm' },
  { key: 'trueThickness', label: '矿体真厚', unit: 'm' },
  { key: 'oreDensity', label: '矿体密度', unit: 't/m³' },
  { key: 'wasteDensity', label: '围岩密度', unit: 't/m³' },
]

const INDICATOR_FIELDS: Array<{ key: IndicatorKey; label: string }> = [
  { key: 'cuttingLossDilution', label: '切割贫损指标' },
  { key: 'stopingLossDilution', label: '回采贫损指标' },
  { key: 'crownSillLossDilution', label: '顶底柱贫损指标' },
  { key: 'barrierLossDilution', label: '矿柱贫损指标' },
  { key: 'pointPillarLossDilution', label: '点柱贫损指标' },
]

export interface ReferenceIndicatorsPanelProps {
  common: CommonParameters
  issues?: ValidationIssue[]
  collapsed: boolean
  occurrenceCollapsed: boolean
  darkMode: boolean
  onChange: (key: OccurrenceParameterKey, value: number | null) => void
  onIndicatorChange: (key: IndicatorKey, field: keyof LossDilutionIndicator, value: number | null) => void
  onToggle: () => void
  onToggleOccurrence: () => void
}

function formatValue(value: number | null, percentage = false): string {
  if (value == null || !Number.isFinite(value)) return ''
  const display = percentage ? value * 100 : value
  return Number.isInteger(display) ? String(display) : String(Number(display.toFixed(6)))
}

function parseValue(raw: string, percentage = false): number | null {
  if (!raw.trim()) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return percentage ? parsed / 100 : parsed
}

function indicatorMissing(common: CommonParameters): number {
  return INDICATOR_FIELDS.reduce((count, field) => {
    const indicator = common[field.key]
    return count + (indicator.dilutionRate == null ? 1 : 0) + (indicator.lossRate == null ? 1 : 0)
  }, 0)
}

function indicatorSummary(missing: number): string {
  return missing > 0 ? `切割、回采及矿柱贫损 · ${missing} 项待填写` : '切割、回采及矿柱贫损'
}

export default function ReferenceIndicatorsPanel({
  common,
  issues = [],
  collapsed,
  occurrenceCollapsed,
  darkMode,
  onChange,
  onIndicatorChange,
  onToggle,
  onToggleOccurrence,
}: ReferenceIndicatorsPanelProps) {
  const locallyEdited = useRef(new Set<string>())
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})

  useEffect(() => {
    setDraftValues((previous) => {
      const next = { ...previous }
      const sync = (key: string, value: number | null, percentage = false) => {
        if (locallyEdited.current.has(key)) {
          locallyEdited.current.delete(key)
        } else {
          next[key] = formatValue(value, percentage)
        }
      }
      for (const field of OCCURRENCE_FIELDS) {
        sync(field.key, common[field.key])
      }
      for (const field of INDICATOR_FIELDS) {
        sync(`${field.key}.dilutionRate`, common[field.key].dilutionRate, true)
        sync(`${field.key}.lossRate`, common[field.key].lossRate, true)
      }
      return next
    })
  }, [common])

  const missing = indicatorMissing(common)
  const surface = darkMode ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500'
  const inputSurface = darkMode
    ? 'border-gray-600 bg-gray-900 text-gray-100 placeholder:text-gray-500'
    : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400'
  const cardSurface = darkMode ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50/70'

  const renderNumberInput = (
    key: string,
    label: string,
    unit: string,
    value: number | null,
    onParsed: (parsed: number | null) => void,
    options: { percentage?: boolean; readOnly?: boolean; hideLabel?: boolean; ariaLabel?: string } = {},
  ) => {
    const draft = draftValues[key] ?? formatValue(value, options.percentage)
    const parsedDraft = parseValue(draft, options.percentage)
    const issue = issues.find((item) => item.field === key)
    const localInvalid = draft.trim() !== '' && parsedDraft == null
    const invalid = Boolean(issue) || localInvalid
    const message = localInvalid ? '请输入有效数字' : issue && issue.code !== 'required' ? issue.message : null
    const accessibleName = options.ariaLabel ?? label
    return (
      <label key={key} className="flex min-w-0 flex-col gap-1">
        {options.hideLabel ? null : (
        <span className="block truncate text-sm font-medium leading-none">
          {label}
        </span>
        )}
        <span className="flex h-[38px] min-w-0 items-center">
          <input
            type="text"
            inputMode="decimal"
            data-testid={`common-${key}`}
            aria-label={accessibleName}
            aria-invalid={invalid}
            value={options.readOnly ? formatValue(value, options.percentage) : draft}
            readOnly={options.readOnly}
            disabled={options.readOnly}
            onChange={(event) => {
              const raw = event.target.value
              locallyEdited.current.add(key)
              setDraftValues((previous) => ({ ...previous, [key]: raw }))
              onParsed(parseValue(raw, options.percentage))
            }}
            className={`${unitInputClass(`focus:ring-2 ${inputSurface}`)} ${
              options.readOnly ? 'cursor-not-allowed opacity-70' : ''
            } ${invalid ? 'border-red-500 focus:ring-red-400/30' : 'focus:border-blue-500 focus:ring-blue-500/30'}`}
          />
          <span className={unitAddonClass(darkMode)}>
            {unit}
          </span>
        </span>
        {message ? <span className="block truncate text-sm text-red-600 dark:text-red-300">{message}</span> : null}
      </label>
    )
  }

  const headerButtonClass = `flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left ${darkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}`

  return (
    <>
      <section className={`rounded-lg border shadow-sm ${surface}`} data-testid="ore-body-parameters-panel">
        <button
          type="button"
          onClick={onToggleOccurrence}
          className={headerButtonClass}
          aria-expanded={!occurrenceCollapsed}
          aria-controls="ore-body-parameters-content"
        >
          {occurrenceCollapsed ? <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="font-semibold">矿体参数</span>
        </button>

        {!occurrenceCollapsed ? (
          <div id="ore-body-parameters-content" className="border-t border-inherit px-4 pb-4 pt-3 space-y-3">
            <p className={`text-sm leading-6 ${muted}`} data-testid="ore-body-parameters-intro">
              本区引用项目基础参数中的相关量，供当前方法计算使用。矿体斜长由中段高度与倾角自动计算。
            </p>
            <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              {OCCURRENCE_FIELDS.map((field) =>
                renderNumberInput(
                  field.key,
                  field.label,
                  field.unit,
                  common[field.key],
                  (parsed) => onChange(field.key, parsed),
                ),
              )}
              {renderNumberInput(
                'inclinedLength',
                '矿体斜长',
                'm',
                common.inclinedLength,
                () => undefined,
                { readOnly: true },
              )}
            </div>
          </div>
        ) : null}
      </section>

      <section className={`rounded-lg border shadow-sm ${surface}`} data-testid="common-parameters-panel">
        <button
          type="button"
          onClick={onToggle}
          className={headerButtonClass}
          aria-expanded={!collapsed}
          aria-controls="reference-indicators-content"
        >
          {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="font-semibold">参照指标</span>
          <span className={`min-w-0 flex-1 truncate text-sm ${muted}`}>{indicatorSummary(missing)}</span>
          {missing > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              {missing} 项待填写
            </span>
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="参数已填写" />
          )}
        </button>

        {!collapsed ? (
          <div id="reference-indicators-content" className="border-t border-inherit px-4 pb-4 pt-3 space-y-4">
            <div>
              <p className={`text-sm leading-6 ${muted}`} data-testid="loss-dilution-intro">
                贫化率是采出矿石中混入废石的比例，入选品位会因此低于地质品位。损失率是未能采出的地质矿量比例，回收率按 1−损失率 计算。请按工程部位分别填写：切割用于采准与切割矿石，回采用于采场，顶底柱、矿柱、点柱对应相应矿柱。
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {INDICATOR_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className={`rounded-lg border px-3 py-3 ${cardSurface}`}
                    data-testid={`indicator-card-${field.key}`}
                  >
                    <h3 className="mb-3 text-sm font-semibold leading-5">{field.label}</h3>
                    <div className="flex flex-col gap-4">
                      {renderNumberInput(
                        `${field.key}.dilutionRate`,
                        '贫化率',
                        '%',
                        common[field.key].dilutionRate,
                        (parsed) => onIndicatorChange(field.key, 'dilutionRate', parsed),
                        { percentage: true, ariaLabel: `${field.label}贫化率` },
                      )}
                      {renderNumberInput(
                        `${field.key}.lossRate`,
                        '损失率',
                        '%',
                        common[field.key].lossRate,
                        (parsed) => onIndicatorChange(field.key, 'lossRate', parsed),
                        { percentage: true, ariaLabel: `${field.label}损失率` },
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </>
  )
}
