/**
 * Unit tests for the Storyboard Director Recipe state machine.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/storyboard/recipe/stateMachine.test.ts
 */
import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import {
  runCreatorSkill,
  type CreatorSkillRunResult,
  type CreatorSkillSourceNode,
  type NarrativeBeatMapPayload,
  type SceneBreakdownPayload,
  type ShotPlanPayload,
} from '../../skills'
import { storyboardDirectorRecipeMetadata } from './persistence'
import type { StoryboardDirectorRecipe, StoryboardDirectorStageId } from './types'
import {
  approveBeatStage,
  approveSceneStage,
  approveShotStage,
  changeImpactForStage,
  createRecipeOperationToken,
  createStoryboardDirectorRecipe,
  invalidateRecipeAfter,
  isRecipeOperationCurrent,
  markRecipeSourceFreshness,
  markRecipeSourceMissing,
  moveRecipeDraft,
  rerunRecipeStage,
  setRecipeDecision,
  updateRecipeDraft,
} from './state-machine'

const ISO_TIME = '2026-07-19T01:00:00.000Z'
const LATER_TIME = '2026-07-19T02:00:00.000Z'
const context = { projectId: 'project-1', workflowId: 'workflow-1' }
const source: CreatorSkillSourceNode = {
  id: 'source-1',
  kind: 'text',
  title: 'Pilot',
  prompt: [
    'INT. LAB - NIGHT',
    'Mara opens the sealed case. She recoils.',
    '',
    'EXT. ROOF - DAWN',
    'Mara runs toward the antenna. The alarm sounds.',
  ].join('\n'),
}

const calls: string[] = []
const runner: typeof runCreatorSkill = (skillId, input, version) => {
  calls.push(skillId)
  return runCreatorSkill(skillId, input, version)
}

function stageDrafts(
  recipe: StoryboardDirectorRecipe,
  stageId: Exclude<StoryboardDirectorStageId, 'source'>,
) {
  if (stageId === 'scene-review') return recipe.scene.drafts
  if (stageId === 'beat-review') return recipe.beat.drafts
  return recipe.shot.drafts
}

function itemId(
  stageId: Exclude<StoryboardDirectorStageId, 'source'>,
  item: Record<string, unknown>,
) {
  if (stageId === 'scene-review') return item.sceneId as string
  if (stageId === 'beat-review') return item.beatId as string
  return item.shotId as string
}

function decideAll(
  recipe: StoryboardDirectorRecipe,
  stageId: Exclude<StoryboardDirectorStageId, 'source'>,
  decision: 'approved' | 'rejected',
) {
  return stageDrafts(recipe, stageId).reduce(
    (next, item) => setRecipeDecision(
      next,
      stageId,
      itemId(stageId, item as unknown as Record<string, unknown>),
      decision,
      ISO_TIME,
    ),
    recipe,
  )
}

function approvedBeatRecipe(skillRunner: typeof runCreatorSkill = runner) {
  const started = createStoryboardDirectorRecipe(context, source, ISO_TIME, skillRunner)
  const sceneReview = decideAll(started, 'scene-review', 'approved')
  const beatReview = approveSceneStage(sceneReview, ISO_TIME, skillRunner)
  return decideAll(beatReview, 'beat-review', 'approved')
}

function completedRecipe(skillRunner: typeof runCreatorSkill = runner) {
  const throughBeat = approvedBeatRecipe(skillRunner)
  const shotReview = approveBeatStage(throughBeat, ISO_TIME, skillRunner)
  return approveShotStage(decideAll(shotReview, 'shot-review', 'approved'), ISO_TIME)
}

function malformedResult(
  result: CreatorSkillRunResult,
  payload: unknown,
): CreatorSkillRunResult {
  const artifact = result.artifacts[0]
  assert.ok(artifact)
  return {
    ...result,
    artifacts: [{ ...artifact, payload }],
  }
}

type ReviewResultStage = 'scene' | 'beat' | 'shot'
type ResultMutation = (result: CreatorSkillRunResult) => CreatorSkillRunResult

function mutatedRunner(
  targetSkillId: string,
  mutate: ResultMutation,
): typeof runCreatorSkill {
  return (skillId, input, version) => {
    const result = runCreatorSkill(skillId, input, version)
    return skillId === targetSkillId
      ? mutate(structuredClone(result))
      : result
  }
}

function recipeWithMutatedResult(stage: ReviewResultStage, mutate: ResultMutation) {
  if (stage === 'scene') {
    return createStoryboardDirectorRecipe(
      context,
      source,
      ISO_TIME,
      mutatedRunner('script-segmentation', mutate),
    )
  }
  if (stage === 'beat') {
    const started = createStoryboardDirectorRecipe(context, source, ISO_TIME)
    return approveSceneStage(
      decideAll(started, 'scene-review', 'approved'),
      ISO_TIME,
      mutatedRunner('narrative-beat-analysis', mutate),
    )
  }
  return approveBeatStage(
    approvedBeatRecipe(runCreatorSkill),
    ISO_TIME,
    mutatedRunner('shot-planning', mutate),
  )
}

function assertMalformedStageBlocked(
  recipe: StoryboardDirectorRecipe,
  stage: ReviewResultStage,
) {
  const review = stage === 'scene' ? recipe.scene : stage === 'beat' ? recipe.beat : recipe.shot
  assert.equal(review.status, 'blocked')
  assert.deepEqual(review.drafts, [])
  if (stage === 'scene') {
    assert.throws(() => approveSceneStage(recipe, ISO_TIME), /blocked/i)
  } else if (stage === 'beat') {
    assert.throws(() => approveBeatStage(recipe, ISO_TIME), /blocked/i)
  } else {
    assert.throws(() => approveShotStage(recipe, ISO_TIME), /blocked/i)
  }
}

