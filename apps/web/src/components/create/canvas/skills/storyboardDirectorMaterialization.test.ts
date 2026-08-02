/**
 * Unit tests for Storyboard Director materialization planning.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/skills/storyboardDirectorMaterialization.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  cloneAndValidateStoryboardState,
  readDirectorState,
  readLegacyDirectorState,
} from '../../../../lib/storyboard/director'
import type {
  ShotCard,
  StoryboardState,
} from '../../../../lib/storyboard/types'
import {
  runCreatorSkill,
  type CreatorSkillSourceNode,
  type ShotPlanDraft,
} from '../../../../lib/skills'
import { createRecipeMaterializationIdentity } from '../../../../lib/storyboard/recipe/identity'
import { analyzeStoryboardDirectorRecipe } from '../../../../lib/storyboard/recipe/intelligence'
import {
  readStoryboardDirectorRecipe,
  storyboardDirectorRecipeMetadata,
} from '../../../../lib/storyboard/recipe/persistence'
import type { StoryboardDirectorRecipe } from '../../../../lib/storyboard/recipe/types'
import {
  approveBeatStage,
  approveSceneStage,
  approveShotStage,
  createStoryboardDirectorRecipe,
  moveRecipeDraft,
  setRecipeDecision,
  updateRecipeDraft,
} from '../../../../lib/storyboard/recipe/state-machine'
import { existingCompatibilityShotIds } from '../../ShotListBuilderPanel'
import {
  acknowledgeStoryboardDirectorPartialBatch,
  attemptStoryboardDirectorRecipeCommit,
  importLegacyShotBoard,
  planStoryboardDirectorControlNode,
  planStoryboardDirectorDraftNodes,
  planStoryboardDirectorGroupedNodes,
  planStoryboardDirectorShotBoardSync,
  recordStoryboardDirectorPartialBatch,
  recordStoryboardDirectorRecoveryBatch,
  recordStoryboardDirectorReceipts,
  removeStoryboardDirectorReceiptsForTarget,
  storyboardDirectorPartialBatchBlockers,
  storyboardDirectorRecipeSummary,
} from './storyboardDirectorMaterialization'

const ISO_TIME = '2026-07-19T01:00:00.000Z'
const LATER_TIME = '2026-07-19T02:00:00.000Z'
const context = { projectId: 'project-1', workflowId: 'workflow-1' }
const source: CreatorSkillSourceNode = {
  id: 'source-1',
  kind: 'text',
  title: 'Pilot',
  prompt: [
    'INT. LAB - NIGHT',
    'Jose: I open the sealed case.',
    'EXT. ROOF - DAWN',
    'Mara: I run to the antenna, then smile.',
    'The city falls quiet.',
  ].join('\n'),
}

function decideAll(
  recipe: StoryboardDirectorRecipe,
  stageId: 'scene-review' | 'beat-review' | 'shot-review',
) {
  const drafts = stageId === 'scene-review'
    ? recipe.scene.drafts
    : stageId === 'beat-review'
      ? recipe.beat.drafts
      : recipe.shot.drafts
  return drafts.reduce((next, draft) => {
    const item = draft as unknown as Record<string, unknown>
    const id = stageId === 'scene-review'
      ? item.sceneId
      : stageId === 'beat-review'
        ? item.beatId
        : item.shotId
    if (typeof id !== 'string') throw new TypeError('review draft ID is missing')
    return setRecipeDecision(next, stageId, id, 'approved', ISO_TIME)
  }, recipe)
}

function completedRecipe(
  shotPatch?: (shot: StoryboardDirectorRecipe['shot']['drafts'][number], index: number) => Partial<ShotPlanDraft>,
  reverseShotsWithinScenes = false,
) {
  const started = createStoryboardDirectorRecipe(context, source, ISO_TIME, runCreatorSkill)
  const sceneApproved = decideAll(started, 'scene-review')
  const beatReview = approveSceneStage(sceneApproved, ISO_TIME, runCreatorSkill)
  const beatApproved = decideAll(beatReview, 'beat-review')
  const configured = {
    ...beatApproved,
    shot: {
      ...beatApproved.shot,
      options: { ...beatApproved.shot.options, requestedShotCount: 6 },
    },
  }
  let shotReview = approveBeatStage(configured, ISO_TIME, runCreatorSkill)
  for (const [index, item] of shotReview.shot.drafts.entries()) {
    const patch = {
      ...(!item.subject.trim()
        ? { subject: item.sceneId === 'scene-001' ? 'Jose' : 'Mara' }
        : {}),
      ...(item.shotId === 'scene-001-shot-001'
        ? { suggestedShotSize: 'wide' as const }
        : {}),
      ...shotPatch?.(item, index),
    }
    if (Object.keys(patch).length > 0) {
      shotReview = updateRecipeDraft(
        shotReview,
        'shot-review',
        item.shotId,
        patch,
        ISO_TIME,
      )
    }
  }
  if (reverseShotsWithinScenes) {
    const sceneIds = [...new Set(shotReview.shot.drafts.map((shot) => shot.sceneId))]
    for (const sceneId of sceneIds) {
      const desired = shotReview.shot.drafts
        .filter((shot) => shot.sceneId === sceneId)
        .map((shot) => shot.shotId)
        .reverse()
      const start = shotReview.shot.drafts.findIndex((shot) => shot.sceneId === sceneId)
      for (let offset = 0; offset < desired.length; offset += 1) {
        while (shotReview.shot.drafts[start + offset]?.shotId !== desired[offset]) {
          const current = shotReview.shot.drafts.findIndex((shot) => shot.shotId === desired[offset])
          shotReview = moveRecipeDraft(
            shotReview,
            'shot-review',
            shotReview.shot.drafts[current]!.shotId,
            -1,
            ISO_TIME,
          )
        }
      }
    }
  }
  return approveShotStage(decideAll(shotReview, 'shot-review'), ISO_TIME)
}

function manualShot(id: string, title = 'Manual insert'): ShotCard {
  return {
    id,
    index: 0,
    title,
    shotType: 'MS',
    durationSec: 3,
    directorNote: 'Keep this manual card.',
    nodeIds: ['manual-node'],
    thumbnailUrl: '/manual.png',
    createdAt: ISO_TIME,
    updatedAt: ISO_TIME,
  }
}

function foreignRecipeShot(id: string): ShotCard {
  return {
    ...manualShot(id, 'Foreign Recipe'),
    recipe: {
      recipeId: 'sdr1_foreign',
      sourceArtifactId: 'foreign-artifact',
      sceneId: 'foreign-scene',
      shotId: 'foreign-shot',
    },
  }
}

function planAsExistingNode(plan: { metadataJson: Record<string, unknown> }) {
  return { metadataJson: plan.metadataJson }
}

function metadataSkillId(plan: { metadataJson: unknown }) {
  const metadata = plan.metadataJson as { creatorSkill?: { skillId?: string } }
  return metadata.creatorSkill?.skillId
}

describe('Storyboard Director control-node planning', () => {
  test('ignores ordinary canvas nodes without storyboard Recipe metadata', () => {
    const recipe = completedRecipe()

    assert.equal(planStoryboardDirectorControlNode(recipe, [{
      id: 'source-text-node',
      metadataJson: undefined,
    }]).status, 'create')
  })

  test('finds the existing control node by stable Recipe identity and owns its snapshot', () => {
    const recipe = completedRecipe()
    const first = planStoryboardDirectorControlNode(recipe, [])
    assert.equal(first.status, 'create')
    if (first.status !== 'create') return
    assert.equal(first.plan.title, '分镜导演')
    assert.equal(first.plan.metadataJson.storyboardDirectorRecipe.recipeId, recipe.recipeId)
    assert.notEqual(first.plan.metadataJson.storyboardDirectorRecipe, recipe)
    assert.notEqual(first.plan.metadataJson.storyboardDirectorRecipe.shot, recipe.shot)

    recipe.shot.drafts[0]!.objective = 'Changed after planning'
    assert.notEqual(
      first.plan.metadataJson.storyboardDirectorRecipe.shot.drafts[0]!.objective,
      recipe.shot.drafts[0]!.objective,
    )

    const second = planStoryboardDirectorControlNode(recipe, [{
      id: 'control-1',
      metadataJson: first.plan.metadataJson,
    }])
    assert.deepEqual(second, { status: 'existing', nodeId: 'control-1' })

    const cloudRecipe = completedRecipe()
    const withCloudShots = {
      ...cloudRecipe,
      storyboard: planStoryboardDirectorShotBoardSync(
        cloudRecipe,
        cloudRecipe.storyboard,
        ISO_TIME,
      ).state,
    }
    const cloudPlan = planStoryboardDirectorControlNode(withCloudShots, [])
    assert.equal(cloudPlan.status, 'create')
    if (cloudPlan.status === 'create') {
      assert.equal(
        cloudPlan.plan.metadataJson.storyboardDirectorRecipe.storyboard.shots[0]?.recipe?.recipeId,
        cloudRecipe.recipeId,
      )
    }
  })

  test('blocks duplicate, malformed, accessor, and hostile matching control nodes', () => {
    const recipe = completedRecipe()
    const first = planStoryboardDirectorControlNode(recipe, [])
    assert.equal(first.status, 'create')
    if (first.status !== 'create') return
    const duplicate = [
      { id: 'control-1', metadataJson: first.plan.metadataJson },
      { id: 'control-2', metadataJson: first.plan.metadataJson },
    ]
    assert.equal(planStoryboardDirectorControlNode(recipe, duplicate).status, 'conflict')
    assert.equal(planStoryboardDirectorControlNode(recipe, [{
      id: 'malformed',
      metadataJson: { storyboardDirectorRecipe: { recipeId: recipe.recipeId } },
    }]).status, 'conflict')

    const accessorRecipe: Record<string, unknown> = {}
    Object.defineProperty(accessorRecipe, 'recipeId', {
      enumerable: true,
      get() {
        throw new Error('recipeId accessor must not run')
      },
    })
    const accessor = planStoryboardDirectorControlNode(recipe, [{
      id: 'accessor',
      metadataJson: { storyboardDirectorRecipe: accessorRecipe },
    }])
    assert.equal(accessor.status, 'conflict')

    const hostile = new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error('hostile descriptor')
      },
    })
    const hostileResult = planStoryboardDirectorControlNode(recipe, [{
      id: 'hostile', metadataJson: hostile,
    }])
    assert.equal(hostileResult.status, 'conflict')
  })

  test('scans indexed control nodes without trusting their iterator or get trap', () => {
    const recipe = completedRecipe()
    const first = planStoryboardDirectorControlNode(recipe, [])
    assert.equal(first.status, 'create')
    if (first.status !== 'create') return
    const nodes = [{ id: 'control-1', metadataJson: first.plan.metadataJson }]
    Object.defineProperty(nodes, Symbol.iterator, {
      configurable: true,
      value: function* hiddenIterator() {},
    })
    assert.deepEqual(
      planStoryboardDirectorControlNode(recipe, nodes),
      { status: 'existing', nodeId: 'control-1' },
    )

    let getTrapCalls = 0
    const proxied = new Proxy(nodes, {
      get() {
        getTrapCalls += 1
        throw new Error('existingNodes get trap escaped')
      },
    })
    assert.deepEqual(
      planStoryboardDirectorControlNode(recipe, proxied),
      { status: 'existing', nodeId: 'control-1' },
    )
    assert.equal(getTrapCalls, 0)
  })

  test('formats a secret-free readiness summary for the visible Text node', () => {
    const recipe = completedRecipe()
    const summary = storyboardDirectorRecipeSummary(recipe)
    assert.match(summary, /当前阶段: shot-review/)
    assert.match(summary, /已批准: \d+ 场景 \/ \d+ 节拍 \/ \d+ 镜头/)
    assert.match(summary, /待处理: \d+ 阻塞 \/ \d+ 提醒/)
    assert.match(summary, /来源: 有效/)
    assert.match(summary, /落地: 可执行/)
    assert.equal(summary.includes(source.prompt), false)
    assert.equal(/provider|api[_-]?key|secret/i.test(summary), false)
  })
})

describe('Storyboard Director grouped materialization planning', () => {
  test('uses existing grouped planners and deduplicates repeat apply', () => {
    const recipe = completedRecipe()
    const first = planStoryboardDirectorGroupedNodes(
      recipe,
      ['scene', 'beat', 'shot-plan'],
      [],
    )
    assert.ok(first.create.length > 0)
    const existing = first.create.map((plan, index) => ({
      id: `node-${index}`,
      metadataJson: plan.metadataJson,
    }))
    const repeat = planStoryboardDirectorGroupedNodes(
      recipe,
      ['scene', 'beat', 'shot-plan'],
      existing,
    )
    assert.equal(repeat.create.length, 0)
    assert.equal(repeat.duplicates.length, first.create.length)
  })

  test('rejects incomplete matching grouped metadata for every requested stage', () => {
    const recipe = completedRecipe()
    for (const kind of ['scene', 'beat', 'shot-plan'] as const) {
      const first = planStoryboardDirectorGroupedNodes(recipe, [kind], [])
      const plan = first.create[0]
      assert.ok(plan)
      const creatorSkill = (plan.metadataJson as {
        creatorSkill: {
          skillId: string
          runFingerprint: string
          resultId: string
        }
      }).creatorSkill
      assert.throws(
        () => planStoryboardDirectorGroupedNodes(recipe, [kind], [{
          metadataJson: {
            creatorSkill: {
              skillId: creatorSkill.skillId,
              runFingerprint: creatorSkill.runFingerprint,
              resultId: creatorSkill.resultId,
            },
          },
        }]),
        (error) => error instanceof TypeError && /grouped metadata/i.test(error.message),
      )
    }
  })

  test('contains descriptor-trapped grouped metadata for every requested stage', () => {
    const recipe = completedRecipe()
    for (const kind of ['scene', 'beat', 'shot-plan'] as const) {
      const first = planStoryboardDirectorGroupedNodes(recipe, [kind], [])
      const plan = first.create[0]
      assert.ok(plan)
      let descriptorCalls = 0
      const creatorSkill = new Proxy(
        (plan.metadataJson as { creatorSkill: Record<string, unknown> }).creatorSkill,
        {
          getOwnPropertyDescriptor() {
            descriptorCalls += 1
            throw new Error('grouped metadata descriptor trap escaped')
          },
        },
      )
      assert.throws(
        () => planStoryboardDirectorGroupedNodes(recipe, [kind], [{
          metadataJson: { creatorSkill },
        }]),
        (error) => error instanceof TypeError && /grouped metadata/i.test(error.message),
      )
      assert.ok(descriptorCalls > 0)
    }
  })

  test('bounds hostile grouped approved Artifact metadata before payload traversal', () => {
    const recipe = completedRecipe()
    for (const kind of ['scene', 'beat', 'shot-plan'] as const) {
      const first = planStoryboardDirectorGroupedNodes(recipe, [kind], [])
      const plan = first.create[0]
      assert.ok(plan)
      const freshMetadata = () => structuredClone(plan.metadataJson) as {
        creatorSkill: {
          approvedArtifact: {
            payload: Record<string, unknown>
          }
        }
      }

      let lateOwnKeysCalls = 0
      const oversized = freshMetadata()
      const oversizedScenes: unknown[] = Array.from({ length: 121 }, () => null)
      oversizedScenes[120] = new Proxy({}, {
        ownKeys() {
          lateOwnKeysCalls += 1
          throw new Error('oversized Artifact ownKeys trap reached')
        },
      })
      oversized.creatorSkill.approvedArtifact.payload.scenes = oversizedScenes
      assert.throws(
        () => planStoryboardDirectorGroupedNodes(recipe, [kind], [{
          metadataJson: oversized,
        }]),
        (error) => error instanceof TypeError && /grouped metadata/i.test(error.message),
      )
      assert.equal(lateOwnKeysCalls, 0)

      const accessor = freshMetadata()
      let accessorCalls = 0
      Object.defineProperty(accessor.creatorSkill.approvedArtifact.payload, 'scenes', {
        enumerable: true,
        configurable: true,
        get() {
          accessorCalls += 1
          throw new Error('Artifact scenes accessor escaped')
        },
      })
      assert.throws(
        () => planStoryboardDirectorGroupedNodes(recipe, [kind], [{ metadataJson: accessor }]),
        (error) => error instanceof TypeError && /grouped metadata/i.test(error.message),
      )
      assert.equal(accessorCalls, 0)

      const oversizedString = freshMetadata()
      const stringScenes = oversizedString.creatorSkill.approvedArtifact.payload.scenes as Array<{
        heading?: string
      }>
      assert.ok(stringScenes[0])
      stringScenes[0]!.heading = 'x'.repeat(1_000_000)
      assert.throws(
        () => planStoryboardDirectorGroupedNodes(recipe, [kind], [{
          metadataJson: oversizedString,
        }]),
        /grouped metadata/i,
      )

      const deep = freshMetadata()
      const leaf = new Proxy({}, {
        ownKeys() {
          lateOwnKeysCalls += 1
          throw new Error('deep Artifact ownKeys trap reached')
        },
      })
      let nested: Record<string, unknown> = leaf
      for (let depth = 0; depth < 64; depth += 1) nested = { next: nested }
      deep.creatorSkill.approvedArtifact.payload = nested
      assert.throws(
        () => planStoryboardDirectorGroupedNodes(recipe, [kind], [{ metadataJson: deep }]),
        (error) => error instanceof TypeError && /grouped metadata/i.test(error.message),
      )
      assert.equal(lateOwnKeysCalls, 0)

      const trapped = freshMetadata()
      let descriptorCalls = 0
      trapped.creatorSkill.approvedArtifact.payload = new Proxy(
        trapped.creatorSkill.approvedArtifact.payload,
        {
          getOwnPropertyDescriptor() {
            descriptorCalls += 1
            throw new Error('Artifact descriptor trap escaped')
          },
        },
      )
      assert.throws(
        () => planStoryboardDirectorGroupedNodes(recipe, [kind], [{ metadataJson: trapped }]),
        (error) => error instanceof TypeError && /grouped metadata/i.test(error.message),
      )
      assert.ok(descriptorCalls > 0)

      const cyclic = freshMetadata()
      const cycle: Record<string, unknown> = {}
      cycle.self = cycle
      cyclic.creatorSkill.approvedArtifact.payload = cycle
      assert.throws(
        () => planStoryboardDirectorGroupedNodes(recipe, [kind], [{ metadataJson: cyclic }]),
        (error) => error instanceof TypeError && /grouped metadata/i.test(error.message),
      )
    }
  })

  test('selects stage subsets and keeps scene, beat, shot-plan order stable', () => {
    const recipe = completedRecipe()
    const scenes = planStoryboardDirectorGroupedNodes(recipe, ['scene'], [])
    const beats = planStoryboardDirectorGroupedNodes(recipe, ['beat'], [])
    const shots = planStoryboardDirectorGroupedNodes(recipe, ['shot-plan'], [])
    const selected = planStoryboardDirectorGroupedNodes(
      recipe,
      ['shot-plan', 'scene', 'beat'],
      [],
    )
    assert.deepEqual(
      selected.create.map((plan) => plan.resultId),
      [...scenes.create, ...beats.create, ...shots.create].map((plan) => plan.resultId),
    )
    assert.deepEqual(
      selected.create.map(metadataSkillId),
      [
        ...scenes.create.map(metadataSkillId),
        ...beats.create.map(metadataSkillId),
        ...shots.create.map(metadataSkillId),
      ],
    )
    assert.deepEqual(planStoryboardDirectorGroupedNodes(recipe, [], []), {
      create: [], duplicates: [],
    })
  })

  test('blocks materialization when Recipe Intelligence has a blocking finding', () => {
    const recipe = completedRecipe()
    const artifact = recipe.shot.approvedArtifact
    assert.ok(artifact)
    const resultId = recipe.shot.drafts[0]!.shotId
    const blocked: StoryboardDirectorRecipe = {
      ...recipe,
      receipts: [{
        identity: createRecipeMaterializationIdentity(
          recipe.recipeId,
          'draft-node',
          artifact.artifactId,
          resultId,
        ),
        kind: 'draft-node',
        resultId: 'different-result',
        targetId: 'node-1',
      }],
    }
    assert.throws(
      () => planStoryboardDirectorGroupedNodes(blocked, ['scene'], []),
      /blocking/i,
    )
    assert.throws(
      () => planStoryboardDirectorDraftNodes(blocked, []),
      /blocking/i,
    )
  })
})

describe('Storyboard Director shot-board synchronization', () => {
  test('preserves manual and foreign Recipe shots while repeat sync stays idempotent', () => {
    const recipe = completedRecipe()
    const manual = manualShot('manual-1', 'S01')
    const foreign = foreignRecipeShot('foreign-1')
    const first = planStoryboardDirectorShotBoardSync(recipe, {
      version: '2', shots: [manual, foreign], updatedAt: ISO_TIME,
    }, ISO_TIME)
    assert.deepEqual(first.state.shots.slice(0, 2), [manual, { ...foreign, index: 1 }])
    assert.ok(first.createdShotIds.length > 0)
    assert.ok(first.state.shots.slice(2).every((shot) => shot.recipe?.recipeId === recipe.recipeId))

    const repeat = planStoryboardDirectorShotBoardSync(recipe, first.state, LATER_TIME)
    assert.equal(repeat.createdShotIds.length, 0)
    assert.deepEqual(repeat.state, first.state)
    assert.doesNotThrow(() => cloneAndValidateStoryboardState(repeat.state))
  })

  test('normalizes current UI optional undefined fields before immediate sync', () => {
    const recipe = completedRecipe()
    const uiShot = {
      ...manualShot('ui-manual'),
      shotType: undefined,
      durationSec: undefined,
      mood: undefined,
      cameraMovement: undefined,
      directorNote: undefined,
      characterIds: undefined,
      sceneIds: undefined,
      thumbnailUrl: undefined,
      recipe: undefined,
    } as unknown as ShotCard
    const cloned = cloneAndValidateStoryboardState({
      version: '2', shots: [uiShot], updatedAt: ISO_TIME,
    })
    for (const key of [
      'shotType',
      'durationSec',
      'mood',
      'cameraMovement',
      'directorNote',
      'characterIds',
      'sceneIds',
      'thumbnailUrl',
      'recipe',
    ]) {
      assert.equal(Object.prototype.hasOwnProperty.call(cloned.shots[0], key), false)
    }
    const synced = planStoryboardDirectorShotBoardSync(recipe, {
      version: '2', shots: [uiShot], updatedAt: ISO_TIME,
    }, LATER_TIME)
    assert.equal(synced.state.shots[0]?.id, 'ui-manual')
    assert.doesNotThrow(() => cloneAndValidateStoryboardState(synced.state))
  })

  test('rejects deterministic Recipe card ID collisions without emitting duplicate IDs', () => {
    const recipe = completedRecipe()
    const shot = recipe.shot.drafts[0]
    assert.ok(shot)
    const collidingId = `recipe-${recipe.recipeId}-${shot.shotId}`
    assert.throws(
      () => planStoryboardDirectorShotBoardSync(recipe, {
        version: '2', shots: [manualShot(collidingId)], updatedAt: ISO_TIME,
      }, LATER_TIME),
      /shot card ID conflict/i,
    )
    assert.throws(
      () => planStoryboardDirectorShotBoardSync(recipe, {
        version: '2', shots: [foreignRecipeShot(collidingId)], updatedAt: ISO_TIME,
      }, LATER_TIME),
      /shot card ID conflict/i,
    )
  })

  test('preserves stale same-Recipe cards while reordering current cards by review order', () => {
    const recipe = completedRecipe()
    const first = planStoryboardDirectorShotBoardSync(recipe, {
      version: '2', shots: [], updatedAt: ISO_TIME,
    }, ISO_TIME)
    const bound = first.state.shots.map((card, index) => ({
      ...card,
      id: `cloud-${index}`,
      nodeIds: [`binding-${index}`],
      thumbnailUrl: `/shot-${index}.png`,
    }))
    const stale: ShotCard = {
      ...manualShot('stale-card', 'S03'),
      index: 2,
      recipe: {
        recipeId: recipe.recipeId,
        sourceArtifactId: recipe.shot.approvedArtifact!.artifactId,
        sceneId: 'removed-scene',
        shotId: 'removed-shot',
      },
    }
    const arranged = [
      manualShot('manual-1'),
      bound[0]!,
      stale,
      foreignRecipeShot('foreign-1'),
      ...bound.slice(1),
    ].map((card, index) => ({ ...card, index }))
    const reordered = completedRecipe(undefined, true)
    assert.deepEqual(
      analyzeStoryboardDirectorRecipe(reordered).filter((item) => item.severity === 'blocking'),
      [],
    )

    const result = planStoryboardDirectorShotBoardSync(reordered, {
      version: '2', shots: arranged, updatedAt: ISO_TIME,
    }, LATER_TIME)
    const currentIds = new Set(reordered.shot.drafts.map((shot) => shot.shotId))
    const currentCards = result.state.shots.filter((card) => (
      card.recipe?.recipeId === recipe.recipeId && currentIds.has(card.recipe.shotId)
    ))
    assert.deepEqual(
      currentCards.map((card) => card.recipe?.shotId),
      reordered.shot.drafts.map((shot) => shot.shotId),
    )
    const originalByShotId = new Map(bound.map((card) => [card.recipe!.shotId, card]))
    for (const card of currentCards) {
      const original = originalByShotId.get(card.recipe!.shotId)
      assert.ok(original)
      assert.equal(card.id, original.id)
      assert.deepEqual(card.nodeIds, original.nodeIds)
      assert.equal(card.thumbnailUrl, original.thumbnailUrl)
    }
    assert.equal(result.state.shots[0]?.id, 'manual-1')
    assert.equal(result.state.shots[2]?.id, stale.id)
    assert.equal(result.state.shots[3]?.id, 'foreign-1')
    assert.deepEqual(result.state.shots[2], stale)
    assert.equal(new Set(result.state.shots.map((card) => card.id)).size, result.state.shots.length)
    assert.doesNotThrow(() => cloneAndValidateStoryboardState(result.state))
  })

  test('orders mixed existing and new Recipe cards across all current-card slots', () => {
    const recipe = completedRecipe()
    const initial = planStoryboardDirectorShotBoardSync(recipe, {
      version: '2', shots: [], updatedAt: ISO_TIME,
    }, ISO_TIME)
    const shotA = recipe.shot.drafts[0]
    const shotB = recipe.shot.drafts[1]
    assert.ok(shotA)
    assert.ok(shotB)
    const existingB = initial.state.shots.find((card) => card.recipe?.shotId === shotB.shotId)
    assert.ok(existingB)
    const boundB: ShotCard = {
      ...existingB,
      id: 'existing-card-b',
      nodeIds: ['bound-b'],
      thumbnailUrl: '/b.png',
      createdAt: '2026-07-18T20:00:00.000Z',
    }
    const stale: ShotCard = {
      ...manualShot('stale-card', 'Stale Recipe'),
      index: 2,
      recipe: {
        recipeId: recipe.recipeId,
        sourceArtifactId: recipe.shot.approvedArtifact!.artifactId,
        sceneId: 'removed-scene',
        shotId: 'removed-shot',
      },
    }
    const current = [
      manualShot('manual-1'),
      foreignRecipeShot('foreign-1'),
      stale,
      boundB,
    ].map((card, index) => ({ ...card, index }))

    const first = planStoryboardDirectorShotBoardSync(recipe, {
      version: '2', shots: current, updatedAt: ISO_TIME,
    }, LATER_TIME)
    assert.deepEqual(first.state.shots.slice(0, 3).map((card) => card.id), [
      'manual-1',
      'foreign-1',
      'stale-card',
    ])
    const currentCards = first.state.shots.filter((card) => (
      card.recipe?.recipeId === recipe.recipeId && card.recipe.shotId !== 'removed-shot'
    ))
    assert.deepEqual(
      currentCards.map((card) => card.recipe?.shotId),
      recipe.shot.drafts.map((shot) => shot.shotId),
    )
    assert.equal(currentCards[0]?.recipe?.shotId, shotA.shotId)
    const retainedB = currentCards.find((card) => card.recipe?.shotId === shotB.shotId)
    assert.ok(retainedB)
    assert.equal(retainedB.id, boundB.id)
    assert.deepEqual(retainedB.nodeIds, boundB.nodeIds)
    assert.equal(retainedB.thumbnailUrl, boundB.thumbnailUrl)
    assert.equal(retainedB.createdAt, boundB.createdAt)
    assert.doesNotThrow(() => cloneAndValidateStoryboardState(first.state))

    const repeat = planStoryboardDirectorShotBoardSync(recipe, first.state, LATER_TIME)
    assert.deepEqual(repeat, {
      state: first.state,
      createdShotIds: [],
      updatedShotIds: [],
    })
  })

  test('updates reviewed fields only for the same Recipe and shot identity', () => {
    const recipe = completedRecipe()
    const first = planStoryboardDirectorShotBoardSync(
      recipe,
      { version: '2', shots: [], updatedAt: ISO_TIME },
      ISO_TIME,
    )
    const original = first.state.shots[0]
    assert.ok(original)
    const rebound: ShotCard = {
      ...original,
      id: 'cloud-card-1',
      nodeIds: ['bound-image'],
      thumbnailUrl: '/reviewed.png',
      createdAt: '2026-07-18T23:00:00.000Z',
    }
    const reviewed = completedRecipe((_shot, index) => index === 0 ? {
      objective: 'Reviewed objective',
      action: 'Reviewed action',
      suggestedShotSize: 'extreme-close',
      duration: 10,
    } : {})
    assert.deepEqual(
      analyzeStoryboardDirectorRecipe(reviewed).filter((item) => item.severity === 'blocking'),
      [],
    )

    const updated = planStoryboardDirectorShotBoardSync(reviewed, {
      ...first.state,
      shots: [
        rebound,
        manualShot('manual-same-title', rebound.title),
        ...first.state.shots.slice(1),
      ],
    }, LATER_TIME)
    assert.equal(updated.createdShotIds.length, 0)
    assert.deepEqual(updated.updatedShotIds, [reviewed.shot.drafts[0]!.shotId])
    assert.deepEqual(updated.state.shots[0], {
      ...rebound,
      index: 0,
      shotType: 'ECU',
      durationSec: 10,
      directorNote: 'Reviewed objective\nReviewed action',
      updatedAt: LATER_TIME,
    })
    assert.deepEqual(updated.state.shots[1], {
      ...manualShot('manual-same-title', rebound.title),
      index: 1,
    })
  })
})

describe('Storyboard state descriptor-only collection validation', () => {
  test('clones valid proxied shots and node IDs without executing get traps', () => {
    let getCalls = 0
    const nodeIds = new Proxy(['node-1'], {
      get() {
        getCalls += 1
        throw new Error('nodeIds get trap escaped')
      },
    })
    const shots = new Proxy([{
      ...manualShot('proxy-shot'),
      nodeIds,
    }], {
      get() {
        getCalls += 1
        throw new Error('shots get trap escaped')
      },
    })
    const cloned = cloneAndValidateStoryboardState({
      version: '2', shots, updatedAt: ISO_TIME,
    })
    assert.deepEqual(cloned.shots[0]?.nodeIds, ['node-1'])
    assert.equal(getCalls, 0)
  })

  test('rejects accessor, inherited, symbol, and descriptor-trapped arrays deterministically', () => {
    let getterCalls = 0
    const accessorShots = new Array<ShotCard>(1)
    Object.defineProperty(accessorShots, '0', {
      enumerable: true,
      get() {
        getterCalls += 1
        throw new Error('shot accessor escaped')
      },
    })
    assert.throws(
      () => cloneAndValidateStoryboardState({
        version: '2', shots: accessorShots, updatedAt: ISO_TIME,
      }),
      TypeError,
    )

    const inheritedNodeIds = new Array<string>(1)
    Object.setPrototypeOf(inheritedNodeIds, Object.create(Array.prototype, {
      0: {
        get() {
          getterCalls += 1
          throw new Error('inherited node ID escaped')
        },
      },
    }))
    assert.throws(
      () => cloneAndValidateStoryboardState({
        version: '2',
        shots: [{ ...manualShot('inherited-array'), nodeIds: inheritedNodeIds }],
        updatedAt: ISO_TIME,
      }),
      TypeError,
    )

    const symbolNodeIds: string[] = []
    Object.defineProperty(symbolNodeIds, Symbol('hostile'), {
      enumerable: true,
      get() {
        getterCalls += 1
        throw new Error('symbol accessor escaped')
      },
    })
    assert.throws(
      () => cloneAndValidateStoryboardState({
        version: '2',
        shots: [{ ...manualShot('symbol-array'), nodeIds: symbolNodeIds }],
        updatedAt: ISO_TIME,
      }),
      TypeError,
    )

    const trappedShots = new Proxy([manualShot('descriptor-array')], {
      getOwnPropertyDescriptor() {
        throw new Error('shot descriptor trap escaped')
      },
    })
    assert.throws(
      () => cloneAndValidateStoryboardState({
        version: '2', shots: trappedShots, updatedAt: ISO_TIME,
      }),
      TypeError,
    )
    assert.equal(getterCalls, 0)
  })
})

describe('Storyboard Director compatibility draft planning and receipts', () => {
  test('uses actual shot-planning provenance and remains compatible with generic dedupe', () => {
    const recipe = completedRecipe()
    assert.equal(planStoryboardDirectorDraftNodes.length, 2)
    const first = planStoryboardDirectorDraftNodes(recipe, [])
    assert.ok(first.create.length > 0)
    assert.ok(first.create.every((plan) => plan.kind === 'image' || plan.kind === 'video'))
    assert.deepEqual(
      first.create.map((plan) => plan.resultId),
      recipe.shot.drafts.filter((shot) => shot.decision === 'approved').map((shot) => shot.shotId),
    )

    const firstMetadata = first.create[0]!.metadataJson as {
      creatorSkill?: {
        skillId?: string
        skillVersion?: string
        runFingerprint?: string
        sourceNodeIds?: string[]
        sourceArtifactIds?: string[]
        resultType?: string
        resultId?: string
      }
      storyboardDirectorMaterialization?: Record<string, unknown>
    }
    const result = recipe.shot.result
    const resultArtifact = result?.artifacts[0]
    assert.ok(result)
    assert.ok(resultArtifact)
    assert.deepEqual(firstMetadata.creatorSkill, {
      skillId: result.skillId,
      skillVersion: result.skillVersion,
      runFingerprint: result.runFingerprint,
      sourceNodeIds: resultArtifact.sourceNodeIds,
      sourceArtifactIds: [resultArtifact.artifactId],
      resultType: 'shot-draft',
      resultId: first.create[0]!.resultId,
      reviewStatus: 'approved',
      evidence: result.evidence.filter((item) => (
        item.lineStart === recipe.shot.drafts[0]!.lineStart
        && item.lineEnd === recipe.shot.drafts[0]!.lineEnd
        && item.excerpt === recipe.shot.drafts[0]!.sourceText
      )),
    })
    assert.deepEqual(firstMetadata.storyboardDirectorMaterialization, {
      recipeId: recipe.recipeId,
      shotId: first.create[0]!.resultId,
      sourceArtifactId: recipe.shot.approvedArtifact!.artifactId,
      identity: first.create[0]!.identity,
      outputKind: first.create[0]!.kind,
      duration: recipe.shot.drafts[0]!.duration,
    })
    assert.equal(/provider|api[_-]?key|secret/i.test(JSON.stringify(firstMetadata)), false)
    assert.deepEqual(
      existingCompatibilityShotIds(first.create.map(planAsExistingNode), result),
      first.create.map((plan) => plan.resultId),
    )

    const repeat = planStoryboardDirectorDraftNodes(
      recipe,
      first.create.map(planAsExistingNode),
    )
    assert.equal(repeat.create.length, 0)
    assert.deepEqual(repeat.duplicates, first.create.map((plan) => plan.identity))

    const titleOnly = planStoryboardDirectorDraftNodes(recipe, [{
      metadataJson: {},
      title: first.create[0]!.title,
      prompt: first.create[0]!.prompt,
    }])
    assert.equal(titleOnly.create.length, first.create.length)
  })

  test('detects dense matching nodes without trusting iterators or get traps', () => {
    const recipe = completedRecipe()
    const first = planStoryboardDirectorDraftNodes(recipe, [])
    const nodes = first.create.map(planAsExistingNode)
    Object.defineProperty(nodes, Symbol.iterator, {
      configurable: true,
      value: function* hiddenIterator() {},
    })
    const hidden = planStoryboardDirectorDraftNodes(recipe, nodes)
    assert.equal(hidden.create.length, 0)
    assert.deepEqual(hidden.duplicates, first.create.map((plan) => plan.identity))

    let collectionGetCalls = 0
    const proxiedNodes = new Proxy(nodes, {
      get() {
        collectionGetCalls += 1
        throw new Error('collection get trap escaped')
      },
    })
    const proxied = planStoryboardDirectorDraftNodes(recipe, proxiedNodes)
    assert.equal(proxied.create.length, 0)
    assert.equal(collectionGetCalls, 0)

    const metadata = structuredClone(first.create[0]!.metadataJson) as {
      creatorSkill: { sourceNodeIds: string[] }
    }
    let metadataGetCalls = 0
    metadata.creatorSkill.sourceNodeIds = new Proxy(
      metadata.creatorSkill.sourceNodeIds,
      {
        get() {
          metadataGetCalls += 1
          throw new Error('metadata array get trap escaped')
        },
      },
    )
    const metadataResult = planStoryboardDirectorDraftNodes(recipe, [
      { metadataJson: metadata },
      ...first.create.slice(1).map(planAsExistingNode),
    ])
    assert.equal(metadataResult.create.length, 0)
    assert.equal(metadataGetCalls, 0)
  })

  test('rejects sparse, oversized, inherited, accessor, and proxy collections fail closed', () => {
    const recipe = completedRecipe()
    const first = planStoryboardDirectorDraftNodes(recipe, [])
    const matching = planAsExistingNode(first.create[0]!)

    const sparse = new Array<ReturnType<typeof planAsExistingNode>>(2)
    sparse[1] = matching
    assert.throws(
      () => planStoryboardDirectorDraftNodes(recipe, sparse),
      /existingNodes/i,
    )
    assert.throws(
      () => planStoryboardDirectorDraftNodes(
        recipe,
        new Array(10_001) as ReturnType<typeof planAsExistingNode>[],
      ),
      /existingNodes/i,
    )

    let indexAccessorCalls = 0
    const accessor = new Array<ReturnType<typeof planAsExistingNode>>(1)
    Object.defineProperty(accessor, '0', {
      enumerable: true,
      get() {
        indexAccessorCalls += 1
        throw new Error('index accessor escaped')
      },
    })
    assert.throws(
      () => planStoryboardDirectorDraftNodes(recipe, accessor),
      /existingNodes/i,
    )
    assert.equal(indexAccessorCalls, 0)

    let inheritedLengthCalls = 0
    const inheritedLength = Object.create({
      get length() {
        inheritedLengthCalls += 1
        throw new Error('inherited length escaped')
      },
    }) as ReturnType<typeof planAsExistingNode>[]
    Object.defineProperty(inheritedLength, '0', { enumerable: true, value: matching })
    assert.throws(
      () => planStoryboardDirectorDraftNodes(recipe, inheritedLength),
      /existingNodes/i,
    )
    assert.equal(inheritedLengthCalls, 0)

    const descriptorTrap = new Proxy([matching], {
      getOwnPropertyDescriptor() {
        throw new Error('descriptor trap escaped')
      },
    })
    assert.throws(
      () => planStoryboardDirectorDraftNodes(recipe, descriptorTrap),
      (error) => error instanceof TypeError && /existingNodes/i.test(error.message),
    )

    const ownKeysTrap = new Proxy([matching], {
      ownKeys() {
        throw new Error('ownKeys trap escaped')
      },
    })
    assert.throws(
      () => planStoryboardDirectorDraftNodes(recipe, ownKeysTrap),
      (error) => error instanceof TypeError && /existingNodes/i.test(error.message),
    )

    const prototypeTrapNode = new Proxy(matching, {
      getPrototypeOf() {
        throw new Error('prototype trap escaped')
      },
    })
    assert.throws(
      () => planStoryboardDirectorDraftNodes(recipe, [prototypeTrapNode]),
      /existingNodes/i,
    )
  })

  test('rejects accessor and descriptor-trapped Creator Skill metadata arrays', () => {
    const recipe = completedRecipe()
    const first = planStoryboardDirectorDraftNodes(recipe, [])
    const accessorMetadata = structuredClone(first.create[0]!.metadataJson) as {
      creatorSkill: { sourceArtifactIds: string[] }
    }
    let accessorCalls = 0
    Object.defineProperty(accessorMetadata.creatorSkill.sourceArtifactIds, '0', {
      enumerable: true,
      configurable: true,
      get() {
        accessorCalls += 1
        throw new Error('metadata index accessor escaped')
      },
    })
    assert.throws(
      () => planStoryboardDirectorDraftNodes(recipe, [{ metadataJson: accessorMetadata }]),
      /metadata/i,
    )
    assert.equal(accessorCalls, 0)

    const descriptorMetadata = structuredClone(first.create[0]!.metadataJson) as {
      creatorSkill: { evidence: Array<Record<string, unknown>> }
    }
    descriptorMetadata.creatorSkill.evidence = new Proxy(
      descriptorMetadata.creatorSkill.evidence,
      {
        getOwnPropertyDescriptor() {
          throw new Error('metadata descriptor trap escaped')
        },
      },
    )
    assert.throws(
      () => planStoryboardDirectorDraftNodes(recipe, [{ metadataJson: descriptorMetadata }]),
      (error) => error instanceof TypeError && /metadata/i.test(error.message),
    )
  })

  test('records only successful callback results and is idempotent', () => {
    const recipe = completedRecipe()
    const plans = planStoryboardDirectorDraftNodes(recipe, []).create
    assert.ok(plans.length > 1)
    const successful = [{
      identity: plans[0]!.identity,
      kind: 'draft-node' as const,
      resultId: plans[0]!.resultId,
      targetId: 'node-success',
    }]
    const recorded = recordStoryboardDirectorReceipts(recipe, successful, LATER_TIME)
    assert.deepEqual(recorded.receipts, successful)
    assert.equal(recorded.receipts.some((receipt) => receipt.resultId === plans[1]!.resultId), false)
    assert.equal(Object.prototype.hasOwnProperty.call(recorded, 'rollback'), false)

    const repeat = recordStoryboardDirectorReceipts(recorded, successful, LATER_TIME)
    assert.deepEqual(repeat, recorded)
  })

  test('removes only deleted grouped and draft targets so each can be recreated', () => {
    const recipe = completedRecipe()
    const groupedPlan = planStoryboardDirectorGroupedNodes(recipe, ['scene'], []).create[0]
    const draftPlan = planStoryboardDirectorDraftNodes(recipe, []).create[0]
    assert.ok(groupedPlan)
    assert.ok(draftPlan)
    const groupedReceipt = {
      identity: createRecipeMaterializationIdentity(
        recipe.recipeId,
        'scene',
        groupedPlan.metadataJson.creatorSkill.approvedArtifact.artifactId,
        groupedPlan.resultId,
      ),
      kind: 'scene' as const,
      resultId: groupedPlan.resultId,
      targetId: 'grouped-target',
    }
    const draftReceipt = {
      identity: draftPlan.identity,
      kind: 'draft-node' as const,
      resultId: draftPlan.resultId,
      targetId: 'draft-target',
    }
    const recorded = recordStoryboardDirectorReceipts(
      recipe,
      [groupedReceipt, draftReceipt],
      ISO_TIME,
    )

    const groupedRemoved = removeStoryboardDirectorReceiptsForTarget(
      recorded,
      'grouped-target',
      LATER_TIME,
    )
    assert.deepEqual(groupedRemoved.removedReceipts, [groupedReceipt])
    assert.deepEqual(groupedRemoved.recipe.receipts, [draftReceipt])
    assert.equal(
      planStoryboardDirectorGroupedNodes(groupedRemoved.recipe, ['scene'], []).create
        .some((plan) => plan.resultId === groupedPlan.resultId),
      true,
    )

    const draftRemoved = removeStoryboardDirectorReceiptsForTarget(
      groupedRemoved.recipe,
      'draft-target',
      LATER_TIME,
    )
    assert.deepEqual(draftRemoved.removedReceipts, [draftReceipt])
    assert.deepEqual(draftRemoved.recipe.receipts, [])
    assert.equal(
      planStoryboardDirectorDraftNodes(draftRemoved.recipe, []).create
        .some((plan) => plan.resultId === draftPlan.resultId),
      true,
    )

    const unrelated = removeStoryboardDirectorReceiptsForTarget(
      recorded,
      'manual-node',
      LATER_TIME,
    )
    assert.equal(unrelated.recipe, recorded)
    assert.deepEqual(unrelated.removedReceipts, [])
  })

  test('persists exact grouped and draft partial batches with stable identity', () => {
    const recipe = completedRecipe()
    const groupedPlans = planStoryboardDirectorGroupedNodes(
      recipe,
      ['scene', 'beat', 'shot-plan'],
      [],
    ).create
    const groupedCompleted = groupedPlans.slice(0, 2).map((plan, index) => {
      const resultType = plan.metadataJson.creatorSkill.resultType
      const kind = resultType === 'shot-plan'
        ? 'shot-plan' as const
        : resultType === 'narrative-beat-map'
          ? 'beat' as const
          : 'scene' as const
      return {
        identity: createRecipeMaterializationIdentity(
          recipe.recipeId,
          kind,
          plan.metadataJson.creatorSkill.approvedArtifact.artifactId,
          plan.resultId,
        ),
        kind,
        resultId: plan.resultId,
        targetId: `grouped-node-${index + 1}`,
      }
    })
    const groupedIdentities = groupedPlans.map((plan) => {
      const resultType = plan.metadataJson.creatorSkill.resultType
      const kind = resultType === 'shot-plan'
        ? 'shot-plan' as const
        : resultType === 'narrative-beat-map'
          ? 'beat' as const
          : 'scene' as const
      return createRecipeMaterializationIdentity(
        recipe.recipeId,
        kind,
        plan.metadataJson.creatorSkill.approvedArtifact.artifactId,
        plan.resultId,
      )
    })
    const grouped = recordStoryboardDirectorPartialBatch(
      recipe,
      'grouped-materialization',
      groupedIdentities,
      groupedCompleted,
      LATER_TIME,
    )
    const groupedBlocker = storyboardDirectorPartialBatchBlockers(grouped.recipe)[0]
    assert.ok(groupedBlocker)
    assert.equal(groupedBlocker.operation, 'grouped-materialization')
    assert.equal(groupedBlocker.plannedCount, groupedPlans.length)
    assert.equal(groupedBlocker.createdCount, 2)
    assert.equal(groupedBlocker.uncreatedCount, groupedPlans.length - 2)
    assert.deepEqual(groupedBlocker.successfulTargetIds, ['grouped-node-1', 'grouped-node-2'])
    assert.deepEqual(grouped.recipe.receipts.map((item) => item.targetId), [
      'grouped-node-1',
      'grouped-node-2',
    ])

    const repeat = recordStoryboardDirectorPartialBatch(
      recipe,
      'grouped-materialization',
      groupedIdentities.slice().reverse(),
      groupedCompleted,
      LATER_TIME,
    )
    assert.equal(
      storyboardDirectorPartialBatchBlockers(repeat.recipe)[0]?.batchId,
      groupedBlocker.batchId,
    )

    const draftPlans = planStoryboardDirectorDraftNodes(recipe, []).create
    const draftCompleted = [{
      identity: draftPlans[0]!.identity,
      kind: 'draft-node' as const,
      resultId: draftPlans[0]!.resultId,
      targetId: 'draft-node-1',
    }]
    const draft = recordStoryboardDirectorPartialBatch(
      recipe,
      'draft-node-creation',
      draftPlans.map((plan) => plan.identity),
      draftCompleted,
      LATER_TIME,
    )
    const draftBlocker = storyboardDirectorPartialBatchBlockers(draft.recipe)[0]
    assert.ok(draftBlocker)
    assert.equal(draftBlocker.operation, 'draft-node-creation')
    assert.equal(draftBlocker.createdCount, 1)
    assert.equal(draftBlocker.uncreatedCount, draftPlans.length - 1)
    assert.notEqual(draftBlocker.batchId, groupedBlocker.batchId)
  })

  test('records a recovery blocker when every target was created but receipt commit failed', () => {
    const recipe = completedRecipe()
    const planned = planStoryboardDirectorDraftNodes(recipe, [])
    const completed = planned.create.map((plan, index) => ({
      identity: plan.identity,
      kind: 'draft-node' as const,
      resultId: plan.resultId,
      targetId: `created-target-${index}`,
    }))
    const recovered = recordStoryboardDirectorPartialBatch(
      recipe,
      'draft-node-creation',
      planned.create.map((plan) => plan.identity),
      completed,
      LATER_TIME,
    )

    assert.equal(recovered.blocker.createdCount, completed.length)
    assert.equal(recovered.blocker.uncreatedCount, 0)
    assert.deepEqual(recovered.blocker.successfulTargetIds, completed.map((item) => item.targetId))
    assert.equal(readStoryboardDirectorRecipe(
      storyboardDirectorRecipeMetadata(recovered.recipe),
    ).status, 'valid')
  })

  test('records exact created targets while tolerating receipt construction and recorder failures', () => {
    const recipe = completedRecipe()
    const plans = planStoryboardDirectorDraftNodes(recipe, []).create
    assert.ok(plans.length >= 3)
    const completed = plans.slice(0, 3).map((plan, index) => ({
      identity: plan.identity,
      targetId: `created-target-${index}`,
      ...(index === 1 ? {} : {
        receipt: {
          identity: plan.identity,
          kind: 'draft-node' as const,
          resultId: plan.resultId,
          targetId: `created-target-${index}`,
        },
      }),
    }))
    const recovered = recordStoryboardDirectorRecoveryBatch(
      recipe,
      'draft-node-creation',
      plans.map((plan) => plan.identity),
      completed,
      LATER_TIME,
      (current, receipt, now) => {
        if (receipt.targetId === 'created-target-2') {
          throw new Error('receipt recorder failed')
        }
        return recordStoryboardDirectorReceipts(current, [receipt], now)
      },
    )

    assert.equal(recovered.blocker.createdCount, 3)
    assert.equal(recovered.blocker.uncreatedCount, plans.length - 3)
    assert.deepEqual(recovered.blocker.successfulTargetIds, [
      'created-target-0',
      'created-target-1',
      'created-target-2',
    ])
    assert.deepEqual(recovered.recipe.receipts.map((receipt) => receipt.targetId), [
      'created-target-0',
    ])
    assert.equal(recovered.receiptsRecorded, false)
    assert.equal(readStoryboardDirectorRecipe(
      storyboardDirectorRecipeMetadata(recovered.recipe),
    ).status, 'valid')
  })

  test('keeps the partial blocker when receipt recording fails and acknowledgment clears only it', () => {
    const recipe = completedRecipe()
    const plans = planStoryboardDirectorDraftNodes(recipe, []).create
    const first = plans[0]
    assert.ok(first)
    const existing = recordStoryboardDirectorReceipts(recipe, [{
      identity: first.identity,
      kind: 'draft-node',
      resultId: first.resultId,
      targetId: 'existing-target',
    }], ISO_TIME)
    const partial = recordStoryboardDirectorPartialBatch(
      {
        ...existing,
        findings: [{
          findingId: 'unrelated-blocker',
          severity: 'blocking',
          code: 'UNRELATED_BLOCKER',
          message: 'Keep me.',
          evidenceIds: [],
        }],
      },
      'draft-node-creation',
      plans.map((plan) => plan.identity),
      [{
        identity: first.identity,
        kind: 'draft-node',
        resultId: first.resultId,
        targetId: 'new-target',
      }],
      LATER_TIME,
    )
    assert.equal(partial.receiptsRecorded, false)
    assert.deepEqual(partial.recipe.receipts, existing.receipts)
    const blocker = storyboardDirectorPartialBatchBlockers(partial.recipe)[0]
    assert.ok(blocker)

    const persisted = attemptStoryboardDirectorRecipeCommit(
      partial.recipe,
      (_recipe) => {
        throw new Error('cloud commit failed')
      },
    )
    assert.equal(persisted, false)
    assert.equal(storyboardDirectorPartialBatchBlockers(partial.recipe)[0]?.batchId, blocker.batchId)

    const reopened = structuredClone(partial.recipe)
    assert.throws(() => planStoryboardDirectorGroupedNodes(reopened, ['scene'], []), /blocking/i)
    assert.throws(() => planStoryboardDirectorDraftNodes(reopened, []), /blocking/i)
    assert.throws(
      () => planStoryboardDirectorShotBoardSync(
        reopened,
        reopened.storyboard,
        LATER_TIME,
      ),
      /blocking/i,
    )

    const acknowledged = acknowledgeStoryboardDirectorPartialBatch(
      reopened,
      blocker.batchId,
      LATER_TIME,
    )
    assert.deepEqual(storyboardDirectorPartialBatchBlockers(acknowledged), [])
    assert.equal(acknowledged.findings.some((item) => item.findingId === 'unrelated-blocker'), true)
    assert.equal(
      acknowledgeStoryboardDirectorPartialBatch(acknowledged, blocker.batchId, LATER_TIME),
      acknowledged,
    )
  })

  test('rejects conflicting, duplicate, and malformed receipt claims', () => {
    const recipe = completedRecipe()
    const plan = planStoryboardDirectorDraftNodes(recipe, []).create[0]
    assert.ok(plan)
    const valid = {
      identity: plan.identity,
      kind: 'draft-node' as const,
      resultId: plan.resultId,
      targetId: 'node-1',
    }
    const recorded = recordStoryboardDirectorReceipts(recipe, [valid], ISO_TIME)
    assert.throws(() => recordStoryboardDirectorReceipts(recorded, [{
      ...valid, targetId: 'node-2',
    }], LATER_TIME), /receipt conflict/i)
    assert.throws(() => recordStoryboardDirectorReceipts(recipe, [
      valid,
      { ...valid, targetId: 'node-2' },
    ], LATER_TIME), /receipt conflict/i)
    assert.throws(() => recordStoryboardDirectorReceipts(recipe, [{
      ...valid, identity: 'sdrm1_malformed',
    }], LATER_TIME), /receipt/i)
    assert.throws(() => recordStoryboardDirectorReceipts(recipe, [{
      ...valid, kind: 'shot-card',
    }], LATER_TIME), /receipt/i)
    assert.throws(() => recordStoryboardDirectorReceipts(recipe, [{
      ...valid, resultId: 'different-result',
    }], LATER_TIME), /receipt/i)
  })

  test('snapshots completed receipts without executing collection or element getters', () => {
    const recipe = completedRecipe()
    const plan = planStoryboardDirectorDraftNodes(recipe, []).create[0]
    assert.ok(plan)
    const valid = {
      identity: plan.identity,
      kind: 'draft-node' as const,
      resultId: plan.resultId,
      targetId: 'node-1',
    }
    let getterCalls = 0
    const proxied = new Proxy([valid], {
      get() {
        getterCalls += 1
        throw new Error('completed get trap escaped')
      },
    })
    const recorded = recordStoryboardDirectorReceipts(recipe, proxied, LATER_TIME)
    assert.deepEqual(recorded.receipts, [valid])
    assert.equal(getterCalls, 0)

    const accessor = new Array<typeof valid>(1)
    Object.defineProperty(accessor, '0', {
      enumerable: true,
      get() {
        getterCalls += 1
        throw new Error('completed item getter escaped')
      },
    })
    assert.throws(
      () => recordStoryboardDirectorReceipts(recipe, accessor, LATER_TIME),
      TypeError,
    )
    assert.equal(getterCalls, 0)
  })

  test('rejects sparse, oversized, inherited, and descriptor-trapped receipt collections', () => {
    const recipe = completedRecipe()
    const sparse = new Array<{
      identity: string
      kind: 'draft-node'
      resultId: string
      targetId: string
    }>(1)
    assert.throws(
      () => recordStoryboardDirectorReceipts(recipe, sparse, LATER_TIME),
      /completed/i,
    )
    assert.throws(
      () => recordStoryboardDirectorReceipts(
        recipe,
        new Array(361) as typeof sparse,
        LATER_TIME,
      ),
      /completed/i,
    )

    let inheritedLengthCalls = 0
    const inherited = Object.create({
      get length() {
        inheritedLengthCalls += 1
        throw new Error('inherited completed length escaped')
      },
    }) as typeof sparse
    assert.throws(
      () => recordStoryboardDirectorReceipts(recipe, inherited, LATER_TIME),
      /completed/i,
    )
    assert.equal(inheritedLengthCalls, 0)

    const trapped = new Proxy([], {
      getOwnPropertyDescriptor() {
        throw new Error('completed descriptor trap escaped')
      },
    }) as typeof sparse
    assert.throws(
      () => recordStoryboardDirectorReceipts(recipe, trapped, LATER_TIME),
      (error) => error instanceof TypeError && /completed/i.test(error.message),
    )
  })
})

describe('Storyboard Director legacy state migration', () => {
  test('imports explicitly, clones local state, and cannot replace cloud shots', () => {
    const recipe = completedRecipe()
    const legacy: StoryboardState = {
      version: '1', shots: [manualShot('legacy-1')], updatedAt: ISO_TIME,
    }
    const empty = importLegacyShotBoard(recipe, legacy, LATER_TIME)
    assert.equal(empty.storyboard.shots.length, 1)
    assert.equal(empty.legacyImportStatus, 'imported')
    assert.equal(empty.storyboard.updatedAt, LATER_TIME)
    assert.notEqual(empty.storyboard, legacy)
    assert.notEqual(empty.storyboard.shots[0], legacy.shots[0])
    assert.deepEqual(legacy.shots.map((shot) => shot.id), ['legacy-1'])

    const cloud = {
      ...recipe,
      storyboard: planStoryboardDirectorShotBoardSync(
        recipe,
        recipe.storyboard,
        ISO_TIME,
      ).state,
    }
    assert.throws(() => importLegacyShotBoard(cloud, legacy, LATER_TIME), /nonempty/i)
    assert.throws(() => importLegacyShotBoard(recipe, {
      version: '1', shots: [{ id: 'broken' } as ShotCard], updatedAt: ISO_TIME,
    }, LATER_TIME), /invalid/i)
  })

  test('reads legacy localStorage as absent, valid, or invalid without writing it', () => {
    const previousWindow = globalThis.window
    const values = new Map<string, string>()
    const storage = {
      getItem(key: string) {
        return values.get(key) ?? null
      },
      setItem() {
        throw new Error('legacy read must not write storage')
      },
    }
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: storage },
      configurable: true,
      writable: true,
    })
    try {
      assert.deepEqual(readLegacyDirectorState('project-1'), { status: 'absent' })
      values.set(
        'creator-city:storyboard:director:project-1',
        JSON.stringify({ version: '1', shots: [manualShot('legacy-1')], updatedAt: ISO_TIME }),
      )
      const valid = readLegacyDirectorState('project-1')
      assert.equal(valid.status, 'valid')
      if (valid.status === 'valid') {
        assert.equal(valid.state.shots[0]?.id, 'legacy-1')
        assert.notEqual(valid.state.shots[0], manualShot('legacy-1'))
      }
      assert.deepEqual(readDirectorState('project-1'), valid.status === 'valid' ? valid.state : null)

      values.set(
        'creator-city:storyboard:director:project-1',
        JSON.stringify({ version: '1', shots: [{ id: 'broken' }], updatedAt: ISO_TIME }),
      )
      assert.deepEqual(readLegacyDirectorState('project-1'), { status: 'invalid' })
      assert.deepEqual(readDirectorState('project-1'), { version: '1', shots: [], updatedAt: '' })
    } finally {
      if (previousWindow === undefined) {
        Reflect.deleteProperty(globalThis, 'window')
      } else {
        Object.defineProperty(globalThis, 'window', {
          value: previousWindow,
          configurable: true,
          writable: true,
        })
      }
    }
  })
})
