import { createCreatorSkillFingerprint } from '../../skills'
import { createRecipeMaterializationIdentity, createStoryboardDirectorRecipeIdentity } from './identity'
import type {
  RecipeReviewItem,
  StoryboardDirectorFinding,
  StoryboardDirectorRecipe,
} from './types'
import type {
  CreatorSkillArtifact,
  CreatorSkillEvidence,
  NarrativeBeatDraft,
  ScriptSceneDraft,
  ShotPlanDraft,
} from '../../skills'

export type StoryboardDirectorSummary = {
  approvedScenes: number
  approvedBeats: number
  approvedShots: number
  coveredBeats: number
  blockingCount: number
  advisoryCount: number
  sourceFresh: boolean
  ready: boolean
}

const BLOCKING_RULE_ORDER = [
  'RECIPE_SOURCE_STALE',
  'ARTIFACT_LINEAGE_MISMATCH',
  'REVIEW_ITEMS_UNRESOLVED',
  'SCENE_WITHOUT_APPROVED_BEAT',
  'BEAT_WITHOUT_APPROVED_SHOT',
  'SHOT_SCENE_REFERENCE_MISSING',
  'SHOT_BEAT_REFERENCE_MISSING',
  'SHOT_SUBJECT_MISSING',
  'SHOT_ACTION_MISSING',
  'SHOT_EVIDENCE_MISSING',
  'MATERIALIZATION_RECEIPT_CONFLICT',
] as const

const ADVISORY_RULE_ORDER = [
  'SCENE_ESTABLISHING_SHOT_MISSING',
  'REACTION_VISUAL_RESPONSE_MISSING',
  'ADJACENT_SHOT_DUPLICATE',
  'SHOT_SIZE_REPETITION',
  'OUTPUT_KIND_MOTION_MISMATCH',
  'PACING_DURATION_MISMATCH',
  'CHARACTER_NAME_INCONSISTENT',
] as const

type FindingValue = Omit<StoryboardDirectorFinding, 'findingId'>
type ApprovedScene = RecipeReviewItem<ScriptSceneDraft>
type ApprovedBeat = RecipeReviewItem<NarrativeBeatDraft>
type ApprovedShot = RecipeReviewItem<ShotPlanDraft>

function finding(
  recipe: StoryboardDirectorRecipe,
  value: FindingValue,
): StoryboardDirectorFinding {
  const identity = createCreatorSkillFingerprint(
    'storyboard-director-finding',
    '1.0.0',
    {
      sourceNodes: [{
        id: recipe.recipeId,
        kind: 'text',
        title: '',
        prompt: JSON.stringify({
          code: value.code,
          sceneId: value.sceneId ?? '',
          beatId: value.beatId ?? '',
          shotId: value.shotId ?? '',
        }),
      }],
    },
  )
  return { ...value, findingId: identity.replace(/^csf1_/, 'sdrf1_') }
}

function normalizedWords(value: string) {
  return new Set(value.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean))
}

function overlapRatio(left: string, right: string) {
  const a = normalizedWords(left)
  const b = normalizedWords(right)
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const word of a) if (b.has(word)) intersection += 1
  return intersection / Math.max(a.size, b.size)
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function byOrderAndId<T extends { order: number }>(id: (value: T) => string) {
  return (left: T, right: T) => left.order - right.order || compareText(id(left), id(right))
}

function approvedSceneDrafts(recipe: StoryboardDirectorRecipe): ApprovedScene[] {
  return recipe.scene.drafts
    .filter((item) => item.decision === 'approved')
    .slice()
    .sort(byOrderAndId((item) => item.sceneId))
}

function approvedBeatDrafts(recipe: StoryboardDirectorRecipe): ApprovedBeat[] {
  const sceneOrder = new Map(approvedSceneDrafts(recipe).map((item, index) => [item.sceneId, index]))
  return recipe.beat.drafts
    .filter((item) => item.decision === 'approved')
    .slice()
    .sort((left, right) => (
      (sceneOrder.get(left.sceneId) ?? Number.MAX_SAFE_INTEGER)
      - (sceneOrder.get(right.sceneId) ?? Number.MAX_SAFE_INTEGER)
      || compareText(left.sceneId, right.sceneId)
      || left.order - right.order
      || compareText(left.beatId, right.beatId)
    ))
}

