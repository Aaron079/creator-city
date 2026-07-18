import { createCreatorSkillArtifact } from '../artifacts'
import type {
  CreatorExecutableSkill,
  CreatorSkillArtifact,
  CreatorSkillManifest,
  CreatorSkillRunResult,
} from '../types'
import {
  deriveNarrativeSourceScenes,
  parseNarrativeBeats,
  readSceneBreakdownPayload,
  scenesMatchSource,
} from './parser'

const MIN_SOURCE_CHARACTERS = 8
const WHITESPACE_CODE_POINT = /\s/u

export type {
  NarrativeBeatDraft,
  NarrativeBeatMapPayload,
  NarrativeBeatType,
} from './types'

export const NARRATIVE_BEAT_ANALYSIS_MANIFEST: CreatorSkillManifest = {
  id: 'narrative-beat-analysis',
  version: '1.0.0',
  name: '叙事节拍分析',
  description: '识别可审核的建立、目标、行动、反应、转折与收束',
  category: 'story',
  executionPolicy: 'deterministic-local',
  acceptedNodeKinds: ['text'],
  acceptedArtifactTypes: ['scene-breakdown'],
  outputArtifactTypes: ['narrative-beat-map'],
  independentlyCallable: true,
}

function blockedResult(
  runFingerprint: string,
  code: string,
  message: string,
): CreatorSkillRunResult {
  return {
    skillId: NARRATIVE_BEAT_ANALYSIS_MANIFEST.id,
    skillVersion: NARRATIVE_BEAT_ANALYSIS_MANIFEST.version,
    runFingerprint,
    status: 'blocked',
    artifacts: [],
    evidence: [],
    warnings: [],
    blockers: [{ code, message }],
  }
}

function isCanonicalIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim()
}

function isCanonicalIdentifierArray(value: unknown) {
  if (!Array.isArray(value)) return false
  let previous: string | undefined
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false
    const identifier = value[index]
    if (!isCanonicalIdentifier(identifier)
      || (previous !== undefined && previous >= identifier)) {
      return false
    }
    previous = identifier
  }
  return true
}

function hasMinimumSourceCharacters(sourceTexts: Iterable<string>) {
  let count = 0
  for (const sourceText of sourceTexts) {
    for (const codePoint of sourceText) {
      if (WHITESPACE_CODE_POINT.test(codePoint)) continue
      count += 1
      if (count >= MIN_SOURCE_CHARACTERS) return true
    }
  }
  return false
}

function* artifactSourceTexts(
  scenes: readonly { sourceText: string }[],
): Iterable<string> {
  for (let index = 0; index < scenes.length; index += 1) {
    yield scenes[index]!.sourceText
  }
}

function validateSceneArtifact(artifact: CreatorSkillArtifact | undefined) {
  try {
    if (!artifact
      || !isCanonicalIdentifier(artifact.artifactId)
      || artifact.artifactType !== 'scene-breakdown'
      || artifact.artifactVersion !== 1
      || !isCanonicalIdentifierArray(artifact.sourceNodeIds)
      || artifact.sourceNodeIds.length !== 1
      || !isCanonicalIdentifierArray(artifact.sourceArtifactIds)) {
      return null
    }
    const payload = readSceneBreakdownPayload(artifact.payload)
    if (!payload.valid) return null
    return {
      sourceNodeId: artifact.sourceNodeIds[0]!,
      scenes: payload.scenes,
    }
  } catch {
    return null
  }
}

function canonicalPairingText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/\s+/gu, ' ')
}

function singleHeadedSceneBodyMatchesSource(
  scenes: readonly { heading: string; sourceText: string }[],
  sourceText: string,
) {
  if (scenes.length !== 1) return false
  const scene = scenes[0]!
  if (!scene.heading) return false
  const headingLineEnd = scene.sourceText.indexOf('\n')
  if (headingLineEnd === -1
    || scene.sourceText.slice(0, headingLineEnd) !== scene.heading) {
    return false
  }
  const canonicalBody = scene.sourceText.slice(headingLineEnd + 1)
  return canonicalPairingText(sourceText) === canonicalPairingText(canonicalBody)
}

