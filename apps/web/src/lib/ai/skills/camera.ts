import { generate, generateImage } from '../index'
import type { ImageProvider } from '../index'
import type { ProParams, GlobalPro } from '../prompts'
import { globalProToKeywords } from '../prompts'
import type { SkillInput, SkillOutput } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CameraParsed {
  shotDescription: string
  keyframePrompt: string
  photographyNotes: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FALLBACK_KEYFRAME =
  'cinematic wide shot, soft natural lighting, desaturated color palette, film grain, moody atmosphere, 35mm lens'

/** Parse the JSON structure the camera prompt asks the AI to return. */
function parseCameraOutput(raw: string): CameraParsed {
  try {
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()
    const data = JSON.parse(cleaned) as Record<string, unknown>
    return {
      shotDescription:  String(data.shotDescription  ?? ''),
      keyframePrompt:   String(data.keyframePrompt   ?? ''),
      photographyNotes: String(data.photographyNotes ?? ''),
    }
  } catch {
    return {
      shotDescription:  raw.slice(0, 60),
      keyframePrompt:   FALLBACK_KEYFRAME,
      photographyNotes: '',
    }
  }
}

/**
 * Enhance the English keyframe prompt with any ProParams that aren't
 * already reflected in the AI-generated base, then append GlobalPro
 * quality modifiers. Avoids duplication via case-insensitive presence check.
 */
function buildKeyframePrompt(
  base: string,
  p: ProParams | undefined,
  style: string | undefined,
  g: GlobalPro | undefined
): string {
  const parts: string[] = [base]
  const lower = base.toLowerCase()

  const append = (term: string) => {
    if (term && !lower.includes(term.replace(/-/g, ' ').toLowerCase())) {
      parts.push(term)
    }
  }

  if (p?.framing)    append(`${p.framing} framing`)
  if (p?.shotType)   append(`${p.shotType} shot`)
  if (p?.colorGrade) append(`${p.colorGrade} color grade`)
  if (p?.lighting)   append(`${p.lighting} lighting`)
  if (p?.movement && p.movement !== 'static') append(`${p.movement} camera`)
  if (style)         append(`${style} visual style`)

  // Global quality-control modifiers
  if (g) {
    for (const kw of globalProToKeywords(g)) {
      append(kw)
    }
  }

  return parts.join(', ').slice(0, 500)
}

// ─── Skill ────────────────────────────────────────────────────────────────────

/**
 * Camera skill — Cinematography Node.
 *
 * Step 1: Generate structured camera text (JSON via camera prompt).
 *         Context includes director output (storyboard) + actor output (character visuals).
 * Step 2: Parse JSON → shotDescription, keyframePrompt, photographyNotes.
 * Step 3: Enhance keyframePrompt with ProParams (framing, colorGrade, lighting, etc.).
 * Step 4: Generate keyframe image via selected image provider.
 *
 * Future expansion:
 *   - Multi-keyframe: run Step 4 multiple times for different shots
 *   - Reference image input: anchor style to an existing frame
 *   - Prompt editing: let user tweak keyframePrompt before generation
 *   - A/B generation: produce two variants and expose both imageUrls
 */
export async function cameraSkill({ idea, style, context, params, globalPro }: SkillInput): Promise<SkillOutput> {
  // Step 1: Structured text
  const textResult = await generate({ idea, role: 'camera', style, context, params })

  // Step 2: Parse
  const parsed = parseCameraOutput(textResult.content)

  // Step 3: Build enhanced keyframe prompt (ProParams + GlobalPro quality modifiers)
  const p = params as ProParams | undefined
  const keyframePrompt = buildKeyframePrompt(
    parsed.keyframePrompt || FALLBACK_KEYFRAME,
    p,
    style,
    globalPro
  )

  // Step 4: Keyframe image — globalPro.modelConfig takes priority over per-shot params
  const imageModelFromConfig = globalPro?.modelConfig?.imageModel
  const imageModelFromParams = (params as Record<string, unknown> | undefined)?.imageModel as string | undefined
  const provider = ((imageModelFromConfig ?? imageModelFromParams) ?? 'mock') as ImageProvider

  const imageResult = await generateImage({
    prompt: keyframePrompt,
    style,
    provider,
  })

  return {
    content:         textResult.content,
    shotDescription: parsed.shotDescription,
    keyframePrompt,
    imageUrl:        imageResult.imageUrl,
    source:          imageResult.source,
  }
}
