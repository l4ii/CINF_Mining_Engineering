import { describe, expect, it } from 'vitest'
import { Workbook } from 'exceljs'
import { calculateCutAndFill, createMethodInput } from './cutAndFillCalc'
import { buildCutAndFillWorkbook, saveCutAndFillWorkbook } from './cutAndFillExport'

describe('cut-and-fill workbook export', () => {
  it('writes a readable workbook with grouped results and the required fonts', async () => {
    const input = createMethodInput('roadheader-upward-cut-and-fill')
    input.common = {
      ...input.common,
      dipAngle: 20,
      trueThickness: 25.7,
      oreDensity: 2.82,
      wasteDensity: 2.8,
      blockLossDilution: { lossRate: 0.05, dilutionRate: 0.05 },
      preparationLossDilution: { lossRate: 0.1, dilutionRate: 0.05 },
      cuttingLossDilution: { lossRate: 0.08, dilutionRate: 0.04 },
    }
    input.preparation = [{
      id: 'r1',
      name: '穿脉巷道',
      quantity: 12,
      oreSingleLength: 68.197,
      wasteSingleLength: 15.74,
      oreSectionArea: 16.74,
      wasteSectionArea: 16.74,
      note: '',
    }]

    const result = calculateCutAndFill(input)
    const bytes = await buildCutAndFillWorkbook(input, result)
    const workbook = new Workbook()
    await workbook.xlsx.load(bytes)
    const sheet = workbook.getWorksheet('采切计算表')

    expect(sheet).toBeDefined()
    if (!sheet) throw new Error('导出工作簿缺少采切计算表。')
    expect(sheet.getCell('A1').value).toContain('采切工程计算表')
    expect(sheet.getCell('A1').font.name).toBe('方正小标宋简体')
    const firstColumnValues = Array.from({ length: sheet.rowCount }, (_, index) => sheet.getCell(index + 1, 1).value)
    expect(firstColumnValues).toContain('矿体倾角')
    expect(firstColumnValues).toContain('切割工程损失率')
    expect(firstColumnValues).toContain('穿脉巷道')
    expect(firstColumnValues).toContain('采切比')

    const numericCell = Array.from({ length: sheet.rowCount }, (_, index) => sheet.getCell(index + 1, 2).value)
      .find((value) => typeof value === 'number')
    expect(numericCell).toEqual(expect.any(Number))
    const numericRow = sheet.getRows(1, sheet.rowCount)?.find((row) =>
      (Array.isArray(row.values) ? row.values : []).some((value) => typeof value === 'number')
    )
    expect(numericRow).toBeDefined()
    expect(numericRow?.getCell(2).font.name).toBe('Times New Roman')

    const bodyCell = firstColumnValues.find((value) => value === '矿体倾角')
    expect(bodyCell).toBe('矿体倾角')
    const bodyRow = sheet.getRows(1, sheet.rowCount)?.find((row) => row.getCell(1).value === '矿体倾角')
    expect(bodyRow?.getCell(1).font.name).toBe('仿宋_GB2312')
    expect(sheet?.views[0].state).toBe('frozen')
    expect((sheet.views[0] as { xSplit?: number }).xSplit).toBe(1)
    expect((sheet.views[0] as { ySplit?: number }).ySplit).toBeGreaterThan(0)
  })

  it('saves through the shared file helper and reports a browser save result', async () => {
    const input = createMethodInput('upward-cut-and-fill')
    const result = calculateCutAndFill(input)
    const originalUrl = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    const originalClick = HTMLAnchorElement.prototype.click
    const created: string[] = []
    URL.createObjectURL = (() => {
      const url = `blob:cut-fill-${created.length}`
      created.push(url)
      return url
    }) as typeof URL.createObjectURL
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL
    HTMLAnchorElement.prototype.click = (() => undefined) as typeof HTMLAnchorElement.prototype.click
    try {
      const saveResult = await saveCutAndFillWorkbook(input, result)
      expect(saveResult.ok).toBe(true)
      expect(created).toHaveLength(1)
    } finally {
      URL.createObjectURL = originalUrl
      URL.revokeObjectURL = originalRevoke
      HTMLAnchorElement.prototype.click = originalClick
    }
  })

  it('passes the workbook bytes and Excel filters to the Electron save API', async () => {
    const input = createMethodInput('pillar-layered-cut-and-fill')
    const result = calculateCutAndFill(input)
    const originalApi = window.electronAPI
    let receivedData: string | ArrayBuffer | null = null
    let receivedOptions: { filters?: Array<{ name: string; extensions: string[] }> } | undefined
    window.electronAPI = {
      saveFileToDisk: async (_fileName, data, options) => {
        receivedData = data
        receivedOptions = options
        return { ok: true, filePath: 'C:/exports/cut-and-fill.xlsx' }
      },
    }
    try {
      const saveResult = await saveCutAndFillWorkbook(input, result)
      expect(saveResult).toMatchObject({ ok: true, filePath: 'C:/exports/cut-and-fill.xlsx' })
      expect(receivedData).toEqual(expect.any(ArrayBuffer))
      expect(receivedOptions?.filters?.some((filter) => filter.extensions.includes('xlsx'))).toBe(true)
    } finally {
      window.electronAPI = originalApi
    }
  })
})
