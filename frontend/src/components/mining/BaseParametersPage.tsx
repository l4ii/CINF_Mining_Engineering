import { parseProjectNumber } from '../../mining/project'
import { useProject } from '../../context/ProjectContext'
import { StageNav, StagePageShell, stageInputSurface, stageSurface } from './StagePageShell'

export default function BaseParametersPage({
  darkMode = false,
  language = 'zh',
}: {
  darkMode?: boolean
  language?: 'zh' | 'en'
}) {
  const { project, setProject } = useProject()
  const surface = stageSurface(darkMode)
  const inputSurface = stageInputSurface(darkMode)
  const muted = darkMode ? 'text-gray-400' : 'text-gray-600'
  const isEn = language === 'en'

  const patchDensity = (key: 'oreDensity' | 'wasteDensity', raw: string) => {
    setProject((current) => {
      if (!current) return current
      return { ...current, [key]: parseProjectNumber(raw) }
    })
  }

  return (
    <StagePageShell
      darkMode={darkMode}
      crumb="基础参数"
      title={isEn ? 'Shared parameters' : '基础参数'}
      description={
        isEn
          ? 'Ore and waste densities are shared by every ore body and mining method in this project.'
          : '矿体密度与围岩密度为全矿共用参数，后续各矿体的采矿方法计算将只读引用，不再分别填写。'
      }
      testId="base-parameters-page"
    >
      <section className={`border p-4 shadow-sm ${surface}`}>
        <h2 className="text-lg font-semibold">全矿共用密度</h2>
        <p className={`mt-1 text-base ${muted}`}>两项均填写后，可进入产状分布登记矿体。</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-sm font-medium">矿体密度</span>
            <span className="flex items-center">
              <input
                type="text"
                inputMode="decimal"
                aria-label="矿体密度"
                value={project?.oreDensity ?? ''}
                onChange={(event) => patchDensity('oreDensity', event.target.value)}
                className={`h-10 min-w-0 flex-1 appearance-none rounded-l-md border px-2.5 text-sm outline-none focus:border-blue-500 ${inputSurface}`}
              />
              <span className={`inline-flex h-10 items-center rounded-r-md border border-l-0 px-2 text-sm ${darkMode ? 'border-gray-600 bg-gray-700 text-gray-300' : 'border-gray-300 bg-gray-50 text-gray-500'}`}>
                t/m³
              </span>
            </span>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium">围岩密度</span>
            <span className="flex items-center">
              <input
                type="text"
                inputMode="decimal"
                aria-label="围岩密度"
                value={project?.wasteDensity ?? ''}
                onChange={(event) => patchDensity('wasteDensity', event.target.value)}
                className={`h-10 min-w-0 flex-1 appearance-none rounded-l-md border px-2.5 text-sm outline-none focus:border-blue-500 ${inputSurface}`}
              />
              <span className={`inline-flex h-10 items-center rounded-r-md border border-l-0 px-2 text-sm ${darkMode ? 'border-gray-600 bg-gray-700 text-gray-300' : 'border-gray-300 bg-gray-50 text-gray-500'}`}>
                t/m³
              </span>
            </span>
          </label>
        </div>
      </section>
      <StageNav darkMode={darkMode} completeHint="请填写矿体密度和围岩密度" />
    </StagePageShell>
  )
}
