import { elementLossDilution, elementVolume } from './cutAndFillCalc'
import { resolvedOreLength, resolvedWasteLength } from './developmentLink'
import { isPillarElement } from './methodConfigs'
import type {
  BlockElementInput,
  CalculatedRow,
  CommonParameters,
  CutAndFillResult,
  DevelopmentRowInput,
  LossDilutionIndicator,
  MiningMethodInput,
  SectionTotals,
} from './types'

export const RESULT_COLUMNS = [
  'name',
  'quantity',
  'oreSingleLength',
  'oreTotalLength',
  'wasteSingleLength',
  'wasteTotalLength',
  'totalLength',
  'oreSection',
  'wasteSection',
  'oreVolume',
  'wasteVolume',
  'totalVolume',
  'geologicalReserve',
  'producedGeologicalReserve',
  'producedOre',
  'wasteMass',
  'share',
] as const

export type ResultColumn = (typeof RESULT_COLUMNS)[number]
export type ResultSource = 'preparation' | 'cutting' | 'stoping' | 'total'
export type ResultSectionKey = keyof CutAndFillResult['sections']

export const RESULT_LABELS: Record<ResultColumn, string> = {
  name: '工程项目', quantity: '巷道数目', oreSingleLength: '矿石中单长', oreTotalLength: '矿石中总长',
  wasteSingleLength: '岩石中单长', wasteTotalLength: '岩石中总长', totalLength: '巷道总长',
  oreSection: '矿石中断面', wasteSection: '岩石中断面', oreVolume: '矿石中体积', wasteVolume: '岩石中体积',
  totalVolume: '总体积', geologicalReserve: '地质储量', producedGeologicalReserve: '采出地质储量',
  producedOre: '采出矿量', wasteMass: '采出废石', share: '采出矿量占比',
}

export const SECTION_LABELS: Record<ResultSectionKey, string> = {
  preparation: '采准工程小计', cutting: '切割工程小计', developmentTotal: '采切合计', stoping: '回采工作小计', block: '盘区总计',
}

const TOTAL_FIELDS: Partial<Record<ResultColumn, keyof SectionTotals>> = {
  oreTotalLength: 'totalOreLength', wasteTotalLength: 'totalWasteLength', totalLength: 'totalLength',
  oreVolume: 'oreVolume', wasteVolume: 'wasteVolume', totalVolume: 'totalVolume', geologicalReserve: 'geologicalReserve',
  producedGeologicalReserve: 'producedGeologicalReserve', producedOre: 'producedOre', wasteMass: 'wasteMass',
}

export function resultColumnUnit(column: ResultColumn): string {
  if (column === 'quantity') return '个'
  if (column === 'share') return '%'
  if (column.includes('Length')) return 'm'
  if (column.includes('Section')) return 'm²'
  if (column.includes('Volume')) return 'm³'
  return column === 'name' ? '' : 't'
}

export function resultCellId(section: ResultSectionKey, rowId: string, column: ResultColumn): string {
  return `${section}:${rowId}:${column}`
}

function fmt(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(digits)))
}

function fmtRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return '—'
  return `${Number((rate * 100).toFixed(2))}%`
}

function recoveryLabel(indicator: LossDilutionIndicator): string {
  return `1 − 损失率 ${fmtRate(indicator.lossRate)}`
}

function indicatorName(source: ResultSource): string {
  if (source === 'preparation') return '采准贫损指标'
  if (source === 'cutting') return '切割贫损指标'
  return '本行贫损指标'
}

function indicatorOf(source: ResultSource, common: CommonParameters): LossDilutionIndicator {
  if (source === 'preparation') return common.preparationLossDilution
  if (source === 'cutting') return common.cuttingLossDilution
  return common.blockLossDilution
}

function lengthReason(total: number | null | undefined, quantity: number | null | undefined, single: number | null | undefined, filledTotal: number | null | undefined): string {
  if (filledTotal != null && Number.isFinite(filledTotal)) return `采用当前总长 ${fmt(filledTotal)} m（直接填写或由数目、单长联动）`
  if (quantity != null && single != null) return `巷道数目 ${fmt(quantity)} × 单长 ${fmt(single)} = ${fmt(total)} m`
  return '未填写总长，且缺少数目或单长'
}

