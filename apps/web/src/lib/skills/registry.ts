import { DEFAULT_CREATOR_SKILLS } from './default-skills'
import type { CreatorSkill, CreatorSkillTarget } from './types'

export const CREATOR_SKILL_REGISTRY: CreatorSkill[] = DEFAULT_CREATOR_SKILLS

export function getCreatorSkillById(id: string) {
  return CREATOR_SKILL_REGISTRY.find((skill) => skill.id === id) ?? null
}

export function getDefaultCreatorSkillIds() {
  return CREATOR_SKILL_REGISTRY
    .filter((skill) => skill.enabledByDefault)
    .map((skill) => skill.id)
}

export function resolveCreatorSkills(ids: string[], target?: CreatorSkillTarget) {
  const enabled = new Set(ids)
  return CREATOR_SKILL_REGISTRY.filter((skill) => {
    if (!enabled.has(skill.id)) return false
    return target ? skill.appliesTo.includes(target) : true
  })
}
