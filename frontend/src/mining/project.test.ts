import { describe, expect, it } from 'vitest'
import { createMethodInput } from './methodConfigs'
import {
  createCandidate,
  createEmptyProject,
  createOreBody,
  formatProjectTimestamp,
  invalidateOreBodyOnOccurrenceChange,
  isOreBodyComplete,
  isStageComplete,
  isStageUnlocked,
  loadProjectStore,
  nextProjectStage,
  normalizeProject,
  oreBodyDisplayName,
  paginateItems,
  pickOreBodyForMethods,
  previousProjectStage,
  PROJECT_LIST_PAGE_SIZE,
  PROJECT_STORE_KEY,
  cloneProjectAsImport,
  rememberOreBodyCategory,
  listOreBodyCategories,
  reorderOreBodies,
  saveProjectStore,
  updateOreBodyOccurrence,
  withProjectOpened,
  withProjectUpdated,
} from './project'

describe('mining project model', () => {
  it('starts empty and only unlocks project overview', () => {
    expect(isStageUnlocked('overview', null)).toBe(true)
    expect(isStageUnlocked('parameters', null)).toBe(false)
    expect(isStageUnlocked('occurrence', null)).toBe(false)
    expect(isStageUnlocked('methods', null)).toBe(false)
    expect(isStageUnlocked('capacity', null)).toBe(false)
    expect(isStageComplete('overview', null)).toBe(false)
  })

  it('unlocks parameters after the project name is filled', () => {
    const project = createEmptyProject('东区试验矿')
    expect(isStageComplete('overview', project)).toBe(true)
    expect(isStageUnlocked('parameters', project)).toBe(true)
    expect(isStageUnlocked('occurrence', project)).toBe(false)
  })

  it('unlocks occurrence after both densities are filled', () => {
    const project = {
      ...createEmptyProject('东区试验矿'),
      oreDensity: 2.7,
      wasteDensity: 2.6,
    }
    expect(isStageComplete('parameters', project)).toBe(true)
    expect(isStageUnlocked('occurrence', project)).toBe(true)
    expect(isStageUnlocked('methods', project)).toBe(false)
  })

  it('unlocks mining methods after at least one ore body has dip and thickness', () => {
    const project = {
      ...createEmptyProject('东区试验矿'),
      oreDensity: 2.7,
      wasteDensity: 2.6,
      oreBodies: [createOreBody({ name: '1号矿体', dipAngle: 35, thickness: 3 })],
    }
    expect(isStageComplete('occurrence', project)).toBe(true)
    expect(isStageUnlocked('methods', project)).toBe(true)
    expect(isStageUnlocked('capacity', project)).toBe(false)
    expect(isOreBodyComplete(project.oreBodies[0])).toBe(false)
  })

  it('completes an ore body only after a candidate method is selected', () => {
    const candidate = createCandidate({ methodName: '上向进路充填法', calculated: true })
    const body = createOreBody({
      name: '1号矿体',
      dipAngle: 35,
      thickness: 3,
      candidates: [candidate],
    })
    expect(isOreBodyComplete(body)).toBe(false)
    expect(isOreBodyComplete({ ...body, selectedCandidateId: candidate.id })).toBe(true)
  })

  it('unlocks production capacity after every ore body has a selected method', () => {
    const first = createCandidate({ methodName: '上向进路充填法', calculated: true })
    const second = createCandidate({ methodName: '全面法', calculated: true })
    const project = {
      ...createEmptyProject('东区试验矿'),
      oreDensity: 2.7,
      wasteDensity: 2.6,
      oreBodies: [
        createOreBody({
          name: '1号矿体',
          dipAngle: 35,
          thickness: 3,
          candidates: [first],
          selectedCandidateId: first.id,
        }),
        createOreBody({
          name: '2号矿体',
          dipAngle: 55,
          thickness: 8,
          candidates: [second],
        }),
      ],
    }
    expect(isStageUnlocked('capacity', project)).toBe(false)
    expect(pickOreBodyForMethods(project)).toBe(project.oreBodies[1].id)
    project.oreBodies[1] = { ...project.oreBodies[1], selectedCandidateId: second.id }
    expect(isStageComplete('methods', project)).toBe(true)
    expect(isStageUnlocked('capacity', project)).toBe(true)
    expect(isStageUnlocked('equipment', project)).toBe(true)
    expect(nextProjectStage('overview')).toBe('parameters')
    expect(previousProjectStage('parameters')).toBe('overview')
    expect(nextProjectStage('occurrence')).toBe('capacity')
    expect(previousProjectStage('capacity')).toBe('occurrence')
    expect(nextProjectStage('methods')).toBeNull()
    expect(previousProjectStage('methods')).toBe('occurrence')
    expect(nextProjectStage('backfill')).toBeNull()
    expect(pickOreBodyForMethods(project)).toBe(project.oreBodies[0].id)
    expect(pickOreBodyForMethods(project, project.oreBodies[1].id)).toBe(project.oreBodies[1].id)
  })

  it('falls back to a stable ore-body display name', () => {
    expect(oreBodyDisplayName(createOreBody({ name: '' }), 0)).toBe('矿体1')
  })

  it('clears the adopted method and calculated flags when dip or thickness changes', () => {
    const candidate = createCandidate({ methodName: '上向进路充填法', calculated: true })
    const body = createOreBody({
      dipAngle: 35,
      thickness: 3,
      candidates: [candidate],
      selectedCandidateId: candidate.id,
    })
    const unchanged = updateOreBodyOccurrence(body, 35, 3)
    expect(unchanged.selectedCandidateId).toBe(candidate.id)
    expect(unchanged.candidates[0].calculated).toBe(true)

    const changed = updateOreBodyOccurrence(body, 55, 3)
    expect(changed.dipAngle).toBe(55)
    expect(changed.selectedCandidateId).toBeNull()
    expect(changed.candidates[0].calculated).toBe(false)
    expect(changed.candidates[0].methodName).toBe('上向进路充填法')
    expect(invalidateOreBodyOnOccurrenceChange(body).selectedCandidateId).toBeNull()
  })

  it('records save and last-opened times on each project', () => {
    const at = new Date(2026, 8, 8, 14, 19).getTime()
    const later = at + 60_000
    const project = createEmptyProject('东区试验矿', at)
    expect(project.updatedAt).toBe(at)
    expect(project.openedAt).toBe(at)
    expect(formatProjectTimestamp(at)).toBe('2026-09-08 14:19')

    const saved = withProjectUpdated(project, { name: '东区试验矿（修订）' }, later)
    expect(saved.name).toBe('东区试验矿（修订）')
    expect(saved.updatedAt).toBe(later)
    expect(saved.openedAt).toBe(at)

    const opened = withProjectOpened(project, later)
    expect(opened.openedAt).toBe(later)
    expect(opened.updatedAt).toBe(at)
  })

  it('fills missing timestamps when loading a legacy project', () => {
    const at = new Date(2026, 8, 8, 9, 0).getTime()
    const legacy = normalizeProject(
      {
        id: 'project-legacy',
        name: '旧项目',
        location: '',
        note: '',
        oreDensity: null,
        wasteDensity: null,
        oreBodies: [],
      },
      at,
    )
    expect(legacy.updatedAt).toBe(at)
    expect(legacy.openedAt).toBe(at)
  })

  it('clones imported projects with new ids while keeping selected methods', () => {
    const candidate = createCandidate({ id: 'method-old', methodName: '上向进路充填法' })
    const source = {
      ...createEmptyProject('案例矿', 1),
      id: 'project-old',
      oreBodies: [
        createOreBody({
          id: 'orebody-old',
          candidates: [candidate],
          selectedCandidateId: 'method-old',
        }),
      ],
    }
    const imported = cloneProjectAsImport(source, 20)
    expect(imported.id).not.toBe('project-old')
    expect(imported.oreBodies[0].id).not.toBe('orebody-old')
    expect(imported.oreBodies[0].candidates[0].id).not.toBe('method-old')
    expect(imported.oreBodies[0].selectedCandidateId).toBe(imported.oreBodies[0].candidates[0].id)
    expect(imported.updatedAt).toBe(20)
  })

  it('remembers typed ore-body categories as selectable classes', () => {
    const remembered = rememberOreBodyCategory('硫化矿')
    expect(remembered).toContain('硫化矿')
    expect(listOreBodyCategories()).toContain('硫化矿')
    expect(rememberOreBodyCategory('硫化矿')).toEqual(remembered)
  })

  it('reorders ore bodies by dragging one onto another', () => {
    const first = createOreBody({ name: '矿体1' })
    const second = createOreBody({ name: '矿体2' })
    const third = createOreBody({ name: '矿体3' })
    expect(reorderOreBodies([first, second, third], first.id, third.id).map((item) => item.name)).toEqual([
      '矿体2',
      '矿体3',
      '矿体1',
    ])
    expect(reorderOreBodies([first, second, third], third.id, first.id).map((item) => item.name)).toEqual([
      '矿体3',
      '矿体1',
      '矿体2',
    ])
    expect(reorderOreBodies([first, second], first.id, first.id)).toEqual([first, second])
  })

  it('paginates project records into fixed-size pages', () => {
    const items = Array.from({ length: 11 }, (_, index) => index + 1)
    expect(PROJECT_LIST_PAGE_SIZE).toBe(6)
    expect(paginateItems(items, 1)).toEqual({
      page: 1,
      pageCount: 2,
      total: 11,
      items: [1, 2, 3, 4, 5, 6],
    })
    expect(paginateItems(items, 2).items).toEqual([7, 8, 9, 10, 11])
    expect(paginateItems(items, 9).page).toBe(2)
    expect(paginateItems([], 1)).toEqual({ page: 1, pageCount: 1, total: 0, items: [] })
  })

  it('stores method calculation worksheets on candidates through the project store', () => {
    const calculationInput = createMethodInput('上向进路充填法')
    const panel = calculationInput.blockElements.find((element) => element.kind === 'panel')
    if (panel) panel.length = 20
    const candidate = createCandidate({ methodName: '上向进路充填法', calculationInput })
    expect(candidate.calculationInput?.blockElements.find((element) => element.kind === 'panel')?.length).toBe(20)

    const project = {
      ...createEmptyProject('东区试验矿', 1),
      oreBodies: [createOreBody({ candidates: [candidate] })],
    }
    saveProjectStore({ projects: [project], currentProjectId: project.id })
    const loaded = loadProjectStore()
    expect(loaded.projects[0].oreBodies[0].candidates[0].calculationInput?.blockElements.find((element) => element.kind === 'panel')?.length).toBe(20)
  })

  it('reloads the project list without restoring a saved working page', () => {
    const project = createEmptyProject('东区试验矿', 1)
    localStorage.setItem(
      PROJECT_STORE_KEY,
      JSON.stringify({
        projects: [project],
        currentProjectId: project.id,
        stage: 'methods',
        currentView: 'settings',
        activeOreBodyId: 'orebody-1',
      }),
    )
    const loaded = loadProjectStore()
    expect(loaded.currentProjectId).toBe(project.id)
    expect(loaded.projects).toHaveLength(1)
    expect(loaded.projects[0].name).toBe('东区试验矿')
    expect(loaded).toEqual({
      projects: loaded.projects,
      currentProjectId: project.id,
    })
  })
})
