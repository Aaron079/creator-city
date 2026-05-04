// Client-safe generate adapter: delegates to the Provider Gateway API routes.
// Server-side env reading happens inside the route, never here.
import type { ToolProviderNodeType } from '@/lib/tools/provider-catalog'
import type { GenerateResponse } from '@/lib/providers/types'

export interface GenerateWithProviderRequest {
  providerId: string
  nodeType: ToolProviderNodeType
  prompt: string
  inputAssets?: Array<{ id: string; type: string; url?: string }>
  params?: Record<string, string | number | boolean | undefined>
  projectId?: string
  nodeId?: string
}

export interface GenerateWithProviderResult {
  success: boolean
  mode: 'real' | 'mock' | 'bridge' | 'unavailable'
  resultPreview: string
  message: string
  jobId?: string
  billingJobId?: string
  status?: string
  result?: GenerateResponse['result']
  errorCode?: string
  requiredCredits?: number
  availableCredits?: number
}

async function readJsonSafely(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text()
  if (!raw.trim()) {
    return { success: false, errorCode: 'EMPTY_RESPONSE', message: `生成接口返回空响应（HTTP ${response.status}）` }
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { success: false, errorCode: 'NON_JSON_RESPONSE', message: `生成接口返回非 JSON 响应（HTTP ${response.status}）`, raw: raw.slice(0, 300) }
  }
}

function routeForNodeType(nodeType: ToolProviderNodeType): string {
  switch (nodeType) {
    case 'image': return '/api/generate/image'
    case 'video': return '/api/generate/video'
    case 'audio': return '/api/generate/audio'
    case 'music': return '/api/generate/music'
    default: return '/api/generate/text'
  }
}

function buildPreview(response: GenerateResponse, prompt: string): string {
  const { mode, providerId, status, result, message } = response

  if (result?.videoUrl) return `[real] ${providerId} · 视频已生成`
  if (result?.imageUrl) return `[real] ${providerId} · 图片已生成`
  if (result?.audioUrl) return `[real] ${providerId} · 音频已生成`
  if (result?.text) return result.text.slice(0, 200)
  if (status === 'queued' || status === 'running') return `[${mode}] ${providerId} · 生成中，请稍候…`
  if (status === 'not-configured') return `[未配置] ${providerId} · 视频生成 API 未配置，请到 /tools 配置 provider`
  if (mode === 'mock') return `[mock] ${providerId} · ${prompt.trim().slice(0, 80) || '未填写 prompt'}`
  return message.slice(0, 120)
}

export async function generateWithProvider(request: GenerateWithProviderRequest): Promise<GenerateWithProviderResult> {
  const route = routeForNodeType(request.nodeType)

  try {
    const response = await fetch(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    const data = await readJsonSafely(response) as GenerateResponse & {
      requiredCredits?: number
      availableCredits?: number
    }

    return {
      success: Boolean(data.success),
      mode: (data.mode as GenerateWithProviderResult['mode']) ?? 'unavailable',
      resultPreview: buildPreview(data, request.prompt),
      message: String(data.message ?? '生成失败'),
      jobId: data.jobId,
      billingJobId: data.billingJobId,
      status: data.status,
      result: data.result,
      errorCode: data.errorCode,
      requiredCredits: data.requiredCredits,
      availableCredits: data.availableCredits,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成请求失败'
    return {
      success: false,
      mode: 'unavailable',
      resultPreview: `[错误] ${request.providerId} · ${message}`,
      message,
      errorCode: 'PROVIDER_REQUEST_FAILED',
    }
  }
}

export async function pollJobStatus(jobId: string): Promise<GenerateWithProviderResult> {
  try {
    const response = await fetch(`/api/generate/jobs/${encodeURIComponent(jobId)}`)
    const data = await readJsonSafely(response) as GenerateResponse

    return {
      success: Boolean(data.success),
      mode: (data.mode as GenerateWithProviderResult['mode']) ?? 'unavailable',
      resultPreview: buildPreview(data, ''),
      message: String(data.message ?? 'Job status check failed'),
      jobId: data.jobId,
      status: data.status,
      result: data.result,
      errorCode: data.errorCode,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Job status check failed'
    return {
      success: false,
      mode: 'unavailable',
      resultPreview: `[错误] 无法查询任务状态：${message}`,
      message,
    }
  }
}
