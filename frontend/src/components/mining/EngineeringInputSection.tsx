import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { applyDevelopmentLink, resolvedOreLength, resolvedWasteLength } from '../../mining/developmentLink'
import type { DevelopmentRowInput, LossDilutionIndicator, ValidationIssue } from '../../mining/types'
import { ConfirmDialog } from '../shell/AppDialog'
import LossDilutionFields from './LossDilutionFields'

export type EngineeringSection = 'preparation' | 'cutting'
type StoredField = keyof Omit<DevelopmentRowInput, 'id' | 'note'>

export interface EngineeringInputSectionProps {
  section: EngineeringSection
  rows: DevelopmentRowInput[]
  indicator: LossDilutionIndicator
  issues?: ValidationIssue[]
  collapsed: boolean
  darkMode: boolean
  onToggle: () => void
  onRowChange: (rowId: string, field: string, value: string | number | null) => void
  onAddRow: () => void
  onRemoveRow: (rowId: string) => void
  onIndicatorChange: (field: keyof LossDilutionIndicator, value: number | null) => void
}

const STORED_FIELDS: StoredField[] = [
  'name',
  'quantity',
  'oreSingleLength',
  'oreTotalLength',
  'wasteSingleLength',
  'wasteTotalLength',
  'oreSectionArea',
  'wasteSectionArea',
]

const SECTION_LABELS: Record<EngineeringSection, string> = {
  preparation: '采准工程',
  cutting: '切割工程',
}

function formatDraft(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value)
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)))
}

function formatShown(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
}

function normalizeDecimalInput(raw: string): string {
  return raw.replace(/。/g, '.').replace(/，/g, '.')
}

