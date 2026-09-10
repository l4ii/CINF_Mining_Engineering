import { Check, Lock, Settings2 } from 'lucide-react'
import { ABOUT_NAV, sidebarSubtitleForLang, sidebarTitleForLang } from '../constants/appCopy'
import {
  PROJECT_STAGE_LABELS,
  PROJECT_STAGES,
  isStageComplete,
  isStageUnlocked,
  type MiningProject,
  type ProjectStageId,
} from '../mining/project'

interface SidebarProps {
  darkMode: boolean
  language: 'zh' | 'en'
  onShowAbout: (department: string) => void
  onShowSettings: () => void
  currentView: 'module' | 'about' | 'settings'
  aboutDepartment?: string | null
  project: MiningProject | null
  stage: ProjectStageId
  onSelectStage: (stage: ProjectStageId) => void
}

export default function Sidebar({
  darkMode,
  language,
  onShowAbout,
  onShowSettings,
  currentView,
  aboutDepartment,
  project,
  stage,
  onSelectStage,
}: SidebarProps) {
  const t = ABOUT_NAV[language]
  const surface = darkMode ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-900'
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500'
  const projectName = project?.name.trim() || (language === 'en' ? 'No project' : '未建立项目')

  return (
    <aside data-testid="sidebar" className={`flex h-full min-h-0 w-[270px] shrink-0 flex-col border-r ${surface}`}>
      <div className="border-b border-inherit p-4">
        <div className="flex items-center gap-3">
          <div className={`grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border p-1 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-slate-50'}`}>
            <img
              src={darkMode ? './icon.png' : './icon-white.png'}
              alt="CINF"
              className="h-full w-full object-contain"
            />
          </div>
          <div data-testid="sidebar-brand-copy" className="min-w-0 flex-1 text-right">
            <div className="truncate text-lg font-semibold">{sidebarTitleForLang(language)}</div>
            <div className={`mt-0.5 whitespace-pre-line text-xs leading-4 ${muted}`}>{sidebarSubtitleForLang(language)}</div>
          </div>
        </div>
      </div>

      <div data-testid="sidebar-current-project" className="border-b border-inherit px-4 py-3">
        <div className={`text-sm ${muted}`}>{language === 'en' ? 'Current project' : '当前项目'}</div>
        <button
          type="button"
          data-testid="sidebar-project-name"
          title={language === 'en' ? `${projectName} — open overview` : `${projectName}（进入项目概况）`}
          onClick={() => onSelectStage('overview')}
          className={`mt-0.5 block w-full cursor-pointer truncate text-right text-sm font-medium transition-colors hover:underline ${
            currentView === 'module' && stage === 'overview'
              ? darkMode
                ? 'text-blue-200 hover:text-blue-100'
                : 'text-blue-800 hover:text-blue-900'
              : darkMode
                ? 'text-gray-100 hover:text-blue-200'
                : 'text-gray-900 hover:text-blue-700'
          }`}
        >
          {projectName}
        </button>
      </div>

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <nav aria-label="项目流程" className="space-y-1">
          {PROJECT_STAGES.filter((id) => id !== 'methods').map((id) => {
            const label = PROJECT_STAGE_LABELS[id][language]
            const unlocked = isStageUnlocked(id, project)
            const complete = isStageComplete(id, project)
            const isCurrent = currentView === 'module' && stage === id
            const methodsUnlocked = isStageUnlocked('methods', project)
            const methodsComplete = isStageComplete('methods', project)
            const methodsCurrent = currentView === 'module' && stage === 'methods'
            return (
              <div key={id}>
                <button
                  type="button"
                  data-testid={`stage-${id}`}
                  disabled={!unlocked}
                  onClick={() => onSelectStage(id)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-base font-semibold tracking-wide ${
                    !unlocked
                      ? darkMode
                        ? 'cursor-not-allowed text-gray-600'
                        : 'cursor-not-allowed text-gray-400'
                      : isCurrent
                        ? darkMode
                          ? 'bg-gray-700 text-blue-200'
                          : 'bg-blue-50 text-blue-800'
                        : darkMode
                          ? 'text-gray-200 hover:bg-gray-800'
                          : 'text-gray-800 hover:bg-slate-50'
                  }`}
                >
                  {complete ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  ) : unlocked ? (
                    <span className={`h-3.5 w-3.5 rounded-full border ${isCurrent ? 'border-blue-500 bg-blue-500' : 'border-current'}`} aria-hidden />
                  ) : (
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <span>{label}</span>
                </button>
                {id === 'occurrence' ? (
                  <div
                    data-testid="stage-methods-branch"
                    className={`ml-5 mt-1 border-l pl-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
                  >
                    <button
                      type="button"
                      data-testid="stage-methods"
                      disabled={!methodsUnlocked}
                      onClick={() => onSelectStage('methods')}
                      aria-current={methodsCurrent ? 'page' : undefined}
                      className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-base font-medium tracking-wide ${
                        !methodsUnlocked
                          ? darkMode
                            ? 'cursor-not-allowed text-gray-600'
                            : 'cursor-not-allowed text-gray-400'
                          : methodsCurrent
                            ? darkMode
                              ? 'bg-gray-700 text-blue-200'
                              : 'bg-blue-50 text-blue-800'
                            : darkMode
                              ? 'text-gray-200 hover:bg-gray-800'
                              : 'text-gray-800 hover:bg-slate-50'
                      }`}
                    >
                      {methodsComplete ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                      ) : methodsUnlocked ? (
                        <span className={`h-3.5 w-3.5 rounded-full border ${methodsCurrent ? 'border-blue-500 bg-blue-500' : 'border-current'}`} aria-hidden />
                      ) : (
                        <Lock className="h-3.5 w-3.5" aria-hidden />
                      )}
                      <span>{PROJECT_STAGE_LABELS.methods[language]}</span>
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>
      </div>

      <div className={`flex-shrink-0 border-t p-3 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <h2 className={`mb-2 text-base font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          {t.aboutUs}
        </h2>
        <div className="mb-3 space-y-1 pl-2">
          {([
            ['cinf', t.cinf],
            ['research', t.research],
            ['mining', t.mining],
          ] as const).map(([department, label]) => (
            <button
              key={department}
              type="button"
              onClick={() => onShowAbout(department)}
              title={label}
              className={`h-8 w-full overflow-hidden rounded px-2 py-1.5 text-left text-sm text-ellipsis whitespace-nowrap transition-colors ${
                currentView === 'about' && aboutDepartment === department
                  ? 'bg-blue-600 text-white'
                  : darkMode
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onShowSettings}
          className={`inline-flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-base font-semibold uppercase tracking-wide transition-colors ${
            currentView === 'settings'
              ? 'bg-blue-600 text-white'
              : darkMode
                ? 'text-gray-300 hover:bg-gray-800'
                : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
          {t.settings}
        </button>
      </div>

      <div className={`flex-shrink-0 border-t p-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
        <div className={`text-sm leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <div className="mb-1">{t.footerBy}</div>
          <a
            href="http://www.cinf.com.cn/"
            target="_blank"
            rel="noopener noreferrer"
            title={t.cinf}
            className={`block overflow-hidden text-center font-medium text-ellipsis whitespace-nowrap hover:underline ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
          >
            {t.cinf}
          </a>
          <div className="mt-1 whitespace-nowrap text-right">{t.footerDev}</div>
        </div>
      </div>
    </aside>
  )
}
