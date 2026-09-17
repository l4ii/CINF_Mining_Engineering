import { describe, expect, it } from 'vitest'
import {
  calculateCutAndFill,
  computedStopeVolume,
  createMethodInput,
  deriveInclinedLength,
  elementVolume,
  sectionOreVolume,
  validateMiningInput,
} from './cutAndFillCalc'
import { applyDevelopmentLink } from './developmentLink'
import { createBlockElement, insertPillarElement } from './methodConfigs'
import type { BlockElementInput, BlockElementKind } from './types'

function fillReference(input: ReturnType<typeof createMethodInput>) {
  input.common.dipAngle = 20
  input.common.trueThickness = 25.7
  input.common.oreDensity = 2.82
  input.common.wasteDensity = 2.8
  input.common.blockLossDilution = { lossRate: 0.05, dilutionRate: 0.05 }
  input.common.preparationLossDilution = { lossRate: 0.1, dilutionRate: 0.05 }
  input.common.cuttingLossDilution = { lossRate: 0.08, dilutionRate: 0.04 }
  for (const element of input.blockElements) {
    if (element.kind === 'panel') continue
    element.lossRate = 0.05
    element.dilutionRate = 0.05
  }
  return input
}

function setElement(
  input: ReturnType<typeof createMethodInput>,
  kind: BlockElementKind | string,
  length: number | null,
  width: number | null,
  height: number | null,
  quantity: number | null = 1,
) {
  const row = input.blockElements.find((item) => item.kind === kind)
  if (!row) throw new Error(`missing ${kind}`)
  row.length = length
  row.width = width
  row.height = height
  row.quantity = quantity
}

function addPillar(
  input: ReturnType<typeof createMethodInput>,
  length: number,
  width: number,
  height: number,
  quantity: number,
  extras: Partial<BlockElementInput> = {},
) {
  const extra: BlockElementInput = {
    ...createBlockElement(extras.name ?? '矿柱1'),
    length,
    width,
    height,
    quantity,
    ...extras,
  }
  input.blockElements = insertPillarElement(input.blockElements, extra)
}

