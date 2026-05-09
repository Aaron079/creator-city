import type { AnalyzeAssetIntelligenceInput, AssetIntelligence } from './types'

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern.toLowerCase()))
}

function pushUnique(target: string[] | undefined, ...values: Array<string | undefined>) {
  if (!target) return
  for (const value of values) {
    const normalized = value?.trim()
    if (!normalized || target.includes(normalized)) continue
    target.push(normalized)
  }
}

function firstString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function metadataText(metadata?: Record<string, unknown>) {
  if (!metadata) return ''
  return [
    metadata.prompt,
    metadata.compiledPrompt,
    metadata.compiledPromptPreview,
    metadata.model,
    metadata.providerId,
  ].map(firstString).filter(Boolean).join(' ')
}

function ensureCharacter(intelligence: AssetIntelligence) {
  intelligence.characters ??= []
  if (!intelligence.characters[0]) intelligence.characters[0] = {}
  return intelligence.characters[0]
}

function addTag(intelligence: AssetIntelligence, ...tags: string[]) {
  intelligence.reusableTags ??= []
  pushUnique(intelligence.reusableTags, ...tags)
}

export function analyzeAssetIntelligence(input: AnalyzeAssetIntelligenceInput): AssetIntelligence {
  const sourceText = [
    input.prompt,
    input.compiledPrompt,
    metadataText(input.metadata),
  ].filter(Boolean).join(' ')
  const text = sourceText.toLowerCase()
  const intelligence: AssetIntelligence = {
    version: '1.0.0',
    mediaType: input.mediaType,
    scene: {
      architecture: [],
      environment: [],
      weather: [],
      timeOfDay: [],
    },
    characters: [],
    cinematography: {
      shotType: [],
      lensStyle: [],
      cameraAngle: [],
      movement: [],
      composition: [],
    },
    visualStyle: {
      colorPalette: [],
      lighting: [],
      texture: [],
      realism: [],
      artStyle: [],
    },
    props: [],
    mood: [],
    keywords: [],
    reusableTags: [],
    generatedAt: new Date().toISOString(),
  }

  if (input.providerId) pushUnique(intelligence.keywords, input.providerId)

  if (includesAny(text, ['未来城市', 'future city', 'futuristic city', 'cyber city'])) {
    intelligence.scene!.location = '未来城市'
    pushUnique(intelligence.scene!.environment, 'urban', 'futuristic')
    addTag(intelligence, '未来城市')
  } else if (includesAny(text, ['城市', 'city', 'urban', '街区', '街道'])) {
    intelligence.scene!.location = '城市'
    pushUnique(intelligence.scene!.environment, 'urban')
    addTag(intelligence, '城市场景')
  }
  if (includesAny(text, ['森林', 'forest', 'jungle'])) {
    intelligence.scene!.location = intelligence.scene!.location ?? '森林'
    pushUnique(intelligence.scene!.environment, 'forest')
    addTag(intelligence, '森林')
  }
  if (includesAny(text, ['海边', '海滩', 'beach', 'ocean', 'sea'])) {
    intelligence.scene!.location = intelligence.scene!.location ?? '海边'
    pushUnique(intelligence.scene!.environment, 'coastal')
    addTag(intelligence, '海边')
  }
  if (includesAny(text, ['宫殿', '城堡', 'castle', 'palace'])) {
    pushUnique(intelligence.scene!.architecture, 'castle', 'palace')
    addTag(intelligence, '城堡建筑')
  }
  if (includesAny(text, ['高楼', '摩天楼', 'skyscraper', 'tower'])) {
    pushUnique(intelligence.scene!.architecture, 'skyscraper')
    addTag(intelligence, '高楼')
  }

  if (includesAny(text, ['雨夜'])) {
    pushUnique(intelligence.scene!.weather, 'rain')
    pushUnique(intelligence.scene!.timeOfDay, 'night')
    addTag(intelligence, '雨夜')
  } else if (includesAny(text, ['雨', 'rain', 'rainy'])) {
    pushUnique(intelligence.scene!.weather, 'rain')
    addTag(intelligence, '雨')
  }
  if (includesAny(text, ['雪', 'snow', 'snowy'])) {
    pushUnique(intelligence.scene!.weather, 'snow')
    addTag(intelligence, '雪')
  }
  if (includesAny(text, ['雾', 'fog', 'foggy', 'mist'])) {
    pushUnique(intelligence.scene!.weather, 'fog')
    addTag(intelligence, '雾')
  }
  if (includesAny(text, ['夜', 'night', '晚上', '夜晚'])) {
    pushUnique(intelligence.scene!.timeOfDay, 'night')
    addTag(intelligence, '夜景')
  }
  if (includesAny(text, ['黄昏', 'dusk', 'sunset'])) {
    pushUnique(intelligence.scene!.timeOfDay, 'dusk')
    addTag(intelligence, '黄昏')
  }
  if (includesAny(text, ['黎明', 'dawn', 'sunrise'])) {
    pushUnique(intelligence.scene!.timeOfDay, 'dawn')
    addTag(intelligence, '黎明')
  }

  if (includesAny(text, ['广角', 'wide angle', 'wide shot'])) {
    pushUnique(intelligence.cinematography!.shotType, 'wide shot')
    pushUnique(intelligence.cinematography!.lensStyle, 'wide angle')
    addTag(intelligence, '广角镜头')
  }
  if (includesAny(text, ['特写', 'close-up', 'closeup'])) {
    pushUnique(intelligence.cinematography!.shotType, 'close-up')
    addTag(intelligence, '特写')
  }
  if (includesAny(text, ['中景', 'medium shot'])) {
    pushUnique(intelligence.cinematography!.shotType, 'medium shot')
    addTag(intelligence, '中景')
  }
  if (includesAny(text, ['俯拍', '鸟瞰', 'aerial', 'bird view', "bird's-eye"])) {
    pushUnique(intelligence.cinematography!.cameraAngle, 'aerial')
    addTag(intelligence, '俯拍')
  }
  if (includesAny(text, ['仰拍', 'low angle'])) {
    pushUnique(intelligence.cinematography!.cameraAngle, 'low angle')
    addTag(intelligence, '仰拍')
  }
  if (includesAny(text, ['手持', 'handheld'])) {
    pushUnique(intelligence.cinematography!.movement, 'handheld')
    addTag(intelligence, '手持摄影')
  }
  if (includesAny(text, ['跟拍', 'tracking shot', 'dolly'])) {
    pushUnique(intelligence.cinematography!.movement, 'tracking')
    addTag(intelligence, '跟拍')
  }

  if (includesAny(text, ['霓虹', 'neon'])) {
    pushUnique(intelligence.visualStyle!.colorPalette, 'neon')
    pushUnique(intelligence.visualStyle!.lighting, 'neon light')
    addTag(intelligence, '霓虹光')
  }
  if (includesAny(text, ['赛博朋克', 'cyberpunk'])) {
    pushUnique(intelligence.visualStyle!.artStyle, 'cyberpunk')
    addTag(intelligence, '赛博朋克')
  }
  if (includesAny(text, ['电影感', 'cinematic'])) {
    pushUnique(intelligence.visualStyle!.artStyle, 'cinematic')
    addTag(intelligence, '电影感')
  }
  if (includesAny(text, ['写实', '真实', 'realistic', 'photorealistic'])) {
    pushUnique(intelligence.visualStyle!.realism, 'realistic')
    addTag(intelligence, '写实')
  }
  if (includesAny(text, ['黑白', 'noir', 'film noir'])) {
    pushUnique(intelligence.visualStyle!.colorPalette, 'noir')
    pushUnique(intelligence.visualStyle!.artStyle, 'film noir')
    addTag(intelligence, '黑色电影')
  }
  if (includesAny(text, ['动漫', 'anime'])) {
    pushUnique(intelligence.visualStyle!.artStyle, 'anime')
    addTag(intelligence, '动漫风格')
  }
  if (includesAny(text, ['水彩', 'watercolor'])) {
    pushUnique(intelligence.visualStyle!.texture, 'watercolor')
    addTag(intelligence, '水彩质感')
  }

  if (includesAny(text, ['半人半兽', '半兽', 'hybrid', 'half-human'])) {
    const character = ensureCharacter(intelligence)
    character.species = character.species ?? 'hybrid'
    addTag(intelligence, '半兽角色')
  }
  if (includesAny(text, ['马', 'horse', 'centaur'])) {
    const character = ensureCharacter(intelligence)
    character.species = includesAny(text, ['半人半兽', 'centaur']) ? 'horse-like hybrid' : (character.species ?? 'horse-like')
    addTag(intelligence, '半马角色')
  }
  if (includesAny(text, ['人物', 'human', 'person', 'man', 'woman', '人类'])) {
    const character = ensureCharacter(intelligence)
    character.species = character.species ?? 'human'
  }
  if (includesAny(text, ['女孩', 'woman', 'female'])) {
    ensureCharacter(intelligence).gender = 'female'
  }
  if (includesAny(text, ['男孩', '男人']) || /\b(man|male)\b/.test(text)) {
    ensureCharacter(intelligence).gender = 'male'
  }
  if (includesAny(text, ['儿童', '孩子', 'child', 'kid'])) {
    ensureCharacter(intelligence).ageGroup = 'child'
  }
  if (includesAny(text, ['老人', 'old man', 'elderly'])) {
    ensureCharacter(intelligence).ageGroup = 'elderly'
  }
  if (includesAny(text, ['风衣', 'coat', 'trench coat'])) {
    pushUnique(ensureCharacter(intelligence).clothing ??= [], 'coat')
    addTag(intelligence, '风衣')
  }
  if (includesAny(text, ['盔甲', 'armor'])) {
    pushUnique(ensureCharacter(intelligence).clothing ??= [], 'armor')
    addTag(intelligence, '盔甲')
  }

  if (includesAny(text, ['可爱', 'cute'])) {
    pushUnique(intelligence.mood, 'cute')
    pushUnique(ensureCharacter(intelligence).emotion ??= [], 'cute')
    addTag(intelligence, '可爱')
  }
  if (includesAny(text, ['凶猛', 'fierce', 'ferocious'])) {
    pushUnique(intelligence.mood, 'fierce')
    pushUnique(ensureCharacter(intelligence).emotion ??= [], 'fierce')
    addTag(intelligence, '凶猛')
  }
  if (includesAny(text, ['孤独', 'lonely'])) {
    pushUnique(intelligence.mood, 'lonely')
    addTag(intelligence, '孤独')
  }
  if (includesAny(text, ['神秘', 'mysterious'])) {
    pushUnique(intelligence.mood, 'mysterious')
    addTag(intelligence, '神秘')
  }
  if (includesAny(text, ['紧张', 'tense', 'suspense'])) {
    pushUnique(intelligence.mood, 'tense')
    addTag(intelligence, '紧张')
  }

  const propRules: Array<[string[], string, string]> = [
    [['伞', 'umbrella'], 'umbrella', '雨伞'],
    [['剑', 'sword'], 'sword', '剑'],
    [['枪', 'gun'], 'gun', '枪'],
    [['汽车', 'car', 'vehicle'], 'vehicle', '车辆'],
    [['相机', 'camera'], 'camera', '相机'],
    [['投影仪', 'projector'], 'projector', '投影仪'],
    [['书', 'book'], 'book', '书'],
  ]
  for (const [patterns, prop, tag] of propRules) {
    if (!includesAny(text, patterns)) continue
    pushUnique(intelligence.props, prop)
    addTag(intelligence, tag)
  }

  pushUnique(
    intelligence.keywords,
    ...(intelligence.reusableTags ?? []),
    ...(intelligence.scene?.weather ?? []),
    ...(intelligence.scene?.timeOfDay ?? []),
    ...(intelligence.visualStyle?.artStyle ?? []),
    ...(intelligence.visualStyle?.realism ?? []),
    ...(intelligence.cinematography?.shotType ?? []),
    ...(intelligence.props ?? []),
  )

  if (!intelligence.characters?.length) delete intelligence.characters
  return intelligence
}
