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

function validateSceneArtifact(artifact: CreatorSkillArtifact | undefined) {
  if (!artifact
    || artifact.artifactType !== 'scene-breakdown'
    || artifact.artifactVersion !== 1
    || artifact.sourceNodeIds.length !== 1
    || !artifact.sourceNodeIds[0]
    || artifact.sourceArtifactIds.length !== 0) {
    return null
  }
  const payload = readSceneBreakdownPayload(artifact.payload)
  if (!payload.valid) return null
  return {
    sourceNodeId: artifact.sourceNodeIds[0],
    scenes: payload.scenes,
  }
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
      && Array.from(effectiveSource.replace(/\s/gu, '')).length < 8) {
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
      && Array.from(
        validatedArtifact.scenes
          .map((scene) => scene.sourceText)
          .join('')
          .replace(/\s/gu, ''),
      ).length < 8) {
      return blockedResult(
        runFingerprint,
        'NARRATIVE_SOURCE_TOO_SHORT',
        'The scene-breakdown source must contain at least 8 non-whitespace characters.',
      )
    }

    if (sourceNode && validatedArtifact
      && (validatedArtifact.sourceNodeId !== sourceNode.id
        || !scenesMatchSource(validatedArtifact.scenes, effectiveSource!))) {
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
    const sourceNodeId = sourceNode?.id ?? validatedArtifact!.sourceNodeId
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
