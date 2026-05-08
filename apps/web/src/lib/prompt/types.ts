import type { CreatorSkill, CreatorSkillTarget, ProjectStyleBible } from '@/lib/skills'

export type CompileNodePromptInput = {
  nodeKind: CreatorSkillTarget
  userPrompt: string
  upstreamText?: string
  upstreamImageUrl?: string
  styleBible?: ProjectStyleBible | null
  enabledSkills: CreatorSkill[]
  providerId?: string
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
  }
}