function approvedShotDrafts(recipe: StoryboardDirectorRecipe): ApprovedShot[] {
  const sceneOrder = new Map(approvedSceneDrafts(recipe).map((item, index) => [item.sceneId, index]))
  return recipe.shot.drafts
    .filter((item) => item.decision === 'approved')
    .slice()
    .sort((left, right) => (
      (sceneOrder.get(left.sceneId) ?? Number.MAX_SAFE_INTEGER)
      - (sceneOrder.get(right.sceneId) ?? Number.MAX_SAFE_INTEGER)
      || compareText(left.sceneId, right.sceneId)
      || left.order - right.order
      || compareText(left.shotId, right.shotId)
    ))
}

function canonicalEvidence(items: CreatorSkillEvidence[]) {
  const byId = new Map<string, CreatorSkillEvidence>()
  const ordered = items.slice().sort((left, right) => (
    compareText(left.evidenceId, right.evidenceId)
    || compareText(left.ruleId, right.ruleId)
    || compareText(left.sourceNodeId, right.sourceNodeId)
    || left.lineStart - right.lineStart
    || left.lineEnd - right.lineEnd
    || compareText(left.excerpt, right.excerpt)
    || compareText(left.explanation, right.explanation)
  ))
  for (const item of ordered) {
    if (!byId.has(item.evidenceId)) byId.set(item.evidenceId, item)
  }
  return [...byId.values()]
}

function evidenceForRange(
  recipe: StoryboardDirectorRecipe,
  lineStart: number,
  lineEnd: number,
  stage?: 'scene' | 'beat' | 'shot',
) {
  const items = stage
    ? recipe[stage].result?.evidence ?? []
    : [
      ...recipe.scene.result?.evidence ?? [],
      ...recipe.beat.result?.evidence ?? [],
      ...recipe.shot.result?.evidence ?? [],
    ]
  return canonicalEvidence(items).filter((item) => (
    item.sourceNodeId === recipe.sourceNode.id
    && item.lineStart <= lineEnd
    && item.lineEnd >= lineStart
  ))
}

function evidenceIds(items: CreatorSkillEvidence[]) {
  return [...new Set(items.map((item) => item.evidenceId))].sort()
}

function exactSource(sourceIds: string[], expected: string) {
  return sourceIds.length === 1 && sourceIds[0] === expected
}

function currentArtifact(
  artifact: CreatorSkillArtifact | null,
  type: string,
) {
  return Boolean(artifact && artifact.artifactVersion === 1 && artifact.artifactType === type)
}

function resultArtifact(recipe: StoryboardDirectorRecipe, stage: 'scene' | 'beat' | 'shot') {
  const result = recipe[stage].result
  return result?.artifacts.length === 1 ? result.artifacts[0] : undefined
}

function sourceIsStale(recipe: StoryboardDirectorRecipe) {
  try {
    const identity = createStoryboardDirectorRecipeIdentity(
      { projectId: recipe.projectId, workflowId: recipe.workflowId },
      recipe.sourceNode,
    )
    if (identity.recipeId !== recipe.recipeId
      || identity.sourceFingerprint !== recipe.sourceFingerprint) return true
  } catch {
    return true
  }
  if ([recipe.scene, recipe.beat, recipe.shot].some(
    (stage) => stage.sourceFingerprint !== recipe.sourceFingerprint,
  )) return true
  return recipe.activeStage === 'source'
    && [recipe.scene, recipe.beat, recipe.shot].some((stage) => stage.status === 'stale')
}

function lineageMismatch(recipe: StoryboardDirectorRecipe) {
  const sceneResult = resultArtifact(recipe, 'scene')
  const beatResult = resultArtifact(recipe, 'beat')
  const shotResult = resultArtifact(recipe, 'shot')
  const sceneApproved = recipe.scene.approvedArtifact
  const beatApproved = recipe.beat.approvedArtifact
  const shotApproved = recipe.shot.approvedArtifact
  if (!sceneResult || !beatResult || !shotResult
    || !currentArtifact(sceneResult, 'scene-breakdown')
    || !currentArtifact(sceneApproved, 'scene-breakdown')
    || !currentArtifact(beatResult, 'narrative-beat-map')
    || !currentArtifact(beatApproved, 'narrative-beat-map')
    || !currentArtifact(shotResult, 'shot-plan')
    || !currentArtifact(shotApproved, 'shot-plan')) return true
  return !exactSource(sceneApproved!.sourceArtifactIds, sceneResult.artifactId)
    || !exactSource(beatResult.sourceArtifactIds, sceneApproved!.artifactId)
    || !exactSource(beatApproved!.sourceArtifactIds, beatResult.artifactId)
    || !exactSource(shotResult.sourceArtifactIds, beatApproved!.artifactId)
    || !exactSource(shotApproved!.sourceArtifactIds, shotResult.artifactId)
}

