import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'
import { gatewayGenerate } from '@/lib/gateway/generate'
import { attachGeneratedAsset } from '@/lib/assets/generated-assets'
import { generateDeepSeekText } from '@/lib/providers/china/deepseek'
import { generateKimiText } from '@/lib/providers/china/kimi'
import { isDbConnectionError } from '@/lib/db-error'
import type { GenerateResponse } from '@/lib/providers/types'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { decryptProviderApiKey } from '@/lib/provider-accounts/crypto'

function isSessionDbError(err: unknown): boolean {
  return err instanceof Error && (err as Error & { code?: string }).code === 'SESSION_DB_UNAVAILABLE'
}

// Translate raw provider error to user-facing message — never expose the key.
function userProviderErrorMessage(upstreamStatus?: number): string {
  if (upstreamStatus === 401 || upstreamStatus === 403) return 'API Key 无效，请在账户管理页重新添加有效的 Key。'
  if (upstreamStatus === 402) return '账户额度不足，请在服务商处充值后重试。'
  if (upstreamStatus === 429) return '请求频率超限，请稍后重试。'
  return '生成失败，请检查 API 账户状态或稍后重试。'
}

// Direct OpenAI call using a user-supplied key. Never logs the key.
async function callOpenAIWithUserKey(
  apiKey: string,
  prompt: string,
  maxTokens: number,
  system?: string,
): Promise<TextGenerateResponse> {
  const model = 'gpt-4.1-mini'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const messages: Array<{ role: string; content: string }> = []
    if (system) messages.push({ role: 'system', content: system })
    messages.push({ role: 'user', content: prompt })
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    })
    const raw = await response.text()
    clearTimeout(timer)
    if (!response.ok) {
      return { success: false, providerId: 'openai-text', mode: 'unavailable', status: 'failed', errorCode: 'OPENAI_TEXT_FAILED', message: userProviderErrorMessage(response.status) }
    }
    let data: { choices?: Array<{ message?: { content?: string } }> } = {}
    try { data = JSON.parse(raw) } catch { /* ignore */ }
    const text = data.choices?.[0]?.message?.content?.trim() ?? ''
    if (text) return { success: true, providerId: 'openai-text', mode: 'real', status: 'succeeded', result: { text, metadata: { model } }, message: `文本生成成功（${model}）` }
    return { success: false, providerId: 'openai-text', mode: 'unavailable', status: 'failed', errorCode: 'OPENAI_TEXT_FAILED', message: 'OpenAI 未返回文本内容，请重试。' }
  } catch (error) {
    clearTimeout(timer)
    const isAbort = error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))
    return { success: false, providerId: 'openai-text', mode: 'unavailable', status: 'failed', errorCode: 'OPENAI_TEXT_FAILED', message: isAbort ? '请求超时，请稍后重试。' : 'OpenAI 调用失败，请稍后重试。' }
  }
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
  billingMode?: 'platform_credits' | 'user_provider_account'
  userProviderAccountId?: string
}

