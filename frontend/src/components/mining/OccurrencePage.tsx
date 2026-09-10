import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { createPortal } from 'react-dom'
import { GripVertical, Search, Trash2 } from 'lucide-react'
import { classifyDip, classifyThickness, DIP_BANDS, THICKNESS_BANDS } from '../../mining/cutAndFillStandards'
import {
  createOreBody,
  isOreBodyOccurrenceReady,
  listOreBodyCategories,
  paginateItems,
  parseProjectNumber,
  rememberOreBodyCategory,
  reorderOreBodies,
  updateOreBodyOccurrence,
} from '../../mining/project'
import { useProject } from '../../context/ProjectContext'
import { ConfirmDialog } from '../shell/AppDialog'
import { StageNav, StagePageShell, stageInputSurface, stageSurface } from './StagePageShell'

function bandLabel(id: string | null, bands: Array<{ id: string; label: string }>): string {
  if (!id) return '—'
  return bands.find((band) => band.id === id)?.label ?? '—'
}

function hideNativeDragGhost(transfer: DataTransfer) {
  if (typeof transfer.setDragImage !== 'function') return
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  canvas.style.position = 'fixed'
  canvas.style.top = '-20px'
  canvas.style.left = '-20px'
  document.body.appendChild(canvas)
  try {
    transfer.setDragImage(canvas, 0, 0)
  } catch {
    /* jsdom / browsers that reject empty drag images */
  }
  window.setTimeout(() => canvas.remove(), 0)
}

function createFloatingRowPreview(row: HTMLTableRowElement, darkMode: boolean): HTMLElement {
  const rect = row.getBoundingClientRect()
  const table = document.createElement('table')
  table.className = 'table-fixed border-collapse text-center text-base'
  table.style.width = `${Math.max(rect.width, 1)}px`
  table.style.background = darkMode ? '#1f2937' : '#ffffff'
  table.style.color = darkMode ? '#f3f4f6' : '#111827'
  table.style.borderRadius = '6px'
  table.style.overflow = 'hidden'

  const tbody = document.createElement('tbody')
  const clone = row.cloneNode(true) as HTMLTableRowElement
  clone.removeAttribute('data-dragging')
  clone.removeAttribute('data-drop-target')
  clone.removeAttribute('data-testid')
  clone.querySelectorAll('[data-testid]').forEach((node) => node.removeAttribute('data-testid'))
  clone.className = darkMode ? 'bg-gray-800' : 'bg-white'
  Array.from(row.cells).forEach((cell, index) => {
    const cloneCell = clone.cells[index]
    if (!cloneCell) return
    cloneCell.style.width = `${Math.max(cell.getBoundingClientRect().width, 1)}px`
    cloneCell.style.boxSizing = 'border-box'
  })
  tbody.appendChild(clone)
  table.appendChild(tbody)

  const wrap = document.createElement('div')
  wrap.setAttribute('data-testid', 'ore-body-drag-preview')
  wrap.style.position = 'fixed'
  wrap.style.left = `${rect.left}px`
  wrap.style.top = `${rect.top}px`
  wrap.style.zIndex = '80'
  wrap.style.pointerEvents = 'none'
  wrap.style.transform = 'rotate(0.4deg)'
  wrap.style.boxShadow = darkMode
    ? '0 18px 40px rgba(0, 0, 0, 0.45)'
    : '0 18px 40px rgba(15, 23, 42, 0.22)'
  wrap.style.outline = darkMode ? '2px solid #60a5fa' : '2px solid #3b82f6'
  wrap.style.borderRadius = '6px'
  wrap.style.opacity = '0.97'
  wrap.appendChild(table)
  document.body.appendChild(wrap)
  return wrap
}

