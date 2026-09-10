import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'
import { createCandidate, createEmptyProject, createOreBody } from '../mining/project'

const baseProps = {
  selectedMethod: null as never,
  darkMode: false,
  language: 'zh' as const,
  onShowAbout: vi.fn(),
  onShowSettings: vi.fn(),
  currentView: 'module' as const,
  project: null,
  stage: 'overview' as const,
  onSelectStage: vi.fn(),
}

describe('mining sidebar', () => {
  it('shows eight equal-width workflow stages and keeps the about footer', () => {
    render(<Sidebar {...baseProps} />)

    expect(screen.getByAltText('CINF')).toHaveAttribute('src', './icon-white.png')
    for (const label of ['项目概况', '基础参数', '产状分布', '采矿方法', '生产能力', '矿山设备', '矿井通风', '充填系统']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
      expect(label).toHaveLength(4)
    }
    expect(screen.queryByText('地质资源')).not.toBeInTheDocument()
    expect(screen.queryByText('采切计算')).not.toBeInTheDocument()
    expect(screen.getByTestId('sidebar-project-name')).toHaveTextContent('未建立项目')
    expect(screen.queryByRole('button', { name: /^新建$/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('stage-parameters')).toBeDisabled()
    expect(screen.getByTestId('stage-capacity')).toBeDisabled()

    expect(screen.getByTestId('stage-overview')).toHaveClass('text-base')
    expect(screen.getByTestId('stage-methods-branch')).toContainElement(screen.getByTestId('stage-methods'))
    expect(screen.getByTestId('stage-methods-branch')).toHaveClass('ml-5')
    expect(screen.getByText('了解我们')).toHaveClass('text-base')
    expect(screen.getByRole('button', { name: '长沙有色冶金设计研究院有限公司' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '长沙院科研创新中心' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '长沙院矿山事业部' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '设置' })).toHaveClass('text-base')
  })

  it('right-aligns brand copy, separates the current project, and opens overview from the name', () => {
    const onSelectStage = vi.fn()
    render(
      <Sidebar
        {...baseProps}
        project={createEmptyProject('东区试验矿')}
        stage="methods"
        onSelectStage={onSelectStage}
      />,
    )

    expect(screen.getByTestId('sidebar-brand-copy')).toHaveClass('text-right')
    expect(screen.getByTestId('sidebar-current-project')).not.toBe(screen.getByTestId('sidebar-brand-copy').parentElement)
    expect(screen.getByText('当前项目')).toHaveClass('text-sm')
    expect(screen.getByTestId('sidebar-project-name')).toHaveClass('text-sm')
    expect(screen.getByTestId('sidebar-project-name')).toHaveClass('text-right')
    expect(screen.getByRole('button', { name: '东区试验矿' })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('sidebar-project-name'))
    expect(onSelectStage).toHaveBeenCalledWith('overview')
  })

  it('does not expand ore bodies under mining methods', () => {
    const first = createCandidate({ methodName: '上向进路充填法', calculated: true })
    const project = {
      ...createEmptyProject('东区试验矿'),
      oreDensity: 2.7,
      wasteDensity: 2.6,
      oreBodies: [
        createOreBody({
          name: '1号矿体',
          dipAngle: 35,
          thickness: 3,
          candidates: [first, createCandidate({ methodName: '全面法' })],
        }),
      ],
    }
    render(
      <Sidebar
        {...baseProps}
        project={project}
        stage="methods"
      />,
    )

    expect(screen.getByTestId('sidebar-project-name')).toHaveTextContent('东区试验矿')
    expect(screen.getByTestId('stage-methods')).toBeInTheDocument()
    expect(screen.queryByText('1号矿体')).not.toBeInTheDocument()
    expect(screen.queryByText('1/2已算 · 待选定')).not.toBeInTheDocument()
    expect(screen.queryByTestId(`sidebar-orebody-${project.oreBodies[0].id}`)).not.toBeInTheDocument()
  })

  it('uses the transparent brand mark on the dark sidebar', () => {
    render(<Sidebar {...baseProps} darkMode />)
    expect(screen.getByAltText('CINF')).toHaveAttribute('src', './icon.png')
  })
})
