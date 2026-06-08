export type CharacterReferenceMode = 'turnaround4' | 'grid9'

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

export function buildTurnaroundPrompt(opts: CharacterReferenceOptions): string {
  const consistency = buildConsistencyConstraints(opts)
  const layout = buildLayoutDescription(opts.layout)
  const style = buildStyleDescription(opts.style)
  const subject = opts.sourcePrompt.trim() || 'a character'

  return `character design turnaround reference sheet, ${subject}, four orthographic views arranged on one sheet: front view at 0 degrees, three-quarter view at 45 degrees, side profile view at 90 degrees, back view at 180 degrees, full body visible in all four views, all views showing the same character, ${consistency}, clear spacing between views, each angle clearly readable, character design sheet layout, ${layout}, ${style}, [Character Reference Consistency] same face same hair same costume same body proportions across all four views, no perspective distortion, character centered in each panel, [Character Reference Negative Constraints] no different characters, no inconsistent facial features, no outfit changes between views, no random accessories not present in source, no identity drift between views, no scene background clutter, no cropped limbs, no partial views`
}

export function buildGrid9Prompt(opts: CharacterReferenceOptions): string {
  const consistency = buildConsistencyConstraints(opts)
  const layout = buildLayoutDescription(opts.layout)
  const style = buildStyleDescription(opts.style)
  const subject = opts.sourcePrompt.trim() || 'a character'

  return `character reference grid sheet, ${subject}, nine panels arranged in a 3x3 grid: panel 1 front face portrait (top-left), panel 2 side profile portrait (top-center), panel 3 three-quarter face portrait (top-right), panel 4 full body front view (center-left), panel 5 full body side view (center), panel 6 full body back view (center-right), panel 7 facial expression variation (bottom-left), panel 8 outfit and costume detail close-up (bottom-center), panel 9 signature action or character pose (bottom-right), same character identity in all nine panels, ${consistency}, clear 3x3 grid layout with thin dividers, each panel evenly sized, ${layout}, ${style}, [Character Reference Consistency] same face same hair same costume same body across all panels, [Character Reference Negative Constraints] no different characters, no inconsistent face, no outfit changes between panels, no identity drift, no background scene clutter, no duplicate identity drift, no merged panels, no cropped figures`
}

export function buildCharacterReferencePrompt(opts: CharacterReferenceOptions): string {
  return opts.mode === 'turnaround4' ? buildTurnaroundPrompt(opts) : buildGrid9Prompt(opts)
}

export function summarizeCharacterReference(opts: CharacterReferenceOptions): string {
  const modeLabel = opts.mode === 'turnaround4' ? '人物四视图' : '人物九宫格'
  const styleLabel = STYLE_LABELS[opts.style]
  const layoutLabel = LAYOUT_LABELS[opts.layout]
  return `${modeLabel} · ${styleLabel} · ${layoutLabel}`
}
