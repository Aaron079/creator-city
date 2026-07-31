import {
  summarizeStoryboardDirectorRecipe,
} from './intelligence'
import type {
  StoryboardDirectorRecipe,
  StoryboardDirectorStageId,
} from './types'

export type StoryboardDirectorWorkflowGuidance = {
  tone: 'neutral' | 'warning' | 'ready'
  action: 'focus-source' | 'approve-stage' | 'resolve-findings' | 'materialize-grouped' | 'wait'
  label: string
  detail: string
}

function activeReviewStage(recipe: StoryboardDirectorRecipe) {
  if (recipe.activeStage === 'source') return null
  const stageById: Record<Exclude<StoryboardDirectorStageId, 'source'>, 'scene' | 'beat' | 'shot'> = {
    'scene-review': 'scene',
    'beat-review': 'beat',
    'shot-review': 'shot',
  }
  return recipe[stageById[recipe.activeStage]]
}

export function getStoryboardDirectorWorkflowGuidance(
  recipe: StoryboardDirectorRecipe,
  options: { partialBatchBlocked?: boolean } = {},
): StoryboardDirectorWorkflowGuidance {
  const summary = summarizeStoryboardDirectorRecipe(recipe)

  if (!summary.sourceFresh) {
    return {
      tone: 'warning',
      action: 'focus-source',
      label: '定位来源并开始新版本',
      detail: '来源已变化，当前版本不能审核或落地。',
    }
  }

  if (options.partialBatchBlocked) {
    return {
      tone: 'warning',
      action: 'wait',
      label: '先确认部分批次',
      detail: '存在未完整落地的批次，确认检查前不能继续创建或同步。',
    }
  }

  const stage = activeReviewStage(recipe)
  if (stage?.status === 'needs-review') {
    const complete = stage.drafts.length > 0
      && stage.drafts.every((item) => item.decision !== 'pending')
      && stage.drafts.some((item) => item.decision === 'approved')

    if (complete) {
      return {
        tone: 'neutral',
        action: 'approve-stage',
        label: '批准当前阶段',
        detail: '审核决定已完整，可进入下一阶段。',
      }
    }

    return {
      tone: 'neutral',
      action: 'wait',
      label: '完成当前阶段审核',
      detail: '为每个场景选择通过或不通过后，才能批准当前阶段。',
    }
  }

  if (summary.blockingCount > 0) {
    return {
      tone: 'warning',
      action: 'resolve-findings',
      label: '先处理阻塞问题',
      detail: '处理阻塞问题后，才能继续审核或落地。',
    }
  }

  if (summary.ready) {
    return {
      tone: 'ready',
      action: 'materialize-grouped',
      label: '落地审核结果',
      detail: '镜头已审核完成，可将结果明确写入画布。',
    }
  }

  return {
    tone: 'neutral',
    action: 'wait',
    label: '等待当前阶段完成',
    detail: '当前结果准备完成后，继续审核即可。',
  }
}
