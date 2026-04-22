import type { ProParams } from './ai/prompts'
import type { NarrativeType } from '@/store/shots.store'

export interface TemplateSequence {
  structureId: string
  name: string
  goal: string
  suggestedIntent: string
}

export interface ProjectTemplate {
  id: string
  name: string
  category: 'commercial' | 'brand' | 'product' | 'short' | 'cinematic' | 'documentary'
  description: string
  narrativeType: NarrativeType
  structure: string
  sequences: TemplateSequence[]
  recommendedStyle: string
  recommendedPacing: string
  icon: string
}

export interface TemplateShot {
  idea: string
  label: string
  intent: string
  sequenceStructureId: string
  presetParams: Partial<ProParams>
}

export interface Template {
  id: string
  name: string
  description: string
  category: 'ad' | 'film' | 'short' | 'mv'
  icon: string
  style: string
  shots: TemplateShot[]
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'commercial-ad',
    name: '商业广告',
    category: 'commercial',
    description: '标准商业四段式，从吸睛开场到明确转化。',
    narrativeType: 'commercial',
    structure: 'Hook → Problem → Solution → CTA',
    recommendedStyle: '商业广告',
    recommendedPacing: '利落、清晰、转化导向',
    icon: '📺',
    sequences: [
      { structureId: 'hook', name: 'Hook', goal: '三秒内抓住注意力，建立品牌印象。', suggestedIntent: '建立环境' },
      { structureId: 'problem', name: 'Problem', goal: '明确用户痛点或使用场景问题。', suggestedIntent: '制造冲突' },
      { structureId: 'solution', name: 'Solution', goal: '突出产品如何解决问题并带来价值。', suggestedIntent: '产品特写' },
      { structureId: 'cta', name: 'CTA', goal: '用强记忆点收尾并引导行动。', suggestedIntent: '品牌展示' },
    ],
  },
  {
    id: 'brand-story',
    name: '品牌故事',
    category: 'brand',
    description: '更重情绪与人物连接，适合品牌精神表达。',
    narrativeType: 'story',
    structure: 'Opening → Character → Resolution → Signature',
    recommendedStyle: '品牌故事',
    recommendedPacing: '温和推进、情绪渐强',
    icon: '✨',
    sequences: [
      { structureId: 'opening', name: 'Opening', goal: '建立品牌语境与情绪基调。', suggestedIntent: '建立环境' },
      { structureId: 'character', name: 'Character', goal: '让人物与品牌价值发生连接。', suggestedIntent: '强调角色' },
      { structureId: 'resolution', name: 'Resolution', goal: '把冲突与转机讲清楚。', suggestedIntent: '推进情绪' },
      { structureId: 'signature', name: 'Signature', goal: '留下品牌价值观与记忆点。', suggestedIntent: '品牌展示' },
    ],
  },
  {
    id: 'product-showcase',
    name: '产品展示',
    category: 'product',
    description: '面向功能亮点与卖点拆解的专业展示结构。',
    narrativeType: 'product',
    structure: 'Attention → Feature → Benefit → CTA',
    recommendedStyle: '商业广告',
    recommendedPacing: '稳定、精确、信息密度高',
    icon: '🧩',
    sequences: [
      { structureId: 'attention', name: 'Attention', goal: '快速建立产品类别与视觉兴趣。', suggestedIntent: '建立环境' },
      { structureId: 'feature', name: 'Feature', goal: '分段展示核心功能与细节。', suggestedIntent: '产品特写' },
      { structureId: 'benefit', name: 'Benefit', goal: '让用户看见功能带来的真实好处。', suggestedIntent: '推进情绪' },
      { structureId: 'cta', name: 'CTA', goal: '收束卖点并推动咨询或购买。', suggestedIntent: '品牌展示' },
    ],
  },
  {
    id: 'short-viral',
    name: '短视频爆款',
    category: 'short',
    description: '强钩子、快节奏、高记忆点的短视频结构。',
    narrativeType: 'commercial',
    structure: 'Hook → Escalation → Payoff → CTA',
    recommendedStyle: '短剧',
    recommendedPacing: '高强度、强变化、快切',
    icon: '⚡',
    sequences: [
      { structureId: 'hook', name: 'Hook', goal: '在第一秒制造悬念或视觉冲击。', suggestedIntent: '制造冲突' },
      { structureId: 'escalation', name: 'Escalation', goal: '不断抬高节奏与信息张力。', suggestedIntent: '推进情绪' },
      { structureId: 'payoff', name: 'Payoff', goal: '给出情绪或信息上的满足时刻。', suggestedIntent: '强调角色' },
      { structureId: 'cta', name: 'CTA', goal: '用一句话或一个动作强化传播。', suggestedIntent: '品牌展示' },
    ],
  },
  {
    id: 'cinematic-short',
    name: '电影感短片',
    category: 'cinematic',
    description: '更强调气氛、人物与镜头语言的短片结构。',
    narrativeType: 'cinematic',
    structure: 'Establish → Observe → Shift → Resolve',
    recommendedStyle: '电影感',
    recommendedPacing: '留白、层次、缓中有强点',
    icon: '🎞️',
    sequences: [
      { structureId: 'establish', name: 'Establish', goal: '建立时空与情绪氛围。', suggestedIntent: '建立环境' },
      { structureId: 'observe', name: 'Observe', goal: '让观众进入人物与细节观察。', suggestedIntent: '强调角色' },
      { structureId: 'shift', name: 'Shift', goal: '制造叙事或情绪转折。', suggestedIntent: '制造冲突' },
      { structureId: 'resolve', name: 'Resolve', goal: '在余韵中完成情绪收束。', suggestedIntent: '推进情绪' },
    ],
  },
  {
    id: 'documentary-expression',
    name: '纪录片表达',
    category: 'documentary',
    description: '更注重观察、事实感与真实人物状态。',
    narrativeType: 'story',
    structure: 'Context → Subject → Detail → Reflection',
    recommendedStyle: '纪录片',
    recommendedPacing: '克制、真实、观察式推进',
    icon: '🎤',
    sequences: [
      { structureId: 'context', name: 'Context', goal: '让观众理解空间、时间与议题。', suggestedIntent: '建立环境' },
      { structureId: 'subject', name: 'Subject', goal: '明确人物或对象的核心处境。', suggestedIntent: '强调角色' },
      { structureId: 'detail', name: 'Detail', goal: '通过细节增强真实感与说服力。', suggestedIntent: '产品特写' },
      { structureId: 'reflection', name: 'Reflection', goal: '留出思考空间并形成观点。', suggestedIntent: '推进情绪' },
    ],
  },
]

