import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export const APP_DIALOG_SHAPE = 'rounded-tl-2xl rounded-tr-md rounded-br-2xl rounded-bl-md'
export const APP_DIALOG_OVERLAY = 'fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45'
export const APP_PRIMARY_BUTTON_CLASS =
  'h-9 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700'

export function appDialogPanelClass(darkMode: boolean) {
  return darkMode ? 'border-gray-600 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
}

export function appOutlineButtonClass(darkMode: boolean) {
  return `h-9 rounded-md border px-3 text-sm font-medium ${
    darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-slate-50'
  }`
}

const NOTICE_TONES = {
  info: {
    light: 'border-blue-200 bg-blue-50 text-blue-800',
    dark: 'border-blue-900/70 bg-blue-950/40 text-blue-200',
  },
  success: {
    light: 'border-blue-200 bg-blue-50 text-blue-800',
    dark: 'border-blue-900/70 bg-blue-950/40 text-blue-200',
  },
  warning: {
    light: 'border-slate-200 bg-slate-50 text-slate-700',
    dark: 'border-gray-600 bg-gray-800/80 text-gray-200',
  },
  error: {
    light: 'border-red-200 bg-red-50/90 text-red-700',
    dark: 'border-red-900/60 bg-red-950/30 text-red-200',
  },
} as const

export type NoticeTone = keyof typeof NOTICE_TONES

export function AppDialog({
  title,
  kicker,
  darkMode,
  children,
  onClose,
  size = 'md',
  testId,
  closeOnOverlay = false,
}: {
  title: string
  kicker?: string
  darkMode: boolean
  children: ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'wide'
  testId?: string
  closeOnOverlay?: boolean
}) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const node = (
    <div
      className={`${APP_DIALOG_OVERLAY} ${size === 'wide' ? 'p-3' : 'px-4 py-6'}`}
      role="presentation"
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
        className={`w-full overflow-hidden border shadow-2xl ${APP_DIALOG_SHAPE} ${appDialogPanelClass(darkMode)} ${
          size === 'wide'
            ? 'flex h-[calc(100vh-1.5rem)] max-h-[calc(100vh-1.5rem)] max-w-[92rem] flex-col'
            : size === 'sm'
              ? 'max-w-md'
              : 'max-w-2xl'
        }`}
      >
        <div className="h-1 w-full bg-blue-600" aria-hidden />
        <div
          className={`flex shrink-0 items-start justify-between gap-3 border-b ${size === 'wide' ? 'px-3 pb-2 pt-2.5' : 'px-5 pb-3 pt-4'} ${
            darkMode ? 'border-gray-600' : 'border-gray-200'
          }`}
        >
          <div className="min-w-0">
            {kicker ? (
              <p className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                {kicker}
              </p>
            ) : null}
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="关闭"
            title="关闭"
            onClick={onClose}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-slate-100'}`}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {size === 'wide' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3">{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  )

  return createPortal(node, document.body)
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  darkMode = false,
  onConfirm,
  onCancel,
  testId = 'app-confirm-dialog',
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  darkMode?: boolean
  onConfirm: () => void
  onCancel: () => void
  testId?: string
}) {
  if (!open) return null

  return (
    <AppDialog title={title} darkMode={darkMode} onClose={onCancel} size="sm" testId={testId} closeOnOverlay>
      <div className="px-5 pb-5 pt-4">
        <div className="flex gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
              darkMode ? 'bg-blue-950 text-blue-300' : 'bg-blue-50 text-blue-700'
            }`}
          >
            <AlertCircle className="h-5 w-5" aria-hidden />
          </span>
          <p className={`pt-1.5 text-sm leading-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{message}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={appOutlineButtonClass(darkMode)}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={APP_PRIMARY_BUTTON_CLASS}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </AppDialog>
  )
}

export function NoticeBanner({
  tone = 'info',
  darkMode = false,
  children,
  role = 'status',
  icon,
  className = '',
}: {
  tone?: NoticeTone
  darkMode?: boolean
  children: ReactNode
  role?: 'status' | 'alert'
  icon?: ReactNode
  className?: string
}) {
  const palette = NOTICE_TONES[tone]
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertCircle : Info
  return (
    <div
      role={role}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${darkMode ? palette.dark : palette.light} ${className}`}
    >
      {icon ?? <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="min-w-0">{children}</span>
    </div>
  )
}
