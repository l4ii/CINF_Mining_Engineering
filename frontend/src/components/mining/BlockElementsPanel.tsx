import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { computeGeometry, elementVolume, sectionOreVolume } from '../../mining/cutAndFillCalc'
import { isPanelElement, isPillarElement, isStopeElement, PILLAR_SHAPE_OPTIONS } from '../../mining/methodConfigs'
import type { BlockElementInput, MiningMethodInput, PillarShape, ValidationIssue } from '../../mining/types'
import { formatPercent, parsePercent } from './LossDilutionFields'

export type BlockDimensionField = 'length' | 'width' | 'height' | 'quantity' | 'wasteVolume' | 'dilutionRate' | 'lossRate'

export interface BlockElementsPanelProps {
  elements: BlockElementInput[]
  input: MiningMethodInput
  issues?: ValidationIssue[]
  collapsed: boolean
  darkMode: boolean
  onToggle: () => void
  onChange: (id: string, field: BlockDimensionField, value: number | null) => void
  onShapeChange: (id: string, shape: PillarShape) => void
  onNameChange: (id: string, name: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
}

const FIELD_H = 'h-8'
const STOPE_HINT = '采场体积 = 矿块矿石体积 − Σ矿柱矿石体积 − 采准矿石体积 − 切割矿石体积。伴采岩石不参与扣减。'

function formatValue(value: number | null | undefined): string {
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

function draftMatchesPercent(raw: string | undefined, value: number | null): boolean {
  const parsed = parsePercent(raw ?? '')
  if (value == null) return parsed == null
  return parsed === value
}

function draftMatchesValue(raw: string | undefined, value: number | null | undefined): boolean {
  const draft = raw ?? ''
  const parsed = parseValue(draft)
  if (value == null) return parsed == null
  return parsed === value
}

function dimensionLabels(element: BlockElementInput): { length: string; width: string; height: string } {
  if (element.shape === 'cylinder') return { length: '长', width: '直径', height: '高' }
  if (element.shape === 'triangular-prism') return { length: '长度', width: '底边', height: '截面高' }
  return { length: '长', width: '宽', height: '高' }
}

function pillarFallbackName(index: number): string {
  return `矿柱${index + 1}`
}

function ShapeSelect({
  element,
  labelName,
  darkMode,
  inputSurface,
  onChange,
}: {
  element: BlockElementInput
  labelName: string
  darkMode: boolean
  inputSurface: string
  onChange: (shape: PillarShape) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const current = PILLAR_SHAPE_OPTIONS.find((option) => option.id === element.shape)?.label ?? '长方体'

  const updateMenuPos = () => {
    const box = boxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
  }

  useEffect(() => {
    if (!open) return
    updateMenuPos()
    const close = () => setOpen(false)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (boxRef.current?.contains(target)) return
      const menu = document.getElementById(`block-shape-menu-${element.id}`)
      if (menu?.contains(target)) return
      close()
    }
    window.addEventListener('resize', updateMenuPos)
    document.addEventListener('scroll', close, true)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('resize', updateMenuPos)
      document.removeEventListener('scroll', close, true)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, element.id])

  const menu =
    open && menuPos
      ? createPortal(
          <ul
            id={`block-shape-menu-${element.id}`}
            role="listbox"
            data-testid="block-shape-menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 70 }}
            className={`overflow-hidden rounded-md border py-1 text-center shadow-lg ${
              darkMode ? 'border-gray-600 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
            }`}
          >
            {PILLAR_SHAPE_OPTIONS.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.id === element.shape}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                  className={`block w-full px-2 py-1.5 text-center text-sm ${
                    option.id === element.shape
                      ? darkMode
                        ? 'bg-blue-950/60 text-blue-100'
                        : 'bg-blue-600 text-white'
                      : darkMode
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null

  return (
    <div ref={boxRef} className="relative w-full">
      <button
        type="button"
        aria-label={`${labelName}计算方法`}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-testid={`block-${element.id}-shape`}
        onClick={() => setOpen((value) => !value)}
        className={`${FIELD_H} relative w-full rounded-md border px-5 text-center text-sm outline-none focus:border-blue-500 ${inputSurface}`}
      >
        {current}
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-70" aria-hidden />
      </button>
      {menu}
    </div>
  )
}

export default function BlockElementsPanel({
  elements,
  input,
  issues = [],
  collapsed,
  darkMode,
  onToggle,
  onChange,
  onShapeChange,
  onNameChange,
  onAdd,
  onRemove,
}: BlockElementsPanelProps) {
  const locallyEdited = useRef(new Set<string>())
  const knownIds = useRef<Set<string> | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const geometry = computeGeometry(input)
  const stopeVolume = geometry.primaryStopeVolume
  const panel = elements.find(isPanelElement)
  const stope = elements.find(isStopeElement)
  const pillars = elements.filter(isPillarElement)

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
        for (const field of ['length', 'width', 'height', 'quantity', 'wasteVolume'] as const) {
          const key = `${element.id}.${field}`
          if (locallyEdited.current.has(key) || draftMatchesValue(next[key], element[field])) {
            locallyEdited.current.delete(key)
          } else {
            next[key] = formatValue(element[field])
          }
        }
        for (const field of ['dilutionRate', 'lossRate'] as const) {
          const key = `${element.id}.${field}`
          if (locallyEdited.current.has(key) || draftMatchesPercent(next[key], element[field])) {
            locallyEdited.current.delete(key)
          } else {
            next[key] = formatPercent(element[field])
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
        const inputEl = document.querySelector<HTMLInputElement>(`[data-testid="block-${added.id}-name"]`)
        inputEl?.focus()
      }
    }
    knownIds.current = ids
  }, [elements])

  const surface = darkMode ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500'
  const inputSurface = darkMode ? 'border-gray-600 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-900'
  const border = darkMode ? 'border-gray-700' : 'border-gray-200'
  const header = darkMode ? 'bg-gray-800 text-gray-300' : 'bg-slate-50 text-slate-600'
  const unitSurface = darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500'
  const cellInputClass = `${FIELD_H} w-full rounded-md border px-1.5 text-center text-sm outline-none focus:ring-2 tabular-nums ${inputSurface}`

  const centeredMark = (text = '—') => (
    <span className={`inline-flex ${FIELD_H} w-full items-center justify-center ${muted}`}>{text}</span>
  )

  const renderNumber = (
    element: BlockElementInput,
    field: BlockDimensionField,
    label: string,
    options: { hidden?: boolean; labelName?: string; placeholder?: string } = {},
  ) => {
    if (options.hidden) return centeredMark()
    const draftKey = `${element.id}.${field}`
    const raw = drafts[draftKey] ?? formatValue(element[field])
    const issue = issues.find((item) => item.field === `blockElements.${element.id}.${field}`)
    const parsed = parseValue(raw)
    const invalid = Boolean(issue) || (raw.trim() !== '' && parsed == null)
    const labelName = options.labelName ?? element.name
    return (
      <input
        type="text"
        inputMode="decimal"
        aria-label={`${labelName}${label}`}
        aria-invalid={invalid}
        data-testid={`block-${element.id}-${field}`}
        placeholder={options.placeholder}
        value={raw}
        onChange={(event) => {
          const next = normalizeDecimalInput(event.target.value)
          locallyEdited.current.add(draftKey)
          setDrafts((previous) => ({ ...previous, [draftKey]: next }))
          onChange(element.id, field, parseValue(next))
        }}
        className={`${cellInputClass} ${invalid ? 'border-red-500 focus:ring-red-400/30' : 'focus:border-blue-500 focus:ring-blue-500/30'}`}
      />
    )
  }

  const renderPercent = (
    element: BlockElementInput,
    field: 'dilutionRate' | 'lossRate',
    label: string,
    options: { hidden?: boolean; labelName?: string } = {},
  ) => {
    if (options.hidden) return centeredMark()
    const draftKey = `${element.id}.${field}`
    const raw = drafts[draftKey] ?? formatPercent(element[field])
    const issue = issues.find((item) => item.field === `blockElements.${element.id}.${field}`)
    const parsed = parsePercent(raw)
    const invalid = Boolean(issue) || (raw.trim() !== '' && parsed == null)
    const labelName = options.labelName ?? element.name
    return (
      <input
        type="text"
        inputMode="decimal"
        aria-label={`${labelName}${label}`}
        aria-invalid={invalid}
        data-testid={`block-${element.id}-${field}`}
        value={raw}
        onChange={(event) => {
          const next = normalizeDecimalInput(event.target.value)
          locallyEdited.current.add(draftKey)
          setDrafts((previous) => ({ ...previous, [draftKey]: next }))
          onChange(element.id, field, parsePercent(next))
        }}
        className={`${cellInputClass} ${invalid ? 'border-red-500 focus:ring-red-400/30' : 'focus:border-blue-500 focus:ring-blue-500/30'}`}
      />
    )
  }

  const renderShapeSelect = (element: BlockElementInput, labelName: string) => (
    <ShapeSelect
      element={element}
      labelName={labelName}
      darkMode={darkMode}
      inputSurface={inputSurface}
      onChange={(shape) => onShapeChange(element.id, shape)}
    />
  )

  const renderNameCell = (element: BlockElementInput, options: { editable?: boolean; labelName?: string }) => {
    if (!options.editable) return <td className="px-2 py-2">{centeredMark()}</td>
    const nameKey = `${element.id}.name`
    const nameDraft = drafts[nameKey] ?? element.name
    const labelName = options.labelName ?? (element.name.trim() || '矿柱')
    return (
      <td className="px-2 py-2">
        <input
          value={nameDraft}
          onChange={(event) => {
            const next = event.target.value
            locallyEdited.current.add(nameKey)
            setDrafts((previous) => ({ ...previous, [nameKey]: next }))
            onNameChange(element.id, next)
          }}
          aria-label={`${labelName}名称`}
          data-testid={`block-${element.id}-name`}
          placeholder="如顶柱、底柱、点柱"
          className={`h-8 w-full rounded-md border px-2 text-center outline-none focus:border-blue-500 ${inputSurface}`}
        />
      </td>
    )
  }

  const renderMetricCells = (
    element: BlockElementInput,
    options: { locked?: boolean; labelName?: string; named?: boolean } = {},
  ) => {
    const labels = dimensionLabels(element)
    const volume = elementVolume(element)
    const lengthHidden = element.shape === 'cylinder'
    const labelName = options.labelName ?? element.name
    return (
      <>
        {renderNameCell(element, { editable: options.named, labelName })}
        <td className="px-2 py-2 text-center">
          {renderShapeSelect(element, labelName)}
        </td>
        <td className="px-2 py-2">{renderNumber(element, 'length', labels.length, { hidden: lengthHidden, labelName })}</td>
        <td className="px-2 py-2">
          {renderNumber(element, 'width', labels.width, {
            labelName,
            placeholder: element.shape === 'cylinder' ? '直径' : undefined,
          })}
        </td>
        <td className="px-2 py-2">{renderNumber(element, 'height', labels.height, { labelName })}</td>
        <td className="px-2 py-2">
          {renderNumber(element, 'quantity', '数量', {
            hidden: isPanelElement(element),
            labelName,
          })}
        </td>
        <td className={`px-2 py-2 ${darkMode ? 'bg-emerald-950/30' : 'bg-emerald-50/60'}`}>
          <span
            data-testid={`block-${element.id}-volume`}
            tabIndex={-1}
            className={`inline-flex ${FIELD_H} w-full items-center justify-center tabular-nums font-medium`}
          >
            {formatShown(volume)}
          </span>
        </td>
        <td className={`px-2 py-2 ${darkMode ? 'bg-amber-950/30' : 'bg-amber-50/60'}`}>
          {renderNumber(element, 'wasteVolume', '伴采岩石体积', { hidden: isPanelElement(element), labelName, placeholder: '0' })}
        </td>
        <td className="px-2 py-2">
          {renderPercent(element, 'dilutionRate', '贫化率', {
            hidden: isPanelElement(element),
            labelName,
          })}
        </td>
        <td className="px-2 py-2">
          {renderPercent(element, 'lossRate', '损失率', {
            hidden: isPanelElement(element),
            labelName,
          })}
        </td>
        <td className="px-2 py-2 text-center">
          {options.locked ? (
            centeredMark()
          ) : (
            <span className={`inline-flex ${FIELD_H} w-full items-center justify-center`}>
              <button
                type="button"
                onClick={() => onRemove(element.id)}
                aria-label={`删除${labelName}`}
                data-testid={`remove-block-${element.id}`}
                className={`grid ${FIELD_H} w-8 place-items-center rounded ${
                  darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-red-300' : 'text-gray-500 hover:bg-slate-100 hover:text-red-600'
                }`}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </span>
          )}
        </td>
      </>
    )
  }

  const partCell = (label: string, testId: string, rowSpan = 1) => (
    <td rowSpan={rowSpan} className="px-2 py-2 align-middle text-center" data-testid={testId}>
      <span className={`inline-flex min-h-8 w-full items-center justify-center font-medium`}>{label}</span>
    </td>
  )

  return (
    <section className={`rounded-lg border shadow-sm ${surface}`} data-testid="block-elements-panel">
      <div className="flex min-h-12 items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
          aria-controls="block-elements-content"
        >
          {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="font-semibold">矿块结构参数</span>
        </button>
      </div>

      {!collapsed ? (
        <div id="block-elements-content" className={`border-t px-3 pb-3 pt-3 ${border}`}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <p className={`min-w-0 flex-1 text-sm leading-6 ${muted}`}>
              几何尺寸计算矿石体积；矿柱及单独核算的回采部位逐行填写。圆柱填写直径与高。伴采岩石体积单独填写，未填按 0 计。
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1140px] table-fixed border-collapse text-center text-sm" data-testid="block-elements-table">
              <colgroup>
                {[84, 136, 104, 88, 112, 88, 64, 120, 126, 88, 88, 42].map((width, index) => <col key={index} style={{ width }} />)}
              </colgroup>
              <thead className={header}>
                <tr>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`}>结构部位</th>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`}>名称</th>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`}>几何体</th>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`}>长</th>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`} title="长方体填宽，圆柱填直径">
                    宽/直径
                  </th>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`}>高</th>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`}>数量</th>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`}>矿石体积</th>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`} title="如三角矿采场伴采的围岩，计入废石量，不扣减矿石体积">伴采岩石体积</th>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`}>贫化率</th>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`}>损失率</th>
                  <th className={`border-b px-2 py-2 font-semibold ${border}`}>操作</th>
                </tr>
                <tr className={unitSurface} data-testid="block-elements-units">
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`} />
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`} />
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`} />
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`}>m</th>
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`}>m</th>
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`}>m</th>
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`}>个</th>
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`}>m³</th>
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`}>m³</th>
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`}>%</th>
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`}>%</th>
                  <th className={`border-b px-2 py-0.5 text-xs font-normal ${border}`} />
                </tr>
              </thead>
              <tbody>
                {panel ? (
                  <tr key={panel.id} className={`border-t ${border}`} data-testid={`block-row-${panel.id}`}>
                    {partCell(panel.name, `block-${panel.id}-name`)}
                    {renderMetricCells(panel, { locked: true })}
                  </tr>
                ) : null}
                {pillars.length === 0 ? (
                  <tr className={`border-t ${border}`} data-testid="block-pillar-empty-row">
                    {partCell('矿柱', 'block-pillar-group')}
                    <td colSpan={11} className={`px-3 py-4 text-left ${muted}`}>未设置矿柱或独立回采部位，按 0 m³ 扣减。</td>
                  </tr>
                ) : (
                  pillars.map((pillar, index) => (
                    <tr key={pillar.id} className={`border-t ${border}`} data-testid={`block-row-${pillar.id}`}>
                      {index === 0 ? partCell('矿柱 / 独立部位', 'block-pillar-group', pillars.length) : null}
                      {renderMetricCells(pillar, {
                        locked: false,
                        named: true,
                        labelName: pillar.name.trim() || pillarFallbackName(index),
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className={`mt-3 border-t pt-3 ${border}`} data-testid="block-volume-allocation">
            {stope ? (
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3" data-testid={`block-row-${stope.id}`}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium" data-testid={`block-${stope.id}-name`}>{stope.name}矿石体积</span>
                  <span className={`text-lg font-semibold tabular-nums ${stopeVolume != null && stopeVolume < 0 ? 'text-red-600' : ''}`} tabIndex={-1} data-testid={`block-${stope.id}-volume`} title={STOPE_HINT}>{formatShown(stopeVolume)}</span>
                  <span className={`text-xs ${muted}`}>m³ · 自动扣减</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="w-36 text-xs">伴采岩石体积（m³）<span className="mt-1 block">{renderNumber(stope, 'wasteVolume', '伴采岩石体积', { placeholder: '0' })}</span></label>
                  <label className="w-24 text-xs">贫化率（%）<span className="mt-1 block">{renderPercent(stope, 'dilutionRate', '贫化率')}</span></label>
                  <label className="w-24 text-xs">损失率（%）<span className="mt-1 block">{renderPercent(stope, 'lossRate', '损失率')}</span></label>
                </div>
              </div>
            ) : null}
            <details className={`mt-2 text-xs ${muted}`}>
              <summary className="w-fit cursor-pointer leading-5">采场体积计算依据</summary>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 leading-5 tabular-nums">
                {[
                  { label: '矿块矿石体积', value: geometry.panelOreVolume, id: 'allocation-panel' },
                  { label: '矿柱 / 独立部位', value: geometry.pillarOreVolume, id: 'allocation-pillars' },
                  { label: '采准工程矿石体积', value: sectionOreVolume(input.preparation) ?? 0, id: 'block-dev-preparation-volume' },
                  { label: '切割工程矿石体积', value: sectionOreVolume(input.cutting) ?? 0, id: 'block-dev-cutting-volume' },
                ].map((item, index) => <span key={item.id}>{index > 0 ? '− ' : ''}{item.label} <strong data-testid={item.id}>{formatShown(item.value)}</strong></span>)}
                <span>= {formatShown(stopeVolume)} m³</span>
              </p>
              <p className="mt-1 leading-5">伴采岩石另计废石和总体积，不参与矿石体积扣减。</p>
            </details>
            {pillars.some((pillar) => (pillar.length != null || pillar.width != null || pillar.height != null) && elementVolume(pillar) == null) ? <p className="mt-1 text-sm text-amber-600">部分部位尺寸未填全，尚未计入扣减，采场体积为暂算值。</p> : null}
            {issues.some((issue) => issue.code === 'negative-stope') ? <p role="alert" className="mt-2 text-sm font-medium text-red-600">扣减的矿石体积已超过矿块体积，请检查矿柱尺寸和采切工程，避免重复计入。</p> : null}
            {issues.some((issue) => issue.code === 'missing-panel') ? <p role="alert" className={`mt-2 text-sm ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>伴采岩石已计入；请补齐矿块尺寸以计算采场矿石体积。</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
