import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppDialog, ConfirmDialog, NoticeBanner } from './AppDialog'

describe('app dialog palette', () => {
  it('uses the software overlay, blue accent and primary action colors', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        title="删除项目"
        message="确定删除「乙矿」？删除后不可恢复。"
        confirmLabel="删除"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: '删除项目' })
    expect(dialog).toHaveClass('rounded-tl-2xl', 'border-gray-200', 'bg-white')
    expect(dialog.parentElement).toHaveClass('bg-slate-950/45')
    expect(dialog.querySelector('.bg-blue-600')).toBeTruthy()
    expect(screen.getByRole('button', { name: '删除' })).toHaveClass('bg-blue-600')

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('keeps wide dialogs on the same chrome', () => {
    render(
      <AppDialog title="按矿体产状推荐采矿方法" darkMode={false} onClose={() => undefined} size="wide" testId="method-assist-dialog">
        <p>内容</p>
      </AppDialog>,
    )

    const dialog = screen.getByTestId('method-assist-dialog')
    expect(dialog).toHaveClass('rounded-tl-2xl', 'border-gray-200', 'bg-white')
    expect(dialog.parentElement).toHaveClass('bg-slate-950/45')
  })

  it('renders status notices in the blue information palette', () => {
    render(
      <NoticeBanner tone="info">已加入本矿体方法</NoticeBanner>,
    )

    expect(screen.getByRole('status')).toHaveClass('border-blue-200', 'bg-blue-50', 'text-blue-800')
  })
})
