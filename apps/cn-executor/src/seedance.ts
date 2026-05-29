const VOLCENGINE_ARK_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

export function getSeedanceConfigDebugPayload(): Record<string, unknown> {
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY?.trim() ?? ''
  const model = process.env.VOLCENGINE_SEEDANCE_MODEL?.trim() ?? ''
  const baseUrl = (process.env.VOLCENGINE_ARK_BASE_URL || VOLCENGINE_ARK_DEFAULT_BASE_URL).replace(/\/+$/, '')
  const endpoint = `${baseUrl}/contents/generations/tasks`
  return {
    ok: Boolean(apiKey && model),
    provider: 'volcengine_seedance',
    endpoint,
    apiKey: { present: Boolean(apiKey), keyPreview: apiKey ? `${apiKey.slice(0, 6)}...` : '' },
    model: { present: Boolean(model), valuePreview: model },
    notes: [
      'model must be a Volcengine Ark video generation model ID or endpoint ID',
      'VOLCENGINE_ARK_API_KEY is shared with Seedream',
    ],
  }
}

function seedanceTaskEndpoint(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return /\/contents\/generations\/tasks$/i.test(base) ? base : `${base}/contents/generations/tasks`
}

function seedanceTaskStatusEndpoint(baseUrl: string, taskId: string): string {
  return `${seedanceTaskEndpoint(baseUrl)}/${encodeURIComponent(taskId)}`
}

function normalizeSeedanceRatio(value?: string): string {
  const ratio = String(value || '').trim().toLowerCase()
  if (ratio === '16:9' || ratio === '9:16' || ratio === '1:1') return ratio
  if (ratio === '3:4' || ratio === '4:5') return '9:16'
  if (ratio === '4:3' || ratio === '21:9' || ratio === 'adaptive') return '16:9'
  return '16:9'
}

function normalizeSeedanceDuration(value?: number): number {
  if (!Number.isFinite(value)) return 5
  return Math.round(Number(value)) <= 5 ? 5 : 10
}

function normalizeSeedanceResolution(value?: string): string | undefined {
  const resolution = String(value || '').trim().toLowerCase()
  if (!resolution) return undefined
  if (resolution === '480p' || resolution === '720p' || resolution === '1080p') return resolution
  if (resolution.includes('1080')) return '1080p'
  if (resolution.includes('720')) return '720p'
  if (resolution.includes('480')) return '480p'
  return undefined
}

function randomHex(n: number): string {
  return [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
}

export function buildVideoOssKey(projectId?: string | null, nodeId?: string | null): string {
  const prefix = projectId ? `projects/${projectId}` : 'uploads'
  const sub = nodeId ? `nodes/${nodeId}` : 'videos'
  return `${prefix}/${sub}/${Date.now()}-${randomHex(8)}.mp4`
}

export async function downloadVideoBuffer(url: string, timeoutMs = 180_000): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

function findVideoUrl(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) && /\.(mp4|mov|m3u8|webm)(\?|#|$)/i.test(value)) return value
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUrl(item)
      if (found) return found
    }
    return null
  }
  if (typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['video_url', 'videoUrl', 'url', 'output_url', 'outputUrl', 'content_url', 'contentUrl']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) return candidate
    if (candidate) {
      const found = findVideoUrl(candidate)
      if (found) return found
    }
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') {
      const found = findVideoUrl(nested)
      if (found) return found
    }
  }
  return null
}

function findTaskId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['task_id', 'taskId', 'id']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate) return candidate
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') {
      const found = findTaskId(nested)
      if (found) return found
    }
  }
  return null
}

function normalizeTaskStatus(value: unknown): 'running' | 'done' | 'error' | null {
  const status = typeof value === 'string' ? value.toLowerCase() : ''
  if (['queued', 'pending', 'running', 'processing', 'submitted', 'created', 'in_progress'].includes(status)) return 'running'
  if (['succeeded', 'success', 'completed', 'complete', 'done'].includes(status)) return 'done'
  if (['failed', 'failure', 'error', 'cancelled', 'canceled', 'expired'].includes(status)) return 'error'
  return null
}

