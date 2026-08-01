import { createCreatorSkillFingerprint } from '../../skills'
import type { CreatorSkillSourceNode } from '../../skills'
import {
  STORYBOARD_DIRECTOR_RECIPE_SKILL_VERSION,
  type StoryboardDirectorMaterializationReceipt,
  type StoryboardDirectorPartialBatchOperation,
  type StoryboardDirectorRecipe,
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
      prompt: JSON.stringify([kind, artifactId, resultId]),
    }],
  }).replace(/^csf1_/, 'sdrm1_')
}

export function createStoryboardDirectorPartialBatchIdentity(
  recipeId: string,
  operation: StoryboardDirectorPartialBatchOperation,
  plannedIdentities: readonly string[],
) {
  const stableRecipeId = requireId(recipeId, 'recipeId')
  if (operation !== 'grouped-materialization' && operation !== 'draft-node-creation') {
    throw new TypeError('operation is invalid')
  }
  const identities = plannedIdentities.map((identity, index) => (
    requireId(identity, `plannedIdentities[${index}]`)
  )).sort()
  if (new Set(identities).size !== identities.length) {
    throw new TypeError('plannedIdentities must be unique')
  }
  return createCreatorSkillFingerprint('storyboard-director-partial-batch', '1.0.0', {
    sourceNodes: [{
      id: stableRecipeId,
      kind: 'text',
      title: '',
      prompt: JSON.stringify([operation, identities]),
    }],
  }).replace(/^csf1_/, 'sdrb1_')
}

export function createStoryboardDirectorRecipeRevision(
  recipe: StoryboardDirectorRecipe,
) {
  return createCreatorSkillFingerprint('storyboard-director-recipe-revision', '1.0.0', {
    sourceNodes: [{
      id: requireId(recipe.recipeId, 'recipe.recipeId'),
      kind: 'text',
      title: '',
      prompt: '',
    }],
    options: { recipe },
  }).replace(/^csf1_/, 'sdrr1_')
}

/**
 * Sketch boards store this revision, calculated without the board itself, so
 * persisted board metadata can never participate in its own identity.
 */
export function createStoryboardDirectorRecipeSketchRevision(
  recipe: StoryboardDirectorRecipe,
) {
  return createStoryboardDirectorRecipeRevision({ ...recipe, sketchBoard: null })
}
