import type { ReactNode } from 'react'
import BackIconButton from '../BackIconButton'
import {
  isMethodsComplete,
  isOreBodyComplete,
  isStageComplete,
  nextProjectStage,
  previousProjectStage,
} from '../../mining/project'
import { useProject } from '../../context/ProjectContext'

export function StageBreadcrumb({
  darkMode,
  crumb,
}: {
  darkMode: boolean
  crumb: string
}) {
  const { stage, activeOreBodyId, activeCandidateId, goPreviousStage } = useProject()
  const canGoBack =
    Boolean(previousProjectStage(stage)) || Boolean(activeOreBodyId) || Boolean(activeCandidateId)

  return (
    <div className={`relative mb-2 flex items-center gap-2 text-base ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
      {canGoBack ? (
        <BackIconButton
          label="返回上一步"
          darkMode={darkMode}
          onClick={() => goPreviousStage()}
          testId="stage-header-back"
          className={`absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 ${
            darkMode ? '!text-blue-300 hover:!bg-blue-950/40' : '!text-blue-700 hover:!bg-blue-50'
          }`}
        />
      ) : null}
      <span>采矿工程计算</span>
      <span aria-hidden>/</span>
      <span>{crumb}</span>
    </div>
  )
}

export function StagePageShell({
  darkMode,
  crumb,
  title,
  description,
  children,
  testId,
}: {
  darkMode: boolean
  crumb: string
  title: string
  description: string
  children: ReactNode
  testId?: string
}) {
  const muted = darkMode ? 'text-gray-400' : 'text-gray-600'
  return (
    <main
      className={`min-h-0 flex-1 overflow-y-auto ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}
      data-testid={testId}
    >
      <div className="flex min-h-full w-full max-w-[1880px] flex-col gap-4 px-4 py-5 text-left lg:px-8 lg:py-6">
        <header className={`w-full border-b pb-5 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <StageBreadcrumb darkMode={darkMode} crumb={crumb} />
          <p className={`mb-1 text-base font-medium uppercase tracking-[0.12em] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            CINF采矿工程计算软件
          </p>
          <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">{title}</h1>
          <p className={`mt-3 text-base leading-7 ${muted}`}>{description}</p>
        </header>
        {children}
      </div>
    </main>
  )
}

export function stageSurface(darkMode: boolean): string {
  return darkMode
    ? 'border-gray-700 bg-gray-800 text-gray-100'
    : 'border-gray-200 bg-white text-gray-900'
}

export function stageInputSurface(darkMode: boolean): string {
  return darkMode
    ? 'border-gray-600 bg-gray-900 text-gray-100 placeholder:text-gray-500'
    : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400'
}

export function StageNav({
  darkMode,
  completeHint,
  showComplete = true,
}: {
  darkMode: boolean
  completeHint?: string
  showComplete?: boolean
}) {
  const { project, stage, activeOreBodyId, goPreviousStage, completeStage } = useProject()
  const previous = activeOreBodyId ? 'methods' : previousProjectStage(stage)
  const next = activeOreBodyId ? null : nextProjectStage(stage)
  const body = project?.oreBodies.find((item) => item.id === activeOreBodyId) ?? null
  const canComplete = activeOreBodyId
    ? Boolean(body && isOreBodyComplete(body))
    : stage === 'occurrence'
      ? isMethodsComplete(project) && Boolean(next)
      : isStageComplete(stage, project) && Boolean(next)
  const showPrevious = Boolean(previous) || Boolean(activeOreBodyId)
  const hasNextTarget = Boolean(next || activeOreBodyId)
  const showNextButton = showComplete && hasNextTarget && (stage !== 'occurrence' || canComplete)
  const showHint = Boolean(completeHint) && !canComplete && showComplete && hasNextTarget

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t pt-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
      data-testid="stage-nav"
    >
      <div>
        {showPrevious ? (
          <button
            type="button"
            onClick={() => goPreviousStage()}
            className={`inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium ${darkMode ? 'border-gray-600 hover:bg-gray-800' : 'border-gray-300 bg-white hover:bg-slate-50'}`}
          >
            上一步
          </button>
        ) : (
          <span />
        )}
      </div>
      <div className="flex items-center gap-3">
        {showHint ? (
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{completeHint}</span>
        ) : null}
        {showNextButton ? (
          <button
            type="button"
            onClick={() => completeStage()}
            disabled={!canComplete}
            className="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一步
          </button>
        ) : null}
      </div>
    </div>
  )
}
