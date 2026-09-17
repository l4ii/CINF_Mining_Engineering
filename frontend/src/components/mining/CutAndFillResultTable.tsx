import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { explainResultCell, traceResultCell, resultCellId, RESULT_COLUMNS, RESULT_LABELS, SECTION_LABELS, type ResultSectionKey, type ResultCellOptions } from '../../mining/resultTableExplain'
import type { CalculatedRow, CutAndFillResult, DevelopmentRowInput, MiningMethodInput, SectionTotals } from '../../mining/types'

interface CutAndFillResultTableProps {
  input: MiningMethodInput
  result: CutAndFillResult
  darkMode: boolean
  headerAction?: ReactNode
  onLocateInput?: (inputId: string) => void
}

const COLUMN_COUNT = 17
const DEFAULT_HINT = '悬停查看公式 · 单击或双击固定并高亮来源 · Esc 收起'

function HeaderText({
  label,
  lines,
  unit,
}: {
  label?: string
  lines?: string[]
  unit?: string
}) {
  const text = lines ?? (label ? [label] : [])
  return (
    <span className="inline-flex flex-col items-center">
      {text.map((line) => (
        <span key={line} className="block whitespace-nowrap leading-tight">
          {line}
        </span>
      ))}
      {unit ? <span className="mt-0.5 block whitespace-nowrap text-[0.9em] font-normal leading-none opacity-70">{unit}</span> : null}
    </span>
  )
}

type SourceSection = 'preparation' | 'cutting' | 'stoping'

function displayNumber(value: number | null, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: 0, useGrouping: false })
}

function displayPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}%`
}

function developmentInput(input: MiningMethodInput, section: 'preparation' | 'cutting', id: string): DevelopmentRowInput | undefined {
  return input[section].find((row) => row.id === id)
}

function rowValues(input: MiningMethodInput, section: SourceSection, row: CalculatedRow): Array<string> {
  const values: Array<string> = []
  const dev = section === 'preparation' || section === 'cutting' ? developmentInput(input, section, row.id) : undefined
  values.push(row.name)
  values.push(dev ? displayNumber(dev.quantity) : '—')
  values.push(dev ? displayNumber(dev.oreSingleLength) : '—')
  values.push(displayNumber(row.totalOreLength))
  values.push(dev ? displayNumber(dev.wasteSingleLength) : '—')
  values.push(displayNumber(row.totalWasteLength))
  values.push(displayNumber(row.totalLength))
  values.push(dev ? displayNumber(dev.oreSectionArea) : '—')
  values.push(dev ? displayNumber(dev.wasteSectionArea) : '—')
  values.push(displayNumber(row.oreVolume))
  values.push(displayNumber(row.wasteVolume))
  values.push(displayNumber(row.totalVolume))
  values.push(displayNumber(row.geologicalReserve))
  values.push(displayNumber(row.producedGeologicalReserve))
  values.push(displayNumber(row.producedOre))
  values.push(displayNumber(row.wasteMass))
  values.push(displayPercent(row.share))
  return values
}

function totalValues(label: string, totals: SectionTotals): Array<string> {
  return [
    label,
    '—',
    '—',
    displayNumber(totals.totalOreLength),
    '—',
    displayNumber(totals.totalWasteLength),
    displayNumber(totals.totalLength),
    '—',
    '—',
    displayNumber(totals.oreVolume),
    displayNumber(totals.wasteVolume),
    displayNumber(totals.totalVolume),
    displayNumber(totals.geologicalReserve),
    displayNumber(totals.producedGeologicalReserve),
    displayNumber(totals.producedOre),
    displayNumber(totals.wasteMass),
    '—',
  ]
}

export default function CutAndFillResultTable({ input, result, darkMode, headerAction, onLocateInput }: CutAndFillResultTableProps) {
  const traceRef = useRef<HTMLDivElement>(null)
  const tooltipId = useId()
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [tooltipHidden, setTooltipHidden] = useState(false)
  const [selected, setSelected] = useState<{
    section: ResultSectionKey; rowId: string; columnIndex: number; anchor: HTMLTableCellElement; pinned: boolean
  } | null>(null)
  const selectedRow = selected && selected.rowId !== 'total' ? result.sections[selected.section].rows.find((row) => row.id === selected.rowId) : undefined
  const selectedOptions: ResultCellOptions | null = selected && (selected.rowId === 'total' || selectedRow) ? {
    input, result, columnIndex: selected.columnIndex,
    source: selected.rowId === 'total' ? 'total' : selected.section as SourceSection,
    row: selectedRow, totals: result.sections[selected.section].totals, totalKey: selected.section,
  } : null
  const trace = selectedOptions ? traceResultCell(selectedOptions) : null
  const selectedId = selected ? resultCellId(selected.section, selected.rowId, RESULT_COLUMNS[selected.columnIndex]) : null
  const dependencyIds = new Set(trace?.dependencies.map((cell) => cell.resultCell).filter(Boolean))
  const cancelClose = () => clearTimeout(closeTimer.current)
  const closeHover = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setSelected((current) => current?.pinned ? current : null), 120)
  }
  useLayoutEffect(() => {
    if (!traceRef.current || !selected || !trace) return
    setTooltipHidden(false)
    const anchor = selected.anchor.getBoundingClientRect()
    const popup = traceRef.current.getBoundingClientRect()
    const below = anchor.bottom + 6
    setPosition({
      left: Math.max(8, Math.min(anchor.left + anchor.width / 2 - popup.width / 2, window.innerWidth - popup.width - 8)),
      top: Math.max(8, below + popup.height < window.innerHeight - 8 ? below : anchor.top - popup.height - 6),
    })
  }, [selected, trace?.formula])
  useEffect(() => {
    if (!selected) return
    const dismiss = (event: Event) => {
      const target = event.target as Node | null
      if (target && traceRef.current?.contains(target)) return
      if (event.type === 'pointerdown' && target && selected.anchor.contains(target)) return
      if (event.type === 'scroll' && selected.pinned) { setTooltipHidden(true); return }
      setSelected(null)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null) }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    document.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
      document.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [selected])
  useEffect(() => () => clearTimeout(closeTimer.current), [])
  const sections: Array<{
    key: ResultSectionKey
    label: string
    rows: Array<{ row: CalculatedRow; source: SourceSection }>
    totals: SectionTotals
    totalsOnly?: boolean
  }> = [
    {
      key: 'preparation',
      label: '一、采准工程',
      rows: result.sections.preparation.rows.map((row) => ({ row, source: 'preparation' as const })),
      totals: result.sections.preparation.totals,
    },
    {
      key: 'cutting',
      label: '二、切割工程',
      rows: result.sections.cutting.rows.map((row) => ({ row, source: 'cutting' as const })),
      totals: result.sections.cutting.totals,
    },
    {
      key: 'developmentTotal',
      label: '三、采切合计',
      rows: [],
      totals: result.sections.developmentTotal.totals,
      totalsOnly: true,
    },
    {
      key: 'stoping',
      label: '四、回采工作',
      rows: result.sections.stoping.rows.map((row) => ({ row, source: 'stoping' as const })),
      totals: result.sections.stoping.totals,
    },
    {
      key: 'block',
      label: '五、盘区总计',
      rows: [],
      totals: result.sections.block.totals,
      totalsOnly: true,
    },
  ]
  const surface = darkMode ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
  const headerSurface = darkMode ? 'bg-gray-700 text-gray-100' : 'bg-slate-100 text-slate-800'
  const subHeaderSurface = darkMode ? 'bg-gray-800 text-gray-300' : 'bg-slate-50 text-slate-600'
  const hintSurface = darkMode ? 'border-gray-700 bg-gray-900/70 text-slate-200' : 'border-gray-100 bg-slate-50 text-slate-600'
  const hoverCell = darkMode ? 'hover:bg-slate-600/60' : 'hover:bg-slate-200/80'
  const border = darkMode ? 'border-gray-700' : 'border-gray-200'
  const sectionTone: Record<string, { band: string; rows: string; total: string }> = darkMode
    ? {
        preparation: { band: 'bg-slate-700/90 text-slate-100', rows: 'bg-slate-800/55', total: 'bg-slate-700/70' },
        cutting: { band: 'bg-slate-700/70 text-slate-100', rows: 'bg-slate-800/25', total: 'bg-slate-700/45' },
        developmentTotal: { band: 'bg-slate-600/80 text-slate-100', rows: 'bg-slate-700/40', total: 'bg-slate-600/55' },
        stoping: { band: 'bg-slate-700/90 text-slate-100', rows: 'bg-slate-800/55', total: 'bg-slate-700/70' },
        block: { band: 'bg-slate-600/80 text-slate-100', rows: 'bg-slate-700/40', total: 'bg-slate-600/55' },
      }
    : {
        preparation: { band: 'bg-slate-100 text-slate-800', rows: 'bg-slate-50', total: 'bg-slate-100/90' },
        cutting: { band: 'bg-slate-50 text-slate-800', rows: 'bg-white', total: 'bg-slate-50' },
        developmentTotal: { band: 'bg-slate-200/80 text-slate-800', rows: 'bg-slate-100', total: 'bg-slate-200/70' },
        stoping: { band: 'bg-slate-100 text-slate-800', rows: 'bg-slate-50', total: 'bg-slate-100/90' },
        block: { band: 'bg-slate-200/80 text-slate-800', rows: 'bg-slate-100', total: 'bg-slate-200/70' },
      }
  const th = `border ${border} px-0.5 py-1.5 text-center font-semibold leading-tight whitespace-nowrap`

  const oreTone = darkMode ? 'bg-emerald-950/50' : 'bg-emerald-50/70'
  const rockTone = darkMode ? 'bg-amber-950/40' : 'bg-amber-50/80'
  const renderCell = (value: string, index: number, section: ResultSectionKey, rowId: string, options: ResultCellOptions, background: string) => {
    const formula = explainResultCell(options)
    const id = resultCellId(section, rowId, RESULT_COLUMNS[index])
    const role = id === selectedId && trace ? 'selected' : dependencyIds.has(id) ? 'dependency' : undefined
    const select = (anchor: HTMLTableCellElement, pinned: boolean) => {
      cancelClose()
      if (formula) setSelected({ section, rowId, columnIndex: index, anchor, pinned })
      else if (!pinned) setSelected(null)
    }
    return (
      <td key={id} data-result-cell={id} data-trace-role={role}
        className={`border ${border} px-0.5 py-2 ${index === 0 ? `break-words text-left font-medium ${background}` : 'whitespace-nowrap text-right tabular-nums'}
          ${rowId === 'total' ? 'font-semibold' : ''} ${[2, 3, 7, 9].includes(index) ? oreTone : [4, 5, 8, 10, 15].includes(index) ? rockTone : ''}
          ${formula ? `cursor-pointer focus:outline-blue-500 ${hoverCell}` : ''}
          ${role === 'selected' ? 'outline outline-2 -outline-offset-2 outline-blue-500' : role === 'dependency' ? 'outline outline-2 -outline-offset-2 outline-amber-500' : ''}`}
        title={index === 0 ? value : undefined} tabIndex={formula ? 0 : undefined}
        aria-describedby={id === selectedId && trace && !tooltipHidden ? tooltipId : undefined}
        onMouseEnter={(event) => { cancelClose(); if (!selected?.pinned) select(event.currentTarget, false) }} onMouseLeave={closeHover}
        onFocus={(event) => { if (!selected?.pinned) select(event.currentTarget, false) }} onBlur={closeHover}
        onClick={(event) => select(event.currentTarget, true)} onDoubleClick={(event) => select(event.currentTarget, true)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(event.currentTarget, true) } }}>
        {value}
      </td>
    )
  }

  return (
    <section className={`min-w-0 rounded-lg border shadow-sm ${surface}`} data-testid="cut-and-fill-result-table" onKeyDown={(event) => { if (event.key === 'Escape') setSelected(null) }}>
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-inherit px-4 py-3">
        <h2 className="font-semibold">工程计算表</h2>
        {headerAction}
      </div>
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2 text-xs ${hintSurface}`}>
        <span className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded border border-emerald-400 ${oreTone}`} />矿石中</span>
        <span className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded border border-amber-400 ${rockTone}`} />岩石中</span>
        <span data-testid="result-table-hint">{DEFAULT_HINT}</span>
      </div>
      <div className="min-w-0" style={{ containerType: 'inline-size' }} data-testid="result-table-scroll">
        <table className="w-full table-fixed border-separate border-spacing-0" style={{ fontSize: 'clamp(9px, 1cqw, 14px)' }} data-testid="calculation-result-table">
          <colgroup>
            {[11, 3, 4.5, 5, 4.5, 5, 5, 3.5, 3.5, 6.5, 6.5, 6.5, 7.5, 7.5, 7.5, 7.5, 5.5].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className={headerSurface}>
              <th rowSpan={3} className={`${th} align-middle ${headerSurface}`}>工程项目</th>
              <th rowSpan={3} className={`${th} align-middle`} title="巷道数目"><HeaderText lines={['巷道', '数目']} unit="个" /></th>
              <th colSpan={5} className={th}>巷道长度</th>
              <th colSpan={2} className={th}>巷道断面</th>
              <th colSpan={3} className={th}>体积</th>
              <th colSpan={5} className={th}>矿量与废石</th>
            </tr>
            <tr className={subHeaderSurface}>
              <th colSpan={2} className={`${th} ${oreTone}`}>矿石中</th>
              <th colSpan={2} className={`${th} ${rockTone}`}>岩石中</th>
              <th rowSpan={2} className={`${th} align-middle`}><HeaderText label="总长" unit="m" /></th>
              <th rowSpan={2} className={`${th} align-middle`}><HeaderText label="矿石中" unit="m²" /></th>
              <th rowSpan={2} className={`${th} align-middle`}><HeaderText label="岩石中" unit="m²" /></th>
              <th rowSpan={2} className={`${th} align-middle`}><HeaderText label="矿石中" unit="m³" /></th>
              <th rowSpan={2} className={`${th} align-middle`}><HeaderText label="岩石中" unit="m³" /></th>
              <th rowSpan={2} className={`${th} align-middle`}><HeaderText label="总计" unit="m³" /></th>
              <th rowSpan={2} className={`${th} align-middle`}><HeaderText lines={['地质', '储量']} unit="t" /></th>
              <th rowSpan={2} className={`${th} align-middle`}><HeaderText lines={['采出地质', '储量']} unit="t" /></th>
              <th rowSpan={2} className={`${th} align-middle`}><HeaderText lines={['采出', '矿量']} unit="t" /></th>
              <th rowSpan={2} className={`${th} align-middle`}><HeaderText lines={['采出', '废石']} unit="t" /></th>
              <th rowSpan={2} className={`${th} align-middle`} title="占矿块采出矿量比例"><HeaderText label="比例" unit="%" /></th>
            </tr>
            <tr className={subHeaderSurface}>
              <th className={th}><HeaderText label="单长" unit="m" /></th>
              <th className={th}><HeaderText label="总长" unit="m" /></th>
              <th className={th}><HeaderText label="单长" unit="m" /></th>
              <th className={th}><HeaderText label="总长" unit="m" /></th>
            </tr>
          </thead>
          <tbody>
            {sections.map(({ key, label, rows, totals, totalsOnly }) => {
              const tone = sectionTone[key] ?? sectionTone.preparation
              return (
              <Fragment key={key}>
                {!totalsOnly ? <tr className={tone.band} data-testid={`result-section-${key}`}>
                  <th colSpan={COLUMN_COUNT} className={`border ${border} px-2 py-1.5 text-left font-semibold`}>{label}</th>
                </tr> : null}
                {rows.length === 0 && !totalsOnly ? (
                  <tr className={tone.rows}>
                    <td colSpan={COLUMN_COUNT} className={`border ${border} px-2 py-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      暂无明细
                    </td>
                  </tr>
                ) : null}
                {rows.map(({ row, source }) => {
                  const values = rowValues(input, source, row)
                  return (
                    <tr key={`${key}-${source}-${row.id}`} data-testid={`result-row-${key}-${row.id}`} className={tone.rows}>
                      {values.map((value, index) => {
                        return renderCell(value, index, key, row.id, { columnIndex: index, source, row, input, result }, darkMode ? 'bg-gray-800' : 'bg-white')
                      })}
                    </tr>
                  )
                })}
                <tr className={tone.total} data-testid={`result-total-${key}`}>
                  {totalValues(totalsOnly ? label.replace(/^[一二三四五]、/, '') : '小计', totals).map((value, index) => {
                    const options: ResultCellOptions = {
                      columnIndex: index,
                      source: 'total',
                      totals,
                      totalKey: key,
                      totalLabel: totalsOnly ? label.replace(/^[一二三四五]、/, '') : `${label.replace(/^[一二三四五]、/, '')}小计`,
                      input,
                      result,
                    }
                    return renderCell(value, index, key, 'total', options, darkMode ? 'bg-slate-700' : 'bg-slate-100')
                  })}
                </tr>
              </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {trace && selected ? createPortal(
        <div ref={traceRef} id={tooltipId} role={selected.pinned ? 'dialog' : 'tooltip'} aria-label="计算说明"
          data-testid="result-cell-trace" onMouseEnter={cancelClose} onMouseLeave={closeHover} aria-hidden={tooltipHidden || undefined}
          style={{ position: 'fixed', ...position, visibility: tooltipHidden ? 'hidden' : 'visible', width: 'min(360px, calc(100vw - 16px))', maxHeight: 'min(260px, 60vh)', zIndex: 70 }}
          className={`overflow-y-auto rounded-md border px-3 py-2 shadow-lg ${darkMode ? 'border-blue-700 bg-gray-800 text-gray-100' : 'border-blue-200 bg-white text-gray-900'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-semibold">{selectedRow?.name ?? SECTION_LABELS[selected.section]} · {RESULT_LABELS[RESULT_COLUMNS[selected.columnIndex]]}</div>
            {selected.pinned ? <button type="button" aria-label="关闭计算追溯" onClick={() => setSelected(null)} className="shrink-0 rounded hover:bg-blue-500/10"><X className="h-3.5 w-3.5" /></button> : null}
          </div>
          <p className="mt-1 text-xs leading-5 tabular-nums">{trace.formula}</p>
          {trace.dependencies.some((dependency) => dependency.resultCell) ? <p className={`mt-1 text-[11px] ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>橙框为参与计算的单元格</p> : null}
          {trace.dependencies.some((dependency) => !dependency.resultCell) ? <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {trace.dependencies.filter((dependency) => !dependency.resultCell).map((dependency, index) => {
              const content = <>{dependency.label} {displayNumber(dependency.value)} {dependency.unit}</>
              return dependency.inputId && onLocateInput ? <button
                key={index} type="button" className={`text-left text-xs underline decoration-dotted underline-offset-2 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}
                onClick={() => { setSelected(null); onLocateInput(dependency.inputId!) }}>
                {content} ↗
              </button> : <span key={index} className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{content}</span>
            })}
          </div> : null}
        </div>, document.body,
      ) : null}
    </section>
  )
}