function reserveLines(
  row: CalculatedRow,
  source: ResultSource,
  common: CommonParameters,
  indicator = indicatorOf(source, common),
): Record<'geologicalReserve' | 'producedGeologicalReserve' | 'producedOre' | 'wasteMass', string> {
  const name = indicatorName(source)
  return {
    geologicalReserve: `地质储量 = 矿石中体积 ${fmt(row.oreVolume)} × 矿体密度 ${fmt(common.oreDensity)} = ${fmt(row.geologicalReserve)} t`,
    producedGeologicalReserve: `采出地质储量 = 地质储量 ${fmt(row.geologicalReserve)} ×（${recoveryLabel(indicator)}，用${name}）= ${fmt(row.producedGeologicalReserve)} t`,
    producedOre: `采出矿量 = 采出地质储量 ${fmt(row.producedGeologicalReserve)} ÷（1 − 贫化率 ${fmtRate(indicator.dilutionRate)}，用${name}）= ${fmt(row.producedOre)} t`,
    wasteMass: `采出废石 = 岩石中体积 ${fmt(row.wasteVolume)} × 围岩密度 ${fmt(common.wasteDensity)} = ${fmt(row.wasteMass)} t`,
  }
}

function explainDevelopment(column: ResultColumn, row: CalculatedRow, dev: DevelopmentRowInput, source: 'preparation' | 'cutting', common: CommonParameters, blockProduced: number | null): string | null {
  const oreLength = resolvedOreLength(dev)
  const wasteLength = resolvedWasteLength(dev)
  const reserves = reserveLines(row, source, common)
  switch (column) {
    case 'name':
      return null
    case 'quantity':
      return `巷道数目 = 手填 ${fmt(dev.quantity)} 个，矿石中与岩石中共用`
    case 'oreSingleLength':
      return `矿石中单长 = 手填 ${fmt(dev.oreSingleLength)} m`
    case 'oreTotalLength':
      return `矿石中总长 = ${lengthReason(oreLength, dev.quantity, dev.oreSingleLength, dev.oreTotalLength)}`
    case 'wasteSingleLength':
      return `岩石中单长 = 手填 ${fmt(dev.wasteSingleLength)} m`
    case 'wasteTotalLength':
      return `岩石中总长 = ${lengthReason(wasteLength, dev.quantity, dev.wasteSingleLength, dev.wasteTotalLength)}`
    case 'totalLength':
      return `巷道总长 = 矿石中总长 ${fmt(oreLength)} + 岩石中总长 ${fmt(wasteLength)} = ${fmt(row.totalLength)} m`
    case 'oreSection':
      return `矿石中断面 = 手填 ${fmt(dev.oreSectionArea)} m²`
    case 'wasteSection':
      return `岩石中断面 = 手填 ${fmt(dev.wasteSectionArea)} m²`
    case 'oreVolume':
      return `矿石中体积 = 矿石中总长 ${fmt(oreLength)} × 断面 ${fmt(dev.oreSectionArea)} = ${fmt(row.oreVolume)} m³`
    case 'wasteVolume':
      return `岩石中体积 = 岩石中总长 ${fmt(wasteLength)} × 断面 ${fmt(dev.wasteSectionArea)} = ${fmt(row.wasteVolume)} m³`
    case 'totalVolume':
      return `体积总计 = 矿石中体积 ${fmt(row.oreVolume)} + 岩石中体积 ${fmt(row.wasteVolume)} = ${fmt(row.totalVolume)} m³`
    case 'geologicalReserve':
      return reserves.geologicalReserve
    case 'producedGeologicalReserve':
      return reserves.producedGeologicalReserve
    case 'producedOre':
      return reserves.producedOre
    case 'wasteMass':
      return reserves.wasteMass
    case 'share':
      return `占矿块采出矿量比例 = 本行采出矿量 ${fmt(row.producedOre)} ÷ 盘区采出矿量 ${fmt(blockProduced)} = ${fmt(row.share, 2)}%`
    default:
      return null
  }
}

