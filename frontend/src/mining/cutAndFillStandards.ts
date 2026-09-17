export type ThicknessBand = 'extremely-thin' | 'thin' | 'medium-thick' | 'thick' | 'extremely-thick'
export type DipBand = 'horizontal' | 'gently-inclined' | 'inclined' | 'steep'

export interface StandardBand<T extends string> {
  id: T
  label: string
  range: string
  min: number
  max: number | null
}

export const THICKNESS_BANDS: StandardBand<ThicknessBand>[] = [
  { id: 'extremely-thin', label: '极薄矿体', range: '< 0.8 m', min: 0, max: 0.8 },
  { id: 'thin', label: '薄矿体', range: '0.8–5 m', min: 0.8, max: 5 },
  { id: 'medium-thick', label: '中厚矿体', range: '5–15 m', min: 5, max: 15 },
  { id: 'thick', label: '厚矿体', range: '15–50 m', min: 15, max: 50 },
  { id: 'extremely-thick', label: '极厚矿体', range: '> 50 m', min: 50, max: null },
]

export const DIP_BANDS: StandardBand<DipBand>[] = [
  { id: 'horizontal', label: '水平矿体', range: '0°–3°', min: 0, max: 3 },
  { id: 'gently-inclined', label: '缓倾斜矿体', range: '3°–30°', min: 3, max: 30 },
  { id: 'inclined', label: '倾斜矿体', range: '30°–50°', min: 30, max: 50 },
  { id: 'steep', label: '急倾斜矿体', range: '> 50°', min: 50, max: null },
]

export const HANDBOOK_METHODS: Record<ThicknessBand, Record<DipBand, string[]>> = {
  'extremely-thin': {
    horizontal: ['壁式削壁充填法'],
    'gently-inclined': ['壁式削壁充填法'],
    inclined: ['上向倾斜式削壁充填法'],
    steep: ['留矿法', '上向倾斜式削壁充填法'],
  },
  thin: {
    horizontal: ['全面法', '房柱法', '壁式崩落法', '壁式充填法'],
    'gently-inclined': ['全面法', '房柱法', '壁式崩落法', '壁式充填法', '进路充填法'],
    inclined: ['爆力运矿采矿法', '分层崩落法', '上向进路充填法', '下向分层充填法'],
    steep: ['分段法', '留矿法', '分层崩落法', '上向分层充填法', '上向进路充填法', '分段充填法', '留矿采矿嗣后充填法'],
  },
  'medium-thick': {
    horizontal: ['房柱法', '壁式充填法'],
    'gently-inclined': ['房柱法', '分段法', '分层崩落法', '上向进路充填法', '下向进路充填法', '倾斜分层充填法'],
    inclined: ['爆力运矿采矿法', '分段法', '分层崩落法', '分段崩落法', '分层充填法', '分段充填法'],
    steep: ['分段法', '留矿法', '分层崩落法', '分段崩落法', '上向分层充填法', '上向进路充填法', '下向分层充填法', '分段充填法', '留矿采矿嗣后充填法'],
  },
  thick: {
    horizontal: ['分段法', '阶段矿房法', '分层崩落法', '分段崩落法', '阶段崩落法', '分层充填法', '阶段充填法'],
    'gently-inclined': ['分段法', '阶段矿房法', '分层崩落法', '分段崩落法', '阶段崩落法', '点柱充填法', '阶段充填法'],
    inclined: ['分段法', '阶段矿房法', '分层崩落法', '分段崩落法', '阶段充填法', '点柱充填法', '上向分层充填法', '分段充填法'],
    steep: ['分段法', '阶段矿房法', '分层崩落法', '分段崩落法', '阶段崩落法', '上向分层充填法', '阶段充填法'],
  },
  'extremely-thick': {
    horizontal: ['阶段矿房法', '分段崩落法', '阶段崩落法', '阶段充填法'],
    'gently-inclined': ['阶段矿房法', '分段崩落法', '阶段崩落法', '阶段充填法'],
    inclined: ['阶段矿房法', '分段崩落法', '阶段崩落法', '阶段充填法'],
    steep: ['阶段矿房法', '分段崩落法', '阶段崩落法', '阶段充填法'],
  },
}

export const HANDBOOK_METHOD_NAMES: string[] = (() => {
  const seen = new Set<string>()
  const names: string[] = []
  for (const thickness of THICKNESS_BANDS) {
    for (const dip of DIP_BANDS) {
      for (const name of HANDBOOK_METHODS[thickness.id][dip.id]) {
        if (seen.has(name)) continue
        seen.add(name)
        names.push(name)
      }
    }
  }
  return names.sort((a, b) => a.localeCompare(b, 'zh-CN'))
})()

export function classifyThickness(value: number): ThicknessBand | null {
  if (!Number.isFinite(value) || value < 0) return null
  if (value < 0.8) return 'extremely-thin'
  if (value <= 5) return 'thin'
  if (value <= 15) return 'medium-thick'
  if (value <= 50) return 'thick'
  return 'extremely-thick'
}

export function classifyDip(value: number): DipBand | null {
  if (!Number.isFinite(value) || value < 0) return null
  if (value <= 3) return 'horizontal'
  if (value <= 30) return 'gently-inclined'
  if (value <= 50) return 'inclined'
  return 'steep'
}

export function composeOreBodyClassLabel(dipAngle: number | null, thickness: number | null): string {
  if (dipAngle == null || thickness == null) return '—'
  const dip = classifyDip(dipAngle)
  const thicknessBand = classifyThickness(thickness)
  if (!dip || !thicknessBand) return '—'
  const dipLabel = DIP_BANDS.find((band) => band.id === dip)?.label.replace(/矿体$/, '') ?? ''
  const thicknessLabel = THICKNESS_BANDS.find((band) => band.id === thicknessBand)?.label ?? ''
  if (!dipLabel || !thicknessLabel) return '—'
  return `${dipLabel}${thicknessLabel}`
}
