import type { SkillName, SkillInput, SkillOutput, SkillFn } from './types'
import { writerSkill }    from './writer'
import { directorSkill }  from './director'
import { actorSkill }     from './actor'
import { cameraSkill }    from './camera'
import { videoSkill }     from './video'
import { finalEditSkill } from './finalEdit'

export type { SkillName, SkillInput, SkillOutput, ShotSummary } from './types'
export { SKILL_NAMES } from './types'

const SKILLS: Record<SkillName, SkillFn> = {
  writer:       writerSkill,
  director:     directorSkill,
  actor:        actorSkill,
  camera:       cameraSkill,
  video:        videoSkill,
  'final-edit': finalEditSkill,
}

/** Run a named skill with the given input. Called by /api/skill route. */
export function runSkill(name: SkillName, input: SkillInput): Promise<SkillOutput> {
  return SKILLS[name](input)
}
