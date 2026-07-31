import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  runCreatorSkill,
  type CreatorSkillSourceNode,
} from '../../skills'
import {
  approveBeatStage,
  approveSceneStage,
  approveShotStage,
  createStoryboardDirectorRecipe,
  markRecipeSourceMissing,
  setRecipeDecision,
  updateRecipeDraft,
} from './state-machine'
import type { StoryboardDirectorRecipe, StoryboardDirectorStageId } from './types'
import { getStoryboardDirectorWorkflowGuidance } from './workflowGuidance'

const NOW = '2026-07-31T01:00:00.000Z'
const source: CreatorSkillSourceNode = {
  id: 'source-1',
  kind: 'text',
  title: 'Pilot',
  prompt: [
    'INT. LAB - NIGHT',
    'Mara opens the sealed case.',
    '',
    'EXT. ROOF - DAWN',
    'Mara runs toward the antenna.',
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
) {
  return stageDrafts(recipe, stageId).reduce(
    (next, item) => setRecipeDecision(
      next,
      stageId,
      itemId(stageId, item as unknown as Record<string, unknown>),
      'approved',
      NOW,
    ),
    recipe,
  )
}

function completedRecipe() {
  let started = createStoryboardDirectorRecipe(
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
    NOW,
    runCreatorSkill,
  )
  for (const item of started.scene.drafts) {
    started = updateRecipeDraft(started, 'scene-review', item.sceneId, {
      characters: item.sceneId === 'scene-001' ? ['Jose'] : ['Mara'],
    }, NOW)
  }
  const beatReview = approveSceneStage(
    decideAll(started, 'scene-review'),
    NOW,
    runCreatorSkill,
  )
  let decidedBeats = decideAll(beatReview, 'beat-review')
  decidedBeats = {
    ...decidedBeats,
    shot: {
      ...decidedBeats.shot,
      options: { ...decidedBeats.shot.options, requestedShotCount: 6 },
    },
  }
  let shotReview = approveBeatStage(
    decidedBeats,
    NOW,
    runCreatorSkill,
  )
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
      shotReview = updateRecipeDraft(shotReview, 'shot-review', item.shotId, patch, NOW)
    }
  }
  return approveShotStage(decideAll(shotReview, 'shot-review'), NOW)
}

describe('Storyboard Director workflow guidance', () => {
  test('guides a stale recipe back to its immutable source', () => {
    const staleRecipe = markRecipeSourceMissing(completedRecipe(), NOW)
    const guidance = getStoryboardDirectorWorkflowGuidance(staleRecipe)

    assert.deepEqual(guidance, {
      tone: 'warning',
      action: 'focus-source',
      label: '定位来源并开始新版本',
      detail: '来源已变化，当前版本不能审核或落地。',
    })
  })

  test('guides a pending stage toward completing its review', () => {
    let recipe = createStoryboardDirectorRecipe(
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
      NOW,
      runCreatorSkill,
    )
    for (const item of recipe.scene.drafts) {
      recipe = updateRecipeDraft(recipe, 'scene-review', item.sceneId, {
        characters: item.sceneId === 'scene-001' ? ['Jose'] : ['Mara'],
      }, NOW)
    }

    assert.deepEqual(getStoryboardDirectorWorkflowGuidance(recipe), {
      tone: 'neutral',
      action: 'wait',
      label: '完成当前阶段审核',
      detail: '为每个场景选择通过或不通过后，才能批准当前阶段。',
    })
  })

  test('guides a ready recipe to materialize reviewed results', () => {
    const guidance = getStoryboardDirectorWorkflowGuidance(completedRecipe())

    assert.deepEqual(guidance, {
      tone: 'ready',
      action: 'materialize-grouped',
      label: '落地审核结果',
      detail: '镜头已审核完成，可将结果明确写入画布。',
    })
  })

  test('keeps a partial batch blocked until it is explicitly checked', () => {
    const guidance = getStoryboardDirectorWorkflowGuidance(completedRecipe(), {
      partialBatchBlocked: true,
    })

    assert.deepEqual(guidance, {
      tone: 'warning',
      action: 'wait',
      label: '先确认部分批次',
      detail: '存在未完整落地的批次，确认检查前不能继续创建或同步。',
    })
  })
})
