import { Workbook, type Cell, type Row, type Worksheet } from 'exceljs'
import type {
  CalculatedRow,
  CommonParameters,
  CutAndFillResult,
  MiningMethodInput,
  SectionTotals,
} from './types'
import { saveFile, type SaveFileResult } from '../utils/saveFile'

export const CUT_AND_FILL_WORKSHEET_NAME = '采切计算表'
export const CUT_AND_FILL_FILE_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const FONT_TITLE = '方正小标宋简体'
const FONT_BODY = '仿宋_GB2312'
const FONT_NUMERIC = 'Times New Roman'
const COLOR_TITLE = '17365D'
const COLOR_GROUP = 'D9EAF7'
const COLOR_INPUT = 'EAF3F8'
const COLOR_BORDER = 'A6A6A6'
const NUMBER_FORMAT = '#,##0.000'
const PERCENT_FORMAT = '0.000%'

type ExportCellKind = 'title' | 'body' | 'numeric' | 'header' | 'input'

type ParameterExportRow = { label: string; value: number | null; unit: string; percentage?: boolean }

function parameterRows(common: CommonParameters): ParameterExportRow[] {
  const indicator = (label: string, item: CommonParameters['cuttingLossDilution']): ParameterExportRow[] => [
    { label: `${label}贫化率`, value: item.dilutionRate, unit: '%', percentage: true },
    { label: `${label}损失率`, value: item.lossRate, unit: '%', percentage: true },
  ]
  return [
    { label: '矿体倾角', value: common.dipAngle, unit: '°' },
    { label: '矿体真厚', value: common.trueThickness, unit: 'm' },
    { label: '矿体密度', value: common.oreDensity, unit: 't/m³' },
    { label: '围岩密度', value: common.wasteDensity, unit: 't/m³' },
    ...indicator('采准工程', common.preparationLossDilution),
    ...indicator('切割工程', common.cuttingLossDilution),
  ]
}

const RESULT_HEADERS = [
  '工程项目',
  '巷道数目',
  '矿石中单长',
  '矿石中总长',
  '岩石中单长',
  '岩石中总长',
  '总长',
  '矿石中断面',
  '岩石中断面',
  '矿石中体积',
  '岩石中体积',
  '总体积',
  '地质储量',
  '采出地质储量',
  '采出矿量',
  '采出废石',
  '占矿块采出矿量比例',
  '备注',
]

const RESULT_UNITS = [
  '',
  '个',
  'm',
  'm',
  'm',
  'm',
  'm',
  'm²',
  'm²',
  'm³',
  'm³',
  'm³',
  't',
  't',
  't',
  't',
  '%',
  '',
]

const SECTION_LABELS: Record<'preparation' | 'cutting' | 'total' | 'stoping' | 'block', string> = {
  preparation: '采准工程',
  cutting: '切割工程',
  total: '采切合计',
  stoping: '回采工作',
  block: '盘区总计',
}

const METRIC_ROWS: Array<{ key: string; label: string; unit: string }> = [
  { key: 'preparationRatio', label: '采准比', unit: 'm/kt' },
  { key: 'preparationVolumeRatio', label: '采准体积比', unit: 'm³/kt' },
  { key: 'cuttingRatio', label: '切割比', unit: 'm/kt' },
  { key: 'cuttingVolumeRatio', label: '切割体积比', unit: 'm³/kt' },
  { key: 'cutAndFillRatio', label: '采切比', unit: 'm/kt' },
  { key: 'cutAndFillVolumeRatio', label: '采切体积比', unit: 'm³/kt' },
  { key: 'wasteRate', label: '废石率', unit: '%' },
  { key: 'byProductOreProportion', label: '副产矿石比例', unit: '%' },
  { key: 'recoveryRate', label: '回采率', unit: '%' },
  { key: 'lossRate', label: '损失率', unit: '%' },
  { key: 'dilutionRate', label: '贫化率', unit: '%' },
]

function asArrayBuffer(value: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return bytes.slice().buffer
}

function setFont(cell: Cell, kind: ExportCellKind) {
  const name = kind === 'title' ? FONT_TITLE : kind === 'numeric' || kind === 'input' ? FONT_NUMERIC : FONT_BODY
  cell.font = {
    name,
    size: kind === 'title' ? 18 : kind === 'header' ? 10 : 10,
    bold: kind === 'title' || kind === 'header',
    color: kind === 'title' ? { argb: COLOR_TITLE } : { argb: '000000' },
  }
}

