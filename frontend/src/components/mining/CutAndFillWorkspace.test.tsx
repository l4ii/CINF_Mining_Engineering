import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CutAndFillWorkspace from './CutAndFillWorkspace'
import { createMethodInput } from '../../mining/cutAndFillCalc'

function addPillar() {
  fireEvent.click(screen.getByTestId('add-block-element'))
}

function customPillarIds() {
  return screen.getAllByTestId(/^block-row-custom-/).map((el) => String(el.getAttribute('data-testid')).replace('block-row-', ''))
}

describe('cut-and-fill workbench', () => {
  it('locates a density input from a result cell even when its section is collapsed', async () => {
    const input = createMethodInput('上向进路充填法')
    input.common.oreDensity = 2.82
    input.preparation = [{ id: 'r1', name: '穿脉', quantity: 2, oreSingleLength: 10, wasteSingleLength: 0, oreSectionArea: 4, wasteSectionArea: 0, note: '' }]
    render(<CutAndFillWorkspace methodName="上向进路充填法" savedInput={input} />)
    expect(screen.queryByLabelText('矿体密度')).not.toBeInTheDocument()
    const cells = within(screen.getByTestId('result-row-preparation-r1')).getAllByRole('cell')
    fireEvent.doubleClick(cells[12])
    fireEvent.click(within(screen.getByTestId('result-cell-trace')).getByRole('button', { name: /矿体密度/ }))
    await waitFor(() => expect(screen.getByLabelText('矿体密度')).toHaveFocus())
    expect(screen.getByLabelText('矿体密度')).toHaveValue('2.82')
  })

  it('keeps entered companion rock through export and excludes it from ore allocation', async () => {
    const onExport = vi.fn()
    render(<CutAndFillWorkspace methodName="上向进路充填法" onExport={onExport} />)
    fireEvent.change(screen.getByLabelText('矿块长'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('矿块宽'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('矿块高'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('采场伴采岩石体积'), { target: { value: '100' } })
    expect(screen.getByTestId('block-primary-stope-volume')).toHaveTextContent('2000')
    fireEvent.click(screen.getByTestId('export-cut-and-fill'))
    await waitFor(() => expect(onExport).toHaveBeenCalledTimes(1))
    const [input, result] = onExport.mock.calls[0]
    expect(input.blockElements.find((element: { kind: string }) => element.kind === 'primary-stope').wasteVolume).toBe(100)
    expect(result.sections.block.totals.wasteVolume).toBe(100)
    expect(result.sections.block.totals.totalVolume).toBe(2100)
  })
  it('opens a method with ore-body parameters, block table and engineering tables', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    expect(screen.getByRole('heading', { name: '上向进路充填法' })).toBeInTheDocument()
    expect(screen.getByTestId('cut-and-fill-result-table')).toBeInTheDocument()
    expect(screen.getByTestId('engineering-section-preparation')).toBeInTheDocument()
    expect(screen.getByTestId('engineering-section-cutting')).toBeInTheDocument()
    expect(screen.queryByTestId('engineering-section-stoping')).not.toBeInTheDocument()
    expect(screen.getByTestId('block-elements-panel')).toBeInTheDocument()
    expect(screen.getByTestId('ore-body-parameters-panel')).toBeInTheDocument()
    expect(screen.queryByLabelText('矿体密度')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('走向长度')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('中段高度')).not.toBeInTheDocument()
    expect(screen.getByTestId('block-panel-name')).toHaveTextContent('矿块')
    expect(screen.getByTestId('block-pillar-group')).toHaveTextContent('矿柱')
    expect(screen.getByTestId('block-volume-allocation')).toHaveTextContent('采准工程矿石体积')
    expect(screen.getByTestId('block-volume-allocation')).toHaveTextContent('切割工程矿石体积')
    expect(screen.getByTestId('block-dev-preparation-volume')).toHaveTextContent('0')
    expect(screen.queryByTestId('block-pillar-empty-row')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('如顶柱、底柱、点柱')).toBeInTheDocument()
    expect(screen.getByLabelText('矿柱1长')).toBeInTheDocument()
    expect(screen.getByTestId('block-primary-stope-name')).toHaveTextContent('采场')
    expect(screen.getByTestId('block-panel-shape')).toHaveTextContent('长方体')
    expect(screen.getByTestId('block-row-primary-stope')).toHaveTextContent('自动扣减')
    const blockTable = screen.getByTestId('block-elements-table')
    expect(within(blockTable).getByRole('columnheader', { name: '结构部位' })).toBeInTheDocument()
    expect(within(blockTable).getByRole('columnheader', { name: '名称' })).toBeInTheDocument()
    expect(within(blockTable).getByRole('columnheader', { name: '几何体' })).toBeInTheDocument()
    expect(within(blockTable).getByRole('columnheader', { name: '宽/直径' })).toBeInTheDocument()
    expect(within(blockTable).queryByRole('columnheader', { name: /^宽$/ })).not.toBeInTheDocument()
    expect(within(blockTable).getByRole('columnheader', { name: '贫化率' })).toBeInTheDocument()
    expect(within(blockTable).getByRole('columnheader', { name: '损失率' })).toBeInTheDocument()
    const unitRow = screen.getByTestId('block-elements-units')
    expect(within(unitRow).getByText('个')).toBeInTheDocument()
    expect(within(unitRow).getAllByText('m³')).toHaveLength(2)
    expect(within(unitRow).getAllByText('m')).toHaveLength(3)
    expect(within(unitRow).getAllByText('%')).toHaveLength(2)
    expect(screen.getByTestId('add-block-element')).toHaveTextContent('+ 新增')
    expect(screen.getByTestId('add-block-element')).not.toHaveTextContent('矿柱')
    expect(screen.queryByText('反算')).not.toBeInTheDocument()
    expect(screen.getAllByTestId(/preparation-.*-name/)).toHaveLength(1)
    expect(screen.getAllByTestId(/cutting-.*-name/)).toHaveLength(1)
    expect(screen.queryByTestId('common-parameters-panel')).not.toBeInTheDocument()
    expect(screen.queryByText('参照指标')).not.toBeInTheDocument()
    expect(screen.queryByText('未填写')).not.toBeInTheDocument()
    expect(screen.getByText('采准比')).toBeInTheDocument()
    expect(screen.getByLabelText('矿柱1贫化率')).toBeInTheDocument()
    expect(screen.getByLabelText('矿柱1损失率')).toBeInTheDocument()
    expect(screen.getByLabelText('采场贫化率')).toBeInTheDocument()
    expect(screen.getByLabelText('采场损失率')).toBeInTheDocument()
    expect(screen.queryByLabelText('回采贫化率')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('矿块贫化率')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText('采准工程贫化率')).toHaveLength(1)
    expect(screen.getAllByLabelText('切割工程贫化率')).toHaveLength(1)
    expect(screen.getAllByLabelText('采准工程损失率')).toHaveLength(1)
    expect(screen.getAllByLabelText('切割工程损失率')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '矿体参数' }))
    expect(screen.getByLabelText('矿体密度')).toHaveValue('')
    expect(screen.getByTestId('common-dipAngle')).toBeInTheDocument()
    expect(screen.getByTestId('ore-body-parameters-intro')).toHaveTextContent('基础参数')
    expect(screen.queryByLabelText('矿体斜长')).not.toBeInTheDocument()
  })

  it('places ore-body parameters above the block composition table', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    const oreBody = screen.getByTestId('ore-body-parameters-panel')
    const blocks = screen.getByTestId('block-elements-panel')
    expect(oreBody.compareDocumentPosition(blocks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('button', { name: '矿体参数' })).not.toHaveTextContent('倾角')
    expect(screen.getByRole('button', { name: '矿体参数' })).not.toHaveTextContent('待填写')
    expect(screen.queryByText(/项目带入/)).not.toBeInTheDocument()
    expect(screen.getByTestId('block-elements-panel')).toHaveTextContent('矿块结构参数')
    expect(screen.getByTestId('block-elements-table')).toBeInTheDocument()
  })

  it('computes cylinder and triangular-prism pillar volumes in the table', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    fireEvent.click(screen.getByLabelText('矿柱1计算方法'))
    fireEvent.click(screen.getByRole('option', { name: '圆柱' }))
    expect(screen.queryByLabelText('矿柱1长')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('矿柱1宽')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('矿柱1半径')).not.toBeInTheDocument()
    expect(screen.getByLabelText('矿柱1直径')).toHaveAttribute('placeholder', '直径')
    fireEvent.change(screen.getByLabelText('矿柱1直径'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('矿柱1高'), { target: { value: '4' } })
    expect(screen.getByTestId(`block-${customPillarIds()[0]}-volume`)).toHaveTextContent('12.566')

    addPillar()
    fireEvent.click(screen.getByLabelText('矿柱2计算方法'))
    fireEvent.click(screen.getByRole('option', { name: '三棱柱' }))
    fireEvent.change(screen.getByLabelText('矿柱2底边'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('矿柱2截面高'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('矿柱2长度'), { target: { value: '10' } })
    expect(screen.getByTestId(`block-${customPillarIds()[1]}-volume`)).toHaveTextContent('120')
    expect(screen.getByTestId('block-pillar-group')).toHaveAttribute('rowspan', '2')
  })

  it('uses the same template for handbook methods that were previously placeholders', () => {
    render(<CutAndFillWorkspace methodName="全面法" />)

    expect(screen.getByTestId('cut-and-fill-result-table')).toBeInTheDocument()
    expect(screen.getByTestId('engineering-section-preparation')).toBeInTheDocument()
    expect(screen.getByTestId('add-preparation-row')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /矿体参数/ }))
    expect(screen.getByLabelText('矿体密度')).toHaveValue('')
    expect(screen.getByLabelText('矿柱1长')).toBeInTheDocument()
  })

  it('keeps the full calculation table with grouped column headers', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    fireEvent.click(screen.getByTestId('add-preparation-row'))
    expect(screen.getByTestId('cut-and-fill-result-table')).not.toHaveTextContent('备注')
    expect(screen.getByTestId('engineering-section-preparation')).not.toHaveTextContent('备注')

    const table = screen.getByTestId('calculation-result-table')
    expect(within(table).queryByText('矿石中单长')).not.toBeInTheDocument()
    expect(within(table).getAllByText('单长')).toHaveLength(2)
    expect(within(table).getByRole('columnheader', { name: '工程项目' })).toHaveAttribute('rowspan', '3')
    expect(within(table).getByRole('columnheader', { name: /巷道数目/ })).toHaveAttribute('rowspan', '3')
    expect(within(table).getByRole('columnheader', { name: /比例/ })).toHaveAttribute('title', '占矿块采出矿量比例')
    expect(within(table).queryByText('占矿块采出矿量比例')).not.toBeInTheDocument()
    expect(screen.getByTestId('result-section-preparation')).toHaveClass('bg-slate-100')
    expect(screen.getByTestId('result-section-cutting')).toHaveClass('bg-slate-50')
    expect(screen.getByTestId('result-total-developmentTotal')).toHaveTextContent('采切合计')
    expect(screen.getByTestId('result-section-stoping')).toHaveClass('bg-slate-100')
  })

  it('derives stope volume from the panel after subtracting pillars', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    expect(screen.queryByTestId('block-pillar-empty-row')).not.toBeInTheDocument()
    expect(screen.getByLabelText('矿柱1长')).toBeInTheDocument()
    expect(screen.queryByLabelText('顶柱长')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('矿块长'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('矿块宽'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('矿块高'), { target: { value: '10' } })
    expect(screen.getByTestId('block-panel-volume')).toHaveTextContent('2000')
    expect(screen.getByTestId('block-primary-stope-volume')).toHaveTextContent('2000')
    expect(screen.getByTestId('block-primary-stope-volume')).toHaveAttribute('title', expect.stringContaining('采场体积'))
    expect(screen.getByTestId('cut-and-fill-result-table')).toHaveTextContent('采场')
    const volumeCell = within(screen.getByTestId('result-row-stoping-primary-stope')).getAllByRole('cell')[9]
    fireEvent.mouseEnter(volumeCell)
    expect(screen.getByRole('tooltip')).toHaveTextContent('矿块体积')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('计入三角矿')).not.toBeInTheDocument()
  })

  it('uses engineering rates in one place and deducts linked ore volumes from the stope', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    const headerDilution = screen.getByLabelText('采准工程贫化率')
    const headerLoss = screen.getByLabelText('切割工程损失率')
    fireEvent.change(headerDilution, { target: { value: '5' } })
    expect(headerDilution).toHaveValue('5')
    fireEvent.change(headerLoss, { target: { value: '6' } })
    expect(headerLoss).toHaveValue('6')

    const nameField = screen.getAllByTestId(/preparation-.*-name/)[0]
    const rowId = String(nameField.getAttribute('data-testid')).replace('preparation-', '').replace('-name', '')
    fireEvent.change(screen.getByLabelText(`采准工程-巷道数目-${rowId}`), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(`采准工程-矿石中单长-${rowId}`), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(`采准工程-矿石中断面-${rowId}`), { target: { value: '4' } })
    expect(screen.getByTestId(`preparation-${rowId}-oreVolume`)).toHaveValue('80')
    expect(screen.getByTestId('block-dev-preparation-volume')).toHaveTextContent('80')
    fireEvent.change(screen.getByLabelText('矿块长'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('矿块宽'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('矿块高'), { target: { value: '10' } })
    expect(screen.getByTestId('block-primary-stope-volume')).toHaveTextContent('1920')
  })

  it('keeps decimal points in block-element fields while typing', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    const length = screen.getByLabelText('矿柱1长')
    const width = screen.getByLabelText('矿柱1宽')
    const height = screen.getByLabelText('矿柱1高')
    const quantity = screen.getByLabelText('矿柱1数量')
    fireEvent.change(length, { target: { value: '20.' } })
    fireEvent.change(width, { target: { value: '1' } })
    expect(length).toHaveValue('20.')

    fireEvent.change(length, { target: { value: '20.5' } })
    fireEvent.change(width, { target: { value: '2' } })
    fireEvent.change(height, { target: { value: '10.25' } })
    fireEvent.change(quantity, { target: { value: '1.5' } })
    expect(length).toHaveValue('20.5')
    expect(height).toHaveValue('10.25')
    expect(quantity).toHaveValue('1.5')
    expect(screen.getByTestId(`block-${customPillarIds()[0]}-volume`)).toHaveTextContent('630.375')
  })

  it('keeps unit addons a fixed width so short and long units align', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    fireEvent.click(screen.getByRole('button', { name: /矿体参数/ }))
    expect(screen.getByLabelText('矿体倾角').nextElementSibling).toHaveClass('w-14')
    expect(screen.getByLabelText('矿体密度').nextElementSibling).toHaveClass('w-14')
    expect(screen.getByLabelText('矿柱1长')).toHaveClass('h-8', 'w-full')
    expect(screen.getByLabelText('矿柱1长')).not.toHaveClass('h-[38px]')
    expect(screen.getByLabelText('矿柱1长').nextElementSibling).toBeNull()
    expect(screen.getByLabelText('矿柱1数量').nextElementSibling).toBeNull()
    expect(screen.getByLabelText('矿柱1贫化率').nextElementSibling).toBeNull()
    expect(screen.getByLabelText('采场损失率').nextElementSibling).toBeNull()
    expect(screen.getByLabelText('矿体倾角')).toHaveClass('text-center')
    expect(screen.getByLabelText('矿柱1长')).toHaveClass('text-center')
    expect(screen.getByLabelText('矿柱1计算方法')).toHaveClass('text-center')
    expect(screen.getByLabelText('矿块计算方法')).toHaveClass('text-center')
    fireEvent.click(screen.getByLabelText('矿柱1计算方法'))
    expect(screen.getByTestId('block-shape-menu')).toHaveClass('text-center')
    expect(screen.getByRole('option', { name: '圆柱' })).toHaveClass('text-center')
  })

  it('adds and removes pillar rows in the block table', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    expect(screen.getAllByTestId(/block-row-/)).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('矿柱1长'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('矿柱1宽'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('矿柱1高'), { target: { value: '10' } })
    const firstId = customPillarIds()[0]
    expect(screen.getByTestId(`block-${firstId}-volume`)).toHaveTextContent('2000')
    expect(screen.getByPlaceholderText('如顶柱、底柱、点柱')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId(`block-${firstId}-name`), { target: { value: '间柱' } })
    expect(screen.getByTestId(`block-${firstId}-name`)).toHaveValue('间柱')
    expect(screen.getByTestId('block-pillar-group')).toHaveAttribute('rowspan', '1')

    addPillar()
    expect(screen.getAllByTestId(/block-row-/)).toHaveLength(4)
    fireEvent.change(screen.getByLabelText('矿柱2长'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('矿柱2宽'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('矿柱2高'), { target: { value: '10' } })
    const secondId = customPillarIds()[1]
    expect(screen.getByTestId(`block-${secondId}-volume`)).toHaveTextContent('2000')
    expect(screen.getByTestId('block-pillar-group')).toHaveAttribute('rowspan', '2')

    fireEvent.click(screen.getByTestId(`remove-block-${firstId}`))
    expect(screen.queryByTestId(`block-row-${firstId}`)).not.toBeInTheDocument()
    expect(screen.getAllByTestId(/block-row-/)).toHaveLength(3)
    expect(screen.getByTestId('block-pillar-group')).toHaveAttribute('rowspan', '1')
  })

  it('keeps the text clear action in the header and export beside the result table', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" embedded onBack={() => undefined} />)

    const header = screen.getByTestId('method-workspace-header')
    const clearButton = screen.getByTestId('clear-cut-and-fill')
    const exportButton = screen.getByTestId('export-cut-and-fill')
    expect(header).toHaveClass('border-b')
    expect(header).toContainElement(clearButton)
    expect(header).not.toContainElement(exportButton)
    expect(screen.getByTestId('cut-and-fill-result-table')).toContainElement(exportButton)
    expect(screen.queryByText(/单位：长度/)).not.toBeInTheDocument()
    expect(exportButton).toBeEnabled()
    expect(clearButton).toHaveTextContent('清空')
    expect(clearButton).toHaveClass('hover:underline')
    expect(clearButton).not.toHaveClass('rounded-md', 'border')
    expect(exportButton).toHaveClass('hover:underline')
    expect(exportButton).not.toHaveClass('rounded-md', 'bg-blue-600')
    expect(screen.getByTestId('method-page-back')).toBeInTheDocument()
    expect(
      header.compareDocumentPosition(screen.getByTestId('ore-body-parameters-panel')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('clears filled values back to the empty template', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    fireEvent.click(screen.getByRole('button', { name: /矿体参数/ }))
    fireEvent.change(screen.getByLabelText('矿体密度'), { target: { value: '2.82' } })
    expect(screen.getByLabelText('矿体密度')).toHaveValue('2.82')
    fireEvent.change(screen.getAllByTestId(/preparation-.*-name/)[0], { target: { value: '穿脉巷道' } })

    fireEvent.click(screen.getByTestId('clear-cut-and-fill'))
    expect(screen.getByLabelText('矿体密度')).toHaveValue('')
    expect(screen.getAllByTestId(/preparation-.*-name/)).toHaveLength(1)
    expect(screen.getAllByTestId(/preparation-.*-name/)[0]).toHaveValue('')
    expect(screen.getAllByTestId(/cutting-.*-name/)).toHaveLength(1)
  })

  it('confirms before removing an engineering row', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    const nameField = screen.getAllByTestId(/preparation-.*-name/)[0]
    const rowId = String(nameField.getAttribute('data-testid')).replace('preparation-', '').replace('-name', '')
    const hint = screen.getByTestId(`preparation-${rowId}-hint`)
    expect(hint).toHaveClass('h-4')
    expect(hint).toHaveTextContent('')
    fireEvent.change(screen.getByTestId(`preparation-${rowId}-quantity`), { target: { value: '1' } })
    expect(hint).toHaveTextContent('工程名称不能为空')
    fireEvent.change(screen.getByTestId(`preparation-${rowId}-name`), { target: { value: '穿脉巷道' } })
    expect(hint).toHaveClass('h-4')
    expect(hint).toHaveTextContent('')

    fireEvent.click(screen.getByTestId(`remove-preparation-${rowId}`))

    expect(screen.getByRole('dialog', { name: '删除采准工程' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getAllByTestId(/preparation-.*-name/)).toHaveLength(1)

    fireEvent.click(screen.getByTestId(`remove-preparation-${rowId}`))
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.queryByTestId(/preparation-.*-name/)).not.toBeInTheDocument()
  })

  it('uses a text add action, auto numbers rows, and infers length fields from total length', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    const addButton = screen.getByTestId('add-preparation-row')
    expect(addButton).toHaveTextContent('+ 新增')
    expect(addButton).toHaveClass('hover:underline')
    expect(addButton).not.toHaveClass('rounded-md', 'border')

    fireEvent.click(addButton)
    const nameFields = screen.getAllByTestId(/preparation-.*-name/)
    expect(nameFields).toHaveLength(2)
    const firstId = String(nameFields[0].getAttribute('data-testid')).replace('preparation-', '').replace('-name', '')
    const secondId = String(nameFields[1].getAttribute('data-testid')).replace('preparation-', '').replace('-name', '')
    expect(screen.getByTestId(`preparation-${firstId}-index`)).toHaveTextContent('1')
    expect(screen.getByTestId(`preparation-${secondId}-index`)).toHaveTextContent('2')

    fireEvent.change(screen.getByTestId(`preparation-${firstId}-wasteTotalLength`), { target: { value: '480' } })
    expect(screen.getByTestId(`preparation-${firstId}-quantity`)).toHaveValue('')
    expect(screen.getByTestId(`preparation-${firstId}-wasteSingleLength`)).toHaveValue('')
    fireEvent.change(screen.getByTestId(`preparation-${firstId}-wasteSectionArea`), { target: { value: '16.74' } })
    expect(screen.getByTestId(`preparation-${firstId}-wasteVolume`)).toHaveValue('8035.2')
    expect(screen.getByTestId(`preparation-${firstId}-totalVolume`)).toHaveValue('8035.2')

    fireEvent.change(screen.getByTestId(`preparation-${firstId}-quantity`), { target: { value: '4' } })
    expect(screen.getByTestId(`preparation-${firstId}-wasteSingleLength`)).toHaveValue('120')

    fireEvent.change(screen.getByTestId(`preparation-${secondId}-wasteTotalLength`), { target: { value: '240' } })
    fireEvent.change(screen.getByTestId(`preparation-${secondId}-wasteSingleLength`), { target: { value: '80' } })
    expect(screen.getByTestId(`preparation-${secondId}-quantity`)).toHaveValue('3')

    fireEvent.click(screen.getByTestId(`remove-preparation-${firstId}`))
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.getByTestId(`preparation-${secondId}-index`)).toHaveTextContent('1')
    expect(screen.getByTestId('cut-and-fill-result-table')).toHaveTextContent('240')
  })

  it('links preparation count, unit length and total length in the form', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    const nameField = screen.getAllByTestId(/preparation-.*-name/)[0]
    const rowId = String(nameField.getAttribute('data-testid')).replace('preparation-', '').replace('-name', '')
    fireEvent.change(screen.getByTestId(`preparation-${rowId}-quantity`), { target: { value: '5' } })
    fireEvent.change(screen.getByTestId(`preparation-${rowId}-oreSingleLength`), { target: { value: '100' } })
    expect(screen.getByTestId(`preparation-${rowId}-oreTotalLength`)).toHaveValue('500')
    fireEvent.change(screen.getByTestId(`preparation-${rowId}-quantity`), { target: { value: '4' } })
    fireEvent.change(screen.getByTestId(`preparation-${rowId}-wasteSingleLength`), { target: { value: '120' } })
    expect(screen.getByTestId(`preparation-${rowId}-wasteTotalLength`)).toHaveValue('480')
    fireEvent.change(screen.getByTestId(`preparation-${rowId}-wasteSectionArea`), { target: { value: '16.74' } })
    expect(screen.getByTestId(`preparation-${rowId}-wasteVolume`)).toHaveValue('8035.2')
    expect(screen.getByTestId(`preparation-${rowId}-totalVolume`)).toHaveValue('8035.2')
    expect(screen.getByTestId(`preparation-card-${rowId}`)).toHaveTextContent('矿石中')
    expect(screen.getByTestId(`preparation-card-${rowId}`)).toHaveTextContent('总体积')
    expect(screen.getByTestId(`preparation-card-${rowId}`)).toHaveTextContent('编号')
    expect(screen.getByTestId(`preparation-card-${rowId}`)).not.toHaveClass('pt-8')
    expect(screen.queryByTestId(`preparation-${rowId}-quantity-waste`)).not.toBeInTheDocument()
    expect(screen.getAllByTestId(`preparation-${rowId}-quantity`)).toHaveLength(1)
    expect(screen.getByTestId('cut-and-fill-result-table')).toHaveTextContent('8035.2')
  })

  it('keeps decimal points in engineering fields while typing', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    const nameField = screen.getAllByTestId(/preparation-.*-name/)[0]
    const rowId = String(nameField.getAttribute('data-testid')).replace('preparation-', '').replace('-name', '')

    fireEvent.change(screen.getByTestId(`preparation-${rowId}-oreSingleLength`), { target: { value: '20.' } })
    expect(screen.getByTestId(`preparation-${rowId}-oreSingleLength`)).toHaveValue('20.')
    fireEvent.change(screen.getByTestId(`preparation-${rowId}-oreSingleLength`), { target: { value: '20.5' } })
    expect(screen.getByTestId(`preparation-${rowId}-oreSingleLength`)).toHaveValue('20.5')

    fireEvent.change(screen.getByTestId(`preparation-${rowId}-quantity`), { target: { value: '4.' } })
    expect(screen.getByTestId(`preparation-${rowId}-quantity`)).toHaveValue('4.')
    fireEvent.change(screen.getByTestId(`preparation-${rowId}-oreSectionArea`), { target: { value: '16。74' } })
    expect(screen.getByTestId(`preparation-${rowId}-oreSectionArea`)).toHaveValue('16.74')
    fireEvent.change(screen.getByTestId(`preparation-${rowId}-oreTotalLength`), { target: { value: '100.0' } })
    expect(screen.getByTestId(`preparation-${rowId}-oreTotalLength`)).toHaveValue('100.0')
  })

  it('adds a custom engineering row and calls the export callback', async () => {
    const onExport = vi.fn().mockResolvedValue({ ok: true })
    render(<CutAndFillWorkspace methodName="上向进路充填法" onExport={onExport} />)

    const exportButton = screen.getByTestId('export-cut-and-fill')
    expect(exportButton).toBeEnabled()

    fireEvent.click(exportButton)
    await waitFor(() => expect(onExport).toHaveBeenCalledTimes(1))
  })

  it('fills inherited project densities and occurrence but keeps them editable', () => {
    render(
      <CutAndFillWorkspace
        methodName="上向进路充填法"
        inheritedCommon={{ oreDensity: 2.7, wasteDensity: 2.6, dipAngle: 35, trueThickness: 3 }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /矿体参数/ }))
    expect(screen.getByLabelText('矿体密度')).toHaveValue('2.7')
    expect(screen.getByLabelText('矿体密度')).not.toBeDisabled()
    expect(screen.getByLabelText('围岩密度')).not.toBeDisabled()
    expect(screen.getByLabelText('矿体倾角')).not.toBeDisabled()
    expect(screen.getByLabelText('矿体真厚')).not.toBeDisabled()
    expect(screen.queryByText(/项目带入/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('矿体密度'), { target: { value: '3.1' } })
    expect(screen.getByLabelText('矿体密度')).toHaveValue('3.1')
  })
})
