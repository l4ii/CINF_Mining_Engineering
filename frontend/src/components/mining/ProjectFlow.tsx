import { useEffect } from 'react'
import { isStageUnlocked, PROJECT_STAGES, type ProjectStageId } from '../../mining/project'
import { useProject } from '../../context/ProjectContext'
import BaseParametersPage from './BaseParametersPage'
import CutAndFillGuidePage from './CutAndFillGuidePage'
import OccurrencePage from './OccurrencePage'
import ProjectOverviewPage from './ProjectOverviewPage'
import StagePlaceholderPage from './StagePlaceholderPage'

export default function ProjectFlow({
  darkMode = false,
  language = 'zh',
}: {
  darkMode?: boolean
  language?: 'zh' | 'en'
}) {
  const { project, stage, selectStage } = useProject()

  useEffect(() => {
    if (isStageUnlocked(stage, project)) return
    const fallback = [...PROJECT_STAGES].reverse().find((id) => isStageUnlocked(id, project)) ?? 'overview'
    selectStage(fallback)
  }, [project, stage, selectStage])

  if (stage === 'overview') {
    return <ProjectOverviewPage darkMode={darkMode} language={language} />
  }
  if (stage === 'parameters') {
    return <BaseParametersPage darkMode={darkMode} language={language} />
  }
  if (stage === 'occurrence') {
    return <OccurrencePage darkMode={darkMode} language={language} />
  }
  if (stage === 'methods') {
    return <CutAndFillGuidePage darkMode={darkMode} language={language} />
  }

  const placeholderStage: ProjectStageId = stage
  return <StagePlaceholderPage stage={placeholderStage} darkMode={darkMode} language={language} />
}