function styleCell(cell: Cell, kind: ExportCellKind, options: { fill?: string; numFmt?: string } = {}) {
  setFont(cell, kind)
  cell.alignment = {
    vertical: 'middle',
    horizontal: kind === 'numeric' || kind === 'input' ? 'right' : 'left',
    wrapText: true,
  }
  cell.border = {
    top: { style: 'thin', color: { argb: COLOR_BORDER } },
    left: { style: 'thin', color: { argb: COLOR_BORDER } },
    bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
    right: { style: 'thin', color: { argb: COLOR_BORDER } },
  }
  if (options.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: options.fill } }
  if (options.numFmt) cell.numFmt = options.numFmt
}

function writeMergedLabel(sheet: Worksheet, rowNumber: number, label: string, fill = COLOR_GROUP) {
  sheet.mergeCells(rowNumber, 1, rowNumber, 18)
  const cell = sheet.getCell(rowNumber, 1)
  cell.value = label
  styleCell(cell, 'header', { fill })
  cell.font = { ...cell.font, name: FONT_BODY, bold: true }
  for (let column = 2; column <= 18; column += 1) styleCell(sheet.getCell(rowNumber, column), 'header', { fill })
}

function writeParameterSection(sheet: Worksheet, rowNumber: number, common: CommonParameters) {
  writeMergedLabel(sheet, rowNumber, '矿体参数')
  rowNumber += 1
  sheet.getRow(rowNumber).values = ['参数名称', '输入值', '单位', '数据状态']
  for (let column = 1; column <= 4; column += 1) styleCell(sheet.getCell(rowNumber, column), 'header', { fill: COLOR_GROUP })
  rowNumber += 1
  for (const parameter of parameterRows(common)) {
    const value = parameter.value
    const cellValues: Array<string | number> = [
      parameter.label,
      value == null ? '未填写' : value,
      parameter.unit,
      value == null ? '无法计算' : '已输入',
    ]
    sheet.getRow(rowNumber).values = cellValues
    styleCell(sheet.getCell(rowNumber, 1), 'body')
    styleCell(sheet.getCell(rowNumber, 2), value == null ? 'body' : 'input', {
      fill: value == null ? undefined : COLOR_INPUT,
      numFmt: value == null ? undefined : parameter.percentage ? '0.0%' : NUMBER_FORMAT,
    })
    styleCell(sheet.getCell(rowNumber, 3), 'body')
    sheet.getCell(rowNumber, 3).font = { ...sheet.getCell(rowNumber, 3).font, name: FONT_NUMERIC }
    styleCell(sheet.getCell(rowNumber, 4), 'body')
    rowNumber += 1
  }
  return rowNumber
}

function rowValues(
  input: MiningMethodInput,
  section: 'preparation' | 'cutting' | 'stoping',
  row: CalculatedRow,
): Array<string | number> {
  if (section === 'stoping') {
    return [
      row.name,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      row.oreVolume ?? '',
      row.wasteVolume ?? '',
      row.totalVolume ?? '',
      row.geologicalReserve ?? '',
      row.producedGeologicalReserve ?? '',
      row.producedOre ?? '',
      row.wasteMass ?? '',
      row.share == null ? '' : row.share / 100,
      row.note,
    ]
  }
  const development = input[section].find((item) => item.id === row.id)
  return [
    row.name,
    development?.quantity ?? '',
    development?.oreSingleLength ?? '',
    row.totalOreLength ?? '',
    development?.wasteSingleLength ?? '',
    row.totalWasteLength ?? '',
    row.totalLength ?? '',
    development?.oreSectionArea ?? '',
    development?.wasteSectionArea ?? '',
    row.oreVolume ?? '',
    row.wasteVolume ?? '',
    row.totalVolume ?? '',
    row.geologicalReserve ?? '',
    row.producedGeologicalReserve ?? '',
    row.producedOre ?? '',
    row.wasteMass ?? '',
    row.share == null ? '' : row.share / 100,
    row.note,
  ]
}

function totalValues(totals: SectionTotals): Array<string | number> {
  return [
    '合计',
    '',
    '',
    totals.totalOreLength ?? '',
    '',
    totals.totalWasteLength ?? '',
    totals.totalLength ?? '',
    '',
    '',
    totals.oreVolume ?? '',
    totals.wasteVolume ?? '',
    totals.totalVolume ?? '',
    totals.geologicalReserve ?? '',
    totals.producedGeologicalReserve ?? '',
    totals.producedOre ?? '',
    totals.wasteMass ?? '',
    '',
    '',
  ]
}

function styleResultRow(row: Row, sourceSection: 'preparation' | 'cutting' | 'stoping' | 'total') {
  for (let column = 1; column <= RESULT_HEADERS.length; column += 1) {
    const cell = row.getCell(column)
    const value = cell.value
    const numeric = typeof value === 'number'
    styleCell(cell, numeric ? 'numeric' : sourceSection === 'total' ? 'header' : 'body', {
      fill: sourceSection === 'total' ? COLOR_GROUP : undefined,
      numFmt: numeric ? (column === 17 ? PERCENT_FORMAT : NUMBER_FORMAT) : undefined,
    })
  }
}

