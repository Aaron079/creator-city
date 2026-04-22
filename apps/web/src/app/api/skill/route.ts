import { NextRequest, NextResponse } from 'next/server'
import { runSkill, SKILL_NAMES } from '@/lib/ai/skills'
import type { SkillName, ShotSummary } from '@/lib/ai/skills'
import type { GlobalPro } from '@/lib/ai/prompts'

const DEFAULT_MODEL_CONFIG = { imageModel: 'nano-banana-2', videoModel: 'runway' }

interface RequestBody {
  skill?: string
  idea?: string
  style?: string
  context?: string
  imageUrl?: string
  keyframePrompt?: string
  shots?: ShotSummary[]
  globalPro?: Partial<GlobalPro>
  params?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RequestBody
  const { skill = '', idea = '', style, context, imageUrl, keyframePrompt, shots, params } = body

  if (!SKILL_NAMES.includes(skill as SkillName)) {
    return NextResponse.json({ error: `unknown skill: "${skill}"` }, { status: 400 })
  }

  // Ensure modelConfig is always present — fill in defaults if client omitted it
  const globalPro: GlobalPro | undefined = body.globalPro
    ? { ...body.globalPro, modelConfig: body.globalPro.modelConfig ?? DEFAULT_MODEL_CONFIG } as GlobalPro
    : undefined

  try {
    const result = await runSkill(skill as SkillName, {
      idea, style, context, imageUrl, keyframePrompt, shots, globalPro, params,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'skill execution failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
