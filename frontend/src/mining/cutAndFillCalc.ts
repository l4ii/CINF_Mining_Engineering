import { createMethodInput, isBlankDevelopmentRow, isPanelElement, isPillarElement, isStopeElement } from './methodConfigs'
import { resolvedOreLength, resolvedWasteLength } from './developmentLink'
import type {
  BlockElementInput,
  BlockGeometry,
  CalculatedRow,
  CommonParameters,
  CutAndFillResult,
  DevelopmentRowInput,
  LossDilutionIndicator,
  MiningMethodInput,
  SectionTotals,
  ValidationIssue,
} from './types'

export { createMethodInput }

const INDICATOR_FIELDS = ['preparationLossDilution', 'cuttingLossDilution'] as const
const SCALAR_FIELDS = ['dipAngle', 'trueThickness', 'oreDensity', 'wasteDensity'] as const
const DIMENSION_FIELDS = ['length', 'width', 'height', 'quantity'] as const

const mul = (...xs: Array<number | null>) =>
  xs.every((x) => x != null && Number.isFinite(x)) ? xs.reduce((a, x) => (a as number) * (x as number), 1) : null
const add = (...xs: Array<number | null>) =>
  xs.every((x) => x != null && Number.isFinite(x)) ? xs.reduce((a, x) => (a as number) + (x as number), 0) : null
const scale = (x: number | null, factor: number) => (x == null ? null : x * factor)
const div = (a: number | null, b: number | null) =>
  a != null && b != null && Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : null

export function deriveInclinedLength(dipAngle: number | null, levelHeight: number | null): number | null {
  if (dipAngle == null || levelHeight == null || !Number.isFinite(dipAngle) || !Number.isFinite(levelHeight)) return null
  const sine = Math.sin((dipAngle * Math.PI) / 180)
  if (sine === 0) return null
  return levelHeight / sine
}

export function elementVolume(element: Pick<BlockElementInput, 'shape' | 'length' | 'width' | 'height' | 'quantity'>): number | null {
  const shape = element.shape ?? 'rectangular'
  if (shape === 'cylinder') {
    return mul(Math.PI, mul(element.width, element.width), 0.25, element.height, element.quantity)
  }
  if (shape === 'triangular-prism') {
    return mul(0.5, element.width, element.height, element.length, element.quantity)
  }
  return mul(element.length, element.width, element.height, element.quantity)
}

function emptyTotals(): SectionTotals {
  return {
    totalOreLength: 0,
    totalWasteLength: 0,
    totalLength: 0,
    oreVolume: 0,
    wasteVolume: 0,
    totalVolume: 0,
    geologicalReserve: 0,
    producedGeologicalReserve: 0,
    producedOre: 0,
    wasteMass: 0,
    dilutionAmount: 0,
  }
}

export function elementLossDilution(
  element: Pick<BlockElementInput, 'dilutionRate' | 'lossRate'>,
  fallback: LossDilutionIndicator,
): LossDilutionIndicator {
  return {
    dilutionRate: element.dilutionRate ?? fallback.dilutionRate,
    lossRate: element.lossRate ?? fallback.lossRate,
  }
}

function recoveryFromLoss(lossRate: number | null): number | null {
  if (lossRate == null || !Number.isFinite(lossRate)) return null
  return 1 - lossRate
}

export function isElementUsed(element: BlockElementInput): boolean {
  if (isStopeElement(element) || isPanelElement(element)) return false
  if (elementVolume(element) != null) return true
  return element.length != null || element.width != null || element.height != null || element.wasteVolume != null
}

function volumeOrZero(element: BlockElementInput): number {
  const volume = elementVolume(element)
  return volume == null ? 0 : volume
}

export function sectionOreVolume(rows: DevelopmentRowInput[]): number | null {
  let total: number | null = null
  for (const row of rows) {
    const volume = mul(resolvedOreLength(row), row.oreSectionArea)
    if (volume == null) continue
    total = (total ?? 0) + volume
  }
  return total
}

function developmentOreVolumeOf(input: MiningMethodInput): number {
  return (sectionOreVolume(input.preparation) ?? 0) + (sectionOreVolume(input.cutting) ?? 0)
}

