/**
 * Color Grade Palette — Tool 12
 * Translates DaVinci Resolve Color Page concepts into prompt-level grading instructions.
 * Prompt-only: no pixel manipulation, no API calls, no generation.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ColorGradePresetId =
  | 'none'
  | 'neutral-rec709-clean'
  | 'soft-cinematic-s-curve'
  | 'low-key-night-film'
  | 'high-key-commercial'
  | 'warm-portrait-protection'
  | 'teal-orange-classic'

export type ContrastLevel = 'low' | 'medium' | 'high'
export type PivotLevel = 'dark' | 'medium' | 'bright'
export type BlacksIntent = 'preserve-detail' | 'neutral' | 'deepen'
export type WhitesIntent = 'protect-highlights' | 'neutral' | 'brighten'
export type SaturationIntent = 'low' | 'slightly-muted' | 'neutral' | 'slightly-boosted' | 'high'
export type ColorBoostIntent = 'off' | 'subtle' | 'medium' | 'strong'
export type MidtoneDetailIntent = 'soften' | 'off' | 'subtle' | 'medium'
export type SCurveIntent =
  | 'none'
  | 'gentle-s-curve'
  | 'standard-s-curve'
  | 'steep-s-curve'
  | 'lifted-blacks-s-curve'

export type SkyIntent = 'none' | 'deepen-blue' | 'dramatic-dark' | 'airy-bright'
export type FoliageIntent = 'none' | 'reduce-green-saturation' | 'vibrant-foliage'
export type AccentIntent = 'none' | 'warm-emphasis' | 'cool-emphasis' | 'neon-emphasis'

export interface ColorGradeSetting {
  presetId: ColorGradePresetId
  contrast: ContrastLevel
  pivot: PivotLevel
  blacks: BlacksIntent
  whites: WhitesIntent
  saturation: SaturationIntent
  colorBoost: ColorBoostIntent
  midtoneDetail: MidtoneDetailIntent
  sCurve: SCurveIntent
  protectSkin: boolean
  sky: SkyIntent
  foliage: FoliageIntent
  accent: AccentIntent
  protectHighlights: boolean
  protectShadows: boolean
  accurateSkin: boolean
}

// ─── Preset metadata ──────────────────────────────────────────────────────────

export interface ColorGradePreset {
  id: ColorGradePresetId
  nameZh: string
  nameEn: string
  description: string
  accentColor: string  // CSS color for preset card accent
  setting: Omit<ColorGradeSetting, 'presetId'>
}

export const COLOR_GRADE_PRESETS: ColorGradePreset[] = [
  {
    id: 'neutral-rec709-clean',
    nameZh: '中性广播级',
    nameEn: 'Neutral Rec709 Clean',
    description: '自然准确，皮肤色调正确，适合纪录片/访谈/企业视频',
    accentColor: 'rgba(148,163,184,0.8)',
    setting: {
      contrast: 'medium',
      pivot: 'medium',
      blacks: 'preserve-detail',
      whites: 'protect-highlights',
      saturation: 'neutral',
      colorBoost: 'off',
      midtoneDetail: 'off',
      sCurve: 'gentle-s-curve',
      protectSkin: true,
      sky: 'none',
      foliage: 'none',
      accent: 'none',
      protectHighlights: true,
      protectShadows: false,
      accurateSkin: true,
    },
  },
  {
    id: 'soft-cinematic-s-curve',
    nameZh: '柔和电影感',
    nameEn: 'Soft Cinematic S-Curve',
    description: '暖高光冷阴影分色调，低饱和胶片感，适合叙事短片/MV',
    accentColor: 'rgba(251,191,36,0.7)',
    setting: {
      contrast: 'medium',
      pivot: 'medium',
      blacks: 'preserve-detail',
      whites: 'protect-highlights',
      saturation: 'slightly-muted',
      colorBoost: 'off',
      midtoneDetail: 'off',
      sCurve: 'standard-s-curve',
      protectSkin: true,
      sky: 'none',
      foliage: 'none',
      accent: 'warm-emphasis',
      protectHighlights: true,
      protectShadows: false,
      accurateSkin: false,
    },
  },
  {
    id: 'low-key-night-film',
    nameZh: '夜景低调电影',
    nameEn: 'Low Key Night Film',
    description: '深黑重对比高低饱和冷色调，适合惊悚/黑色电影/悬疑',
    accentColor: 'rgba(56,189,248,0.6)',
    setting: {
      contrast: 'high',
      pivot: 'dark',
      blacks: 'deepen',
      whites: 'neutral',
      saturation: 'low',
      colorBoost: 'off',
      midtoneDetail: 'off',
      sCurve: 'steep-s-curve',
      protectSkin: false,
      sky: 'none',
      foliage: 'none',
      accent: 'cool-emphasis',
      protectHighlights: false,
      protectShadows: false,
      accurateSkin: false,
    },
  },
  {
    id: 'high-key-commercial',
    nameZh: '高调商业广告',
    nameEn: 'High Key Commercial',
    description: '明亮开放阴影高饱和，适合美妆/科技产品/奢侈品广告',
    accentColor: 'rgba(249,168,212,0.7)',
    setting: {
      contrast: 'medium',
      pivot: 'bright',
      blacks: 'preserve-detail',
      whites: 'brighten',
      saturation: 'high',
      colorBoost: 'medium',
      midtoneDetail: 'off',
      sCurve: 'gentle-s-curve',
      protectSkin: true,
      sky: 'none',
      foliage: 'none',
      accent: 'none',
      protectHighlights: false,
      protectShadows: false,
      accurateSkin: false,
    },
  },
  {
    id: 'warm-portrait-protection',
    nameZh: '暖调人像保护',
    nameEn: 'Warm Portrait Protection',
    description: '肤色隔离保护，暖调细腻，适合人像/美妆/模特造型',
    accentColor: 'rgba(251,146,60,0.7)',
    setting: {
      contrast: 'medium',
      pivot: 'medium',
      blacks: 'preserve-detail',
      whites: 'protect-highlights',
      saturation: 'slightly-boosted',
      colorBoost: 'subtle',
      midtoneDetail: 'subtle',
      sCurve: 'gentle-s-curve',
      protectSkin: true,
      sky: 'none',
      foliage: 'none',
      accent: 'warm-emphasis',
      protectHighlights: true,
      protectShadows: false,
      accurateSkin: true,
    },
  },
  {
    id: 'teal-orange-classic',
    nameZh: '青橙好莱坞经典',
    nameEn: 'Teal & Orange Classic',
    description: '阴影青蓝高光暖橙经典分色，适合动作/商业/视觉冲击',
    accentColor: 'linear-gradient(135deg, rgba(20,184,166,0.8) 0%, rgba(251,146,60,0.8) 100%)',
    setting: {
      contrast: 'high',
      pivot: 'medium',
      blacks: 'deepen',
      whites: 'protect-highlights',
      saturation: 'slightly-boosted',
      colorBoost: 'subtle',
      midtoneDetail: 'off',
      sCurve: 'standard-s-curve',
      protectSkin: true,
      sky: 'deepen-blue',
      foliage: 'none',
      accent: 'warm-emphasis',
      protectHighlights: true,
      protectShadows: false,
      accurateSkin: false,
    },
  },
]

// ─── Default setting ──────────────────────────────────────────────────────────

export function createDefaultColorGradeSetting(): ColorGradeSetting {
  return {
    presetId: 'none',
    contrast: 'medium',
    pivot: 'medium',
    blacks: 'neutral',
    whites: 'neutral',
    saturation: 'neutral',
    colorBoost: 'off',
    midtoneDetail: 'off',
    sCurve: 'none',
    protectSkin: true,
    sky: 'none',
    foliage: 'none',
    accent: 'none',
    protectHighlights: false,
    protectShadows: false,
    accurateSkin: false,
  }
}

export function applyColorGradePreset(presetId: ColorGradePresetId): ColorGradeSetting {
  if (presetId === 'none') return createDefaultColorGradeSetting()
  const preset = COLOR_GRADE_PRESETS.find((p) => p.id === presetId)
  if (!preset) return createDefaultColorGradeSetting()
  return { presetId, ...preset.setting }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildToneIntentLines(s: ColorGradeSetting): string[] {
  const lines: string[] = []

  // Contrast
  if (s.contrast === 'high') lines.push('high dramatic contrast')
  else if (s.contrast === 'low') lines.push('low flat matte contrast')
  // 'medium' → no output

  // Blacks
  if (s.blacks === 'deepen') lines.push('deep rich blacks')
  else if (s.blacks === 'preserve-detail') lines.push('shadow detail preserved, no crushed blacks')

  // Whites
  if (s.whites === 'brighten') lines.push('bright clean white point')
  else if (s.whites === 'protect-highlights') lines.push('highlight rolloff preserved, no clipping')

  // Pivot — only output if contrast is non-medium
  if (s.contrast !== 'medium') {
    if (s.pivot === 'bright') lines.push('tonal center biased toward brighter midtones')
    else if (s.pivot === 'dark') lines.push('tonal center biased toward darker midtones')
  }

  return lines
}

function buildSaturationLines(s: ColorGradeSetting): string[] {
  const lines: string[] = []

  if (s.saturation === 'low') lines.push('heavy desaturation, muted color palette')
  else if (s.saturation === 'slightly-muted') lines.push('slightly desaturated tones')
  else if (s.saturation === 'slightly-boosted') lines.push('slightly boosted color vibrancy')
  else if (s.saturation === 'high') lines.push('vibrant saturated colors, vivid palette')
  // 'neutral' → no output

  if (s.colorBoost === 'subtle') lines.push('natural color enhancement without oversaturation')
  else if (s.colorBoost === 'medium') lines.push('rich natural color boost, vivid presence')
  else if (s.colorBoost === 'strong') lines.push('strong natural color boost, vibrant foliage and skin')

  if (s.midtoneDetail === 'soften') lines.push('smooth softened texture, beauty retouching clarity')
  else if (s.midtoneDetail === 'subtle') lines.push('subtle texture enhancement, fine skin and fabric detail')
  else if (s.midtoneDetail === 'medium') lines.push('fine texture detail, subtle fabric and skin sharpness')

  return lines
}

function buildCurveLines(s: ColorGradeSetting): string[] {
  switch (s.sCurve) {
    case 'gentle-s-curve': return ['gentle S-curve contrast, natural tonal separation']
    case 'standard-s-curve': return ['cinematic S-curve contrast, film-like tonal curve']
    case 'steep-s-curve': return ['steep dramatic contrast curve, noir tonal structure']
    case 'lifted-blacks-s-curve': return ['lifted blacks with film S-curve, analog tonal response']
    default: return []
  }
}

function buildHslLines(s: ColorGradeSetting): string[] {
  const lines: string[] = []

  if (s.protectSkin) lines.push('protect skin tones unchanged, warm accurate complexion')

  if (s.sky === 'deepen-blue') lines.push('deep saturated blue sky')
  else if (s.sky === 'dramatic-dark') lines.push('dramatic dark moody sky')
  else if (s.sky === 'airy-bright') lines.push('bright airy luminous sky')

  if (s.foliage === 'reduce-green-saturation') lines.push('reduced green saturation in foliage')
  else if (s.foliage === 'vibrant-foliage') lines.push('vibrant lush foliage')

  if (s.accent === 'warm-emphasis') lines.push('warm orange-gold tonal emphasis in highlights')
  else if (s.accent === 'cool-emphasis') lines.push('cool blue-cyan tonal emphasis in shadows')
  else if (s.accent === 'neon-emphasis') lines.push('vivid neon accent isolation against dark background')

  return lines
}

function buildOutputProtectionLines(s: ColorGradeSetting): string[] {
  const optional: string[] = []
  if (s.protectHighlights) optional.push('no blown highlights')
  if (s.protectShadows) optional.push('no crushed blacks')
  if (s.accurateSkin) optional.push('accurate skin tone reproduction')

  const base = [
    'preserve original subject, composition, and characters unchanged,',
    'adjust only color grading and tonal quality,',
    'no changes to scene content or layout',
  ]
  if (optional.length > 0) base.push(optional.join(', '))
  return base
}

export function buildColorGradePrompt(
  setting: ColorGradeSetting,
  _nodeKind: 'image' | 'video',
): string {
  const toneLines = buildToneIntentLines(setting)
  const satLines = buildSaturationLines(setting)
  const curveLines = buildCurveLines(setting)
  const hslLines = buildHslLines(setting)
  const outputLines = buildOutputProtectionLines(setting)

  const sections: string[] = ['[Color Grade Palette]']

  if (toneLines.length > 0) {
    sections.push('\n[Primary / Tone Intent]')
    sections.push(toneLines.join(', '))
  }

  if (satLines.length > 0) {
    sections.push('\n[Saturation]')
    sections.push(satLines.join(', '))
  }

  if (curveLines.length > 0) {
    sections.push('\n[Curve Intent]')
    sections.push(curveLines.join(', '))
  }

  if (hslLines.length > 0) {
    sections.push('\n[HSL Intent]')
    sections.push(hslLines.join(', '))
  }

  sections.push('\n[Output Protection]')
  sections.push(outputLines.join('\n'))

  sections.push('\n[Color Grade Negative Constraints]')
  sections.push(
    'do not alter subject identity, facial features, body proportions, or scene objects,\n' +
    'do not change lighting direction or shadow placement from original composition,\n' +
    'do not introduce new colors unrelated to the selected grade,\n' +
    'no subject replacement, no face change, no product redesign, no composition change',
  )

  return sections.join('\n')
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Returns true if the prompt already has a Color Grade Palette block. */
export function hasColorGradePrompt(prompt: string): boolean {
  return prompt.includes('[Color Grade Palette]')
}

