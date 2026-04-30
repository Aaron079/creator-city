import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runGenerate } from '@/lib/providers/generate'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: Partial<GenerateRequest>
  try {
    body = await request.json() as Partial<GenerateRequest>
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON', errorCode: 'INVALID_INPUT' }, { status: 400 })
  }

  const providerId = body.providerId ?? ''
  const prompt = body.prompt ?? ''

  const billing = await setupBilling(request, providerId, 'video', prompt)
  if (!billing.ok) {
    return NextResponse.json(billing.errorResponse, { status: billing.status })
  }

  const raw = await runGenerate({
    providerId,
    nodeType: 'video',
    prompt,
    inputAssets: body.inputAssets,
    params: body.params,
    projectId: body.projectId,
    nodeId: body.nodeId,
  })

  const result = await finalizeBilling(raw, billing.ctx.billingJobId)
  return NextResponse.json(result)
}