function panelElement(input: MiningMethodInput): BlockElementInput | undefined {
  return input.blockElements.find((element) => isPanelElement(element))
}

function stopeElement(input: MiningMethodInput): BlockElementInput | undefined {
  return input.blockElements.find((element) => isStopeElement(element))
}

function pillarElements(input: MiningMethodInput): BlockElementInput[] {
  return input.blockElements.filter((element) => isPillarElement(element))
}

export function computedStopeVolume(input: MiningMethodInput): number | null {
  const panel = panelElement(input)
  const panelVolume = panel ? elementVolume(panel) : null
  if (panelVolume == null) return null
  const pillars = pillarElements(input).reduce((sum, element) => sum + volumeOrZero(element), 0)
  return panelVolume - pillars - developmentOreVolumeOf(input)
}

export function computeGeometry(input: MiningMethodInput): BlockGeometry {
  const inclinedLength = deriveInclinedLength(input.common.dipAngle, input.common.levelHeight)
  const panel = panelElement(input)
  const panelOreVolume = panel ? elementVolume(panel) : null
  const developmentOreVolume = developmentOreVolumeOf(input)
  const pillarOreVolume = pillarElements(input).reduce((sum, element) => sum + volumeOrZero(element), 0)
  const primaryStopeVolume = computedStopeVolume(input)
  return {
    inclinedLength,
    panelOreVolume,
    developmentOreVolume,
    pillarOreVolume,
    stopeRemainder: primaryStopeVolume,
    primaryStopeVolume,
    secondaryStopeVolume: null,
  }
}

function applyReserves(
  oreVolume: number | null,
  wasteVolume: number | null,
  indicator: LossDilutionIndicator,
  common: CommonParameters,
): Pick<
  CalculatedRow,
  'oreVolume' | 'wasteVolume' | 'totalVolume' | 'geologicalReserve' | 'producedGeologicalReserve' | 'producedOre' | 'wasteMass' | 'dilutionAmount'
> {
  const recovery = recoveryFromLoss(indicator.lossRate)
  const dilution = indicator.dilutionRate
  const rec = recovery != null && recovery >= 0 && recovery <= 1 ? recovery : null
  const dil = dilution != null && dilution >= 0 && dilution < 1 ? dilution : null
  const geo = mul(oreVolume, common.oreDensity)
  const producedGeo = mul(geo, rec)
  const producedOre = dil == null ? null : div(producedGeo, 1 - dil)
  return {
    oreVolume,
    wasteVolume,
    totalVolume: add(oreVolume ?? 0, wasteVolume ?? 0),
    geologicalReserve: geo,
    producedGeologicalReserve: producedGeo,
    producedOre,
    wasteMass: mul(wasteVolume, common.wasteDensity),
    dilutionAmount: producedOre == null || producedGeo == null ? null : producedOre - producedGeo,
  }
}

function blankCalculated(partial: Partial<CalculatedRow> & Pick<CalculatedRow, 'id' | 'name'>): CalculatedRow {
  return {
    totalOreLength: null,
    totalWasteLength: null,
    totalLength: null,
    oreVolume: null,
    wasteVolume: null,
    totalVolume: null,
    geologicalReserve: null,
    producedGeologicalReserve: null,
    producedOre: null,
    wasteMass: null,
    dilutionAmount: null,
    share: null,
    kind: 'development',
    note: '',
    ...partial,
  }
}

function developmentRow(row: DevelopmentRowInput, common: CommonParameters, indicator: LossDilutionIndicator): CalculatedRow {
  const oreLength = resolvedOreLength(row)
  const wasteLength = resolvedWasteLength(row)
  const oreVolume = mul(oreLength, row.oreSectionArea)
  const wasteVolume = mul(wasteLength, row.wasteSectionArea)
  return blankCalculated({
    id: row.id,
    name: row.name,
    kind: 'development',
    totalOreLength: oreLength,
    totalWasteLength: wasteLength,
    totalLength: oreLength == null && wasteLength == null ? null : add(oreLength ?? 0, wasteLength ?? 0),
    note: row.note,
    ...applyReserves(oreVolume, wasteVolume, indicator, common),
  })
}

