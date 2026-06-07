// Pure data — no API calls, no generation, no credits consumed.

export type LookCategory =
  | 'director-style'
  | 'film-emulation'
  | 'lut-grade'
  | 'brand-commercial'
  | 'architecture-space'
  | 'social-photography'

export const LOOK_CATEGORY_LABELS: Record<LookCategory, string> = {
  'director-style': '导演风格',
  'film-emulation': '胶片模拟',
  'lut-grade': 'LUT调色',
  'brand-commercial': '品牌商业',
  'architecture-space': '建筑空间',
  'social-photography': '社交摄影',
}

export type LookPackage = {
  id: string
  name: string
  nameZh: string
  category: LookCategory
  tags: string[]
  suitableFor: Array<'image' | 'video'>
  visualDescription: string
  contrast: 'low' | 'medium' | 'medium-high' | 'high' | 'extreme'
  saturation: 'very-low' | 'low' | 'medium' | 'medium-high' | 'high' | 'extreme'
  colorKeywords: string[]
  lightingKeywords: string[]
  textureKeywords: string[]
  paletteGradient: string // CSS gradient for swatch
  imagePromptFragment: string
  videoPromptFragment: string
  negativeConstraints: string
  pairsWithLens: string[]
  pairsWithScene: string[]
  bestFor: string
  notFor: string
  risk: string
  userExpectation: string
}

