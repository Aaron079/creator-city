export interface VariantPlannerInput {
  nodeKind: 'text' | 'image' | 'video'
  prompt: string
  hasAsset: boolean
  assetIntelligence?: Record<string, unknown> | null
}

export type VariantIconKey = 'sun' | 'layers' | 'zap' | 'play' | 'star' | 'arrow' | 'phone' | 'move' | 'film' | 'image'

export interface AssetVariantPlan {
  id: string
  title: string
  intent: string
  tags: string[]
  iconKey: VariantIconKey
  promptDraft: string
  recommendedNodeKind: 'image' | 'video'
  description: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function styleHint(assetIntelligence: Record<string, unknown> | null | undefined): string {
  if (!assetIntelligence) return ''
  const parts: string[] = []
  if (typeof assetIntelligence.visualStyle === 'string') parts.push(assetIntelligence.visualStyle)
  if (typeof assetIntelligence.mood === 'string') parts.push(assetIntelligence.mood)
  if (typeof assetIntelligence.cinematography === 'string') parts.push(assetIntelligence.cinematography)
  return parts.filter(Boolean).slice(0, 2).join(', ')
}

function draft(base: string, modifier: string): string {
  const b = base.trim()
  return b ? `${b}, ${modifier}` : modifier
}

// ─── image variants ───────────────────────────────────────────────────────────

function imageVariants(input: VariantPlannerInput): AssetVariantPlan[] {
  const { prompt, assetIntelligence } = input
  const style = styleHint(assetIntelligence)
  const stylePrefix = style ? `${style}, ` : ''

  return [
    {
      id: 'img-light',
      title: '同主体，不同光线',
      intent: '保留构图与主体，切换光线氛围',
      tags: ['光线变化', '图片'],
      iconKey: 'sun',
      promptDraft: draft(prompt, `${stylePrefix}golden hour lighting, warm volumetric light, cinematic glow`),
      recommendedNodeKind: 'image',
      description: '用黄金时刻打光重新演绎当前画面，保持主体和构图不变。',
    },
    {
      id: 'img-comp',
      title: '同风格，不同构图',
      intent: '换景别或取景角度，探索构图可能性',
      tags: ['构图变化', '图片'],
      iconKey: 'layers',
      promptDraft: draft(prompt, `${stylePrefix}extreme close-up, tight intimate framing, shallow depth of field`),
      recommendedNodeKind: 'image',
      description: '将景别切换为极近景，放大细节，让画面更有冲击力。',
    },
    {
      id: 'img-mood',
      title: '同角色，不同情绪',
      intent: '通过氛围词切换情绪调性',
      tags: ['情绪变化', '图片'],
      iconKey: 'zap',
      promptDraft: draft(prompt, `${stylePrefix}dramatic tension, mysterious atmosphere, intense cinematic mood`),
      recommendedNodeKind: 'image',
      description: '加入戏剧张力和神秘感，使画面情绪更强烈。',
    },
    {
      id: 'img-to-vid',
      title: '图生视频草案',
      intent: '将静帧转化为视频规划',
      tags: ['图生视频', '视频'],
      iconKey: 'play',
      promptDraft: draft(prompt, `${stylePrefix}slow cinematic camera movement, subtle motion, 5 second video clip, seamless loop`),
      recommendedNodeKind: 'video',
      description: '基于当前图片生成 5 秒视频，加入轻微镜头运动保持氛围。',
    },
    {
      id: 'img-commercial',
      title: '商业广告版',
      intent: '提升品质感，适合商业投放',
      tags: ['广告版', '商业', '图片'],
      iconKey: 'star',
      promptDraft: draft(prompt, `${stylePrefix}premium commercial photography, clean studio lighting, product-focused, professional advertising aesthetic`),
      recommendedNodeKind: 'image',
      description: '用干净的棚拍风格和专业打光重新演绎，适合品牌投放。',
    },
  ]
}

// ─── video variants ───────────────────────────────────────────────────────────

function videoVariants(input: VariantPlannerInput): AssetVariantPlan[] {
  const { prompt, assetIntelligence } = input
  const style = styleHint(assetIntelligence)
  const stylePrefix = style ? `${style}, ` : ''

  return [
    {
      id: 'vid-pace',
      title: '慢节奏电影版',
      intent: '降低节奏，增强电影质感',
      tags: ['节奏变化', '视频'],
      iconKey: 'film',
      promptDraft: draft(prompt, `${stylePrefix}slow cinematic pacing, deliberate movement, contemplative atmosphere`),
      recommendedNodeKind: 'video',
      description: '放慢节奏，让每一帧都充满质感，适合情绪向内容。',
    },
    {
      id: 'vid-move',
      title: '运镜变体',
      intent: '更换摄像机运动方式',
      tags: ['运镜变体', '视频'],
      iconKey: 'move',
      promptDraft: draft(prompt, `${stylePrefix}slow dolly push in, camera steadily advances toward subject`),
      recommendedNodeKind: 'video',
      description: '从静止机位改为慢速推镜，增加叙事感和空间纵深。',
    },
    {
      id: 'vid-cont',
      title: '续作规划',
      intent: '衔接当前镜头，规划下一镜头草案',
      tags: ['续作', '视频'],
      iconKey: 'arrow',
      promptDraft: `Continuation shot following the previous scene, matching color grade and lighting, ${prompt.trim() || 'seamless visual transition'}`,
      recommendedNodeKind: 'video',
      description: '基于当前镜头结尾规划衔接镜头，保持视觉连续性。',
    },
    {
      id: 'vid-vertical',
      title: '竖版短视频适配',
      intent: '重构为社媒竖版格式',
      tags: ['竖版', '社媒', '视频'],
      iconKey: 'phone',
      promptDraft: draft(prompt, `${stylePrefix}9:16 vertical format, mobile-optimized, social media engaging hook, dynamic pacing`),
      recommendedNodeKind: 'video',
      description: '将内容重新规划为 TikTok / 抖音竖版格式，突出前三秒钩子。',
    },
    {
      id: 'vid-ad',
      title: '广告剪辑版',
      intent: '高能量、产品突出的广告剪辑',
      tags: ['广告版', '视频'],
      iconKey: 'star',
      promptDraft: draft(prompt, `${stylePrefix}fast-paced advertising style, bold color grading, product-centric, energetic rhythm`),
      recommendedNodeKind: 'video',
      description: '加入快节奏剪辑感、强饱和度调色，适合社交投放广告。',
    },
  ]
}

// ─── text variants ────────────────────────────────────────────────────────────

function textVariants(input: VariantPlannerInput): AssetVariantPlan[] {
  const { prompt } = input
  return [
    {
      id: 'txt-keyframe',
      title: '关键画面提炼',
      intent: '提取文本核心场景生成图片',
      tags: ['图片草案', '关键帧'],
      iconKey: 'image',
      promptDraft: prompt.trim()
        ? `Cinematic key frame for: ${prompt.trim()}, dramatic composition, professional photography`
        : 'Cinematic key frame, dramatic composition, professional photography',
      recommendedNodeKind: 'image',
      description: '提取文本中最具张力的画面，转化为可生成的图片 Prompt。',
    },
    {
      id: 'txt-scene',
      title: '场景视觉化',
      intent: '将场景描述转为电影感构图',
      tags: ['场景', '图片草案'],
      iconKey: 'layers',
      promptDraft: prompt.trim()
        ? `Wide cinematic establishing shot for: ${prompt.trim()}, epic atmosphere, golden hour`
        : 'Wide cinematic establishing shot, epic atmosphere, golden hour lighting',
      recommendedNodeKind: 'image',
      description: '用广角俯瞰镜头展现场景全貌，建立空间感。',
    },
    {
      id: 'txt-character',
      title: '角色视觉化',
      intent: '将角色文字描述转为肖像图',
      tags: ['角色', '肖像', '图片草案'],
      iconKey: 'sun',
      promptDraft: prompt.trim()
        ? `Character portrait: ${prompt.trim()}, cinematic lighting, detailed face, professional photography`
        : 'Character portrait, cinematic lighting, detailed face, professional photography',
      recommendedNodeKind: 'image',
      description: '提取角色特征，生成电影感人物肖像草案。',
    },
  ]
}

// ─── main entry ───────────────────────────────────────────────────────────────

export function generateVariantPlans(input: VariantPlannerInput): AssetVariantPlan[] {
  if (input.nodeKind === 'image') return imageVariants(input)
  if (input.nodeKind === 'video') return videoVariants(input)
  return textVariants(input)
}

// ─── metadata helper ──────────────────────────────────────────────────────────

export function parseAssetIntelligence(metadataJson: unknown): Record<string, unknown> | null {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) return null
  const meta = metadataJson as Record<string, unknown>
  const ai = meta.assetIntelligence
  if (!ai || typeof ai !== 'object' || Array.isArray(ai)) return null
  return ai as Record<string, unknown>
}
