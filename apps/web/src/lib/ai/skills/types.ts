import type { GlobalPro } from '../prompts'
export type { GlobalPro }

export type SkillName = 'writer' | 'director' | 'actor' | 'camera' | 'video' | 'final-edit'

/** Lightweight shot summary passed to the final-edit skill */
export interface ShotSummary {
  id: string
  label: string
  idea?: string
  videoUrl?: string
  duration?: number
  order?: number
}

/** Input passed from the orchestrator (page) to each skill */
export interface SkillInput {
  idea: string
  style?: string
  /** Pre-composed upstream text context (assembled by page) */
  context?: string
  /** Camera imageUrl forwarded to the video skill */
  imageUrl?: string
  /** Camera keyframePrompt forwarded to the video skill for videoPrompt building */
  keyframePrompt?: string
  /** All shots — passed to the final-edit skill */
  shots?: ShotSummary[]
  /** Global quality-control sliders + model routing — applied to prompt modifiers and provider dispatch */
  globalPro?: GlobalPro
  /** Future: per-node overrides (model, resolution, lens, etc.) */
  params?: Record<string, unknown>
}

/** What a skill returns — all fields optional depending on skill type */
export interface SkillOutput {
  content?: string   // text-producing skills
  imageUrl?: string  // camera + actor skill
  videoUrl?: string  // video skill
  source: string     // 'mock' | 'real' | 'fallback-mock'
  // ── Actor / Casting System ──────────────────────────────────────────────────
  characterName?: string    // parsed from JSON output
  personality?: string      // parsed from JSON output
  lookSummary?: string      // parsed from JSON output
  wardrobe?: string         // parsed from JSON output
  consistencyKey?: string   // generated for cross-shot consistency tracking
  // ── Camera / Cinematography System ─────────────────────────────────────────
  shotDescription?: string  // Chinese shot description (display)
  keyframePrompt?: string   // English image generation prompt (used for keyframe)
  // ── Video / Motion System ───────────────────────────────────────────────────
  videoPrompt?: string      // English video generation prompt (built from keyframe + params)
  // ── Final Edit / Timeline System ────────────────────────────────────────────
  timelineSummary?: string  // describes shot order, rhythm, transitions
  finalVideoUrl?: string    // assembled (mock) final video
}

export type SkillFn = (input: SkillInput) => Promise<SkillOutput>

export const SKILL_NAMES: SkillName[] = ['writer', 'director', 'actor', 'camera', 'video', 'final-edit']