function OreBodyCategoryInput({
  value,
  options,
  onChange,
  onCommit,
  ariaLabel,
  placeholder,
  inputSurface,
  darkMode,
}: {
  value: string
  options: string[]
  onChange: (value: string) => void
  onCommit: (value: string) => void
  ariaLabel: string
  placeholder: string
  inputSurface: string
  darkMode: boolean
}) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const current = value.trim()

  const updateMenuPos = useCallback(() => {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPos()
    window.addEventListener('resize', updateMenuPos)
    document.addEventListener('scroll', updateMenuPos, true)
    return () => {
      window.removeEventListener('resize', updateMenuPos)
      document.removeEventListener('scroll', updateMenuPos, true)
    }
  }, [open, updateMenuPos])

  return (
    <div ref={boxRef} className="relative h-9">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          onCommit(event.target.value)
          window.setTimeout(() => setOpen(false), 120)
        }}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoComplete="off"
        className={`absolute inset-0 h-full w-full appearance-none rounded-md border px-2 text-center text-base outline-none [line-height:34px] focus:border-blue-500 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-list-button]:hidden ${inputSurface}`}
      />
      <span
        className={`pointer-events-none absolute inset-y-0 right-0 flex w-6 items-center justify-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
        aria-hidden
      >
        <span className="mt-px block h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-current" />
      </span>
      {open && options.length > 0 && menuPos
        ? createPortal(
            <ul
              ref={listRef}
              data-testid="orebody-category-options"
              style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 70 }}
              className={`max-h-40 overflow-auto rounded-md border py-1 text-center text-base shadow-lg ${
                darkMode ? 'border-gray-600 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
              }`}
            >
              {options.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      onChange(option)
                      onCommit(option)
                      setOpen(false)
                    }}
                    className={`flex h-8 w-full items-center justify-center px-3 ${
                      option === current
                        ? darkMode
                          ? 'bg-gray-800'
                          : 'bg-blue-50'
                        : darkMode
                          ? 'hover:bg-gray-800'
                          : 'hover:bg-blue-50'
                    }`}
                  >
                    {option}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}

export default function OccurrencePage({
  darkMode = false,
  language = 'zh',
}: {
  darkMode?: boolean
  language?: 'zh' | 'en'
}) {
  const { project, projects, setProject, selectOreBody } = useProject()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const [categoryCatalogVersion, setCategoryCatalogVersion] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const draggingIdRef = useRef<string | null>(null)
  const dragPreviewRef = useRef<HTMLElement | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const previewMoveCleanupRef = useRef<(() => void) | null>(null)
  const surface = stageSurface(darkMode)
  const inputSurface = stageInputSurface(darkMode)
  const muted = darkMode ? 'text-gray-400' : 'text-gray-600'
  const border = darkMode ? 'border-gray-700' : 'border-gray-200'
  const isEn = language === 'en'
  const bodies = project?.oreBodies ?? []
  const keyword = query.trim()
  const matchedBodies = useMemo(
    () => (keyword ? bodies.filter((item) => item.name.includes(keyword)) : bodies),
    [bodies, keyword],
  )
  const listing = paginateItems(matchedBodies, page)
  const categoryOptions = useMemo(
    () => listOreBodyCategories(projects),
    [projects, categoryCatalogVersion],
  )

  const clearRowDrag = useCallback(() => {
    draggingIdRef.current = null
    previewMoveCleanupRef.current?.()
    previewMoveCleanupRef.current = null
    dragPreviewRef.current?.remove()
    dragPreviewRef.current = null
    setDraggingId(null)
    setDropTargetId(null)
  }, [])

  const startRowDrag = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>, bodyId: string) => {
      const row = event.currentTarget.closest('tr')
      draggingIdRef.current = bodyId
      setDraggingId(bodyId)
      setDropTargetId(null)
      const transfer = event.dataTransfer
      if (transfer) {
        transfer.effectAllowed = 'move'
        transfer.setData('text/plain', bodyId)
        hideNativeDragGhost(transfer)
      }
      if (!(row instanceof HTMLTableRowElement)) return
      const rect = row.getBoundingClientRect()
      dragOffsetRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
      dragPreviewRef.current?.remove()
      const preview = createFloatingRowPreview(row, darkMode)
      dragPreviewRef.current = preview
      previewMoveCleanupRef.current?.()
      const onDragOver = (moveEvent: DragEvent) => {
        if (!draggingIdRef.current) return
        moveEvent.preventDefault()
        if (moveEvent.dataTransfer) moveEvent.dataTransfer.dropEffect = 'move'
        preview.style.left = `${moveEvent.clientX - dragOffsetRef.current.x}px`
        preview.style.top = `${moveEvent.clientY - dragOffsetRef.current.y}px`
      }
      document.addEventListener('dragover', onDragOver)
      previewMoveCleanupRef.current = () => document.removeEventListener('dragover', onDragOver)
    },
    [darkMode],
  )

  useEffect(() => {
    setPage(1)
  }, [keyword])

  useEffect(() => {
    if (page !== listing.page) setPage(listing.page)
  }, [listing.page, page])

  useEffect(
    () => () => {
      previewMoveCleanupRef.current?.()
      dragPreviewRef.current?.remove()
      dragPreviewRef.current = null
    },
    [],
  )

  const addBody = () => {
    setQuery('')
    setPage(1)
    setProject((current) => {
      if (!current) return current
      const nextIndex = current.oreBodies.length + 1
      return {
        ...current,
        oreBodies: [...current.oreBodies, createOreBody({ name: `矿体${nextIndex}` })],
      }
    })
  }

  const removeBody = (id: string) => {
    setProject((current) => {
      if (!current) return current
      return { ...current, oreBodies: current.oreBodies.filter((body) => body.id !== id) }
    })
  }

  const moveBody = (fromId: string, toId: string) => {
    setProject((current) => {
      if (!current) return current
      return { ...current, oreBodies: reorderOreBodies(current.oreBodies, fromId, toId) }
    })
  }

  const patchName = (id: string, name: string) => {
    setProject((current) => {
      if (!current) return current
      return {
        ...current,
        oreBodies: current.oreBodies.map((body) => (body.id === id ? { ...body, name } : body)),
      }
    })
  }

  const patchOccurrence = (id: string, dipRaw: string, thicknessRaw: string, field: 'dip' | 'thickness') => {
    setProject((current) => {
      if (!current) return current
      return {
        ...current,
        oreBodies: current.oreBodies.map((body) => {
          if (body.id !== id) return body
          const dip = field === 'dip' ? parseProjectNumber(dipRaw) : body.dipAngle
          const thickness = field === 'thickness' ? parseProjectNumber(thicknessRaw) : body.thickness
          return updateOreBodyOccurrence(body, dip, thickness)
        }),
      }
    })
  }

  const patchCategory = (id: string, category: string) => {
    setProject((current) => {
      if (!current) return current
      return {
        ...current,
        oreBodies: current.oreBodies.map((body) => (body.id === id ? { ...body, category } : body)),
      }
    })
  }

  const commitCategory = (value: string) => {
    rememberOreBodyCategory(value)
    setCategoryCatalogVersion((current) => current + 1)
  }

  const enterMethod = (id: string) => {
    selectOreBody(id)
  }

  return (
    <StagePageShell
      darkMode={darkMode}
      crumb={isEn ? 'Occurrence' : '产状分布'}
      title={isEn ? 'Ore-body occurrence' : '矿体产状'}
      description={
        isEn
          ? 'Register each ore body and enter dip and true thickness. Then click Enter methods on that row, compare mining methods, and adopt one method for the ore body. After every ore body has an adopted method, continue to mine capacity.'
          : '本页用于登记矿体并填写倾角、真厚度。每个矿体填写完整后，请点击该行「进入方法」，进入采矿方法并为该矿体选定一个采用方法。所有矿体都选定采用方法后，再进入矿山生产能力。'
      }
      testId="occurrence-page"
    >
      <section className={`border p-4 shadow-sm ${surface}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{isEn ? 'Ore-body records' : '矿体列表'}</h2>
          <div data-testid="occurrence-list-create" className="shrink-0">
            <button
              type="button"
              onClick={addBody}
              aria-label={isEn ? 'Add ore body' : '添加矿体'}
              className={`text-base font-medium hover:underline ${darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'}`}
            >
              {isEn ? '+ Add ore body' : '+ 添加矿体'}
            </button>
          </div>
        </div>
        <p className={`mt-1 text-base leading-7 ${muted}`}>
          {isEn
            ? 'Add ore bodies and enter dip and true thickness. Handbook bands are derived automatically. Ore-body category can be typed. Drag the handle to change table order. Next, click Enter methods on each row and adopt one mining method; the adopted method appears in this table.'
            : '添加矿体并填写倾角、真厚度。分带由规范自动判定。矿体类别可自行输入。编号可拖动调整。下一步请为每个矿体点击「进入方法」，并在采矿方法中选定一个采用方法；选定结果会显示在本表中。'}
        </p>

        <div data-testid="occurrence-list-panel" className={`mt-4 overflow-hidden border ${border}`}>
          <div
            data-testid="occurrence-list-toolbar"
            className={`flex flex-wrap items-center justify-end gap-2 border-b px-3 py-2 ${darkMode ? 'border-gray-700 bg-gray-800/80' : 'border-gray-200 bg-slate-50'}`}
          >
            <label className="relative min-w-0 w-full max-w-xs">
              <Search className={`pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={isEn ? 'Search ore-body name' : '搜索矿体名称'}
                placeholder={isEn ? 'Search by name' : '搜索名称'}
                className={`h-9 w-full rounded-md border py-0 pl-8 pr-2.5 text-base outline-none focus:border-blue-500 ${inputSurface}`}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-center text-base" data-testid="occurrence-table">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[14%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead className={darkMode ? 'bg-gray-800 text-gray-300' : 'bg-slate-50 text-slate-600'}>
                <tr>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'No.' : '编号'}</th>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'Ore-body name' : '矿体名称'}</th>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'Dip (°)' : '倾角 (°)'}</th>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'True thickness (m)' : '真厚度 (m)'}</th>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'Category' : '矿体类别'}</th>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'Dip band' : '倾角分带'}</th>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'Thickness band' : '厚度分带'}</th>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'Adopted method' : '采用方法'}</th>
                  <th className={`border-b px-3 py-2.5 text-center text-sm font-semibold ${border}`}>{isEn ? 'Actions' : '操作'}</th>
                </tr>
              </thead>
              <tbody>
                {bodies.length === 0 ? (
                  <tr>
                    <td colSpan={9} className={`px-3 py-8 text-center ${muted}`}>
                      {isEn ? 'No ore bodies yet. Add an ore body to begin.' : '尚未登记矿体。请点击「添加矿体」开始。'}
                    </td>
                  </tr>
                ) : matchedBodies.length === 0 ? (
                  <tr>
                    <td colSpan={9} className={`px-3 py-8 text-center ${muted}`}>
                      {isEn ? `No ore body matches “${keyword}”.` : `没有匹配「${keyword}」的矿体。`}
                    </td>
                  </tr>
                ) : (
                  listing.items.map((body) => {
                    const ready = isOreBodyOccurrenceReady(body)
                    const dipBand = body.dipAngle == null ? null : classifyDip(body.dipAngle)
                    const thicknessBand = body.thickness == null ? null : classifyThickness(body.thickness)
                    const rowIndex = bodies.findIndex((item) => item.id === body.id) + 1
                    const isDraggingRow = draggingId === body.id
                    const isDropTarget = dropTargetId === body.id && !isDraggingRow
                    return (
                      <tr
                        key={body.id}
                        data-testid={`ore-body-row-${body.name.trim() || body.id}`}
                        data-dragging={isDraggingRow ? 'true' : undefined}
                        data-drop-target={isDropTarget ? 'true' : undefined}
                        onDragOver={(event) => {
                          if (!draggingIdRef.current) return
                          event.preventDefault()
                          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
                          if (draggingIdRef.current === body.id) {
                            setDropTargetId(null)
                            return
                          }
                          setDropTargetId(body.id)
                        }}
                        onDragLeave={(event) => {
                          const next = event.relatedTarget as Node | null
                          if (next && event.currentTarget.contains(next)) return
                          setDropTargetId((current) => (current === body.id ? null : current))
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          const fromId = draggingIdRef.current
                          if (fromId) moveBody(fromId, body.id)
                          clearRowDrag()
                        }}
                        className={`border-t transition-colors ${border} ${
                          isDraggingRow
                            ? darkMode
                              ? 'bg-gray-800/70 opacity-35'
                              : 'bg-slate-100 opacity-35'
                            : isDropTarget
                              ? darkMode
                                ? 'bg-blue-950/50 ring-2 ring-inset ring-blue-400'
                                : 'bg-blue-50 ring-2 ring-inset ring-blue-500'
                              : ''
                        }`}
                      >
                        <td className={`whitespace-nowrap px-3 py-2 align-middle tabular-nums ${muted}`}>
                          <span className="inline-flex h-9 items-center justify-center">{rowIndex}</span>
                        </td>
                        <td className="max-w-0 px-3 py-2 align-middle">
                          <input
                            value={body.name}
                            onChange={(event) => patchName(body.id, event.target.value)}
                            aria-label={`${isEn ? 'Ore-body name' : '矿体名称'} ${rowIndex}`}
                            placeholder={isEn ? 'Enter ore-body name' : '请输入矿体名称'}
                            className={`mx-auto block h-9 w-full truncate rounded-md border px-2.5 text-center text-base leading-9 outline-none focus:border-blue-500 ${inputSurface}`}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`${isEn ? 'Dip' : '倾角'} ${rowIndex}`}
                            value={body.dipAngle ?? ''}
                            onChange={(event) =>
                              patchOccurrence(body.id, event.target.value, String(body.thickness ?? ''), 'dip')
                            }
                            className={`mx-auto block h-9 w-full appearance-none rounded-md border px-2.5 text-center text-base leading-9 outline-none focus:border-blue-500 ${inputSurface}`}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`${isEn ? 'Thickness' : '厚度'} ${rowIndex}`}
                            value={body.thickness ?? ''}
                            onChange={(event) =>
                              patchOccurrence(body.id, String(body.dipAngle ?? ''), event.target.value, 'thickness')
                            }
                            className={`mx-auto block h-9 w-full appearance-none rounded-md border px-2.5 text-center text-base leading-9 outline-none focus:border-blue-500 ${inputSurface}`}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <OreBodyCategoryInput
                            value={body.category ?? ''}
                            options={categoryOptions}
                            onChange={(category) => patchCategory(body.id, category)}
                            onCommit={commitCategory}
                            ariaLabel={`${isEn ? 'Category' : '矿体类别'} ${rowIndex}`}
                            placeholder={isEn ? 'Type or select' : '输入或选择'}
                            inputSurface={inputSurface}
                            darkMode={darkMode}
                          />
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 align-middle ${muted}`}>
                          <span className="inline-flex h-9 items-center justify-center">{bandLabel(dipBand, DIP_BANDS)}</span>
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 align-middle ${muted}`}>
                          <span className="inline-flex h-9 items-center justify-center">{bandLabel(thicknessBand, THICKNESS_BANDS)}</span>
                        </td>
                        <td className="max-w-0 px-3 py-2 align-middle">
                          <span className="inline-flex h-9 w-full items-center justify-center truncate" title={body.candidates.find((item) => item.id === body.selectedCandidateId)?.methodName || undefined}>
                            {body.candidates.find((item) => item.id === body.selectedCandidateId)?.methodName
                              || (ready ? (isEn ? 'Not adopted' : '未选定') : '—')}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span className="inline-flex h-9 items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={!ready}
                              onClick={() => enterMethod(body.id)}
                              aria-label={`${isEn ? 'Enter methods for' : '进入方法'} ${body.name.trim() || rowIndex}`}
                              title={ready ? (isEn ? 'Enter methods' : '进入方法') : isEn ? 'Enter dip and true thickness first' : '请先填写倾角和真厚度'}
                              className={`h-9 rounded-md px-2 text-base font-medium underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40 ${
                                darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'
                              }`}
                            >
                              {isEn ? 'Enter methods' : '进入方法'}
                            </button>
                            <button
                              type="button"
                              draggable
                              onDragStart={(event) => startRowDrag(event, body.id)}
                              onDragEnd={() => clearRowDrag()}
                              aria-label={`${isEn ? 'Reorder' : '拖动排序'} ${body.name.trim() || rowIndex}`}
                              title={isEn ? 'Drag to reorder' : '拖动调整顺序'}
                              className={`grid h-8 w-8 cursor-grab place-items-center rounded active:cursor-grabbing ${
                                isDraggingRow
                                  ? darkMode
                                    ? 'bg-blue-950/60 text-blue-200'
                                    : 'bg-blue-100 text-blue-700'
                                  : darkMode
                                    ? 'text-gray-300 hover:bg-gray-700'
                                    : 'text-gray-600 hover:bg-slate-100'
                              }`}
                            >
                              <GripVertical className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingDelete({
                                  id: body.id,
                                  name: body.name.trim() || (isEn ? 'Untitled ore body' : '未命名矿体'),
                                })
                              }
                              aria-label={`${isEn ? 'Delete ore body' : '删除矿体'} ${body.name.trim() || rowIndex}`}
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
            data-testid="occurrence-list-pagination"
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

      <StageNav
        darkMode={darkMode}
        completeHint={
          isEn
            ? 'Click Enter methods on each ore body and adopt one mining method'
            : '请为每个矿体点击「进入方法」，并在采矿方法中选定一个采用方法'
        }
      />

      <ConfirmDialog
        open={pendingDelete != null}
        title={isEn ? 'Delete ore body' : '删除矿体'}
        message={
          isEn
            ? `Delete “${pendingDelete?.name ?? ''}”? This cannot be undone.`
            : `确定删除「${pendingDelete?.name ?? ''}」？删除后不可恢复。`
        }
        confirmLabel={isEn ? 'Delete' : '删除'}
        darkMode={darkMode}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) removeBody(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </StagePageShell>
  )
}
