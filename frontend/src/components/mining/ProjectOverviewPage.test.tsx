import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProjectOverviewPage from './ProjectOverviewPage'
import { ProjectProvider } from '../../context/ProjectContext'
import { createEmptyProject } from '../../mining/project'
import { buildProjectCaseFileText, PROJECT_CASE_FILE_EXT } from '../../mining/projectCaseFile'
import { saveFile } from '../../utils/saveFile'

vi.mock('../../utils/saveFile', () => ({
  saveFile: vi.fn(async (fileName: string) => ({ ok: true, filePath: fileName })),
}))

function renderOverview(projects = Array.from({ length: 11 }, (_, index) => createEmptyProject(`矿${index + 1}`))) {
  return render(
    <ProjectProvider persist={false} initialProjects={projects}>
      <ProjectOverviewPage />
    </ProjectProvider>,
  )
}

function createCaseFile(name: string, fileName = `${name}${PROJECT_CASE_FILE_EXT}`) {
  return new File([buildProjectCaseFileText(createEmptyProject(name))], fileName, { type: 'application/json' })
}

describe('project overview list', () => {
  it('puts search inside the table, keeps create above it, and paginates records', () => {
    renderOverview()

    const panel = screen.getByTestId('project-list-panel')
    expect(panel).toContainElement(screen.getByLabelText('搜索项目名称'))
    expect(panel).not.toContainElement(screen.getByRole('button', { name: '新建项目' }))
    expect(screen.getByTestId('project-list-create')).toHaveTextContent('+ 新建项目')
    expect(screen.getByTestId('project-case-import')).toHaveTextContent('+ 导入项目')
    expect(screen.queryByRole('button', { name: /^导出项目$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出项目 矿1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导入项目' })).toBeInTheDocument()
    expect(screen.getByTestId('project-case-dropzone')).toHaveTextContent('将案例文件拖入此处即可导入')
    expect(screen.getByTestId('project-list')).toHaveClass('text-base', 'table-fixed', 'text-center')
    expect(screen.getByRole('button', { name: '进入项目 矿1' })).toHaveClass('underline')
    expect(screen.getByRole('button', { name: '编辑项目 矿1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '进入项目 矿6' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '进入项目 矿7' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '进入项目 矿11' })).not.toBeInTheDocument()
    expect(screen.getByTestId('project-list-pagination')).toHaveTextContent('共 11 条')
    expect(screen.getByTestId('project-list-pagination')).toHaveTextContent('第 1 / 2 页')

    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.getByRole('button', { name: '进入项目 矿11' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '进入项目 矿1' })).not.toBeInTheDocument()
    expect(screen.getByTestId('project-list-pagination')).toHaveTextContent('第 2 / 2 页')

    fireEvent.click(screen.getByRole('row', { name: /矿11/ }))
    expect(screen.getByRole('row', { name: /矿11/ })).toHaveAttribute('aria-current', 'true')
  })

  it('imports a case file through the file picker and selects it', async () => {
    renderOverview([createEmptyProject('原有矿')])

    fireEvent.change(screen.getByLabelText('选择案例文件'), {
      target: { files: [createCaseFile('导入矿')] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('project-case-message')).toHaveTextContent('已导入项目：导入矿')
    })
    expect(screen.getByRole('button', { name: '进入项目 导入矿' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /导入矿/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByTestId('project-list-pagination')).toHaveTextContent('共 2 条')
  })

  it('imports a dropped case file and rejects the wrong extension', async () => {
    renderOverview([createEmptyProject('原有矿')])
    const dropzone = screen.getByTestId('project-case-dropzone')

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [new File(['{}'], 'notes.txt')], types: ['Files'] },
    })
    expect(screen.getByTestId('project-case-message')).toHaveTextContent('.cinfmine')
    expect(screen.queryByRole('button', { name: '进入项目 拖入矿' })).not.toBeInTheDocument()

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [createCaseFile('拖入矿')], types: ['Files'] },
    })
    await waitFor(() => {
      expect(screen.getByTestId('project-case-message')).toHaveTextContent('已导入项目：拖入矿')
    })
    expect(screen.getByRole('row', { name: /拖入矿/ })).toHaveAttribute('aria-current', 'true')
  })

  it('exports the project from the row action', async () => {
    renderOverview([createEmptyProject('原有矿')])
    fireEvent.click(screen.getByRole('button', { name: '导出项目 原有矿' }))
    await waitFor(() => {
      expect(saveFile).toHaveBeenCalled()
      expect(screen.getByTestId('project-case-message')).toHaveTextContent('已导出项目：原有矿.cinfmine')
    })
  })
})