function reviewItemsUnresolved(recipe: StoryboardDirectorRecipe) {
  return [recipe.scene, recipe.beat, recipe.shot].some((stage) => (
    stage.status !== 'approved' || stage.drafts.some((item) => item.decision === 'pending')
  ))
}

function receiptConflict(recipe: StoryboardDirectorRecipe) {
  const seen = new Map<string, string>()
  for (const receipt of recipe.receipts.slice().sort((left, right) => (
    compareText(left.identity, right.identity)
    || compareText(left.targetId, right.targetId)
  ))) {
    const previousTarget = seen.get(receipt.identity)
    if (previousTarget !== undefined && previousTarget !== receipt.targetId) return true
    seen.set(receipt.identity, receipt.targetId)
    const artifact = receipt.kind === 'scene'
      ? recipe.scene.approvedArtifact
      : receipt.kind === 'beat'
        ? recipe.beat.approvedArtifact
        : recipe.shot.approvedArtifact
    if (!artifact) return true
    const expected = createRecipeMaterializationIdentity(
      recipe.recipeId,
      receipt.kind,
      artifact.artifactId,
      receipt.resultId,
    )
    if (receipt.identity !== expected) return true
  }
  return false
}

function itemFinding(
  severity: StoryboardDirectorFinding['severity'],
  code: string,
  message: string,
  item?: { sceneId?: string; beatId?: string; shotId?: string },
  ids: string[] = [],
): FindingValue {
  return {
    severity,
    code,
    message,
    ...(item?.sceneId ? { sceneId: item.sceneId } : {}),
    ...(item?.beatId ? { beatId: item.beatId } : {}),
    ...(item?.shotId ? { shotId: item.shotId } : {}),
    evidenceIds: ids,
  }
}

