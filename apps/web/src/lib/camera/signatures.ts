import type { ProjectTemplate } from '@/lib/templates'
import type { Narrative, Shot, ShotSuggestion } from '@/store/shots.store'

export interface CameraSignature {
  brand: string
  model: string
  characteristics: string[]
  bestFor: string[]
  lookTags: string[]
}

export interface LensSignature {
  brand: string
  model: string
  characteristics: string[]
  bestFor: string[]
  lookTags: string[]
}

type GearRecipe = {
  id: string
  cameraModel: string
  lensModel: string
  reasoning: string
  expectedEffect: string
  fitsSequence: string
}

export const CAMERA_SIGNATURES: CameraSignature[] = [
  { brand: 'ARRI', model: 'Alexa Mini', characteristics: ['高宽容度', '肤色自然', '电影感柔和'], bestFor: ['品牌故事', '电影感短片', '情绪叙事'], lookTags: ['organic', 'soft rolloff', 'premium'] },
  { brand: 'ARRI', model: 'Alexa 35', characteristics: ['层次丰富', '高动态范围', '现代电影感'], bestFor: ['高端商业', '复杂光比', '导演风格化表达'], lookTags: ['rich latitude', 'cinematic', 'controlled contrast'] },
  { brand: 'RED', model: 'V-RAPTOR', characteristics: ['解析力强', '锐度高', '视觉冲击感强'], bestFor: ['商业广告', '高强度动作', '快节奏视觉'], lookTags: ['crisp', 'high energy', 'clean detail'] },
  { brand: 'Sony', model: 'Venice', characteristics: ['电影工业感', '肤色稳定', '暗部表现好'], bestFor: ['品牌片', '高级商业', '电影感对话'], lookTags: ['elegant', 'controlled', 'studio-ready'] },
  { brand: 'Sony', model: 'FX3', characteristics: ['轻量机动', '低照表现强', '贴近现场'], bestFor: ['轻量纪录', '短片机动拍摄', '快速反应'], lookTags: ['nimble', 'available light', 'intimate'] },
  { brand: 'Canon', model: 'C500 Mark II', characteristics: ['肤色友好', '商业质感稳定', '色彩宽容'], bestFor: ['商业访谈', '品牌广告', '产品内容'], lookTags: ['clean skin', 'balanced', 'friendly'] },
  { brand: 'Canon', model: 'R5 C', characteristics: ['混合创作灵活', '高解析', '机动效率高'], bestFor: ['社媒广告', '轻型商业拍摄', '快节奏内容'], lookTags: ['agile', 'sharp', 'creator-ready'] },
  { brand: 'Blackmagic', model: 'URSA Mini Pro 12K', characteristics: ['解析感强', '后期空间大', '数字质感鲜明'], bestFor: ['产品广告', '多版本后期', '高细节展示'], lookTags: ['detailed', 'post-flexible', 'digital clean'] },
  { brand: 'Blackmagic', model: 'Pocket Cinema Camera 6K', characteristics: ['独立感强', '轻量电影感', '成本友好'], bestFor: ['短片', '纪录表达', '轻制作导演实验'], lookTags: ['indie', 'compact cinema', 'textured'] },
]

export const LENS_SIGNATURES: LensSignature[] = [
  { brand: 'Cooke', model: 'S4', characteristics: ['Cooke Look', '肤色柔和', '边缘过渡自然'], bestFor: ['人物叙事', '品牌故事', '情绪推进'], lookTags: ['warm', 'creamy', 'human'] },
  { brand: 'Zeiss', model: 'Supreme Prime', characteristics: ['高一致性', '通透锐利', '现代商业感'], bestFor: ['高端商业', '产品片', '精密构图'], lookTags: ['clean', 'precise', 'premium commercial'] },
  { brand: 'Leica', model: 'Summilux-C', characteristics: ['层次细腻', '高端电影感', '暗部质感好'], bestFor: ['电影感短片', '品牌大片', '高端人像'], lookTags: ['luxurious', 'velvety', 'deep contrast'] },
  { brand: 'Sigma', model: 'Cine Prime', characteristics: ['锐利稳定', '性价比高', '现代感明显'], bestFor: ['产品广告', '快速商业制作', '高解析展示'], lookTags: ['sharp', 'neutral', 'efficient'] },
  { brand: 'Canon', model: 'CN-E', characteristics: ['商业肤色友好', '轻量可控', '过渡平衡'], bestFor: ['品牌内容', '企业片', '访谈商业化表达'], lookTags: ['balanced', 'commercial clean', 'accessible'] },
  { brand: 'Angenieux', model: 'Optimo', characteristics: ['变焦语言流畅', '空间调度感强', '镜头变化自然'], bestFor: ['动态广告', '复杂走位', '导演化推拉'], lookTags: ['versatile', 'zoom language', 'fluid blocking'] },
]