describe('cut-and-fill calculation engine', () => {
  it('retains explicit stope rock when ore geometry is still missing', () => {
    const input = fillReference(createMethodInput('上向进路充填法'))
    input.blockElements.find((element) => element.kind === 'primary-stope')!.wasteVolume = 100
    const result = calculateCutAndFill(input)
    expect(result.sections.stoping.rows.find((row) => row.kind === 'primary-stope')?.oreVolume).toBeNull()
    expect(result.sections.block.totals.wasteVolume).toBe(100)
    expect(result.sections.block.totals.wasteMass).toBe(280)
    expect(result.issues.some((issue) => issue.code === 'missing-panel')).toBe(true)
  })
  it('includes the reference triangular stope rock in waste totals without deducting it from ore', () => {
    const input = fillReference(createMethodInput('上向进路充填法'))
    setElement(input, 'panel', 120, 146.19022239977357, 25.7)
    addPillar(input, 64.422, 120, 12, 1, {
      id: 'triangle', name: '三角矿采场', kind: 'triangle-ore',
      wasteVolume: 37218.24, lossRate: 0.1, dilutionRate: 0.1,
    })
    const result = calculateCutAndFill(input)
    const triangle = result.sections.stoping.rows.find((row) => row.id === 'triangle')!
    expect(triangle.oreVolume).toBeCloseTo(92767.68, 5)
    expect(triangle.wasteVolume).toBeCloseTo(37218.24, 5)
    expect(triangle.totalVolume).toBeCloseTo(129985.92, 5)
    expect(triangle.wasteMass).toBeCloseTo(104211.072, 5)
    expect(triangle.producedOre).toBeCloseTo(261604.8576, 5)
    expect(result.geometry.primaryStopeVolume).toBeCloseTo(358082.9658809017, 5)
    expect(result.sections.block.totals.totalVolume).toBeCloseTo(488068.8858809017, 5)
    input.blockElements.find((element) => element.id === 'triangle')!.wasteVolume = 0
    const withoutRock = calculateCutAndFill(input)
    expect(withoutRock.sections.block.totals.producedOre).toBe(result.sections.block.totals.producedOre)
    expect(withoutRock.geometry.primaryStopeVolume).toBe(result.geometry.primaryStopeVolume)
  })
  it('starts from an empty method template without seeded parameters', () => {
    const input = createMethodInput('上向进路充填法')
    expect(input.common.dipAngle).toBeNull()
    expect(input.common.strikeLength).toBeNull()
    expect(input.common.blockLossDilution).toEqual({ dilutionRate: null, lossRate: null })
    expect(input.common.preparationLossDilution).toEqual({ dilutionRate: null, lossRate: null })
    expect(input.preparation).toHaveLength(1)
    expect(input.preparation[0].name).toBe('')
    expect(input.cutting).toHaveLength(1)
    expect(input.cutting[0].name).toBe('')
    expect(input.includeTriangleOre).toBe(false)
    expect(input.blockElements.map((item) => item.kind)).toEqual([
      'panel',
      'custom',
      'primary-stope',
    ])
    expect(input.blockElements.find((item) => item.kind === 'custom')?.name).toBe('')
    const emptyMetrics = calculateCutAndFill(input).metrics
    expect(emptyMetrics.lossRate.value).toBeNull()
    expect(emptyMetrics.recoveryRate.value).toBeNull()
  })

  it('derives orebody inclined length as level height / sin(dip)', () => {
    expect(deriveInclinedLength(20, 50)).toBeCloseTo(146.1902224, 5)
    expect(deriveInclinedLength(0, 50)).toBeNull()
    expect(deriveInclinedLength(20, null)).toBeNull()
  })

  it('computes rectangular, cylinder and triangular-prism volumes', () => {
    expect(elementVolume({ shape: 'rectangular', length: 10, width: 4, height: 2, quantity: 2 })).toBe(160)
    expect(elementVolume({ shape: 'cylinder', length: null, width: 2, height: 4, quantity: 3 })).toBeCloseTo(Math.PI * 1 * 4 * 3, 8)
    expect(elementVolume({ shape: 'triangular-prism', length: 10, width: 6, height: 4, quantity: 2 })).toBe(240)
    expect(elementVolume({ shape: 'rectangular', length: 10, width: 4, height: 2, quantity: null })).toBeNull()
  })

  it('sums filled development ore volumes by section', () => {
    const input = createMethodInput('上向进路充填法')
    expect(sectionOreVolume(input.preparation)).toBeNull()
    input.preparation = [{
      id: 'r1',
      name: '穿脉',
      quantity: 2,
      oreSingleLength: 10,
      wasteSingleLength: 0,
      oreSectionArea: 4,
      wasteSectionArea: 0,
      note: '',
    }]
    expect(sectionOreVolume(input.preparation)).toBe(80)
  })

  it('takes panel ore volume from the block length × width × height', () => {
    const input = fillReference(createMethodInput('上向进路充填法'))
    setElement(input, 'panel', 40, 20, 10, 1)
    const result = calculateCutAndFill(input)
    expect(result.geometry.panelOreVolume).toBe(8000)
  })

  it('calculates development lengths, volumes, reserves and waste from preparation loss-dilution', () => {
    const input = fillReference(createMethodInput('综掘机落矿上向进路充填法'))
    input.preparation = [{
      id: 'r1',
      name: '穿脉巷道',
      quantity: 12,
      oreSingleLength: 68.197,
      wasteSingleLength: 15.74,
      oreSectionArea: 16.74,
      wasteSectionArea: 16.74,
      note: '',
    }]
    const row = calculateCutAndFill(input).sections.preparation.rows[0]
    expect(row.totalLength).toBeCloseTo(1007.244, 3)
    expect(row.totalVolume).toBeCloseTo(16861.26456, 3)
    expect(row.geologicalReserve).toBeCloseTo(38632.3456752, 3)
    expect(row.wasteMass).toBeCloseTo(8853.18336, 3)
    expect(row.producedGeologicalReserve).toBeCloseTo(38632.3456752 * 0.9, 3)
  })

  it('uses cutting loss-dilution for cutting rows, not preparation rates', () => {
    const input = fillReference(createMethodInput('上向进路充填法'))
    input.cutting = [{
      id: 'c1',
      name: '切割巷',
      quantity: 1,
      oreSingleLength: 10,
      wasteSingleLength: 0,
      oreSectionArea: 2,
      wasteSectionArea: 0,
      note: '',
    }]
    const row = calculateCutAndFill(input).sections.cutting.rows[0]
    expect(row.geologicalReserve).toBeCloseTo(20 * 2.82, 5)
    expect(row.producedGeologicalReserve).toBeCloseTo(20 * 2.82 * 0.92, 5)
  })

  it('links roadway count, unit length and total length, then volumes from section', () => {
    const linked = applyDevelopmentLink({
      id: 'r1',
      name: '中段穿脉运输巷道',
      quantity: 4,
      oreSingleLength: null,
      wasteSingleLength: 120,
      oreSectionArea: null,
      wasteSectionArea: 16.74,
      note: '',
    }, 'wasteSingleLength')
    expect(linked.wasteTotalLength).toBe(480)
    const fromTotal = applyDevelopmentLink({
      id: 'r2',
      name: '分层联络道',
      quantity: 4,
      oreSingleLength: null,
      wasteSingleLength: null,
      oreTotalLength: null,
      wasteTotalLength: 480,
      oreSectionArea: null,
      wasteSectionArea: 16.74,
      note: '',
    }, 'wasteTotalLength')
    expect(fromTotal.wasteSingleLength).toBe(120)

    const input = fillReference(createMethodInput('上向进路充填法'))
    input.preparation = [{
      id: 'r1',
      name: '中段穿脉运输巷道',
      quantity: 4,
      oreSingleLength: null,
      wasteSingleLength: 120,
      wasteTotalLength: 480,
      oreSectionArea: null,
      wasteSectionArea: 16.74,
      note: '',
    }]
    const row = calculateCutAndFill(input).sections.preparation.rows[0]
    expect(row.totalWasteLength).toBe(480)
    expect(row.wasteVolume).toBeCloseTo(8035.2, 5)
    expect(row.wasteMass).toBeCloseTo(8035.2 * 2.8, 5)
    expect(row.geologicalReserve).toBeNull()
  })

  it('derives stope volume as panel minus pillars minus development ore, subtracting ore only', () => {
    const input = fillReference(createMethodInput('上向进路充填法'))
    setElement(input, 'panel', 40, 20, 10, 1)
    addPillar(input, 10, 5, 4, 2, { name: '底柱', kind: 'sill-pillar' })
    input.preparation = [{
      id: 'r1',
      name: '穿脉巷道',
      quantity: 1,
      oreSingleLength: 10,
      wasteSingleLength: 5,
      oreSectionArea: 2,
      wasteSectionArea: 3,
      note: '',
    }]

    const pillarVolume = 10 * 5 * 4 * 2
    const prepOre = 10 * 2
    const expectedStope = 8000 - pillarVolume - prepOre
    expect(computedStopeVolume(input)).toBe(expectedStope)

    const result = calculateCutAndFill(input)
    expect(result.geometry.panelOreVolume).toBe(8000)
    expect(result.geometry.pillarOreVolume).toBe(pillarVolume)
    expect(result.geometry.primaryStopeVolume).toBe(expectedStope)
    const sill = result.sections.stoping.rows.find((row) => row.name === '底柱')
    const primary = result.sections.stoping.rows.find((row) => row.name === '采场')
    expect(sill?.oreVolume).toBe(pillarVolume)
    expect(primary?.oreVolume).toBe(expectedStope)
    expect(sill?.producedGeologicalReserve).toBeCloseTo(pillarVolume * 2.82 * 0.95, 2)
    expect(result.sections.block.totals.oreVolume).toBeCloseTo(8000, 5)
    expect(result.sections.block.totals.wasteVolume).toBeCloseTo(15, 5)
  })

  it('flags a negative stope remainder when pillars and development exceed the panel', () => {
    const input = fillReference(createMethodInput('上向进路充填法'))
    setElement(input, 'panel', 2, 2, 2, 1)
    addPillar(input, 4, 4, 4, 1, { kind: 'barrier-pillar' })
    const issues = validateMiningInput(input)
    expect(issues.some((issue) => issue.code === 'negative-stope')).toBe(true)
    expect(computedStopeVolume(input)).toBeLessThan(0)
  })

  it("applies each stoping element's own loss-dilution", () => {
    const input = fillReference(createMethodInput('点柱式分层充填法'))
    setElement(input, 'panel', 10, 10, 10, 1)
    addPillar(input, 2, 2, 2, 1, { kind: 'point-pillar', lossRate: 1, dilutionRate: 0 })
    const row = calculateCutAndFill(input).sections.stoping.rows.find((item) => item.kind === 'point-pillar')
    expect(row?.geologicalReserve).toBeCloseTo(8 * 2.82, 5)
    expect(row?.producedGeologicalReserve).toBe(0)
    expect(row?.producedOre).toBe(0)
  })

  it('returns null derived values and issues for missing parameters instead of NaN', () => {
    const input = createMethodInput('上向进路充填法')
    input.preparation = [{ id: 'r1', name: '采准巷道', quantity: 1, oreSingleLength: 1, wasteSingleLength: 1, oreSectionArea: 1, wasteSectionArea: 1, note: '' }]
    const result = calculateCutAndFill(input)
    expect(result.issues.some((issue) => issue.field === 'oreDensity')).toBe(true)
    expect(result.issues.some((issue) => issue.field === 'levelHeight')).toBe(false)
    expect(result.sections.preparation.rows.every((row) => !Number.isNaN(row.geologicalReserve ?? 0))).toBe(true)
  })

  it('uses panel produced ore as the denominator for ratios and shares', () => {
    const input = fillReference(createMethodInput('综掘机落矿上向进路充填法'))
    input.preparation = [{
      id: 'r1',
      name: '穿脉巷道',
      quantity: 1,
      oreSingleLength: 10,
      wasteSingleLength: 5,
      oreSectionArea: 2,
      wasteSectionArea: 3,
      note: '',
    }]
    setElement(input, 'panel', 10, 10, 10, 1)
    const result = calculateCutAndFill(input)
    const produced = result.sections.block.totals.producedOre
    expect(produced).not.toBeNull()
    expect(result.metrics.preparationRatio.value).toBeCloseTo((15 * 1000) / (produced as number), 6)
    expect(result.metrics.preparationVolumeRatio.value).toBeCloseTo((35 * 1000) / (produced as number), 6)
    expect(result.metrics.cuttingVolumeRatio.value).toBe(0)
    expect(result.sections.preparation.rows[0].share).toBeCloseTo(
      ((result.sections.preparation.rows[0].producedOre as number) / (produced as number)) * 100,
      5,
    )
  })

  it('validates names, duplicate rows and ranges', () => {
    const input = createMethodInput('上向进路充填法')
    input.preparation = [
      { id: 'a', name: '', quantity: -1, oreSingleLength: 1, wasteSingleLength: 1, oreSectionArea: 1, wasteSectionArea: 1, note: '' },
      { id: 'b', name: '', quantity: 1, oreSingleLength: 1, wasteSingleLength: 1, oreSectionArea: 1, wasteSectionArea: 1, note: '' },
    ]
    input.common.cuttingLossDilution = { lossRate: 2, dilutionRate: 0.05 }
    const issues = validateMiningInput(input)
    expect(issues.some((issue) => issue.field === 'preparation.a.name')).toBe(true)
    expect(issues.some((issue) => issue.code === 'duplicate-name')).toBe(true)
    expect(issues.some((issue) => issue.code === 'non-negative')).toBe(true)
    expect(issues.some((issue) => issue.field === 'cuttingLossDilution.lossRate')).toBe(true)
    expect(issues.some((issue) => issue.field === 'strikeLength')).toBe(false)
    expect(issues.some((issue) => issue.field === 'levelHeight')).toBe(false)
  })
})