function mutateArtifact(
  result: CreatorSkillRunResult,
  mutate: (artifact: CreatorSkillRunResult['artifacts'][number]) => void,
) {
  const artifact = result.artifacts[0]
  assert.ok(artifact)
  mutate(artifact)
  return result
}

function hostilePayload(trap: 'prototype' | 'descriptor' | 'property') {
  if (trap === 'prototype') {
    return new Proxy({}, {
      getPrototypeOf() {
        throw new Error('hostile payload prototype')
      },
    })
  }
  if (trap === 'descriptor') {
    return new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error('hostile payload descriptor')
      },
    })
  }
  return new Proxy({ scenes: [] }, {
    get(target, property, receiver) {
      if (property === 'scenes') throw new Error('hostile payload property')
      return Reflect.get(target, property, receiver)
    },
  })
}

function paragraphScript(sceneCount: number) {
  return Array.from(
    { length: sceneCount },
    (_, index) => `Scene ${index + 1} contains enough explicit action for review.`,
  ).join('\n\n')
}

beforeEach(() => {
  calls.length = 0
})

describe('Storyboard Director Recipe progression', () => {
  test('start runs only public script-segmentation and leaves every scene pending', () => {
    const recipe = createStoryboardDirectorRecipe(context, source, ISO_TIME, runner)

    assert.deepEqual(calls, ['script-segmentation'])
    assert.equal(recipe.activeStage, 'scene-review')
    assert.equal(recipe.scene.status, 'needs-review')
    assert.ok(recipe.scene.drafts.every((scene) => scene.decision === 'pending'))
    assert.equal(recipe.beat.status, 'idle')
    assert.equal(recipe.shot.status, 'idle')
    assert.equal(recipe.audit.createdAt, ISO_TIME)
    assert.equal(recipe.audit.updatedAt, ISO_TIME)
  })

  test('creation canonicalizes whitespace in context and source fields before every run', () => {
    const started = createStoryboardDirectorRecipe(
      { projectId: '  project-1  ', workflowId: '  workflow-1  ' },
      {
        ...source,
        id: '  source-1  ',
        title: '  Pilot  ',
        prompt: `  \n${source.prompt}\n  `,
      },
      ISO_TIME,
      runner,
    )

    assert.equal(started.projectId, 'project-1')
    assert.equal(started.workflowId, 'workflow-1')
    assert.deepEqual(started.sourceNode, {
      id: 'source-1',
      kind: 'text',
      title: 'Pilot',
      prompt: source.prompt,
    })
    assert.equal(started.scene.status, 'needs-review')
    assert.deepEqual(started.scene.result?.artifacts[0]?.sourceNodeIds, ['source-1'])

    const beatReview = approveSceneStage(
      decideAll(started, 'scene-review', 'approved'),
      ISO_TIME,
      runner,
    )
    assert.equal(beatReview.beat.status, 'needs-review')
    const shotReview = approveBeatStage(
      decideAll(beatReview, 'beat-review', 'approved'),
      ISO_TIME,
      runner,
    )
    assert.equal(shotReview.shot.status, 'needs-review')
    assert.deepEqual(calls, [
      'script-segmentation',
      'narrative-beat-analysis',
      'shot-planning',
    ])
  })

  test('scene approval automatically runs narrative analysis with approved Artifact only', () => {
    const started = createStoryboardDirectorRecipe(context, source, ISO_TIME, runner)
    const decided = decideAll(started, 'scene-review', 'approved')
    const next = approveSceneStage(decided, ISO_TIME, runner)

    assert.deepEqual(calls.slice(-1), ['narrative-beat-analysis'])
    assert.equal(next.scene.status, 'approved')
    assert.equal(next.activeStage, 'beat-review')
    assert.ok(next.scene.approvedArtifact)
    assert.ok(next.beat.result?.artifacts[0]?.sourceArtifactIds.includes(
      next.scene.approvedArtifact.artifactId,
    ))
    assert.ok(next.beat.drafts.every((beat) => beat.decision === 'pending'))
  })

  test('beat approval automatically runs shot planning and final approval never generates', () => {
    const throughBeat = approvedBeatRecipe(runner)
    const shotReview = approveBeatStage(throughBeat, ISO_TIME, runner)

    assert.equal(calls.at(-1), 'shot-planning')
    assert.equal(shotReview.activeStage, 'shot-review')
    const approved = approveShotStage(
      decideAll(shotReview, 'shot-review', 'approved'),
      ISO_TIME,
    )
    assert.equal(approved.shot.status, 'approved')
    assert.ok(approved.shot.approvedArtifact)
    assert.equal(calls.filter((id) => id === 'shot-planning').length, 1)
    assert.equal(calls.length, 3)
  })

  test('pending decisions, blocked results, and empty approvals cannot advance', () => {
    const started = createStoryboardDirectorRecipe(context, source, ISO_TIME, runner)
    assert.throws(() => approveSceneStage(started, ISO_TIME, runner), /unresolved/i)
    assert.throws(
      () => approveSceneStage(
        decideAll(started, 'scene-review', 'rejected'),
        ISO_TIME,
        runner,
      ),
      /at least one approved/i,
    )

    const blocked = createStoryboardDirectorRecipe(
      context,
      { ...source, prompt: 'Tiny' },
      ISO_TIME,
      runner,
    )
    assert.equal(blocked.scene.status, 'blocked')
    assert.throws(() => approveSceneStage(blocked, ISO_TIME, runner), /blocked/i)
  })

  test('editing approved scene invalidates beat and shot but preserves stale results', () => {
    const completed = completedRecipe(runner)
    const edited = updateRecipeDraft(
      completed,
      'scene-review',
      completed.scene.drafts[0]!.sceneId,
      { actionSummary: 'Reviewed action' },
      LATER_TIME,
    )

    assert.equal(edited.activeStage, 'scene-review')
    assert.equal(edited.scene.status, 'needs-review')
    assert.equal(edited.scene.approvedArtifact, null)
    assert.equal(edited.beat.status, 'stale')
    assert.equal(edited.shot.status, 'stale')
    assert.ok(edited.beat.staleResult)
    assert.ok(edited.shot.staleResult)
    assert.equal(edited.beat.result, null)
    assert.equal(edited.shot.result, null)
    assert.equal(edited.audit.updatedAt, LATER_TIME)
  })

  test('stale downstream stages cannot be revived after an approved scene edit', () => {
    const completed = completedRecipe(runner)
    const edited = updateRecipeDraft(
      completed,
      'scene-review',
      completed.scene.drafts[0]!.sceneId,
      { actionSummary: 'Reviewed action' },
      LATER_TIME,
    )
    const beat = edited.beat.drafts[0]!
    const shot = edited.shot.drafts[0]!

    assert.throws(
      () => setRecipeDecision(edited, 'beat-review', beat.beatId, 'rejected', LATER_TIME),
      /stale|reviewable/i,
    )
    assert.throws(
      () => updateRecipeDraft(edited, 'shot-review', shot.shotId, { objective: 'Revived' }, LATER_TIME),
      /stale|reviewable/i,
    )
    assert.throws(
      () => moveRecipeDraft(edited, 'beat-review', beat.beatId, 1, LATER_TIME),
      /stale|reviewable/i,
    )
    assert.equal(edited.activeStage, 'scene-review')
    assert.equal(edited.beat.status, 'stale')
    assert.equal(edited.shot.status, 'stale')
    assert.equal(edited.beat.result, null)
    assert.equal(edited.shot.result, null)
  })

  test('review mutations reject idle, blocked, finalized decisions, and missing upstream approval', () => {
    const started = createStoryboardDirectorRecipe(context, source, ISO_TIME)
    assert.throws(
      () => updateRecipeDraft(started, 'beat-review', 'missing-beat', { summary: 'No' }, ISO_TIME),
      /idle|reviewable/i,
    )

    const blocked = createStoryboardDirectorRecipe(
      context,
      { ...source, prompt: 'Tiny' },
      ISO_TIME,
    )
    assert.throws(
      () => setRecipeDecision(blocked, 'scene-review', 'missing-scene', 'approved', ISO_TIME),
      /blocked|reviewable/i,
    )

    const completed = completedRecipe(runCreatorSkill)
    assert.throws(
      () => setRecipeDecision(
        completed,
        'scene-review',
        completed.scene.drafts[0]!.sceneId,
        'rejected',
        ISO_TIME,
      ),
      /approved|finalized|reviewable/i,
    )

    const beatReview = approveSceneStage(
      decideAll(started, 'scene-review', 'approved'),
      ISO_TIME,
    )
    const missingSceneApproval = {
      ...beatReview,
      scene: { ...beatReview.scene, approvedArtifact: null },
    }
    assert.throws(
      () => updateRecipeDraft(
        missingSceneApproval,
        'beat-review',
        beatReview.beat.drafts[0]!.beatId,
        { summary: 'No upstream' },
        ISO_TIME,
      ),
      /upstream|scene.*approval/i,
    )

    const shotReview = approveBeatStage(
      decideAll(beatReview, 'beat-review', 'approved'),
      ISO_TIME,
    )
    const missingBeatApproval = {
      ...shotReview,
      beat: { ...shotReview.beat, approvedArtifact: null },
    }
    assert.throws(
      () => moveRecipeDraft(
        missingBeatApproval,
        'shot-review',
        shotReview.shot.drafts[0]!.shotId,
        1,
        ISO_TIME,
      ),
      /upstream|beat.*approval/i,
    )
  })

  test('scene truncation is blocked at 41 while the exact 40-scene boundary remains reviewable', () => {
    const boundary = createStoryboardDirectorRecipe(
      context,
      { ...source, prompt: paragraphScript(40) },
      ISO_TIME,
    )
    assert.equal(boundary.scene.status, 'needs-review')
    assert.equal(boundary.scene.drafts.length, 40)

    const truncated = createStoryboardDirectorRecipe(
      context,
      { ...source, prompt: paragraphScript(41) },
      ISO_TIME,
    )
    assert.equal(truncated.scene.status, 'blocked')
    assert.deepEqual(truncated.scene.drafts, [])
    assert.throws(() => approveSceneStage(truncated, ISO_TIME), /blocked/i)
  })

  test('source changes block every materialization path without transferring decisions', () => {
    const completed = completedRecipe(runner)
    const stale = markRecipeSourceFreshness(completed, {
      ...source,
      prompt: `${source.prompt}\nThe alarm sounds.`,
    }, LATER_TIME)

    assert.equal(stale.activeStage, 'source')
    assert.equal(stale.scene.status, 'stale')
    assert.equal(stale.beat.status, 'stale')
    assert.equal(stale.shot.status, 'stale')
    assert.ok(stale.scene.staleResult)
    assert.ok(stale.beat.staleResult)
    assert.ok(stale.shot.staleResult)
    assert.equal(stale.sourceNode.prompt, source.prompt)
    assert.equal(stale.sourceFingerprint, completed.sourceFingerprint)
    assert.throws(
      () => setRecipeDecision(
        stale,
        'scene-review',
        stale.scene.drafts[0]!.sceneId,
        'rejected',
        LATER_TIME,
      ),
      /source.*stale/i,
    )
    assert.throws(
      () => updateRecipeDraft(
        stale,
        'scene-review',
        stale.scene.drafts[0]!.sceneId,
        { actionSummary: 'Bypass attempt' },
        LATER_TIME,
      ),
      /source.*stale/i,
    )
    assert.throws(
      () => approveShotStage(stale, LATER_TIME),
      /source.*stale/i,
    )
    assert.throws(
      () => rerunRecipeStage(stale, 'scene-review', LATER_TIME, runner),
      /source.*stale/i,
    )
  })
})

