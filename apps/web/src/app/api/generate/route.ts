import { NextRequest, NextResponse } from 'next/server'
import { generate, VALID_ROLES } from '@/lib/ai'
import type { AgentRole } from '@/lib/ai'

interface RequestBody {
  idea?: string
  role?: string
  style?: string
  context?: string
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RequestBody
  const { idea = '', role = '', style, context } = body

  if (!VALID_ROLES.includes(role as AgentRole)) {
    return NextResponse.json({ error: `unknown role: ${role}` }, { status: 400 })
  }

  try {
    const result = await generate({ idea, role: role as AgentRole, style, context })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
