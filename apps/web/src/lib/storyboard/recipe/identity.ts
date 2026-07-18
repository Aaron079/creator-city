import { createCreatorSkillFingerprint } from '../../skills'
import type { CreatorSkillSourceNode } from '../../skills'
import {
  STORYBOARD_DIRECTOR_RECIPE_SKILL_VERSION,
  type StoryboardDirectorMaterializationReceipt,
} from './types'

function requireId(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value.trim()
}

export function createStoryboardDirectorRecipeIdentity(
  context: { projectId: string; workflowId: string },
  source: CreatorSkillSourceNode,
) {
  const projectId = requireId(context.projectId, 'projectId')
  const workflowId = requireId(context.workflowId, 'workflowId')
  const sourceNodeId = requireId(source.id, 'sourceNode.id')
  if (source.kind !== 'text') throw new TypeError('Recipe source must be Text')
  const sourceText = (source.resultText?.trim() ? source.resultText : source.prompt).trim()
  if (!sourceText) throw new TypeError('Recipe source text is empty')
  const sourceFingerprint = createCreatorSkillFingerprint(
    'storyboard-director-source',
    STORYBOARD_DIRECTOR_RECIPE_SKILL_VERSION,
    {
      sourceNodes: [{ id: sourceNodeId, kind: 'text', title: '', prompt: sourceText }],
      projectContext: { projectId, workflowId },
    },
  )
  return {
    sourceFingerprint,
    recipeId: sourceFingerprint.replace(/^csf1_/, 'sdr1_'),
    sourceText,
  }
}

export function createRecipeMaterializationIdentity(
  recipeId: string,
  kind: StoryboardDirectorMaterializationReceipt['kind'],
  artifactId: string,
  resultId: string,
) {
  return createCreatorSkillFingerprint('storyboard-director-materialization', '1.0.0', {
    sourceNodes: [{
      id: recipeId,
      kind: 'text',
      title: '',
      prompt: `${kind}\n${artifactId}\n${resultId}`,
    }],
  }).replace(/^csf1_/, 'sdrm1_')
}
