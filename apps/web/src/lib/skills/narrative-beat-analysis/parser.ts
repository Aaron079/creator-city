import type { CreatorSkillEvidence, CreatorSkillIssue } from '../types'
import type { ScriptSceneDraft } from '../script-segmentation'
import { normalizeScriptSource, parseScriptScenes } from '../script-segmentation/parser'
import type {
  NarrativeBeatDraft,
  NarrativeBeatMapPayload,
  NarrativeBeatType,
} from './types'

const MAX_SCENES = 40
const MAX_BEATS = 120
const SENTENCE_END = /[.!?。！？]+(?:["'’”〉》」】])?/gu

const TURN_CHINESE = ['但是', '然而', '却', '突然', '不料', '反而']
const GOAL_CHINESE = ['想要', '必须', '决定', '试图', '希望', '目标']
const REACTION_CHINESE = ['反应', '愣住', '震惊', '哭', '笑', '退后', '沉默']
const CLOSURE_CHINESE = ['最终', '终于', '结束', '离开', '消失', '落幕']
const ACTION_CHINESE = ['看向', '打开', '关闭', '进入', '走', '跑', '拿', '推', '拉', '冲']

const TURN_ENGLISH = /\b(?:but|however|suddenly|instead)\b/iu
const GOAL_ENGLISH = /\b(?:want(?:s|ed|ing)?|must|decid(?:e|es|ed|ing)|tr(?:y|ies|ied|ying)|goals?)\b/iu
const REACTION_ENGLISH = /\b(?:react(?:s|ed|ing|ion)?|star(?:e|es|ed|ing)|gasp(?:s|ed|ing)?|smil(?:e|es|ed|ing)|cr(?:y|ies|ied|ying))\b/iu
const CLOSURE_ENGLISH = /\b(?:finally|end(?:s|ed|ing)?|leav(?:e|es|ing)|left|fad(?:e|es|ed|ing))\b/iu
const ACTION_ENGLISH = /\b(?:walk(?:s|ed|ing)?|run(?:s|ning)?|ran|tak(?:e|es|en|ing)|took|open(?:s|ed|ing)?|clos(?:e|es|ed|ing)|enter(?:s|ed|ing)?)\b/iu
const ENGLISH_HEADING = /^(?:INT\/EXT\.|INT\.|EXT\.|I\/E\.)/iu
const CHINESE_HEADING = /^(?:内外景|内景|外景|第[0-9零〇一二三四五六七八九十百千万两]+场|场景)/u
const ENGLISH_CONTEXT = /\b(?:is|are|was|were)\b/iu
const CHINESE_CONTEXT = /(?:在|是|有|位于|站着|坐着|躺着|寂静|空无一人)/u

const SCENE_REQUIRED_FIELDS = [
  'sceneId',
  'order',
  'heading',
  'characters',
  'actionSummary',
  'sourceText',
  'lineStart',
  'lineEnd',
  'reviewStatus',
] as const
const SCENE_OPTIONAL_FIELDS = ['location', 'timeOfDay'] as const

export type NarrativeSourceScene = Pick<
  ScriptSceneDraft,
  'sceneId' | 'order' | 'heading' | 'sourceText' | 'lineStart' | 'lineEnd'
>

export type NarrativeBeatParseResult = {
  payload: NarrativeBeatMapPayload
  evidence: CreatorSkillEvidence[]
  warnings: CreatorSkillIssue[]
  limitExceeded: boolean
}

export type SceneBreakdownReadResult =
  | { valid: true; scenes: NarrativeSourceScene[] }
  | { valid: false }

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactFields(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  const keys = Reflect.ownKeys(value)
  const allowed = new Set([...required, ...optional])
  return keys.every((key) => typeof key === 'string' && allowed.has(key))
    && required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false
  }
  return true
}

function readScene(value: unknown): NarrativeSourceScene | null {
  if (!isPlainRecord(value)
    || !hasExactFields(value, SCENE_REQUIRED_FIELDS, SCENE_OPTIONAL_FIELDS)) {
    return null
  }
  const order = value.order
  const expectedSceneId = `scene-${String(order).padStart(3, '0')}`
  if (value.sceneId !== expectedSceneId
    || !Number.isSafeInteger(order)
    || (order as number) < 1
    || typeof value.heading !== 'string'
    || !isDenseArray(value.characters)
    || !value.characters.every((character) => typeof character === 'string' && character.trim())
    || typeof value.actionSummary !== 'string'
    || typeof value.sourceText !== 'string'
    || !value.sourceText.trim()
    || value.sourceText.includes('\r')
    || !Number.isInteger(value.lineStart)
    || !Number.isInteger(value.lineEnd)
    || (value.lineStart as number) < 1
    || (value.lineEnd as number) < (value.lineStart as number)
    || value.reviewStatus !== 'pending'
    || (value.location !== undefined && typeof value.location !== 'string')
    || (value.timeOfDay !== undefined && typeof value.timeOfDay !== 'string')) {
    return null
  }

  const lineStart = value.lineStart as number
  const lineEnd = value.lineEnd as number
  const sourceText = value.sourceText
  if (sourceText.split('\n').length !== lineEnd - lineStart + 1) return null
  if (value.heading
    && !sourceText.split('\n').some((line) => line.trim() === value.heading)) {
    return null
  }

  return {
    sceneId: value.sceneId,
    order: order as number,
    heading: value.heading,
    sourceText,
    lineStart,
    lineEnd,
  }
}

export function readSceneBreakdownPayload(value: unknown): SceneBreakdownReadResult {
  try {
    if (!isPlainRecord(value)
      || !hasExactFields(value, ['format', 'scenes'])
      || (value.format !== 'headed-script' && value.format !== 'paragraph-fallback')
      || !isDenseArray(value.scenes)
      || value.scenes.length === 0) {
      return { valid: false }
    }

    const scenes: NarrativeSourceScene[] = []
    let previousLineEnd = 0
    let previousOrder = 0
    for (let index = 0; index < value.scenes.length; index += 1) {
      const scene = readScene(value.scenes[index])
      if (!scene
        || scene.order <= previousOrder
        || scene.lineStart <= previousLineEnd) {
        return { valid: false }
      }
      if (value.format === 'headed-script' ? !scene.heading : Boolean(scene.heading)) {
        return { valid: false }
      }
      scenes.push(scene)
      previousOrder = scene.order
      previousLineEnd = scene.lineEnd
    }
    return { valid: true, scenes }
  } catch {
    return { valid: false }
  }
}

export function deriveNarrativeSourceScenes(sourceText: string) {
  const parsed = parseScriptScenes(sourceText, 'narrative-source')
  return {
    scenes: parsed.payload.scenes.map((scene): NarrativeSourceScene => ({
      sceneId: scene.sceneId,
      order: scene.order,
      heading: scene.heading,
      sourceText: scene.sourceText,
      lineStart: scene.lineStart,
      lineEnd: scene.lineEnd,
    })),
    sceneLimitExceeded: parsed.warnings.some((warning) => warning.code === 'SCENE_LIMIT_REACHED'),
  }
}

export function scenesMatchSource(
  scenes: readonly NarrativeSourceScene[],
  sourceText: string,
) {
  const lines = normalizeScriptSource(sourceText).split('\n')
  if (scenes.length === 1 && normalizeScriptSource(sourceText) === scenes[0]!.sourceText) {
    return true
  }
  const coveredLines = new Set<number>()
  for (const scene of scenes) {
    if (scene.lineEnd > lines.length
      || lines.slice(scene.lineStart - 1, scene.lineEnd).join('\n') !== scene.sourceText) {
      return false
    }
    for (let line = scene.lineStart; line <= scene.lineEnd; line += 1) {
      coveredLines.add(line)
    }
  }
  return lines.every((line, index) => !line.trim() || coveredLines.has(index + 1))
}

function containsChineseKeyword(sourceText: string, keywords: readonly string[]) {
  return keywords.some((keyword) => sourceText.includes(keyword))
}

function isExplicitSetup(sourceText: string, scene: NarrativeSourceScene, order: number) {
  if (order !== 1) return false
  if (scene.heading && sourceText === scene.heading) return true
  return ENGLISH_HEADING.test(sourceText)
    || CHINESE_HEADING.test(sourceText)
    || ENGLISH_CONTEXT.test(sourceText)
    || CHINESE_CONTEXT.test(sourceText)
}

function classifyBeat(
  sourceText: string,
  scene: NarrativeSourceScene,
  order: number,
): { type: NarrativeBeatType; ruleId: string; explanation: string } {
  if (containsChineseKeyword(sourceText, TURN_CHINESE) || TURN_ENGLISH.test(sourceText)) {
    return {
      type: 'turn',
      ruleId: 'NARRATIVE_BEAT_TURN_KEYWORD',
      explanation: 'The source unit contains an explicit V1 turn marker.',
    }
  }
  if (containsChineseKeyword(sourceText, GOAL_CHINESE) || GOAL_ENGLISH.test(sourceText)) {
    return {
      type: 'goal',
      ruleId: 'NARRATIVE_BEAT_GOAL_KEYWORD',
      explanation: 'The source unit contains an explicit V1 goal marker.',
    }
  }
  if (containsChineseKeyword(sourceText, REACTION_CHINESE) || REACTION_ENGLISH.test(sourceText)) {
    return {
      type: 'reaction',
      ruleId: 'NARRATIVE_BEAT_REACTION_KEYWORD',
      explanation: 'The source unit contains an explicit V1 reaction marker.',
    }
  }
  if (containsChineseKeyword(sourceText, CLOSURE_CHINESE) || CLOSURE_ENGLISH.test(sourceText)) {
    return {
      type: 'closure',
      ruleId: 'NARRATIVE_BEAT_CLOSURE_KEYWORD',
      explanation: 'The source unit contains an explicit V1 closure marker.',
    }
  }
  if (containsChineseKeyword(sourceText, ACTION_CHINESE) || ACTION_ENGLISH.test(sourceText)) {
    return {
      type: 'action',
      ruleId: 'NARRATIVE_BEAT_ACTION_VERB',
      explanation: 'The source unit contains an explicit V1 action verb.',
    }
  }
  if (isExplicitSetup(sourceText, scene, order)) {
    return {
      type: 'setup',
      ruleId: 'NARRATIVE_BEAT_SETUP_CONTEXT',
      explanation: 'The first source unit explicitly establishes scene context.',
    }
  }
  return {
    type: 'unclassified',
    ruleId: 'NARRATIVE_BEAT_UNCLASSIFIED',
    explanation: 'No deterministic V1 narrative beat rule matched this source unit.',
  }
}

function splitLineAtSentenceBoundaries(line: string) {
  const source = line.trim()
  if (!source) return []

  const units: string[] = []
  let start = 0
  for (const match of source.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length
    const unit = source.slice(start, end).trim()
    if (unit) units.push(unit)
    start = end
  }
  const remainder = source.slice(start).trim()
  if (remainder) units.push(remainder)
  return units
}

function sourceUnits(scene: NarrativeSourceScene) {
  const units: Array<{ sourceText: string; line: number }> = []
  const lines = scene.sourceText.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const trimmed = line.trim()
    if (!trimmed) continue
    const texts = scene.heading && trimmed === scene.heading
      ? [trimmed]
      : splitLineAtSentenceBoundaries(line)
    for (const sourceText of texts) {
      units.push({ sourceText, line: scene.lineStart + index })
    }
  }
  return units
}

