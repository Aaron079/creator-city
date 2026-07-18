import { createCreatorSkillArtifact, isCreatorSkillArtifact } from '../artifacts'
import {
  deriveNarrativeSourceScenes,
  parseNarrativeBeats,
  readSceneBreakdownPayload,
  scenesMatchSource,
  type NarrativeSourceScene,
} from '../narrative-beat-analysis/parser'
import type {
  NarrativeBeatDraft,
  NarrativeBeatMapPayload,
} from '../narrative-beat-analysis/types'
import type {
  CreatorExecutableSkill,
  CreatorSkillArtifact,
  CreatorSkillManifest,
  CreatorSkillRunResult,
} from '../types'
import {
  assembleShotPlan,
  chooseShotSize,
  normalizeShotPlanningOptions,
} from './planner'
import type { ShotSourceUnit } from './types'

const MAX_SCENES = 40
const MAX_SHOTS = 120
const MIN_SOURCE_CHARACTERS = 8
const VALID_BEAT_TYPES = new Set([
  'setup',
  'goal',
  'action',
  'reaction',
  'turn',
  'closure',
  'unclassified',
])

export type {
  PlannedShotSize,
  ShotOutputKind,
  ShotPlanDraft,
  ShotPlanningOptions,
  ShotPlanPayload,
  ShotSourceUnit,
} from './types'
export { chooseShotSize, normalizeShotPlanningOptions }

export const SHOT_PLANNING_MANIFEST: CreatorSkillManifest = {
  id: 'shot-planning',
  version: '1.0.0',
  name: '分镜清单生成器',
  description: '根据明确叙事证据规划可审核镜头',
  category: 'camera',
  executionPolicy: 'deterministic-local',
  acceptedNodeKinds: ['text'],
  acceptedArtifactTypes: ['scene-breakdown', 'narrative-beat-map'],
  outputArtifactTypes: ['shot-plan'],
  independentlyCallable: true,
}

