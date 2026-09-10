export const PROJECT_STAGES = [
  'overview',
  'parameters',
  'occurrence',
  'methods',
  'capacity',
  'equipment',
  'ventilation',
  'backfill',
] as const

export type ProjectStageId = (typeof PROJECT_STAGES)[number]

export const PROJECT_STAGE_LABELS: Record<ProjectStageId, { zh: string; en: string }> = {
  overview: { zh: '项目概况', en: 'Overview' },
  parameters: { zh: '基础参数', en: 'Parameters' },
  occurrence: { zh: '产状分布', en: 'Occurrence' },
  methods: { zh: '采矿方法', en: 'Methods' },
  capacity: { zh: '生产能力', en: 'Capacity' },
  equipment: { zh: '矿山设备', en: 'Equipment' },
  ventilation: { zh: '矿井通风', en: 'Ventilation' },
  backfill: { zh: '充填系统', en: 'Backfill' },
}

export type MethodMetrics = {
  preparationRatio: number | null
  preparationVolumeRatio: number | null
  cuttingRatio: number | null
  cuttingVolumeRatio: number | null
  cutAndFillRatio: number | null
  cutAndFillVolumeRatio: number | null
  wasteRate: number | null
  byProductOreProportion: number | null
  recoveryRate: number | null
  lossRate: number | null
  dilutionRate: number | null
}

export const EMPTY_METHOD_METRICS: MethodMetrics = {
  preparationRatio: null,
  preparationVolumeRatio: null,
  cuttingRatio: null,
  cuttingVolumeRatio: null,
  cutAndFillRatio: null,
  cutAndFillVolumeRatio: null,
  wasteRate: null,
  byProductOreProportion: null,
  recoveryRate: null,
  lossRate: null,
  dilutionRate: null,
}

export type MethodCandidate = {
  id: string
  name: string
  methodName: string
  calculated: boolean
} & MethodMetrics

export type OreBody = {
  id: string
  name: string
  dipAngle: number | null
  thickness: number | null
  category: string
  candidates: MethodCandidate[]
  selectedCandidateId: string | null
}

export type MiningProject = {
  id: string
  name: string
  location: string
  note: string
  oreDensity: number | null
  wasteDensity: number | null
  oreBodies: OreBody[]
  updatedAt: number
  openedAt: number
}

export const PROJECT_STORE_KEY = 'cinf-mining-projects-v1'
export const ORE_BODY_CATEGORY_STORE_KEY = 'cinf-mining-orebody-categories-v1'

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyProject(name = '', at = Date.now()): MiningProject {
  return {
    id: makeId('project'),
    name,
    location: '',
    note: '',
    oreDensity: null,
    wasteDensity: null,
    oreBodies: [],
    updatedAt: at,
    openedAt: at,
  }
}

