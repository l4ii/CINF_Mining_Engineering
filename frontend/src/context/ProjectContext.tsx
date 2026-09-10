import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  createEmptyProject,
  isOreBodyComplete,
  isOverviewComplete,
  isStageComplete,
  isStageUnlocked,
  loadProjectStore,
  nextProjectStage,
  normalizeProject,
  pickOreBodyForMethods,
  previousProjectStage,
  saveProjectStore,
  withProjectOpened,
  withProjectUpdated,
  type MiningProject,
  type ProjectStageId,
} from '../mining/project'
import { importProjectCases } from '../mining/projectCaseFile'

type ProjectUpdater = MiningProject | null | ((current: MiningProject | null) => MiningProject | null)

type ProjectContextValue = {
  projects: MiningProject[]
  project: MiningProject | null
  stage: ProjectStageId
  activeOreBodyId: string | null
  activeCandidateId: string | null
  setProject: (project: ProjectUpdater) => void
  createProject: () => MiningProject
  importProjects: (incoming: MiningProject[]) => MiningProject[]
  selectProject: (projectId: string) => boolean
  enterProject: (projectId: string) => boolean
  updateProject: (projectId: string, patch: Partial<MiningProject>) => void
  deleteProject: (projectId: string) => boolean
  selectStage: (stage: ProjectStageId) => boolean
  selectOreBody: (oreBodyId: string) => boolean
  openCandidate: (oreBodyId: string, candidateId: string) => boolean
  closeCalculation: () => void
  goPreviousStage: () => boolean
  completeStage: () => boolean
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export type ProjectProviderProps = {
  children: ReactNode
  initialProject?: MiningProject | null
  initialProjects?: MiningProject[]
  initialStage?: ProjectStageId
  initialOreBodyId?: string | null
  persist?: boolean
}

export function ProjectProvider({
  children,
  initialProject,
  initialProjects,
  initialStage = 'overview',
  initialOreBodyId = null,
  persist,
}: ProjectProviderProps) {
  const shouldPersist = persist ?? (initialProject === undefined && initialProjects === undefined)
  const [store, setStore] = useState(() => {
    if (initialProjects) {
      const projects = initialProjects.map(normalizeProject)
      return { projects, currentProjectId: projects[0]?.id ?? null }
    }
    if (initialProject !== undefined) {
      const project = initialProject ? normalizeProject(initialProject) : null
      return { projects: project ? [project] : [], currentProjectId: project?.id ?? null }
    }
    return loadProjectStore()
  })
  const [stage, setStage] = useState<ProjectStageId>(initialStage)
  const [activeOreBodyId, setActiveOreBodyId] = useState<string | null>(initialOreBodyId)
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null)

  const project = store.projects.find((item) => item.id === store.currentProjectId) ?? null

  useEffect(() => {
    if (!shouldPersist) return
    saveProjectStore(store)
  }, [shouldPersist, store])

  const resetNested = () => {
    setActiveOreBodyId(null)
    setActiveCandidateId(null)
  }

  const setProject = useCallback((next: ProjectUpdater) => {
    setStore((previous) => {
      const current = previous.projects.find((item) => item.id === previous.currentProjectId) ?? null
      const resolved = typeof next === 'function' ? next(current) : next
      if (!resolved) return { ...previous, currentProjectId: previous.currentProjectId }
      const withId = normalizeProject(resolved)
      const exists = previous.projects.some((item) => item.id === withId.id)
      const stamped = withProjectUpdated(withId)
      return {
        projects: exists
          ? previous.projects.map((item) => (item.id === withId.id ? stamped : item))
          : [stamped, ...previous.projects],
        currentProjectId: withId.id,
      }
    })
  }, [])

  const createProject = useCallback(() => {
    const created = createEmptyProject()
    setStore((previous) => ({
      projects: [created, ...previous.projects],
      currentProjectId: created.id,
    }))
    setStage('overview')
    resetNested()
    return created
  }, [])

  const importProjects = useCallback((incoming: MiningProject[]) => {
    const imported = importProjectCases(incoming)
    if (imported.length === 0) return []
    setStore((previous) => ({
      projects: [...imported, ...previous.projects],
      currentProjectId: imported[0].id,
    }))
    setStage('overview')
    resetNested()
    return imported
  }, [])

  const selectProject = useCallback((projectId: string) => {
    let found = false
    setStore((previous) => {
      found = previous.projects.some((item) => item.id === projectId)
      if (!found) return previous
      const at = Date.now()
      return {
        currentProjectId: projectId,
        projects: previous.projects.map((item) => (item.id === projectId ? withProjectOpened(item, at) : item)),
      }
    })
    if (!found) return false
    setStage('overview')
    resetNested()
    return true
  }, [])

  const enterProject = useCallback((projectId: string) => {
    let found: MiningProject | undefined
    setStore((previous) => {
      found = previous.projects.find((item) => item.id === projectId)
      if (!found) return previous
      const at = Date.now()
      return {
        currentProjectId: projectId,
        projects: previous.projects.map((item) => (item.id === projectId ? withProjectOpened(item, at) : item)),
      }
    })
    if (!found) return false
    resetNested()
    setStage(isOverviewComplete(found) ? 'parameters' : 'overview')
    return true
  }, [])

  const updateProject = useCallback((projectId: string, patch: Partial<MiningProject>) => {
    setStore((previous) => ({
      ...previous,
      projects: previous.projects.map((item) => (item.id === projectId ? withProjectUpdated(item, patch) : item)),
    }))
  }, [])

  const deleteProject = useCallback((projectId: string) => {
    setStore((previous) => {
      const projects = previous.projects.filter((item) => item.id !== projectId)
      if (projects.length === previous.projects.length) return previous
      const switched = previous.currentProjectId === projectId
      const currentProjectId = switched ? (projects[0]?.id ?? null) : previous.currentProjectId
      const at = Date.now()
      return {
        projects:
          switched && currentProjectId
            ? projects.map((item) => (item.id === currentProjectId ? withProjectOpened(item, at) : item))
            : projects,
        currentProjectId,
      }
    })
    resetNested()
    return true
  }, [])

  const selectStage = useCallback(
    (next: ProjectStageId) => {
      if (!isStageUnlocked(next, project)) return false
      if (next === 'methods') {
        const oreBodyId = pickOreBodyForMethods(project)
        if (!oreBodyId) {
          setStage('occurrence')
          resetNested()
          return true
        }
        setStage('methods')
        setActiveOreBodyId(oreBodyId)
        setActiveCandidateId(null)
        return true
      }
      setStage(next)
      resetNested()
      return true
    },
    [project],
  )

  const selectOreBody = useCallback(
    (oreBodyId: string) => {
      if (!isStageUnlocked('methods', project)) return false
      if (!project?.oreBodies.some((body) => body.id === oreBodyId)) return false
      setStage('methods')
      setActiveOreBodyId(oreBodyId)
      setActiveCandidateId(null)
      return true
    },
    [project],
  )

  const openCandidate = useCallback(
    (oreBodyId: string, candidateId: string) => {
      const body = project?.oreBodies.find((item) => item.id === oreBodyId)
      if (!body?.candidates.some((candidate) => candidate.id === candidateId && candidate.methodName)) {
        return false
      }
      setStage('methods')
      setActiveOreBodyId(oreBodyId)
      setActiveCandidateId(candidateId)
      return true
    },
    [project],
  )

  const closeCalculation = useCallback(() => {
    setActiveCandidateId(null)
  }, [])

  const goPreviousStage = useCallback(() => {
    if (activeCandidateId) {
      setActiveCandidateId(null)
      return true
    }
    if (activeOreBodyId || stage === 'methods') {
      setActiveOreBodyId(null)
      setActiveCandidateId(null)
      setStage('occurrence')
      return true
    }
    const previous = previousProjectStage(stage)
    if (!previous) return false
    return selectStage(previous)
  }, [activeCandidateId, activeOreBodyId, selectStage, stage])

  const completeStage = useCallback(() => {
    if (activeOreBodyId) {
      const body = project?.oreBodies.find((item) => item.id === activeOreBodyId)
      if (!body || !isOreBodyComplete(body)) return false
      setActiveOreBodyId(null)
      setActiveCandidateId(null)
      setStage('occurrence')
      return true
    }
    if (stage === 'occurrence') {
      if (!isStageComplete('methods', project)) return false
      return selectStage('capacity')
    }
    if (!isStageComplete(stage, project)) return false
    const next = nextProjectStage(stage)
    if (!next) return false
    return selectStage(next)
  }, [activeOreBodyId, project, selectStage, stage])

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects: store.projects,
      project,
      stage,
      activeOreBodyId,
      activeCandidateId,
      setProject,
      createProject,
      importProjects,
      selectProject,
      enterProject,
      updateProject,
      deleteProject,
      selectStage,
      selectOreBody,
      openCandidate,
      closeCalculation,
      goPreviousStage,
      completeStage,
    }),
    [
      store.projects,
      project,
      stage,
      activeOreBodyId,
      activeCandidateId,
      setProject,
      createProject,
      importProjects,
      selectProject,
      enterProject,
      updateProject,
      deleteProject,
      selectStage,
      selectOreBody,
      openCandidate,
      closeCalculation,
      goPreviousStage,
      completeStage,
    ],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProject() {
  const value = useContext(ProjectContext)
  if (!value) throw new Error('useProject must be used within ProjectProvider')
  return value
}