function explainStoping(column: ResultColumn, row: CalculatedRow, element: BlockElementInput | undefined, common: CommonParameters, blockProduced: number | null): string | null {
  const volume = element ? elementVolume(element) : row.oreVolume
  const indicator = element
    ? elementLossDilution(element, common.blockLossDilution)
    : common.blockLossDilution
  const reserves = reserveLines(row, 'stoping', common, indicator)
  switch (column) {
    case 'name':
      return null
    case 'quantity':
    case 'oreSingleLength':
    case 'oreTotalLength':
    case 'wasteSingleLength':
    case 'wasteTotalLength':
    case 'totalLength':
    case 'oreSection':
    case 'wasteSection':
      return '回采行不填巷道长度和断面；体积由上方矿块结构参数带入'
    case 'oreVolume':
      if (element?.kind === 'primary-stope') {
        return `采场矿石体积 = 矿块体积 − Σ矿柱体积 − 采准矿石体积 − 切割矿石体积 = ${fmt(row.oreVolume)} m³`
      }
      if (element) {
        if (volume == null) return `本部位尚未形成矿石几何体积，当前矿石体积按 ${fmt(row.oreVolume)} m³ 计；伴采岩石单独计算。若有矿石，请补齐几何尺寸。`
        const shape = element.shape ?? 'rectangular'
        if (shape === 'cylinder') {
          return `矿石中体积 = π × (直径 ${fmt(element.width)} / 2)² × 高 ${fmt(element.height)} × 数量 ${fmt(element.quantity)} = ${fmt(volume)} m³（矿块结构「${element.name || row.name}」）`
        }
        if (shape === 'triangular-prism') {
          return `矿石中体积 = (底边 ${fmt(element.width)} × 截面高 ${fmt(element.height)} / 2) × 长度 ${fmt(element.length)} × 数量 ${fmt(element.quantity)} = ${fmt(volume)} m³（矿块结构「${element.name || row.name}」）`
        }
        return `矿石中体积 = 长 ${fmt(element.length)} × 宽 ${fmt(element.width)} × 高 ${fmt(element.height)} × 数量 ${fmt(element.quantity)} = ${fmt(volume)} m³（矿块结构「${element.name || row.name}」）`
      }
      return `矿石中体积 = ${fmt(row.oreVolume)} m³`
    case 'wasteVolume':
      return `岩石中体积 = 本部位伴采岩石体积 ${fmt(element?.wasteVolume ?? 0)} m³；未填按 0 计，不扣减矿块矿石体积`
    case 'totalVolume':
      return `体积总计 = 矿石中体积 ${fmt(row.oreVolume)} + 岩石中体积 ${fmt(row.wasteVolume)} = ${fmt(row.totalVolume)} m³`
    case 'geologicalReserve':
      return reserves.geologicalReserve
    case 'producedGeologicalReserve':
      return reserves.producedGeologicalReserve
    case 'producedOre':
      return reserves.producedOre
    case 'wasteMass':
      return reserves.wasteMass
    case 'share':
      return `占矿块采出矿量比例 = 本行采出矿量 ${fmt(row.producedOre)} ÷ 盘区采出矿量 ${fmt(blockProduced)} = ${fmt(row.share, 2)}%`
    default:
      return null
  }
}

function explainTotal(
  column: ResultColumn,
  totals: SectionTotals,
  label: string,
  parts?: { preparation: SectionTotals; cutting: SectionTotals; stoping: SectionTotals },
): string | null {
  if (column === 'name' || column === 'quantity' || column === 'oreSingleLength' || column === 'wasteSingleLength' || column === 'oreSection' || column === 'wasteSection' || column === 'share') {
    return null
  }
  const fieldLabel: Record<Exclude<ResultColumn, 'name' | 'quantity' | 'oreSingleLength' | 'wasteSingleLength' | 'oreSection' | 'wasteSection' | 'share'>, string> = {
    oreTotalLength: '矿石中总长',
    wasteTotalLength: '岩石中总长',
    totalLength: '巷道总长',
    oreVolume: '矿石中体积',
    wasteVolume: '岩石中体积',
    totalVolume: '体积总计',
    geologicalReserve: '地质储量',
    producedGeologicalReserve: '采出地质储量',
    producedOre: '采出矿量',
    wasteMass: '采出废石',
  }
  const keyMap: Record<string, keyof SectionTotals> = {
    oreTotalLength: 'totalOreLength',
    wasteTotalLength: 'totalWasteLength',
    totalLength: 'totalLength',
    oreVolume: 'oreVolume',
    wasteVolume: 'wasteVolume',
    totalVolume: 'totalVolume',
    geologicalReserve: 'geologicalReserve',
    producedGeologicalReserve: 'producedGeologicalReserve',
    producedOre: 'producedOre',
    wasteMass: 'wasteMass',
  }
  const field = fieldLabel[column]
  const totalKey = keyMap[column]
  const value = totals[totalKey]
  if (label === '采切合计' && parts) {
    return `${field} = 采准小计 ${fmt(parts.preparation[totalKey])} + 切割小计 ${fmt(parts.cutting[totalKey])} = ${fmt(value)}`
  }
  if (label === '盘区总计' && parts) {
    return `${field} = 采准 ${fmt(parts.preparation[totalKey])} + 切割 ${fmt(parts.cutting[totalKey])} + 回采 ${fmt(parts.stoping[totalKey])} = ${fmt(value)}`
  }
  return `${field} = ${label}各行之和 = ${fmt(value)}`
}

