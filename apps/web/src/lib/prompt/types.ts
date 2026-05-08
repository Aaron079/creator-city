import type { CreatorSkill, CreatorSkillTarget, ProjectStyleBible } from '@/lib/skills'
import type { EdgeDirective } from '@/lib/canvas/edge-director'
import type { CharacterProfile } from '@/lib/characters'

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
  edgeCharacterDirectives?: {
    inheritedCharacterIdsFromEdges?: string[]
    lockCharacterConsistency?: boolean
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
    inheritedCharacterIdsFromEdges?: string[]
    characterConsistencyLocked?: boolean
    edgeDirectivesApplied: Array<{
      sourceNodeId: string
      targetNodeId: string
      type: string
      influenceWeight: number
    }>
  }
}
