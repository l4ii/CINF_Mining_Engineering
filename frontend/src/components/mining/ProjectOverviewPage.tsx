import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Download, Pencil, Search, Trash2 } from 'lucide-react'
import { useProject } from '../../context/ProjectContext'
import { formatProjectTimestamp, paginateItems, type MiningProject } from '../../mining/project'
import {
  buildProjectCaseFileName,
  buildProjectCaseFileText,
  isProjectCaseFileName,
  PROJECT_CASE_FILE_EXT,
  readProjectCaseFile,
} from '../../mining/projectCaseFile'
import { saveFile } from '../../utils/saveFile'
import { ConfirmDialog } from '../shell/AppDialog'
import { StageNav, StagePageShell, stageInputSurface, stageSurface } from './StagePageShell'

export default function ProjectOverviewPage({
  darkMode = false,
  language = 'zh',
}: {
  darkMode?: boolean
  language?: 'zh' | 'en'
}) {
  const { project, projects, createProject, importProjects, selectProject, enterProject, updateProject, deleteProject } = useProject()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const [caseMessage, setCaseMessage] = useState('')
  const [caseDropActive, setCaseDropActive] = useState(false)
  const [isCaseReading, setIsCaseReading] = useState(false)
  const caseImportInputRef = useRef<HTMLInputElement | null>(null)
  const caseDropDepthRef = useRef(0)
  const surface = stageSurface(darkMode)
  const inputSurface = stageInputSurface(darkMode)
  const muted = darkMode ? 'text-gray-400' : 'text-gray-600'
  const border = darkMode ? 'border-gray-700' : 'border-gray-200'
  const isEn = language === 'en'
  const keyword = query.trim()
  const matchedProjects = useMemo(
    () => (keyword ? projects.filter((item) => item.name.includes(keyword)) : projects),
    [keyword, projects],
  )
  const listing = paginateItems(matchedProjects, page)

  useEffect(() => {
    setPage(1)
  }, [keyword])

  useEffect(() => {
    if (page !== listing.page) setPage(listing.page)
  }, [listing.page, page])

  const handleDelete = (projectId: string, name: string) => {
    setPendingDelete({ id: projectId, name: name.trim() || (isEn ? 'Untitled project' : '未命名项目') })
  }

  const handleCreate = () => {
    setQuery('')
    setPage(1)
    setCaseMessage('')
    const created = createProject()
    setEditingId(created.id)
  }

  const waitForPaint = () =>
    new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        return
      }
      resolve()
    })

  const importCaseFile = async (file: File | null) => {
    if (!file || isCaseReading) return
    if (!isProjectCaseFileName(file.name)) {
      setCaseMessage(isEn ? `Please drop a ${PROJECT_CASE_FILE_EXT} case file exported by this app.` : `请选择本软件导出的 ${PROJECT_CASE_FILE_EXT} 案例文件。`)
      return
    }
    setIsCaseReading(true)
    setCaseMessage('')
    try {
      await waitForPaint()
      const parsed = await readProjectCaseFile(file)
      if (parsed.length === 0) {
        setCaseMessage(isEn ? 'No valid mining project was found in this file.' : '未识别到有效的采矿工程项目案例文件。')
        return
      }
      const imported = importProjects(parsed)
      const first = imported[0]
      setQuery('')
      setPage(1)
      setEditingId(first?.name.trim() ? null : first?.id ?? null)
      setCaseMessage(
        imported.length === 1
          ? isEn
            ? `Imported project: ${first.name.trim() || 'Untitled project'}`
            : `已导入项目：${first.name.trim() || '未命名项目'}`
          : isEn
            ? `Imported ${imported.length} projects.`
            : `已导入 ${imported.length} 个项目。`,
      )
    } catch {
      setCaseMessage(isEn ? `Failed to read the case file. Confirm it is a ${PROJECT_CASE_FILE_EXT} export from this app.` : `案例文件读取失败，请确认文件为本软件导出的 ${PROJECT_CASE_FILE_EXT} 格式。`)
    } finally {
      setIsCaseReading(false)
    }
  }

  const handleCaseDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    caseDropDepthRef.current += 1
    if (Array.from(event.dataTransfer.types).includes('Files')) {
      setCaseDropActive(true)
    }
  }

  const handleCaseDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    caseDropDepthRef.current = Math.max(0, caseDropDepthRef.current - 1)
    if (caseDropDepthRef.current === 0) {
      setCaseDropActive(false)
    }
  }

  const handleCaseDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleCaseDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    caseDropDepthRef.current = 0
    setCaseDropActive(false)
    const file = event.dataTransfer.files?.[0] ?? null
    if (!file) return
    void importCaseFile(file)
  }

  const exportProjectCase = async (item: MiningProject) => {
    const fileName = buildProjectCaseFileName(item)
    const result = await saveFile(fileName, buildProjectCaseFileText(item), {
      title: isEn ? 'Export project' : '导出项目',
      filters: [{ name: isEn ? 'Mining project case' : '采矿工程项目案例', extensions: ['cinfmine'] }],
      mimeType: 'application/json;charset=utf-8',
    })
    if (result.cancelled) {
      setCaseMessage(isEn ? 'Export cancelled.' : '已取消导出。')
      return
    }
    if (result.ok) {
      setCaseMessage(isEn ? `Exported project file: ${result.filePath ?? fileName}` : `已导出项目：${result.filePath ?? fileName}`)
      return
    }
    setCaseMessage(isEn ? `Export failed: ${result.error ?? 'Unknown error'}` : `导出失败：${result.error ?? '未知错误'}`)
  }

  const commitName = (projectId: string, name: string) => {
    if (!name.trim()) return
    setEditingId((current) => (current === projectId ? null : current))
  }

  return (
    <StagePageShell
      darkMode={darkMode}
      crumb={isEn ? 'Overview' : '项目概况'}
      title={isEn ? 'Project overview' : '项目概况'}
      description={
        isEn
          ? 'Establish a mining-engineering project record as the starting point for subsequent parameter entry, occurrence analysis and method comparison. The highlighted row is the working project; its name is shown in the sidebar.'
          : '本页用于建立矿山工程计算项目档案，作为后续基础参数、产状分析与采矿方法比选的工作起点。列表中的高亮行为当前工作项目，其名称同步显示于侧栏。'
      }
      testId="project-overview-page"
    >
      <section className={`border p-4 shadow-sm ${surface}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{isEn ? 'Project records' : '项目列表'}</h2>
          <div className="flex flex-wrap items-center justify-end gap-4">
            <div data-testid="project-list-create" className="shrink-0">
              <button
                type="button"
                onClick={handleCreate}
                aria-label={isEn ? 'New project' : '新建项目'}
                className={`text-base font-medium hover:underline ${darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'}`}
              >
                {isEn ? '+ New project' : '+ 新建项目'}
              </button>
            </div>
            <div data-testid="project-case-import" className="shrink-0">
              <button
                type="button"
                onClick={() => caseImportInputRef.current?.click()}
                disabled={isCaseReading}
                aria-label={isEn ? 'Import project' : '导入项目'}
                className={`text-base font-medium hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60 ${darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'}`}
              >
                {isCaseReading ? (isEn ? 'Reading…' : '读取中…') : isEn ? '+ Import project' : '+ 导入项目'}
              </button>
              <input
                ref={caseImportInputRef}
                type="file"
                accept={PROJECT_CASE_FILE_EXT}
                className="hidden"
                aria-label={isEn ? 'Choose case file' : '选择案例文件'}
                onChange={(event) => {
                  void importCaseFile(event.target.files?.[0] ?? null)
                  event.currentTarget.value = ''
                }}
              />
            </div>
          </div>
        </div>
        <p className={`mt-1 text-base leading-7 ${muted}`}>
          {isEn
            ? 'Register and maintain locally saved projects. Click a project name to continue to base parameters. Click elsewhere on the row to make it current in the sidebar, and use the edit icon to rename it. You can also choose Next. Import a .cinfmine file with Import project or the drop zone below; export from each row.'
            : '登记并维护本机保存的矿山工程项目。单击项目名称进入基础参数；单击其余单元格可切换当前工作项目并同步到侧栏。改名请点编辑图标。也可点击「下一步」进入基础参数。可通过「导入项目」或下方拖放区读取案例文件；导出请使用各行操作。'}
        </p>

        {caseMessage ? (
          <div
            data-testid="project-case-message"
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${darkMode ? 'border-blue-700 bg-blue-950/30 text-blue-100' : 'border-blue-200 bg-blue-50 text-blue-900'}`}
          >
            {caseMessage}
          </div>
        ) : null}

        <div
          data-testid="project-case-dropzone"
          aria-busy={isCaseReading}
          className={`mt-4 border-2 border-dashed px-4 py-5 text-center transition-colors ${
            isCaseReading
              ? darkMode
                ? 'border-blue-500 bg-blue-950/30'
                : 'border-blue-400 bg-blue-50'
              : caseDropActive
                ? darkMode
                  ? 'border-blue-400 bg-blue-950/40'
                  : 'border-blue-500 bg-blue-50'
                : darkMode
                  ? 'border-gray-600 bg-gray-900/20'
                  : 'border-gray-300 bg-gray-50/80'
          }`}
          onDragEnter={isCaseReading ? undefined : handleCaseDragEnter}
          onDragLeave={isCaseReading ? undefined : handleCaseDragLeave}
          onDragOver={isCaseReading ? undefined : handleCaseDragOver}
          onDrop={isCaseReading ? undefined : handleCaseDrop}
        >
          <p className={`text-base font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            {isCaseReading
              ? isEn
                ? 'Reading case file…'
                : '正在读取案例文件…'
              : caseDropActive
                ? isEn
                  ? 'Release to import'
                  : '松开鼠标即可导入'
                : isEn
                  ? 'Drop a case file here to import'
                  : '将案例文件拖入此处即可导入'}
          </p>
          <p className={`mt-2 text-sm ${muted}`}>
            {isCaseReading
              ? isEn
                ? 'Parsing the project record. Please wait.'
                : '正在解析项目档案，请稍候。'
              : isEn
                ? `Accepts ${PROJECT_CASE_FILE_EXT} files exported by this app. You can also use Import project above.`
                : `支持本软件导出的 ${PROJECT_CASE_FILE_EXT} 案例文件；也可使用上方「导入项目」选择文件。`}
          </p>
        </div>

        <div data-testid="project-list-panel" className={`mt-4 overflow-hidden border ${border}`}>
          <div data-testid="project-list-toolbar" className={`flex flex-wrap items-center justify-end gap-2 border-b px-3 py-2 ${darkMode ? 'border-gray-700 bg-gray-800/80' : 'border-gray-200 bg-slate-50'}`}>
            <label className="relative min-w-0 w-full max-w-xs">
              <Search className={`pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={isEn ? 'Search project name' : '搜索项目名称'}
                placeholder={isEn ? 'Search by name' : '搜索名称'}
                className={`h-9 w-full rounded-md border py-0 pl-8 pr-2.5 text-base outline-none focus:border-blue-500 ${inputSurface}`}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-center text-base" data-testid="project-list">
              <colgroup>
                <col className="w-[38%]" />
                <col className="w-[21%]" />
                <col className="w-[21%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className={darkMode ? 'bg-gray-800 text-gray-300' : 'bg-slate-50 text-slate-600'}>
                <tr>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'Project name' : '项目名称'}</th>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'Saved' : '保存时间'}</th>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'Last opened' : '上次打开'}</th>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>
                    {isEn ? 'Actions' : '操作'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`px-3 py-8 text-center ${muted}`}>
                      {isEn ? 'No project records yet. Create a project or import a project to begin.' : '尚未建立项目档案。请点击「新建项目」或「导入项目」开始。'}
                    </td>
                  </tr>
                ) : matchedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`px-3 py-8 text-center ${muted}`}>
                      {isEn ? `No project matches “${keyword}”.` : `没有匹配「${keyword}」的项目。`}
                    </td>
                  </tr>
                ) : (
                  listing.items.map((item, index) => {
                    const current = item.id === project?.id
                    const named = Boolean(item.name.trim())
                    const editing = editingId === item.id || !named
                    return (
                      <tr
                        key={item.id}
                        data-testid={named ? `project-row-${item.name.trim()}` : `project-row-${item.id}`}
                        aria-current={current ? 'true' : undefined}
                        onClick={(event) => {
                          const target = event.target
                          if (target instanceof Element && target.closest('button, input, a')) return
                          if (!current) selectProject(item.id)
                        }}
                        className={`border-t ${border} ${
                          current
                            ? darkMode
                              ? 'bg-blue-950/40'
                              : 'bg-blue-50'
                            : darkMode
                              ? 'cursor-pointer hover:bg-gray-800/80'
                              : 'cursor-pointer hover:bg-slate-50'
                        }`}
                      >
                        <td className="max-w-0 px-3 py-2 align-middle">
                          {editing ? (
                            <input
                              value={item.name}
                              onChange={(event) => updateProject(item.id, { name: event.target.value })}
                              onFocus={() => {
                                setEditingId(item.id)
                                if (!current) selectProject(item.id)
                              }}
                              onBlur={() => commitName(item.id, item.name)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.currentTarget.blur()
                                }
                              }}
                              autoFocus={editingId === item.id || (current && !named)}
                              aria-label={`${isEn ? 'Project name' : '项目名称'} ${index + 1}`}
                              placeholder={isEn ? 'Enter project name' : '请输入项目名称'}
                              className={`mx-auto block h-9 w-full truncate rounded-md border px-2.5 text-center text-base leading-9 outline-none focus:border-blue-500 ${inputSurface}`}
                            />
                          ) : (
                            <button
                              type="button"
                              aria-label={isEn ? `Open project ${item.name.trim()}` : `进入项目 ${item.name.trim()}`}
                              title={item.name.trim()}
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                enterProject(item.id)
                              }}
                              className={`mx-auto flex h-9 w-full min-w-0 items-center justify-center font-medium underline ${
                                darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'
                              }`}
                            >
                              <span className="truncate">{item.name.trim()}</span>
                            </button>
                          )}
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 align-middle tabular-nums ${muted}`}>
                          <span className="inline-flex h-9 items-center justify-center">{formatProjectTimestamp(item.updatedAt)}</span>
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 align-middle tabular-nums ${muted}`}>
                          <span className="inline-flex h-9 items-center justify-center">{formatProjectTimestamp(item.openedAt)}</span>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span className="inline-flex h-9 w-[6.75rem] items-center justify-center gap-1">
                            {named ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setEditingId(item.id)
                                  if (!current) selectProject(item.id)
                                }}
                                aria-label={isEn ? `Edit project ${item.name.trim()}` : `编辑项目 ${item.name.trim()}`}
                                title={isEn ? 'Rename' : '编辑名称'}
                                className={`grid h-8 w-8 place-items-center rounded ${darkMode ? 'text-blue-200 hover:bg-gray-700' : 'text-blue-700 hover:bg-blue-50'}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                              </button>
                            ) : (
                              <span className="h-8 w-8" aria-hidden />
                            )}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void exportProjectCase(item)
                              }}
                              aria-label={isEn ? `Export project ${item.name.trim() || index + 1}` : `导出项目 ${item.name.trim() || index + 1}`}
                              title={isEn ? 'Export project' : '导出项目'}
                              className={`grid h-8 w-8 place-items-center rounded ${darkMode ? 'text-blue-200 hover:bg-gray-700' : 'text-blue-700 hover:bg-blue-50'}`}
                            >
                              <Download className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDelete(item.id, item.name)
                              }}
                              aria-label={`${isEn ? 'Delete project' : '删除项目'} ${item.name.trim() || index + 1}`}
                              className={`grid h-8 w-8 place-items-center rounded ${darkMode ? 'text-red-300 hover:bg-red-950/40' : 'text-red-600 hover:bg-red-50'}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div
            data-testid="project-list-pagination"
            className={`flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-base ${darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-slate-50'}`}
          >
            <span className={muted}>{isEn ? `Total ${listing.total}` : `共 ${listing.total} 条`}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={listing.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className={`h-9 rounded-md border px-3 disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 bg-white hover:bg-slate-50'}`}
              >
                {isEn ? 'Previous' : '上一页'}
              </button>
              <span className={muted}>{isEn ? `Page ${listing.page} / ${listing.pageCount}` : `第 ${listing.page} / ${listing.pageCount} 页`}</span>
              <button
                type="button"
                disabled={listing.page >= listing.pageCount}
                onClick={() => setPage((current) => current + 1)}
                className={`h-9 rounded-md border px-3 disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 bg-white hover:bg-slate-50'}`}
              >
                {isEn ? 'Next' : '下一页'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <StageNav darkMode={darkMode} completeHint={isEn ? 'Create a project and enter its name first' : '请先建立项目并填写名称'} />

      <ConfirmDialog
        open={pendingDelete != null}
        title={isEn ? 'Delete project' : '删除项目'}
        message={
          isEn
            ? `Delete “${pendingDelete?.name ?? ''}”? This cannot be undone.`
            : `确定删除「${pendingDelete?.name ?? ''}」？删除后不可恢复。`
        }
        confirmLabel={isEn ? 'Delete' : '删除'}
        darkMode={darkMode}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteProject(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </StagePageShell>
  )
}
