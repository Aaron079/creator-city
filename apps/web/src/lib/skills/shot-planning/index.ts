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
  CreatorSkillSourceNode,
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
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function ownDataDescriptor(value: object, key: string) {
  try {
    return Object.getOwnPropertyDescriptor(value, key)
  } catch {
    return undefined
  }
}

type RunInputSnapshot = {
  sourceNodes: unknown[]
  artifacts: unknown[]
  options?: Record<string, unknown>
}

type RunInputSnapshotResult =
  | { valid: true; snapshot: RunInputSnapshot }
  | {
    valid: false
    code: 'SHOT_SOURCE_INVALID' | 'SHOT_ARTIFACT_INVALID'
    message: string
  }

function invalidRunInput(
  code: 'SHOT_SOURCE_INVALID' | 'SHOT_ARTIFACT_INVALID',
  message: string,
): RunInputSnapshotResult {
  return { valid: false, code, message }
}

function snapshotDenseCollection(value: unknown): unknown[] | null {
  try {
    if (!Array.isArray(value)) return null
    const lengthField = ownDataDescriptor(value, 'length')
    if (!lengthField
      || !('value' in lengthField)
      || !Number.isSafeInteger(lengthField.value)
      || lengthField.value < 0
      || !Object.is(value.length, lengthField.value)) {
      return null
    }

    const snapshot = new Array<unknown>(lengthField.value)
    for (let index = 0; index < lengthField.value; index += 1) {
      const itemField = ownDataDescriptor(value, String(index))
      if (!itemField || !('value' in itemField)) return null
      const item = value[index]
      if (!Object.is(item, itemField.value)) return null
      snapshot[index] = itemField.value
    }
    return snapshot
  } catch {
    return null
  }
}

const SHOT_OPTION_FIELDS = [
  'requestedShotCount',
  'outputMode',
  'pacing',
  'shotSizeStrategy',
  'userInstruction',
] as const

function snapshotShotOptions(value: unknown): Record<string, unknown> | null {
  if (!isPlainRecord(value)) return null
  const snapshot: Record<string, unknown> = {}
  try {
    for (const key of SHOT_OPTION_FIELDS) {
      const field = ownDataDescriptor(value, key)
      if (field !== undefined && !('value' in field)) return null
      const directValue = value[key]
      if (!Object.is(directValue, field?.value)) return null
      if (field) snapshot[key] = field.value
    }
    return snapshot
  } catch {
    return null
  }
}

function snapshotRunInput(value: unknown): RunInputSnapshotResult {
  if (!isPlainRecord(value)) {
    return invalidRunInput('SHOT_SOURCE_INVALID', 'The Skill run input is invalid.')
  }

  const sourceNodesField = ownDataDescriptor(value, 'sourceNodes')
  const artifactsField = ownDataDescriptor(value, 'artifacts')
  const optionsField = ownDataDescriptor(value, 'options')
  const projectContextField = ownDataDescriptor(value, 'projectContext')
  if (!sourceNodesField || !('value' in sourceNodesField)) {
    return invalidRunInput('SHOT_SOURCE_INVALID', 'The sourceNodes collection is invalid.')
  }
  if (artifactsField !== undefined && !('value' in artifactsField)) {
    return invalidRunInput('SHOT_ARTIFACT_INVALID', 'The artifacts collection is invalid.')
  }
  if ((optionsField !== undefined && !('value' in optionsField))
    || (projectContextField !== undefined && !('value' in projectContextField))) {
    return invalidRunInput('SHOT_SOURCE_INVALID', 'The Skill run input fields are invalid.')
  }

  try {
    if (!Object.is(value.sourceNodes, sourceNodesField.value)) {
      return invalidRunInput('SHOT_SOURCE_INVALID', 'The sourceNodes collection is unstable.')
    }
    if (!Object.is(value.artifacts, artifactsField?.value)) {
      return invalidRunInput('SHOT_ARTIFACT_INVALID', 'The artifacts collection is unstable.')
    }
    if (!Object.is(value.options, optionsField?.value)
      || !Object.is(value.projectContext, projectContextField?.value)) {
      return invalidRunInput('SHOT_SOURCE_INVALID', 'The Skill run input fields are unstable.')
    }
  } catch {
    return invalidRunInput('SHOT_SOURCE_INVALID', 'The Skill run input could not be read safely.')
  }

  const sourceNodes = snapshotDenseCollection(sourceNodesField.value)
  if (!sourceNodes) {
    return invalidRunInput('SHOT_SOURCE_INVALID', 'The sourceNodes collection is invalid.')
  }
  const artifactValue = artifactsField?.value
  const artifacts = artifactValue === undefined
    ? []
    : snapshotDenseCollection(artifactValue)
  if (!artifacts) {
    return invalidRunInput('SHOT_ARTIFACT_INVALID', 'The artifacts collection is invalid.')
  }
  const options = optionsField?.value
  const optionSnapshot = options === undefined ? undefined : snapshotShotOptions(options)
  if (optionSnapshot === null) {
    return invalidRunInput('SHOT_SOURCE_INVALID', 'The Skill options are invalid.')
  }

  return {
    valid: true,
    snapshot: {
      sourceNodes,
      artifacts,
      ...(optionSnapshot !== undefined ? { options: optionSnapshot } : {}),
    },
  }
}

