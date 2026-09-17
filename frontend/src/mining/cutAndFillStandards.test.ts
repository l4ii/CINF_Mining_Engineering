import { describe, expect, it } from 'vitest'
import { classifyDip, classifyThickness, composeOreBodyClassLabel, HANDBOOK_METHOD_NAMES, HANDBOOK_METHODS } from './cutAndFillStandards'

describe('cut-and-fill standard ranges', () => {
  it('classifies thickness values at handbook boundaries', () => {
    expect(classifyThickness(0.79)).toBe('extremely-thin')
    expect(classifyThickness(0.8)).toBe('thin')
    expect(classifyThickness(5)).toBe('thin')
    expect(classifyThickness(15)).toBe('medium-thick')
    expect(classifyThickness(50)).toBe('thick')
    expect(classifyThickness(50.01)).toBe('extremely-thick')
  })

  it('composes a handbook ore-body class from dip and thickness bands', () => {
    expect(composeOreBodyClassLabel(20, 25)).toBe('缓倾斜厚矿体')
    expect(composeOreBodyClassLabel(35, 3)).toBe('倾斜薄矿体')
    expect(composeOreBodyClassLabel(2, 8)).toBe('水平中厚矿体')
    expect(composeOreBodyClassLabel(55, 0.5)).toBe('急倾斜极薄矿体')
    expect(composeOreBodyClassLabel(null, 25)).toBe('—')
    expect(composeOreBodyClassLabel(20, null)).toBe('—')
  })

  it('classifies dip values into the four handbook ranges', () => {
    expect(classifyDip(3)).toBe('horizontal')
    expect(classifyDip(3.01)).toBe('gently-inclined')
    expect(classifyDip(30)).toBe('gently-inclined')
    expect(classifyDip(30.01)).toBe('inclined')
    expect(classifyDip(50)).toBe('inclined')
    expect(classifyDip(50.01)).toBe('steep')
  })

  it('keeps the handbook recommendations in their thickness and dip intersections', () => {
    expect(HANDBOOK_METHODS['medium-thick'].steep).toEqual([
      '分段法', '留矿法', '分层崩落法', '分段崩落法', '上向分层充填法', '上向进路充填法', '下向分层充填法', '分段充填法', '留矿采矿嗣后充填法',
    ])
    expect(HANDBOOK_METHODS.thick.horizontal).toEqual([
      '分段法', '阶段矿房法', '分层崩落法', '分段崩落法', '阶段崩落法', '分层充填法', '阶段充填法',
    ])
    expect(HANDBOOK_METHODS.thick['gently-inclined']).toEqual([
      '分段法', '阶段矿房法', '分层崩落法', '分段崩落法', '阶段崩落法', '点柱充填法', '阶段充填法',
    ])
    expect(HANDBOOK_METHODS.thick.steep).toEqual([
      '分段法', '阶段矿房法', '分层崩落法', '分段崩落法', '阶段崩落法', '上向分层充填法', '阶段充填法',
    ])
    const extremelyThickMethods = ['阶段矿房法', '分段崩落法', '阶段崩落法', '阶段充填法']
    expect(HANDBOOK_METHODS['extremely-thick'].horizontal).toEqual(extremelyThickMethods)
    expect(HANDBOOK_METHODS['extremely-thick']['gently-inclined']).toEqual(extremelyThickMethods)
    expect(HANDBOOK_METHODS['extremely-thick'].inclined).toEqual(extremelyThickMethods)
    expect(HANDBOOK_METHODS['extremely-thick'].steep).toEqual(extremelyThickMethods)
    expect(HANDBOOK_METHOD_NAMES).toContain('全面法')
    expect(HANDBOOK_METHOD_NAMES).toContain('上向进路充填法')
    expect(HANDBOOK_METHOD_NAMES).not.toContain('盘区机械化上向进路充填法')
    expect(HANDBOOK_METHOD_NAMES).toEqual(
      [...HANDBOOK_METHOD_NAMES].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    )
  })
})
