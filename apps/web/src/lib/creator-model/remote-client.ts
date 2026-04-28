import type { CreatorModelRequest, CreatorModelResponse } from './types'

function responseId() {
  return `cmr_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeContent(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>

  if (typeof b.content === 'string') return b.content
  if (typeof b.text === 'string') return b.text

  const message = b.message
  if (typeof message === 'object' && message !== null) {
    const m = message as Record<string, unknown>
    if (typeof m.content === 'string') return m.content
  }

  const choices = b.choices
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0] as Record<string, unknown>
    const choiceMsg = choice.message as Record<string, unknown> | undefined
    if (choiceMsg && typeof choiceMsg.content === 'string') return choiceMsg.content
  }

  return null
}

export async function callRemoteCreatorModel(
  request: CreatorModelRequest,
): Promise<CreatorModelResponse> {
  const endpoint = process.env.CREATOR_MODEL_ENDPOINT
  const apiKey = process.env.CREATOR_MODEL_API_KEY
  const modelName = process.env.CREATOR_MODEL_NAME || 'creator-city-remote'
  const timeoutMs = Number(process.env.CREATOR_MODEL_TIMEOUT_MS) || 20000

  if (!endpoint) {
    return {
      id: responseId(),
      createdAt: new Date().toISOString(),
      mode: 'error',
      provider: 'creator-city',
      model: modelName,
      configured: false,
      content: '自有模型 endpoint 未配置，请设置 CREATOR_MODEL_ENDPOINT。',
      error: 'endpoint-not-configured',
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName,
        messages: request.messages,
        context: request.context,
        options: request.options,
      }),
    })

    clearTimeout(timer)

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[creator-model] remote endpoint error', response.status, detail)
      return {
        id: responseId(),
        createdAt: new Date().toISOString(),
        mode: 'error',
        provider: 'creator-city',
        model: modelName,
        configured: true,
        content: '自有模型 endpoint 调用失败，请检查 endpoint、key、模型名或额度。',
        error: `remote-${response.status}`,
      }
    }

    const body: unknown = await response.json()
    const content = normalizeContent(body)

    if (!content) {
      return {
        id: responseId(),
        createdAt: new Date().toISOString(),
        mode: 'error',
        provider: 'creator-city',
        model: modelName,
        configured: true,
        content: '自有模型 endpoint 返回格式无法识别，请检查响应结构。',
        error: 'unrecognized-response-format',
      }
    }

    return {
      id: responseId(),
      createdAt: new Date().toISOString(),
      mode: 'remote',
      provider: 'creator-city',
      model: modelName,
      configured: true,
      content,
    }
  } catch (error) {
    clearTimeout(timer)
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    console.error('[creator-model] remote call failed', error)
    return {
      id: responseId(),
      createdAt: new Date().toISOString(),
      mode: 'error',
      provider: 'creator-city',
      model: modelName,
      configured: true,
      content: isTimeout
        ? `自有模型 endpoint 调用超时（${timeoutMs / 1000}s），请检查服务是否正常运行。`
        : '自有模型 endpoint 调用失败，请检查 endpoint、key、模型名或额度。',
      error: isTimeout ? 'timeout' : 'network-error',
    }
  }
}
