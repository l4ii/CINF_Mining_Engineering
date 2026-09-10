import {
  cloneProjectAsImport,
  createCandidate,
  createEmptyProject,
  createOreBody,
  normalizeProject,
  type MiningProject,
} from './project'

export const PROJECT_CASE_FILE_EXT = '.cinfmine'
export const PROJECT_CASE_FILE_TYPE = 'cinf-mining-project'

export function isProjectCaseFileName(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith(PROJECT_CASE_FILE_EXT)
}

export function sanitizeProjectFileName(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_') || '采矿工程项目'
}

export function buildProjectCaseFileName(project: Pick<MiningProject, 'name'>): string {
  return `${sanitizeProjectFileName(project.name)}${PROJECT_CASE_FILE_EXT}`
}

export function buildProjectCaseExportPayload(project: MiningProject) {
  return {
    type: PROJECT_CASE_FILE_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
  }
}

export function buildProjectCaseFileText(project: MiningProject): string {
  return JSON.stringify(buildProjectCaseExportPayload(project), null, 2)
}

function looksLikeProject(value: unknown): value is Partial<MiningProject> {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MiningProject>
  return typeof candidate.name === 'string' && Array.isArray(candidate.oreBodies)
}

function hydrateImportedProject(raw: Partial<MiningProject>, at = Date.now()): MiningProject {
  const oreBodies = Array.isArray(raw.oreBodies)
    ? raw.oreBodies.map((body) => {
        const candidates = Array.isArray(body.candidates)
          ? body.candidates.map((candidate) => createCandidate(candidate))
          : []
        const selectedCandidateId =
          typeof body.selectedCandidateId === 'string' && candidates.some((item) => item.id === body.selectedCandidateId)
            ? body.selectedCandidateId
            : null
        return createOreBody({
          id: typeof body.id === 'string' ? body.id : undefined,
          name: typeof body.name === 'string' ? body.name : '',
          dipAngle: typeof body.dipAngle === 'number' && Number.isFinite(body.dipAngle) ? body.dipAngle : null,
          thickness: typeof body.thickness === 'number' && Number.isFinite(body.thickness) ? body.thickness : null,
          category: typeof body.category === 'string' ? body.category : '',
          candidates,
          selectedCandidateId,
        })
      })
    : []

  const base = createEmptyProject(typeof raw.name === 'string' ? raw.name : '', at)
  return normalizeProject(
    {
      ...base,
      ...(typeof raw.id === 'string' ? { id: raw.id } : {}),
      location: typeof raw.location === 'string' ? raw.location : '',
      note: typeof raw.note === 'string' ? raw.note : '',
      oreDensity: typeof raw.oreDensity === 'number' && Number.isFinite(raw.oreDensity) ? raw.oreDensity : null,
      wasteDensity: typeof raw.wasteDensity === 'number' && Number.isFinite(raw.wasteDensity) ? raw.wasteDensity : null,
      oreBodies,
      updatedAt: raw.updatedAt,
      openedAt: raw.openedAt,
    },
    at,
  )
}

export function parseProjectCasePayload(payload: unknown, at = Date.now()): MiningProject[] {
  if (!payload || typeof payload !== 'object') return []
  const maybe = payload as { type?: string; project?: unknown; case?: unknown; projects?: unknown }
  const records: unknown[] = Array.isArray(maybe.projects)
    ? maybe.projects
    : maybe.type === PROJECT_CASE_FILE_TYPE
      ? [maybe.project ?? maybe.case]
      : looksLikeProject(payload)
        ? [payload]
        : []
  return records.filter(looksLikeProject).map((item) => hydrateImportedProject(item, at))
}

export async function readProjectCaseFile(file: File, at = Date.now()): Promise<MiningProject[]> {
  const text = await file.text()
  return parseProjectCasePayload(JSON.parse(text) as unknown, at)
}

export function importProjectCases(projects: MiningProject[], at = Date.now()): MiningProject[] {
  return projects.map((project, index) => cloneProjectAsImport(project, at + index))
}