function blockedResult(
  runFingerprint: string,
  code: string,
  message: string,
): CreatorSkillRunResult {
  return {
    skillId: SHOT_PLANNING_MANIFEST.id,
    skillVersion: SHOT_PLANNING_MANIFEST.version,
    runFingerprint,
    status: 'blocked',
    artifacts: [],
    evidence: [],
    warnings: [],
    blockers: [{ code, message }],
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false
  }
  return true
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

function readCanonicalArtifact(value: CreatorSkillArtifact | undefined) {
  try {
    if (!value || !isCreatorSkillArtifact(value)) return null
    return {
      artifactId: value.artifactId,
      artifactType: value.artifactType,
      artifactVersion: value.artifactVersion,
      sourceNodeIds: value.sourceNodeIds.slice(),
      sourceArtifactIds: value.sourceArtifactIds.slice(),
      payload: value.payload,
    } satisfies CreatorSkillArtifact
  } catch {
    return null
  }
}

function sceneBreakdownExceedsLimit(value: unknown) {
  try {
    return isPlainRecord(value)
      && Array.isArray(value.scenes)
      && value.scenes.length > MAX_SCENES
  } catch {
    return false
  }
}

type NarrativeReadResult =
  | { valid: true; payload: NarrativeBeatMapPayload }
  | { valid: false; limitExceeded: boolean }

function readNarrativeBeatMap(value: unknown): NarrativeReadResult {
  try {
    if (!isPlainRecord(value)
      || !hasExactFields(value, ['scenes'])
      || !Array.isArray(value.scenes)
      || value.scenes.length === 0
      || value.scenes.length > MAX_SCENES) {
      return { valid: false, limitExceeded: false }
    }
    if (!isDenseArray(value.scenes)) return { valid: false, limitExceeded: false }
    const scenes: NarrativeBeatMapPayload['scenes'] = []
    let totalBeats = 0
    let previousSceneOrder = 0
    for (const sceneValue of value.scenes) {
      if (!isPlainRecord(sceneValue)
        || !hasExactFields(sceneValue, ['sceneId', 'order', 'heading', 'beats'])
        || !Number.isSafeInteger(sceneValue.order)
        || (sceneValue.order as number) <= previousSceneOrder
        || sceneValue.sceneId !== `scene-${String(sceneValue.order).padStart(3, '0')}`
        || typeof sceneValue.heading !== 'string'
        || !Array.isArray(sceneValue.beats)
        || sceneValue.beats.length === 0) {
        return { valid: false, limitExceeded: false }
      }
      if (sceneValue.beats.length > MAX_SHOTS - totalBeats) {
        return { valid: false, limitExceeded: true }
      }
      if (!isDenseArray(sceneValue.beats)) {
        return { valid: false, limitExceeded: false }
      }
      const beats: NarrativeBeatDraft[] = []
      let previousLineStart = 0
      let previousLineEnd = 0
      for (let index = 0; index < sceneValue.beats.length; index += 1) {
        totalBeats += 1
        if (totalBeats > MAX_SHOTS) return { valid: false, limitExceeded: true }
        const beatValue = sceneValue.beats[index]
        if (!isPlainRecord(beatValue)
          || !hasExactFields(beatValue, [
            'beatId', 'sceneId', 'order', 'type', 'sourceText', 'summary',
            'lineStart', 'lineEnd', 'reviewStatus',
          ], ['needsReviewReason'])
          || beatValue.beatId !== `${sceneValue.sceneId}-beat-${String(index + 1).padStart(3, '0')}`
          || beatValue.sceneId !== sceneValue.sceneId
          || beatValue.order !== index + 1
          || !VALID_BEAT_TYPES.has(beatValue.type as string)
          || typeof beatValue.sourceText !== 'string'
          || !beatValue.sourceText.trim()
          || typeof beatValue.summary !== 'string'
          || !Number.isSafeInteger(beatValue.lineStart)
          || !Number.isSafeInteger(beatValue.lineEnd)
          || (beatValue.lineStart as number) < 1
          || (beatValue.lineEnd as number) < (beatValue.lineStart as number)
          || (index > 0 && (
            (beatValue.lineStart as number) < previousLineStart
            || ((beatValue.lineStart as number) < previousLineEnd
              && !((beatValue.lineStart as number) === previousLineStart
                && (beatValue.lineEnd as number) === previousLineEnd))
          ))
          || beatValue.reviewStatus !== 'pending'
          || (beatValue.needsReviewReason !== undefined
            && typeof beatValue.needsReviewReason !== 'string')) {
          return { valid: false, limitExceeded: false }
        }
        beats.push(beatValue as unknown as NarrativeBeatDraft)
        previousLineStart = beatValue.lineStart as number
        previousLineEnd = beatValue.lineEnd as number
      }
      scenes.push({
        sceneId: sceneValue.sceneId as string,
        order: sceneValue.order as number,
        heading: sceneValue.heading,
        beats,
      })
      previousSceneOrder = sceneValue.order as number
    }
    return { valid: true, payload: { scenes } }
  } catch {
    return { valid: false, limitExceeded: false }
  }
}

function unitsFromNarrative(payload: NarrativeBeatMapPayload): ShotSourceUnit[] {
  const units: ShotSourceUnit[] = []
  for (const scene of payload.scenes) {
    for (const beat of scene.beats) {
      units.push({
        sceneId: scene.sceneId,
        sceneOrder: scene.order,
        heading: scene.heading,
        beatId: beat.beatId,
        beatType: beat.type,
        text: beat.sourceText,
        lineStart: beat.lineStart,
        lineEnd: beat.lineEnd,
      })
    }
  }
  return units
}

function parseScenesToUnits(scenes: readonly NarrativeSourceScene[], sourceNodeId: string) {
  const parsed = parseNarrativeBeats(scenes, sourceNodeId)
  return {
    units: parsed.limitExceeded ? [] : unitsFromNarrative(parsed.payload),
    limitExceeded: parsed.limitExceeded,
  }
}

function canonicalText(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\s/gu, '')
}

function narrativeMatchesText(payload: NarrativeBeatMapPayload, sourceText: string) {
  let artifactText = ''
  for (const scene of payload.scenes) {
    for (const beat of scene.beats) artifactText += beat.sourceText
  }
  return canonicalText(artifactText) === canonicalText(sourceText)
}

function hasMinimumSource(sourceText: string) {
  let count = 0
  for (const character of sourceText) {
    if (/\s/u.test(character)) continue
    count += 1
    if (count >= MIN_SOURCE_CHARACTERS) return true
  }
  return false
}

