export type MiningMethodId = 'pillar-layered-cut-and-fill' | 'upward-cut-and-fill' | 'roadheader-upward-cut-and-fill'

export type LossDilutionIndicator = {
  dilutionRate: number | null
  lossRate: number | null
}

export type CommonParameters = {
  dipAngle: number | null
  levelHeight: number | null
  strikeLength: number | null
  inclinedLength: number | null
  trueThickness: number | null
  oreDensity: number | null
  wasteDensity: number | null
  cuttingLossDilution: LossDilutionIndicator
  stopingLossDilution: LossDilutionIndicator
  crownSillLossDilution: LossDilutionIndicator
  barrierLossDilution: LossDilutionIndicator
  pointPillarLossDilution: LossDilutionIndicator
}

export type BlockElementKind =
  | 'barrier-pillar'
  | 'crown-pillar'
  | 'sill-pillar'
  | 'point-pillar'
  | 'primary-stope'
  | 'secondary-stope'
  | 'triangle-ore'
  | 'custom'

export type BlockElementInput = {
  id: string
  kind: BlockElementKind
  name: string
  sectionArea: number | null
  height: number | null
  quantity: number | null
}

export type DevelopmentRowInput = {
  id: string
  name: string
  quantity: number | null
  oreSingleLength: number | null
  wasteSingleLength: number | null
  oreTotalLength?: number | null
  wasteTotalLength?: number | null
  oreSectionArea: number | null
  wasteSectionArea: number | null
  note: string
}

export type MiningMethodInput = {
  methodName: string
  common: CommonParameters
  includeTriangleOre: boolean
  blockElements: BlockElementInput[]
  preparation: DevelopmentRowInput[]
  cutting: DevelopmentRowInput[]
}

export type CalculatedRow = {
  id: string
  name: string
  kind?: BlockElementKind | 'development'
  totalOreLength: number | null
  totalWasteLength: number | null
  totalLength: number | null
  oreVolume: number | null
  wasteVolume: number | null
  totalVolume: number | null
  geologicalReserve: number | null
  producedGeologicalReserve: number | null
  producedOre: number | null
  wasteMass: number | null
  dilutionAmount: number | null
  share: number | null
  note: string
}

export type SectionTotals = Omit<CalculatedRow, 'id' | 'name' | 'note' | 'share' | 'kind'>

export type CalculationSection = {
  rows: CalculatedRow[]
  totals: SectionTotals
}

export type MetricValue = { value: number | null; unit: string }

export type ValidationIssue = { field: string; code: string; message: string }

export type BlockGeometry = {
  inclinedLength: number | null
  panelOreVolume: number | null
  developmentOreVolume: number | null
  pillarOreVolume: number | null
  stopeRemainder: number | null
  primaryStopeVolume: number | null
  secondaryStopeVolume: number | null
}

export type CutAndFillResult = {
  sections: {
    preparation: CalculationSection
    cutting: CalculationSection
    developmentTotal: CalculationSection
    stoping: CalculationSection
    block: CalculationSection
  }
  geometry: BlockGeometry
  metrics: Record<string, MetricValue>
  issues: ValidationIssue[]
}