export const LOOK_PACKAGES: LookPackage[] = [
  // ── Director Styles ──────────────────────────────────────────────────
  {
    id: 'kubrick-cold',
    name: 'Kubrick Cold Symmetry',
    nameZh: '库布里克冷峻对称',
    category: 'director-style',
    tags: ['对称', '冷色', '疏离', '几何'],
    suitableFor: ['image', 'video'],
    visualDescription: '深冷蓝白色调，极致对称构图，高对比度，广角透视感强，疏离孤寂',
    contrast: 'high',
    saturation: 'very-low',
    colorKeywords: ['cold blue-white', 'desaturated steel', 'clinical white', 'deep shadow'],
    lightingKeywords: ['hard overhead light', 'institutional fluorescent', 'single-point cold key'],
    textureKeywords: ['sharp geometry', 'crisp edges', 'sterile surface'],
    paletteGradient: 'linear-gradient(135deg, #0a0e1a 0%, #1a2744 40%, #b8cce0 80%, #e8f4ff 100%)',
    imagePromptFragment: 'Kubrick-style cold symmetry, perfect bilateral symmetry, icy blue-white palette, desaturated steel tones, clinical high contrast, wide-angle one-point perspective, institutional overhead lighting, geometric precision, isolated subject in vast space, photorealistic',
    videoPromptFragment: 'Kubrick-inspired cold symmetry, slow deliberate camera movement, perfect bilateral symmetry, icy blue-white palette, desaturated, clinical overhead lighting, wide-angle one-point perspective, geometric framing, unsettling calm, cinematic',
    negativeConstraints: 'no warm colors, no handheld shake, no asymmetry, no shallow depth of field, no golden hour, no bokeh',
    pairsWithLens: ['wide angle 24mm', 'ultra-wide 18mm'],
    pairsWithScene: ['corridor', 'office', 'hospital', 'empty room', 'institutional space'],
    bestFor: '科幻、心理惊悚、品牌广告中的控制感与精密感',
    notFor: '温暖情感场景、自然风光、家庭题材',
    risk: '过度使用会导致画面过于冷硬，失去情感连接',
    userExpectation: '画面极度对称，色调冷蓝，有强烈的疏离感与几何美学',
  },
  {
    id: 'wong-kar-wai-neon',
    name: 'Wong Kar-wai Neon Nostalgia',
    nameZh: '王家卫霓虹怀旧',
    category: 'director-style',
    tags: ['霓虹', '怀旧', '运动模糊', '暖红'],
    suitableFor: ['image', 'video'],
    visualDescription: '香港霓虹色彩，暖红与青绿互补，运动模糊，浅景深，时间感流失',
    contrast: 'medium-high',
    saturation: 'high',
    colorKeywords: ['neon red', 'teal cyan', 'golden amber', 'deep shadow'],
    lightingKeywords: ['practical neon lights', 'backlit fog', 'sodium vapor glow', 'colored spill'],
    textureKeywords: ['grain film', 'motion blur', 'lens flare', 'wet surface reflection'],
    paletteGradient: 'linear-gradient(135deg, #1a0a1a 0%, #8b1a3a 35%, #1a5a6a 65%, #f5a623 100%)',
    imagePromptFragment: 'Wong Kar-wai neon nostalgia, Hong Kong neon lights, warm red and teal complementary palette, shallow depth of field, film grain, bokeh neon reflections, practical light sources, moody shadows, romantic longing, cinematic analog warmth, 35mm film look',
    videoPromptFragment: 'Wong Kar-wai inspired, Hong Kong neon atmosphere, slow shutter motion blur, warm red and teal neon palette, step-printed motion, shallow focus, film grain, practical neon practicals, dreamy temporal dislocation, romantic melancholy, cinematic',
    negativeConstraints: 'no clinical lighting, no sharp edges, no cold blue, no modern digital look, no overexposed highlights',
    pairsWithLens: ['50mm f/1.4', '85mm f/1.2', 'anamorphic'],
    pairsWithScene: ['night city', 'rainy street', 'neon signs', 'narrow alley', 'bar interior'],
    bestFor: '城市夜景、情感叙事、复古广告、音乐MV',
    notFor: '清晨自然光、科技产品广告、极简风格',
    risk: '饱和度过高时显俗气，需要在氛围与美感间平衡',
    userExpectation: '画面氤氲感强，霓虹反光，有强烈的情绪浓度与时代感',
  },

  // ── Film Emulation ───────────────────────────────────────────────────
  {
    id: 'kodak-vision3-500t',
    name: 'Kodak Vision3 500T',
    nameZh: 'Kodak Vision3 胶片模拟',
    category: 'film-emulation',
    tags: ['胶片', 'Kodak', '暖色', '颗粒'],
    suitableFor: ['image', 'video'],
    visualDescription: 'Kodak Vision3 500T电影胶片，暖橙高光，青阴影，自然颗粒感，皮肤色调优雅',
    contrast: 'medium',
    saturation: 'medium',
    colorKeywords: ['warm orange highlights', 'cyan-green shadows', 'natural skin tones', 'creamy midtones'],
    lightingKeywords: ['natural daylight', 'tungsten indoor', 'overcast soft', 'golden hour'],
    textureKeywords: ['film grain', 'organic texture', 'gentle halation', 'soft roll-off'],
    paletteGradient: 'linear-gradient(135deg, #1a2a1a 0%, #3d5a3d 30%, #c8a87a 65%, #f5d4a8 100%)',
    imagePromptFragment: 'Kodak Vision3 500T film emulation, warm orange highlights, cyan-green shadows, natural organic grain, creamy midtones, beautiful skin tone rendering, gentle highlight roll-off, analog film character, slightly underexposed look, photographic warmth',
    videoPromptFragment: 'Kodak Vision3 500T cinematic film look, organic grain structure, warm highlights shifting to teal shadows, natural motion cadence, analog film texture, beautiful skin tones, classic Hollywood color science, cinematic',
    negativeConstraints: 'no digital sharpness, no oversaturated colors, no crushed blacks, no clinical look, no HDR glow',
    pairsWithLens: ['vintage 50mm', 'anamorphic', 'super 35'],
    pairsWithScene: ['portrait', 'street', 'indoor daylight', 'interview', 'narrative drama'],
    bestFor: '叙事影片、人物访谈、时尚广告、品牌形象',
    notFor: '极简产品摄影、高科技品牌、黑白项目',
    risk: '过度颗粒会影响产品细节清晰度',
    userExpectation: '有明显的胶片质感与颗粒，色调自然温暖，有真实的电影感',
  },
  {
    id: 'fuji-velvia-landscape',
    name: 'Fuji Velvia Landscape',
    nameZh: '富士 Velvia 风光',
    category: 'film-emulation',
    tags: ['富士', '高饱和', '风光', '鲜艳'],
    suitableFor: ['image', 'video'],
    visualDescription: '富士Velvia反转片风格，极高饱和度，深邃蓝天，翠绿植被，强对比，色彩宝石质感',
    contrast: 'high',
    saturation: 'extreme',
    colorKeywords: ['vivid blue sky', 'emerald green', 'rich red', 'golden yellow', 'deep black'],
    lightingKeywords: ['hard sunlight', 'polarized sky', 'sidelit', 'magic hour'],
    textureKeywords: ['razor sharp', 'fine grain', 'jewel-like', 'hyper-real texture'],
    paletteGradient: 'linear-gradient(135deg, #0a2a50 0%, #1a6a2a 35%, #c8a000 65%, #d42020 100%)',
    imagePromptFragment: 'Fuji Velvia slide film, hyper-saturated landscape colors, deep vivid blue sky, emerald green foliage, intense contrast, razor-sharp detail, jewel-like color saturation, polarized sky effect, warm shadows with cool highlights, hyper-real natural colors',
    videoPromptFragment: 'Fuji Velvia-inspired color grade, hyper-saturated landscape palette, vivid emerald greens and deep blue sky, intense contrast ratio, polarized light quality, rich saturated tones, cinematic landscape cinematography',
    negativeConstraints: 'no muted tones, no low contrast, no flat color, no overcast flat light, no desaturation',
    pairsWithLens: ['wide angle', 'ultra wide', 'polarizer'],
    pairsWithScene: ['mountain', 'forest', 'coastline', 'flower field', 'desert', 'natural landscape'],
    bestFor: '风光摄影、户外品牌、旅游广告、自然纪录片',
    notFor: '人物肖像（肤色失真）、暗调故事、都市题材',
    risk: '人物肤色在极高饱和度下会显得不自然',
    userExpectation: '色彩极度鲜艳，自然场景如宝石般通透，对比度强',
  },

  // ── LUT Grade ────────────────────────────────────────────────────────
  {
    id: 'teal-and-orange',
    name: 'Teal & Orange Hollywood',
    nameZh: '青橙好莱坞',
    category: 'lut-grade',
    tags: ['青橙', '好莱坞', '商业', '肤色'],
    suitableFor: ['image', 'video'],
    visualDescription: '经典好莱坞青橙分色，暖肤色高光，冷青阴影，高对比，商业大片感',
    contrast: 'medium-high',
    saturation: 'medium-high',
    colorKeywords: ['teal shadows', 'orange skin tones', 'warm highlights', 'complementary split'],
    lightingKeywords: ['three-point lighting', 'rim light', 'key and fill', 'motivated light'],
    textureKeywords: ['clean sharp', 'commercial finish', 'smooth gradation'],
    paletteGradient: 'linear-gradient(135deg, #0a3040 0%, #1a5a6a 40%, #c87a30 70%, #f5a050 100%)',
    imagePromptFragment: 'teal and orange Hollywood color grade, warm orange skin tones, cool teal shadows, complementary color split, commercial film look, high contrast, clean sharp image, professional color grading, cinematic blockbuster aesthetics',
    videoPromptFragment: 'teal and orange Hollywood blockbuster grade, complementary color palette with orange highlights and teal shadows, commercial cinematography, high production value, clean professional look, cinematic',
    negativeConstraints: 'no green tones in skin, no flat contrast, no vintage film grain, no monochrome',
    pairsWithLens: ['85mm portrait', '35mm standard', 'anamorphic'],
    pairsWithScene: ['action', 'thriller', 'commercial', 'fashion', 'portrait'],
    bestFor: '商业广告、动作片、时尚大片、主流商业内容',
    notFor: '文艺片、纪录片、极简白色调设计',
    risk: '过度使用让画面显得公式化，缺乏个性',
    userExpectation: '肤色暖橙，阴影冷青，标准好莱坞商业质感',
  },
  {
    id: 'matte-faded-indie',
    name: 'Matte Faded Indie',
    nameZh: '褪色独立电影',
    category: 'lut-grade',
    tags: ['褪色', '独立', 'Matte', '胶片'],
    suitableFor: ['image', 'video'],
    visualDescription: '提亮暗部降低对比，褪色Matte感，微绿阴影，奶白色调，文艺低调',
    contrast: 'low',
    saturation: 'low',
    colorKeywords: ['lifted blacks', 'milky whites', 'faded greens', 'muted warm midtones'],
    lightingKeywords: ['soft diffuse', 'overcast natural', 'bounced light', 'window light'],
    textureKeywords: ['soft edges', 'gentle grain', 'vintage halation', 'low micro-contrast'],
    paletteGradient: 'linear-gradient(135deg, #2a3020 0%, #6a7a5a 35%, #c8c0a0 65%, #e8e0d0 100%)',
    imagePromptFragment: 'matte faded indie film look, lifted blacks with milky shadow tones, low contrast, desaturated muted palette, slight green tint in shadows, faded vintage aesthetic, soft halation, film-like tonal compression, indie cinema color grading',
    videoPromptFragment: 'indie film matte color grade, lifted blacks, low contrast faded look, muted desaturated tones, milky white highlights, vintage film compression, soft light quality, contemplative pacing, indie cinema feel',
    negativeConstraints: 'no crushed blacks, no high saturation, no sharp contrast, no commercial gloss, no vivid colors',
    pairsWithLens: ['35mm f/2', '50mm f/2', 'vintage glass'],
    pairsWithScene: ['bedroom', 'quiet street', 'cafe', 'park', 'everyday life'],
    bestFor: '文艺短片、生活方式内容、音乐MV、indie品牌',
    notFor: '商业大片、产品广告、动作场景',
    risk: '画面可能显得模糊暗淡，细节损失',
    userExpectation: '低对比度，颜色褪化，有悠然慵懒的文艺气质',
  },

  // ── Brand Commercial ─────────────────────────────────────────────────
  {
    id: 'apple-clean-white',
    name: 'Apple Clean White',
    nameZh: '苹果极简白',
    category: 'brand-commercial',
    tags: ['极简', '白', '产品', '科技'],
    suitableFor: ['image', 'video'],
    visualDescription: '高调纯白，极简留白，柔光漫射，精密产品细节，冷中性色调',
    contrast: 'low',
    saturation: 'very-low',
    colorKeywords: ['pure white', 'light gray', 'cool neutral', 'slight silver'],
    lightingKeywords: ['large soft box', 'diffused wrap light', 'white infinity cove', 'no shadow'],
    textureKeywords: ['ultra sharp detail', 'clean surface', 'premium finish', 'no noise'],
    paletteGradient: 'linear-gradient(135deg, #d0d8e0 0%, #e8eef5 40%, #f5f8ff 70%, #ffffff 100%)',
    imagePromptFragment: 'Apple-inspired clean white minimalist product photography, pure white high-key lighting, soft diffused wrap light, minimal shadows, precise product detail, cool neutral tones, premium material texture, infinite white background, ultra-sharp focus, commercial product photography',
    videoPromptFragment: 'Apple-style clean white minimalist commercial, high-key diffused lighting, pure white atmosphere, precise product reveal, cool neutral color palette, smooth deliberate motion, premium commercial production quality',
    negativeConstraints: 'no warm tones, no grain, no shadows, no clutter, no low key, no dramatic contrast, no color cast',
    pairsWithLens: ['100mm macro', '85mm f/1.8', 'tilt-shift'],
    pairsWithScene: ['studio', 'product table', 'white infinity cove', 'minimal interior'],
    bestFor: '科技产品、家电、App广告、B2B品牌',
    notFor: '情感叙事、户外场景、文艺风格',
    risk: '过白会导致产品细节丢失',
    userExpectation: '画面极度干净，背景纯白，产品细节清晰精密，有苹果广告的高级感',
  },
  {
    id: 'luxury-dark-gold',
    name: 'Luxury Dark Gold',
    nameZh: '奢华暗金',
    category: 'brand-commercial',
    tags: ['奢华', '黑金', '高端', '品牌'],
    suitableFor: ['image', 'video'],
    visualDescription: '深黑底色，金色强调，低调奢华，精致光斑，高端珠宝/香水广告感',
    contrast: 'extreme',
    saturation: 'medium',
    colorKeywords: ['deep black', 'warm gold', 'champagne highlight', 'dark chocolate'],
    lightingKeywords: ['narrow rim light', 'motivated golden accent', 'dark background fill', 'specular highlight'],
    textureKeywords: ['polished surface', 'metallic sheen', 'velvet texture', 'precision detail'],
    paletteGradient: 'linear-gradient(135deg, #0a0806 0%, #3a2a10 35%, #8a6a20 65%, #d4a840 100%)',
    imagePromptFragment: 'luxury dark gold brand aesthetic, deep black background, warm gold accent lighting, narrow rim highlight on subject, champagne specular highlight, dark low-key dramatic lighting, polished metallic surface, high-end jewelry and perfume advertisement quality, precise shadow control',
    videoPromptFragment: 'luxury dark gold brand film, deep black atmospheric background, golden accent light, subtle product reveal in darkness, warm gold highlights, high-end commercial production, cinematic slow motion, premium brand feel',
    negativeConstraints: 'no bright backgrounds, no cool tones, no flat lighting, no casual feel, no color noise',
    pairsWithLens: ['100mm macro', 'anamorphic', '85mm'],
    pairsWithScene: ['dark studio', 'velvet surface', 'black marble', 'product close-up'],
    bestFor: '珠宝、香水、奢侈品、高端手表、顶级酒庄',
    notFor: '大众消费品、科技产品、活泼年轻品牌',
    risk: '对比度过极容易细节全黑，产品特征消失',
    userExpectation: '黑底金光，极强戏剧感，有奢侈品大牌广告的高级质感',
  },

  // ── Architecture & Space ─────────────────────────────────────────────
  {
    id: 'nordic-concrete',
    name: 'Nordic Concrete Minimal',
    nameZh: '北欧混凝土极简',
    category: 'architecture-space',
    tags: ['北欧', '混凝土', '极简', '灰调'],
    suitableFor: ['image', 'video'],
    visualDescription: '冷灰混凝土质感，散射自然光，高调但冷静，简洁线条，Zumthor质感',
    contrast: 'medium',
    saturation: 'very-low',
    colorKeywords: ['warm gray', 'cool concrete', 'white diffuse', 'muted earth'],
    lightingKeywords: ['north window light', 'soft overcast', 'indirect natural', 'no hard shadow'],
    textureKeywords: ['raw concrete texture', 'smooth plaster', 'rough stone', 'linear grain'],
    paletteGradient: 'linear-gradient(135deg, #2a2a2a 0%, #6a6a6a 35%, #b0b0a8 65%, #e0ddd8 100%)',
    imagePromptFragment: 'Nordic minimalist concrete architecture, warm gray concrete texture, soft diffused north light, quiet contemplative atmosphere, Zumthor-inspired material honesty, clean geometric lines, muted earth tones, architectural photography, no decoration, raw material beauty',
    videoPromptFragment: 'Nordic concrete minimalist architectural film, soft gray palette, diffused natural light through high windows, slow deliberate camera movement, raw material textures, austere geometric space, contemplative silence, architectural documentary style',
    negativeConstraints: 'no warm colors, no decoration, no plants, no busy patterns, no dramatic shadow, no saturation',
    pairsWithLens: ['24mm tilt-shift', 'wide angle', '35mm'],
    pairsWithScene: ['concrete interior', 'museum', 'minimalist home', 'gallery', 'chapel'],
    bestFor: '建筑摄影、室内设计、北欧品牌、高端地产',
    notFor: '温暖家庭场景、彩色装饰空间、商业零售',
    risk: '过灰会让画面显得阴沉沉闷',
    userExpectation: '灰色基调，混凝土质感，冷静简洁，有北欧建筑大师的禅意',
  },

  // ── Social Photography ───────────────────────────────────────────────
  {
    id: 'golden-hour-lifestyle',
    name: 'Golden Hour Lifestyle',
    nameZh: '黄金时刻生活流',
    category: 'social-photography',
    tags: ['黄金时刻', '暖调', '户外', '生活'],
    suitableFor: ['image', 'video'],
    visualDescription: '日落前后黄金一小时，暖橙逆光，眩光效果，自然晕染，放松生活感',
    contrast: 'medium-high',
    saturation: 'medium-high',
    colorKeywords: ['golden orange', 'warm amber', 'soft pink sky', 'shadow purple'],
    lightingKeywords: ['backlit golden hour', 'lens flare', 'rim light', 'warm fill'],
    textureKeywords: ['soft bokeh', 'natural lens flare', 'warm halation', 'air haze'],
    paletteGradient: 'linear-gradient(135deg, #3a1a30 0%, #c85a10 40%, #f5a030 70%, #ffd580 100%)',
    imagePromptFragment: 'golden hour lifestyle photography, warm orange backlight, natural lens flare, soft bokeh background, amber and golden tones, shadow with purple undertones, warm atmospheric haze, relaxed candid lifestyle feel, romantic natural light, social media lifestyle aesthetic',
    videoPromptFragment: 'golden hour lifestyle film, warm backlit glow, natural lens flares, golden amber atmosphere, organic natural motion, soft shallow focus, lifestyle documentary feel, warm and romantic tone, social lifestyle content',
    negativeConstraints: 'no cold tones, no harsh shadows, no studio lighting, no flat midday light, no artificial look',
    pairsWithLens: ['85mm f/1.4', '50mm f/1.8', 'vintage glass'],
    pairsWithScene: ['beach', 'park', 'rooftop', 'outdoor cafe', 'countryside', 'golden field'],
    bestFor: '社交媒体内容、生活方式品牌、旅游博主、户外品牌',
    notFor: '室内产品摄影、科技品牌、黑暗故事',
    risk: '眩光过度会影响主体清晰度',
    userExpectation: '金色暖光，有眩光光晕，画面温暖浪漫，是IG生活方式摄影的经典质感',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────

export function getLookPackages(): LookPackage[] {
  return LOOK_PACKAGES
}

export function getLookPackageById(id: string): LookPackage | undefined {
  return LOOK_PACKAGES.find((p) => p.id === id)
}

export function filterLookPackages(
  packages: LookPackage[],
  category: LookCategory | 'all',
  suitableFor?: 'image' | 'video',
): LookPackage[] {
  return packages.filter((p) => {
    if (category !== 'all' && p.category !== category) return false
    if (suitableFor && !p.suitableFor.includes(suitableFor)) return false
    return true
  })
}

const SUBJECT_PRESERVATION_BLOCK = `[Preserve Original Subject / Asset]
Keep the original subject, character identity, face, clothing, product shape, object design, composition, camera angle, pose, scene layout, and all important visual details unchanged. Do not replace the person, do not invent a new character, do not change the main asset, do not alter the core composition.`

const APPLY_LOOK_STRONGLY = `[Apply Visual Look Strongly]
Apply this look's color grade, lighting mood, film texture, contrast, saturation, black levels, highlight roll-off, color palette, and cinematic atmosphere strongly and visibly. The visual style change must be prominent and clearly recognizable.`

const SUBJECT_NEGATIVE_CONSTRAINTS = 'no subject replacement, no new character, no face change, no clothing change, no product redesign, no scene rewrite, no composition change, no plastic AI texture'

export function buildLookAppendText(look: LookPackage, nodeKind: 'text' | 'image' | 'video'): string {
  const fragment = nodeKind === 'video' ? look.videoPromptFragment : look.imagePromptFragment
  if (nodeKind === 'text') {
    return `[Look Package - ${look.name}]\n${fragment}\n\n[Look Negative Constraints]\n${look.negativeConstraints}`
  }
  const combinedNegative = `${SUBJECT_NEGATIVE_CONSTRAINTS}, ${look.negativeConstraints}`
  return [
    `[Look Package - ${look.name}]`,
    SUBJECT_PRESERVATION_BLOCK,
    '',
    APPLY_LOOK_STRONGLY,
    '',
    `[Look Details]`,
    fragment,
    '',
    `[Look Negative Constraints]`,
    combinedNegative,
  ].join('\n')
}

export function hasSimilarLook(prompt: string, look: LookPackage): boolean {
  const sample = look.imagePromptFragment.trim().slice(0, 40).toLowerCase()
  if (!sample) return false
  return prompt.toLowerCase().includes(sample)
}

export interface LookApplyTarget {
  nodeId: string
  title: string
  kind: 'text' | 'image' | 'video'
  currentPrompt: string
  previewPrompt: string
  alreadyContains: boolean
  status: string
}

export function previewLookApply(
  nodes: Array<{
    id: string
    kind: string
    title?: string | null
    prompt?: string | null
    resultText?: string | null
    status?: string | null
  }>,
  selectedNodeIds: Set<string>,
  look: LookPackage,
): LookApplyTarget[] {
  const results: LookApplyTarget[] = []

  for (const node of nodes) {
    if (!selectedNodeIds.has(node.id)) continue
    const kind = node.kind as 'text' | 'image' | 'video'
    if (kind !== 'text' && kind !== 'image' && kind !== 'video') continue

    const currentPrompt = (node.prompt ?? node.resultText ?? '').trim()
    const already = hasSimilarLook(currentPrompt, look)
    const appendBlock = buildLookAppendText(look, kind)

    let previewPrompt: string
    if (already) {
      previewPrompt = currentPrompt
    } else if (currentPrompt) {
      previewPrompt = currentPrompt + '\n' + appendBlock
    } else {
      previewPrompt = appendBlock
    }

    results.push({
      nodeId: node.id,
      title: node.title ?? node.id,
      kind,
      currentPrompt,
      previewPrompt,
      alreadyContains: already,
      status: node.status ?? 'idle',
    })
  }

  return results
}

export function buildLookApplyReportText(look: LookPackage, targets: LookApplyTarget[]): string {
  const updated = targets.filter((t) => !t.alreadyContains)
  const skipped = targets.filter((t) => t.alreadyContains)

  const lines = [
    '=== 视觉风格包应用报告 — Creator City ===',
    `风格包：${look.nameZh}（${look.name}）`,
    `分类：${LOOK_CATEGORY_LABELS[look.category]}`,
    `标签：${look.tags.join('、')}`,
    '',
    `已更新节点（${updated.length}个）：`,
  ]
  for (const t of updated) {
    lines.push(`  [${t.kind.toUpperCase()}] ${t.title}`)
  }
  if (skipped.length > 0) {
    lines.push('', `跳过节点（${skipped.length}个，已存在类似片段）：`)
    for (const t of skipped) {
      lines.push(`  [${t.kind.toUpperCase()}] ${t.title}`)
    }
  }
  lines.push(
    '',
    '安全边界：',
    '  - 只追加，不替换',
    '  - 不覆盖原 prompt',
    '  - 不自动生成',
    '  - 不消耗 credits',
    '  - 不新增 API',
    '',
    '备注：本报告由 Creator City Look Package Applier 生成。',
  )
  return lines.join('\n')
}