export const SHOT_PLANNING_SKILL: CreatorExecutableSkill = {
  manifest: SHOT_PLANNING_MANIFEST,
  run(input, runFingerprint) {
    const artifacts = input.artifacts ?? []
    if (input.sourceNodes.length > 1
      || artifacts.length > 1
      || (input.sourceNodes.length === 0 && artifacts.length === 0)
      || (input.sourceNodes.length === 1 && input.sourceNodes[0]?.kind !== 'text')) {
      return blockedResult(
        runFingerprint,
        'SHOT_SOURCE_COUNT_INVALID',
        'Shot planning requires one Text node, one supported Artifact, or both when they match.',
      )
    }

    const sourceNode = input.sourceNodes[0]
    const sourceText = sourceNode
      ? (sourceNode.resultText?.trim() ? sourceNode.resultText : sourceNode.prompt)
        .replace(/\r\n/g, '\n')
      : null
    if (sourceText !== null && !sourceText.trim()) {
      return blockedResult(runFingerprint, 'SHOT_SOURCE_EMPTY', 'The Text source is empty.')
    }
    if (sourceText !== null && !hasMinimumSource(sourceText)) {
      return blockedResult(
        runFingerprint,
        'SHOT_SOURCE_TOO_SHORT',
        'The Text source must contain at least 8 non-whitespace characters.',
      )
    }

    const artifact = artifacts[0]
    const canonicalArtifact = readCanonicalArtifact(artifact)
    if (artifact && (!canonicalArtifact
      || canonicalArtifact.artifactVersion !== 1
      || !SHOT_PLANNING_MANIFEST.acceptedArtifactTypes.includes(
        canonicalArtifact.artifactType,
      )
      || canonicalArtifact.sourceNodeIds.length !== 1)) {
      return blockedResult(
        runFingerprint,
        'SHOT_ARTIFACT_INVALID',
        'The input Artifact is not a canonical supported version 1 payload.',
      )
    }

    let units: ShotSourceUnit[] = []
    let artifactMatches = true
    if (canonicalArtifact?.artifactType === 'scene-breakdown') {
      if (sceneBreakdownExceedsLimit(canonicalArtifact.payload)) {
        return blockedResult(
          runFingerprint,
          'SHOT_LIMIT_EXCEEDED',
          'Shot planning supports at most 40 scenes and 120 shots.',
        )
      }
      const read = readSceneBreakdownPayload(canonicalArtifact.payload)
      if (!read.valid) {
        return blockedResult(
          runFingerprint,
          'SHOT_ARTIFACT_INVALID',
          'The scene-breakdown payload is invalid.',
        )
      }
      const parsed = parseScenesToUnits(
        read.scenes,
        sourceNode?.id ?? canonicalArtifact.sourceNodeIds[0]!,
      )
      if (parsed.limitExceeded) {
        return blockedResult(
          runFingerprint,
          'SHOT_LIMIT_EXCEEDED',
          'Shot planning supports at most 120 shots.',
        )
      }
      units = parsed.units
      artifactMatches = sourceText === null || scenesMatchSource(read.scenes, sourceText)
    } else if (canonicalArtifact?.artifactType === 'narrative-beat-map') {
      const read = readNarrativeBeatMap(canonicalArtifact.payload)
      if (!read.valid) {
        return blockedResult(
          runFingerprint,
          read.limitExceeded ? 'SHOT_LIMIT_EXCEEDED' : 'SHOT_ARTIFACT_INVALID',
          read.limitExceeded
            ? 'Shot planning supports at most 120 shots.'
            : 'The narrative-beat-map payload is invalid.',
        )
      }
      units = unitsFromNarrative(read.payload)
      artifactMatches = sourceText === null || narrativeMatchesText(read.payload, sourceText)
    } else if (sourceText !== null) {
      const derived = deriveNarrativeSourceScenes(sourceText)
      if (derived.sceneLimitExceeded) {
        return blockedResult(
          runFingerprint,
          'SHOT_LIMIT_EXCEEDED',
          'Shot planning supports at most 40 scenes and 120 shots.',
        )
      }
      const parsed = parseScenesToUnits(derived.scenes, sourceNode!.id)
      if (parsed.limitExceeded) {
        return blockedResult(
          runFingerprint,
          'SHOT_LIMIT_EXCEEDED',
          'Shot planning supports at most 120 shots.',
        )
      }
      units = parsed.units
    }

    if (!artifactMatches) {
      return blockedResult(
        runFingerprint,
        'SHOT_SOURCE_CONFLICT',
        'The Text source conflicts with the approved Artifact.',
      )
    }
    if (units.length === 0) {
      return blockedResult(
        runFingerprint,
        'SHOT_SOURCE_INVALID',
        'The input does not contain a supported source unit.',
      )
    }

    const sourceNodeId = sourceNode?.id ?? canonicalArtifact!.sourceNodeIds[0]!
    const options = normalizeShotPlanningOptions(input.options)
    const assembled = assembleShotPlan(units, sourceNodeId, options)
    if (assembled.limitExceeded) {
      return blockedResult(
        runFingerprint,
        'SHOT_LIMIT_EXCEEDED',
        'Shot planning supports at most 120 shots.',
      )
    }
    const outputArtifact = createCreatorSkillArtifact({
      artifactId: 'shot-plan-001',
      artifactType: 'shot-plan',
      artifactVersion: 1,
      sourceNodeIds: [sourceNodeId],
      sourceArtifactIds: canonicalArtifact ? [canonicalArtifact.artifactId] : [],
      payload: assembled.payload,
    })

    return {
      skillId: SHOT_PLANNING_MANIFEST.id,
      skillVersion: SHOT_PLANNING_MANIFEST.version,
      runFingerprint,
      status: assembled.warnings.length > 0 || assembled.hasNeedsReview
        ? 'needs-review'
        : 'ready',
      artifacts: [outputArtifact],
      evidence: assembled.evidence,
      warnings: assembled.warnings,
      blockers: [],
    }
  },
}
