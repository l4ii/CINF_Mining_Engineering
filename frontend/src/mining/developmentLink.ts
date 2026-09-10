import type { DevelopmentRowInput } from './types'

function product(
  quantity: number | null,
  single: number | null,
  total: number | null,
  edited: 'quantity' | 'single' | 'total',
): { quantity: number | null; single: number | null; total: number | null } {
  let nextQuantity = quantity
  let nextSingle = single
  let nextTotal = total
  if (edited === 'quantity') {
    if (nextQuantity != null && nextSingle != null) nextTotal = nextQuantity * nextSingle
    else if (nextQuantity != null && nextQuantity !== 0 && nextTotal != null) nextSingle = nextTotal / nextQuantity
  } else if (edited === 'single') {
    if (nextQuantity != null && nextSingle != null) nextTotal = nextQuantity * nextSingle
    else if (nextSingle != null && nextSingle !== 0 && nextTotal != null) nextQuantity = nextTotal / nextSingle
  } else if (nextQuantity != null && nextQuantity !== 0 && nextTotal != null) {
    nextSingle = nextTotal / nextQuantity
  } else if (nextSingle != null && nextSingle !== 0 && nextTotal != null) {
    nextQuantity = nextTotal / nextSingle
  }
  return { quantity: nextQuantity, single: nextSingle, total: nextTotal }
}

export function resolvedOreLength(row: Pick<DevelopmentRowInput, 'quantity' | 'oreSingleLength' | 'oreTotalLength'>): number | null {
  if (row.oreTotalLength != null && Number.isFinite(row.oreTotalLength)) return row.oreTotalLength
  if (row.quantity != null && row.oreSingleLength != null) return row.quantity * row.oreSingleLength
  return null
}

export function resolvedWasteLength(row: Pick<DevelopmentRowInput, 'quantity' | 'wasteSingleLength' | 'wasteTotalLength'>): number | null {
  if (row.wasteTotalLength != null && Number.isFinite(row.wasteTotalLength)) return row.wasteTotalLength
  if (row.quantity != null && row.wasteSingleLength != null) return row.quantity * row.wasteSingleLength
  return null
}

export function resolvedTotalLength(row: DevelopmentRowInput): number | null {
  const ore = resolvedOreLength(row)
  const waste = resolvedWasteLength(row)
  if (ore == null && waste == null) return null
  return (ore ?? 0) + (waste ?? 0)
}

export function applyDevelopmentLink(row: DevelopmentRowInput, field: string): DevelopmentRowInput {
  const next = { ...row }
  if (field === 'oreSingleLength' || field === 'oreTotalLength') {
    const ore = product(
      next.quantity,
      next.oreSingleLength,
      next.oreTotalLength,
      field === 'oreSingleLength' ? 'single' : 'total',
    )
    next.quantity = ore.quantity
    next.oreSingleLength = ore.single
    next.oreTotalLength = ore.total
    if (next.quantity !== row.quantity) {
      const waste = product(next.quantity, next.wasteSingleLength, next.wasteTotalLength, 'quantity')
      next.wasteSingleLength = waste.single
      next.wasteTotalLength = waste.total
    }
    return next
  }
  if (field === 'wasteSingleLength' || field === 'wasteTotalLength') {
    const waste = product(
      next.quantity,
      next.wasteSingleLength,
      next.wasteTotalLength,
      field === 'wasteSingleLength' ? 'single' : 'total',
    )
    next.quantity = waste.quantity
    next.wasteSingleLength = waste.single
    next.wasteTotalLength = waste.total
    if (next.quantity !== row.quantity) {
      const ore = product(next.quantity, next.oreSingleLength, next.oreTotalLength, 'quantity')
      next.oreSingleLength = ore.single
      next.oreTotalLength = ore.total
    }
    return next
  }
  if (field === 'quantity') {
    const ore = product(next.quantity, next.oreSingleLength, next.oreTotalLength, 'quantity')
    const waste = product(next.quantity, next.wasteSingleLength, next.wasteTotalLength, 'quantity')
    next.oreSingleLength = ore.single
    next.oreTotalLength = ore.total
    next.wasteSingleLength = waste.single
    next.wasteTotalLength = waste.total
  }
  return next
}
