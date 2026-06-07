/**
 * Color Grade Palette — Tool 12
 * DaVinci Color Page concepts translated to prompt-level grading.
 * Prompt-only: no pixel manipulation, no API calls, no generation.
 *
 * Data model aligned with ASC CDL / OpenFX / Darktable structure
 * for future compatibility with FFmpeg / OpenColorIO / WebGL LUT pipeline.
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

/**
 * Primary color wheel — ASC CDL-aligned units.
 * temperature/tint/luminance: -1 to +1 (0 = neutral)
 * saturation: 0 to 4 (1.0 = neutral, matches ASC CDL saturation multiplier)
 */
export interface WheelSetting {
  temperature: number  // -1 cool → +1 warm
  tint: number         // -1 green → +1 magenta
  luminance: number    // -1 darken → +1 brighten
  saturation: number   // 0 full-desat → 1 neutral → 4 vivid (ASC CDL multiplier)
}

export type ContrastCurve =
  | 'neutral'
  | 'gentle-s-curve'
  | 'standard-s-curve'
  | 'steep-s-curve'
  | 'lifted-blacks-film-curve'

export type RgbBias =
  | 'neutral'
  | 'warm-highlights-cool-shadows'
  | 'cool-highlights-warm-shadows'
  | 'green-shadows-magenta-highlights'

export interface CurveSetting {
  contrastCurve: ContrastCurve
  rgbBias: RgbBias
}

export type GreensIntent = 'reduce' | 'neutral' | 'boost'
export type BluesIntent = 'deepen' | 'neutral' | 'brighten'
export type NeonAccent = 'off' | 'isolate' | 'boost'

export interface QualifierSetting {
  protectSkin: boolean
  greens: GreensIntent
  blues: BluesIntent
  neonAccent: NeonAccent
}

/**
 * Texture controls — all numeric (0–100 for effects, -100 to +100 for sharpness/detail).
 * Designed to map to future ffmpeg unsharp/grain/vignette filter parameters.
 */
export interface TextureSetting {
  sharpness: number      // -100 to +100, 0 = neutral
  midtoneDetail: number  // -100 to +100, 0 = neutral
  grain: number          // 0 to 100 (0 = none)
  halation: number       // 0 to 100 (0 = none)
  glow: number           // 0 to 100 (0 = none)
  vignette: number       // 0 to 100 (0 = none)
  cleanShadows: number   // 0 to 100 (0 = off)
}

