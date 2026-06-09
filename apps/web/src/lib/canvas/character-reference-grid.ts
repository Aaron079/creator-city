export type CharacterReferenceMode = 'turnaround4' | 'grid5'

export type CharacterReferenceStyle =
  | 'film-character-design'
  | 'animation-model-sheet'
  | 'realistic-reference'
  | 'game-character-design'
  | 'fashion-styling'

export type CharacterReferenceLayout =
  | 'clean-white'
  | 'neutral-gray'
  | 'design-grid'
  | 'cinematic-concept-board'

export interface CharacterReferenceOptions {
  mode: CharacterReferenceMode
  sourcePrompt: string
  style: CharacterReferenceStyle
  layout: CharacterReferenceLayout
  keepFace: boolean
  keepHair: boolean
  keepOutfit: boolean
  keepBody: boolean
  keepColorScheme: boolean
}

export interface CharacterReferencePromptItem {
  key: string
  label: string
  titleSuffix: string
  prompt: string
  mode: CharacterReferenceMode
}

export const STYLE_LABELS: Record<CharacterReferenceStyle, string> = {
  'film-character-design': '影视角色设计稿',
  'animation-model-sheet': '动画角色设定',
  'realistic-reference': '写实人物参考',
  'game-character-design': '游戏角色设定',
  'fashion-styling': '时尚造型参考',
}

export const LAYOUT_LABELS: Record<CharacterReferenceLayout, string> = {
  'clean-white': '干净白底',
  'neutral-gray': '中性灰背景',
  'design-grid': '设计稿网格',
  'cinematic-concept-board': '电影概念设定板',
}

const NEGATIVE_CONSTRAINTS =
  'no different character, no inconsistent face, no changed hairstyle, no different outfit, ' +
  'no random accessories, no age change, no face drift, no body proportion drift, ' +
  'no cropped body, no partial body, no background clutter, no extra limbs, no deformed anatomy'

function buildConsistencyConstraints(opts: CharacterReferenceOptions): string {
  const parts: string[] = []
  if (opts.keepFace) parts.push('same facial features and face shape')
  if (opts.keepHair) parts.push('same hairstyle and hair color')
  if (opts.keepOutfit) parts.push('same outfit and costume throughout')
  if (opts.keepBody) parts.push('same body proportions and height')
  if (opts.keepColorScheme) parts.push('same overall color scheme')
  return parts.length > 0 ? parts.join(', ') : 'maintain consistent character identity'
}

function buildLayoutDescription(layout: CharacterReferenceLayout): string {
  switch (layout) {
    case 'clean-white': return 'clean white background, no scene elements, no props except character'
    case 'neutral-gray': return 'neutral mid-gray background, soft studio reference lighting'
    case 'design-grid': return 'character design sheet grid layout, thin reference grid lines, labeled panels'
    case 'cinematic-concept-board': return 'cinematic concept board style, film production reference aesthetic'
  }
}

function buildStyleDescription(style: CharacterReferenceStyle): string {
  switch (style) {
    case 'film-character-design': return 'film character design sheet, professional live-action production reference'
    case 'animation-model-sheet': return 'animation model sheet style, turnaround reference for animation pipeline'
    case 'realistic-reference': return 'realistic photographic character reference, high-fidelity human'
    case 'game-character-design': return 'game character concept art, character design for game production'
    case 'fashion-styling': return 'fashion styling editorial reference, wardrobe and character sheet'
  }
}

function buildSharedSuffix(opts: CharacterReferenceOptions): string {
  const consistency = buildConsistencyConstraints(opts)
  const style = buildStyleDescription(opts.style)
  const layout = buildLayoutDescription(opts.layout)
  return `same character identity, ${consistency}, ${style}, ${layout}, [Negative: ${NEGATIVE_CONSTRAINTS}]`
}

export function buildTurnaroundPrompts(opts: CharacterReferenceOptions): CharacterReferencePromptItem[] {
  const subject = opts.sourcePrompt.trim() || 'a character'
  const shared = buildSharedSuffix(opts)

  const views: Array<{ key: string; label: string; titleSuffix: string; viewDesc: string }> = [
    {
      key: 'front',
      label: '正面 / Front View',
      titleSuffix: '正面',
      viewDesc: 'full body, front view, facing camera directly, neutral standing pose, arms relaxed at sides, head-to-toe complete figure',
    },
    {
      key: '3quarter',
      label: '四分之三 / Three-quarter',
      titleSuffix: '四分之三',
      viewDesc: 'full body, three-quarter front view, turned slightly to the right, neutral standing pose, arms relaxed at sides, head-to-toe complete figure',
    },
    {
      key: 'side',
      label: '侧面 / Side Profile',
      titleSuffix: '侧面',
      viewDesc: 'full body, side profile view, facing right, neutral standing pose, arms relaxed at sides, head-to-toe complete figure',
    },
    {
      key: 'back',
      label: '背面 / Back View',
      titleSuffix: '背面',
      viewDesc: 'full body, back view, facing away from camera, neutral standing pose, arms relaxed at sides, head-to-toe complete figure',
    },
  ]

  return views.map(({ key, label, titleSuffix, viewDesc }) => ({
    key,
    label,
    titleSuffix,
    mode: 'turnaround4' as const,
    prompt: `${subject}, ${viewDesc}, ${shared}`,
  }))
}