function blockingFindings(recipe: StoryboardDirectorRecipe) {
  const scenes = approvedSceneDrafts(recipe)
  const beats = approvedBeatDrafts(recipe)
  const shots = approvedShotDrafts(recipe)
  const sceneIds = new Set(scenes.map((item) => item.sceneId))
  const beatIds = new Set(beats.map((item) => item.beatId))
  const beatsByScene = new Map<string, ApprovedBeat[]>()
  const shotsByBeat = new Map<string, ApprovedShot[]>()
  for (const beat of beats) {
    const entries = beatsByScene.get(beat.sceneId) ?? []
    entries.push(beat)
    beatsByScene.set(beat.sceneId, entries)
  }
  for (const shot of shots) {
    if (!shot.beatId) continue
    const entries = shotsByBeat.get(shot.beatId) ?? []
    entries.push(shot)
    shotsByBeat.set(shot.beatId, entries)
  }

  const byRule = new Map<string, FindingValue[]>()
  const add = (code: typeof BLOCKING_RULE_ORDER[number], value: FindingValue) => {
    const entries = byRule.get(code) ?? []
    entries.push(value)
    byRule.set(code, entries)
  }
  if (sourceIsStale(recipe)) add('RECIPE_SOURCE_STALE', itemFinding(
    'blocking',
    'RECIPE_SOURCE_STALE',
    'The Recipe source identity no longer matches its reviewed source.',
  ))
  if (lineageMismatch(recipe)) add('ARTIFACT_LINEAGE_MISMATCH', itemFinding(
    'blocking',
    'ARTIFACT_LINEAGE_MISMATCH',
    'The approved artifact chain does not match the active Recipe lineage.',
  ))
  if (reviewItemsUnresolved(recipe)) add('REVIEW_ITEMS_UNRESOLVED', itemFinding(
    'blocking',
    'REVIEW_ITEMS_UNRESOLVED',
    'Every review stage must be approved with no pending decisions.',
  ))
  for (const scene of scenes) {
    if ((beatsByScene.get(scene.sceneId) ?? []).length > 0) continue
    add('SCENE_WITHOUT_APPROVED_BEAT', itemFinding(
      'blocking',
      'SCENE_WITHOUT_APPROVED_BEAT',
      `Approved scene ${scene.sceneId} has no approved beat.`,
      scene,
      evidenceIds(evidenceForRange(recipe, scene.lineStart, scene.lineEnd, 'scene')),
    ))
  }
  for (const beat of beats) {
    if ((shotsByBeat.get(beat.beatId) ?? []).length > 0) continue
    add('BEAT_WITHOUT_APPROVED_SHOT', itemFinding(
      'blocking',
      'BEAT_WITHOUT_APPROVED_SHOT',
      `Approved beat ${beat.beatId} has no approved shot.`,
      beat,
      evidenceIds(evidenceForRange(recipe, beat.lineStart, beat.lineEnd, 'beat')),
    ))
  }
  for (const shot of shots) {
    const ids = evidenceIds(evidenceForRange(recipe, shot.lineStart, shot.lineEnd, 'shot'))
    if (!sceneIds.has(shot.sceneId)) add('SHOT_SCENE_REFERENCE_MISSING', itemFinding(
      'blocking',
      'SHOT_SCENE_REFERENCE_MISSING',
      `Approved shot ${shot.shotId} references a missing approved scene.`,
      shot,
      ids,
    ))
    if (!shot.beatId || !beatIds.has(shot.beatId)) add('SHOT_BEAT_REFERENCE_MISSING', itemFinding(
      'blocking',
      'SHOT_BEAT_REFERENCE_MISSING',
      `Approved shot ${shot.shotId} references a missing approved beat.`,
      shot,
      ids,
    ))
    if (!shot.subject.trim()) add('SHOT_SUBJECT_MISSING', itemFinding(
      'blocking',
      'SHOT_SUBJECT_MISSING',
      `Approved shot ${shot.shotId} has no reviewed subject.`,
      shot,
      ids,
    ))
    if (!shot.action.trim()) add('SHOT_ACTION_MISSING', itemFinding(
      'blocking',
      'SHOT_ACTION_MISSING',
      `Approved shot ${shot.shotId} has no reviewed action.`,
      shot,
      ids,
    ))
    if (ids.length === 0) add('SHOT_EVIDENCE_MISSING', itemFinding(
      'blocking',
      'SHOT_EVIDENCE_MISSING',
      `Approved shot ${shot.shotId} has no explicit source evidence.`,
      shot,
    ))
  }
  if (receiptConflict(recipe)) add('MATERIALIZATION_RECEIPT_CONFLICT', itemFinding(
    'blocking',
    'MATERIALIZATION_RECEIPT_CONFLICT',
    'A materialization receipt conflicts with the current stable identity.',
  ))
  return BLOCKING_RULE_ORDER.flatMap((code) => byRule.get(code) ?? [])
}

function evidenceHasRule(items: CreatorSkillEvidence[], rule: string) {
  const expected = rule.toLocaleLowerCase().replace(/_/gu, '-')
  return items.some((item) => (
    item.ruleId.toLocaleLowerCase().replace(/_/gu, '-') === expected
  ))
}

function normalizedName(value: string) {
  return [...normalizedWords(value.normalize('NFKC'))].join(' ')
}

function looseName(value: string) {
  return [...normalizedWords(value.normalize('NFKD').replace(/\p{M}+/gu, ''))].join(' ')
}

