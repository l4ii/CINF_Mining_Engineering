import type { BlockElementInput, BlockElementKind, CommonParameters, DevelopmentRowInput, LossDilutionIndicator, MiningMethodInput, PillarShape } from './types'

const emptyIndicator = (): LossDilutionIndicator => ({ dilutionRate: null, lossRate: null })

const emptyCommon = (): CommonParameters => ({
  dipAngle: null,
  levelHeight: null,
  strikeLength: null,
  inclinedLength: null,
  trueThickness: null,
  oreDensity: null,
  wasteDensity: null,
  blockLossDilution: emptyIndicator(),
  preparationLossDilution: emptyIndicator(),
  cuttingLossDilution: emptyIndicator(),
})

export const PILLAR_KINDS: BlockElementKind[] = ['barrier-pillar', 'crown-pillar', 'sill-pillar', 'point-pillar', 'triangle-ore', 'custom', 'secondary-stope']

const BLOCK_TEMPLATE: Array<{ kind: BlockElementKind; name: string; quantity: number | null }> = [
  { kind: 'panel', name: '矿块', quantity: 1 },
  { kind: 'primary-stope', name: '采场', quantity: null },
]

function blankElement(kind: BlockElementKind, name: string, quantity: number | null, id?: string): BlockElementInput {
  return {
    id: id ?? kind,
    kind,
    name,
    shape: 'rectangular',
    length: null,
    width: null,
    height: null,
    quantity,
    dilutionRate: null,
    lossRate: null,
  }
}

export function isPanelElement(element: Pick<BlockElementInput, 'kind'>): boolean {
  return element.kind === 'panel'
}

export function isStopeElement(element: Pick<BlockElementInput, 'kind'>): boolean {
  return element.kind === 'primary-stope'
}

export function isPillarElement(element: Pick<BlockElementInput, 'kind'>): boolean {
  return PILLAR_KINDS.includes(element.kind)
}

export function createDefaultBlockElements(): BlockElementInput[] {
  return insertPillarElement(BLOCK_TEMPLATE.map((item) => blankElement(item.kind, item.name, item.quantity)))
}

export function createBlockElement(name = ''): BlockElementInput {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return blankElement('custom', name, 1, `custom-${stamp}`)
}

export function nextPillarName(elements: BlockElementInput[]): string {
  return `矿柱${elements.filter((element) => isPillarElement(element)).length + 1}`
}

export function insertPillarElement(elements: BlockElementInput[], extra?: BlockElementInput): BlockElementInput[] {
  const pillar = extra ?? createBlockElement()
  const stopeIndex = elements.findIndex((element) => isStopeElement(element))
  if (stopeIndex < 0) return [...elements, pillar]
  return [...elements.slice(0, stopeIndex), pillar, ...elements.slice(stopeIndex)]
}

export function createBlankDevelopmentRow(section: 'preparation' | 'cutting'): DevelopmentRowInput {
  return {
    id: `${section}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    quantity: null,
    oreSingleLength: null,
    wasteSingleLength: null,
    oreTotalLength: null,
    wasteTotalLength: null,
    oreSectionArea: null,
    wasteSectionArea: null,
    note: '',
  }
}

export function isBlankDevelopmentRow(row: DevelopmentRowInput): boolean {
  return (
    !row.name.trim() &&
    row.quantity == null &&
    row.oreSingleLength == null &&
    row.wasteSingleLength == null &&
    row.oreTotalLength == null &&
    row.wasteTotalLength == null &&
    row.oreSectionArea == null &&
    row.wasteSectionArea == null
  )
}

export function hasCutAndFillMethodModule(methodName: string | null | undefined): boolean {
  return Boolean(methodName?.trim())
}

export function createMethodInput(methodName = '采矿方法'): MiningMethodInput {
  return {
    methodName,
    common: emptyCommon(),
    includeTriangleOre: false,
    blockElements: createDefaultBlockElements(),
    preparation: [createBlankDevelopmentRow('preparation')],
    cutting: [createBlankDevelopmentRow('cutting')],
  }
}

export const PILLAR_SHAPE_OPTIONS: Array<{ id: PillarShape; label: string }> = [
  { id: 'rectangular', label: '长方体' },
  { id: 'cylinder', label: '圆柱' },
  { id: 'triangular-prism', label: '三棱柱' },
]