export function formatProjectTimestamp(at: number | null | undefined): string {
  if (at == null || !Number.isFinite(at)) return '—'
  const date = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function withProjectUpdated(
  project: MiningProject,
  patch: Partial<MiningProject> = {},
  at = Date.now(),
): MiningProject {
  return { ...project, ...patch, updatedAt: at }
}

export function withProjectOpened(project: MiningProject, at = Date.now()): MiningProject {
  return { ...project, openedAt: at }
}

export function createCandidate(
  input: Partial<Omit<MethodCandidate, 'id'>> & { id?: string } = {},
): MethodCandidate {
  const { id, name = '', methodName = '', calculated = false, ...metrics } = input
  return {
    id: id ?? makeId('method'),
    name,
    methodName,
    calculated,
    ...EMPTY_METHOD_METRICS,
    ...metrics,
  }
}

export function createOreBody(
  input: Partial<Omit<OreBody, 'id'>> & { id?: string } = {},
): OreBody {
  const {
    id,
    name = '',
    dipAngle = null,
    thickness = null,
    category = '',
    candidates = [],
    selectedCandidateId = null,
  } = input
  return {
    id: id ?? makeId('orebody'),
    name,
    dipAngle,
    thickness,
    category,
    candidates,
    selectedCandidateId,
  }
}

export function isOverviewComplete(project: MiningProject | null): boolean {
  return Boolean(project?.name.trim())
}

export function isParametersComplete(project: MiningProject | null): boolean {
  return Boolean(
    project &&
      project.oreDensity != null &&
      Number.isFinite(project.oreDensity) &&
      project.wasteDensity != null &&
      Number.isFinite(project.wasteDensity),
  )
}

export function isOreBodyOccurrenceReady(body: OreBody): boolean {
  return body.dipAngle != null && body.thickness != null
}

export function isOccurrenceComplete(project: MiningProject | null): boolean {
  return Boolean(project && project.oreBodies.some(isOreBodyOccurrenceReady))
}

export function isOreBodyComplete(body: OreBody): boolean {
  return Boolean(
    body.selectedCandidateId &&
      body.candidates.some((candidate) => candidate.id === body.selectedCandidateId),
  )
}

export function isMethodsComplete(project: MiningProject | null): boolean {
  return Boolean(
    project &&
      project.oreBodies.length > 0 &&
      project.oreBodies.every(isOreBodyComplete),
  )
}

export function isStageComplete(stage: ProjectStageId, project: MiningProject | null): boolean {
  switch (stage) {
    case 'overview':
      return isOverviewComplete(project)
    case 'parameters':
      return isParametersComplete(project)
    case 'occurrence':
      return isOccurrenceComplete(project)
    case 'methods':
      return isMethodsComplete(project)
    default:
      return isMethodsComplete(project)
  }
}

export function isStageUnlocked(stage: ProjectStageId, project: MiningProject | null): boolean {
  switch (stage) {
    case 'overview':
      return true
    case 'parameters':
      return isOverviewComplete(project)
    case 'occurrence':
      return isParametersComplete(project)
    case 'methods':
      return isOccurrenceComplete(project)
    default:
      return isMethodsComplete(project)
  }
}

export const LINEAR_PROJECT_STAGES = PROJECT_STAGES.filter((id) => id !== 'methods')

export function previousProjectStage(stage: ProjectStageId): ProjectStageId | null {
  if (stage === 'methods') return 'occurrence'
  const index = LINEAR_PROJECT_STAGES.indexOf(stage)
  return index > 0 ? LINEAR_PROJECT_STAGES[index - 1] : null
}

export function nextProjectStage(stage: ProjectStageId): ProjectStageId | null {
  if (stage === 'methods') return null
  const index = LINEAR_PROJECT_STAGES.indexOf(stage)
  return index >= 0 && index < LINEAR_PROJECT_STAGES.length - 1 ? LINEAR_PROJECT_STAGES[index + 1] : null
}

export function pickOreBodyForMethods(
  project: MiningProject | null,
  preferredId?: string | null,
): string | null {
  if (!project) return null
  const ready = project.oreBodies.filter(isOreBodyOccurrenceReady)
  if (ready.length === 0) return null
  if (preferredId && ready.some((body) => body.id === preferredId)) return preferredId
  return ready.find((body) => !isOreBodyComplete(body))?.id ?? ready[0].id
}

export function oreBodyDisplayName(body: OreBody, index: number): string {
  const name = body.name.trim()
  return name || `矿体${index + 1}`
}

export function invalidateOreBodyOnOccurrenceChange(body: OreBody): OreBody {
  return {
    ...body,
    selectedCandidateId: null,
    candidates: body.candidates.map((candidate) => ({ ...candidate, calculated: false })),
  }
}

export function updateOreBodyOccurrence(
  body: OreBody,
  dipAngle: number | null,
  thickness: number | null,
): OreBody {
  const next = { ...body, dipAngle, thickness }
  if (body.dipAngle === dipAngle && body.thickness === thickness) return next
  return invalidateOreBodyOnOccurrenceChange(next)
}

export function reorderOreBodies(bodies: OreBody[], fromId: string, toId: string): OreBody[] {
  const from = bodies.findIndex((item) => item.id === fromId)
  const to = bodies.findIndex((item) => item.id === toId)
  if (from < 0 || to < 0 || from === to) return bodies
  const next = [...bodies]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function parseProjectNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function loadOreBodyCategories(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(ORE_BODY_CATEGORY_STORE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return uniqueCategories(parsed)
  } catch {
    return []
  }
}

export function rememberOreBodyCategory(label: string): string[] {
  const trimmed = label.trim()
  const current = loadOreBodyCategories()
  if (!trimmed || current.includes(trimmed)) return current
  const next = [...current, trimmed]
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ORE_BODY_CATEGORY_STORE_KEY, JSON.stringify(next))
  }
  return next
}

