import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OccurrencePage from './OccurrencePage'
import { ProjectProvider } from '../../context/ProjectContext'
import { createEmptyProject, createOreBody } from '../../mining/project'

function renderOccurrence(oreBodies = Array.from({ length: 11 }, (_, index) => createOreBody({ name: `矿体${index + 1}`, dipAngle: 35, thickness: 3 }))) {
  const project = {
    ...createEmptyProject('东区试验矿'),
    oreDensity: 2.7,
    wasteDensity: 2.6,
    oreBodies,
  }
  return render(
    <ProjectProvider persist={false} initialProject={project} initialStage="occurrence">
      <OccurrencePage />
    </ProjectProvider>,
  )
}

describe('ore-body occurrence list', () => {
  it('follows the project-overview table layout without import controls', () => {
    renderOccurrence()

    expect(screen.getByRole('heading', { name: '矿体产状' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '矿体列表' })).toBeInTheDocument()
    expect(screen.getByTestId('occurrence-list-create')).toHaveTextContent('+ 添加矿体')
    expect(screen.queryByRole('button', { name: '导入项目' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('project-case-dropzone')).not.toBeInTheDocument()
    expect(screen.getByTestId('occurrence-list-panel')).toContainElement(screen.getByLabelText('搜索矿体名称'))
    expect(screen.getByTestId('occurrence-table')).toHaveClass('text-base', 'table-fixed', 'text-center')
    expect(screen.getByLabelText('倾角 1')).toHaveClass('text-center', 'appearance-none')
    expect(screen.getByLabelText('厚度 1')).toHaveClass('text-center', 'appearance-none')
    expect(screen.getByLabelText('倾角 1')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('厚度 1')).toHaveAttribute('inputMode', 'decimal')
    expect(screen.getByRole('columnheader', { name: '倾角 (°)' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '真厚度 (m)' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '矿体类别' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '倾角分带' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '厚度分带' })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '采用方法' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '编号' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '进入方法 矿体1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '进入方法 矿体6' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '进入方法 矿体7' })).not.toBeInTheDocument()
    expect(screen.getByTestId('occurrence-list-pagination')).toHaveTextContent('共 11 条')
    expect(screen.getByTestId('occurrence-list-pagination')).toHaveTextContent('第 1 / 2 页')

    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.getByRole('button', { name: '进入方法 矿体11' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '进入方法 矿体1' })).not.toBeInTheDocument()
  })

  it('keeps enter-method disabled until dip and thickness are filled', () => {
    renderOccurrence([createOreBody({ name: '1号矿体' })])

    const enter = screen.getByRole('button', { name: '进入方法 1号矿体' })
    expect(enter).toBeDisabled()
    fireEvent.change(screen.getByLabelText('倾角 1'), { target: { value: '35' } })
    expect(enter).toBeDisabled()
    fireEvent.change(screen.getByLabelText('厚度 1'), { target: { value: '3' } })
    expect(enter).toBeEnabled()
    expect(screen.getByTestId('ore-body-class-1')).toHaveTextContent('倾斜薄矿体')
    expect(screen.getByTestId('ore-body-class-1').tagName).not.toBe('INPUT')
    expect(screen.getByTestId('ore-body-class-1')).not.toHaveClass('border', 'rounded-md')
    expect(screen.queryByRole('button', { name: '下一步' })).not.toBeInTheDocument()
    expect(screen.getByTestId('stage-nav')).toHaveTextContent('请为每个矿体点击「进入方法」，并在采矿方法中选定一个采用方法')
  })

  it('shows a read-only composed ore-body class instead of a category input', () => {
    renderOccurrence([
      createOreBody({ name: '1号矿体', dipAngle: 20, thickness: 25 }),
      createOreBody({ name: '2号矿体' }),
    ])

    expect(screen.getByTestId('ore-body-class-1')).toHaveTextContent('缓倾斜厚矿体')
    expect(screen.getByTestId('ore-body-class-2')).toHaveTextContent('—')
    expect(screen.queryByLabelText('矿体类别 1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('orebody-category-options')).not.toBeInTheDocument()
  })

  it('numbers rows by table order and reorders them by dragging', () => {
    renderOccurrence([
      createOreBody({ name: '甲体', dipAngle: 35, thickness: 3 }),
      createOreBody({ name: '乙体', dipAngle: 20, thickness: 8 }),
    ])

    expect(screen.getByLabelText('矿体名称 1')).toHaveValue('甲体')
    expect(screen.getByLabelText('矿体名称 2')).toHaveValue('乙体')
    fireEvent.dragStart(screen.getByRole('button', { name: '拖动排序 甲体' }))
    expect(screen.getByTestId('ore-body-row-甲体')).toHaveAttribute('data-dragging', 'true')
    expect(document.querySelector('[data-testid="ore-body-drag-preview"]')).not.toBeNull()
    fireEvent.dragOver(screen.getByTestId('ore-body-row-乙体'))
    expect(screen.getByTestId('ore-body-row-乙体')).toHaveAttribute('data-drop-target', 'true')
    fireEvent.drop(screen.getByTestId('ore-body-row-乙体'))
    expect(screen.getByLabelText('矿体名称 1')).toHaveValue('乙体')
    expect(screen.getByLabelText('矿体名称 2')).toHaveValue('甲体')
    expect(document.querySelector('[data-testid="ore-body-drag-preview"]')).toBeNull()
  })
})
