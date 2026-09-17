import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useProject } from '../../context/ProjectContext'

export const SAVE_TOAST_DURATION_MS = 1800

export function isProjectSaveShortcut(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false
  return event.key.toLowerCase() === 's'
}

export default function SaveFeedback({
  darkMode,
  language,
}: {
  darkMode: boolean
  language: 'zh' | 'en'
}) {
  const { saveNow } = useProject()
  const [visible, setVisible] = useState(false)
  const [tick, setTick] = useState(0)
  const label = language === 'en' ? 'Saved' : '已保存'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isProjectSaveShortcut(event)) return
      event.preventDefault()
      saveNow()
      setVisible(true)
      setTick((value) => value + 1)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [saveNow])

  useEffect(() => {
    if (!visible) return
    const timer = window.setTimeout(() => setVisible(false), SAVE_TOAST_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [visible, tick])

  if (!visible) return null

  return (
    <div
      data-testid="save-toast"
      role="status"
      className={`pointer-events-none fixed right-4 z-[70] flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg ${
        darkMode
          ? 'border-emerald-900/60 bg-gray-800 text-emerald-200'
          : 'border-emerald-200 bg-white text-emerald-800'
      }`}
      style={{ top: 'calc(var(--app-titlebar-height, 0px) + 12px)' }}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </div>
  )
}
