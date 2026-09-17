import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { calculateCutAndFill, createMethodInput } from '../../mining/cutAndFillCalc'
import CutAndFillResultTable from './CutAndFillResultTable'

it('pins a clicked formula beside its cell and refreshes its highlighted operands after editing', () => {
  const input = createMethodInput('上向进路充填法')
  input.preparation = [{ id: 'r1', name: '穿脉巷道', quantity: 4, oreSingleLength: 10, wasteSingleLength: 120, oreSectionArea: 8, wasteSectionArea: 16.74, note: '' }]
  const onLocateInput = vi.fn()
  const { rerender } = render(<CutAndFillResultTable input={input} result={calculateCutAndFill(input)} darkMode={false} onLocateInput={onLocateInput} />)
  const cells = within(screen.getByTestId('result-row-preparation-r1')).getAllByRole('cell')
  fireEvent.click(cells[10])
  expect(screen.getByTestId('result-cell-trace')).toHaveAttribute('role', 'dialog')
  expect(screen.getByTestId('cut-and-fill-result-table')).not.toContainElement(screen.getByTestId('result-cell-trace'))
  expect(screen.getByTestId('result-cell-trace')).toHaveTextContent('8035.2')
  expect(cells[5]).toHaveAttribute('data-trace-role', 'dependency')
  expect(cells[8]).toHaveAttribute('data-trace-role', 'dependency')
  expect(cells[9]).not.toHaveAttribute('data-trace-role', 'dependency')
  fireEvent.mouseLeave(cells[10])
  expect(screen.getByTestId('result-cell-trace')).toHaveTextContent('480')
  input.preparation[0].wasteSingleLength = 150
  rerender(<CutAndFillResultTable input={input} result={calculateCutAndFill(input)} darkMode={false} onLocateInput={onLocateInput} />)
  expect(screen.getByTestId('result-cell-trace')).toHaveTextContent('10044')
  fireEvent.scroll(screen.getByTestId('result-table-scroll'))
  expect(cells[5]).toHaveAttribute('data-trace-role', 'dependency')
  expect(screen.getByTestId('result-cell-trace')).not.toBeVisible()
  fireEvent.keyDown(cells[8], { key: 'Enter' })
  fireEvent.click(within(screen.getByTestId('result-cell-trace')).getByRole('button', { name: /穿脉巷道 · 岩石中断面/ }))
  expect(onLocateInput).toHaveBeenCalledWith('preparation-r1-wasteSectionArea')
  fireEvent.keyDown(screen.getByTestId('cut-and-fill-result-table'), { key: 'Escape' })
  expect(screen.queryByTestId('result-cell-trace')).not.toBeInTheDocument()
})

it('shows hand-entered values on hover and dismisses an unpinned tooltip when the pointer leaves', async () => {
  const input = createMethodInput('上向进路充填法')
  input.preparation = [{ id: 'r1', name: '穿脉巷道', quantity: 4, oreSingleLength: 10, wasteSingleLength: 120, oreSectionArea: 8, wasteSectionArea: 16.74, note: '' }]
  render(<CutAndFillResultTable input={input} result={calculateCutAndFill(input)} darkMode={false} />)
  const cells = within(screen.getByTestId('result-row-preparation-r1')).getAllByRole('cell')
  fireEvent.mouseEnter(cells[8])
  expect(screen.getByRole('tooltip')).toHaveTextContent('手填 16.74 m²')
  expect(cells[8]).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id)
  fireEvent.mouseLeave(cells[8])
  fireEvent.mouseEnter(cells[0])
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  fireEvent.mouseEnter(cells[8])
  fireEvent.mouseLeave(cells[8])
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  fireEvent.click(cells[10])
  fireEvent.pointerDown(document.body)
  expect(screen.queryByTestId('result-cell-trace')).not.toBeInTheDocument()
  expect(cells[5]).not.toHaveAttribute('data-trace-role')
})

it('identifies a fallback recovery parameter even when it has no editable input target', () => {
  const input = createMethodInput('上向进路充填法')
  Object.assign(input.blockElements.find(element => element.kind === 'panel')!, { length: 10, width: 10, height: 10 })
  input.blockElements.find(element => element.kind === 'primary-stope')!.lossRate = null
  input.common.blockLossDilution.lossRate = .1
  input.common.oreDensity = 2.82
  render(<CutAndFillResultTable input={input} result={calculateCutAndFill(input)} darkMode={false} />)
  fireEvent.click(within(screen.getByTestId('result-row-stoping-primary-stope')).getAllByRole('cell')[13])
  expect(screen.getByTestId('result-cell-trace')).toHaveTextContent(/默认回采损失率\s*10/)
})
