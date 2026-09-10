import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, X } from 'lucide-react'
import { elementVolume } from '../../mining/cutAndFillCalc'
import type { BlockElementInput, ValidationIssue } from '../../mining/types'
import { unitAddonClass, unitInputWithAddonClass } from './unitField'

export interface BlockElementsPanelProps {
  elements: BlockElementInput[]
  issues?: ValidationIssue[]
  collapsed: boolean
  darkMode: boolean
  onToggle: () => void
  onChange: (id: string, field: 'sectionArea' | 'height' | 'quantity', value: number | null) => void
  onNameChange: (id: string, name: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
}

function formatValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return ''
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)))
}

function formatShown(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
}

function normalizeDecimalInput(raw: string): string {
  return raw.replace(/。/g, '.').replace(/，/g, '.')
}

function parseValue(raw: string): number | null {
  const normalized = normalizeDecimalInput(raw).trim()
  if (!normalized || normalized === '.' || normalized === '-' || normalized === '-.') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

function draftMatchesValue(raw: string | undefined, value: number | null): boolean {
  const draft = raw ?? ''
  const parsed = parseValue(draft)
  if (value == null) return parsed == null
  return parsed === value
}

export default function BlockElementsPanel({
  elements,
  issues = [],
  collapsed,
  darkMode,
  onToggle,
  onChange,
  onNameChange,
  onAdd,
  onRemove,
}: BlockElementsPanelProps) {
  const locallyEdited = useRef(new Set<string>())
  const knownIds = useRef<Set<string> | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const filled = elements.filter((element) => element.sectionArea != null || element.height != null).length
  const subtotal = elements.reduce<number | null>((sum, element) => {
    const volume = elementVolume(element)
    if (volume == null) return sum
    return (sum ?? 0) + volume
  }, null)

  useEffect(() => {
    setDrafts((previous) => {
      const next = { ...previous }
      for (const element of elements) {
        const nameKey = `${element.id}.name`
        if (locallyEdited.current.has(nameKey)) {
          locallyEdited.current.delete(nameKey)
        } else {
          next[nameKey] = element.name
        }
        for (const field of ['sectionArea', 'height', 'quantity'] as const) {
          const key = `${element.id}.${field}`
          if (locallyEdited.current.has(key) || draftMatchesValue(next[key], element[field])) {
            locallyEdited.current.delete(key)
          } else {
            next[key] = formatValue(element[field])
          }
        }
      }
      return next
    })
  }, [elements])

  useEffect(() => {
    const ids = new Set(elements.map((element) => element.id))
    if (knownIds.current) {
      const added = elements.find((element) => !knownIds.current!.has(element.id))
      if (added) {
        const input = document.querySelector<HTMLInputElement>(`[data-testid="block-${added.id}-name"]`)
        input?.focus()
      }
    }
    knownIds.current = ids
  }, [elements])

  const surface = darkMode ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500'
  const inputSurface = darkMode ? 'border-gray-600 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-900'
  const cardSurface = darkMode ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50/70'
  const unitClass = unitAddonClass(darkMode)

  const renderField = (element: BlockElementInput, field: 'sectionArea' | 'height' | 'quantity', label: string, unit: string) => {
    const draftKey = `${element.id}.${field}`
    const raw = drafts[draftKey] ?? formatValue(element[field])
    const issue = issues.find((item) => item.field === `blockElements.${element.id}.${field}` || item.field === `blockElements.${element.kind}.${field}`)
    const parsed = parseValue(raw)
    const invalid = Boolean(issue) || (raw.trim() !== '' && parsed == null)
    return (
      <label className="flex min-w-0 flex-col gap-1">
        <span className="block truncate text-sm font-medium leading-none">{label}</span>
        <span className="flex h-[38px] min-w-0 items-center">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${element.name}${label}`}
            aria-invalid={invalid}
            data-testid={`block-${element.id}-${field}`}
            value={raw}
            onChange={(event) => {
              const next = normalizeDecimalInput(event.target.value)
              locallyEdited.current.add(draftKey)
              setDrafts((previous) => ({ ...previous, [draftKey]: next }))
              onChange(element.id, field, parseValue(next))
            }}
            className={`${unitInputWithAddonClass(`focus:ring-2 ${inputSurface}`)} ${
              invalid ? 'border-red-500 focus:ring-red-400/30' : 'focus:border-blue-500 focus:ring-blue-500/30'
            }`}
          />
          <span className={unitClass}>{unit}</span>
        </span>
      </label>
    )
  }

  return (
    <section className={`rounded-lg border shadow-sm ${surface}`} data-testid="block-elements-panel">
      <button
        type="button"
        onClick={onToggle}
        className={`flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left ${darkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}`}
        aria-expanded={!collapsed}
        aria-controls="block-elements-content"
      >
        {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="font-semibold">矿块构成</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${muted}`}>
          断面 × 高 × 数量 · {filled} 项已填
        </span>
      </button>

      {!collapsed ? (
        <div id="block-elements-content" className="border-t border-inherit px-4 pb-4 pt-3 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className={`min-w-0 flex-1 text-sm leading-6 ${muted}`}>
              各部位手填断面、高、数量。构成体积 = 断面 × 高 × 数量，写入下方回采工作。名称可改；未填断面或高的项不进入结果表。
            </p>
            <button
              type="button"
              onClick={onAdd}
              data-testid="add-block-element"
              className={`shrink-0 text-base font-medium hover:underline ${darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'}`}
            >
              + 新增
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {elements.map((element) => {
              const nameKey = `${element.id}.name`
              const nameDraft = drafts[nameKey] ?? element.name
              return (
                <div
                  key={element.id}
                  className={`relative rounded-lg border px-3 pb-3 pt-8 ${cardSurface}`}
                  data-testid={`block-card-${element.id}`}
                >
                  <button
                    type="button"
                    onClick={() => onRemove(element.id)}
                    aria-label={`删除${element.name.trim() || '未命名构成'}`}
                    data-testid={`remove-block-${element.id}`}
                    className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded ${
                      darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-red-300' : 'text-gray-500 hover:bg-slate-100 hover:text-red-600'
                    }`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                  <label className="mb-4 flex min-w-0 flex-col gap-1">
                    <span className={`text-sm leading-none ${muted}`}>名称</span>
                    <span className="flex h-[38px] min-w-0 items-center">
                      <input
                        value={nameDraft}
                        onChange={(event) => {
                          const next = event.target.value
                          locallyEdited.current.add(nameKey)
                          setDrafts((previous) => ({ ...previous, [nameKey]: next }))
                          onNameChange(element.id, next)
                        }}
                        aria-label={`${element.name.trim() || '未命名构成'}名称`}
                        data-testid={`block-${element.id}-name`}
                        placeholder={nameDraft.trim() ? undefined : '请输入名称'}
                        className={`${unitInputWithAddonClass(`focus:ring-2 ${inputSurface}`)} focus:border-blue-500 focus:ring-blue-500/30`}
                      />
                      <span className={unitClass} aria-hidden>
                        <Pencil className="h-3.5 w-3.5" />
                      </span>
                    </span>
                  </label>
                  <div className="flex flex-col gap-4">
                    {renderField(element, 'sectionArea', '断面', 'm²')}
                    {renderField(element, 'height', '高', 'm')}
                    {renderField(element, 'quantity', '数量', '个')}
                    <div className={`flex items-baseline justify-between gap-2 rounded-md border px-2.5 py-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <span className={`shrink-0 text-sm leading-none ${muted}`}>构成体积</span>
                      <span className="min-w-0 text-right text-sm font-medium tabular-nums">{formatShown(elementVolume(element))} m³</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div
            data-testid="block-elements-subtotal"
            className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-sm ${
              darkMode ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-slate-50'
            }`}
          >
            <span className="font-medium">小计</span>
            <span className="tabular-nums font-medium">{formatShown(subtotal)} m³</span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
