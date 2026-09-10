import { describe, expect, it } from 'vitest'
import {
  calculateCutAndFill,
  createMethodInput,
  deriveInclinedLength,
  elementVolume,
  validateMiningInput,
} from './cutAndFillCalc'
import { applyDevelopmentLink } from './developmentLink'

function fillReference(input: ReturnType<typeof createMethodInput>) {
  input.common.dipAngle = 20
  input.common.levelHeight = 50
  input.common.strikeLength = 120
  input.common.trueThickness = 25.7
  input.common.oreDensity = 2.82
  input.common.wasteDensity = 2.8
  input.common.cuttingLossDilution = { lossRate: 0.1, dilutionRate: 0.05 }
  input.common.stopingLossDilution = { lossRate: 0.05, dilutionRate: 0.05 }
  input.common.crownSillLossDilution = { lossRate: 0.06, dilutionRate: 0.05 }
  input.common.barrierLossDilution = { lossRate: 0.1, dilutionRate: 0.05 }
  input.common.pointPillarLossDilution = { lossRate: 1, dilutionRate: 0 }
  return input
}

function setElement(
  input: ReturnType<typeof createMethodInput>,
  kind: string,
  sectionArea: number | null,
  height: number | null,
  quantity: number | null,
) {
  const row = input.blockElements.find((item) => item.kind === kind)
  if (!row) throw new Error(`missing ${kind}`)
  row.sectionArea = sectionArea
  row.height = height
  row.quantity = quantity
}

describe('cut-and-fill calculation engine', () => {
  it('starts from an empty method template without seeded parameters', () => {
    const input = createMethodInput('上向进路充填法')
    expect(input.common.dipAngle).toBeNull()
    expect(input.common.strikeLength).toBeNull()
    expect(input.common.cuttingLossDilution).toEqual({ dilutionRate: null, lossRate: null })
    expect(input.preparation).toEqual([])
    expect(input.cutting).toEqual([])
    expect(input.includeTriangleOre).toBe(false)
    expect(input.blockElements.map((item) => item.kind)).toEqual([
      'barrier-pillar',
      'crown-pillar',
      'sill-pillar',
      'point-pillar',
      'primary-stope',
    ])
  })

  it('derives orebody inclined length as level height / sin(dip)', () => {
    expect(deriveInclinedLength(20, 50)).toBeCloseTo(146.1902224, 5)
    expect(deriveInclinedLength(0, 50)).toBeNull()
    expect(deriveInclinedLength(20, null)).toBeNull()
  })

  it('computes constituent volume as section × height × quantity', () => {
    expect(elementVolume({ sectionArea: 10, height: 4, quantity: 2 })).toBe(80)
    expect(elementVolume({ sectionArea: 10, height: 4, quantity: null })).toBeNull()
  })

  it('computes panel ore volume as strike × incline × true thickness', () => {
    const result = calculateCutAndFill(fillReference(createMethodInput('上向进路充填法')))
    const incline = deriveInclinedLength(20, 50)
    expect(incline).toBeCloseTo(146.1902224, 5)
    expect(result.geometry.inclinedLength).toBeCloseTo(incline as number, 10)
    expect(result.geometry.panelOreVolume).toBeCloseTo(120 * (incline as number) * 25.7, 6)
  })

  it('calculates development lengths, volumes, reserves and waste from cutting loss-dilution', () => {
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

  it('writes each constituent volume into stoping rows and subtotals', () => {
    const input = fillReference(createMethodInput('上向进路充填法'))
    setElement(input, 'sill-pillar', 75.142, 4.166, 111)
    setElement(input, 'primary-stope', 20, 10, 1)
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

    const result = calculateCutAndFill(input)
    const pillarVolume = 75.142 * 4.166 * 111
    const stopeVolume = 20 * 10 * 1

    expect(result.geometry.pillarOreVolume).toBeCloseTo(pillarVolume, 2)
    expect(result.geometry.primaryStopeVolume).toBeCloseTo(stopeVolume, 6)
    expect(result.geometry.secondaryStopeVolume).toBeNull()

    const sill = result.sections.stoping.rows.find((row) => row.name === '底柱')
    const primary = result.sections.stoping.rows.find((row) => row.name === '采场')
    expect(sill?.oreVolume).toBeCloseTo(pillarVolume, 2)
    expect(primary?.oreVolume).toBeCloseTo(stopeVolume, 2)
    expect(sill?.producedGeologicalReserve).toBeCloseTo(pillarVolume * 2.82 * 0.94, 2)
    expect(result.sections.stoping.totals.oreVolume).toBeCloseTo(pillarVolume + stopeVolume, 2)
    expect(result.sections.block.totals.oreVolume).toBeCloseTo(
      (result.sections.preparation.totals.oreVolume as number) + pillarVolume + stopeVolume,
      2,
    )
  })

  it('treats first and second stopes as independently entered volumes', () => {
    const input = fillReference(createMethodInput('上向进路充填法'))
    input.blockElements.push({
      id: 'secondary-stope',
      kind: 'secondary-stope',
      name: '二步骤采场',
      sectionArea: 10,
      height: 10,
      quantity: 1,
    })
    setElement(input, 'primary-stope', 30, 10, 1)
    const result = calculateCutAndFill(input)
    expect(result.geometry.primaryStopeVolume).toBeCloseTo(300, 5)
    expect(result.geometry.secondaryStopeVolume).toBeCloseTo(100, 5)
    expect(result.sections.stoping.rows.find((row) => row.name === '采场')?.oreVolume).toBeCloseTo(300, 5)
    expect(result.sections.stoping.rows.find((row) => row.name === '二步骤采场')?.oreVolume).toBeCloseTo(100, 5)
  })

  it('writes a renamed constituent into the stoping table', () => {
    const input = fillReference(createMethodInput('上向进路充填法'))
    const stope = input.blockElements.find((item) => item.kind === 'primary-stope')
    if (!stope) throw new Error('missing primary-stope')
    stope.name = '三角矿'
    setElement(input, 'primary-stope', 10, 12, 120)
    const row = calculateCutAndFill(input).sections.stoping.rows.find((item) => item.kind === 'primary-stope')
    expect(row?.name).toBe('三角矿')
    expect(row?.oreVolume).toBeCloseTo(10 * 12 * 120, 5)
  })

  it('applies 100% loss to point pillars and leave-out produced ore', () => {
    const input = fillReference(createMethodInput('点柱式分层充填法'))
    setElement(input, 'point-pillar', 16, 8, 10)
    setElement(input, 'primary-stope', 1, 1, 1)
    const row = calculateCutAndFill(input).sections.stoping.rows.find((item) => item.kind === 'point-pillar')
    expect(row?.geologicalReserve).toBeCloseTo(16 * 8 * 10 * 2.82, 5)
    expect(row?.producedGeologicalReserve).toBe(0)
    expect(row?.producedOre).toBe(0)
  })

  it('returns null derived values and issues for missing parameters instead of NaN', () => {
    const input = createMethodInput('上向进路充填法')
    input.preparation = [{ id: 'r1', name: '采准巷道', quantity: 1, oreSingleLength: 1, wasteSingleLength: 1, oreSectionArea: 1, wasteSectionArea: 1, note: '' }]
    const result = calculateCutAndFill(input)
    expect(result.issues.some((issue) => issue.field === 'oreDensity')).toBe(true)
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
    setElement(input, 'primary-stope', 1, 1, 1)
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
  })
})
