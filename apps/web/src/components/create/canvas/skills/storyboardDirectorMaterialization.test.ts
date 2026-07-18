/**
 * Unit tests for Storyboard Director materialization planning.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/skills/storyboardDirectorMaterialization.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
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
import type { StoryboardDirectorRecipe } from '../../../../lib/storyboard/recipe/types'
import {
  approveBeatStage,
  approveSceneStage,
  approveShotStage,
  createStoryboardDirectorRecipe,
  setRecipeDecision,
  updateRecipeDraft,
} from '../../../../lib/storyboard/recipe/state-machine'
import {
  importLegacyShotBoard,
  planStoryboardDirectorControlNode,
  planStoryboardDirectorDraftNodes,
  planStoryboardDirectorGroupedNodes,
  planStoryboardDirectorShotBoardSync,
  recordStoryboardDirectorReceipts,
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

describe('Storyboard Director compatibility draft planning and receipts', () => {
  test('creates stable image/video draft identities without a generation callback', () => {
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
      creatorSkill?: { skillId?: string }
      storyboardDirectorMaterialization?: Record<string, unknown>
    }
    assert.equal(firstMetadata.creatorSkill?.skillId, 'storyboard-director')
    assert.deepEqual(firstMetadata.storyboardDirectorMaterialization, {
      recipeId: recipe.recipeId,
      shotId: first.create[0]!.resultId,
      sourceArtifactId: recipe.shot.approvedArtifact!.artifactId,
      identity: first.create[0]!.identity,
      outputKind: first.create[0]!.kind,
      duration: recipe.shot.drafts[0]!.duration,
    })
    assert.equal(/provider|api[_-]?key|secret/i.test(JSON.stringify(firstMetadata)), false)

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
