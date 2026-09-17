import { APP_NAME_EN, APP_NAME_ZH, APP_ORG_NAME_EN } from '../constants/appCopy'

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function buildAssistantWelcome(language: 'zh' | 'en'): string {
  if (language === 'en') {
    return [
      `Welcome to ${APP_NAME_EN}.`,
      '',
      `I'm the in-app assistant. I can help with:`,
      '• Opening the project overview from the sidebar and following the design stages.',
      '• Understanding parameters, editable engineering rows, and result indicators.',
      '• Exporting the current method to an Excel workbook.',
      '• Privacy/license/update hints shown in Settings.',
      '',
      'Ask your question.',
    ].join('\n')
  }
  return [
    `欢迎使用「${APP_NAME_ZH}」。`,
    '',
    '我是本软件的智能助手，可协助您：',
    '• 在项目概况中新建或选定项目，再按侧栏流程完成基础参数、产状分布和采矿方法；',
    '• 理解矿体参数、矿块结构参数、采切工程行与指标汇总；',
    '• 导出当前方法的 Excel 计算表；',
    '• 说明设置页中的许可、隐私与更新提示。',
    '',
    '请描述您的问题。',
  ].join('\n')
}

export function smartInterpretationNotReadyReply(language: 'zh' | 'en'): string {
  return language === 'en'
    ? 'For deeper wording I need the local assistant backend with an embedded GGUF model (AI installer variant). Meanwhile I can still help with navigation and Settings via rule-based replies—please ask something concrete.'
    : '更深入的长文解读需要本地后端已成功加载 GGUF 模型（请选择含 AI 资源的安装包并确认依赖就绪）。在此之前仍可通过左侧导航与设置页的规则说明为您解答——请尽量具体描述问题。'
}

export function tryRuleBasedAssistantReply(
  raw: string,
  language: 'zh' | 'en',
  catalog: { id: string; name: string; group: string }[]
): string | null {
  const q = normalize(raw)
  if (!q) return null
  const zh = language === 'zh'

  if (
    zh
      ? /长沙有色冶金设计研究院|长沙有色院|长沙院|中铝国际|中国铝业|软件.*谁做|开发单位/.test(raw)
      : new RegExp(APP_ORG_NAME_EN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(raw) ||
        /\bwho\s+(developed|built)\b|\bdeveloper\b|\borganization\b/i.test(q)
  ) {
    return zh
      ? `${APP_NAME_ZH} 由长沙有色冶金设计研究院有限公司科研创新中心、矿山事业部相关单位研发；详情见侧栏「了解我们」。`
      : `${APP_NAME_EN} is developed under Changsha Nonferrous — see sidebar About Us for organization pages.`
  }

  if (zh ? /侧栏|左边|导航|在哪|找不到|切换|采矿|采切|充填|点柱|进路|综掘/.test(raw) : /\bsidebar\b|\bnavigation\b|\bwhere\b.*\b(find|open)|\bmining\b|\bcut.?and.?fill\b|\broadheader\b/i.test(q)) {
    return zh
      ? '请按左侧项目流程推进：项目概况 → 基础参数 → 产状分布，采矿方法在产状分布下。每个矿体可计算多个方法，选定采用方法后回到产状分布；全部完成后进入生产能力。「设置」「了解我们」在侧栏底部。'
      : 'Open the sidebar project flow: Overview → Parameters → Occurrence → Mining methods. Compare methods per ore body, then adopt one in that ore-body summary.'
  }

  if (zh ? /设置|许可|更新|隐私|免责/.test(raw) : /\bsettings?\b|\blicen[cs]e\b|\bupdate\b|\bprivacy\b|\bdisclaimer\b/i.test(q)) {
    return zh
      ? '请打开侧栏底部「设置」：可切换外观与语言、查看/更新离线许可、检查更新，并阅读免责声明与隐私说明。'
      : 'Open Settings in the sidebar footer for appearance, language, offline license, updates, and legal notices.'
  }

  const hit = catalog.find((c) => q.includes(normalize(c.name)) || q.includes(normalize(c.id)))
  if (hit) {
    return zh
      ? `请从产状分布进入采矿方法，针对该矿体新建或按矿体条件查看建议方法，打开计算区填写矿块结构参数与采切工程，再选定采用方法。完成后返回产状分布。`
      : `Open Mining methods in the sidebar flow. Add methods per ore body, then Open a method. Enter remaining parameters and engineering rows, then adopt one method in the ore-body summary.`
  }

  return null
}
