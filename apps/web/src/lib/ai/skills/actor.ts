import { generate, generateImage } from '../index'
import type { ImageProvider } from '../index'
import type { SkillInput, SkillOutput } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActorParsed {
  characterName: string
  personality: string
  lookSummary: string
  wardrobe: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse the JSON structure the actor prompt asks the AI to return. */
function parseActorOutput(raw: string): ActorParsed {
  try {
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()
    const data = JSON.parse(cleaned) as Record<string, unknown>
    return {
      characterName: String(data.characterName ?? '主角'),
      personality:   String(data.personality   ?? ''),
      lookSummary:   String(data.lookSummary    ?? ''),
      wardrobe:      String(data.wardrobe       ?? ''),
    }
  } catch {
    // Graceful fallback: treat raw text as lookSummary
    return { characterName: '主角', personality: '', lookSummary: raw.slice(0, 60), wardrobe: '' }
  }
}

/**
 * Stable-ish key for cross-shot character consistency.
 * Format: char_<slugified-name>_<base36-timestamp-suffix>
 * Future: replace suffix with a UUID or project-level counter.
 */
function buildConsistencyKey(characterName: string): string {
  const slug = characterName.replace(/[\s\u3000]+/g, '-')
  return `char_${slug}_${Date.now().toString(36).slice(-5)}`
}

const IMAGE_PROMPT_MAX = 400

// ─── Skill ────────────────────────────────────────────────────────────────────

/**
 * Actor skill — Casting System.
 *
 * Step 1: Generate structured actor text (JSON via actor prompt).
 * Step 2: Parse JSON → characterName, personality, lookSummary, wardrobe.
 * Step 3: Generate consistencyKey for future cross-shot tracking.
 * Step 4: Generate character concept image via selected image provider.
 *
 * Designed for future expansion:
 *   - Multi-character support: run multiple passes with different names
 *   - Reference image input: pass existing imageUrl for style anchoring
 *   - Video-node handoff: pass consistencyKey + characterName downstream
 */
export async function actorSkill({ idea, style, context, params }: SkillInput): Promise<SkillOutput> {
  // Step 1: Structured text
  const textResult = await generate({ idea, role: 'actor', style, context, params })

  // Step 2: Parse
  const parsed = parseActorOutput(textResult.content)

  // Step 3: Consistency key
  const consistencyKey = buildConsistencyKey(parsed.characterName)

  // Step 4: Character concept image
  const p = params as Record<string, unknown> | undefined
  const imageModel = (p?.imageModel as string | undefined) ?? 'mock'
  const provider = imageModel as ImageProvider

  const imagePrompt = `人物肖像，${parsed.lookSummary}，${parsed.wardrobe}，${style ?? '商业广告'}风格`.slice(
    0,
    IMAGE_PROMPT_MAX
  )

  const imageResult = await generateImage({
    prompt: imagePrompt,
    style,
    provider,
    characterName: parsed.characterName,
    consistencyKey,
  })

  return {
    content: textResult.content,
    characterName: parsed.characterName,
    personality:   parsed.personality,
    lookSummary:   parsed.lookSummary,
    wardrobe:      parsed.wardrobe,
    consistencyKey,
    imageUrl: imageResult.imageUrl,
    source:   imageResult.source,
  }
}