export interface ColorGradeSetting {
  presetId: ColorGradePresetId
  lift: WheelSetting
  gamma: WheelSetting
  gain: WheelSetting
  offset: WheelSetting
  curves: CurveSetting
  qualifier: QualifierSetting
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

const NEUTRAL_WHEEL: WheelSetting = { temperature: 0, tint: 0, luminance: 0, saturation: 1.0 }

const NEUTRAL_QUALIFIER: QualifierSetting = {
  protectSkin: true,
  greens: 'neutral',
  blues: 'neutral',
  neonAccent: 'off',
}

const NEUTRAL_TEXTURE: TextureSetting = {
  sharpness: 0, midtoneDetail: 0, grain: 0, halation: 0, glow: 0, vignette: 0, cleanShadows: 0,
}

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
      curves: { contrastCurve: 'neutral', rgbBias: 'neutral' },
      qualifier: { ...NEUTRAL_QUALIFIER },
      texture: { ...NEUTRAL_TEXTURE },
    },
  },
  {
    id: 'soft-cinematic-s-curve',
    nameZh: '柔和电影感',
    nameEn: 'Soft Cinematic S-Curve',
    accentColor: 'linear-gradient(90deg, #4a3728 0%, #c8a87a 100%)',
    setting: {
      lift: { temperature: -0.10, tint: 0, luminance: -0.15, saturation: 0.90 },
      gamma: { temperature: 0.05, tint: 0, luminance: 0, saturation: 1.0 },
      gain: { temperature: 0.15, tint: 0, luminance: 0.10, saturation: 1.0 },
      offset: { temperature: 0.05, tint: 0, luminance: 0, saturation: 0.95 },
      curves: { contrastCurve: 'standard-s-curve', rgbBias: 'warm-highlights-cool-shadows' },
      qualifier: { ...NEUTRAL_QUALIFIER },
      texture: { sharpness: 0, midtoneDetail: 0, grain: 30, halation: 25, glow: 0, vignette: 25, cleanShadows: 0 },
    },
  },
  {
    id: 'low-key-night-film',
    nameZh: '夜景低调电影',
    nameEn: 'Low Key Night Film',
    accentColor: 'linear-gradient(90deg, #0a0f1e 0%, #1a2a4a 100%)',
    setting: {
      lift: { temperature: -0.25, tint: 0, luminance: -0.30, saturation: 0.85 },
      gamma: { temperature: -0.10, tint: 0, luminance: -0.15, saturation: 1.0 },
      gain: { temperature: -0.10, tint: 0, luminance: -0.05, saturation: 1.0 },
      offset: { temperature: -0.15, tint: 0, luminance: -0.10, saturation: 0.90 },
      curves: { contrastCurve: 'steep-s-curve', rgbBias: 'neutral' },
      qualifier: { protectSkin: true, greens: 'reduce', blues: 'deepen', neonAccent: 'off' },
      texture: { sharpness: 0, midtoneDetail: 0, grain: 50, halation: 25, glow: 0, vignette: 70, cleanShadows: 80 },
    },
  },
  {
    id: 'high-key-commercial',
    nameZh: '高调商业广告',
    nameEn: 'High Key Commercial',
    accentColor: 'linear-gradient(90deg, #dde8f5 0%, #ffffff 100%)',
    setting: {
      lift: { temperature: 0.05, tint: 0, luminance: 0.20, saturation: 1.10 },
      gamma: { temperature: 0.05, tint: 0, luminance: 0.20, saturation: 1.05 },
      gain: { temperature: 0.05, tint: 0, luminance: 0.15, saturation: 1.0 },
      offset: { temperature: 0.05, tint: 0, luminance: 0.10, saturation: 1.05 },
      curves: { contrastCurve: 'gentle-s-curve', rgbBias: 'neutral' },
      qualifier: { ...NEUTRAL_QUALIFIER },
      texture: { sharpness: 30, midtoneDetail: 20, grain: 0, halation: 0, glow: 20, vignette: 0, cleanShadows: 0 },
    },
  },
  {
    id: 'warm-portrait-protection',
    nameZh: '暖调人像保护',
    nameEn: 'Warm Portrait Protection',
    accentColor: 'linear-gradient(90deg, #8b4513 0%, #f4a460 100%)',
    setting: {
      lift: { temperature: 0.15, tint: 0.05, luminance: 0, saturation: 1.0 },
      gamma: { temperature: 0.15, tint: 0.05, luminance: 0.05, saturation: 1.05 },
      gain: { temperature: 0.20, tint: 0, luminance: 0.05, saturation: 1.0 },
      offset: { temperature: 0.10, tint: 0.03, luminance: 0, saturation: 1.0 },
      curves: { contrastCurve: 'standard-s-curve', rgbBias: 'warm-highlights-cool-shadows' },
      qualifier: { ...NEUTRAL_QUALIFIER },
      texture: { sharpness: 0, midtoneDetail: 0, grain: 25, halation: 0, glow: 20, vignette: 20, cleanShadows: 0 },
    },
  },
  {
    id: 'teal-orange-classic',
    nameZh: '青橙经典对比',
    nameEn: 'Teal & Orange Classic',
    accentColor: 'linear-gradient(90deg, #008080 0%, #ff6b00 100%)',
    setting: {
      lift: { temperature: -0.35, tint: -0.05, luminance: -0.10, saturation: 1.10 },
      gamma: { temperature: -0.05, tint: 0, luminance: 0, saturation: 1.05 },
      gain: { temperature: 0.40, tint: 0.05, luminance: 0.05, saturation: 1.10 },
      offset: { temperature: 0, tint: 0, luminance: 0, saturation: 1.05 },
      curves: { contrastCurve: 'standard-s-curve', rgbBias: 'warm-highlights-cool-shadows' },
      qualifier: { protectSkin: true, greens: 'reduce', blues: 'deepen', neonAccent: 'off' },
      texture: { sharpness: 0, midtoneDetail: 0, grain: 25, halation: 0, glow: 0, vignette: 20, cleanShadows: 0 },
    },
  },
]