function advisoryFindings(recipe: StoryboardDirectorRecipe) {
  const scenes = approvedSceneDrafts(recipe)
  const beats = approvedBeatDrafts(recipe)
  const shots = approvedShotDrafts(recipe)
  const shotsByScene = new Map<string, ApprovedShot[]>()
  const shotsByBeat = new Map<string, ApprovedShot[]>()
  for (const shot of shots) {
    const sceneShots = shotsByScene.get(shot.sceneId) ?? []
    sceneShots.push(shot)
    shotsByScene.set(shot.sceneId, sceneShots)
    if (shot.beatId) {
      const beatShots = shotsByBeat.get(shot.beatId) ?? []
      beatShots.push(shot)
      shotsByBeat.set(shot.beatId, beatShots)
    }
  }
  const byRule = new Map<string, FindingValue[]>()
  const add = (code: typeof ADVISORY_RULE_ORDER[number], value: FindingValue) => {
    const entries = byRule.get(code) ?? []
    entries.push(value)
    byRule.set(code, entries)
  }

  for (const scene of scenes) {
    const sceneBeats = beats.filter((beat) => beat.sceneId === scene.sceneId)
    const hasSetupEvidence = Boolean(scene.location?.trim())
      || sceneBeats.some((beat) => beat.type === 'setup')
    const sceneShots = shotsByScene.get(scene.sceneId) ?? []
    if (hasSetupEvidence && !sceneShots.some(
      (shot) => shot.suggestedShotSize === 'wide' || shot.suggestedShotSize === 'full',
    )) add('SCENE_ESTABLISHING_SHOT_MISSING', itemFinding(
      'advisory',
      'SCENE_ESTABLISHING_SHOT_MISSING',
      `Scene ${scene.sceneId} has explicit setup evidence but no wide or full shot.`,
      scene,
      evidenceIds(evidenceForRange(recipe, scene.lineStart, scene.lineEnd, 'scene')),
    ))
  }

  for (const beat of beats) {
    if (beat.type !== 'reaction' && beat.type !== 'turn') continue
    const linked = shotsByBeat.get(beat.beatId) ?? []
    if (linked.length > 0) continue
    add('REACTION_VISUAL_RESPONSE_MISSING', itemFinding(
      'advisory',
      'REACTION_VISUAL_RESPONSE_MISSING',
      `Reaction or turn beat ${beat.beatId} has no linked approved shot.`,
      beat,
      evidenceIds(evidenceForRange(recipe, beat.lineStart, beat.lineEnd, 'beat')),
    ))
  }

  for (const scene of scenes) {
    const sceneShots = shotsByScene.get(scene.sceneId) ?? []
    for (let index = 1; index < sceneShots.length; index += 1) {
      const previous = sceneShots[index - 1]!
      const current = sceneShots[index]!
      const previousText = `${previous.objective} ${previous.action}`
      const currentText = `${current.objective} ${current.action}`
      if (current.suggestedShotSize !== previous.suggestedShotSize
        || overlapRatio(previousText, currentText) < 0.8) continue
      add('ADJACENT_SHOT_DUPLICATE', itemFinding(
        'advisory',
        'ADJACENT_SHOT_DUPLICATE',
        `Adjacent shot ${current.shotId} substantially duplicates the preceding shot.`,
        current,
        evidenceIds(evidenceForRange(recipe, current.lineStart, current.lineEnd, 'shot')),
      ))
    }
  }

  for (const scene of scenes) {
    const sceneShots = shotsByScene.get(scene.sceneId) ?? []
    let start = 0
    while (start < sceneShots.length) {
      let end = start + 1
      while (end < sceneShots.length
        && sceneShots[end]!.suggestedShotSize === sceneShots[start]!.suggestedShotSize) end += 1
      if (end - start >= 4) {
        const affected = sceneShots[end - 1]!
        add('SHOT_SIZE_REPETITION', itemFinding(
          'advisory',
          'SHOT_SIZE_REPETITION',
          `Scene ${scene.sceneId} repeats one shot size for ${end - start} consecutive shots.`,
          affected,
          evidenceIds(evidenceForRange(recipe, affected.lineStart, affected.lineEnd, 'shot')),
        ))
      }
      start = end
    }
  }

  for (const shot of shots) {
    const items = evidenceForRange(recipe, shot.lineStart, shot.lineEnd, 'shot')
    if (shot.outputKind !== 'image' || !evidenceHasRule(items, 'sustained-movement')) continue
    add('OUTPUT_KIND_MOTION_MISMATCH', itemFinding(
      'advisory',
      'OUTPUT_KIND_MOTION_MISMATCH',
      `Shot ${shot.shotId} assigns explicit sustained movement evidence to an image output.`,
      shot,
      evidenceIds(items),
    ))
  }

  if (recipe.shot.options.pacing === 'fast_social') {
    for (const shot of shots) {
      if (shot.duration !== 10) continue
      add('PACING_DURATION_MISMATCH', itemFinding(
        'advisory',
        'PACING_DURATION_MISMATCH',
        `Fast social pacing assigns 10 seconds to shot ${shot.shotId}.`,
        shot,
        evidenceIds(evidenceForRange(recipe, shot.lineStart, shot.lineEnd, 'shot')),
      ))
    }
  } else if (recipe.shot.options.pacing === 'slow_cinematic') {
    for (const scene of scenes) {
      const sceneShots = shotsByScene.get(scene.sceneId) ?? []
      let start = 0
      while (start < sceneShots.length) {
        let end = start
        while (end < sceneShots.length && sceneShots[end]!.duration === 5) end += 1
        if (end - start >= 3) {
          const affected = sceneShots[end - 1]!
          add('PACING_DURATION_MISMATCH', itemFinding(
            'advisory',
            'PACING_DURATION_MISMATCH',
            `Slow cinematic pacing uses ${end - start} consecutive 5-second shots.`,
            affected,
            evidenceIds(evidenceForRange(recipe, affected.lineStart, affected.lineEnd, 'shot')),
          ))
        }
        start = end === start ? start + 1 : end
      }
    }
  }

  const sceneCharacters = new Map(scenes.map((scene) => [
    scene.sceneId,
    scene.characters.map((name) => ({
      exact: normalizedName(name),
      loose: looseName(name),
    })),
  ]))
  for (const shot of shots) {
    const exact = normalizedName(shot.subject)
    const loose = looseName(shot.subject)
    if (!exact || !loose) continue
    const variant = (sceneCharacters.get(shot.sceneId) ?? []).some(
      (character) => character.loose === loose && character.exact !== exact,
    )
    if (!variant) continue
    add('CHARACTER_NAME_INCONSISTENT', itemFinding(
      'advisory',
      'CHARACTER_NAME_INCONSISTENT',
      `Shot ${shot.shotId} uses a character-name variant inconsistent with the approved scene.`,
      shot,
      evidenceIds(evidenceForRange(recipe, shot.lineStart, shot.lineEnd, 'shot')),
    ))
  }
  return ADVISORY_RULE_ORDER.flatMap((code) => byRule.get(code) ?? [])
}

