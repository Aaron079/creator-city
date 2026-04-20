import { generate } from '../index'
import type { SkillInput, SkillOutput } from './types'

/** Director skill — text, receives writer output as context */
export async function directorSkill({ idea, style, context, params }: SkillInput): Promise<SkillOutput> {
  const result = await generate({ idea, role: 'director', style, context, params })
  return { content: result.content, source: result.source }
}