export async function POST(request: NextRequest) {
  let generationStage = 'init'
  let providerId = 'openai-text'
  try {
    let body: TextGenerateBody
    try {
      body = await request.json() as TextGenerateBody
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON', errorCode: 'INVALID_INPUT' }, { status: 400 })
    }

    providerId = body.providerId || 'openai-text'
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

    // ── User Provider Account mode ─────────────────────────────────────────────
    // When billingMode = 'user_provider_account', bypass platform billing entirely.
    // The user's own encrypted key is fetched, decrypted in-memory, and used once.
    // The plaintext key is never logged or returned.
    if (body.billingMode === 'user_provider_account') {
      const user = await getCurrentUser()
      if (!user) {
        return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录后再使用 API 账户生成。', providerId, mode: 'unavailable', status: 'failed' }, { status: 401 })
      }
      const accountId = body.userProviderAccountId
      if (!accountId || typeof accountId !== 'string') {
        return NextResponse.json({ success: false, errorCode: 'MISSING_ACCOUNT_ID', message: '请选择一个 API 账户。', providerId, mode: 'unavailable', status: 'failed' }, { status: 400 })
      }
      const account = await db.userProviderAccount.findFirst({
        where: { id: accountId, userId: user.id },
        select: { id: true, providerId: true, status: true, encryptedApiKey: true },
      })
      if (!account) {
        return NextResponse.json({ success: false, errorCode: 'ACCOUNT_NOT_FOUND', message: '未找到该 API 账户，请在账户管理页检查。', providerId, mode: 'unavailable', status: 'failed' }, { status: 404 })
      }
      if (account.status === 'disabled' || account.status === 'invalid') {
        const reason = account.status === 'invalid' ? '已失效，请重新添加有效的 API Key' : '已停用，请在账户管理页启用后再使用'
        return NextResponse.json({ success: false, errorCode: 'ACCOUNT_UNAVAILABLE', message: `API 账户${reason}。`, providerId, mode: 'unavailable', status: 'failed' }, { status: 400 })
      }
      if (account.providerId !== providerId) {
        return NextResponse.json({ success: false, errorCode: 'ACCOUNT_PROVIDER_MISMATCH', message: '所选 API 账户与当前 Provider 不匹配，请重新选择。', providerId, mode: 'unavailable', status: 'failed' }, { status: 400 })
      }
      let plainKey: string
      try {
        plainKey = decryptProviderApiKey(account.encryptedApiKey)
      } catch {
        return NextResponse.json({ success: false, errorCode: 'DECRYPT_FAILED', message: 'API 账户暂时不可用，请重新添加或联系支持。', providerId, mode: 'unavailable', status: 'failed' }, { status: 500 })
      }
      generationStage = 'provider'
      const requestedMaxTokens = typeof body.maxTokens === 'number' ? body.maxTokens : undefined
      const system = typeof body.system === 'string' ? body.system : undefined
      let raw: TextGenerateResponse
      if (providerId === 'deepseek-text' || providerId === 'deepseek-reasoner') {
        const maxTokens = providerId === 'deepseek-reasoner' ? Math.max(requestedMaxTokens ?? 2048, 2048) : requestedMaxTokens ?? 1024
        const chinaResult = await generateDeepSeekText({ prompt, system, maxTokens, providerId, reasoner: providerId === 'deepseek-reasoner', purpose: 'generate', apiKeyOverride: plainKey })
        raw = chinaResult.success
          ? { success: true, providerId, mode: 'real', status: 'succeeded', result: { text: chinaResult.text, metadata: { model: chinaResult.model } }, message: `文本生成成功（${chinaResult.model}）` }
          : { success: false, providerId, mode: 'unavailable', status: 'failed', message: userProviderErrorMessage(chinaResult.upstreamStatus), errorCode: chinaResult.errorCode }
      } else if (providerId === 'kimi-text') {
        const chinaResult = await generateKimiText({ prompt, system, maxTokens: requestedMaxTokens ?? 1024, purpose: 'generate', apiKeyOverride: plainKey })
        raw = chinaResult.success
          ? { success: true, providerId, mode: 'real', status: 'succeeded', result: { text: chinaResult.text, metadata: { model: chinaResult.model } }, message: `文本生成成功（${chinaResult.model}）` }
          : { success: false, providerId, mode: 'unavailable', status: 'failed', message: userProviderErrorMessage(chinaResult.upstreamStatus), errorCode: chinaResult.errorCode }
      } else if (providerId === 'openai-text') {
        raw = await callOpenAIWithUserKey(plainKey, prompt, requestedMaxTokens ?? 2048, system)
      } else {
        return NextResponse.json({ success: false, errorCode: 'UNSUPPORTED_PROVIDER', message: `${providerId} 暂不支持自带 API 账户文本生成。`, providerId, mode: 'unavailable', status: 'failed' }, { status: 400 })
      }
      generationStage = 'asset_attach'
      const result = await attachGeneratedAsset(raw, { userId: user.id, providerId, nodeType: 'text', prompt, projectId: body.projectId, nodeId: body.nodeId }) as TextGenerateResponse
      return NextResponse.json({ ...result, text: result.result?.text, resultText: result.result?.text, model: result.result?.metadata?.model ?? result.model }, { status: result.success ? 200 : 200 })
    }
    // ── End User Provider Account mode ────────────────────────────────────────

    generationStage = 'auth_billing'
    let billing
    try {
      billing = await setupBilling(request, providerId, 'text', prompt)
    } catch (err) {
      if (isSessionDbError(err)) {
        console.error('[api/generate/text] DB unavailable at stage: auth_billing (session)', { stage: generationStage, providerId })
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

    generationStage = 'provider'
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

    generationStage = 'billing_finalize'
    const finalized = await finalizeBilling(raw, billing.ctx.billingJobId) as TextGenerateResponse

    generationStage = 'asset_attach'
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
    if (isDbConnectionError(err)) {
      console.error('[api/generate/text] DB connection unavailable', { stage: generationStage, providerId })
      return NextResponse.json({
        success: false,
        errorCode: 'DB_CONNECTION_UNAVAILABLE',
        message: '数据库连接繁忙，请稍后重试。',
        retryable: true,
        requestId: crypto.randomUUID(),
        mode: 'unavailable',
        status: 'failed',
      }, { status: 503 })
    }
    const message = err instanceof Error ? err.message : '生成请求失败'
    console.error('[api/generate/text] unexpected error', { stage: generationStage, providerId, message })
    return NextResponse.json({ success: false, message, errorCode: 'PROVIDER_REQUEST_FAILED' }, { status: 500 })
  }
}