const CAMERA_BY_MODEL = Object.fromEntries(CAMERA_SIGNATURES.map((item) => [item.model, item])) as Record<string, CameraSignature>
const LENS_BY_MODEL = Object.fromEntries(LENS_SIGNATURES.map((item) => [item.model, item])) as Record<string, LensSignature>

const GEAR_RECIPES: Record<string, GearRecipe[]> = {
  'commercial-ad:Hook': [
    { id: 'hook-arri-cooke', cameraModel: 'Alexa 35', lensModel: 'Cooke S4', reasoning: 'Hook 段需要高级但不生硬的第一印象，这组组合能让品牌开场更有电影级质感。', expectedEffect: '让开场更有高级品牌感，同时保留人物和产品的亲和力。', fitsSequence: '适合商业广告 Hook 的高级开场。' },
    { id: 'hook-red-zeiss', cameraModel: 'V-RAPTOR', lensModel: 'Supreme Prime', reasoning: '如果当前 Hook 更偏视觉冲击和商业锐度，这组组合会更直接。', expectedEffect: '提升冲击力和辨识度，让前三秒更抓人。', fitsSequence: '适合需要高识别度和现代商业感的 Hook。' },
  ],
  'commercial-ad:CTA': [
    { id: 'cta-canon-cne', cameraModel: 'C500 Mark II', lensModel: 'CN-E', reasoning: 'CTA 更需要清晰、可信和品牌识别，这组组合稳定且商业表达明确。', expectedEffect: '让收束更清晰，转化动作更直接。', fitsSequence: '适合商业 CTA 的清晰收尾。' },
    { id: 'cta-venice-zeiss', cameraModel: 'Venice', lensModel: 'Supreme Prime', reasoning: '如果 CTA 还承担品牌气质收尾，Venice + Zeiss 会更克制而高级。', expectedEffect: '提高品牌质感，让结尾更稳。', fitsSequence: '适合高端品牌收束。' },
  ],
  'product-showcase:Feature': [
    { id: 'feature-red-sigma', cameraModel: 'V-RAPTOR', lensModel: 'Sigma Cine Prime', reasoning: 'Feature 段落最重要的是信息清晰和细节解析，这组组合更偏产品质感呈现。', expectedEffect: '让功能细节更可感知，提升卖点说明力。', fitsSequence: '适合 Feature / Detail 段突出细节。' },
    { id: 'feature-ursa-zeiss', cameraModel: 'URSA Mini Pro 12K', lensModel: 'Supreme Prime', reasoning: '需要更高解析和后期空间时，这组组合会更稳。', expectedEffect: '让产品纹理和工艺细节更突出。', fitsSequence: '适合高细节产品展示。' },
  ],
  'cinematic-short:Establish': [
    { id: 'establish-arri-leica', cameraModel: 'Alexa Mini', lensModel: 'Summilux-C', reasoning: 'Establish 段更需要气氛和空间余韵，这组组合的呼吸感和空间层次更好。', expectedEffect: '让建立镜头更有沉浸感和电影余韵。', fitsSequence: '适合电影感 Establishing。' },
    { id: 'establish-venice-angenieux', cameraModel: 'Venice', lensModel: 'Optimo', reasoning: '如果空间调度更复杂，Venice + Optimo 会更利于慢节奏推进。', expectedEffect: '让空间建立更流动，画面更有导演感。', fitsSequence: '适合需要调度感的 Establish。' },
  ],
  'cinematic-short:Shift': [
    { id: 'shift-fx3-cooke', cameraModel: 'FX3', lensModel: 'Cooke S4', reasoning: 'Shift 段需要更贴近人物和情绪变化，轻量机身配柔和镜头能带来更亲近的转折感。', expectedEffect: '让情绪变化更直接地贴到人物身上。', fitsSequence: '适合 Emotional Shift 的贴近表达。' },
  ],
  'brand-story:Opening': [
    { id: 'opening-arri-cooke', cameraModel: 'Alexa Mini', lensModel: 'Cooke S4', reasoning: '品牌故事开头更重人和氛围，这组组合自然、柔和，适合建立信任感。', expectedEffect: '让开场更有品牌温度和人物亲近感。', fitsSequence: '适合品牌故事 Opening。' },
  ],
  'brand-story:Resolution': [
    { id: 'resolution-venice-leica', cameraModel: 'Venice', lensModel: 'Summilux-C', reasoning: 'Resolution 段需要让情绪兑现落得更稳，这组组合的层次和人物质感更适合收束。', expectedEffect: '让品牌价值的兑现更成熟、有余韵。', fitsSequence: '适合品牌故事 Resolution。' },
  ],
}

