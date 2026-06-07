/**
 * Color Grade Palette — Tool 12
 * DaVinci Resolve Color Page concepts translated to prompt-level grading.
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

/** Primary color wheel: temperature/tint = hue bias, luminance = exposure, saturation = chroma */
export interface WheelSetting {
  temperature: number  // -100 cool → +100 warm
  tint: number         // -100 green → +100 magenta
  luminance: number    // -100 darken → +100 brighten
  saturation: number   // -100 desaturate → +100 saturate
}

export type CurveShape =
  | 'neutral'
  | 'gentle-s'
  | 'standard-s'
  | 'steep-s'
  | 'lifted-blacks'

export type RgbBias =
  | 'neutral'
  | 'warm-hi-cool-sh'
  | 'cool-hi-warm-sh'
  | 'green-sh-mag-hi'
  | 'teal-orange'

export interface CurveSetting {
  shape: CurveShape
  rgbBias: RgbBias
}

export type RangeIntent = 'cut' | 'neutral' | 'boost'
export type LumIntent = 'darken' | 'neutral' | 'brighten'

export interface QualifierSetting {
  protectSkin: boolean
  skinSat: RangeIntent
  skinLum: LumIntent
  bluesSat: RangeIntent
  bluesLum: LumIntent
  greensSat: RangeIntent
  greensLum: LumIntent
  neonAccent: boolean
}

export type GrainType = 'none' | 'fine' | 'medium' | 'heavy'
export type EffectLevel = 'none' | 'subtle' | 'strong'

export interface TextureSetting {
  sharpness: number    // -2 to +2 integer, 0 = neutral
  grain: GrainType
  halation: EffectLevel
  glow: EffectLevel
  vignette: EffectLevel
  cleanShadows: boolean
}

export interface ColorGradeSetting {
  presetId: ColorGradePresetId
  // Primary Wheels (DaVinci Lift / Gamma / Gain / Offset)
  lift: WheelSetting
  gamma: WheelSetting
  gain: WheelSetting
  offset: WheelSetting
  // Curves
  curve: CurveSetting
  // Qualifier / HSL intent
  qualifier: QualifierSetting
  // Texture
  texture: TextureSetting
}

// ─── Preset metadata ──────────────────────────────────────────────────────────

export interface ColorGradePreset {
  id: ColorGradePresetId
  nameZh: string
  nameEn: string
  accentColor: string
  setting: Omit<ColorGradeSetting, 'presetId'>
}

const NEUTRAL_WHEEL: WheelSetting = { temperature: 0, tint: 0, luminance: 0, saturation: 0 }

