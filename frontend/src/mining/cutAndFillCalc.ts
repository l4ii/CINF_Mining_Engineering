import { createMethodInput } from './methodConfigs'
import { resolvedOreLength, resolvedWasteLength } from './developmentLink'
import type {
  BlockElementInput,
  BlockElementKind,
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

const PILLAR_KINDS: BlockElementKind[] = ['barrier-pillar', 'crown-pillar', 'sill-pillar', 'point-pillar', 'triangle-ore']
const INDICATOR_FIELDS = [
  'cuttingLossDilution',
  'stopingLossDilution',
  'crownSillLossDilution',
  'barrierLossDilution',
  'pointPillarLossDilution',
] as const
const SCALAR_FIELDS = ['dipAngle', 'levelHeight', 'trueThickness', 'oreDensity', 'wasteDensity'] as const

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

export function elementVolume(element: Pick<BlockElementInput, 'sectionArea' | 'height' | 'quantity'>): number | null {
  return mul(element.sectionArea, element.height, element.quantity)
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

function recoveryFromLoss(lossRate: number | null): number | null {
  if (lossRate == null || !Number.isFinite(lossRate)) return null
  return 1 - lossRate
}

function isElementUsed(element: BlockElementInput): boolean {
  return element.sectionArea != null || element.height != null
}

function volumeOrZero(element: Pick<BlockElementInput, 'sectionArea' | 'height' | 'quantity'>): number {
  const volume = elementVolume(element)
  return volume == null ? 0 : volume
}

function indicatorForKind(kind: BlockElementKind, common: CommonParameters): LossDilutionIndicator {
  if (kind === 'barrier-pillar') return common.barrierLossDilution
  if (kind === 'crown-pillar' || kind === 'sill-pillar') return common.crownSillLossDilution
  if (kind === 'point-pillar') return common.pointPillarLossDilution
  return common.stopingLossDilution
}

function activeElements(input: MiningMethodInput): BlockElementInput[] {
  return input.blockElements
}

export function computeGeometry(input: MiningMethodInput): BlockGeometry {
  const inclinedLength = deriveInclinedLength(input.common.dipAngle, input.common.levelHeight)
  const panelOreVolume = mul(input.common.strikeLength, inclinedLength, input.common.trueThickness)
  const developmentOreVolume = [...input.preparation, ...input.cutting].reduce((sum, row) => {
    const volume = mul(resolvedOreLength(row), row.oreSectionArea)
    return add(sum, volume ?? 0) as number
  }, 0)
  const elements = activeElements(input)
  const pillarOreVolume = elements
    .filter((element) => PILLAR_KINDS.includes(element.kind))
    .reduce((sum, element) => sum + volumeOrZero(element), 0)
  const primary = elements.find((element) => element.kind === 'primary-stope')
  const secondary = elements.find((element) => element.kind === 'secondary-stope')
  const primaryStopeVolume = primary && isElementUsed(primary) ? elementVolume(primary) : null
  const secondaryStopeVolume = secondary && isElementUsed(secondary) ? elementVolume(secondary) : null
  const stopeRemainder = add(primaryStopeVolume ?? 0, secondaryStopeVolume ?? 0)
  return {
    inclinedLength,
    panelOreVolume,
    developmentOreVolume,
    pillarOreVolume,
    stopeRemainder,
    primaryStopeVolume,
    secondaryStopeVolume,
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

function developmentRow(row: DevelopmentRowInput, common: CommonParameters): CalculatedRow {
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
    ...applyReserves(oreVolume, wasteVolume, common.cuttingLossDilution, common),
  })
}

function stopingRow(
  element: BlockElementInput,
  oreVolume: number | null,
  common: CommonParameters,
): CalculatedRow {
  return blankCalculated({
    id: element.id,
    name: element.name,
    kind: element.kind,
    note: '',
    ...applyReserves(oreVolume, 0, indicatorForKind(element.kind, common), common),
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
    for (const key of ['sectionArea', 'height', 'quantity'] as const) {
      const value = element[key]
      if (value != null && value < 0) {
        issues.push({ field: `blockElements.${element.id}.${key}`, code: 'non-negative', message: '不能为负数' })
      }
    }
  }
  return issues
}

function buildStopingRows(input: MiningMethodInput, _geometry: BlockGeometry): CalculatedRow[] {
  return activeElements(input).flatMap((element) => {
    if (!isElementUsed(element) && volumeOrZero(element) <= 0) return []
    return [stopingRow(element, elementVolume(element) ?? 0, input.common)]
  })
}

export function calculateCutAndFill(input: MiningMethodInput): CutAndFillResult {
  const issues = validateMiningInput(input)
  const geometry = computeGeometry({
    ...input,
    common: { ...input.common, inclinedLength: deriveInclinedLength(input.common.dipAngle, input.common.levelHeight) },
  })
  const preparationRows = input.preparation.map((row) => developmentRow(row, input.common))
  const cuttingRows = input.cutting.map((row) => developmentRow(row, input.common))
  const stopingRows = buildStopingRows(input, geometry)
  const preparation = { rows: preparationRows, totals: sumRows(preparationRows) }
  const cutting = { rows: cuttingRows, totals: sumRows(cuttingRows) }
  const developmentTotal = { rows: [], totals: addTotals(preparation.totals, cutting.totals) }
  const stoping = { rows: stopingRows, totals: sumRows(stopingRows) }
  const blockRows = [...preparationRows, ...cuttingRows, ...stopingRows]
  const block = { rows: blockRows, totals: sumRows(blockRows) }
  const produced = block.totals.producedOre
  for (const row of blockRows) row.share = scale(div(row.producedOre, produced), 100)
  const metric = (value: number | null, unit: string) => ({ value, unit })
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
      recoveryRate: metric(scale(div(block.totals.producedGeologicalReserve, block.totals.geologicalReserve), 100), '%'),
      lossRate: metric(
        block.totals.geologicalReserve == null || block.totals.producedGeologicalReserve == null
          ? null
          : 100 - (div(block.totals.producedGeologicalReserve, block.totals.geologicalReserve) ?? 0) * 100,
        '%',
      ),
      dilutionRate: metric(
        scale(div(add(block.totals.producedOre, scale(block.totals.producedGeologicalReserve, -1)), produced), 100),
        '%',
      ),
    },
  }
}

export type { CommonParameters, DevelopmentRowInput, LossDilutionIndicator }
