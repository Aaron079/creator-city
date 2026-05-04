import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'
import { gatewayGenerate } from '@/lib/gateway/generate'
import { getCurrentUser } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    let body: Partial<GenerateRequest>
    try {
      body = await request.json() as Partial<GenerateRequest>
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON', errorCode: 'INVALID_INPUT' }, { status: 400 })
    }

    const providerId = body.providerId ?? ''
    const prompt = body.prompt ?? ''

    const billing = await setupBilling(request, providerId, 'text', prompt)
    if (!billing.ok) {
      return NextResponse.json(billing.errorResponse, { status: billing.status })
    }

    const currentUser = await getCurrentUser()
    const raw = await gatewayGenerate({
      providerId,
      nodeType: 'text',
      prompt,
      inputAssets: body.inputAssets,
      params: body.params,
      projectId: body.projectId,
      nodeId: body.nodeId,
    }, currentUser?.id)

    const result = await finalizeBilling(raw, billing.ctx.billingJobId)
    return NextResponse.json(result, { status: result.success ? 200 : result.errorCode === 'PROVIDER_NOT_FOUND' ? 404 : 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成请求失败'
    console.error('[api/generate/text]', err)
    return NextResponse.json({ success: false, message, errorCode: 'PROVIDER_REQUEST_FAILED' }, { status: 500 })
  }
}
