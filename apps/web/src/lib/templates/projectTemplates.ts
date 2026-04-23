import type { ProjectTemplate as LegacyProjectTemplate } from '../templates'
import { PROJECT_TEMPLATES as LEGACY_PROJECT_TEMPLATES } from '../templates'

export type ProjectTemplateCategory =
  | 'ad'
  | 'brand-film'
  | 'short-drama'
  | 'manga-drama'
  | 'mv'
  | 'concept-film'

export type ProjectTemplateWorkflowTab = 'canvas' | 'previs' | 'footage' | 'editor' | 'audio' | 'delivery'

export interface ProjectWorkflowTemplate {
  id: string
  name: string
  description: string
  category: ProjectTemplateCategory
  recommendedRoles: string[]
  defaultMilestones: string[]
  defaultWorkflowTabs: ProjectTemplateWorkflowTab[]
  recommendedOutputs: string[]
  riskFocus: string[]
  summary: string
  legacyTemplateId: LegacyProjectTemplate['id']
}

export interface ProjectTemplateRecommendation {
  templateId: string
  reason: string
}

export const PROJECT_WORKFLOW_TEMPLATES: ProjectWorkflowTemplate[] = [
  {
    id: 'commercial-ad',
    legacyTemplateId: 'commercial-ad',
    name: '广告片 / 商业广告',
    description: '适合转化导向、卖点明确、需要快速建立品牌记忆点的项目。',
    category: 'ad',
    recommendedRoles: ['producer', 'director', 'cinematographer', 'editor', 'sound'],
    defaultMilestones: ['Brief 确认', '分镜确认', '关键镜头生成', '粗剪完成', '声音完成', '交付包完成', '客户确认'],
    defaultWorkflowTabs: ['canvas', 'previs', 'footage', 'editor', 'audio', 'delivery'],
    recommendedOutputs: ['主广告版本', '短 cutdown', '品牌 logo end-card'],
    riskFocus: ['品牌信息不够快进入', '卖点镜头不足', 'CTA 不清晰'],
    summary: '这是最稳的商业启动结构，强调 Hook、卖点拆解与明确 CTA，适合大多数广告型项目。',
  },
  {
    id: 'brand-story',
    legacyTemplateId: 'brand-story',
    name: '品牌短片',
    description: '适合强调品牌价值观、人物情绪和长期品牌印象的项目。',
    category: 'brand-film',
    recommendedRoles: ['producer', 'director', 'cinematographer', 'editor', 'composer'],
    defaultMilestones: ['Brief 确认', '人物/品牌线索确认', '分镜确认', '关键镜头生成', '粗剪完成', '声音完成', '客户确认'],
    defaultWorkflowTabs: ['canvas', 'previs', 'footage', 'editor', 'audio', 'delivery'],
    recommendedOutputs: ['主品牌片', '情绪版 cut', '品牌故事版字幕稿'],
    riskFocus: ['情绪推进不足', '品牌价值表达太弱', '收束镜头不够有记忆点'],
    summary: '更适合从人物与情绪切入品牌表达，节奏会更留白，适合品牌故事、人物纪实感短片。',
  },
  {
    id: 'product-showcase',
    legacyTemplateId: 'product-showcase',
    name: '产品展示片',
    description: '适合功能亮点明确、需要特写密度与信息清晰度的项目。',
    category: 'ad',
    recommendedRoles: ['producer', 'director', 'cinematographer', 'editor', 'sound'],
    defaultMilestones: ['Brief 确认', '产品亮点梳理', '分镜确认', '关键镜头生成', '粗剪完成', '交付包完成', '客户确认'],
    defaultWorkflowTabs: ['canvas', 'previs', 'footage', 'editor', 'delivery'],
    recommendedOutputs: ['主产品片', '卖点拆解版', '平台适配短 cut'],
    riskFocus: ['产品卖点镜头不够聚焦', '信息层级混乱', '交付版型不完整'],
    summary: '这套模板强调功能与细节表达，适合电商、发布会、产品说明类内容。',
  },
  {
    id: 'short-viral',
    legacyTemplateId: 'short-viral',
    name: '短剧片段',
    description: '适合冲突明显、节奏较快、依赖强钩子和反转感的项目。',
    category: 'short-drama',
    recommendedRoles: ['producer', 'director', 'editor', 'sound'],
    defaultMilestones: ['Brief 确认', '剧情节拍确认', '关键场景分镜', '粗剪完成', '声音完成', '再提审'],
    defaultWorkflowTabs: ['canvas', 'previs', 'footage', 'editor', 'audio', 'delivery'],
    recommendedOutputs: ['正片片段', '钩子版 cut', '竖屏分发版'],
    riskFocus: ['前 3 秒不够抓人', '剧情 payoff 不成立', '节奏在中段掉速'],
    summary: '更适合带冲突和剧情推进的短内容，重点是钩子、反转和强节奏剪辑。',
  },
  {
    id: 'cinematic-short',
    legacyTemplateId: 'cinematic-short',
    name: '概念短片',
    description: '适合强调气氛、镜头语言、人物观察与视觉风格的项目。',
    category: 'concept-film',
    recommendedRoles: ['producer', 'director', 'cinematographer', 'editor', 'composer'],
    defaultMilestones: ['Brief 确认', '视觉风格确认', '分镜确认', '关键镜头生成', '粗剪完成', '声音完成', '客户确认'],
    defaultWorkflowTabs: ['canvas', 'previs', 'footage', 'editor', 'audio', 'delivery'],
    recommendedOutputs: ['主概念片', '情绪预告 cut', '导演版 mood reel'],
    riskFocus: ['镜头语言不统一', '情绪铺垫不足', '结尾余韵不够强'],
    summary: '这套模板更适合电影感、概念感和高氛围项目，强调镜头组织与节奏层次。',
  },
]

