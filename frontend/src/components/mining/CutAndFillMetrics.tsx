import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { CutAndFillResult } from '../../mining/types'

interface CutAndFillMetricsProps {
  metrics: CutAndFillResult['metrics']
  issues?: CutAndFillResult['issues']
  darkMode: boolean
}

const METRIC_FIELDS: Array<{ key: string; label: string; unit: string }> = [
  { key: 'preparationRatio', label: '采准比', unit: 'm/kt' },
  { key: 'preparationVolumeRatio', label: '采准体积比', unit: 'm³/kt' },
  { key: 'cuttingRatio', label: '切割比', unit: 'm/kt' },
  { key: 'cuttingVolumeRatio', label: '切割体积比', unit: 'm³/kt' },
  { key: 'cutAndFillRatio', label: '采切比', unit: 'm/kt' },
  { key: 'cutAndFillVolumeRatio', label: '采切体积比', unit: 'm³/kt' },
  { key: 'wasteRate', label: '废石率', unit: '%' },
  { key: 'byProductOreProportion', label: '副产矿石比例', unit: '%' },
  { key: 'recoveryRate', label: '回采率', unit: '%' },
  { key: 'lossRate', label: '损失率', unit: '%' },
  { key: 'dilutionRate', label: '贫化率', unit: '%' },
]

function formatMetric(value: number | null | undefined, unit: string): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (unit === '%') return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}%`
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 3, minimumFractionDigits: 0 })
}

export default function CutAndFillMetrics({ metrics, issues = [], darkMode }: CutAndFillMetricsProps) {
  const surface = darkMode ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500'
  const missingMetrics = METRIC_FIELDS.filter((field) => metrics[field.key]?.value == null).length

  return (
    <section className={`rounded-lg border shadow-sm ${surface}`} data-testid="cut-and-fill-metrics">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-inherit px-4 py-3">
        <div>
          <h2 className="font-semibold">指标摘要</h2>
          <p className={`mt-0.5 text-sm ${muted}`}>按当前方法的工程输入实时汇总</p>
        </div>
        {issues.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            {issues.length} 项数据提示
          </span>
        ) : missingMetrics > 0 ? (
          <span className={`text-sm ${muted}`}>{missingMetrics} 项待计算</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            已计算
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-700 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {METRIC_FIELDS.map((field) => {
          const metric = metrics[field.key]
          const value = metric?.value
          return (
            <div key={field.key} className={`${darkMode ? 'bg-gray-800' : 'bg-white'} px-3 py-3`}>
              <div className={`truncate text-sm ${muted}`}>{field.label}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`font-mono text-base font-semibold tabular-nums ${value == null ? muted : ''}`}>{formatMetric(value, field.unit)}</span>
                <span className={`text-sm ${muted}`}>{metric?.unit ?? field.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
      {issues.length > 0 ? <p className={`border-t border-inherit px-4 py-2 text-sm ${muted}`}>请检查输入区中的红色提示；缺失或非法数据的派生值会显示为“—”。</p> : null}
    </section>
  )
}