export interface ColorGradeApplyTarget {
  id: string
  kind: string
  title?: string | null
  prompt?: string | null
}

export interface ColorGradeApplyResult {
  nodeId: string
  newPrompt: string
  skipped: boolean
  skipReason?: string
}

/** Preview what applying the grade would do to each node. */
export function previewColorGradeApply(
  nodes: ColorGradeApplyTarget[],
  selectedNodeIds: string[],
  setting: ColorGradeSetting,
): ColorGradeApplyResult[] {
  return selectedNodeIds.map((nodeId) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return { nodeId, newPrompt: '', skipped: true, skipReason: 'node not found' }

    const existing = node.prompt ?? ''

    if (hasColorGradePrompt(existing)) {
      return {
        nodeId,
        newPrompt: existing,
        skipped: true,
        skipReason: 'already-has-grade',
      }
    }

    const grade = buildColorGradePrompt(setting, (node.kind as 'image' | 'video') ?? 'image')
    const newPrompt = existing.trim()
      ? `${existing.trimEnd()}\n\n${grade}`
      : grade

    return { nodeId, newPrompt, skipped: false }
  })
}

/** Build a human-readable summary of the current setting for the copy report. */
export function summarizeColorGradeSetting(setting: ColorGradeSetting): string {
  const presetLabel = setting.presetId === 'none'
    ? '手动'
    : (COLOR_GRADE_PRESETS.find((p) => p.id === setting.presetId)?.nameZh ?? setting.presetId)

  const lines = [
    `预设：${presetLabel}`,
    `对比度：${{ low: '低', medium: '中', high: '高' }[setting.contrast]}`,
    `黑位：${{ 'preserve-detail': '保留细节', neutral: '中性', deepen: '压暗' }[setting.blacks]}`,
    `白位：${{ 'protect-highlights': '保护高光', neutral: '中性', brighten: '提亮' }[setting.whites]}`,
    `饱和度：${({ low: '低饱和', 'slightly-muted': '轻降', neutral: '中性', 'slightly-boosted': '轻升', high: '高饱和' } as Record<SaturationIntent, string>)[setting.saturation]}`,
    `曲线：${({ none: '无', 'gentle-s-curve': '轻柔 S-Curve', 'standard-s-curve': '标准 S-Curve', 'steep-s-curve': '陡峭 S-Curve', 'lifted-blacks-s-curve': 'Lifted Blacks S' } as Record<SCurveIntent, string>)[setting.sCurve]}`,
    `肤色保护：${setting.protectSkin ? '开' : '关'}`,
  ]

  return lines.join('\n')
}
