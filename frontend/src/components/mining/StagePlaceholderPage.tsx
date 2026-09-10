import { PROJECT_STAGE_LABELS, type ProjectStageId } from '../../mining/project'
import { StageNav, StagePageShell, stageSurface } from './StagePageShell'

export default function StagePlaceholderPage({
  stage,
  darkMode = false,
  language = 'zh',
}: {
  stage: ProjectStageId
  darkMode?: boolean
  language?: 'zh' | 'en'
}) {
  const label = PROJECT_STAGE_LABELS[stage][language]
  const surface = stageSurface(darkMode)
  const muted = darkMode ? 'text-gray-400' : 'text-gray-600'

  return (
    <StagePageShell
      darkMode={darkMode}
      crumb={label}
      title={label}
      description="本阶段界面已纳入项目流程，计算模块将在后续版本接入。"
      testId={`stage-placeholder-${stage}`}
    >
      <section className={`border border-dashed p-6 ${surface}`}>
        <p className={`text-base ${muted}`}>待后续模块接入。当前可根据已选定的各矿体采矿方法，继续组织生产能力、设备、通风和充填系统设计。</p>
      </section>
      <StageNav darkMode={darkMode} />
    </StagePageShell>
  )
}
