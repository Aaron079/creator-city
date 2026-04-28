import { NextResponse } from 'next/server'
import { runGenerate } from '@/lib/providers/generate'
import type { GenerateRequest } from '@/lib/providers/types'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: Partial<GenerateRequest>
  try {
    body = await request.json() as Partial<GenerateRequest>
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON', errorCode: 'INVALID_INPUT' }, { status: 400 })
  }

  const result = await runGenerate({
    providerId: body.providerId ?? '',
    nodeType: 'image',
    prompt: body.prompt ?? '',
    inputAssets: body.inputAssets,
    params: body.params,
    projectId: body.projectId,
    nodeId: body.nodeId,
  })

  return NextResponse.json(result)
}
