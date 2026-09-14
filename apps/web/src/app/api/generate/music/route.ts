import { generationAccessResponse } from '@/lib/generation/access'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runOwnedGeneration } from '@/lib/generation/owned-generation'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const accessError = await generationAccessResponse()
  if (accessError) return accessError
  let body: Partial<GenerateRequest>
  try {
    body = await request.json() as Partial<GenerateRequest>
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON', errorCode: 'INVALID_INPUT' }, { status: 400 })
  }

  const providerId = body.providerId ?? ''
  const prompt = body.prompt ?? ''

  const billing = await setupBilling(request, providerId, 'music', prompt)
  if (!billing.ok) {
    return NextResponse.json(billing.errorResponse, { status: billing.status })
  }

  const raw = await runOwnedGeneration({
    providerId,
    nodeType: 'music',
    prompt,
    inputAssets: body.inputAssets,
    params: body.params,
    projectId: body.projectId,
    nodeId: body.nodeId,
  }, billing.ctx.userId)

  if (raw.errorCode === 'GENERATION_JOB_TRACKING_FAILED') return NextResponse.json(raw, { status: 503 })
  if (raw.status === 'queued' || raw.status === 'running') return NextResponse.json(raw)
  const result = await finalizeBilling(raw, billing.ctx.billingJobId)
  return NextResponse.json(result)
}