function parseDraft(raw: string): number | null {
  const normalized = normalizeDecimalInput(raw).trim()
  if (!normalized || normalized === '.' || normalized === '-' || normalized === '-.') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

function draftMatchesValue(raw: string | undefined, value: unknown): boolean {
  const draft = raw ?? ''
  const parsed = parseDraft(draft)
  if (value == null || value === '') return parsed == null
  if (typeof value !== 'number') return draft === String(value)
  return parsed === value
}

function rowValue(row: DevelopmentRowInput, field: string): unknown {
  if (field === 'oreTotalLength') return resolvedOreLength(row)
  if (field === 'wasteTotalLength') return resolvedWasteLength(row)
  return (row as unknown as Record<string, unknown>)[field]
}

function issueFor(issues: ValidationIssue[], section: EngineeringSection, rowId: string, field: string): ValidationIssue | undefined {
  return issues.find((issue) => issue.field === `${section}.${rowId}.${field}`)
}

function oreVolumeOf(row: DevelopmentRowInput): number | null {
  const length = resolvedOreLength(row)
  return length != null && row.oreSectionArea != null ? length * row.oreSectionArea : null
}

function wasteVolumeOf(row: DevelopmentRowInput): number | null {
  const length = resolvedWasteLength(row)
  return length != null && row.wasteSectionArea != null ? length * row.wasteSectionArea : null
}

function totalVolumeOf(row: DevelopmentRowInput): number | null {
  const ore = oreVolumeOf(row)
  const waste = wasteVolumeOf(row)
  if (ore == null && waste == null) return null
  return (ore ?? 0) + (waste ?? 0)
}

export default function EngineeringInputSection({
  section,
  rows,
  indicator,
  issues = [],
  collapsed,
  darkMode,
  onToggle,
  onRowChange,
  onAddRow,
  onRemoveRow,
  onIndicatorChange,
}: EngineeringInputSectionProps) {
  const label = SECTION_LABELS[section]
  const locallyEdited = useRef(new Set<string>())
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    setDrafts((previous) => {
      const next = { ...previous }
      const activeKeys = new Set<string>()
      for (const row of rows) {
        for (const field of STORED_FIELDS) {
          const key = `${row.id}.${field}`
          activeKeys.add(key)
          if (locallyEdited.current.has(key) || draftMatchesValue(next[key], rowValue(row, field))) {
            locallyEdited.current.delete(key)
          } else {
            next[key] = formatDraft(rowValue(row, field))
          }
        }
      }
      for (const key of Object.keys(next)) if (!activeKeys.has(key)) delete next[key]
      return next
    })
  }, [rows])

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const name = String(rowValue(row, 'name') ?? '').trim()
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([name]) => name))
  }, [rows])

  const surface = darkMode ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500'
  const cardSurface = darkMode ? 'border-gray-700 bg-gray-900/40' : 'border-gray-100 bg-gray-50/70'
  const headerSurface = darkMode ? 'bg-gray-700 text-gray-100' : 'bg-slate-100 text-slate-700'
  const unitSurface = darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500'
  const inputSurface = darkMode ? 'border-gray-600 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-900'
  const border = darkMode ? 'border-gray-700' : 'border-gray-200'
  const oreSurface = darkMode ? 'bg-emerald-950/40' : 'bg-emerald-50/80'
  const rockSurface = darkMode ? 'bg-amber-950/30' : 'bg-amber-50/80'
  const sharedSurface = darkMode ? 'bg-gray-900' : 'bg-white'

  const handleStoredChange = (rowId: string, field: StoredField, numeric: boolean, raw: string) => {
    const draftKey = `${rowId}.${field}`
    locallyEdited.current.add(draftKey)
    const nextRaw = numeric ? normalizeDecimalInput(raw) : raw
    const parsed = numeric ? parseDraft(nextRaw) : nextRaw
    const row = rows.find((item) => item.id === rowId)
    const linked = row ? applyDevelopmentLink({ ...row, [field]: parsed }, field) : null
    setDrafts((previous) => {
      const next = { ...previous, [draftKey]: nextRaw }
      if (row && linked) {
        for (const linkedField of STORED_FIELDS) {
          if (linkedField === 'name' || linkedField === field) continue
          if (rowValue(row, linkedField) !== rowValue(linked, linkedField)) {
            next[`${rowId}.${linkedField}`] = formatDraft(rowValue(linked, linkedField))
          }
        }
      }
      return next
    })
    onRowChange(rowId, field, parsed)
  }

  const cellInput = (
    row: DevelopmentRowInput,
    field: StoredField,
    options: { numeric?: boolean; aria: string; invalid?: boolean; testId?: string },
  ) => {
    const draftKey = `${row.id}.${field}`
    const raw = drafts[draftKey] ?? formatDraft(rowValue(row, field))
    const parsed = options.numeric ? parseDraft(raw) : raw
    const issue = issueFor(issues, section, row.id, field)
    const incomplete = ['.', '-', '-.'].includes(normalizeDecimalInput(raw).trim())
    const invalid = Boolean(options.invalid) || Boolean(issue) || (Boolean(options.numeric) && raw.trim() !== '' && parsed == null && !incomplete)
    return (
      <input
        type="text"
        inputMode={options.numeric ? 'decimal' : undefined}
        value={raw}
        aria-label={options.aria}
        aria-invalid={invalid}
        data-testid={options.testId ?? `${section}-${row.id}-${field}`}
        onChange={(event) => handleStoredChange(row.id, field, Boolean(options.numeric), event.target.value)}
        className={`h-8 w-full rounded-md border px-1.5 text-center text-sm outline-none focus:ring-2 ${inputSurface} ${
          invalid ? 'border-red-500 focus:ring-red-400/30' : 'focus:border-blue-500 focus:ring-blue-500/30'
        } ${options.numeric ? 'tabular-nums' : ''}`}
      />
    )
  }

  const readCell = (value: number | null, testId: string, aria: string) => (
    <input
      type="text"
      readOnly
      disabled
      value={formatShown(value)}
      aria-label={aria}
      data-testid={testId}
      className={`h-8 w-full cursor-not-allowed rounded-md border px-1.5 text-center text-sm tabular-nums opacity-80 ${inputSurface}`}
    />
  )

  return (
    <>
    <section className={`rounded-lg border shadow-sm ${surface}`} data-testid={`engineering-section-${section}`}>
      <div className="flex min-h-12 items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
          aria-controls={`engineering-content-${section}`}
        >
          {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="font-semibold">{label}</span>
        </button>
        <LossDilutionFields
          labelPrefix={label}
          indicator={indicator}
          fieldPrefix={`${section}LossDilution`}
          issues={issues}
          darkMode={darkMode}
          onChange={onIndicatorChange}
        />
      </div>

      {!collapsed ? (
        <div id={`engineering-content-${section}`} className="border-t border-inherit px-3 pb-3 pt-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <p className={`min-w-0 flex-1 text-sm leading-6 ${muted}`}>
              矿石中计入储量，岩石中计入废石；两者相加为总体积。总长可直接填写，也可由巷道数目 × 单长联动计算。
            </p>
            <button
              type="button"
              onClick={onAddRow}
              aria-label={`添加${label}`}
              data-testid={`add-${section}-row`}
              className={`shrink-0 text-base font-medium hover:underline ${darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'}`}
            >
              + 新增
            </button>
          </div>
          <div className="space-y-3">
            {rows.length === 0 ? <p className={`rounded-md border border-dashed p-4 text-center text-sm ${muted}`}>暂无工程，请添加一条。</p> : null}
            {rows.map((row, index) => {
              const rowName = String(rowValue(row, 'name') ?? '')
              const rowHasDuplicate = duplicateNames.has(rowName.trim())
              const nameIssue = issueFor(issues, section, row.id, 'name')
              return (
                <div key={row.id} className={`relative overflow-hidden rounded-lg border ${cardSurface}`} data-testid={`${section}-card-${row.id}`}>
                  <button
                    type="button"
                    onClick={() => setPendingRemove({ id: row.id, name: rowName || '未命名' })}
                    aria-label={`删除${label}${rowName ? ` ${rowName}` : ''}`}
                    title="删除此工程"
                    data-testid={`remove-${section}-${row.id}`}
                    className={`absolute right-1 top-1 z-10 grid h-6 w-6 place-items-center rounded ${
                      darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-red-300' : 'text-gray-500 hover:bg-slate-100 hover:text-red-600'
                    }`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
                    <colgroup>
                      <col className="w-[6%]" />
                      <col className="w-[15%]" />
                      <col className="w-[8%]" />
                      <col className="w-[10%]" />
                      <col className="w-[11%]" />
                      <col className="w-[11%]" />
                      <col className="w-[11%]" />
                      <col className="w-[12%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead>
                      <tr className={headerSurface}>
                        <th className={`border ${border} px-1.5 py-1 text-center font-semibold`}>编号</th>
                        <th className={`border ${border} px-1.5 py-1 text-center font-semibold`}>工程名称</th>
                        <th className={`border ${border} px-1.5 py-1 text-center font-semibold`}>部位</th>
                        <th className={`border ${border} px-1.5 py-1 text-center font-semibold`}>巷道数目</th>
                        <th className={`border ${border} px-1.5 py-1 text-center font-semibold`}>单长</th>
                        <th className={`border ${border} px-1.5 py-1 text-center font-semibold`}>总长</th>
                        <th className={`border ${border} px-1.5 py-1 text-center font-semibold`}>断面</th>
                        <th className={`border ${border} px-1.5 py-1 text-center font-semibold`}>体积</th>
                        <th className={`border ${border} px-1.5 py-1 text-center font-semibold`}>总体积</th>
                      </tr>
                      <tr className={unitSurface}>
                        <th className={`border ${border} px-1 py-0.5 text-center text-xs font-normal`} />
                        <th className={`border ${border} px-1 py-0.5 text-center text-xs font-normal`} />
                        <th className={`border ${border} px-1 py-0.5 text-center text-xs font-normal`} />
                        <th className={`border ${border} px-1 py-0.5 text-center text-xs font-normal`}>个</th>
                        <th className={`border ${border} px-1 py-0.5 text-center text-xs font-normal`}>m</th>
                        <th className={`border ${border} px-1 py-0.5 text-center text-xs font-normal`}>m</th>
                        <th className={`border ${border} px-1 py-0.5 text-center text-xs font-normal`}>m²</th>
                        <th className={`border ${border} px-1 py-0.5 text-center text-xs font-normal`}>m³</th>
                        <th className={`border ${border} px-1 py-0.5 text-center text-xs font-normal`}>m³</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={oreSurface}>
                        <td rowSpan={2} className={`border ${border} ${sharedSurface} px-1.5 py-1 text-center align-middle text-base font-semibold tabular-nums`} data-testid={`${section}-${row.id}-index`}>
                          {index + 1}
                        </td>
                        <td rowSpan={2} className={`border ${border} ${sharedSurface} px-1.5 py-1 text-center align-middle`}>
                          <div className="flex flex-col items-center justify-center">
                            <input
                              type="text"
                              value={drafts[`${row.id}.name`] ?? rowName}
                              aria-label={`${label}-工程名称-${row.id}`}
                              aria-invalid={rowHasDuplicate || Boolean(nameIssue)}
                              aria-describedby={`${section}-${row.id}-hint`}
                              data-testid={`${section}-${row.id}-name`}
                              placeholder="请输入名称"
                              onChange={(event) => handleStoredChange(row.id, 'name', false, event.target.value)}
                              className={`h-8 w-full rounded-md border px-1.5 text-center text-sm outline-none focus:ring-2 ${inputSurface} ${
                                rowHasDuplicate || nameIssue ? 'border-red-500 focus:ring-red-400/30' : 'focus:border-blue-500 focus:ring-blue-500/30'
                              }`}
                            />
                            <span
                              id={`${section}-${row.id}-hint`}
                              data-testid={`${section}-${row.id}-hint`}
                              className={`mt-1 block h-4 w-full truncate text-center text-xs leading-4 ${
                                rowHasDuplicate || nameIssue ? 'text-red-600 dark:text-red-300' : 'text-transparent'
                              }`}
                            >
                              {rowHasDuplicate ? '名称重复' : nameIssue?.message ?? ''}
                            </span>
                          </div>
                        </td>
                        <td className={`border ${border} px-1.5 py-1 text-center font-medium`}>矿石中</td>
                        <td rowSpan={2} className={`border ${border} ${sharedSurface} px-1 py-1 align-middle`}>
                          {cellInput(row, 'quantity', { numeric: true, aria: `${label}-巷道数目-${row.id}` })}
                        </td>
                        <td className={`border ${border} px-1 py-1`}>
                          {cellInput(row, 'oreSingleLength', { numeric: true, aria: `${label}-矿石中单长-${row.id}` })}
                        </td>
                        <td className={`border ${border} px-1 py-1`}>
                          {cellInput(row, 'oreTotalLength', { numeric: true, aria: `${label}-矿石中总长-${row.id}` })}
                        </td>
                        <td className={`border ${border} px-1 py-1`}>
                          {cellInput(row, 'oreSectionArea', { numeric: true, aria: `${label}-矿石中断面-${row.id}` })}
                        </td>
                        <td className={`border ${border} px-1 py-1`}>
                          {readCell(oreVolumeOf(row), `${section}-${row.id}-oreVolume`, `${label}-矿石中体积-${row.id}`)}
                        </td>
                        <td rowSpan={2} className={`border ${border} ${sharedSurface} px-1.5 py-1 align-middle`}>
                          {readCell(totalVolumeOf(row), `${section}-${row.id}-totalVolume`, `${label}-总体积-${row.id}`)}
                        </td>
                      </tr>
                      <tr className={rockSurface}>
                        <td className={`border ${border} px-1.5 py-1 text-center font-medium`}>岩石中</td>
                        <td className={`border ${border} px-1 py-1`}>
                          {cellInput(row, 'wasteSingleLength', { numeric: true, aria: `${label}-岩石中单长-${row.id}` })}
                        </td>
                        <td className={`border ${border} px-1 py-1`}>
                          {cellInput(row, 'wasteTotalLength', { numeric: true, aria: `${label}-岩石中总长-${row.id}` })}
                        </td>
                        <td className={`border ${border} px-1 py-1`}>
                          {cellInput(row, 'wasteSectionArea', { numeric: true, aria: `${label}-岩石中断面-${row.id}` })}
                        </td>
                        <td className={`border ${border} px-1 py-1`}>
                          {readCell(wasteVolumeOf(row), `${section}-${row.id}-wasteVolume`, `${label}-岩石中体积-${row.id}`)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
    <ConfirmDialog
      open={pendingRemove != null}
      title={`删除${label}`}
      message={`确定删除${label}“${pendingRemove?.name ?? '未命名'}”吗？`}
      confirmLabel="删除"
      darkMode={darkMode}
      onCancel={() => setPendingRemove(null)}
      onConfirm={() => {
        if (pendingRemove) onRemoveRow(pendingRemove.id)
        setPendingRemove(null)
      }}
    />
    </>
  )
}