export const NARRATIVE_BEAT_ANALYSIS_SKILL: CreatorExecutableSkill = {
  manifest: NARRATIVE_BEAT_ANALYSIS_MANIFEST,
  run(input, runFingerprint) {
    const artifacts = input.artifacts ?? []
    const nodeCount = input.sourceNodes.length
    const artifactCount = artifacts.length
    if (nodeCount > 1
      || artifactCount > 1
      || (nodeCount === 0 && artifactCount === 0)
      || (nodeCount === 1 && input.sourceNodes[0]?.kind !== 'text')) {
      return blockedResult(
        runFingerprint,
        'NARRATIVE_SOURCE_COUNT_INVALID',
        'Narrative beat analysis requires one Text node, one scene-breakdown Artifact, or both when they match.',
      )
    }

    const sourceNode = input.sourceNodes[0]
    const effectiveSource = sourceNode
      ? (sourceNode.resultText?.trim() ? sourceNode.resultText : sourceNode.prompt)
        .replace(/\r\n/g, '\n')
      : null
    if (effectiveSource !== null && !effectiveSource.trim()) {
      return blockedResult(
        runFingerprint,
        'NARRATIVE_SOURCE_EMPTY',
        'The Text source is empty or contains only whitespace.',
      )
    }
    if (effectiveSource !== null
      && !hasMinimumSourceCharacters([effectiveSource])) {
      return blockedResult(
        runFingerprint,
        'NARRATIVE_SOURCE_TOO_SHORT',
        'The Text source must contain at least 8 non-whitespace characters.',
      )
    }

    const artifact = artifacts[0]
    const validatedArtifact = artifact ? validateSceneArtifact(artifact) : null
    if (artifact && !validatedArtifact) {
      return blockedResult(
        runFingerprint,
        'NARRATIVE_SCENE_ARTIFACT_INVALID',
        'The scene-breakdown Artifact is not a canonical version 1 payload.',
      )
    }
    if (!sourceNode && validatedArtifact
      && !hasMinimumSourceCharacters(artifactSourceTexts(validatedArtifact.scenes))) {
      return blockedResult(
        runFingerprint,
        'NARRATIVE_SOURCE_TOO_SHORT',
        'The scene-breakdown source must contain at least 8 non-whitespace characters.',
      )
    }

    if (sourceNode && validatedArtifact
      && !scenesMatchSource(validatedArtifact.scenes, effectiveSource!)
      && !singleHeadedSceneBodyMatchesSource(validatedArtifact.scenes, effectiveSource!)) {
      return blockedResult(
        runFingerprint,
        'NARRATIVE_SOURCE_CONFLICT',
        'The Text source conflicts with the scene-breakdown source identity, content, or ranges.',
      )
    }

    const derived = effectiveSource !== null && !validatedArtifact
      ? deriveNarrativeSourceScenes(effectiveSource)
      : null
    if (derived?.sceneLimitExceeded) {
      return blockedResult(
        runFingerprint,
        'NARRATIVE_BEAT_LIMIT_EXCEEDED',
        'Narrative beat analysis supports at most 40 scenes and 120 beats.',
      )
    }

    const scenes = validatedArtifact?.scenes ?? derived?.scenes ?? []
    const sourceNodeId = validatedArtifact?.sourceNodeId ?? sourceNode!.id
    const parsed = parseNarrativeBeats(scenes, sourceNodeId)
    if (parsed.limitExceeded) {
      return blockedResult(
        runFingerprint,
        'NARRATIVE_BEAT_LIMIT_EXCEEDED',
        'Narrative beat analysis supports at most 40 scenes and 120 beats.',
      )
    }

    const outputArtifact = createCreatorSkillArtifact({
      artifactId: 'narrative-beat-map-001',
      artifactType: 'narrative-beat-map',
      artifactVersion: 1,
      sourceNodeIds: [sourceNodeId],
      sourceArtifactIds: artifact ? [artifact.artifactId] : [],
      payload: parsed.payload,
    })

    return {
      skillId: NARRATIVE_BEAT_ANALYSIS_MANIFEST.id,
      skillVersion: NARRATIVE_BEAT_ANALYSIS_MANIFEST.version,
      runFingerprint,
      status: parsed.warnings.length > 0 ? 'needs-review' : 'ready',
      artifacts: [outputArtifact],
      evidence: parsed.evidence,
      warnings: parsed.warnings,
      blockers: [],
    }
  },
}
