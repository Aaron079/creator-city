import type { CreatorSkillEvidence, CreatorSkillIssue } from '../types'
import type {
  PlannedShotSize,
  ShotOutputKind,
  ShotPlanDraft,
  ShotPlanPayload,
  ShotPlanningOptions,
  ShotSourceUnit,
} from './types'

const MAX_SHOTS = 120
const REACTION_CUE = /反应|愣住|震惊|哭|笑|reaction\b|gasps?\b|smiles?\b/iu
const TURN_CUE = /但是|然而|却|突然|不料|反而|\bbut\b|\bhowever\b|\bsuddenly\b|\binstead\b/iu
const SPATIAL_CUE = /进入|离开|走进|走出|穿过|转场|换到|enters?\b|exits?\b|crosses?\b|moves?\s+(?:into|from|to)\b/iu
const ENGLISH_ACTION = /\b(?:is|are|was|were|has|have|wants?|must|decides?|tries?|opens?|closes?|walks?|runs?|ran|takes?|took|enters?|exits?|crosses?|moves?|gasps?|smiles?|cries?|looks?|stands?|sits?|turns?|steps?|fades?|repairs?|fills?)\b/iu
const CHINESE_ACTION = /想要|必须|决定|试图|希望|打开|关闭|进入|离开|走进|走出|穿过|走|跑|拿|推|拉|冲|看向|站起|坐下|愣住|震惊|哭|笑|退后|沉默|消失|修好/u

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function readPlainValue(value: Record<string, unknown>, key: string) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return descriptor && 'value' in descriptor ? descriptor.value : undefined
  } catch {
    return undefined
  }
}

function isOutputMode(value: unknown): value is ShotPlanningOptions['outputMode'] {
  return value === 'image' || value === 'video' || value === 'mixed'
}

function isPacing(value: unknown): value is ShotPlanningOptions['pacing'] {
  return value === 'slow_cinematic' || value === 'standard' || value === 'fast_social'
}

function isStrategy(value: unknown): value is ShotPlanningOptions['shotSizeStrategy'] {
  return value === 'auto'
    || value === 'wide_to_close'
    || value === 'close_heavy'
    || value === 'wide_heavy'
}

export function normalizeShotPlanningOptions(
  value: Record<string, unknown> | undefined,
): ShotPlanningOptions {
  const options = isPlainRecord(value) ? value : undefined
  const requestedValue = options ? readPlainValue(options, 'requestedShotCount') : undefined
  const requestedCandidate = requestedValue ?? 5
  let requested = 5
  try {
    requested = Number(requestedCandidate)
  } catch {
    requested = 5
  }
  const outputMode = options ? readPlainValue(options, 'outputMode') : undefined
  const pacing = options ? readPlainValue(options, 'pacing') : undefined
  const strategy = options ? readPlainValue(options, 'shotSizeStrategy') : undefined
  const instruction = options ? readPlainValue(options, 'userInstruction') : undefined

  return {
    requestedShotCount: Number.isInteger(requested)
      ? Math.min(MAX_SHOTS, Math.max(1, requested))
      : 5,
    outputMode: isOutputMode(outputMode) ? outputMode : 'mixed',
    pacing: isPacing(pacing) ? pacing : 'standard',
    shotSizeStrategy: isStrategy(strategy) ? strategy : 'auto',
    userInstruction: typeof instruction === 'string' ? instruction.trim() : '',
  }
}

export function chooseShotSize(unit: ShotSourceUnit): PlannedShotSize {
  if (/特写|眼睛|手指|细节|表情|extreme close|insert\b/iu.test(unit.text)) return 'extreme-close'
  if (/反应|愣住|震惊|哭|笑|reaction\b|gasps?\b|smiles?\b/iu.test(unit.text)) return 'close'
  if (/环境|城市|街道|房间|全貌|establishing|landscape|street\b|room\b/iu.test(unit.text)) return 'wide'
  if (/全身|站起|奔跑|走过|full body|runs?\b|walks?\b/iu.test(unit.text)) return 'full'
  return 'medium'
}