function snapshotCanonicalTextSourceNode(
  value: unknown,
): CreatorSkillSourceNode | null {
  if (!isPlainRecord(value)) return null
  const idField = ownDataDescriptor(value, 'id')
  const kindField = ownDataDescriptor(value, 'kind')
  const titleField = ownDataDescriptor(value, 'title')
  const promptField = ownDataDescriptor(value, 'prompt')
  const resultTextField = ownDataDescriptor(value, 'resultText')
  if (!idField || !('value' in idField)
    || !kindField || !('value' in kindField)
    || !titleField || !('value' in titleField)
    || !promptField || !('value' in promptField)
    || (resultTextField !== undefined && !('value' in resultTextField))) {
    return null
  }
  const id = idField.value
  const kind = kindField.value
  const title = titleField.value
  const prompt = promptField.value
  const resultText = resultTextField?.value
  if (typeof id !== 'string'
    || id.length === 0
    || id !== id.trim()
    || kind !== 'text'
    || typeof title !== 'string'
    || typeof prompt !== 'string'
    || (resultText !== undefined && typeof resultText !== 'string')) {
    return null
  }

  try {
    const source = value as Record<string, unknown>
    if (!Object.is(source.id, id)
      || !Object.is(source.kind, kind)
      || !Object.is(source.title, title)
      || !Object.is(source.prompt, prompt)
      || !Object.is(source.resultText, resultText)) {
      return null
    }
  } catch {
    return null
  }

  return {
    id,
    kind: 'text',
    title,
    prompt,
    ...(resultText !== undefined ? { resultText } : {}),
  }
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
    const sceneIds = new Set<string>()
    const sceneOrders = new Set<number>()
    for (let sceneIndex = 0; sceneIndex < value.scenes.length; sceneIndex += 1) {
      const sceneValue = value.scenes[sceneIndex]
      if (!isPlainRecord(sceneValue)
        || !hasExactFields(sceneValue, ['sceneId', 'order', 'heading', 'beats'])
        || !Number.isSafeInteger(sceneValue.order)
        || (sceneValue.order as number) < 1
        || sceneValue.sceneId !== `scene-${String(sceneValue.order).padStart(3, '0')}`
        || sceneIds.has(sceneValue.sceneId as string)
        || sceneOrders.has(sceneValue.order as number)
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
      const beatIds = new Set<string>()
      const beatOrders = new Set<number>()
      for (let index = 0; index < sceneValue.beats.length; index += 1) {
        totalBeats += 1
        if (totalBeats > MAX_SHOTS) return { valid: false, limitExceeded: true }
        const beatValue = sceneValue.beats[index]
        if (!isPlainRecord(beatValue)
          || !hasExactFields(beatValue, [
            'beatId', 'sceneId', 'order', 'type', 'sourceText', 'summary',
            'lineStart', 'lineEnd', 'reviewStatus',
          ], ['needsReviewReason'])
          || !Number.isSafeInteger(beatValue.order)
          || (beatValue.order as number) < 1
          || beatValue.beatId !== `${sceneValue.sceneId}-beat-${String(beatValue.order).padStart(3, '0')}`
          || beatValue.sceneId !== sceneValue.sceneId
          || beatIds.has(beatValue.beatId as string)
          || beatOrders.has(beatValue.order as number)
          || !VALID_BEAT_TYPES.has(beatValue.type as string)
          || typeof beatValue.sourceText !== 'string'
          || !beatValue.sourceText.trim()
          || typeof beatValue.summary !== 'string'
          || !Number.isSafeInteger(beatValue.lineStart)
          || !Number.isSafeInteger(beatValue.lineEnd)
          || (beatValue.lineStart as number) < 1
          || (beatValue.lineEnd as number) < (beatValue.lineStart as number)
          || beatValue.reviewStatus !== 'pending'
          || (beatValue.needsReviewReason !== undefined
            && typeof beatValue.needsReviewReason !== 'string')) {
          return { valid: false, limitExceeded: false }
        }
        beats.push(beatValue as unknown as NarrativeBeatDraft)
        beatIds.add(beatValue.beatId as string)
        beatOrders.add(beatValue.order as number)
      }
      beats.sort((left, right) => left.order - right.order)
      let previousLineStart = 0
      let previousLineEnd = 0
      for (let index = 0; index < beats.length; index += 1) {
        const beat = beats[index]!
        if (index > 0 && (
          beat.lineStart < previousLineStart
          || (beat.lineStart <= previousLineEnd
            && !(beat.lineStart === previousLineStart
              && beat.lineEnd === previousLineEnd))
        )) {
          return { valid: false, limitExceeded: false }
        }
        previousLineStart = beat.lineStart
        previousLineEnd = beat.lineEnd
      }
      scenes.push({
        sceneId: sceneValue.sceneId as string,
        order: sceneValue.order as number,
        heading: sceneValue.heading,
        beats,
      })
      sceneIds.add(sceneValue.sceneId as string)
      sceneOrders.add(sceneValue.order as number)
    }
    scenes.sort((left, right) => left.order - right.order)
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
  return value
    .replace(/\r\n?/g, '\n')
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
}

const SOURCE_UNIT_END_CHARACTERS = new Set(['.', '!', '?', '。', '！', '？'])
const SOURCE_UNIT_CLOSING_CHARACTERS = new Set([
  '"',
  "'",
  '’',
  '”',
  '〉',
  '》',
  '」',
  '】',
])

type NormalizedSourceUnit = {
  text: string
  start: number
  end: number
}

function appendSentenceUnits(
  source: string,
  absoluteOffset: number,
  units: NormalizedSourceUnit[],
) {
  let unitStart = 0
  let cursor = 0
  while (cursor < source.length) {
    if (!SOURCE_UNIT_END_CHARACTERS.has(source[cursor]!)) {
      cursor += 1
      continue
    }

    let unitEnd = cursor + 1
    while (unitEnd < source.length
      && SOURCE_UNIT_END_CHARACTERS.has(source[unitEnd]!)) {
      unitEnd += 1
    }
    if (unitEnd < source.length
      && SOURCE_UNIT_CLOSING_CHARACTERS.has(source[unitEnd]!)) {
      unitEnd += 1
    }
    const text = canonicalText(source.slice(unitStart, unitEnd))
    if (text) {
      units.push({
        text,
        start: absoluteOffset + unitStart,
        end: absoluteOffset + unitEnd,
      })
    }
    unitStart = unitEnd
    cursor = unitEnd
  }

  const remainder = canonicalText(source.slice(unitStart))
  if (remainder) {
    units.push({
      text: remainder,
      start: absoluteOffset + unitStart,
      end: absoluteOffset + source.length,
    })
  }
}

function normalizedSourceUnits(sourceText: string) {
  const source = sourceText.replace(/\r\n?/g, '\n')
  const units: NormalizedSourceUnit[] = []
  appendSentenceUnits(source, 0, units)

  let lineStart = 0
  while (lineStart <= source.length) {
    const newlineOffset = source.indexOf('\n', lineStart)
    const lineEnd = newlineOffset === -1 ? source.length : newlineOffset
    appendSentenceUnits(source.slice(lineStart, lineEnd), lineStart, units)
    if (newlineOffset === -1) break
    lineStart = newlineOffset + 1
  }

  const seen = new Set<string>()
  return units
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .filter((unit) => {
      const key = `${unit.start}:${unit.end}:${unit.text}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function narrativeMatchesText(payload: NarrativeBeatMapPayload, sourceText: string) {
  const sourceUnits = normalizedSourceUnits(sourceText)
  let searchOffset = 0
  for (const scene of payload.scenes) {
    for (const beat of scene.beats) {
      const excerpt = canonicalText(beat.sourceText)
      const match = sourceUnits.find((unit) => (
        unit.start >= searchOffset && unit.text === excerpt
      ))
      if (!match) return false
      searchOffset = match.end
    }
  }
  return true
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
    const runInput = snapshotRunInput(input)
    if (!runInput.valid) {
      return blockedResult(
        runFingerprint,
        runInput.code,
        runInput.message,
      )
    }
    const { sourceNodes, artifacts, options } = runInput.snapshot
    if (sourceNodes.length > 1
      || artifacts.length > 1
      || (sourceNodes.length === 0 && artifacts.length === 0)) {
      return blockedResult(
        runFingerprint,
        'SHOT_SOURCE_COUNT_INVALID',
        'Shot planning requires one Text node, one supported Artifact, or both when they match.',
      )
    }

    const sourceValue = sourceNodes[0]
    const sourceNode = sourceValue
      ? snapshotCanonicalTextSourceNode(sourceValue)
      : null
    if (sourceNodes.length === 1 && !sourceNode) {
      return blockedResult(
        runFingerprint,
        'SHOT_SOURCE_INVALID',
        'The Text source node has invalid identity or fields.',
      )
    }
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

    const artifact = artifacts[0] as CreatorSkillArtifact | undefined
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
    const normalizedOptions = normalizeShotPlanningOptions(options)
    const assembled = assembleShotPlan(units, sourceNodeId, normalizedOptions)
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