const TEMPLATE_CATEGORY_MAP: Record<ProjectTemplate['category'], Template['category']> = {
  commercial: 'ad',
  brand: 'mv',
  product: 'ad',
  short: 'short',
  cinematic: 'film',
  documentary: 'film',
}

function toDefaultPreset(sequence: TemplateSequence, template: ProjectTemplate): Partial<ProParams> {
  if (sequence.structureId === 'hook' || sequence.structureId === 'attention') {
    return { framing: 'CU', movement: 'Push In', lightingType: 'Softbox', colorLUT: 'Cinematic', focalLength: 50 }
  }
  if (sequence.structureId === 'problem' || sequence.structureId === 'shift') {
    return { framing: 'MS', movement: 'Handheld', lightingType: 'Backlight', colorLUT: 'High Contrast', focalLength: 35 }
  }
  if (sequence.structureId === 'solution' || sequence.structureId === 'feature' || sequence.structureId === 'detail') {
    return { framing: 'CU', movement: 'Static', lightingType: 'Softbox', colorLUT: 'Rec.709', focalLength: 85 }
  }
  if (template.narrativeType === 'cinematic' || template.narrativeType === 'story') {
    return { framing: 'WS', movement: 'Dolly', lightingType: 'Natural', colorLUT: 'Teal & Orange', focalLength: 35 }
  }
  return { framing: 'MS', movement: 'Static', lightingType: 'Natural', colorLUT: 'Rec.709', focalLength: 35 }
}

export const TEMPLATES: Template[] = PROJECT_TEMPLATES.map((template) => ({
  id: template.id,
  name: template.name,
  description: template.description,
  category: TEMPLATE_CATEGORY_MAP[template.category],
  icon: template.icon,
  style: template.recommendedStyle,
  shots: template.sequences.map((sequence, index) => ({
    label: `Shot ${index + 1} · ${sequence.name}`,
    idea: sequence.goal,
    intent: sequence.suggestedIntent,
    sequenceStructureId: sequence.structureId,
    presetParams: toDefaultPreset(sequence, template),
  })),
}))

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((template) => [template.id, template])) as Record<string, Template>
export const PROJECT_TEMPLATE_MAP = Object.fromEntries(PROJECT_TEMPLATES.map((template) => [template.id, template])) as Record<string, ProjectTemplate>
