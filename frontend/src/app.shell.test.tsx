import { fireEvent, render, screen, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('mining application shell', () => {
  it('renders mining branding and project-pipeline navigation', () => {
    render(<App />)

    expect(screen.getByText('CINF采矿工程计算软件')).toBeInTheDocument()
    expect(screen.getByText('采矿工程计算')).toBeInTheDocument()
    for (const label of ['项目概况', '基础参数', '产状分布', '采矿方法', '生产能力', '矿山设备', '矿井通风', '充填系统']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
      expect(label).toHaveLength(4)
    }
    expect(screen.queryByText('地质资源')).not.toBeInTheDocument()
    expect(screen.queryByText('采切计算')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新建项目' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^新建$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '项目概况' })).toBeInTheDocument()
    expect(screen.getByText(/矿山工程计算项目档案/)).toBeInTheDocument()
    expect(screen.getByText(/登记并维护本机保存的矿山工程项目/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导入项目' })).toBeInTheDocument()
    expect(screen.getByTestId('project-case-import')).toHaveTextContent('+ 导入项目')
    expect(screen.queryByRole('button', { name: /^导出项目$/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('project-case-dropzone')).toHaveTextContent('将案例文件拖入此处即可导入')
    expect(screen.getByTestId('project-list-create')).toHaveTextContent('新建项目')
    expect(screen.getByTestId('project-list-panel')).toContainElement(screen.getByLabelText('搜索项目名称'))
    expect(screen.getByTestId('project-list-panel')).not.toContainElement(screen.getByRole('button', { name: '新建项目' }))
    expect(screen.getByTestId('project-list')).toHaveClass('text-base')
    expect(screen.getByTestId('project-list-pagination')).toHaveTextContent('共 0 条')
    expect(screen.getByTestId('project-list-pagination')).toHaveTextContent('第 1 / 1 页')
    expect(screen.getByRole('columnheader', { name: '保存时间' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '上次打开' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '编号' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '状态' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '打开' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '已打开' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '项目资料' })).not.toBeInTheDocument()
    expect(screen.getByTestId('stage-parameters')).toBeDisabled()
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled()
    expect(screen.queryByTestId('stage-header-back')).not.toBeInTheDocument()
  })

  it('enters base parameters when clicking a project name', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    fireEvent.change(screen.getByLabelText('项目名称 1'), { target: { value: '甲矿' } })
    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    fireEvent.change(screen.getByLabelText('项目名称 1'), { target: { value: '乙矿' } })
    fireEvent.blur(screen.getByDisplayValue('乙矿'))
    expect(screen.getByTestId('sidebar-project-name')).toHaveTextContent('乙矿')

    fireEvent.click(screen.getByRole('button', { name: '进入项目 甲矿' }))
    expect(screen.getByTestId('base-parameters-page')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-project-name')).toHaveTextContent('甲矿')
  })

  it('manages multiple projects and advances with next', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    fireEvent.change(screen.getByLabelText('项目名称 1'), { target: { value: '甲矿' } })
    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    fireEvent.change(screen.getByLabelText('项目名称 1'), { target: { value: '乙矿' } })
    fireEvent.blur(screen.getByDisplayValue('乙矿'))
    expect(screen.getByRole('button', { name: '进入项目 甲矿' })).toHaveClass('underline')
    expect(screen.getByRole('button', { name: '进入项目 乙矿' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '编辑项目 乙矿' })).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-project-name')).toHaveTextContent('乙矿')
    expect(screen.getByTestId('project-list-pagination')).toHaveTextContent('共 2 条')

    fireEvent.change(screen.getByLabelText('搜索项目名称'), { target: { value: '甲' } })
    expect(screen.getByRole('button', { name: '进入项目 甲矿' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '进入项目 乙矿' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('搜索项目名称'), { target: { value: '' } })

    fireEvent.click(screen.getByRole('row', { name: /甲矿/ }))
    expect(screen.getByTestId('sidebar-project-name')).toHaveTextContent('甲矿')
    expect(screen.getByTestId('project-overview-page')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '打开' })).not.toBeInTheDocument()
    expect(screen.getAllByText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '删除项目 乙矿' }))
    expect(screen.getByRole('dialog', { name: '删除项目' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getByRole('button', { name: '进入项目 乙矿' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '删除项目 乙矿' }))
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.queryByRole('button', { name: '进入项目 乙矿' })).not.toBeInTheDocument()

    const enterName = screen.getByRole('button', { name: '进入项目 甲矿' })
    fireEvent.click(enterName)
    expect(screen.queryByTestId('project-overview-page')).not.toBeInTheDocument()
    expect(screen.getByTestId('base-parameters-page')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('矿体密度'), { target: { value: '2.7' } })
    fireEvent.change(screen.getByLabelText('围岩密度'), { target: { value: '2.6' } })
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByTestId('occurrence-page')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '矿体产状' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加矿体' })).toHaveTextContent('+ 添加矿体')
    expect(screen.queryByRole('button', { name: '下一步' })).not.toBeInTheDocument()
    expect(screen.getByTestId('stage-nav')).toHaveTextContent('请为每个矿体点击「进入方法」，并在采矿方法中选定一个采用方法')
    fireEvent.click(screen.getByTestId('stage-header-back'))
    expect(screen.getByTestId('base-parameters-page')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByTestId('occurrence-page')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '上一步' }))
    expect(screen.getByTestId('base-parameters-page')).toBeInTheDocument()
  })

  it('unlocks later stages after overview, densities, occurrence, and adopting a method', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    fireEvent.change(screen.getByLabelText('项目名称 1'), { target: { value: '东区试验矿' } })
    fireEvent.blur(screen.getByDisplayValue('东区试验矿'))
    expect(screen.getByRole('button', { name: '进入项目 东区试验矿' })).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-project-name')).toHaveTextContent('东区试验矿')
    expect(screen.getByTestId('stage-parameters')).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '进入项目 东区试验矿' }))

    fireEvent.change(screen.getByLabelText('矿体密度'), { target: { value: '2.7' } })
    fireEvent.change(screen.getByLabelText('围岩密度'), { target: { value: '2.6' } })
    expect(screen.getByTestId('stage-occurrence')).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))

    fireEvent.click(screen.getByRole('button', { name: '添加矿体' }))
    fireEvent.change(screen.getByLabelText('倾角 1'), { target: { value: '35' } })
    fireEvent.change(screen.getByLabelText('厚度 1'), { target: { value: '3' } })
    expect(screen.getByTestId('stage-methods')).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '进入方法 矿体1' }))
    expect(screen.getByTestId('cut-and-fill-guide-page')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '采矿方法' })).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('stage-header-back'))
    expect(screen.getByTestId('occurrence-page')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '进入方法 矿体1' }))
    fireEvent.click(screen.getByRole('button', { name: '新建方法' }))
    fireEvent.change(screen.getByLabelText('采矿方法'), { target: { value: '上向进路充填法' } })
    fireEvent.click(screen.getByRole('button', { name: '打开方法 上向进路充填法' }))
    expect(screen.getByTestId('cut-and-fill-workspace')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '上向进路充填法' })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('method-page-back'))
    fireEvent.click(screen.getByRole('radio', { name: '采用 上向进路充填法' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByTestId('occurrence-page')).toBeInTheDocument()
    expect(screen.getByText('上向进路充填法')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByTestId('stage-placeholder-capacity')).toBeInTheDocument()
    expect(screen.getByTestId('stage-capacity')).toBeEnabled()
  })

  it('shows a top-right saved toast when pressing Ctrl+S', () => {
    render(<App />)

    expect(screen.queryByTestId('save-toast')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    const toast = screen.getByTestId('save-toast')
    expect(toast).toHaveTextContent('已保存')
    expect(toast).toHaveAttribute('role', 'status')
    expect(toast.className).toMatch(/\bfixed\b/)
    expect(toast.className).toMatch(/\bright-/)
  })

  it('reopens saved method calculation inputs after Ctrl+S and remounting the app', () => {
    const first = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    fireEvent.change(screen.getByLabelText('项目名称 1'), { target: { value: '东区试验矿' } })
    fireEvent.blur(screen.getByDisplayValue('东区试验矿'))
    fireEvent.click(screen.getByRole('button', { name: '进入项目 东区试验矿' }))
    fireEvent.change(screen.getByLabelText('矿体密度'), { target: { value: '2.7' } })
    fireEvent.change(screen.getByLabelText('围岩密度'), { target: { value: '2.6' } })
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: '添加矿体' }))
    fireEvent.change(screen.getByLabelText('倾角 1'), { target: { value: '35' } })
    fireEvent.change(screen.getByLabelText('厚度 1'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: '进入方法 矿体1' }))
    fireEvent.click(screen.getByRole('button', { name: '新建方法' }))
    fireEvent.change(screen.getByLabelText('采矿方法'), { target: { value: '上向进路充填法' } })
    fireEvent.click(screen.getByRole('button', { name: '打开方法 上向进路充填法' }))
    fireEvent.change(screen.getByLabelText('矿块长'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('矿块宽'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('矿块高'), { target: { value: '8' } })
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    expect(screen.getByTestId('save-toast')).toHaveTextContent('已保存')

    first.unmount()
    render(<App />)

    expect(screen.getByTestId('project-overview-page')).toBeInTheDocument()
    expect(screen.queryByTestId('cut-and-fill-workspace')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '进入项目 东区试验矿' }))
    fireEvent.click(screen.getByTestId('stage-methods'))
    fireEvent.click(screen.getByRole('button', { name: '打开方法 上向进路充填法' }))
    expect(screen.getByLabelText('矿块长')).toHaveValue('20')
    expect(screen.getByLabelText('矿块宽')).toHaveValue('10')
    expect(screen.getByLabelText('矿块高')).toHaveValue('8')
  })

  it('opens on the project homepage after remount instead of restoring the last working page', () => {
    const first = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    fireEvent.change(screen.getByLabelText('项目名称 1'), { target: { value: '东区试验矿' } })
    fireEvent.blur(screen.getByDisplayValue('东区试验矿'))
    fireEvent.click(screen.getByRole('button', { name: '进入项目 东区试验矿' }))
    fireEvent.change(screen.getByLabelText('矿体密度'), { target: { value: '2.7' } })
    fireEvent.change(screen.getByLabelText('围岩密度'), { target: { value: '2.6' } })
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByTestId('occurrence-page')).toBeInTheDocument()

    first.unmount()
    render(<App />)

    expect(screen.getByTestId('project-overview-page')).toBeInTheDocument()
    expect(screen.queryByTestId('occurrence-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('base-parameters-page')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '进入项目 东区试验矿' })).toBeInTheDocument()
  })

  it('returns to a refreshed project homepage when the window is restored from cache', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    fireEvent.change(screen.getByLabelText('项目名称 1'), { target: { value: '东区试验矿' } })
    fireEvent.blur(screen.getByDisplayValue('东区试验矿'))
    fireEvent.click(screen.getByRole('button', { name: '进入项目 东区试验矿' }))
    expect(screen.getByTestId('base-parameters-page')).toBeInTheDocument()

    const event = new Event('pageshow')
    Object.defineProperty(event, 'persisted', { value: true })
    fireEvent(window, event)

    expect(screen.getByTestId('project-overview-page')).toBeInTheDocument()
    expect(screen.queryByTestId('base-parameters-page')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '进入项目 东区试验矿' })).toBeInTheDocument()
  })

  it('returns to the first-open homepage when the running app is opened again', () => {
    const listeners: Array<() => void> = []
    window.electronAPI = {
      onResetHome: (callback) => {
        listeners.push(callback)
        return () => undefined
      },
    }

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    fireEvent.change(screen.getByLabelText('项目名称 1'), { target: { value: '东区试验矿' } })
    fireEvent.blur(screen.getByDisplayValue('东区试验矿'))
    fireEvent.click(screen.getByRole('button', { name: '进入项目 东区试验矿' }))
    expect(screen.getByTestId('base-parameters-page')).toBeInTheDocument()

    act(() => {
      listeners.forEach((callback) => callback())
    })

    expect(screen.getByTestId('project-overview-page')).toBeInTheDocument()
    expect(screen.queryByTestId('base-parameters-page')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '进入项目 东区试验矿' })).toBeInTheDocument()
  })

  it('restores the assistant dock after closing it and switching pages', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: '智能助手' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭智能助手' }))
    expect(screen.queryByRole('button', { name: '智能助手' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '设置' }))

    expect(screen.getByRole('button', { name: '智能助手' })).toBeInTheDocument()
  })
})