function stopingRow(
  element: BlockElementInput,
  oreVolume: number | null,
  common: CommonParameters,
): CalculatedRow {
  return blankCalculated({
    id: element.id,
    name: element.name.trim() || '矿柱',
    kind: element.kind,
    note: '',
    ...applyReserves(oreVolume, element.wasteVolume ?? 0, elementLossDilution(element, common.blockLossDilution), common),
  })
}

function sumRows(rows: CalculatedRow[]): SectionTotals {
  const keys: Array<keyof SectionTotals> = [
    'totalOreLength',
    'totalWasteLength',
    'totalLength',
    'oreVolume',
    'wasteVolume',
    'totalVolume',
    'geologicalReserve',
    'producedGeologicalReserve',
    'producedOre',
    'wasteMass',
    'dilutionAmount',
  ]
  const out = emptyTotals()
  for (const key of keys) {
    out[key] = rows.reduce<number | null>((value, row) => add(value, row[key] ?? 0), 0) as never
  }
  return out
}

function addTotals(left: SectionTotals, right: SectionTotals): SectionTotals {
  const keys: Array<keyof SectionTotals> = [
    'totalOreLength',
    'totalWasteLength',
    'totalLength',
    'oreVolume',
    'wasteVolume',
    'totalVolume',
    'geologicalReserve',
    'producedGeologicalReserve',
    'producedOre',
    'wasteMass',
    'dilutionAmount',
  ]
  const total = emptyTotals()
  for (const key of keys) total[key] = add(left[key], right[key])
  return total
}

export function validateMiningInput(input: MiningMethodInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const common = input.common
  for (const field of SCALAR_FIELDS) {
    if (common[field] == null) issues.push({ field, code: 'required', message: '未填写' })
    else if (common[field]! < 0) issues.push({ field, code: 'non-negative', message: '不能为负数' })
  }
  for (const field of INDICATOR_FIELDS) {
    const indicator = common[field]
    for (const key of ['dilutionRate', 'lossRate'] as const) {
      const value = indicator[key]
      const path = `${field}.${key}`
      if (value == null) issues.push({ field: path, code: 'required', message: '未填写' })
      else if (value < 0 || value > 1) issues.push({ field: path, code: 'range', message: '应在0到1之间' })
    }
  }
  for (const [group, rows] of [['preparation', input.preparation], ['cutting', input.cutting]] as const) {
    const names = new Set<string>()
    for (const row of rows) {
      if (isBlankDevelopmentRow(row)) continue
      if (!row.name.trim()) issues.push({ field: `${group}.${row.id}.name`, code: 'required', message: '工程名称不能为空' })
      if (names.has(row.name)) issues.push({ field: `${group}.${row.id}.name`, code: 'duplicate-name', message: '工程名称重复' })
      names.add(row.name)
      for (const key of ['quantity', 'oreSingleLength', 'wasteSingleLength', 'oreTotalLength', 'wasteTotalLength', 'oreSectionArea', 'wasteSectionArea'] as const) {
        const value = row[key]
        if (value != null && value < 0) issues.push({ field: `${group}.${row.id}.${key}`, code: 'non-negative', message: '不能为负数' })
      }
    }
  }
  for (const element of input.blockElements) {
    if (element.wasteVolume != null && (!Number.isFinite(element.wasteVolume) || element.wasteVolume < 0)) {
      issues.push({ field: `blockElements.${element.id}.wasteVolume`, code: 'non-negative', message: '伴采岩石体积应为非负数' })
    }
    for (const key of DIMENSION_FIELDS) {
      const value = element[key]
      if (value != null && value < 0) {
        issues.push({ field: `blockElements.${element.id}.${key}`, code: 'non-negative', message: '不能为负数' })
      }
    }
    if (isPanelElement(element)) continue
    const used = isStopeElement(element) ? computedStopeVolume(input) != null : isElementUsed(element)
    if (!used) continue
    for (const key of ['dilutionRate', 'lossRate'] as const) {
      const value = element[key]
      const path = `blockElements.${element.id}.${key}`
      if (value == null) issues.push({ field: path, code: 'required', message: '未填写' })
      else if (value < 0 || value > 1) issues.push({ field: path, code: 'range', message: '应在0到1之间' })
    }
  }
  const stopeVolume = computedStopeVolume(input)
  if (stopeVolume == null && stopeElement(input)?.wasteVolume != null) {
    issues.push({ field: 'primary-stope', code: 'missing-panel', message: '伴采岩石已计入；请补齐矿块尺寸以计算采场矿石体积' })
  }
  if (stopeVolume != null && stopeVolume < 0) {
    issues.push({ field: 'primary-stope', code: 'negative-stope', message: '采场体积为负，请核减矿柱或采切工程矿石体积' })
  }
  return issues
}