export type ResultCellOptions = {
  columnIndex: number
  source: ResultSource
  row?: CalculatedRow
  totals?: SectionTotals
  totalLabel?: string
  totalKey?: ResultSectionKey
  input: MiningMethodInput
  result: CutAndFillResult
}

export function explainResultCell(options: ResultCellOptions): string | null {
  const column = RESULT_COLUMNS[options.columnIndex]
  if (!column) return null
  if (options.source === 'total' && options.totals) {
    return explainTotal(column, options.totals, options.totalLabel ?? (options.totalKey ? SECTION_LABELS[options.totalKey] : '小计'), {
      preparation: options.result.sections.preparation.totals,
      cutting: options.result.sections.cutting.totals,
      stoping: options.result.sections.stoping.totals,
    })
  }
  if (!options.row) return null
  const row = options.row
  const blockProduced = options.result.sections.block.totals.producedOre
  if (options.source === 'stoping') {
    const element = options.input.blockElements.find((item) => item.id === row.id)
    return explainStoping(column, row, element, options.input.common, blockProduced)
  }
  if (options.source !== 'preparation' && options.source !== 'cutting') return null
  const dev = options.input[options.source].find((item) => item.id === row.id)
  if (!dev) return null
  return explainDevelopment(column, row, dev, options.source, options.input.common, blockProduced)
}

export type ResultDependency = {
  label: string
  value: number | null
  unit: string
  resultCell?: string
  inputId?: string
}

