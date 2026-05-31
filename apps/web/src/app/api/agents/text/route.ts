/**
 * POST /api/agents/text
 *
 * Global Text Agent — wraps OpenAI Chat Completions for internal use.
 * Used for: Prompt optimization, storyboard generation, asset analysis, generic Q&A.
 *
 * Auth: enforced via setupBilling() → getCurrentUser().
 * Billing: reserve → generate → settle/release pattern.
 *
 * Does NOT: write DB, write canvas, generate nodes, call image/video APIs.
 */

import { NextResponse } from 'next/server'
import { generateOpenAITextAgent } from '@/lib/global-providers/openaiText'
import type { GlobalTextAgentMode } from '@/lib/global-providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'
import type { GenerateResponse } from '@/lib/providers/types'

const MAX_PROMPT_LENGTH = 8_000
const MAX_CONTEXT_LENGTH = 2_000
const MAX_SYSTEM_PROMPT_LENGTH = 2_000

const VALID_MODES: GlobalTextAgentMode[] = ['prompt_optimize', 'storyboard', 'asset_analysis', 'generic']

function err(errorCode: string, message: string, status = 400) {
  return NextResponse.json({ success: false, errorCode, message }, { status })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return err('INVALID_JSON', 'Request body must be valid JSON.')
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return err('INVALID_BODY', 'Request body must be a JSON object.')
  }

  const b = body as Record<string, unknown>

  const prompt = typeof b.prompt === 'string' ? b.prompt.trim() : ''
  if (!prompt) {
    return err('PROMPT_REQUIRED', '"prompt" must be a non-empty string.')
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return err('PROMPT_TOO_LONG', `"prompt" must not exceed ${MAX_PROMPT_LENGTH} characters. Got ${prompt.length}.`)
  }

  const rawMode = typeof b.mode === 'string' ? b.mode : undefined
  const mode: GlobalTextAgentMode | undefined =
    rawMode && VALID_MODES.includes(rawMode as GlobalTextAgentMode)
      ? (rawMode as GlobalTextAgentMode)
      : undefined

  const systemPrompt = typeof b.systemPrompt === 'string'
    ? b.systemPrompt.slice(0, MAX_SYSTEM_PROMPT_LENGTH)
    : undefined

  const projectContext = typeof b.projectContext === 'string'
    ? b.projectContext.slice(0, MAX_CONTEXT_LENGTH)
    : undefined

  const nodeContext = typeof b.nodeContext === 'string'
    ? b.nodeContext.slice(0, MAX_CONTEXT_LENGTH)
    : undefined

  const projectId = typeof b.projectId === 'string' ? b.projectId : undefined
  const nodeId = typeof b.nodeId === 'string' ? b.nodeId : undefined

  // ── Reserve credits (also authenticates the user) ────────────────────────
  const billing = await setupBilling(null, 'openai-text', 'text', prompt, { projectId, nodeId })
  if (!billing.ok) {
    return NextResponse.json(billing.errorResponse, { status: billing.status })
  }
  const { ctx } = billing

  // ── Call OpenAI ───────────────────────────────────────────────────────────
  const result = await generateOpenAITextAgent({
    prompt,
    systemPrompt,
    projectContext,
    nodeContext,
    mode,
  })

  const rawError = result.providerRaw && typeof result.providerRaw === 'object'
    ? (result.providerRaw as Record<string, unknown>)
    : null
  const providerErrorCode = typeof rawError?.errorCode === 'string' ? rawError.errorCode : null
  const succeeded = !providerErrorCode && !!result.text

  // ── Settle or release credits ─────────────────────────────────────────────
  const genResponse: GenerateResponse = {
    success: succeeded,
    providerId: 'openai-text',
    mode: 'real',
    status: succeeded ? 'succeeded' : 'failed',
    message: succeeded ? '' : (typeof rawError?.message === 'string' ? rawError.message : 'Text generation failed.'),
  }
  await finalizeBilling(genResponse, ctx.billingJobId)

  // ── Return error if provider failed ──────────────────────────────────────
  if (providerErrorCode) {
    const message = typeof rawError?.message === 'string' ? rawError.message : 'Text generation failed.'
    const status = providerErrorCode === 'OPENAI_API_KEY_MISSING' ? 503
      : providerErrorCode === 'OPENAI_AUTH_FAILED' ? 503
      : providerErrorCode === 'OPENAI_RATE_LIMITED' ? 429
      : providerErrorCode === 'OPENAI_REQUEST_TIMEOUT' ? 504
      : 502
    return NextResponse.json({
      success: false,
      errorCode: providerErrorCode,
      message,
    }, { status })
  }

  if (!result.text) {
    return NextResponse.json({
      success: false,
      errorCode: 'EMPTY_RESPONSE',
      message: 'Provider returned an empty response.',
    }, { status: 502 })
  }

  return NextResponse.json({
    success: true,
    providerId: result.providerId,
    model: result.model,
    text: result.text,
    billing: { chargedCredits: ctx.estimatedCredits, billingStatus: 'SETTLED' },
  })
}
