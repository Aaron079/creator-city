import type { CreatorSkill, CreatorSkillTarget, ProjectStyleBible } from '@/lib/skills'
import type { EdgeDirective } from '@/lib/canvas/edge-director'
import type { CharacterProfile } from '@/lib/characters'
import type { SceneEditMark, SceneEditTask, SceneProfile } from '@/lib/scenes'

export type CompileNodePromptInput = {
  nodeKind: CreatorSkillTarget
  userPrompt: string
  upstreamText?: string
  upstreamImageUrl?: string
  styleBible?: ProjectStyleBible | null
  enabledSkills: CreatorSkill[]
  providerId?: string
  edgeDirectives?: EdgeDirective[]
  characters?: CharacterProfile[]
  scenes?: SceneProfile[]
  sceneEditTasks?: SceneEditTask[]
  sceneEdits?: SceneEditMark[]
  edgeCharacterDirectives?: {
    inheritedCharacterIdsFromEdges?: string[]
    lockCharacterConsistency?: boolean
  }
  edgeSceneDirectives?: {
    inheritedSceneIdsFromEdges?: string[]
    lockSceneConsistency?: boolean
  }
}

export type CompiledNodePrompt = {
  prompt: string
  system: string
  debug: {
    userPrompt: string
    upstreamTextIncluded: boolean
    upstreamImageIncluded: boolean
    styleBibleIncluded: boolean
    skillsApplied: string[]
    charactersApplied: Array<{
      id: string
      name: string
    }>
    scenesApplied: Array<{
      id: string
      name: string
    }>
    inheritedCharacterIdsFromEdges?: string[]
    inheritedSceneIdsFromEdges?: string[]
    characterConsistencyLocked?: boolean
    sceneConsistencyLocked?: boolean
    sceneEditsApplied?: Array<{
      id: string
      tool: string
      label: string
    }>
    sceneEditTasksApplied?: Array<{
      id: string
      type: string
      label: string
    }>
    edgeDirectivesApplied: Array<{
      sourceNodeId: string
      targetNodeId: string
      type: string
      influenceWeight: number
    }>
  }
}
