/**
 * Pure state and action tests for the Storyboard Director workspace.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/StoryboardDirectorPanel.test.tsx
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { runCreatorSkill, type CreatorSkillReviewStatus } from '../../lib/skills'
import type { StoryboardState } from '../../lib/storyboard/types'
import {
  approveBeatStage,
  approveSceneStage,
  approveShotStage,
  createStoryboardDirectorRecipe,
  invalidateRecipeAfter,
  setRecipeDecision,
  updateRecipeDraft,
} from '../../lib/storyboard/recipe/state-machine'
import type {
  StoryboardDirectorFinding,
  StoryboardDirectorRecipe,
  StoryboardDirectorStageId,
} from '../../lib/storyboard/recipe/types'
import {
  createStoryboardDirectorPanelState,
  patchStoryboardDirectorShot,
  selectStoryboardDirectorTab,
} from './StoryboardDirectorPanel'
import {
  approveActiveRecipeStage,
  batchDecideRecipeScene,
  canImportLegacyDirectorState,
  createRecipeFieldDraft,
  finishRecipeFieldDraft,
  getStoryboardDirectorRecipeActions,
  nextUnresolvedFinding,
  selectRecipeWorkspaceRegion,
} from './StoryboardDirectorRecipePanel'

const ISO_TIME = '2026-07-19T01:00:00.000Z'
const source = {
  id: 'source-1',
  kind: 'text' as const,
  title: 'Pilot',
  prompt: [
    'INT. LAB - NIGHT',
    'Mara opens the sealed case. She recoils.',
    '',
    'EXT. ROOF - DAWN',
    'Mara runs toward the antenna. The alarm sounds.',
  ].join('\n'),
}

function stageDrafts(
  recipe: StoryboardDirectorRecipe,
  stageId: Exclude<StoryboardDirectorStageId, 'source'>,
) {
  if (stageId === 'scene-review') return recipe.scene.drafts
  if (stageId === 'beat-review') return recipe.beat.drafts
  return recipe.shot.drafts
}

function reviewItemId(
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
  decision: Exclude<CreatorSkillReviewStatus, 'pending'>,
) {
  return stageDrafts(recipe, stageId).reduce(
    (next, item) => setRecipeDecision(
      next,
      stageId,
      reviewItemId(stageId, item as unknown as Record<string, unknown>),
      decision,
      ISO_TIME,
    ),
    recipe,
  )
}

function decidedSceneRecipe() {
  return decideAll(
    createStoryboardDirectorRecipe(
      { projectId: 'project-1', workflowId: 'workflow-1' },
      source,
      ISO_TIME,
      runCreatorSkill,
    ),
    'scene-review',
    'approved',
  )
}

function completedRecipe() {
  let sceneReview = createStoryboardDirectorRecipe(
    { projectId: 'project-1', workflowId: 'workflow-1' },
    {
      ...source,
      prompt: [
        'INT. LAB - NIGHT',
        'Jose opens the sealed case.',
        'EXT. ROOF - DAWN',
        'Mara runs to the antenna, then smiles.',
        'The city falls quiet.',
      ].join('\n'),
    },
    ISO_TIME,
  )
  for (const item of sceneReview.scene.drafts) {
    sceneReview = updateRecipeDraft(sceneReview, 'scene-review', item.sceneId, {
      characters: item.sceneId === 'scene-001' ? ['Jose'] : ['Mara'],
    }, ISO_TIME)
  }
  const beatReview = approveSceneStage(
    decideAll(sceneReview, 'scene-review', 'approved'),
    ISO_TIME,
  )
  let decidedBeats = decideAll(beatReview, 'beat-review', 'approved')
  decidedBeats = {
    ...decidedBeats,
    shot: {
      ...decidedBeats.shot,
      options: { ...decidedBeats.shot.options, requestedShotCount: 6 },
    },
  }
  let shotReview = approveBeatStage(decidedBeats, ISO_TIME)
  for (const item of shotReview.shot.drafts) {
    const patch = {
      ...(!item.subject.trim()
        ? { subject: item.sceneId === 'scene-001' ? 'Jose' : 'Mara' }
        : {}),
      ...(item.shotId === 'scene-001-shot-001'
        ? { suggestedShotSize: 'wide' as const }
        : {}),
    }
    if (Object.keys(patch).length > 0) {
      shotReview = updateRecipeDraft(shotReview, 'shot-review', item.shotId, patch, ISO_TIME)
    }
  }
  return approveShotStage(decideAll(shotReview, 'shot-review', 'approved'), ISO_TIME)
}

function sceneRecipeWithWarning() {
  const recipe = approveSceneStage(decidedSceneRecipe(), ISO_TIME, runCreatorSkill)
  const warningIndex = recipe.beat.drafts.findIndex((item) => item.sceneId === recipe.beat.drafts[0]?.sceneId)
  assert.notEqual(warningIndex, -1)
  return {
    ...recipe,
    beat: {
      ...recipe.beat,
      drafts: recipe.beat.drafts.map((item, index) => index === warningIndex
        ? { ...item, needsReviewReason: 'Ambiguous action requires a person to decide.' }
        : item),
    },
  }
}

function healthyOrderedFindings(): StoryboardDirectorFinding[] {
  return ['first', 'second', 'third'].map((findingId, index) => ({
    findingId,
    severity: index === 0 ? 'blocking' : 'advisory',
    code: `FINDING_${index + 1}`,
    message: `Finding ${index + 1}`,
    evidenceIds: [],
  }))
}

describe('Storyboard Director panel state', () => {
  test('opening from a Recipe selects the Recipe tab and global opening preserves board', () => {
    assert.equal(createStoryboardDirectorPanelState({ hasRecipe: true, openedFromRecipe: true }).tab, 'recipe')
    assert.equal(createStoryboardDirectorPanelState({ hasRecipe: false, openedFromRecipe: false }).tab, 'board')
    assert.equal(selectStoryboardDirectorTab({ tab: 'board' }, 'recipe').tab, 'recipe')
  })

  test('tab switching does not mutate Recipe or shot-board state', () => {
    const recipe = decidedSceneRecipe()
    const shotBoard: StoryboardState = { version: '1', shots: [], updatedAt: ISO_TIME }
    const state = { tab: 'board' as const, recipe, shotBoard }
    const next = selectStoryboardDirectorTab(state, 'recipe')

    assert.notEqual(next, state)
    assert.equal(next.recipe, recipe)
    assert.equal(next.shotBoard, shotBoard)
    assert.equal(state.tab, 'board')
  })

  test('manual shot edits preserve Recipe provenance', () => {
    const shotBoard: StoryboardState = {
      version: '1',
      updatedAt: ISO_TIME,
      shots: [{
        id: 'shot-card-1',
        index: 0,
        title: 'S01',
        nodeIds: [],
        createdAt: ISO_TIME,
        updatedAt: ISO_TIME,
        recipe: {
          recipeId: 'recipe-1',
          sourceArtifactId: 'artifact-1',
          sceneId: 'scene-001',
          beatId: 'beat-001',
          shotId: 'shot-001',
        },
      }],
    }

    const next = patchStoryboardDirectorShot(
      shotBoard,
      'shot-card-1',
      { mood: 'Tense' },
      '2026-07-19T02:00:00.000Z',
    )

    assert.equal(next.shots[0]?.mood, 'Tense')
    assert.deepEqual(next.shots[0]?.recipe, shotBoard.shots[0]?.recipe)
    assert.notEqual(next.shots[0]?.recipe, undefined)
  })
})

describe('Storyboard Director Recipe actions', () => {
  test('stage approval invokes the state machine and returns the next review', () => {
    const calls: string[] = []
    const runner: typeof runCreatorSkill = (skillId, input, version) => {
      calls.push(skillId)
      return runCreatorSkill(skillId, input, version)
    }
    const next = approveActiveRecipeStage(decidedSceneRecipe(), ISO_TIME, runner)

    assert.equal(next.activeStage, 'beat-review')
    assert.equal(next.beat.status, 'needs-review')
    assert.deepEqual(calls, ['narrative-beat-analysis'])
  })

  test('scene batch approval leaves needs-review items pending', () => {
    const recipe = sceneRecipeWithWarning()
    const sceneId = recipe.beat.drafts[0]!.sceneId
    const next = batchDecideRecipeScene(recipe, sceneId, 'approved', ISO_TIME)
    const inScene = next.beat.drafts.filter((item) => item.sceneId === sceneId)

    assert.equal(inScene.find((item) => item.needsReviewReason)?.decision, 'pending')
    assert.ok(inScene.filter((item) => !item.needsReviewReason).every(
      (item) => item.decision === 'approved',
    ))
  })

  test('next issue navigation is deterministic and wraps once', () => {
    const findings = healthyOrderedFindings()
    assert.equal(nextUnresolvedFinding(findings, null)?.findingId, findings[0]?.findingId)
    assert.equal(nextUnresolvedFinding(findings, findings[0]!.findingId)?.findingId, findings[1]?.findingId)
    assert.equal(nextUnresolvedFinding(findings, findings.at(-1)!.findingId)?.findingId, findings[0]?.findingId)
  })

  test('final actions follow Intelligence readiness and receipt conflicts', () => {
    const ready = completedRecipe()
    const available = getStoryboardDirectorRecipeActions(ready)

    assert.equal(available.materializeGrouped, true)
    assert.equal(available.syncShotBoard, true)
    assert.equal(available.createDraftNodes, true)

    const receipt = {
      identity: 'duplicate-receipt',
      kind: 'scene' as const,
      resultId: 'result-1',
      targetId: 'target-1',
    }
    const conflicting = {
      ...ready,
      receipts: [receipt, { ...receipt, targetId: 'target-2' }],
    }
    const blocked = getStoryboardDirectorRecipeActions(conflicting)
    assert.equal(blocked.materializeGrouped, false)
    assert.equal(blocked.syncShotBoard, false)
    assert.equal(blocked.createDraftNodes, false)
  })

  test('source-stale state exposes recovery actions and no apply actions', () => {
    const stale = invalidateRecipeAfter(completedRecipe(), 'source', ISO_TIME)
    const actions = getStoryboardDirectorRecipeActions(stale)

    assert.deepEqual(actions, {
      materializeGrouped: false,
      syncShotBoard: false,
      createDraftNodes: false,
      approveStage: false,
      rerunStage: false,
      focusSource: true,
      startNewVersion: true,
    })
  })

  test('legacy import is disabled for a nonempty cloud board', () => {
    const legacy = {
      status: 'valid' as const,
      state: {
        version: '1',
        updatedAt: ISO_TIME,
        shots: [{
          id: 'legacy-shot',
          index: 0,
          title: 'S01',
          nodeIds: [],
          createdAt: ISO_TIME,
          updatedAt: ISO_TIME,
        }],
      },
    }
    const cloudBoard = completedRecipe().storyboard
    const nonemptyCloudBoard: StoryboardState = {
      ...cloudBoard,
      shots: [{
        id: 'cloud-shot',
        index: 0,
        title: 'S01',
        nodeIds: [],
        createdAt: ISO_TIME,
        updatedAt: ISO_TIME,
      }],
    }

    assert.equal(canImportLegacyDirectorState(legacy, nonemptyCloudBoard), false)
    assert.equal(canImportLegacyDirectorState(legacy, cloudBoard), true)
  })

  test('narrow workspace region switching preserves review state', () => {
    const state = { region: 'review' as const, filter: 'warnings' as const, selectedFindingId: 'first' }
    const next = selectRecipeWorkspaceRegion(state, 'evidence')

    assert.deepEqual(next, { ...state, region: 'evidence' })
    assert.equal(state.region, 'review')
  })

  test('Enter commit suppresses the following blur duplicate', () => {
    const draft = createRecipeFieldDraft('Original')
    const typed = { ...draft, value: 'Changed' }
    const enter = finishRecipeFieldDraft(typed, 'enter')
    const blur = finishRecipeFieldDraft(enter.state, 'blur')

    assert.equal(enter.commitValue, 'Changed')
    assert.equal(blur.commitValue, null)
    assert.equal(blur.state.skipNextBlur, false)
  })
})
