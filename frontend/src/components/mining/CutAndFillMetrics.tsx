import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { CutAndFillResult } from '../../mining/types'

const ENGINEERING = [
  { label: '采准比', length: 'preparationRatio', volume: 'preparationVolumeRatio' },
  { label: '切割比', length: 'cuttingRatio', volume: 'cuttingVolumeRatio' },
  { label: '采切比', length: 'cutAndFillRatio', volume: 'cutAndFillVolumeRatio' },
]

const RATES = [
  { key: 'wasteRate', label: '废石率', description: '采出废石 ÷ 采出矿量' },
  { key: 'byProductOreProportion', label: '副产矿石比例', description: '采切采出矿量 ÷ 盘区采出矿量' },
  { key: 'recoveryRate', label: '回采率', description: '采出地质储量 ÷ 地质储量' },
  { key: 'lossRate', label: '损失率', description: '100% − 回采率' },
  { key: 'dilutionRate', label: '贫化率', description: '（采出矿量 − 采出地质储量）÷ 采出矿量' },
]

function format(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits })
}

export default function CutAndFillMetrics({ result, darkMode }: { result: CutAndFillResult; darkMode: boolean }) {
  const { metrics, issues, sections } = result
  const totals = sections.block.totals
  const surface = darkMode ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500'
  const inset = darkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-slate-50/70 border-slate-200'
  const missingMetrics = Object.values(metrics).filter((metric) => metric.value == null).length

  return (
    <section className={`rounded-lg border shadow-sm ${surface}`} data-testid="cut-and-fill-metrics">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-inherit px-4 py-3">
        <div>
          <h2 className="font-semibold">计算结果</h2>
          <p className={`mt-1 text-xs ${muted}`}>主要技术经济指标 · 随输入实时更新</p>
        </div>
        {issues.length > 0 ? (
          <span className={`inline-flex items-center gap-1 text-sm font-medium ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            暂算 · {issues.length} 项数据需检查
          </span>
        ) : missingMetrics > 0 ? (
          <span className={`text-sm ${muted}`}>{missingMetrics} 项待计算</span>
        ) : (
          <span className={`inline-flex items-center gap-1 text-sm font-medium ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            已计算
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
        {ENGINEERING.map((item) => <div key={item.label} className={`min-w-0 rounded-md border px-4 py-3 ${inset}`}>
          <h3 className="text-sm font-semibold">{item.label}</h3>
          <div className="mt-2 flex flex-wrap items-baseline gap-1.5" title="工程总长 ÷ 盘区采出矿量 × 1000">
            <strong className={`text-2xl tabular-nums ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{format(metrics[item.length]?.value)}</strong><span className={`text-xs ${muted}`}>m/kt</span>
          </div>
          <div className={`mt-1 text-sm tabular-nums ${muted}`} title="工程总体积 ÷ 盘区采出矿量 × 1000">{format(metrics[item.volume]?.value)} <span className="text-xs">m³/kt</span></div>
        </div>)}
        {RATES.map((field) => <div key={field.key} className={`min-w-0 rounded-md border px-4 py-3 ${inset}`}>
          <h3 className="text-sm font-semibold">{field.label}</h3>
          <div className="mt-2 flex items-baseline gap-1.5"><strong className={`text-2xl tabular-nums ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{format(metrics[field.key]?.value, 2)}</strong><span className={`text-xs ${muted}`}>%</span></div>
          <p className={`mt-1 text-xs leading-5 ${muted}`}>{field.description}</p>
        </div>)}
      </div>
      <p className={`px-4 pb-3 text-xs ${muted}`}>采准比、切割比、采切比按每千吨采出矿量计；统一分母为盘区采出矿量 {format(totals.producedOre)} t。</p>
      {issues.length > 0 ? <p className={`border-t border-inherit px-4 py-2 text-xs ${muted}`}>当前结果可能尚未计入未填全的部位或工程。请检查输入区提示，补齐数据后再核定指标。</p> : null}
    </section>
  )
}