export const COLOR_GRADE_PRESETS: ColorGradePreset[] = [
  {
    id: 'neutral-rec709-clean',
    nameZh: '中性广播级',
    nameEn: 'Neutral Rec709 Clean',
    accentColor: 'linear-gradient(90deg, #888 0%, #ccc 100%)',
    setting: {
      lift: { ...NEUTRAL_WHEEL },
      gamma: { ...NEUTRAL_WHEEL },
      gain: { ...NEUTRAL_WHEEL },
      offset: { ...NEUTRAL_WHEEL },
      curve: { shape: 'neutral', rgbBias: 'neutral' },
      qualifier: { protectSkin: true, skinSat: 'neutral', skinLum: 'neutral', bluesSat: 'neutral', bluesLum: 'neutral', greensSat: 'neutral', greensLum: 'neutral', neonAccent: false },
      texture: { sharpness: 0, grain: 'none', halation: 'none', glow: 'none', vignette: 'none', cleanShadows: false },
    },
  },
  {
    id: 'soft-cinematic-s-curve',
    nameZh: '柔和电影感',
    nameEn: 'Soft Cinematic S-Curve',
    accentColor: 'linear-gradient(90deg, #4a3728 0%, #c8a87a 100%)',
    setting: {
      lift: { temperature: -10, tint: 0, luminance: -15, saturation: -10 },
      gamma: { temperature: 5, tint: 0, luminance: 0, saturation: 0 },
      gain: { temperature: 15, tint: 0, luminance: 10, saturation: 0 },
      offset: { temperature: 5, tint: 0, luminance: 0, saturation: -5 },
      curve: { shape: 'standard-s', rgbBias: 'warm-hi-cool-sh' },
      qualifier: { protectSkin: true, skinSat: 'neutral', skinLum: 'neutral', bluesSat: 'boost', bluesLum: 'neutral', greensSat: 'neutral', greensLum: 'neutral', neonAccent: false },
      texture: { sharpness: 0, grain: 'fine', halation: 'subtle', glow: 'none', vignette: 'subtle', cleanShadows: false },
    },
  },
  {
    id: 'low-key-night-film',
    nameZh: '夜景低调电影',
    nameEn: 'Low Key Night Film',
    accentColor: 'linear-gradient(90deg, #0a0f1e 0%, #1a2a4a 100%)',
    setting: {
      lift: { temperature: -25, tint: 0, luminance: -30, saturation: -15 },
      gamma: { temperature: -10, tint: 0, luminance: -15, saturation: 0 },
      gain: { temperature: -10, tint: 0, luminance: -5, saturation: 0 },
      offset: { temperature: -15, tint: 0, luminance: -10, saturation: -10 },
      curve: { shape: 'steep-s', rgbBias: 'neutral' },
      qualifier: { protectSkin: true, skinSat: 'neutral', skinLum: 'neutral', bluesSat: 'boost', bluesLum: 'darken', greensSat: 'cut', greensLum: 'neutral', neonAccent: false },
      texture: { sharpness: 0, grain: 'medium', halation: 'subtle', glow: 'none', vignette: 'strong', cleanShadows: true },
    },
  },
  {
    id: 'high-key-commercial',
    nameZh: '高调商业广告',
    nameEn: 'High Key Commercial',
    accentColor: 'linear-gradient(90deg, #dde8f5 0%, #ffffff 100%)',
    setting: {
      lift: { temperature: 5, tint: 0, luminance: 20, saturation: 10 },
      gamma: { temperature: 5, tint: 0, luminance: 20, saturation: 5 },
      gain: { temperature: 5, tint: 0, luminance: 15, saturation: 0 },
      offset: { temperature: 5, tint: 0, luminance: 10, saturation: 5 },
      curve: { shape: 'gentle-s', rgbBias: 'neutral' },
      qualifier: { protectSkin: true, skinSat: 'boost', skinLum: 'brighten', bluesSat: 'neutral', bluesLum: 'neutral', greensSat: 'neutral', greensLum: 'neutral', neonAccent: false },
      texture: { sharpness: 1, grain: 'none', halation: 'none', glow: 'subtle', vignette: 'none', cleanShadows: false },
    },
  },
  {
    id: 'warm-portrait-protection',
    nameZh: '暖调人像保护',
    nameEn: 'Warm Portrait Protection',
    accentColor: 'linear-gradient(90deg, #8b4513 0%, #f4a460 100%)',
    setting: {
      lift: { temperature: 15, tint: 5, luminance: 0, saturation: 0 },
      gamma: { temperature: 15, tint: 5, luminance: 5, saturation: 5 },
      gain: { temperature: 20, tint: 0, luminance: 5, saturation: 0 },
      offset: { temperature: 10, tint: 3, luminance: 0, saturation: 0 },
      curve: { shape: 'standard-s', rgbBias: 'warm-hi-cool-sh' },
      qualifier: { protectSkin: true, skinSat: 'boost', skinLum: 'neutral', bluesSat: 'neutral', bluesLum: 'neutral', greensSat: 'neutral', greensLum: 'neutral', neonAccent: false },
      texture: { sharpness: 0, grain: 'fine', halation: 'none', glow: 'subtle', vignette: 'subtle', cleanShadows: false },
    },
  },
  {
    id: 'teal-orange-classic',
    nameZh: '青橙好莱坞经典',
    nameEn: 'Teal & Orange Classic',
    accentColor: 'linear-gradient(90deg, #008080 0%, #ff6b00 100%)',
    setting: {
      lift: { temperature: -35, tint: -5, luminance: -10, saturation: 10 },
      gamma: { temperature: -5, tint: 0, luminance: 0, saturation: 5 },
      gain: { temperature: 40, tint: 5, luminance: 5, saturation: 10 },
      offset: { temperature: 0, tint: 0, luminance: 0, saturation: 5 },
      curve: { shape: 'standard-s', rgbBias: 'teal-orange' },
      qualifier: { protectSkin: true, skinSat: 'boost', skinLum: 'neutral', bluesSat: 'boost', bluesLum: 'darken', greensSat: 'cut', greensLum: 'neutral', neonAccent: false },
      texture: { sharpness: 0, grain: 'fine', halation: 'none', glow: 'none', vignette: 'subtle', cleanShadows: false },
    },
  },
]