describe('review checkpoints and immutable evidence', () => {
  test('edited scene headings stay in the checkpoint while canonical handoff reaches beat review', () => {
    let handoffPayload: SceneBreakdownPayload | undefined
    const handoffRunner: typeof runCreatorSkill = (skillId, input, version) => {
      if (skillId === 'narrative-beat-analysis') {
        handoffPayload = structuredClone(
          input.artifacts?.[0]?.payload,
        ) as SceneBreakdownPayload
      }
      return runCreatorSkill(skillId, input, version)
    }
    const started = createStoryboardDirectorRecipe(context, source, ISO_TIME, handoffRunner)
    const scene = started.scene.drafts[0]!
    const edited = updateRecipeDraft(
      started,
      'scene-review',
      scene.sceneId,
      {
        heading: 'INT. REVIEWED LAB - LATE NIGHT',
        actionSummary: 'Reviewed semantic action.',
        characters: ['Mara'],
      },
      ISO_TIME,
    )
    const beatReview = approveSceneStage(
      decideAll(edited, 'scene-review', 'approved'),
      ISO_TIME,
      handoffRunner,
    )
    const checkpoint = beatReview.scene.approvedArtifact
    assert.ok(checkpoint)
    const checkpointPayload = checkpoint.payload as SceneBreakdownPayload
    assert.equal(checkpointPayload.scenes[0]?.heading, 'INT. REVIEWED LAB - LATE NIGHT')
    assert.equal(checkpointPayload.scenes[0]?.actionSummary, 'Reviewed semantic action.')
    assert.equal(handoffPayload?.scenes[0]?.heading, 'INT. LAB - NIGHT')
    assert.equal(handoffPayload?.scenes[0]?.actionSummary, 'Reviewed semantic action.')
    assert.deepEqual(handoffPayload?.scenes[0]?.characters, ['Mara'])
    assert.equal(beatReview.beat.status, 'needs-review')
    assert.ok(beatReview.beat.drafts.length > 0)
  })

  test('reviewed scene order stays in the checkpoint while public handoff uses source order', () => {
    const started = createStoryboardDirectorRecipe(context, source, ISO_TIME)
    const second = started.scene.drafts[1]!
    const reordered = moveRecipeDraft(
      started,
      'scene-review',
      second.sceneId,
      -1,
      ISO_TIME,
    )
    const beatReview = approveSceneStage(
      decideAll(reordered, 'scene-review', 'approved'),
      ISO_TIME,
    )
    const checkpoint = beatReview.scene.approvedArtifact
    assert.ok(checkpoint)
    const checkpointPayload = checkpoint.payload as SceneBreakdownPayload
    const beatPayload = beatReview.beat.result?.artifacts[0]?.payload as NarrativeBeatMapPayload

    assert.deepEqual(checkpointPayload.scenes.map((scene) => scene.sceneId), [
      'scene-002',
      'scene-001',
    ])
    assert.deepEqual(beatPayload.scenes.map((scene) => scene.sceneId), [
      'scene-001',
      'scene-002',
    ])
    assert.equal(beatReview.beat.status, 'needs-review')
  })

  test('approved Artifacts omit rejected items and preserve reviewed order and edits', () => {
    const started = createStoryboardDirectorRecipe(context, source, ISO_TIME, runner)
    const originalArtifact = started.scene.result?.artifacts[0]
    assert.ok(originalArtifact)
    const originalPayload = structuredClone(originalArtifact.payload) as SceneBreakdownPayload
    const first = started.scene.drafts[0]!
    const second = started.scene.drafts[1]!
    const reordered = moveRecipeDraft(
      started,
      'scene-review',
      second.sceneId,
      -1,
      ISO_TIME,
    )
    const edited = updateRecipeDraft(
      reordered,
      'scene-review',
      second.sceneId,
      {
        heading: 'EXT. SIGNAL ROOF - DAWN',
        actionSummary: 'Mara races toward the antenna.',
      },
      ISO_TIME,
    )
    const approvedOne = setRecipeDecision(
      edited,
      'scene-review',
      second.sceneId,
      'approved',
      ISO_TIME,
    )
    const reviewed = setRecipeDecision(
      approvedOne,
      'scene-review',
      first.sceneId,
      'rejected',
      ISO_TIME,
    )
    const next = approveSceneStage(reviewed, ISO_TIME, runner)
    const checkpoint = next.scene.approvedArtifact
    assert.ok(checkpoint)
    const payload = checkpoint.payload as SceneBreakdownPayload

    assert.deepEqual(payload.scenes.map((scene) => scene.sceneId), [second.sceneId])
    assert.equal(payload.scenes[0]?.heading, 'EXT. SIGNAL ROOF - DAWN')
    assert.equal(payload.scenes[0]?.actionSummary, 'Mara races toward the antenna.')
    assert.equal(payload.scenes[0]?.reviewStatus, 'pending')
    assert.deepEqual(originalArtifact.payload, originalPayload)
    assert.deepEqual(checkpoint.sourceArtifactIds, [originalArtifact.artifactId])
  })

  test('generic patching rejects identity, source evidence, order, decisions, and unknown fields', () => {
    const started = createStoryboardDirectorRecipe(context, source, ISO_TIME, runner)
    const scene = started.scene.drafts[0]!
    const forbidden = [
      ['sceneId', 'changed-scene'],
      ['sourceText', 'changed evidence'],
      ['lineStart', 99],
      ['lineEnd', 99],
      ['order', 99],
      ['reviewStatus', 'approved'],
      ['decision', 'approved'],
      ['evidenceIds', ['changed-evidence']],
    ] as const

    for (const [field, value] of forbidden) {
      assert.throws(
        () => updateRecipeDraft(
          started,
          'scene-review',
          scene.sceneId,
          { [field]: value },
          ISO_TIME,
        ),
        /editable|immutable/i,
      )
    }
  })

  test('character edits enforce canonical persistence bounds and valid edits persist', () => {
    const started = createStoryboardDirectorRecipe(context, source, ISO_TIME)
    const sceneId = started.scene.drafts[0]!.sceneId
    const sparse = new Array<string>(1)
    const withExtraProperty = ['Mara'] as string[] & { extra?: boolean }
    withExtraProperty.extra = true
    const invalidCharacters: unknown[] = [
      [''],
      [' Mara '],
      ['Mara', 'Mara'],
      sparse,
      withExtraProperty,
      Array.from({ length: 121 }, (_, index) => `Character-${index}`),
      ['X'.repeat(41)],
      ['Mara', undefined],
    ]

    for (const characters of invalidCharacters) {
      assert.throws(
        () => updateRecipeDraft(
          started,
          'scene-review',
          sceneId,
          { characters },
          ISO_TIME,
        ),
        /characters/i,
      )
    }

    const updated = updateRecipeDraft(
      started,
      'scene-review',
      sceneId,
      { characters: ['Mara', 'Élodie'] },
      ISO_TIME,
    )
    assert.deepEqual(updated.scene.drafts[0]?.characters, ['Mara', 'Élodie'])
    assert.doesNotThrow(() => storyboardDirectorRecipeMetadata(updated))
  })

  test('beat and shot checkpoint payloads retain edits, canonical status, order, and lineage', () => {
    let beatReview = approveSceneStage(
      decideAll(
        createStoryboardDirectorRecipe(context, source, ISO_TIME, runner),
        'scene-review',
        'approved',
      ),
      ISO_TIME,
      runner,
    )
    const beatA = beatReview.beat.drafts[0]!
    const beatB = beatReview.beat.drafts[1]!
    beatReview = moveRecipeDraft(beatReview, 'beat-review', beatB.beatId, -1, ISO_TIME)
    beatReview = updateRecipeDraft(
      beatReview,
      'beat-review',
      beatB.beatId,
      { summary: 'Reviewed beat summary.', type: 'turn' },
      ISO_TIME,
    )
    beatReview = setRecipeDecision(
      decideAll(beatReview, 'beat-review', 'rejected'),
      'beat-review',
      beatB.beatId,
      'approved',
      ISO_TIME,
    )
    const shotReview = approveBeatStage(beatReview, ISO_TIME, runner)
    const beatCheckpoint = shotReview.beat.approvedArtifact
    assert.ok(beatCheckpoint)
    const beatPayload = beatCheckpoint.payload as NarrativeBeatMapPayload
    assert.deepEqual(beatPayload.scenes.flatMap((scene) => scene.beats.map((beat) => beat.beatId)), [
      beatB.beatId,
    ])
    assert.equal(beatPayload.scenes[0]?.beats[0]?.summary, 'Reviewed beat summary.')
    assert.equal(beatPayload.scenes[0]?.beats[0]?.type, 'turn')
    assert.equal(beatPayload.scenes[0]?.beats[0]?.reviewStatus, 'pending')
    assert.notEqual(beatA.beatId, beatB.beatId)

    let reviewedShots = decideAll(shotReview, 'shot-review', 'rejected')
    const shot = reviewedShots.shot.drafts[0]!
    reviewedShots = updateRecipeDraft(
      reviewedShots,
      'shot-review',
      shot.shotId,
      {
        objective: 'Show the reviewed turn.',
        subject: 'Mara',
        action: 'Mara turns toward the signal.',
        suggestedShotSize: 'close',
        outputKind: 'video',
        duration: 10,
      },
      ISO_TIME,
    )
    reviewedShots = setRecipeDecision(
      reviewedShots,
      'shot-review',
      shot.shotId,
      'approved',
      ISO_TIME,
    )
    const completed = approveShotStage(reviewedShots, ISO_TIME)
    const shotCheckpoint = completed.shot.approvedArtifact
    assert.ok(shotCheckpoint)
    const shotPayload = shotCheckpoint.payload as ShotPlanPayload
    const approvedShot = shotPayload.scenes[0]?.shots[0]
    assert.equal(approvedShot?.objective, 'Show the reviewed turn.')
    assert.equal(approvedShot?.suggestedShotSize, 'close')
    assert.equal(approvedShot?.outputKind, 'video')
    assert.equal(approvedShot?.duration, 10)
    assert.equal(approvedShot?.reviewStatus, 'pending')
    assert.deepEqual(shotCheckpoint.sourceArtifactIds, [
      shotReview.shot.result?.artifacts[0]?.artifactId,
    ])
  })

  test('reordering beats and shots cannot cross scene boundaries', () => {
    const beatReview = approveSceneStage(
      decideAll(
        createStoryboardDirectorRecipe(context, source, ISO_TIME, runner),
        'scene-review',
        'approved',
      ),
      ISO_TIME,
      runner,
    )
    const lastFirstScene = beatReview.beat.drafts.filter(
      (beat) => beat.sceneId === beatReview.beat.drafts[0]?.sceneId,
    ).at(-1)!
    const unchanged = moveRecipeDraft(
      beatReview,
      'beat-review',
      lastFirstScene.beatId,
      1,
      ISO_TIME,
    )
    assert.equal(unchanged, beatReview)

    const shotReview = approveBeatStage(
      decideAll(beatReview, 'beat-review', 'approved'),
      ISO_TIME,
      runner,
    )
    const firstSceneShots = shotReview.shot.drafts.filter(
      (shot) => shot.sceneId === shotReview.shot.drafts[0]?.sceneId,
    )
    const moved = moveRecipeDraft(
      shotReview,
      'shot-review',
      firstSceneShots[1]!.shotId,
      -1,
      ISO_TIME,
    )
    assert.deepEqual(moved.shot.drafts.slice(0, 2).map((shot) => shot.shotId), [
      firstSceneShots[1]!.shotId,
      firstSceneShots[0]!.shotId,
    ])
    assert.deepEqual(moved.shot.drafts.slice(0, 2).map((shot) => shot.order), [2, 1])
  })
})