// ─── Default / Preset helpers ─────────────────────────────────────────────────

export function createDefaultColorGradeSetting(): ColorGradeSetting {
  return {
    presetId: 'none',
    lift: { ...NEUTRAL_WHEEL },
    gamma: { ...NEUTRAL_WHEEL },
    gain: { ...NEUTRAL_WHEEL },
    offset: { ...NEUTRAL_WHEEL },
    curves: { contrastCurve: 'neutral', rgbBias: 'neutral' },
    qualifier: { ...NEUTRAL_QUALIFIER },
    texture: { ...NEUTRAL_TEXTURE },
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
  return w.temperature === 0 && w.tint === 0 && w.luminance === 0 && Math.abs(w.saturation - 1.0) < 0.001
}

function describeWheel(name: string, label: string, w: WheelSetting): string[] {
  if (isNeutralWheel(w)) return []
  const parts: string[] = []

  if (w.luminance > 0.20) parts.push(`${label} exposure lifted`)
  else if (w.luminance > 0.05) parts.push(`${label} exposure slightly brightened`)
  else if (w.luminance < -0.20) parts.push(`${label} exposure pulled down`)
  else if (w.luminance < -0.05) parts.push(`${label} exposure slightly darkened`)

  if (w.temperature > 0.20) parts.push(`warm ${name.toLowerCase()} bias`)
  else if (w.temperature > 0.05) parts.push(`slightly warm ${name.toLowerCase()} cast`)
  else if (w.temperature < -0.20) parts.push(`cool blue ${name.toLowerCase()} bias`)
  else if (w.temperature < -0.05) parts.push(`slightly cool ${name.toLowerCase()} cast`)

  if (w.tint > 0.15) parts.push(`magenta ${name.toLowerCase()} tint`)
  else if (w.tint < -0.15) parts.push(`green ${name.toLowerCase()} tint offset`)

  if (w.saturation > 1.15) parts.push(`${name.toLowerCase()} chroma boost (×${w.saturation.toFixed(1)} CDL)`)
  else if (w.saturation < 0.85) parts.push(`${name.toLowerCase()} chroma reduction (×${w.saturation.toFixed(1)} CDL)`)
  return parts
}

function buildPrimaryWheelsSection(s: ColorGradeSetting): string {
  const liftParts = describeWheel('Lift', 'shadow', s.lift)
  const gammaParts = describeWheel('Gamma', 'midtone', s.gamma)
  const gainParts = describeWheel('Gain', 'highlight', s.gain)
  const offsetParts = describeWheel('Offset', 'global', s.offset)

  const allParts = [...liftParts, ...gammaParts, ...gainParts, ...offsetParts]
  if (allParts.length === 0) {
    return 'Neutral Lift/Gamma/Gain/Offset — balanced primary correction, no tonal or color bias applied.'
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
  switch (s.contrastCurve) {
    case 'gentle-s-curve': shapeParts.push('gentle S-curve contrast, natural tonal separation, all detail preserved'); break
    case 'standard-s-curve': shapeParts.push('cinematic S-curve contrast, film-like tonal curve, smooth shoulder and toe'); break
    case 'steep-s-curve': shapeParts.push('steep dramatic contrast curve, noir tonal structure, crushed blacks and clipped highs'); break
    case 'lifted-blacks-film-curve': shapeParts.push('lifted blacks film curve, analog tonal response, open shadows with S-curve shoulder'); break
    default: break
  }
  const biasParts: string[] = []
  switch (s.rgbBias) {
    case 'warm-highlights-cool-shadows': biasParts.push('warm orange-gold highlight curve, cool blue-teal shadow curve'); break
    case 'cool-highlights-warm-shadows': biasParts.push('cool clean highlight curve, warm amber shadow undertone'); break
    case 'green-shadows-magenta-highlights': biasParts.push('green-shifted shadow curve, magenta highlight bias'); break
    default: break
  }

  const all = [...shapeParts, ...biasParts]
  if (all.length === 0) return 'Neutral curve — no S-curve or RGB bias adjustment requested. Linear tonal response.'
  return all.join(', ')
}

function buildQualifierSection(s: QualifierSetting): string {
  const parts: string[] = []
  if (s.protectSkin) parts.push('protect skin tones unchanged, warm accurate complexion')

  if (s.greens === 'boost') parts.push('vibrant lush foliage and green tones')
  else if (s.greens === 'reduce') parts.push('reduced green saturation, muted foliage, teal shift in greens')

  if (s.blues === 'deepen') parts.push('deep saturated blue sky, darken blue channel for dramatic sky depth')
  else if (s.blues === 'brighten') parts.push('airy luminous blue sky, brightened blue channel')

  if (s.neonAccent === 'isolate') parts.push('neon accent isolation against dark background')
  else if (s.neonAccent === 'boost') parts.push('vivid neon accent boost, heightened luminous color pop')

  if (parts.length === 0) return 'Neutral HSL qualifier intent — no selective color emphasis requested. All color ranges at natural response.'
  return parts.join(',\n')
}

function buildTextureSection(s: TextureSetting): string {
  const parts: string[] = []

  if (s.sharpness > 30) parts.push('enhanced edge sharpness, fine fabric and skin detail')
  else if (s.sharpness > 0) parts.push('subtle sharpness enhancement')
  else if (s.sharpness < -30) parts.push('soft diffused texture, beauty retouching clarity')
  else if (s.sharpness < 0) parts.push('slightly softened texture')

  if (s.midtoneDetail > 30) parts.push('enhanced midtone detail, clarified texture in midrange')
  else if (s.midtoneDetail > 0) parts.push('subtle midtone detail lift')
  else if (s.midtoneDetail < -30) parts.push('smoothed midtone texture, silkier surface')

  if (s.grain > 60) parts.push('heavy grain structure, high-speed film look')
  else if (s.grain > 30) parts.push('medium analog grain, visible film texture')
  else if (s.grain > 0) parts.push('fine analog grain texture, subtle film noise')

  if (s.halation > 50) parts.push('strong film halation around highlights, analog lens bloom')
  else if (s.halation > 0) parts.push('subtle warm halation glow around bright edges')

  if (s.glow > 50) parts.push('strong dreamy glow on bright areas')
  else if (s.glow > 0) parts.push('soft diffused glow on highlights')

  if (s.vignette > 50) parts.push('strong oval vignette, focused center composition')
  else if (s.vignette > 0) parts.push('subtle darkened corner vignette')

  if (s.cleanShadows > 0) parts.push('clean shadow areas, no noise in dark regions')

  if (parts.length === 0) return 'Neutral texture — no grain, halation, glow, vignette, or sharpness adjustment requested.'
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
    buildCurvesSection(setting.curves),

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

  const fmtAxis = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`
  const fmtWheel = (w: WheelSetting) =>
    `T${fmtAxis(w.temperature)} M${fmtAxis(w.tint)} L${fmtAxis(w.luminance)} S${w.saturation.toFixed(2)}`

  return [
    `预设：${presetLabel}`,
    `Lift：${fmtWheel(setting.lift)}`,
    `Gamma：${fmtWheel(setting.gamma)}`,
    `Gain：${fmtWheel(setting.gain)}`,
    `Offset：${fmtWheel(setting.offset)}`,
    `曲线：${setting.curves.contrastCurve} / ${setting.curves.rgbBias}`,
    `肤色保护：${setting.qualifier.protectSkin ? '开' : '关'}`,
    `纹理：grain ${setting.texture.grain} / halation ${setting.texture.halation} / vignette ${setting.texture.vignette}`,
  ].join('\n')
}