export function analyzeStoryboardDirectorRecipe(recipe: StoryboardDirectorRecipe) {
  const values = [...blockingFindings(recipe), ...advisoryFindings(recipe)]
  const seen = new Set<string>()
  const findings: StoryboardDirectorFinding[] = []
  for (const value of values) {
    const key = [
      value.code,
      value.sceneId ?? '',
      value.beatId ?? '',
      value.shotId ?? '',
    ].join('\u0000')
    if (seen.has(key)) continue
    seen.add(key)
    findings.push(finding(recipe, value))
  }
  return findings
}

export function isStoryboardRecipeMaterializationReady(recipe: StoryboardDirectorRecipe) {
  return recipe.scene.status === 'approved'
    && recipe.beat.status === 'approved'
    && recipe.shot.status === 'approved'
    && analyzeStoryboardDirectorRecipe(recipe).every((item) => item.severity !== 'blocking')
}

export function summarizeStoryboardDirectorRecipe(
  recipe: StoryboardDirectorRecipe,
): StoryboardDirectorSummary {
  const findings = analyzeStoryboardDirectorRecipe(recipe)
  const approvedBeats = approvedBeatDrafts(recipe)
  const approvedShots = approvedShotDrafts(recipe)
  const covered = new Set(approvedShots.map((shot) => shot.beatId).filter(Boolean))
  return {
    approvedScenes: approvedSceneDrafts(recipe).length,
    approvedBeats: approvedBeats.length,
    approvedShots: approvedShots.length,
    coveredBeats: approvedBeats.filter((beat) => covered.has(beat.beatId)).length,
    blockingCount: findings.filter((item) => item.severity === 'blocking').length,
    advisoryCount: findings.filter((item) => item.severity === 'advisory').length,
    sourceFresh: !findings.some((item) => item.code === 'RECIPE_SOURCE_STALE'),
    ready: recipe.scene.status === 'approved'
      && recipe.beat.status === 'approved'
      && recipe.shot.status === 'approved'
      && findings.every((item) => item.severity !== 'blocking'),
  }
}
