import { createCreatorSkillArtifact } from '../artifacts'
import type {
  CreatorExecutableSkill,
  CreatorSkillManifest,
  CreatorSkillRunResult,
} from '../types'
import { normalizeScriptSource, parseScriptScenes } from './parser'

export type { SceneBreakdownPayload, ScriptSceneDraft } from './types'

export const SCRIPT_SEGMENTATION_MANIFEST: CreatorSkillManifest = {
  id: 'script-segmentation',
  version: '1.0.0',
  name: '剧本分场',
  description: '将文本剧本拆分为可审核的场景结构',
  category: 'story',
  executionPolicy: 'deterministic-local',
  acceptedNodeKinds: ['text'],
  acceptedArtifactTypes: [],
  outputArtifactTypes: ['scene-breakdown'],
  independentlyCallable: true,
}

function blockedResult(
  runFingerprint: string,
  code: string,
  message: string,
): CreatorSkillRunResult {
  return {
    skillId: SCRIPT_SEGMENTATION_MANIFEST.id,
    skillVersion: SCRIPT_SEGMENTATION_MANIFEST.version,
    runFingerprint,
    status: 'blocked',
    artifacts: [],
    evidence: [],
    warnings: [],
    blockers: [{ code, message }],
  }
}

export const SCRIPT_SEGMENTATION_SKILL: CreatorExecutableSkill = {
  manifest: SCRIPT_SEGMENTATION_MANIFEST,
  run(input, runFingerprint) {
    if (input.sourceNodes.length !== 1 || input.sourceNodes[0]?.kind !== 'text') {
      return blockedResult(
        runFingerprint,
        'SCRIPT_SOURCE_COUNT_INVALID',
        'Script segmentation requires exactly one Text source node.',
      )
    }

    const sourceNode = input.sourceNodes[0]
    const effectiveSource = sourceNode.resultText?.trim()
      ? sourceNode.resultText
      : sourceNode.prompt
    const normalizedSource = normalizeScriptSource(effectiveSource)

    if (!normalizedSource.trim()) {
      return blockedResult(
        runFingerprint,
        'SCRIPT_SOURCE_EMPTY',
        'The Text source is empty or contains only whitespace.',
      )
    }
    if (normalizedSource.replace(/\s/gu, '').length < 8) {
      return blockedResult(
        runFingerprint,
        'SCRIPT_SOURCE_TOO_SHORT',
        'The Text source must contain at least 8 non-whitespace characters.',
      )
    }

    const parsed = parseScriptScenes(normalizedSource, sourceNode.id)
    const artifact = createCreatorSkillArtifact({
      artifactId: 'scene-breakdown-001',
      artifactType: 'scene-breakdown',
      artifactVersion: 1,
      sourceNodeIds: [sourceNode.id],
      sourceArtifactIds: [],
      payload: parsed.payload,
    })

    return {
      skillId: SCRIPT_SEGMENTATION_MANIFEST.id,
      skillVersion: SCRIPT_SEGMENTATION_MANIFEST.version,
      runFingerprint,
      status: parsed.warnings.length > 0 ? 'needs-review' : 'ready',
      artifacts: [artifact],
      evidence: parsed.evidence,
      warnings: parsed.warnings,
      blockers: [],
    }
  },
}
