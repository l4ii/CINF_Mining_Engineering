import { describe, expect, it } from 'vitest'
import { applyDevelopmentLink, resolvedWasteLength } from './developmentLink'
import type { DevelopmentRowInput } from './types'

function row(partial: Partial<DevelopmentRowInput> = {}): DevelopmentRowInput {
  return {
    id: 'r1',
    name: '',
    quantity: null,
    oreSingleLength: null,
    wasteSingleLength: null,
    oreTotalLength: null,
    wasteTotalLength: null,
    oreSectionArea: null,
    wasteSectionArea: null,
    note: '',
    ...partial,
  }
}

describe('development length linking', () => {
  it('keeps total length alone without inventing count or unit length', () => {
    const next = applyDevelopmentLink(row({ wasteTotalLength: 480 }), 'wasteTotalLength')
    expect(next.wasteTotalLength).toBe(480)
    expect(next.quantity).toBeNull()
    expect(next.wasteSingleLength).toBeNull()
    expect(resolvedWasteLength(next)).toBe(480)
  })

  it('derives unit length from total and count', () => {
    const next = applyDevelopmentLink(row({ wasteTotalLength: 480, quantity: 4 }), 'quantity')
    expect(next.wasteSingleLength).toBe(120)
  })

  it('derives count from total and unit length', () => {
    const next = applyDevelopmentLink(row({ wasteTotalLength: 480, wasteSingleLength: 120 }), 'wasteSingleLength')
    expect(next.quantity).toBe(4)
  })

  it('derives total from count and unit length', () => {
    const next = applyDevelopmentLink(row({ quantity: 4, wasteSingleLength: 120 }), 'wasteSingleLength')
    expect(next.wasteTotalLength).toBe(480)
  })

  it('derives ore total length from count times unit length', () => {
    const next = applyDevelopmentLink(row({ quantity: 5, oreSingleLength: 100 }), 'oreSingleLength')
    expect(next.oreTotalLength).toBe(500)
  })
})