export const PROJECT_WORKFLOW_TEMPLATE_MAP = Object.fromEntries(
  PROJECT_WORKFLOW_TEMPLATES.map((template) => [template.id, template]),
) as Record<string, ProjectWorkflowTemplate>

export function getWorkflowTemplateByLegacyId(legacyTemplateId?: string | null) {
  if (!legacyTemplateId) return undefined
  return PROJECT_WORKFLOW_TEMPLATES.find((template) => template.legacyTemplateId === legacyTemplateId)
}

export function recommendProjectTemplate(input: {
  idea?: string
  selectedStyle?: string
}) {
  const idea = input.idea?.toLowerCase() ?? ''
  const style = input.selectedStyle?.toLowerCase() ?? ''

  if (idea.includes('品牌') || idea.includes('故事') || style.includes('品牌')) {
    return {
      templateId: 'brand-story',
      reason: '当前项目更像品牌表达和情绪叙事，品牌短片模板会更合适。',
    } satisfies ProjectTemplateRecommendation
  }

  if (idea.includes('产品') || idea.includes('功能') || idea.includes('卖点')) {
    return {
      templateId: 'product-showcase',
      reason: '当前描述更偏产品卖点与功能表达，产品展示片模板会更稳。',
    } satisfies ProjectTemplateRecommendation
  }

  if (idea.includes('剧情') || idea.includes('反转') || idea.includes('冲突') || style.includes('短剧')) {
    return {
      templateId: 'short-viral',
      reason: '当前想法更接近剧情推进和节奏驱动，短剧片段模板更贴合。',
    } satisfies ProjectTemplateRecommendation
  }

  if (idea.includes('概念') || idea.includes('氛围') || idea.includes('电影') || style.includes('电影')) {
    return {
      templateId: 'cinematic-short',
      reason: '当前项目更强调氛围和镜头语言，概念短片模板会更匹配。',
    } satisfies ProjectTemplateRecommendation
  }

  return {
    templateId: 'commercial-ad',
    reason: '如果还没有特别明确的叙事方向，先用广告片模板起步通常最稳，后面再细化。',
  } satisfies ProjectTemplateRecommendation
}

export function buildTemplateSummaryLine(template: ProjectWorkflowTemplate) {
  return `${template.name} · 推荐 ${template.recommendedRoles.join(' / ')} · 输出 ${template.recommendedOutputs.join(' / ')}`
}

export const LEGACY_TEMPLATE_IDS = new Set(LEGACY_PROJECT_TEMPLATES.map((template) => template.id))
