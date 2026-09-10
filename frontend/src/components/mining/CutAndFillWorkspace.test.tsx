import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CutAndFillWorkspace from './CutAndFillWorkspace'

describe('cut-and-fill workbench', () => {
  it('opens a method with reference indicators, block elements and engineering tables', () => {
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
    expect(screen.getByTestId('block-barrier-pillar-name')).toHaveValue('矿柱')
    expect(screen.getByTestId('block-card-barrier-pillar')).toBeInTheDocument()
    expect(screen.getByTestId('block-primary-stope-name')).toHaveValue('采场')
    expect(screen.getByTestId('common-parameters-panel')).not.toHaveTextContent('矿块规格')
    expect(screen.queryByText('未填写')).not.toBeInTheDocument()
    expect(screen.queryByTestId('block-size-fields')).not.toBeInTheDocument()
    expect(screen.getByText('采准比')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '矿体参数' }))
    expect(screen.getByLabelText('矿体密度')).toHaveValue('')
    expect(screen.getByTestId('common-dipAngle')).toBeInTheDocument()
    expect(screen.getByTestId('ore-body-parameters-intro')).toHaveTextContent('基础参数')

    const commonToggle = screen.getByRole('button', { name: /参照指标/ })
    expect(screen.getByLabelText('切割贫损指标贫化率')).toBeInTheDocument()
    fireEvent.click(commonToggle)
    expect(screen.queryByLabelText('切割贫损指标贫化率')).not.toBeInTheDocument()
    expect(screen.getByTestId('common-dipAngle')).toBeInTheDocument()
    expect(screen.queryByLabelText('走向长度')).not.toBeInTheDocument()
    fireEvent.click(commonToggle)
    expect(screen.getByLabelText('切割贫损指标贫化率')).toBeInTheDocument()
  })

  it('places ore-body parameters above reference indicators as a sibling section', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    const oreBody = screen.getByTestId('ore-body-parameters-panel')
    const indicators = screen.getByTestId('common-parameters-panel')
    const blocks = screen.getByTestId('block-elements-panel')
    expect(oreBody.compareDocumentPosition(indicators) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(indicators.compareDocumentPosition(blocks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('button', { name: '矿体参数' })).not.toHaveTextContent('倾角')
    expect(screen.getByRole('button', { name: '矿体参数' })).not.toHaveTextContent('待填写')
    expect(screen.queryByText(/项目带入/)).not.toBeInTheDocument()
    expect(screen.queryByText('矿体赋存与物理参数')).not.toBeInTheDocument()
    expect(screen.getByTestId('block-elements-panel')).toHaveTextContent('矿块构成')
    expect(screen.getByTestId('block-elements-panel')).not.toHaveTextContent('矿块构成要素')
    expect(screen.getByTestId('indicator-card-cuttingLossDilution')).toHaveTextContent('切割贫损指标')
    expect(screen.getByTestId('loss-dilution-intro')).toHaveTextContent('贫化率')
    expect(screen.getByTestId('loss-dilution-intro')).toHaveTextContent('损失率')
  })

  it('uses the same template for handbook methods that were previously placeholders', () => {
    render(<CutAndFillWorkspace methodName="全面法" />)

    expect(screen.getByTestId('cut-and-fill-result-table')).toBeInTheDocument()
    expect(screen.getByTestId('engineering-section-preparation')).toBeInTheDocument()
    expect(screen.getByTestId('add-preparation-row')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /矿体参数/ }))
    expect(screen.getByLabelText('矿体密度')).toHaveValue('')
    expect(screen.getByLabelText('矿柱断面')).toBeInTheDocument()
  })

  it('fits the calculation table to the page width without a notes column', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    fireEvent.click(screen.getByTestId('add-preparation-row'))
    expect(screen.getByTestId('cut-and-fill-result-table')).not.toHaveTextContent('备注')
    expect(screen.getByTestId('engineering-section-preparation')).not.toHaveTextContent('备注')
    expect(screen.getByTestId('calculation-result-table')).toHaveClass('w-full', 'table-fixed')
    expect(screen.getByTestId('calculation-result-table').className).not.toMatch(/min-w-/)
    expect(screen.getByTestId('result-table-scroll')).toHaveClass('overflow-x-hidden')
    expect(screen.getByTestId('result-table-scroll')).not.toHaveClass('overflow-auto')
  })

  it('writes filled block-element volumes into stoping totals', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    expect(screen.getByTestId('block-crown-pillar-name')).toHaveValue('顶柱')
    expect(screen.getByTestId('block-sill-pillar-name')).toHaveValue('底柱')
    expect(screen.getByTestId('block-point-pillar-name')).toHaveValue('点柱')
    fireEvent.change(screen.getByLabelText('采场断面'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('采场高'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('采场数量'), { target: { value: '1' } })
    expect(screen.getByTestId('block-card-primary-stope')).toHaveTextContent('200')
    expect(screen.getByTestId('cut-and-fill-result-table')).toHaveTextContent('采场')
    expect(screen.getByTestId('result-row-stoping-primary-stope')).toHaveTextContent('200')
    expect(screen.queryByLabelText('计入三角矿')).not.toBeInTheDocument()
    fireEvent.change(screen.getByTestId('block-primary-stope-name'), { target: { value: '三角矿' } })
    expect(screen.getByTestId('cut-and-fill-result-table')).toHaveTextContent('三角矿')
    expect(screen.getByLabelText('三角矿断面')).toBeInTheDocument()
  })

  it('keeps decimal points in block-element fields while typing', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    const section = screen.getByLabelText('矿柱断面')
    const height = screen.getByLabelText('矿柱高')
    const quantity = screen.getByLabelText('矿柱数量')
    fireEvent.change(section, { target: { value: '20.' } })
    fireEvent.change(height, { target: { value: '1' } })
    expect(section).toHaveValue('20.')

    fireEvent.change(section, { target: { value: '20.5' } })
    fireEvent.change(height, { target: { value: '10.25' } })
    fireEvent.change(quantity, { target: { value: '1.5' } })
    expect(section).toHaveValue('20.5')
    expect(height).toHaveValue('10.25')
    expect(quantity).toHaveValue('1.5')
    expect(screen.getByTestId('block-card-barrier-pillar')).toHaveTextContent('315.188')
  })

  it('keeps unit addons a fixed width so short and long units align', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    fireEvent.click(screen.getByRole('button', { name: /矿体参数/ }))
    expect(screen.getByLabelText('矿体倾角').nextElementSibling).toHaveClass('w-14')
    expect(screen.getByLabelText('矿体密度').nextElementSibling).toHaveClass('w-14')
    expect(screen.getByLabelText('矿柱名称').nextElementSibling).toHaveClass('w-14')
    expect(screen.getByLabelText('矿柱断面').nextElementSibling).toHaveClass('w-14')
    expect(screen.getByLabelText('矿柱数量').nextElementSibling).toHaveClass('w-14')
    expect(screen.getByLabelText('切割贫损指标贫化率').nextElementSibling).toHaveClass('w-14')
    expect(screen.getByLabelText('矿体倾角')).toHaveClass('text-center')
    expect(screen.getByLabelText('矿柱名称')).toHaveClass('pl-7')
    expect(screen.getByLabelText('矿柱断面')).toHaveClass('pl-7', 'text-center')
  })

  it('adds and removes block-element cards and shows a volume subtotal', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    fireEvent.change(screen.getByLabelText('矿柱断面'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('矿柱高'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('顶柱断面'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('顶柱高'), { target: { value: '10' } })
    expect(screen.getByTestId('block-elements-subtotal')).toHaveTextContent('400')

    expect(screen.getAllByTestId(/block-card-/)).toHaveLength(5)
    fireEvent.click(screen.getByTestId('add-block-element'))
    expect(screen.getAllByTestId(/block-card-/)).toHaveLength(6)
    const newName = screen.getByPlaceholderText('请输入名称')
    expect(newName).toHaveValue('')
    fireEvent.change(newName, { target: { value: '三角矿' } })
    expect(newName).toHaveValue('三角矿')

    fireEvent.change(screen.getByLabelText('矿柱断面'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('矿柱高'), { target: { value: '20' } })
    expect(screen.getByTestId('block-card-barrier-pillar')).toHaveTextContent('1000 m³')
    expect(screen.getByTestId('block-card-barrier-pillar')).not.toHaveTextContent(',')
    expect(screen.getByTestId('block-elements-subtotal')).toHaveTextContent('1200')
    expect(screen.getByTestId('block-elements-subtotal')).not.toHaveTextContent(',')

    fireEvent.click(screen.getByTestId('remove-block-barrier-pillar'))
    expect(screen.queryByTestId('block-card-barrier-pillar')).not.toBeInTheDocument()
    expect(screen.getAllByTestId(/block-card-/)).toHaveLength(5)
    expect(screen.getByTestId('block-elements-subtotal')).toHaveTextContent('200')
  })

  it('keeps clear and export actions above the header rule', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" embedded onBack={() => undefined} />)

    const header = screen.getByTestId('method-workspace-header')
    expect(header).toHaveClass('border-b')
    expect(header).toContainElement(screen.getByTestId('clear-cut-and-fill'))
    expect(header).toContainElement(screen.getByTestId('export-cut-and-fill'))
    expect(screen.getByRole('button', { name: '清空当前方法已填内容' })).toHaveTextContent('清空')
    expect(
      header.compareDocumentPosition(screen.getByTestId('common-parameters-panel')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('clears filled values back to the empty template', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    fireEvent.click(screen.getByRole('button', { name: /矿体参数/ }))
    fireEvent.change(screen.getByLabelText('矿体密度'), { target: { value: '2.82' } })
    expect(screen.getByLabelText('矿体密度')).toHaveValue('2.82')
    fireEvent.click(screen.getByTestId('add-preparation-row'))
    expect(screen.getAllByTestId(/preparation-.*-name/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByTestId('clear-cut-and-fill'))
    expect(screen.getByLabelText('矿体密度')).toHaveValue('')
    expect(screen.queryByTestId(/preparation-.*-name/)).not.toBeInTheDocument()
  })

  it('confirms before removing an engineering row', () => {
    render(<CutAndFillWorkspace methodName="上向进路充填法" />)

    fireEvent.click(screen.getByTestId('add-preparation-row'))
    const nameField = screen.getAllByTestId(/preparation-.*-name/)[0]
    const rowId = String(nameField.getAttribute('data-testid')).replace('preparation-', '').replace('-name', '')
    const hint = screen.getByTestId(`preparation-${rowId}-hint`)
    expect(hint).toHaveClass('h-4')
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
    fireEvent.click(addButton)
    const nameFields = screen.getAllByTestId(/preparation-.*-name/)
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

    fireEvent.click(screen.getByTestId('add-preparation-row'))
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

    fireEvent.click(screen.getByTestId('add-preparation-row'))
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
    expect(exportButton).toBeDisabled()
    fireEvent.click(screen.getByTestId('add-preparation-row'))
    expect(screen.getAllByTestId(/preparation-.*-name/)).toHaveLength(1)
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