describe('blocked and malformed Skill results', () => {
  test('validated runner results are owned snapshots and are rechecked before approval', () => {
    let captured: CreatorSkillRunResult | undefined
    const capturingRunner: typeof runCreatorSkill = (skillId, input, version) => {
      const result = runCreatorSkill(skillId, input, version)
      if (skillId === 'script-segmentation') captured = result
      return result
    }
    const started = createStoryboardDirectorRecipe(context, source, ISO_TIME, capturingRunner)
    assert.ok(captured)
    assert.notEqual(started.scene.result, captured)
    const storedArtifact = structuredClone(started.scene.result?.artifacts[0])
    const storedEvidence = structuredClone(started.scene.result?.evidence[0])

    const capturedPayload = captured.artifacts[0]!.payload as SceneBreakdownPayload
    capturedPayload.scenes[0]!.heading = 'MUTATED AFTER RETURN'
    captured.evidence[0]!.excerpt = 'mutated evidence'

    assert.deepEqual(started.scene.result?.artifacts[0], storedArtifact)
    assert.deepEqual(started.scene.result?.evidence[0], storedEvidence)
    const beatReview = approveSceneStage(
      decideAll(started, 'scene-review', 'approved'),
      ISO_TIME,
    )
    assert.equal(beatReview.beat.status, 'needs-review')
    const checkpoint = beatReview.scene.approvedArtifact
    assert.ok(checkpoint)
    assert.notEqual(
      (checkpoint.payload as SceneBreakdownPayload).scenes[0]?.heading,
      'MUTATED AFTER RETURN',
    )

    const drifted = structuredClone(started)
    const driftedPayload = drifted.scene.result?.artifacts[0]?.payload as SceneBreakdownPayload
    driftedPayload.scenes[0]!.heading = 'DRIFTED OWNED RESULT'
    assert.throws(
      () => approveSceneStage(decideAll(drifted, 'scene-review', 'approved'), ISO_TIME),
      /malformed|contract|result/i,
    )
  })

  test('hostile Proxy payload traps block scene, beat, and shot review without escaping', () => {
    const cases = [
      ['scene', 'prototype'],
      ['beat', 'descriptor'],
      ['shot', 'property'],
    ] as const

    for (const [stage, trap] of cases) {
      const recipe = recipeWithMutatedResult(stage, (result) => mutateArtifact(
        result,
        (artifact) => { artifact.payload = hostilePayload(trap) },
      ))
      assertMalformedStageBlocked(recipe, stage)
    }
  })

  test('malformed scene, beat, and shot Artifacts block their review stages', () => {
    const malformedSceneRunner: typeof runCreatorSkill = (skillId, input, version) => {
      const result = runCreatorSkill(skillId, input, version)
      return skillId === 'script-segmentation'
        ? malformedResult(result, { format: 'headed-script', scenes: [{}] })
        : result
    }
    const malformedScene = createStoryboardDirectorRecipe(
      context,
      source,
      ISO_TIME,
      malformedSceneRunner,
    )
    assert.equal(malformedScene.scene.status, 'blocked')
    assert.deepEqual(malformedScene.scene.drafts, [])

    const malformedEnvelopeRunner: typeof runCreatorSkill = (skillId, input, version) => {
      const result = runCreatorSkill(skillId, input, version)
      if (skillId !== 'script-segmentation') return result
      const artifact = result.artifacts[0]
      assert.ok(artifact)
      return {
        ...result,
        artifacts: [{ ...artifact, sourceNodeIds: [] }],
      }
    }
    const malformedEnvelope = createStoryboardDirectorRecipe(
      context,
      source,
      ISO_TIME,
      malformedEnvelopeRunner,
    )
    assert.equal(malformedEnvelope.scene.status, 'blocked')
    assert.deepEqual(malformedEnvelope.scene.drafts, [])

    const malformedBeatRunner: typeof runCreatorSkill = (skillId, input, version) => {
      const result = runCreatorSkill(skillId, input, version)
      return skillId === 'narrative-beat-analysis'
        ? malformedResult(result, { scenes: [{ beats: [{}] }] })
        : result
    }
    const sceneReview = decideAll(
      createStoryboardDirectorRecipe(context, source, ISO_TIME),
      'scene-review',
      'approved',
    )
    const malformedBeat = approveSceneStage(sceneReview, ISO_TIME, malformedBeatRunner)
    assert.equal(malformedBeat.scene.status, 'approved')
    assert.equal(malformedBeat.beat.status, 'blocked')
    assert.deepEqual(malformedBeat.beat.drafts, [])

    const malformedShotRunner: typeof runCreatorSkill = (skillId, input, version) => {
      const result = runCreatorSkill(skillId, input, version)
      return skillId === 'shot-planning'
        ? malformedResult(result, { scenes: [{ shots: [{}] }] })
        : result
    }
    const throughBeat = approvedBeatRecipe()
    const malformedShot = approveBeatStage(throughBeat, ISO_TIME, malformedShotRunner)
    assert.equal(malformedShot.beat.status, 'approved')
    assert.equal(malformedShot.shot.status, 'blocked')
    assert.deepEqual(malformedShot.shot.drafts, [])
  })

  test('a blocked automatic next run preserves the approved upstream checkpoint', () => {
    const blockingRunner: typeof runCreatorSkill = (skillId, input, version) => {
      if (skillId !== 'narrative-beat-analysis') {
        return runCreatorSkill(skillId, input, version)
      }
      return {
        skillId,
        skillVersion: '1.0.0',
        runFingerprint: 'csf1_deadbeef',
        status: 'blocked',
        artifacts: [],
        evidence: [],
        warnings: [],
        blockers: [{ code: 'TEST_BLOCKED', message: 'Blocked for test.' }],
      }
    }
    const started = createStoryboardDirectorRecipe(context, source, ISO_TIME)
    const next = approveSceneStage(
      decideAll(started, 'scene-review', 'approved'),
      ISO_TIME,
      blockingRunner,
    )

    assert.equal(next.scene.status, 'approved')
    assert.ok(next.scene.approvedArtifact)
    assert.equal(next.beat.status, 'blocked')
    assert.equal(next.activeStage, 'beat-review')
  })

  test('wrong Skill identity, version, status, source identity, fingerprint, and lineage block every stage', () => {
    const expectedSkill = {
      scene: 'script-segmentation',
      beat: 'narrative-beat-analysis',
      shot: 'shot-planning',
    } as const
    const mutations: Array<[string, ResultMutation]> = [
      ['skill identity', (result) => ({ ...result, skillId: 'other-skill' })],
      ['skill version', (result) => ({ ...result, skillVersion: '9.9.9' })],
      ['run fingerprint', (result) => ({ ...result, runFingerprint: 'csf1_deadbeef' })],
      ['invalid status', (result) => ({
        ...result,
        status: 'running' as CreatorSkillRunResult['status'],
      })],
      ['status invariant', (result) => ({
        ...result,
        blockers: [{ code: 'ILLEGAL_BLOCKER', message: 'Nonblocked result has a blocker.' }],
      })],
      ['source identity', (result) => mutateArtifact(
        result,
        (artifact) => { artifact.sourceNodeIds = ['other-source'] },
      )],
      ['input lineage', (result) => mutateArtifact(
        result,
        (artifact) => {
          artifact.sourceArtifactIds = result.skillId === 'script-segmentation'
            ? ['unexpected-upstream']
            : []
        },
      )],
    ]

    for (const stage of ['scene', 'beat', 'shot'] as const) {
      for (const [label, mutate] of mutations) {
        const recipe = recipeWithMutatedResult(stage, mutate)
        assert.equal(
          recipe[stage].result?.skillId === expectedSkill[stage] || label === 'skill identity',
          true,
        )
        assertMalformedStageBlocked(recipe, stage)
      }
    }
  })

  test('duplicate scene IDs and orders, malformed ranges/evidence, and extraneous fields block scenes', () => {
    const mutations: ResultMutation[] = [
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as SceneBreakdownPayload
        payload.scenes[1]!.sceneId = payload.scenes[0]!.sceneId
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as SceneBreakdownPayload
        payload.scenes[1]!.order = payload.scenes[0]!.order
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as SceneBreakdownPayload
        payload.scenes[1]!.lineStart = payload.scenes[0]!.lineEnd
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as SceneBreakdownPayload
        payload.scenes[0]!.sourceText = 'Changed source evidence.'
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as SceneBreakdownPayload
        ;(payload.scenes[0] as unknown as Record<string, unknown>).unexpected = true
      }),
    ]

    for (const mutate of mutations) {
      assertMalformedStageBlocked(recipeWithMutatedResult('scene', mutate), 'scene')
    }
  })

  test('duplicate beat IDs and orders, malformed relationships/ranges, and extraneous fields block beats', () => {
    const mutations: ResultMutation[] = [
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as NarrativeBeatMapPayload
        payload.scenes[0]!.beats[1]!.beatId = payload.scenes[0]!.beats[0]!.beatId
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as NarrativeBeatMapPayload
        payload.scenes[0]!.beats[1]!.order = payload.scenes[0]!.beats[0]!.order
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as NarrativeBeatMapPayload
        payload.scenes[0]!.beats[0]!.sceneId = payload.scenes[1]!.sceneId
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as NarrativeBeatMapPayload
        payload.scenes[0]!.beats[0]!.lineStart = 999
        payload.scenes[0]!.beats[0]!.lineEnd = 999
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as NarrativeBeatMapPayload
        ;(payload.scenes[0]!.beats[0] as unknown as Record<string, unknown>).unexpected = true
      }),
    ]

    for (const mutate of mutations) {
      assertMalformedStageBlocked(recipeWithMutatedResult('beat', mutate), 'beat')
    }
  })

  test('duplicate shot IDs and orders, malformed relationships/ranges, and extraneous fields block shots', () => {
    const mutations: ResultMutation[] = [
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as ShotPlanPayload
        payload.scenes[0]!.shots[1]!.shotId = payload.scenes[0]!.shots[0]!.shotId
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as ShotPlanPayload
        payload.scenes[0]!.shots[1]!.order = payload.scenes[0]!.shots[0]!.order
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as ShotPlanPayload
        payload.scenes[0]!.shots[0]!.beatId = 'missing-beat'
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as ShotPlanPayload
        payload.scenes[0]!.shots[0]!.lineStart = 999
        payload.scenes[0]!.shots[0]!.lineEnd = 999
      }),
      (result) => mutateArtifact(result, (artifact) => {
        const payload = artifact.payload as ShotPlanPayload
        ;(payload.scenes[0]!.shots[0] as unknown as Record<string, unknown>).unexpected = true
      }),
    ]

    for (const mutate of mutations) {
      assertMalformedStageBlocked(recipeWithMutatedResult('shot', mutate), 'shot')
    }
  })
})