function fallbackRecipes(): GearRecipe[] {
  return [
    { id: 'default-arri-cooke', cameraModel: 'Alexa Mini', lensModel: 'Cooke S4', reasoning: '如果当前段落更偏情绪与人物，ARRI + Cooke 是更稳的电影叙事起点。', expectedEffect: '提升画面的亲和力和故事质感。', fitsSequence: '适合大多数叙事型段落。' },
    { id: 'default-red-zeiss', cameraModel: 'V-RAPTOR', lensModel: 'Supreme Prime', reasoning: '如果当前段落更偏商业和信息清晰度，这组组合会更直接。', expectedEffect: '提升商业锐度和视觉效率。', fitsSequence: '适合大多数强调信息清晰的商业段落。' },
  ]
}

export function buildCameraLensSuggestions(args: {
  shot: Shot
  narrative: Narrative | null
  projectTemplate?: ProjectTemplate
}): ShotSuggestion[] {
  const { shot, narrative, projectTemplate } = args
  const sequence = narrative?.sequences.find((item) => item.id === shot.sequenceId)
  const key = `${projectTemplate?.id ?? 'default'}:${sequence?.name ?? 'generic'}`
  const recipes = GEAR_RECIPES[key] ?? fallbackRecipes()

  return recipes.slice(0, 4).flatMap((recipe) => {
    const camera = CAMERA_BY_MODEL[recipe.cameraModel]
    const lens = LENS_BY_MODEL[recipe.lensModel]
    if (!camera || !lens) return []

    return [{
      id: `gear-${shot.id}-${recipe.id}`,
      kind: 'gear',
      shotId: shot.id,
      shotLabel: shot.label,
      title: `${camera.brand} ${camera.model} + ${lens.brand} ${lens.model}`,
      intent: shot.intent ?? sequence?.suggestedIntent ?? '建立环境',
      styleNote: `建议围绕 ${sequence?.name ?? '当前段落'} 的目标，优先匹配 ${projectTemplate?.recommendedStyle ?? shot.style} 的影像气质。`,
      reasoning: recipe.reasoning,
      fitsSequence: recipe.fitsSequence,
      expectedEffect: recipe.expectedEffect,
      characteristics: [...camera.characteristics.slice(0, 2), ...lens.characteristics.slice(0, 2)],
      bestFor: Array.from(new Set([...camera.bestFor.slice(0, 2), ...lens.bestFor.slice(0, 2)])),
      lookTags: Array.from(new Set([...camera.lookTags.slice(0, 2), ...lens.lookTags.slice(0, 2)])),
      originalShot: {
        idea: shot.idea,
        style: shot.style,
        intent: shot.intent,
        presetParams: shot.presetParams,
        cameraBrand: shot.cameraBrand,
        cameraModel: shot.cameraModel,
        lensBrand: shot.lensBrand,
        lensModel: shot.lensModel,
      },
      suggestedShot: {
        idea: shot.idea,
        style: shot.style,
        intent: shot.intent,
        presetParams: shot.presetParams,
        cameraBrand: camera.brand,
        cameraModel: camera.model,
        lensBrand: lens.brand,
        lensModel: lens.model,
      },
    }]
  })
}