// ─── Default setting ──────────────────────────────────────────────────────────

export function createDefaultColorGradeSetting(): ColorGradeSetting {
  return {
    presetId: 'none',
    lift: { ...NEUTRAL_WHEEL },
    gamma: { ...NEUTRAL_WHEEL },
    gain: { ...NEUTRAL_WHEEL },
    offset: { ...NEUTRAL_WHEEL },
    curve: { shape: 'neutral', rgbBias: 'neutral' },
    qualifier: {
      protectSkin: true,
      skinSat: 'neutral',
      skinLum: 'neutral',
      bluesSat: 'neutral',
      bluesLum: 'neutral',
      greensSat: 'neutral',
      greensLum: 'neutral',
      neonAccent: false,
    },
    texture: {
      sharpness: 0,
      grain: 'none',
      halation: 'none',
      glow: 'none',
      vignette: 'none',
      cleanShadows: false,
    },
  }
}

export function applyColorGradePreset(presetId: ColorGradePresetId): ColorGradeSetting {
  if (presetId === 'none') return createDefaultColorGradeSetting()
  const preset = COLOR_GRADE_PRESETS.find((p) => p.id === presetId)
  if (!preset) return createDefaultColorGradeSetting()
  return { presetId, ...preset.setting }
}

// ─── Prompt builder helpers ───────────────────────────────────────────────────

function isNeutralWheel(w: WheelSetting): boolean {
  return w.temperature === 0 && w.tint === 0 && w.luminance === 0 && w.saturation === 0
}

function describeWheel(name: string, label: string, w: WheelSetting): string[] {
  if (isNeutralWheel(w)) return []
  const parts: string[] = []
  if (w.luminance > 20) parts.push(`${label} exposure lifted`)
  else if (w.luminance > 5) parts.push(`${label} exposure slightly brightened`)
  else if (w.luminance < -20) parts.push(`${label} exposure pulled down`)
  else if (w.luminance < -5) parts.push(`${label} exposure slightly darkened`)

  if (w.temperature > 20) parts.push(`warm ${name.toLowerCase()} bias`)
  else if (w.temperature > 5) parts.push(`slightly warm ${name.toLowerCase()} cast`)
  else if (w.temperature < -20) parts.push(`cool blue ${name.toLowerCase()} bias`)
  else if (w.temperature < -5) parts.push(`slightly cool ${name.toLowerCase()} cast`)

  if (w.tint > 15) parts.push(`magenta ${name.toLowerCase()} tint`)
  else if (w.tint < -15) parts.push(`green ${name.toLowerCase()} tint offset`)

  if (w.saturation > 15) parts.push(`${name.toLowerCase()} chroma boost`)
  else if (w.saturation < -15) parts.push(`${name.toLowerCase()} chroma reduction`)
  return parts
}

