import { describe, expect, it } from 'vitest'
import { calculateCutAndFill, createMethodInput } from './cutAndFillCalc'
import { explainResultCell, traceResultCell } from './resultTableExplain'

function fill(input: ReturnType<typeof createMethodInput>) {
  input.common.oreDensity = 2.82
  input.common.wasteDensity = 2.8
  input.common.preparationLossDilution = { lossRate: 0.1, dilutionRate: 0.05 }
  input.common.cuttingLossDilution = { lossRate: 0.08, dilutionRate: 0.04 }
  input.common.blockLossDilution = { lossRate: 0.05, dilutionRate: 0.05 }
  input.preparation = [{
    id: 'r1',
    name: '穿脉巷道',
    quantity: 4,
    oreSingleLength: 10,
    wasteSingleLength: 120,
    oreTotalLength: 40,
    wasteTotalLength: 480,
    oreSectionArea: 8,
    wasteSectionArea: 16.74,
    note: '',
  }]
  const panel = input.blockElements.find((item) => item.kind === 'panel')
  if (panel) {
    panel.length = 20
    panel.width = 10
    panel.height = 10
    panel.quantity = 1
  }
  for (const element of input.blockElements) {
    if (element.kind === 'panel') continue
    element.lossRate = 0.05
    element.dilutionRate = 0.05
  }
  return input
}

describe('result table explanations', () => {
  it('explains the actual zero ore fallback for a rock-only independent part', () => {
    const input = fill(createMethodInput('上向进路充填法'))
    const part = input.blockElements.find((element) => element.kind === 'custom')!
    part.wasteVolume = 100
    const result = calculateCutAndFill(input)
    const row = result.sections.stoping.rows.find((item) => item.id === part.id)!
    expect(row.oreVolume).toBe(0)
    const trace = traceResultCell({ columnIndex: 9, source: 'stoping', row, input, result })
    expect(trace?.formula).toContain('按 0 m³ 计')
    expect(trace?.dependencies).toEqual([])
  })
  it('traces actual volume operands and preserves a total-length override', () => {
    const input = fill(createMethodInput('上向进路充填法'))
    input.preparation[0].wasteTotalLength = 500
    const result = calculateCutAndFill(input)
    const row = result.sections.preparation.rows[0]
    const volume = traceResultCell({ columnIndex: 10, source: 'preparation', row, input, result })
    expect(volume?.dependencies.map((cell) => cell.resultCell)).toEqual(['preparation:r1:wasteTotalLength', 'preparation:r1:wasteSection'])
    expect(volume?.dependencies.map((cell) => cell.value)).toEqual([500, 16.74])
    const length = traceResultCell({ columnIndex: 5, source: 'preparation', row, input, result })
    expect(length?.dependencies.map((cell) => cell.inputId)).toEqual(['preparation-r1-wasteTotalLength'])
    expect(length?.dependencies[0].value).toBe(500)
  })

  it('traces totals through disjoint subtotals and the stope through ore volumes only', () => {
    const input = fill(createMethodInput('上向进路充填法'))
    const result = calculateCutAndFill(input)
    const total = traceResultCell({ columnIndex: 11, source: 'total', totalKey: 'block', totals: result.sections.block.totals, input, result })
    expect(total?.dependencies.map((cell) => cell.resultCell)).toEqual([
      'preparation:total:totalVolume', 'cutting:total:totalVolume', 'stoping:total:totalVolume',
    ])
    const row = result.sections.stoping.rows.find((item) => item.kind === 'primary-stope')
    const stope = traceResultCell({ columnIndex: 9, source: 'stoping', row, input, result })
    expect(stope?.dependencies.map((cell) => cell.value)).toEqual([2000, 320, 0])
    expect(stope?.dependencies.map((cell) => cell.resultCell).filter(Boolean)).toEqual([
      'preparation:total:oreVolume', 'cutting:total:oreVolume',
    ])
  })
  it('explains development volume as total length times section', () => {
    const input = fill(createMethodInput('上向进路充填法'))
    const result = calculateCutAndFill(input)
    const row = result.sections.preparation.rows[0]
    expect(explainResultCell({ columnIndex: 10, source: 'preparation', row, input, result })).toContain('480')
    expect(explainResultCell({ columnIndex: 10, source: 'preparation', row, input, result })).toContain('16.74')
    expect(explainResultCell({ columnIndex: 6, source: 'preparation', row, input, result })).toContain('矿石中总长 40 + 岩石中总长 480')
  })

  it('explains stoping volume from the derived stope remainder', () => {
    const input = fill(createMethodInput('上向进路充填法'))
    const result = calculateCutAndFill(input)
    const row = result.sections.stoping.rows.find((item) => item.kind === 'primary-stope')
    const text = explainResultCell({ columnIndex: 9, source: 'stoping', row, input, result })
    expect(text).toContain('采场矿石体积')
    expect(text).toContain('矿块体积')
  })

  it('explains section totals as sums', () => {
    const input = fill(createMethodInput('上向进路充填法'))
    const result = calculateCutAndFill(input)
    const text = explainResultCell({
      columnIndex: 11,
      source: 'total',
      totals: result.sections.developmentTotal.totals,
      totalLabel: '采切合计',
      input,
      result,
    })
    expect(text).toContain('采准小计')
    expect(text).toContain('切割小计')
  })
})