function findStatus(value: unknown): 'running' | 'done' | 'error' | null {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStatus(item)
      if (found) return found
    }
    return null
  }
  const record = value as Record<string, unknown>
  for (const key of ['status', 'state', 'task_status', 'taskStatus', 'phase']) {
    const status = normalizeTaskStatus(record[key])
    if (status) return status
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') {
      const found = findStatus(nested)
      if (found) return found
    }
  }
  return null
}

export type SeedanceSubmitInput = {
  prompt: string
  imageUrl?: string | null
  model?: string
  duration?: number
  aspectRatio?: string
  resolution?: string
}

export type SeedanceSubmitResult =
  | { success: true; taskId: string; model: string; endpoint: string; submittedInput: Record<string, unknown> }
  | { success: false; errorCode: string; message: string; upstreamStatus?: number; endpoint?: string; submittedInput?: Record<string, unknown> }

export type SeedancePollResult =
  | { success: true; status: 'running'; taskId: string }
  | { success: true; status: 'done'; taskId: string; videoUrl: string }
  | { success: false; taskId: string; errorCode: string; message: string }

export async function submitSeedanceTask(input: SeedanceSubmitInput): Promise<SeedanceSubmitResult> {
  const model = (input.model || process.env.VOLCENGINE_SEEDANCE_MODEL || '').trim()
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY?.trim()
  const baseUrl = (process.env.VOLCENGINE_ARK_BASE_URL || VOLCENGINE_ARK_DEFAULT_BASE_URL).replace(/\/+$/, '')
  const endpoint = seedanceTaskEndpoint(baseUrl)

  if (!apiKey) {
    return { success: false, errorCode: 'provider_auth_failed', message: 'VOLCENGINE_ARK_API_KEY is not configured.', endpoint }
  }
  if (!model) {
    return { success: false, errorCode: 'provider_invalid_parameter', message: 'VOLCENGINE_SEEDANCE_MODEL is not configured.', endpoint }
  }
  if (!input.prompt.trim()) {
    return { success: false, errorCode: 'missing_generation_input', message: 'Seedance prompt is empty.', endpoint }
  }

  const ratio = normalizeSeedanceRatio(input.aspectRatio)
  const duration = normalizeSeedanceDuration(input.duration)
  const normalizedResolution = normalizeSeedanceResolution(input.resolution)
  const resolution = input.imageUrl && normalizedResolution === '1080p' ? '720p' : normalizedResolution

  const content: Array<Record<string, unknown>> = [{ type: 'text', text: input.prompt.trim() }]
  if (input.imageUrl) content.push({ type: 'image_url', image_url: { url: input.imageUrl } })

  const body: Record<string, unknown> = { model, content, ratio, duration }
  if (resolution) body.resolution = resolution

  const submittedInput: Record<string, unknown> = {
    model, endpoint, ratio, duration,
    resolution: resolution ?? null,
    hasImageUrl: Boolean(input.imageUrl),
    promptChars: input.prompt.trim().length,
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (err) {
    return {
      success: false, errorCode: 'provider_fetch_failed',
      message: `Seedance task submit failed: ${err instanceof Error ? err.message : String(err)}`,
      endpoint, submittedInput,
    }
  }

  let data: unknown
  try { data = await response.json() } catch {
    return {
      success: false, errorCode: 'provider_invalid_response',
      message: `Seedance returned HTTP ${response.status} with non-JSON body`,
      upstreamStatus: response.status, endpoint, submittedInput,
    }
  }

  if (!response.ok) {
    const errData = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    const errObj = errData.error && typeof errData.error === 'object' ? errData.error as Record<string, unknown> : errData
    const errMsg = typeof errObj.message === 'string' ? errObj.message : `HTTP ${response.status}`
    return {
      success: false, errorCode: 'SEEDANCE_TASK_CREATE_FAILED', message: errMsg,
      upstreamStatus: response.status, endpoint, submittedInput,
    }
  }

  const taskId = findTaskId(data)
  if (!taskId) {
    return {
      success: false, errorCode: 'provider_no_task_id',
      message: 'Seedance did not return a task ID.',
      upstreamStatus: response.status, endpoint, submittedInput,
    }
  }

  console.log('[cn-executor][seedance] submit response sample', {
    taskId, httpStatus: response.status, model, endpoint,
    hasImageUrl: Boolean(input.imageUrl), duration, ratio,
    responseBody: JSON.stringify(data).slice(0, 1500),
  })
  return { success: true, taskId, model, endpoint, submittedInput }
}

export async function pollSeedanceTask(taskId: string, _pollIndex?: number): Promise<SeedancePollResult> {
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY?.trim()
  const baseUrl = (process.env.VOLCENGINE_ARK_BASE_URL || VOLCENGINE_ARK_DEFAULT_BASE_URL).replace(/\/+$/, '')
  const endpoint = seedanceTaskStatusEndpoint(baseUrl, taskId)

  if (!apiKey) {
    return { success: false, taskId, errorCode: 'provider_auth_failed', message: 'VOLCENGINE_ARK_API_KEY is not configured.' }
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    return {
      success: false, taskId, errorCode: 'provider_fetch_failed',
      message: `Seedance status fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  let data: unknown
  try { data = await response.json() } catch {
    return { success: false, taskId, errorCode: 'provider_invalid_response', message: `HTTP ${response.status} non-JSON` }
  }

  if (_pollIndex === undefined || _pollIndex === 0 || _pollIndex % 10 === 0) {
    console.log('[cn-executor][seedance] poll response sample', {
      taskId, pollIndex: _pollIndex, httpStatus: response.status,
      responseBody: JSON.stringify(data).slice(0, 1500),
    })
  }

  if (!response.ok) {
    const errData = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    const errObj = errData.error && typeof errData.error === 'object' ? errData.error as Record<string, unknown> : errData
    const errMsg = typeof errObj.message === 'string' ? errObj.message : `HTTP ${response.status}`
    return { success: false, taskId, errorCode: 'provider_request_failed', message: errMsg }
  }

  const videoUrl = findVideoUrl(data)
  const status = findStatus(data)

  if (videoUrl || status === 'done') {
    if (!videoUrl) return { success: false, taskId, errorCode: 'provider_no_download_url', message: '任务完成但未找到 videoUrl。' }
    return { success: true, status: 'done', taskId, videoUrl }
  }
  if (status === 'error') {
    const errData = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    const errObj = errData.error && typeof errData.error === 'object' ? errData.error as Record<string, unknown> : {}
    const message = typeof errObj.message === 'string' ? errObj.message : '视频任务失败。'
    return { success: false, taskId, errorCode: 'SEEDANCE_TASK_FAILED', message }
  }

  return { success: true, status: 'running', taskId }
}

export async function pollSeedanceTaskUntilDone(
  taskId: string,
  opts: { maxPolls?: number; intervalMs?: number } = {},
): Promise<SeedancePollResult> {
  const maxPolls = opts.maxPolls ?? 96        // 96 × 5s = 8 min
  const intervalMs = opts.intervalMs ?? 5_000
  let polls = 0
  while (polls < maxPolls) {
    await new Promise((r) => setTimeout(r, intervalMs))
    const result = await pollSeedanceTask(taskId, polls)
    polls += 1
    if (!result.success) return result
    if (result.status === 'done') return result
    console.log(`[cn-executor][seedance] polling task ${taskId} (${polls}/${maxPolls}): still running`)
  }
  console.log('[cn-executor][seedance] provider timeout summary', { taskId, totalPolls: polls, maxPolls })
  return { success: false, taskId, errorCode: 'provider_timeout', message: `Seedance task ${taskId} timed out after ${maxPolls} polls.` }
}
