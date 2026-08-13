import { resolveLocalCinematicKnowledge } from '../../creative-knowledge/resolver'
import {
  createStoryboardDirectorAdvisoryId,
  createStoryboardDirectorAdvisoryInputFingerprint,
} from './identity'
import type {
  StoryboardDirectorAdvisoryHandling,
  StoryboardDirectorFinding,
  StoryboardDirectorRecipe,
} from './types'

const LOCAL_ADVISORY_DOMAINS = [
  'script',
  'cinematography',
  'composition',
  'lighting',
  'continuity',
] as const

type AdvisoryCandidate = {
  code: string
  message: string
  ruleIds: string[]
  evidenceIds: string[]
  scope: Record<string, string>
  findingScope: Pick<StoryboardDirectorFinding, 'sceneId' | 'beatId' | 'shotId'>
}

type EvidenceTarget = {
  stage: 'scene' | 'beat' | 'shot'
  lineStart: number
  lineEnd: number
}

function approved<T extends { decision: string }>(
  stage: { status: string; drafts: T[] },
) {
  return stage.status === 'approved'
    ? stage.drafts.filter((draft) => draft.decision === 'approved')
    : []
}

function advisoryFinding(
  recipe: StoryboardDirectorRecipe,
  candidate: AdvisoryCandidate,
  selectionFingerprint: string,
): StoryboardDirectorFinding {
  const inputFingerprint = createStoryboardDirectorAdvisoryInputFingerprint(
    recipe,
    candidate.ruleIds,
    candidate.scope,
  )
  const findingId = createStoryboardDirectorAdvisoryId(inputFingerprint)
  return {
    findingId,
    severity: 'advisory',
    code: candidate.code,
    message: candidate.message,
    evidenceIds: candidate.evidenceIds,
    ...candidate.findingScope,
    advisory: {
      ruleIds: candidate.ruleIds,
      inputFingerprint,
      selectionFingerprint,
      handling: advisoryHandlingFor(recipe, findingId, inputFingerprint, selectionFingerprint),
    },
  }
}

function selectedRuleIds(
  availableRuleIds: ReadonlySet<string>,
  requiredRuleIds: readonly string[],
) {
  return requiredRuleIds.every((ruleId) => availableRuleIds.has(ruleId))
    ? Array.from(requiredRuleIds)
    : []
}

function approvedEvidenceIds(
  recipe: StoryboardDirectorRecipe,
  targets: EvidenceTarget[],
) {
  const evidenceIds = new Set<string>()
  for (const target of targets) {
    for (const evidence of recipe[target.stage].result?.evidence ?? []) {
      if (evidence.sourceNodeId === recipe.sourceNode.id
        && evidence.lineStart <= target.lineEnd
        && evidence.lineEnd >= target.lineStart) {
        evidenceIds.add(evidence.evidenceId)
      }
    }
  }
  return [...evidenceIds].sort()
}

export function advisoryHandlingFor(
  recipe: StoryboardDirectorRecipe,
  advisoryId: string,
  inputFingerprint: string,
  selectionFingerprint: string,
): StoryboardDirectorAdvisoryHandling {
  const decision = (recipe.advisoryDecisions ?? []).find((candidate) => (
    candidate.advisoryId === advisoryId
    && candidate.inputFingerprint === inputFingerprint
    && candidate.selectionFingerprint === selectionFingerprint
  ))
  return decision?.decision ?? 'open'
}