function buildStopingRows(input: MiningMethodInput): CalculatedRow[] {
  const rows: CalculatedRow[] = []
  pillarElements(input).forEach((element, index) => {
    if (!isElementUsed(element)) return
    const named = { ...element, name: element.name.trim() || `矿柱${index + 1}` }
    rows.push(stopingRow(named, elementVolume(element) ?? 0, input.common))
  })
  const stope = stopeElement(input)
  const stopeVolume = computedStopeVolume(input)
  if (stope && (stopeVolume != null || stope.wasteVolume != null)) {
    rows.push(stopingRow(stope, stopeVolume, input.common))
  }
  return rows
}

export function calculateCutAndFill(input: MiningMethodInput): CutAndFillResult {
  const issues = validateMiningInput(input)
  const geometry = computeGeometry(input)
  const preparationRows = input.preparation
    .filter((row) => !isBlankDevelopmentRow(row))
    .map((row) => developmentRow(row, input.common, input.common.preparationLossDilution))
  const cuttingRows = input.cutting
    .filter((row) => !isBlankDevelopmentRow(row))
    .map((row) => developmentRow(row, input.common, input.common.cuttingLossDilution))
  const stopingRows = buildStopingRows(input)
  const preparation = { rows: preparationRows, totals: sumRows(preparationRows) }
  const cutting = { rows: cuttingRows, totals: sumRows(cuttingRows) }
  const developmentTotal = { rows: [], totals: addTotals(preparation.totals, cutting.totals) }
  const stoping = { rows: stopingRows, totals: sumRows(stopingRows) }
  const blockRows = [...preparationRows, ...cuttingRows, ...stopingRows]
  const block = { rows: blockRows, totals: sumRows(blockRows) }
  const produced = block.totals.producedOre
  for (const row of blockRows) row.share = scale(div(row.producedOre, produced), 100)
  const metric = (value: number | null, unit: string) => ({ value, unit })
  const recoveryRatio = div(block.totals.producedGeologicalReserve, block.totals.geologicalReserve)
  return {
    sections: { preparation, cutting, developmentTotal, stoping, block },
    geometry,
    issues,
    metrics: {
      preparationRatio: metric(scale(div(preparation.totals.totalLength, produced), 1000), 'm/kt'),
      preparationVolumeRatio: metric(scale(div(preparation.totals.totalVolume, produced), 1000), 'm³/kt'),
      cuttingRatio: metric(scale(div(cutting.totals.totalLength, produced), 1000), 'm/kt'),
      cuttingVolumeRatio: metric(scale(div(cutting.totals.totalVolume, produced), 1000), 'm³/kt'),
      cutAndFillRatio: metric(scale(div(developmentTotal.totals.totalLength, produced), 1000), 'm/kt'),
      cutAndFillVolumeRatio: metric(scale(div(developmentTotal.totals.totalVolume, produced), 1000), 'm³/kt'),
      wasteRate: metric(scale(div(block.totals.wasteMass, produced), 100), '%'),
      byProductOreProportion: metric(scale(div(developmentTotal.totals.producedOre, produced), 100), '%'),
      recoveryRate: metric(scale(recoveryRatio, 100), '%'),
      lossRate: metric(recoveryRatio == null ? null : (1 - recoveryRatio) * 100, '%'),
      dilutionRate: metric(
        scale(div(add(block.totals.producedOre, scale(block.totals.producedGeologicalReserve, -1)), produced), 100),
        '%',
      ),
    },
  }
}

export type { CommonParameters, DevelopmentRowInput, LossDilutionIndicator }
