/**
 * OpenAI Text Agent — Global Provider
 *
 * Server-side only. Uses Chat Completions API (POST /v1/chat/completions).
 * Source: OpenAI OpenAPI spec v2.3.0 — https://github.com/openai/openai-openapi
 *
 * Endpoint:  https://api.openai.com/v1/chat/completions
 * Default model: gpt-4.1-mini (confirmed in OpenAI OpenAPI spec, enum list)
 * Response:  response.choices[0].message.content
 *
 * Auth: OPENAI_API_KEY (server-side env only, never exposed to client)
 */

import type { GlobalTextAgentInput, GlobalTextAgentMode, GlobalTextAgentOutput } from './types'

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_MODEL = 'gpt-4.1-mini'
const TIMEOUT_MS = 45_000
const MAX_TOKENS = 2048

function buildSystemPrompt(mode?: GlobalTextAgentMode): string {
  switch (mode) {
    case 'prompt_optimize':
      return '你是专业影视 Prompt 优化 Agent。保留用户原意，不添加受版权保护的 IP，不夸大，不改变主体身份。输出可直接用于图像/视频生成的 Prompt，语言简洁、画面感强。'
    case 'storyboard':
      return '你是专业分镜 Agent。把用户创意拆成镜头序列，每个镜头包含：景别、运动方式、画面描述、建议时长（秒）、声音建议。输出结构化的分镜列表，每个镜头编号。'
    case 'asset_analysis':
      return '你是素材分析 Agent。根据用户描述的素材或上下文，分析其用途、潜在风险、可接续生成方向。输出条目化分析，聚焦创作可行性。'
    default:
      return '你是 Creator City 的创作助手，回答要结构化、简洁、可执行。'
  }
}

type OpenAIChatResponse = {
  id?: string
  model?: string
  choices?: Array<{
    message?: { content?: string | null }
    finish_reason?: string
  }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

export async function generateOpenAITextAgent(
  input: GlobalTextAgentInput,
): Promise<GlobalTextAgentOutput> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return {
      text: '',
      model: '',
      providerId: 'openai-text',
      providerRaw: { errorCode: 'OPENAI_API_KEY_MISSING', message: 'OPENAI_API_KEY is not configured.' },
    }
  }

  const model = process.env.OPENAI_TEXT_MODEL?.trim() || DEFAULT_MODEL

  const systemContent = input.systemPrompt ?? buildSystemPrompt(input.mode)

  const userParts: string[] = [input.prompt]
  if (input.projectContext) userParts.push(`\n[项目背景]\n${input.projectContext}`)
  if (input.nodeContext) userParts.push(`\n[节点上下文]\n${input.nodeContext}`)
  const userContent = userParts.join('')

  const body = {
    model,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ],
    max_tokens: MAX_TOKENS,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
    return {
      text: '',
      model,
      providerId: 'openai-text',
      providerRaw: {
        errorCode: isTimeout ? 'OPENAI_REQUEST_TIMEOUT' : 'OPENAI_FETCH_FAILED',
        message: err instanceof Error ? err.message : String(err),
      },
    }
  }
  clearTimeout(timer)

  let raw: OpenAIChatResponse
  try {
    raw = await response.json() as OpenAIChatResponse
  } catch {
    return {
      text: '',
      model,
      providerId: 'openai-text',
      providerRaw: {
        errorCode: 'OPENAI_INVALID_RESPONSE',
        message: `OpenAI returned HTTP ${response.status} with non-JSON body`,
        upstreamStatus: response.status,
      },
    }
  }

  if (!response.ok) {
    const errBody = raw as Record<string, unknown>
    const errMsg = typeof (errBody as { error?: { message?: string } }).error?.message === 'string'
      ? (errBody as { error: { message: string } }).error.message
      : `OpenAI HTTP ${response.status}`
    const code =
      response.status === 401 || response.status === 403 ? 'OPENAI_AUTH_FAILED'
      : response.status === 429 ? 'OPENAI_RATE_LIMITED'
      : response.status === 404 ? 'OPENAI_MODEL_NOT_FOUND'
      : 'OPENAI_REQUEST_FAILED'
    return {
      text: '',
      model,
      providerId: 'openai-text',
      providerRaw: { errorCode: code, message: errMsg, upstreamStatus: response.status, raw: errBody },
    }
  }

  const text = raw.choices?.[0]?.message?.content ?? ''
  const resolvedModel = raw.model ?? model

  return {
    text,
    model: resolvedModel,
    providerId: 'openai-text',
    providerRaw: { id: raw.id, usage: raw.usage },
  }
}

export { buildSystemPrompt }
