import { Fragment } from 'react'
import type { CalculatedRow, CutAndFillResult, DevelopmentRowInput, MiningMethodInput, SectionTotals } from '../../mining/types'

interface CutAndFillResultTableProps {
  input: MiningMethodInput
  result: CutAndFillResult
  darkMode: boolean
}

const GROUP_HEADERS: Array<{ label: string; span: number }> = [
  { label: '工程项目', span: 1 },
  { label: '巷道数目', span: 1 },
  { label: '巷道长度', span: 5 },
  { label: '巷道断面', span: 2 },
  { label: '体积', span: 3 },
  { label: '储量与贫损', span: 5 },
]

const SUB_HEADERS = [
  '',
  '个',
  '矿石中单长',
  '矿石中总长',
  '岩石中单长',
  '岩石中总长',
  '总长',
  '矿石中',
  '岩石中',
  '矿石中',
  '岩石中',
  '总计',
  '地质储量',
  '采出地质储量',
  '采出矿量',
  '采出废石',
  '占矿块采出矿量比例',
]

const SUB_UNITS = ['', '', 'm', 'm', 'm', 'm', 'm', 'm²', 'm²', 'm³', 'm³', 'm³', 't', 't', 't', 't', '%']

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

export default function CutAndFillResultTable({ input, result, darkMode }: CutAndFillResultTableProps) {
  const sections: Array<{
    key: string
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
  const headerSurface = darkMode ? 'bg-gray-700 text-gray-100' : 'bg-slate-100 text-slate-700'
  const subHeaderSurface = darkMode ? 'bg-gray-750 text-gray-300' : 'bg-gray-50 text-gray-500'
  const groupSurface = darkMode ? 'bg-blue-950/60 text-blue-100' : 'bg-blue-50 text-blue-900'
  const totalSurface = darkMode ? 'bg-gray-700/80 text-gray-100' : 'bg-slate-50 text-slate-800'
  const border = darkMode ? 'border-gray-700' : 'border-gray-200'
  const columnCount = SUB_HEADERS.length

  return (
    <section className={`min-h-0 rounded-lg border shadow-sm ${surface}`} data-testid="cut-and-fill-result-table">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-inherit px-4 py-3">
        <div>
          <h2 className="font-semibold">工程计算表</h2>
          <p className={`mt-0.5 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            回采行由矿块构成生成；采切合计与盘区总计只显示汇总，不再重复明细。
          </p>
        </div>
        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>单位：长度 m，体积 m³，质量 t</span>
      </div>
      <div className="overflow-x-hidden" data-testid="result-table-scroll">
        <table className="w-full table-fixed border-collapse text-xs" data-testid="calculation-result-table">
          <thead>
            <tr className={headerSurface}>
              {GROUP_HEADERS.map((group) => (
                <th
                  key={group.label}
                  colSpan={group.span}
                  className={`border ${border} px-1 py-2 text-center font-semibold leading-tight`}
                >
                  {group.label}
                </th>
              ))}
            </tr>
            <tr className={subHeaderSurface}>
              {SUB_HEADERS.map((header, index) => (
                <th
                  key={`h-${index}-${header}`}
                  className={`border ${border} px-1 py-1.5 text-center font-medium leading-tight ${index === 0 ? 'text-left' : ''}`}
                >
                  {header}
                </th>
              ))}
            </tr>
            <tr className={subHeaderSurface}>
              {SUB_UNITS.map((unit, index) => (
                <th
                  key={`u-${index}-${unit}`}
                  className={`border ${border} px-1 py-1 text-center text-xs font-normal ${index === 0 ? 'text-left' : ''}`}
                >
                  {unit}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map(({ key, label, rows, totals, totalsOnly }) => (
              <Fragment key={key}>
                <tr className={groupSurface}>
                  <th colSpan={columnCount} className="border px-2 py-2 text-left font-semibold">{label}</th>
                </tr>
                {rows.length === 0 && !totalsOnly ? (
                  <tr>
                    <td colSpan={columnCount} className={`border px-2 py-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      暂无明细
                    </td>
                  </tr>
                ) : null}
                {rows.map(({ row, source }) => {
                  const values = rowValues(input, source, row)
                  return (
                    <tr key={`${key}-${source}-${row.id}`} data-testid={`result-row-${key}-${row.id}`} className={darkMode ? 'hover:bg-gray-750' : 'hover:bg-blue-50/40'}>
                      {values.map((value, index) => (
                        <td
                          key={`${row.id}-${index}`}
                          className={`border ${border} px-1 py-1.5 ${
                            index === 0
                              ? 'break-words font-medium'
                              : 'break-all text-right tabular-nums'
                          }`}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                <tr className={totalSurface}>
                  {totalValues(totalsOnly ? label.replace(/^[一二三四五]、/, '') : '小计', totals).map((value, index) => (
                    <td
                      key={`${key}-total-${index}`}
                      className={`border ${border} px-1 py-1.5 font-semibold ${
                        index === 0 ? 'break-words' : 'break-all text-right tabular-nums'
                      }`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