function writeResultSection(
  sheet: Worksheet,
  rowNumber: number,
  label: string,
  rows: CalculatedRow[],
  totals: SectionTotals,
  input: MiningMethodInput,
  sourceSection: 'preparation' | 'cutting' | 'stoping',
) {
  writeMergedLabel(sheet, rowNumber, label)
  rowNumber += 1
  sheet.getRow(rowNumber).values = RESULT_HEADERS
  for (let column = 1; column <= RESULT_HEADERS.length; column += 1) styleCell(sheet.getCell(rowNumber, column), 'header', { fill: COLOR_GROUP })
  rowNumber += 1
  const unitsRow = sheet.getRow(rowNumber)
  unitsRow.values = RESULT_UNITS
  for (let column = 1; column <= RESULT_UNITS.length; column += 1) {
    styleCell(sheet.getCell(rowNumber, column), 'body')
    sheet.getCell(rowNumber, column).font = { ...sheet.getCell(rowNumber, column).font, name: FONT_NUMERIC }
  }
  rowNumber += 1
  for (const calculatedRow of rows) {
    const outputRow = sheet.getRow(rowNumber)
    outputRow.values = rowValues(input, sourceSection, calculatedRow)
    styleResultRow(outputRow, sourceSection)
    rowNumber += 1
  }
  const totalsRow = sheet.getRow(rowNumber)
  totalsRow.values = totalValues(totals)
  styleResultRow(totalsRow, 'total')
  return rowNumber + 1
}

function writeMetrics(sheet: Worksheet, rowNumber: number, result: CutAndFillResult) {
  writeMergedLabel(sheet, rowNumber, '指标汇总')
  rowNumber += 1
  sheet.getRow(rowNumber).values = ['指标', '数值', '单位', '状态']
  for (let column = 1; column <= 4; column += 1) styleCell(sheet.getCell(rowNumber, column), 'header', { fill: COLOR_GROUP })
  rowNumber += 1
  for (const metric of METRIC_ROWS) {
    const metricValue = result.metrics[metric.key]
    const value = metricValue?.value ?? null
    const isPercentage = metric.unit === '%'
    const excelValue = value == null ? null : isPercentage ? value / 100 : value
    sheet.getRow(rowNumber).values = [metric.label, excelValue ?? '无法计算', metricValue?.unit ?? metric.unit, value == null ? '无法计算' : '已计算']
    styleCell(sheet.getCell(rowNumber, 1), 'body')
    styleCell(sheet.getCell(rowNumber, 2), value == null ? 'body' : 'numeric', {
      numFmt: value == null ? undefined : isPercentage ? PERCENT_FORMAT : NUMBER_FORMAT,
    })
    styleCell(sheet.getCell(rowNumber, 3), 'body')
    styleCell(sheet.getCell(rowNumber, 4), 'body')
    rowNumber += 1
  }
  return rowNumber
}

function writeNotes(sheet: Worksheet, rowNumber: number, result: CutAndFillResult) {
  writeMergedLabel(sheet, rowNumber, '计算说明与数据状态')
  rowNumber += 1
  const notes = [
    '采准、切割工程：总长 = 数量 × 单长；体积 = 总长 × 断面。采准、切割分别按其步骤贫化率与损失率折算储量。',
    '矿块与矿柱均可按长方体、圆柱或三棱柱计算。采场体积 = 矿块 − Σ矿柱 − 采准矿石体积 − 切割矿石体积。',
    '回采工作（矿柱与采场）分别按其贫化率、损失率折算储量与采出矿量。',
    '回采伴采岩石体积计入采出废石及总体积，不扣减矿块矿石体积。各步骤总体积均为矿石体积与岩石体积之和。',
    '缺失数据或分母为零的派生值显示“无法计算”，不会写入 NaN 或 Infinity。',
  ]
  for (const note of notes) {
    sheet.mergeCells(rowNumber, 1, rowNumber, 18)
    sheet.getCell(rowNumber, 1).value = note
    styleCell(sheet.getCell(rowNumber, 1), 'body')
    rowNumber += 1
  }
  if (result.issues.length > 0) {
    sheet.mergeCells(rowNumber, 1, rowNumber, 18)
    sheet.getCell(rowNumber, 1).value = `数据状态：发现 ${result.issues.length} 项待处理问题。`
    styleCell(sheet.getCell(rowNumber, 1), 'body', { fill: 'FFF2CC' })
    rowNumber += 1
    for (const issue of result.issues) {
      sheet.mergeCells(rowNumber, 1, rowNumber, 18)
      sheet.getCell(rowNumber, 1).value = `${issue.field}：${issue.message}`
      styleCell(sheet.getCell(rowNumber, 1), 'body', { fill: 'FFF2CC' })
      rowNumber += 1
    }
  }
}