export function evaluateStoryboardDirectorAdvisories(recipe: StoryboardDirectorRecipe) {
  const selection = resolveLocalCinematicKnowledge({
    domains: LOCAL_ADVISORY_DOMAINS,
    allowedUse: 'retrieval',
  })
  const availableRuleIds = new Set(selection.records.map((record) => record.knowledgeId))
  const scenes = approved(recipe.scene)
  const beats = approved(recipe.beat)
  const shots = approved(recipe.shot)
  const candidates: AdvisoryCandidate[] = []

  const narrativeRuleIds = selectedRuleIds(availableRuleIds, ['script-scene-objective'])
  const narrativeBeat = beats.find((beat) => beat.type === 'reaction' || beat.type === 'turn')
  const narrativeShot = narrativeBeat
    ? shots.find((shot) => shot.beatId === narrativeBeat.beatId)
    : undefined
  const narrativeEvidenceIds = narrativeBeat && narrativeShot
    ? approvedEvidenceIds(recipe, [
      { stage: 'beat', lineStart: narrativeBeat.lineStart, lineEnd: narrativeBeat.lineEnd },
      { stage: 'shot', lineStart: narrativeShot.lineStart, lineEnd: narrativeShot.lineEnd },
    ])
    : []
  if (narrativeRuleIds.length && narrativeBeat && narrativeShot && narrativeEvidenceIds.length) {
    candidates.push({
      code: 'LOCAL_NARRATIVE_PURPOSE_REVIEW',
      message: '请人工确认该转折或反应镜头的叙事目的与场景变化一致。',
      ruleIds: narrativeRuleIds,
      evidenceIds: narrativeEvidenceIds,
      scope: { beatId: narrativeBeat.beatId, shotId: narrativeShot.shotId },
      findingScope: { beatId: narrativeBeat.beatId, shotId: narrativeShot.shotId },
    })
  }

  const compositionRuleIds = selectedRuleIds(availableRuleIds, ['composition-subject-hierarchy'])
  const compositionScene = scenes.find((scene) => scene.characters.length > 1)
  const compositionShot = compositionScene
    ? shots.find((shot) => shot.sceneId === compositionScene.sceneId)
    : undefined
  const compositionEvidenceIds = compositionScene && compositionShot
    ? approvedEvidenceIds(recipe, [
      { stage: 'scene', lineStart: compositionScene.lineStart, lineEnd: compositionScene.lineEnd },
      { stage: 'shot', lineStart: compositionShot.lineStart, lineEnd: compositionShot.lineEnd },
    ])
    : []
  if (compositionRuleIds.length && compositionScene && compositionShot && compositionEvidenceIds.length) {
    candidates.push({
      code: 'LOCAL_COMPOSITION_HIERARCHY_REVIEW',
      message: '请人工确认多角色场景中该镜头的视觉主体层级清晰可读。',
      ruleIds: compositionRuleIds,
      evidenceIds: compositionEvidenceIds,
      scope: { sceneId: compositionScene.sceneId, shotId: compositionShot.shotId },
      findingScope: { sceneId: compositionScene.sceneId, shotId: compositionShot.shotId },
    })
  }

  const continuityRuleIds = selectedRuleIds(availableRuleIds, [
    'cinematic-screen-direction',
    'continuity-action-match',
    'continuity-eyeline',
  ])
  const continuityScene = scenes.find((scene) => (
    shots.filter((shot) => shot.sceneId === scene.sceneId).length >= 2
  ))
  const continuityShots = continuityScene
    ? shots.filter((shot) => shot.sceneId === continuityScene.sceneId).slice(0, 2)
    : []
  const continuityEvidenceIds = continuityScene && continuityShots.length === 2
    ? approvedEvidenceIds(recipe, [
      { stage: 'scene', lineStart: continuityScene.lineStart, lineEnd: continuityScene.lineEnd },
      ...continuityShots.map((shot) => ({
        stage: 'shot' as const,
        lineStart: shot.lineStart,
        lineEnd: shot.lineEnd,
      })),
    ])
    : []
  if (continuityRuleIds.length && continuityScene && continuityShots.length === 2
    && continuityEvidenceIds.length) {
    candidates.push({
      code: 'LOCAL_CONTINUITY_CONFIRMATION',
      message: '连续镜头的动作、视线与屏幕方向需要人工确认；本地规则不会把它判定为既成错误。',
      ruleIds: continuityRuleIds,
      evidenceIds: continuityEvidenceIds,
      scope: {
        sceneId: continuityScene.sceneId,
        firstShotId: continuityShots[0]!.shotId,
        secondShotId: continuityShots[1]!.shotId,
      },
      findingScope: {
        sceneId: continuityScene.sceneId,
        shotId: continuityShots[1]!.shotId,
      },
    })
  }

  const lightingRuleIds = selectedRuleIds(availableRuleIds, ['lighting-motivation'])
  const lightingScene = scenes.find((scene) => Boolean(scene.location?.trim() && scene.timeOfDay?.trim()))
  const lightingShot = lightingScene
    ? shots.find((shot) => shot.sceneId === lightingScene.sceneId)
    : undefined
  const lightingEvidenceIds = lightingScene && lightingShot
    ? approvedEvidenceIds(recipe, [
      { stage: 'scene', lineStart: lightingScene.lineStart, lineEnd: lightingScene.lineEnd },
      { stage: 'shot', lineStart: lightingShot.lineStart, lineEnd: lightingShot.lineEnd },
    ])
    : []
  if (lightingRuleIds.length && lightingScene && lightingShot && lightingEvidenceIds.length) {
    candidates.push({
      code: 'LOCAL_LIGHTING_MOTIVATION_REVIEW',
      message: '请人工确认该场景的时间与空间信息是否支撑清晰的关键光源动机。',
      ruleIds: lightingRuleIds,
      evidenceIds: lightingEvidenceIds,
      scope: { sceneId: lightingScene.sceneId, shotId: lightingShot.shotId },
      findingScope: { sceneId: lightingScene.sceneId, shotId: lightingShot.shotId },
    })
  }

  return {
    findings: candidates.map((candidate) => (
      advisoryFinding(recipe, candidate, selection.receipt.selectionFingerprint)
    )),
    receipt: selection.receipt,
  }
}
