import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'
import { gatewayGenerate } from '@/lib/gateway/generate'
import { attachGeneratedAsset } from '@/lib/assets/generated-assets'
import { generateDeepSeekText } from '@/lib/providers/china/deepseek'
import { generateKimiText } from '@/lib/providers/china/kimi'
import type { GenerateResponse } from '@/lib/providers/types'

function isSessionDbError(err: unknown): boolean {
  return err instanceof Error && (err as Error & { code?: string }).code === 'SESSION_DB_UNAVAILABLE'
}

export const dynamic = 'force-dynamic'

type TextGenerateResponse = GenerateResponse & {
  model?: string
  upstreamStatus?: number
  upstreamMessage?: string
  rawCode?: string
  requestId?: string
}

type TextGenerateBody = Partial<GenerateRequest> & {
  maxTokens?: number
  system?: string
  compiledPrompt?: string
}

export async function POST(request: NextRequest) {
  try {
    let body: TextGenerateBody
    try {
      body = await request.json() as TextGenerateBody
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON', errorCode: 'INVALID_INPUT' }, { status: 400 })
    }

    const providerId = body.providerId || 'openai-text'
    const prompt = body.compiledPrompt?.trim() || body.prompt?.trim() || ''
    if (!prompt) {
      return NextResponse.json({
        success: false,
        errorCode: 'PROMPT_REQUIRED',
        message: '请输入文本提示词',
        providerId,
        mode: 'unavailable',
        status: 'failed',
      }, { status: 200 })
    }

    let billing
    try {
      billing = await setupBilling(request, providerId, 'text', prompt)
    } catch (err) {
      if (isSessionDbError(err)) {
        return NextResponse.json({
          success: false,
          errorCode: 'GENERATION_AUTH_UNAVAILABLE',
          message: '登录状态暂时无法确认，请稍后重试。',
          retryable: true,
          requestId: crypto.randomUUID(),
          providerId,
          mode: 'unavailable',
          status: 'failed',
        }, { status: 503 })
      }
      throw err
    }
    if (!billing.ok) {
      return NextResponse.json(billing.errorResponse, { status: billing.status })
    }

    const userId = billing.ctx.userId
    let raw: TextGenerateResponse
    if (providerId === 'kimi-text' || providerId === 'deepseek-text' || providerId === 'deepseek-reasoner') {
      const requestedMaxTokens = typeof body.maxTokens === 'number'
        ? body.maxTokens
        : typeof body.params?.maxTokens === 'number'
          ? body.params.maxTokens
          : undefined
      const maxTokens = providerId === 'deepseek-reasoner'
        ? Math.max(requestedMaxTokens ?? 2048, 2048)
        : requestedMaxTokens ?? 1024
      const system = typeof body.system === 'string'
        ? body.system
        : typeof body.params?.system === 'string'
          ? body.params.system
          : undefined
      const chinaResult = providerId === 'kimi-text'
        ? await generateKimiText({ prompt, system, maxTokens, purpose: 'generate' })
        : await generateDeepSeekText({
            prompt,
            system,
            maxTokens,
            providerId,
            reasoner: providerId === 'deepseek-reasoner',
            purpose: 'generate',
          })

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
            model: chinaResult.model,
            upstreamStatus: chinaResult.upstreamStatus,
            upstreamMessage: chinaResult.upstreamMessage,
            rawCode: chinaResult.rawCode,
            requestId: chinaResult.requestId,
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
      }, userId)
    }

    const finalized = await finalizeBilling(raw, billing.ctx.billingJobId) as TextGenerateResponse
    const result = await attachGeneratedAsset(finalized, {
      userId,
      providerId,
      nodeType: 'text',
      prompt,
      projectId: body.projectId,
      nodeId: body.nodeId,
    }) as TextGenerateResponse
    return NextResponse.json({
      ...result,
      text: result.result?.text,
      resultText: result.result?.text,
      model: result.result?.metadata?.model ?? result.model,
      upstreamStatus: result.upstreamStatus,
      upstreamMessage: result.upstreamMessage,
      rawCode: result.rawCode,
      requestId: result.requestId,
    }, { status: result.success ? 200 : result.errorCode === 'PROVIDER_NOT_FOUND' ? 404 : 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成请求失败'
    console.error('[api/generate/text]', err)
    return NextResponse.json({ success: false, message, errorCode: 'PROVIDER_REQUEST_FAILED' }, { status: 500 })
  }
}
