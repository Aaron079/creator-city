export interface SceneLightingSettings {
  lightingSetup: string
  timeWeather: string
  atmosphere: string
  colorMood: string
}

export const DEFAULT_SCENE_LIGHTING: SceneLightingSettings = {
  lightingSetup: '',
  timeWeather: '',
  atmosphere: '',
  colorMood: '',
}

export function hasSceneLightingContext(settings: SceneLightingSettings): boolean {
  return Boolean(settings.lightingSetup || settings.timeWeather || settings.atmosphere || settings.colorMood)
}

export function activeSceneLightingCount(settings: SceneLightingSettings): number {
  return [settings.lightingSetup, settings.timeWeather, settings.atmosphere, settings.colorMood].filter(Boolean).length
}

const LIGHTING_SETUP_PROMPT: Record<string, string> = {
  'Key Light': 'key light from upper-right, clear subject illumination, defined shadows, classic cinematic three-point lighting',
  'Backlight': 'backlight from behind subject, rim lighting effect, mysterious glowing silhouette, edge separation from background',
  'Neon Light': 'neon light reflections, cyberpunk color mixing, colored LED highlights on surfaces, vibrant urban night glow',
  'Low Key': 'low-key lighting, high contrast, deep shadows dominant, narrow illumination, film noir and suspense atmosphere',
  'Soft Window Light': 'soft natural window light from the side, realistic diffuse illumination, gentle shadow gradients, intimate realism',
  'Top Light': 'harsh overhead top-down lighting, oppressive illumination, deep under-eye shadows, dramatic and interrogation feel',
}

const TIME_WEATHER_PROMPT: Record<string, string> = {
  'Dawn Mist': 'dawn mist, pale blue-grey pre-dawn light, ground fog layers, delicate and ethereal morning quietude',
  'Golden Hour': 'golden hour sunset light, warm amber and orange tones, long stretched shadows, cinematic warm glow across surfaces',
  'Midnight Rain': 'midnight rain, wet glistening surfaces, diagonal rain streaks, deep dark sky, reflective dark urban atmosphere',
  'Snow Night': 'snow night, cold blue ambient moonlight, falling snowflakes, silent isolated winter scene, pristine white ground',
  'Overcast Day': 'overcast day, flat diffuse soft light, no harsh shadows, muted desaturated tones, melancholic grey sky',
  'Dust Storm': 'dust storm, orange-yellow atmospheric haze, reduced visibility, wind-swept particles, dramatic desert environment',
}

const ATMOSPHERE_PROMPT: Record<string, string> = {
  'Tense': 'tense atmosphere, compressed and anticipatory, restrained charged energy, every visual element heightened and ready',
  'Dreamlike': 'dreamlike atmosphere, soft and ethereal quality, hazy dissolving boundaries, surreal quiet, gentle unreality',
  'Lonely': 'lonely atmosphere, vast empty surrounding space, isolated subject, profound solitude, quiet melancholy and distance',
  'Epic': 'epic atmosphere, grand heroic scale, sweeping cinematic vista, legendary presence, monumental and awe-inspiring',
  'Romantic': 'romantic atmosphere, warm and intimate light, soft bokeh, emotional tenderness, gentle and close connection',
  'Oppressive': 'oppressive atmosphere, heavy and dense visual weight, claustrophobic compressed framing, dark inescapable pressure',
  'Suspense': 'suspenseful atmosphere, unresolved visual tension, hidden threat implied, asymmetric shadows, quiet dread and uncertainty',
}

const COLOR_MOOD_PROMPT: Record<string, string> = {
  'Teal & Orange': 'teal and orange complementary color grade, classic Hollywood blockbuster look, vivid contrast between cool shadows and warm highlights',
  'Cold Blue': 'cold blue palette, icy restrained tones, steel-grey and midnight blue, emotional distance, psychological thriller mood',
  'Warm Amber': 'warm amber and golden palette, nostalgic and intimate, sun-drenched memory-like quality, comforting and familiar',
  'Black & Gold': 'black and gold palette, prestige and drama, deep impenetrable shadows with gilded highlights, luxury noir feel',
  'Neon Purple': 'neon purple and magenta palette, electric and vivid, cyberpunk dreamscape glow, synthetic and hyper-saturated',
  'Desaturated': 'desaturated muted palette, near-monochrome restraint, documentary realism, quiet and understated visual language',
  'Monochrome': 'black and white monochrome, timeless and graphic, pure tonal contrast, classical elegance and abstraction',
}

export function buildSceneLightingPromptContext(settings: SceneLightingSettings): string {
  if (!hasSceneLightingContext(settings)) return ''

  const lines: string[] = []
  if (settings.lightingSetup) lines.push(`Lighting: ${LIGHTING_SETUP_PROMPT[settings.lightingSetup] ?? settings.lightingSetup}`)
  if (settings.timeWeather) lines.push(`Time & Weather: ${TIME_WEATHER_PROMPT[settings.timeWeather] ?? settings.timeWeather}`)
  if (settings.atmosphere) lines.push(`Atmosphere: ${ATMOSPHERE_PROMPT[settings.atmosphere] ?? settings.atmosphere}`)
  if (settings.colorMood) lines.push(`Color Mood: ${COLOR_MOOD_PROMPT[settings.colorMood] ?? settings.colorMood}`)

  return (
    '\n\n[Creator City Lighting & Atmosphere Direction]\n' +
    lines.join('\n') +
    '\nRule: Apply this lighting and atmosphere consistently unless the user prompt specifies otherwise.'
  )
}

export function appendSceneLightingContextToPrompt(prompt: string, lightingCtx: string): string {
  if (!lightingCtx.trim()) return prompt
  return prompt + lightingCtx
}

export function buildLightingSummaryText(settings: SceneLightingSettings): string {
  return [settings.lightingSetup, settings.timeWeather, settings.atmosphere, settings.colorMood].filter(Boolean).join(' · ')
}