function buildPrimaryWheelsSection(s: ColorGradeSetting): string {
  const liftParts = describeWheel('Lift', 'shadow', s.lift)
  const gammaParts = describeWheel('Gamma', 'midtone', s.gamma)
  const gainParts = describeWheel('Gain', 'highlight', s.gain)
  const offsetParts = describeWheel('Offset', 'global', s.offset)

  const allParts = [...liftParts, ...gammaParts, ...gainParts, ...offsetParts]
  if (allParts.length === 0) {
    return 'Neutral primary correction — balanced lift, gamma, gain, and offset. No tonal or color bias applied.'
  }

  const lines: string[] = []
  if (liftParts.length > 0) lines.push(`Lift: ${liftParts.join(', ')}`)
  if (gammaParts.length > 0) lines.push(`Gamma: ${gammaParts.join(', ')}`)
  if (gainParts.length > 0) lines.push(`Gain: ${gainParts.join(', ')}`)
  if (offsetParts.length > 0) lines.push(`Offset: ${offsetParts.join(', ')}`)
  return lines.join('\n')
}

function buildCurvesSection(s: CurveSetting): string {
  const shapeParts: string[] = []
  switch (s.shape) {
    case 'gentle-s': shapeParts.push('gentle S-curve contrast, natural tonal separation, all detail preserved'); break
    case 'standard-s': shapeParts.push('cinematic S-curve contrast, film-like tonal curve, smooth shoulder and toe'); break
    case 'steep-s': shapeParts.push('steep dramatic contrast curve, noir tonal structure, crushed blacks and clipped highs'); break
    case 'lifted-blacks': shapeParts.push('lifted blacks film curve, analog tonal response, open shadows with S-curve shoulder'); break
    default: break
  }
  const biasParts: string[] = []
  switch (s.rgbBias) {
    case 'warm-hi-cool-sh': biasParts.push('warm orange-gold highlight curve, cool blue-teal shadow curve'); break
    case 'cool-hi-warm-sh': biasParts.push('cool clean highlight curve, warm amber shadow undertone'); break
    case 'green-sh-mag-hi': biasParts.push('green-shifted shadow curve, magenta highlight bias'); break
    case 'teal-orange': biasParts.push('teal shadow curve bias, orange highlight curve bias, split-tone complementary'); break
    default: break
  }

  const all = [...shapeParts, ...biasParts]
  if (all.length === 0) return 'Neutral curve — no S-curve or RGB bias applied. Linear tonal response.'
  return all.join(', ')
}

function buildQualifierSection(s: QualifierSetting): string {
  const parts: string[] = []
  if (s.protectSkin) parts.push('protect skin tones unchanged, warm accurate complexion')
  if (s.skinSat === 'boost') parts.push('boost skin vibrancy, rich healthy complexion')
  else if (s.skinSat === 'cut') parts.push('reduce skin saturation, muted complexion')
  if (s.skinLum === 'brighten') parts.push('brighten skin midtones, clear lit complexion')
  else if (s.skinLum === 'darken') parts.push('deepen skin tones, sculpted shadow under face')

  if (s.bluesSat === 'boost') parts.push('deep saturated blue sky and cool tones')
  else if (s.bluesSat === 'cut') parts.push('muted desaturated blue range')
  if (s.bluesLum === 'darken') parts.push('darken blue channel for dramatic sky depth')
  else if (s.bluesLum === 'brighten') parts.push('airy luminous blue sky')

  if (s.greensSat === 'boost') parts.push('vibrant lush foliage and green tones')
  else if (s.greensSat === 'cut') parts.push('reduced green saturation, muted foliage')
  if (s.greensLum === 'brighten') parts.push('bright open foliage')
  else if (s.greensLum === 'darken') parts.push('deeper moody foliage')

  if (s.neonAccent) parts.push('vivid neon accent isolation against dark background')

  if (parts.length === 0) return 'Neutral HSL qualifier intent — no selective color emphasis requested. All color ranges at natural response.'
  return parts.join(',\n')
}