export function traceResultCell(options: ResultCellOptions): { formula: string; dependencies: ResultDependency[] } | null {
  const { input, result, source, row, totalKey } = options
  const column = RESULT_COLUMNS[options.columnIndex]
  const formula = explainResultCell(options)
  if (!column || !formula) return null
  const dependencies: ResultDependency[] = []
  const parameter = (label: string, value: number | null | undefined, unit: string, inputId?: string) => {
    dependencies.push({ label, value: value ?? null, unit, inputId })
  }
  const total = (section: ResultSectionKey, field: ResultColumn) => {
    const key = TOTAL_FIELDS[field]
    if (!key) return
    dependencies.push({
      label: `${SECTION_LABELS[section]} · ${RESULT_LABELS[field]}`,
      value: result.sections[section].totals[key], unit: resultColumnUnit(field),
      resultCell: resultCellId(section, 'total', field),
    })
  }
  if (source === 'total') {
    if (!totalKey || !TOTAL_FIELDS[column]) return { formula, dependencies }
    if (totalKey === 'block') {
      for (const section of ['preparation', 'cutting', 'stoping'] as const) total(section, column)
    } else if (totalKey === 'developmentTotal') {
      total('preparation', column)
      total('cutting', column)
    } else {
      for (const item of result.sections[totalKey].rows) {
        dependencies.push({
          label: `${item.name} · ${RESULT_LABELS[column]}`, value: item[TOTAL_FIELDS[column]!],
          unit: resultColumnUnit(column), resultCell: resultCellId(totalKey, item.id, column),
        })
      }
    }
    return { formula, dependencies }
  }
  if (!row) return null
  const dev = source === 'stoping' ? undefined : input[source].find((item) => item.id === row.id)
  const element = source === 'stoping' ? input.blockElements.find((item) => item.id === row.id) : undefined
  const rowCell = (field: ResultColumn) => {
    const key = TOTAL_FIELDS[field]
    const inputFields = { quantity: 'quantity', oreSingleLength: 'oreSingleLength', wasteSingleLength: 'wasteSingleLength', oreSection: 'oreSectionArea', wasteSection: 'wasteSectionArea' } as const
    const inputKey = inputFields[field as keyof typeof inputFields]
    dependencies.push({
      label: `${row.name} · ${RESULT_LABELS[field]}`,
      value: key ? row[key] : dev && inputKey ? dev[inputKey] : null,
      unit: resultColumnUnit(field), resultCell: resultCellId(source, row.id, field),
    })
  }
  const rate = (field: keyof LossDilutionIndicator) => {
    const label = field === 'lossRate' ? '损失率' : '贫化率'
    const fallback = source === 'stoping' && element?.[field] == null
    const indicator = source === 'stoping' ? elementLossDilution(element ?? { lossRate: null, dilutionRate: null }, input.common.blockLossDilution) : indicatorOf(source, input.common)
    const value = indicator[field]
    parameter(`${fallback ? '默认回采' : source === 'stoping' ? row.name : source === 'preparation' ? '采准工程' : '切割工程'}${label}`, value == null ? null : value * 100, '%',
      fallback ? undefined : source === 'stoping' ? `block-${row.id}-${field}` : `${source}LossDilution-${field}`)
  }
  const rawFields = { quantity: 'quantity', oreSingleLength: 'oreSingleLength', wasteSingleLength: 'wasteSingleLength', oreSection: 'oreSectionArea', wasteSection: 'wasteSectionArea' } as const
  const rawField = rawFields[column as keyof typeof rawFields]
  if (rawField && dev) {
    parameter(`${row.name} · ${RESULT_LABELS[column]}`, dev[rawField], resultColumnUnit(column), `${source}-${row.id}-${rawField}`)
  } else if (column === 'oreTotalLength' || column === 'wasteTotalLength') {
    if (dev) {
      const field = column === 'oreTotalLength' ? 'oreTotalLength' : 'wasteTotalLength'
      if (dev[field] != null && Number.isFinite(dev[field])) parameter(`${row.name} · 当前${RESULT_LABELS[column]}`, dev[field], 'm', `${source}-${row.id}-${field}`)
      else {
        rowCell('quantity')
        rowCell(column === 'oreTotalLength' ? 'oreSingleLength' : 'wasteSingleLength')
      }
    }
  } else if (column === 'totalLength') {
    if (dev) { rowCell('oreTotalLength'); rowCell('wasteTotalLength') }
  } else if (column === 'oreVolume' || column === 'wasteVolume') {
    if (dev) {
      rowCell(column === 'oreVolume' ? 'oreTotalLength' : 'wasteTotalLength')
      rowCell(column === 'oreVolume' ? 'oreSection' : 'wasteSection')
    } else if (element && column === 'wasteVolume') {
      parameter(`${row.name} · 伴采岩石体积（未填按 0 计）`, element.wasteVolume ?? 0, 'm³', `block-${element.id}-wasteVolume`)
    } else if (element?.kind === 'primary-stope') {
      const panel = input.blockElements.find((item) => item.kind === 'panel')
      parameter('矿块 · 矿石体积', panel ? elementVolume(panel) : null, 'm³', panel ? `block-${panel.id}-volume` : undefined)
      for (const pillar of input.blockElements.filter(isPillarElement)) {
        const volume = elementVolume(pillar)
        if (volume != null) dependencies.push({ label: `${pillar.name || '矿柱'} · 矿石体积`, value: volume, unit: 'm³', resultCell: resultCellId('stoping', pillar.id, 'oreVolume') })
      }
      total('preparation', 'oreVolume')
      total('cutting', 'oreVolume')
    } else if (element && elementVolume(element) != null) {
      const shape = element.shape ?? 'rectangular'
      const labels = shape === 'cylinder' ? { width: '直径', height: '高', quantity: '数量' } :
        shape === 'triangular-prism' ? { length: '长度', width: '底边', height: '截面高', quantity: '数量' } :
          { length: '长', width: '宽', height: '高', quantity: '数量' }
      for (const [field, label] of Object.entries(labels)) {
        parameter(`${row.name} · ${label}`, element[field as 'length' | 'width' | 'height' | 'quantity'], field === 'quantity' ? '个' : 'm', `block-${element.id}-${field}`)
      }
    }
  } else if (column === 'totalVolume') {
    rowCell('oreVolume'); rowCell('wasteVolume')
  } else if (column === 'geologicalReserve') {
    rowCell('oreVolume'); parameter('矿体密度', input.common.oreDensity, 't/m³', 'common-oreDensity')
  } else if (column === 'producedGeologicalReserve') {
    rowCell('geologicalReserve'); rate('lossRate')
  } else if (column === 'producedOre') {
    rowCell('producedGeologicalReserve'); rate('dilutionRate')
  } else if (column === 'wasteMass') {
    rowCell('wasteVolume'); parameter('围岩密度', input.common.wasteDensity, 't/m³', 'common-wasteDensity')
  } else if (column === 'share') {
    rowCell('producedOre'); total('block', 'producedOre')
  }
  return { formula, dependencies }
}
