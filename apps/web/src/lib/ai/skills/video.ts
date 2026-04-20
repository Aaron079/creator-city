import { generate, generateVideo } from '../index'
import type { VideoProvider } from '../index'
import type { ProParams } from '../prompts'
import type { SkillInput, SkillOutput } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FALLBACK_VIDEO_PROMPT =
  'cinematic motion, smooth camera movement, atmospheric lighting, film grain, moody'

/**
 * Build the English video generation prompt from:
 *   - keyframePrompt (camera node output — the visual foundation)
 *   - movement (ProParams — adds camera motion directive)
 *   - colorGrade (ProParams — reinforces look)
 *   - director context snippet (fallback when no keyframePrompt)
 *
 * aiStrength influence:
 *   - Low (< 35):  minimal additions, leaves room for the provider's own interpretation
 *   - High (> 80): explicit motion + duration instructions for maximum control
 */
function buildVideoPrompt(
  keyframePrompt: string | undefined,
  p: ProParams | undefined,
  context: string | undefined,
  style: string | undefined
): string {
  const parts: string[] = []
  const base = keyframePrompt ?? ''
  const baseLower = base.toLowerCase()

  if (base) parts.push(base)

  // Append movement if not already reflected in base
  const movement = p?.movement
  if (movement && movement !== 'static' && !baseLower.includes(movement.toLowerCase())) {
    parts.push(`${movement} camera movement`)
  }

  // Reinforce color grade for providers that honor it (Runway, Kling)
  const colorGrade = p?.colorGrade
  if (colorGrade && !baseLower.includes(colorGrade.replace(/-/g, ' ').toLowerCase())) {
    parts.push(`${colorGrade} color grade`)
  }

  // High aiStrength: explicit motion instructions
  if (p && p.aiStrength > 80 && p.movement && p.movement !== 'static') {
    parts.push('precise controlled motion, professional cinematography')
  }

  // Fallback: use director context snippet as base
  if (parts.length === 0 && context) {
    parts.push(context.slice(0, 200))
  }

  // Last-resort fallback
  if (parts.length === 0) {
    parts.push(FALLBACK_VIDEO_PROMPT)
    if (style) parts.push(`${style} style`)
  }

  return parts.join(', ').slice(0, 500)
}

/** Parse '5s' / '10s' / '15s' → number. Returns undefined if unparseable. */
function parseDuration(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const n = parseInt(raw.replace('s', ''), 10)
  return isNaN(n) ? undefined : n
}

// ─── Skill ────────────────────────────────────────────────────────────────────

/**
 * Video skill — Motion System (image-to-video).
 *
 * Step 1: Generate editor text (剪辑方案) via text model.
 *         Content describes pacing, music direction, and final feel.
 * Step 2: Build videoPrompt from camera keyframePrompt + ProParams.
 * Step 3: Call video provider with imageUrl (camera keyframe) + videoPrompt.
 *
 * Data flow:
 *   camera.imageUrl      → seed frame for image-to-video
 *   camera.keyframePrompt → visual foundation for videoPrompt
 *   director context     → emotional/pacing hints
 *   ProParams.movement   → camera motion directive
 *   ProParams.duration   → clip length
 *   ProParams.videoModel → provider routing
 *
 * Future expansion:
 *   - Multi-clip: run Step 3 for each shot in the storyboard
 *   - Prompt editing: expose videoPrompt for user edits before generation
 *   - A/B generation: produce two takes and surface both videoUrls
 */
export async function videoSkill({
  idea,
  style,
  context,
  imageUrl,
  keyframePrompt,
  params,
  globalPro,
}: SkillInput): Promise<SkillOutput> {
  // Step 1: Editor text
  const textResult = await generate({ idea, role: 'editor', style, context, params })

  // Step 2: Build video prompt
  const p = params as ProParams | undefined
  const videoPrompt = buildVideoPrompt(keyframePrompt, p, context, style)

  // Step 3: Video generation — globalPro.modelConfig takes priority over per-shot params
  const videoModelFromConfig = globalPro?.modelConfig?.videoModel
  const videoModelFromParams = (params as Record<string, unknown> | undefined)?.videoModel
  const provider = (
    videoModelFromConfig ?? (typeof videoModelFromParams === 'string' ? videoModelFromParams : 'mock')
  ) as VideoProvider

  const duration = parseDuration(
    (params as Record<string, unknown> | undefined)?.duration as string | undefined
  )

  const videoResult = await generateVideo({
    prompt: videoPrompt,
    imageUrl,
    style,
    provider,
    ...(duration != null ? { duration } : {}),
    movement: p?.movement,
    colorGrade: p?.colorGrade,
  })

  return {
    content:     textResult.content,
    videoPrompt,
    videoUrl:    videoResult.videoUrl,
    source:      videoResult.source,
  }
}