export function parseNarrativeBeats(
  scenes: readonly NarrativeSourceScene[],
  sourceNodeId: string,
): NarrativeBeatParseResult {
  if (scenes.length > MAX_SCENES) {
    return { payload: { scenes: [] }, evidence: [], warnings: [], limitExceeded: true }
  }

  const payloadScenes: NarrativeBeatMapPayload['scenes'] = []
  const evidence: CreatorSkillEvidence[] = []
  const warnings: CreatorSkillIssue[] = []
  let totalBeats = 0

  for (const scene of scenes) {
    const units = sourceUnits(scene)
    totalBeats += units.length
    if (totalBeats > MAX_BEATS) {
      return { payload: { scenes: [] }, evidence: [], warnings: [], limitExceeded: true }
    }

    const beats = units.map((unit, index): NarrativeBeatDraft => {
      const order = index + 1
      const classification = classifyBeat(unit.sourceText, scene, order)
      const beat: NarrativeBeatDraft = {
        beatId: `${scene.sceneId}-beat-${String(order).padStart(3, '0')}`,
        sceneId: scene.sceneId,
        order,
        type: classification.type,
        sourceText: unit.sourceText,
        summary: unit.sourceText,
        lineStart: unit.line,
        lineEnd: unit.line,
        reviewStatus: 'pending',
        ...(classification.type === 'unclassified'
          ? { needsReviewReason: 'No deterministic V1 narrative beat rule matched.' }
          : {}),
      }
      evidence.push({
        evidenceId: `narrative-beat-evidence-${String(scene.order).padStart(3, '0')}-${String(order).padStart(3, '0')}`,
        ruleId: classification.ruleId,
        sourceNodeId,
        lineStart: unit.line,
        lineEnd: unit.line,
        excerpt: unit.sourceText,
        explanation: classification.explanation,
      })
      if (classification.type === 'unclassified') {
        warnings.push({
          code: 'NARRATIVE_BEAT_UNCLASSIFIED',
          message: `${beat.beatId} could not be classified by deterministic V1 rules.`,
          sourceNodeId,
        })
      }
      return beat
    })

    payloadScenes.push({
      sceneId: scene.sceneId,
      order: scene.order,
      heading: scene.heading,
      beats,
    })
  }

  return {
    payload: { scenes: payloadScenes },
    evidence,
    warnings,
    limitExceeded: false,
  }
}