function applyShotSizeStrategy(
  automatic: PlannedShotSize,
  strategy: ShotPlanningOptions['shotSizeStrategy'],
  index: number,
  total: number,
): PlannedShotSize {
  if (strategy === 'auto') return automatic
  if (strategy === 'wide_heavy') return 'wide'
  if (strategy === 'close_heavy') return index % 2 === 0 ? 'close' : 'extreme-close'
  const ratio = index / Math.max(total - 1, 1)
  if (ratio < 0.25) return 'wide'
  if (ratio < 0.5) return 'medium'
  if (ratio < 0.75) return 'close'
  return 'extreme-close'
}

function outputKind(
  mode: ShotPlanningOptions['outputMode'],
  index: number,
): ShotOutputKind {
  if (mode !== 'mixed') return mode
  return index % 2 === 0 ? 'image' : 'video'
}

function duration(
  pacing: ShotPlanningOptions['pacing'],
  size: PlannedShotSize,
): 5 | 10 {
  if (pacing === 'fast_social') return 5
  if (pacing === 'slow_cinematic') {
    return size === 'wide' || size === 'extreme-close' ? 10 : 5
  }
  return size === 'wide' ? 10 : 5
}

type DerivedContent = {
  objective: string
  subject: string
  action: string
  needsReviewReason?: string
}

function cleanSubject(value: string) {
  return value
    .replace(/^[\s,，;；:：.!?。！？]*(?:and|but|however|suddenly)?\s*/iu, '')
    .replace(/[\s,，;；:：.!?。！？]+$/u, '')
    .trim()
}

function deriveContent(text: string): DerivedContent {
  const englishAction = ENGLISH_ACTION.exec(text)
  const chineseAction = CHINESE_ACTION.exec(text)
  const match = !englishAction
    ? chineseAction
    : !chineseAction || englishAction.index <= chineseAction.index
      ? englishAction
      : chineseAction
  if (!match) {
    return {
      objective: text,
      subject: '',
      action: text,
      needsReviewReason: 'A reliable subject or action could not be isolated from the source evidence.',
    }
  }

  const subject = cleanSubject(text.slice(0, match.index))
  if (!subject) {
    return {
      objective: text,
      subject: '',
      action: text,
      needsReviewReason: 'A reliable subject or action could not be isolated from the source evidence.',
    }
  }
  return {
    objective: text,
    subject,
    action: text.slice(match.index).trim(),
  }
}

function supplementalClause(text: string) {
  const matches = [REACTION_CUE.exec(text), TURN_CUE.exec(text), SPATIAL_CUE.exec(text)]
    .filter((match): match is RegExpExecArray => Boolean(match))
    .sort((left, right) => left.index - right.index)
  const match = matches[0]
  if (!match) return null

  let start = 0
  for (let index = match.index - 1; index >= 0; index -= 1) {
    if (',，;；.!?。！？'.includes(text[index]!)) {
      start = index + 1
      break
    }
  }
  const clause = text.slice(start).trim()
  return clause && clause !== text.trim() ? clause : text.trim()
}

type PlannedEntry = {
  unit: ShotSourceUnit
  content: DerivedContent
  planningText: string
  supplemental: boolean
}

export type ShotPlanningAssembly = {
  payload: ShotPlanPayload
  evidence: CreatorSkillEvidence[]
  warnings: CreatorSkillIssue[]
  limitExceeded: boolean
  hasNeedsReview: boolean
}

