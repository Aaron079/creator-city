import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'
import { gatewayGenerate } from '@/lib/gateway/generate'
import { getCurrentUser } from '@/lib/auth/current-user'
import { attachGeneratedAsset } from '@/lib/assets/generated-assets'
import { generateDeepSeekText } from '@/lib/providers/china/deepseek'
import { generateKimiText } from '@/lib/providers/china/kimi'
import type { GenerateResponse } from '@/lib/providers/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    let body: Partial<GenerateRequest>
    try {
      body = await request.json() as Partial<GenerateRequest>
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON', errorCode: 'INVALID_INPUT' }, { status: 400 })
    }

    const providerId = body.providerId || 'openai-text'
    const prompt = body.prompt ?? ''

    const billing = await setupBilling(request, providerId, 'text', prompt)
    if (!billing.ok) {
      return NextResponse.json(billing.errorResponse, { status: billing.status })
    }

    const currentUser = await getCurrentUser()
    let raw: GenerateResponse
    if (providerId === 'kimi-text' || providerId === 'deepseek-text' || providerId === 'deepseek-reasoner') {
      const maxTokens = typeof body.params?.maxTokens === 'number' ? body.params.maxTokens : undefined
      const system = typeof body.params?.system === 'string' ? body.params.system : undefined
      const chinaResult = providerId === 'kimi-text'
        ? await generateKimiText({ prompt, system, maxTokens })
        : await generateDeepSeekText({ prompt, system, maxTokens, providerId })

      raw = chinaResult.success
        ? {
            success: true,
            providerId,
            mode: 'real',
            status: 'succeeded',
            result: { text: chinaResult.text, metadata: { model: chinaResult.model } },
            message: `文本生成成功（${chinaResult.model}）`,
          }
        : {
            success: false,
            providerId,
            mode: 'unavailable',
            status: chinaResult.errorCode === 'PROVIDER_NOT_CONFIGURED' ? 'not-configured' : 'failed',
            message: chinaResult.message,
            errorCode: chinaResult.errorCode,
          }
    } else {
      raw = await gatewayGenerate({
        providerId,
        nodeType: 'text',
        prompt,
        inputAssets: body.inputAssets,
        params: body.params,
        projectId: body.projectId,
        nodeId: body.nodeId,
      }, currentUser?.id)
    }

    const result = await attachGeneratedAsset(await finalizeBilling(raw, billing.ctx.billingJobId), {
      userId: currentUser?.id ?? billing.ctx.userId,
      providerId,
      nodeType: 'text',
      prompt,
      projectId: body.projectId,
      nodeId: body.nodeId,
    })
    return NextResponse.json({
      ...result,
      text: result.result?.text,
      model: result.result?.metadata?.model,
    }, { status: result.success ? 200 : result.errorCode === 'PROVIDER_NOT_FOUND' ? 404 : 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成请求失败'
    console.error('[api/generate/text]', err)
    return NextResponse.json({ success: false, message, errorCode: 'PROVIDER_REQUEST_FAILED' }, { status: 500 })
  }
}