function writeHeader(sheet: Worksheet, input: MiningMethodInput) {
  sheet.mergeCells('A1:R1')
  const title = sheet.getCell('A1')
  title.value = '采切工程计算表'
  styleCell(title, 'title')
  title.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 28
  sheet.mergeCells('A2:R2')
  sheet.getCell('A2').value = '项目名称：采矿工程计算项目'
  styleCell(sheet.getCell('A2'), 'body')
  sheet.mergeCells('A3:R3')
  sheet.getCell('A3').value = `方法：${input.methodName}`
  styleCell(sheet.getCell('A3'), 'body')
  sheet.mergeCells('A4:R4')
  sheet.getCell('A4').value = `方法名称：${input.methodName}`
  styleCell(sheet.getCell('A4'), 'body')
  sheet.getCell('A4').font = { ...sheet.getCell('A4').font, name: FONT_NUMERIC }
  sheet.mergeCells('A5:R5')
  sheet.getCell('A5').value = `生成时间：${new Date().toLocaleString('zh-CN')}`
  styleCell(sheet.getCell('A5'), 'body')
}

function applySheetLayout(sheet: Worksheet) {
  const widths = [22, 11, 13, 13, 13, 13, 13, 13, 13, 14, 14, 14, 15, 16, 14, 14, 18, 24]
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1, showGridLines: false }]
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
  sheet.properties.defaultRowHeight = 18
}

/** Build the current method's workbook as an ArrayBuffer suitable for Electron or browser download. */
export async function buildCutAndFillWorkbook(input: MiningMethodInput, result: CutAndFillResult): Promise<ArrayBuffer> {
  const workbook = new Workbook()
  workbook.creator = 'CINF采矿工程计算软件'
  workbook.lastModifiedBy = 'CINF采矿工程计算软件'
  workbook.title = '采切工程计算表'
  workbook.subject = input.methodName
  workbook.description = '采矿工程采切计算结果'
  const sheet = workbook.addWorksheet(CUT_AND_FILL_WORKSHEET_NAME)
  applySheetLayout(sheet)
  writeHeader(sheet, input)

  let rowNumber = 6
  rowNumber = writeParameterSection(sheet, rowNumber, input.common) + 1
  rowNumber = writeResultSection(sheet, rowNumber, SECTION_LABELS.preparation, result.sections.preparation.rows, result.sections.preparation.totals, input, 'preparation') + 1
  rowNumber = writeResultSection(sheet, rowNumber, SECTION_LABELS.cutting, result.sections.cutting.rows, result.sections.cutting.totals, input, 'cutting') + 1
  rowNumber = writeResultSection(sheet, rowNumber, SECTION_LABELS.total, [], result.sections.developmentTotal.totals, input, 'preparation') + 1
  rowNumber = writeResultSection(sheet, rowNumber, SECTION_LABELS.stoping, result.sections.stoping.rows, result.sections.stoping.totals, input, 'stoping') + 1
  rowNumber = writeResultSection(sheet, rowNumber, SECTION_LABELS.block, [], result.sections.block.totals, input, 'preparation') + 1
  rowNumber = writeMetrics(sheet, rowNumber, result) + 1
  writeNotes(sheet, rowNumber, result)
  return asArrayBuffer(await workbook.xlsx.writeBuffer())
}

function buildFileName(input: MiningMethodInput, date = new Date()) {
  const datePart = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
    .join('-')
  return `CINF-采矿工程-采切计算-${input.methodName}-${datePart}.xlsx`
}

/** Build and save the current method's workbook through Electron or browser download. */
export async function saveCutAndFillWorkbook(input: MiningMethodInput, result: CutAndFillResult): Promise<SaveFileResult> {
  try {
    const bytes = await buildCutAndFillWorkbook(input, result)
    const saveResult = await saveFile(buildFileName(input), bytes, {
      title: '导出采切计算表',
      filters: [
        { name: 'Excel 工作簿', extensions: ['xlsx'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      mimeType: CUT_AND_FILL_FILE_MIME,
    })
    if (saveResult.ok || saveResult.cancelled) return saveResult
    return { ...saveResult, error: `导出失败：${saveResult.error ?? '无法保存文件。'}` }
  } catch (error) {
    return { ok: false, error: `导出失败：${error instanceof Error ? error.message : String(error)}` }
  }
}