export function assembleShotPlan(
  units: readonly ShotSourceUnit[],
  sourceNodeId: string,
  options: ShotPlanningOptions,
): ShotPlanningAssembly {
  if (units.length > MAX_SHOTS) {
    return {
      payload: { scenes: [] },
      evidence: [],
      warnings: [],
      limitExceeded: true,
      hasNeedsReview: false,
    }
  }

  const entries: PlannedEntry[] = units.map((unit) => ({
    unit,
    content: deriveContent(unit.text),
    planningText: unit.text,
    supplemental: false,
  }))
  if (entries.length < options.requestedShotCount) {
    let index = 0
    while (index < entries.length && entries.length < options.requestedShotCount) {
      const entry = entries[index]!
      if (!entry.supplemental) {
        const clause = supplementalClause(entry.unit.text)
        if (clause) {
          entries.splice(index + 1, 0, {
            unit: entry.unit,
            content: deriveContent(clause),
            planningText: clause,
            supplemental: true,
          })
          index += 1
        }
      }
      index += 1
    }
  }

  const warnings: CreatorSkillIssue[] = []
  if (units.length > options.requestedShotCount) {
    warnings.push({
      code: 'SHOT_COUNT_TARGET_EXCEEDED',
      message: 'Explicit source beats require more primary shots than the requested target.',
      sourceNodeId,
    })
  } else if (entries.length < options.requestedShotCount) {
    warnings.push({
      code: 'SHOT_COUNT_TARGET_UNDERSUPPLIED',
      message: 'The source does not contain enough explicit evidence to reach the requested target.',
      sourceNodeId,
    })
  }

  const payloadScenes: ShotPlanPayload['scenes'] = []
  const evidence: CreatorSkillEvidence[] = []
  let globalIndex = 0
  let hasNeedsReview = false

  for (const entry of entries) {
    let scene = payloadScenes[payloadScenes.length - 1]
    if (!scene || scene.sceneId !== entry.unit.sceneId) {
      scene = {
        sceneId: entry.unit.sceneId,
        order: entry.unit.sceneOrder,
        heading: entry.unit.heading,
        shots: [],
      }
      payloadScenes.push(scene)
    }
    const order = scene.shots.length + 1
    const shotIndex = globalIndex
    const automaticSize = chooseShotSize({
      ...entry.unit,
      text: entry.planningText,
    })
    const suggestedShotSize = applyShotSizeStrategy(
      automaticSize,
      options.shotSizeStrategy,
      shotIndex,
      entries.length,
    )
    const shot: ShotPlanDraft = {
      shotId: `${entry.unit.sceneId}-shot-${String(order).padStart(3, '0')}`,
      sceneId: entry.unit.sceneId,
      ...(entry.unit.beatId ? { beatId: entry.unit.beatId } : {}),
      order,
      ...entry.content,
      suggestedShotSize,
      sourceText: entry.unit.text,
      lineStart: entry.unit.lineStart,
      lineEnd: entry.unit.lineEnd,
      outputKind: outputKind(options.outputMode, shotIndex),
      duration: duration(options.pacing, suggestedShotSize),
      reviewStatus: 'pending',
    }
    scene.shots.push(shot)
    evidence.push({
      evidenceId: `shot-plan-evidence-${String(entry.unit.sceneOrder).padStart(3, '0')}-${String(order).padStart(3, '0')}`,
      ruleId: entry.supplemental
        ? 'SHOT_EXPLICIT_SUPPLEMENTAL_CLAUSE'
        : 'SHOT_PRIMARY_SOURCE_UNIT',
      sourceNodeId,
      lineStart: entry.unit.lineStart,
      lineEnd: entry.unit.lineEnd,
      excerpt: entry.unit.text,
      explanation: entry.supplemental
        ? 'An explicit reaction, turn, or spatial transition supports this supplemental shot.'
        : 'One primary shot is preserved for this explicit source unit.',
    })
    if (entry.content.needsReviewReason) hasNeedsReview = true
    globalIndex += 1
  }

  if (hasNeedsReview) {
    warnings.push({
      code: 'SHOT_SOURCE_NEEDS_REVIEW',
      message: 'At least one shot lacks a reliably isolated subject or action.',
      sourceNodeId,
    })
  }

  return {
    payload: { scenes: payloadScenes },
    evidence,
    warnings,
    limitExceeded: false,
    hasNeedsReview,
  }
}
