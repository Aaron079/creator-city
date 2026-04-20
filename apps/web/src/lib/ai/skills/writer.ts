import { generate } from '../index'
import type { SkillInput, SkillOutput } from './types'

/** Writer skill — text only, no upstream context needed */
export async function writerSkill({ idea, style, params }: SkillInput): Promise<SkillOutput> {
  const result = await generate({ idea, role: 'writer', style, params })
  return { content: result.content, source: result.source }
}