function buildTextureSection(s: TextureSetting): string {
  const parts: string[] = []
  if (s.sharpness > 1) parts.push('enhanced edge sharpness, fine fabric and skin detail')
  else if (s.sharpness === 1) parts.push('subtle sharpness enhancement')
  else if (s.sharpness < -1) parts.push('soft diffused texture, beauty retouching clarity')
  else if (s.sharpness === -1) parts.push('slightly softened texture')

  if (s.grain === 'fine') parts.push('fine analog grain texture, subtle film noise')
  else if (s.grain === 'medium') parts.push('medium analog grain, visible film texture')
  else if (s.grain === 'heavy') parts.push('heavy grain structure, high-speed film look')

  if (s.halation === 'subtle') parts.push('subtle warm halation glow around bright edges')
  else if (s.halation === 'strong') parts.push('strong film halation around highlights, analog lens bloom')

  if (s.glow === 'subtle') parts.push('soft diffused glow on highlights')
  else if (s.glow === 'strong') parts.push('strong dreamy glow on bright areas')

  if (s.vignette === 'subtle') parts.push('subtle darkened corner vignette')
  else if (s.vignette === 'strong') parts.push('strong oval vignette, focused center composition')

  if (s.cleanShadows) parts.push('clean shadow areas, no noise in dark regions')

  if (parts.length === 0) return 'Neutral texture — no grain, halation, glow, vignette, or sharpness adjustment.'
  return parts.join(',\n')
}

// ─── Main prompt builder ──────────────────────────────────────────────────────

export function buildColorGradePrompt(
  setting: ColorGradeSetting,
  _nodeKind: 'image' | 'video',
): string {
  const sections: string[] = [
    '[Color Grade Palette]',
    '\n[Primary Wheels]',
    buildPrimaryWheelsSection(setting),
    '\n[Curves]',
    buildCurvesSection(setting.curve),
    '\n[Qualifier Intent]',
    buildQualifierSection(setting.qualifier),
    '\n[Texture]',
    buildTextureSection(setting.texture),
    '\n[Output Protection]',
    'Subject preservation LOCKED: preserve original subject, composition, and characters unchanged.\n' +
    'No face change, no product redesign, no scene replacement.\n' +
    'Avoid overprocessed HDR artifacts. Avoid plastic AI texture.',
    '\n[Color Grade Negative Constraints]',
    'do not alter subject identity, facial features, body proportions, or scene objects,\n' +
    'do not change lighting direction or shadow placement from original composition,\n' +
    'do not introduce new colors unrelated to the selected grade,\n' +
    'no subject replacement, no face change, no product redesign, no composition change',
  ]

  return sections.join('\n')
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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
      return { nodeId, newPrompt: existing, skipped: true, skipReason: 'already-has-grade' }
    }

    const grade = buildColorGradePrompt(setting, (node.kind as 'image' | 'video') ?? 'image')
    const newPrompt = existing.trim() ? `${existing.trimEnd()}\n\n${grade}` : grade

    return { nodeId, newPrompt, skipped: false }
  })
}

export function summarizeColorGradeSetting(setting: ColorGradeSetting): string {
  const presetLabel = setting.presetId === 'none'
    ? '手动'
    : (COLOR_GRADE_PRESETS.find((p) => p.id === setting.presetId)?.nameZh ?? setting.presetId)

  const lines = [
    `预设：${presetLabel}`,
    `Lift：T${setting.lift.temperature > 0 ? '+' : ''}${setting.lift.temperature} / G${setting.lift.tint > 0 ? '+' : ''}${setting.lift.tint} / L${setting.lift.luminance > 0 ? '+' : ''}${setting.lift.luminance}`,
    `Gamma：T${setting.gamma.temperature > 0 ? '+' : ''}${setting.gamma.temperature} / G${setting.gamma.tint > 0 ? '+' : ''}${setting.gamma.tint} / L${setting.gamma.luminance > 0 ? '+' : ''}${setting.gamma.luminance}`,
    `Gain：T${setting.gain.temperature > 0 ? '+' : ''}${setting.gain.temperature} / G${setting.gain.tint > 0 ? '+' : ''}${setting.gain.tint} / L${setting.gain.luminance > 0 ? '+' : ''}${setting.gain.luminance}`,
    `曲线：${setting.curve.shape} / ${setting.curve.rgbBias}`,
    `肤色保护：${setting.qualifier.protectSkin ? '开' : '关'}`,
    `纹理：${setting.texture.grain !== 'none' ? `grain ${setting.texture.grain}` : '无噪点'}`,
  ]
  return lines.join('\n')
}