describe('rerun, freshness, impact, and operation tokens', () => {
  test('rerun increments generation, resets decisions, and preserves upstream approval', () => {
    const completed = completedRecipe(runner)
    const sceneApproval = completed.scene.approvedArtifact
    const previousBeatResult = completed.beat.result
    const rerun = rerunRecipeStage(completed, 'beat-review', LATER_TIME, runner)

    assert.equal(calls.at(-1), 'narrative-beat-analysis')
    assert.equal(rerun.beat.generation, completed.beat.generation + 1)
    assert.ok(rerun.beat.drafts.every((beat) => beat.decision === 'pending'))
    assert.equal(rerun.beat.status, 'needs-review')
    assert.equal(rerun.beat.approvedArtifact, null)
    assert.equal(rerun.beat.staleResult, previousBeatResult)
    assert.equal(rerun.scene.status, 'approved')
    assert.equal(rerun.scene.approvedArtifact, sceneApproval)
    assert.equal(rerun.shot.status, 'stale')
  })

  test('stale async completion tokens are rejected after rerun', () => {
    const completed = completedRecipe(runner)
    const token = createRecipeOperationToken(completed, 'shot-review')
    assert.equal(isRecipeOperationCurrent(token, completed), true)

    const rerun = rerunRecipeStage(completed, 'shot-review', LATER_TIME, runner)
    assert.equal(isRecipeOperationCurrent(token, rerun), false)
    assert.equal(
      isRecipeOperationCurrent(createRecipeOperationToken(rerun, 'shot-review'), rerun),
      true,
    )
    assert.equal(isRecipeOperationCurrent({ ...token, recipeId: 'other-recipe' }, completed), false)
  })

  test('caller timestamps do not alter Recipe or Skill fingerprints', () => {
    const first = createStoryboardDirectorRecipe(context, source, ISO_TIME)
    const second = createStoryboardDirectorRecipe(context, source, LATER_TIME)
    assert.equal(first.recipeId, second.recipeId)
    assert.equal(first.sourceFingerprint, second.sourceFingerprint)
    assert.equal(first.scene.result?.runFingerprint, second.scene.result?.runFingerprint)

    const firstBeat = approveSceneStage(
      decideAll(first, 'scene-review', 'approved'),
      ISO_TIME,
    )
    const secondBeat = approveSceneStage(
      decideAll(second, 'scene-review', 'approved'),
      LATER_TIME,
    )
    assert.equal(firstBeat.scene.approvedArtifact?.artifactId, secondBeat.scene.approvedArtifact?.artifactId)
    assert.equal(firstBeat.beat.result?.runFingerprint, secondBeat.beat.result?.runFingerprint)
  })

  test('changeImpactForStage returns exact retained downstream beat and shot counts', () => {
    const completed = completedRecipe(runner)
    const expected = {
      beatCount: completed.beat.drafts.length,
      shotCount: completed.shot.drafts.length,
    }
    assert.deepEqual(changeImpactForStage(completed, 'source'), expected)
    assert.deepEqual(changeImpactForStage(completed, 'scene-review'), expected)
    assert.deepEqual(changeImpactForStage(completed, 'beat-review'), {
      beatCount: 0,
      shotCount: completed.shot.drafts.length,
    })
    assert.deepEqual(changeImpactForStage(completed, 'shot-review'), {
      beatCount: 0,
      shotCount: 0,
    })

    const staleShot = invalidateRecipeAfter(completed, 'beat-review', LATER_TIME)
    assert.deepEqual(changeImpactForStage(staleShot, 'beat-review'), {
      beatCount: 0,
      shotCount: completed.shot.drafts.length,
    })
  })

  test('marking the source missing preserves prior results and adds one blocking finding', () => {
    const completed = completedRecipe(runner)
    const missing = markRecipeSourceMissing(completed, LATER_TIME)
    const repeated = markRecipeSourceMissing(missing, LATER_TIME)

    assert.equal(missing.activeStage, 'source')
    assert.ok(missing.scene.staleResult)
    assert.ok(missing.beat.staleResult)
    assert.ok(missing.shot.staleResult)
    assert.deepEqual(
      repeated.findings.filter((finding) => finding.code === 'SOURCE_NODE_MISSING'),
      [{
        findingId: 'source-node-missing',
        severity: 'blocking',
        code: 'SOURCE_NODE_MISSING',
        message: 'The Storyboard Director Recipe source node is missing.',
        evidenceIds: [],
      }],
    )
  })
})
