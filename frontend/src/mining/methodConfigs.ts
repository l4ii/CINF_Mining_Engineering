import type { BlockElementInput, BlockElementKind, CommonParameters, LossDilutionIndicator, MiningMethodInput } from './types'

const emptyIndicator = (): LossDilutionIndicator => ({ dilutionRate: null, lossRate: null })

const emptyCommon = (): CommonParameters => ({
  dipAngle: null,
  levelHeight: null,
  strikeLength: null,
  inclinedLength: null,
  trueThickness: null,
  oreDensity: null,
  wasteDensity: null,
  cuttingLossDilution: emptyIndicator(),
  stopingLossDilution: emptyIndicator(),
  crownSillLossDilution: emptyIndicator(),
  barrierLossDilution: emptyIndicator(),
  pointPillarLossDilution: emptyIndicator(),
})

const BLOCK_TEMPLATE: Array<{ kind: BlockElementKind; name: string }> = [
  { kind: 'barrier-pillar', name: '矿柱' },
  { kind: 'crown-pillar', name: '顶柱' },
  { kind: 'sill-pillar', name: '底柱' },
  { kind: 'point-pillar', name: '点柱' },
  { kind: 'primary-stope', name: '采场' },
]

export function createDefaultBlockElements(): BlockElementInput[] {
  return BLOCK_TEMPLATE.map((item) => ({
    id: item.kind,
    kind: item.kind,
    name: item.name,
    sectionArea: null,
    height: null,
    quantity: 1,
  }))
}

export function createBlockElement(name = ''): BlockElementInput {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id: `custom-${stamp}`,
    kind: 'custom',
    name,
    sectionArea: null,
    height: null,
    quantity: 1,
  }
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
    preparation: [],
    cutting: [],
  }
}