export function buildGrid5Prompts(opts: CharacterReferenceOptions): CharacterReferencePromptItem[] {
  const subject = opts.sourcePrompt.trim() || 'a character'
  const shared = buildSharedSuffix(opts)

  const panels: Array<{ key: string; label: string; titleSuffix: string; panelDesc: string }> = [
    {
      key: 'full-front',
      label: '全身正面 / Full Body Front',
      titleSuffix: '全身正面',
      panelDesc: 'full body front view, complete character from head to toe, neutral standing pose, character design reference',
    },
    {
      key: 'full-3q',
      label: '全身四分之三 / Full Body 3/4',
      titleSuffix: '全身四分之三',
      panelDesc: 'full body three-quarter view, turned slightly, complete character from head to toe, character design reference',
    },
    {
      key: 'expression',
      label: '面部表情 / Expression Sheet',
      titleSuffix: '表情',
      panelDesc: 'expression sheet, same character face, neutral expression, happy expression, angry expression, surprised expression, consistent facial structure, face portrait reference',
    },
    {
      key: 'outfit',
      label: '服装细节 / Outfit Detail',
      titleSuffix: '服装细节',
      panelDesc: 'costume detail reference, close-up details of clothing, accessories, fabric texture, same outfit design, clean reference layout',
    },
    {
      key: 'action',
      label: '动作姿态 / Action Pose',
      titleSuffix: '动作姿态',
      panelDesc: 'action pose reference, same character identity, dynamic but readable pose, clear body silhouette, consistent costume and body proportions',
    },
  ]

  return panels.map(({ key, label, titleSuffix, panelDesc }) => ({
    key,
    label,
    titleSuffix,
    mode: 'grid5' as const,
    prompt: `${subject}, ${panelDesc}, ${shared}`,
  }))
}

export function buildCharacterReferencePrompts(opts: CharacterReferenceOptions): CharacterReferencePromptItem[] {
  return opts.mode === 'turnaround4' ? buildTurnaroundPrompts(opts) : buildGrid5Prompts(opts)
}

// Single composite prompt — generates one image containing all views in a grid layout.
// This is the primary function used by the reference board panel.
export function buildBoardPrompt(opts: CharacterReferenceOptions): string {
  const subject = opts.sourcePrompt.trim() || 'a character'
  const consistency = buildConsistencyConstraints(opts)
  const style = buildStyleDescription(opts.style)
  const layout = buildLayoutDescription(opts.layout)
  const shared = `same character identity, ${consistency}, ${style}, ${layout}`

  if (opts.mode === 'turnaround4') {
    return (
      `character design turnaround reference sheet, ${subject}, ` +
      `four views arranged in a 2x2 grid layout: ` +
      `[top-left] full body front view facing camera directly, ` +
      `[top-right] full body three-quarter view turned slightly right, ` +
      `[bottom-left] full body side profile view facing right, ` +
      `[bottom-right] full body back view facing away from camera, ` +
      `all four panels showing the exact same character, ${shared}, ` +
      `neutral standing pose in every view, arms relaxed at sides, head-to-toe complete figure, ` +
      `clean white background, thin panel dividers, evenly spaced, labeled reference sheet, ` +
      `[Negative: ${NEGATIVE_CONSTRAINTS}, no merged panels, no single view only, no partial figures]`
    )
  }
  return (
    `character reference grid sheet, ${subject}, ` +
    `five reference panels in a clean grid layout: ` +
    `[1-top-left] full body front view, complete character head to toe, ` +
    `[2-top-center] full body three-quarter view turned slightly, ` +
    `[3-top-right] facial expression sheet with neutral, happy, angry expressions, ` +
    `[4-bottom-left] costume and outfit detail close-up reference, ` +
    `[5-bottom-right] dynamic action pose with clear body silhouette, ` +
    `same character identity in all five panels, ${shared}, ` +
    `clean white background, grid dividers, labeled panels, reference sheet layout, ` +
    `[Negative: ${NEGATIVE_CONSTRAINTS}, no merged panels, no cropped figures]`
  )
}

// Compat wrapper — returns first item prompt only; prefer buildBoardPrompt for the panel
export function buildCharacterReferencePrompt(opts: CharacterReferenceOptions): string {
  return buildCharacterReferencePrompts(opts)[0]?.prompt ?? ''
}

export function summarizeCharacterReference(opts: CharacterReferenceOptions): string {
  const modeLabel = opts.mode === 'turnaround4' ? '人物四视图' : '人物九宫格'
  const styleLabel = STYLE_LABELS[opts.style]
  const layoutLabel = LAYOUT_LABELS[opts.layout]
  return `${modeLabel} · ${styleLabel} · ${layoutLabel}`
}