export function listOreBodyCategories(projects: MiningProject[] = []): string[] {
  return uniqueCategories([
    ...loadOreBodyCategories(),
    ...projects.flatMap((project) => project.oreBodies.map((body) => body.category)),
  ])
}

function uniqueCategories(values: unknown[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

export const PROJECT_LIST_PAGE_SIZE = 6

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize = PROJECT_LIST_PAGE_SIZE,
): { page: number; pageCount: number; total: number; items: T[] } {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * pageSize
  return {
    page: current,
    pageCount,
    total,
    items: items.slice(start, start + pageSize),
  }
}

export type ProjectStoreSnapshot = {
  projects: MiningProject[]
  currentProjectId: string | null
}

export function ensureProjectId<T extends { id?: string }>(project: T): T & { id: string } {
  return project.id ? (project as T & { id: string }) : { ...project, id: makeId('project') }
}

export function normalizeProject(
  project: Omit<MiningProject, 'updatedAt' | 'openedAt'> & {
    updatedAt?: number
    openedAt?: number
  },
  at = Date.now(),
): MiningProject {
  const withId = ensureProjectId(project)
  return {
    ...withId,
    oreBodies: Array.isArray(withId.oreBodies) ? withId.oreBodies.map((body) => createOreBody(body)) : [],
    updatedAt: typeof withId.updatedAt === 'number' && Number.isFinite(withId.updatedAt) ? withId.updatedAt : at,
    openedAt: typeof withId.openedAt === 'number' && Number.isFinite(withId.openedAt) ? withId.openedAt : at,
  }
}

export function loadProjectStore(): ProjectStoreSnapshot {
  if (typeof localStorage === 'undefined') return { projects: [], currentProjectId: null }
  try {
    const raw = localStorage.getItem(PROJECT_STORE_KEY)
    if (!raw) return { projects: [], currentProjectId: null }
    const parsed = JSON.parse(raw) as Partial<ProjectStoreSnapshot>
    const projects = Array.isArray(parsed.projects)
      ? parsed.projects.map((item) => normalizeProject(item as MiningProject))
      : []
    const currentProjectId =
      typeof parsed.currentProjectId === 'string' && projects.some((item) => item.id === parsed.currentProjectId)
        ? parsed.currentProjectId
        : (projects[0]?.id ?? null)
    return { projects, currentProjectId }
  } catch {
    return { projects: [], currentProjectId: null }
  }
}

export function cloneProjectAsImport(project: MiningProject, at = Date.now()): MiningProject {
  const normalized = normalizeProject(project, at)
  return {
    ...normalized,
    id: makeId('project'),
    updatedAt: at,
    openedAt: at,
    oreBodies: normalized.oreBodies.map((body) => {
      const idMap = new Map<string, string>()
      const candidates = body.candidates.map((candidate) => {
        const nextId = makeId('method')
        idMap.set(candidate.id, nextId)
        return { ...candidate, id: nextId }
      })
      return {
        ...body,
        id: makeId('orebody'),
        candidates,
        selectedCandidateId: body.selectedCandidateId ? idMap.get(body.selectedCandidateId) ?? null : null,
      }
    }),
  }
}

export function saveProjectStore(snapshot: ProjectStoreSnapshot): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PROJECT_STORE_KEY, JSON.stringify(snapshot))
}
