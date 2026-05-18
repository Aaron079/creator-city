import { getProviderRegion, resolveProviderRegionInfo } from '@/lib/regions/router'

export type ExecutorInput = {
  userId?: string | null
  projectId?: string | null
  nodeId?: string | null
  prompt: string
  provider: string
  model?: string | null
  aspectRatio?: string | null
  duration?: number | null
  resolution?: string | null
  correlationId?: string | null
}

export type ExecutorResult = {
  success: boolean
  errorCode?: string
  errorMessage?: string
  providerRegion?: string
  upstreamStatus?: number
  [key: string]: unknown
}

export type ExecutorStatus = {
  configured: boolean
  baseUrlConfigured: boolean
}

function cnApiBaseUrl(): string {
  return process.env.CREATOR_CN_API_BASE_URL?.trim() ?? ''
}

function globalApiBaseUrl(): string {
  return process.env.CREATOR_GLOBAL_API_BASE_URL?.trim() ?? ''
}

export function getExecutorStatus(): { cn: ExecutorStatus; global: ExecutorStatus } {
  return {
    cn: {
      configured: Boolean(cnApiBaseUrl()),
      baseUrlConfigured: Boolean(cnApiBaseUrl()),
    },
    global: {
      configured: Boolean(globalApiBaseUrl()),
      baseUrlConfigured: Boolean(globalApiBaseUrl()),
    },
  }
}

export type ExecutorResolution = {
  providerId: string | null | undefined
  providerRegion: 'cn' | 'global'
  executionRegion: 'cn' | 'global'
  storageRegion: 'cn' | 'global'
  executor: 'cn' | 'global' | 'none'
  cnBaseUrlConfigured: boolean
  globalConfigured: boolean
  unknownProvider: boolean
  errorCode?: 'executor_region_missing'
}

export function getExecutorForProvider(provider?: string | null): ExecutorResolution {
  const { region, knownProvider } = resolveProviderRegionInfo(provider)
  const cnConfigured = Boolean(cnApiBaseUrl())
  const globalConfigured = Boolean(globalApiBaseUrl())
  const base: Omit<ExecutorResolution, 'executor' | 'errorCode'> = {
    providerId: provider,
    providerRegion: region,
    executionRegion: region,
    storageRegion: region,
    cnBaseUrlConfigured: cnConfigured,
    globalConfigured,
    unknownProvider: !knownProvider,
  }
  if (region === 'cn') {
    return cnConfigured
      ? { ...base, executor: 'cn' }
      : { ...base, executor: 'none', errorCode: 'executor_region_missing' }
  }
  return { ...base, executor: globalConfigured ? 'global' : 'none' }
}

function buildForwardBody(input: ExecutorInput): Record<string, unknown> {
  return {
    userId: input.userId ?? null,
    projectId: input.projectId ?? null,
    nodeId: input.nodeId ?? null,
    prompt: input.prompt,
    provider: input.provider,
    model: input.model ?? null,
    aspectRatio: input.aspectRatio ?? null,
    duration: input.duration ?? null,
    resolution: input.resolution ?? null,
    correlationId: input.correlationId ?? null,
  }
}

async function forwardToExecutor(
  baseUrl: string,
  path: string,
  input: ExecutorInput,
  timeoutMs?: number,
): Promise<ExecutorResult> {
  let response: Response
  try {
    const secret = process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim() ?? ''
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      // No credentials: 'same-origin' — never forward user cookies to the executor.
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-creator-executor-secret': secret } : {}),
      },
      body: JSON.stringify(buildForwardBody(input)),
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    })
  } catch (err) {
    return {
      success: false,
      errorCode: 'executor_fetch_failed',
      errorMessage: `Failed to reach executor at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return {
      success: false,
      errorCode: 'executor_invalid_response',
      errorMessage: `Executor at ${baseUrl} returned HTTP ${response.status} with non-JSON body`,
      upstreamStatus: response.status,
    }
  }

  if (!response.ok) {
    const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    return {
      success: false,
      errorCode: (typeof b.errorCode === 'string' ? b.errorCode : undefined) ?? 'executor_error',
      errorMessage: (typeof b.errorMessage === 'string' ? b.errorMessage : undefined)
        ?? (typeof b.message === 'string' ? b.message : undefined)
        ?? `Executor returned HTTP ${response.status}`,
      upstreamStatus: response.status,
      ...(b as Record<string, unknown>),
    }
  }

  return body as ExecutorResult
}

async function getExecutorStatusRequest(
  baseUrl: string,
  path: string,
  params: Record<string, string>,
): Promise<ExecutorResult> {
  const search = new URLSearchParams(params)
  let response: Response
  try {
    const secret = process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim() ?? ''
    response = await fetch(`${baseUrl}${path}?${search.toString()}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(secret ? { 'x-creator-executor-secret': secret } : {}),
      },
      cache: 'no-store',
    })
  } catch (err) {
    return {
      success: false,
      errorCode: 'executor_fetch_failed',
      errorMessage: `Failed to reach executor at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return {
      success: false,
      errorCode: 'executor_invalid_response',
      errorMessage: `Executor at ${baseUrl} returned HTTP ${response.status} with non-JSON body`,
      upstreamStatus: response.status,
    }
  }

  if (!response.ok) {
    const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    return {
      success: false,
      errorCode: (typeof b.errorCode === 'string' ? b.errorCode : undefined) ?? 'executor_error',
      errorMessage: (typeof b.errorMessage === 'string' ? b.errorMessage : undefined)
        ?? (typeof b.message === 'string' ? b.message : undefined)
        ?? `Executor returned HTTP ${response.status}`,
      upstreamStatus: response.status,
      ...(b as Record<string, unknown>),
    }
  }

  return body as ExecutorResult
}

export async function executeImageGenerationViaRegion(input: ExecutorInput): Promise<ExecutorResult> {
  const providerRegion = getProviderRegion(input.provider)

  if (providerRegion === 'cn') {
    const base = cnApiBaseUrl()
    if (!base) {
      return {
        success: false,
        errorCode: 'executor_region_missing',
        errorMessage: 'China executor is not configured. Set CREATOR_CN_API_BASE_URL.',
        providerRegion,
      }
    }
    return forwardToExecutor(base, '/api/generate/image', input)
  }

  const base = globalApiBaseUrl()
  if (!base) {
    return {
      success: false,
      errorCode: 'global_executor_not_configured',
      errorMessage: 'Global executor is not configured. Set CREATOR_GLOBAL_API_BASE_URL.',
      providerRegion,
    }
  }
  return forwardToExecutor(base, '/api/generate/image', input)
}

export async function startImageGenerationViaRegion(input: ExecutorInput): Promise<ExecutorResult> {
  const providerRegion = getProviderRegion(input.provider)

  if (providerRegion === 'cn') {
    const base = cnApiBaseUrl()
    if (!base) {
      return {
        success: false,
        errorCode: 'executor_region_missing',
        errorMessage: 'China executor is not configured. Set CREATOR_CN_API_BASE_URL.',
        providerRegion,
      }
    }
    return forwardToExecutor(base, '/api/generate/image/start', input, 70_000)
  }

  return executeImageGenerationViaRegion(input)
}

export async function getImageGenerationStatusViaRegion(provider: string, taskId: string): Promise<ExecutorResult> {
  const providerRegion = getProviderRegion(provider)

  if (providerRegion === 'cn') {
    const base = cnApiBaseUrl()
    if (!base) {
      return {
        success: false,
        errorCode: 'executor_region_missing',
        errorMessage: 'China executor is not configured. Set CREATOR_CN_API_BASE_URL.',
        providerRegion,
      }
    }
    return getExecutorStatusRequest(base, '/api/generate/image/status', { taskId })
  }

  const base = globalApiBaseUrl()
  if (!base) {
    return {
      success: false,
      errorCode: 'global_executor_not_configured',
      errorMessage: 'Global executor is not configured. Set CREATOR_GLOBAL_API_BASE_URL.',
      providerRegion,
    }
  }
  return getExecutorStatusRequest(base, '/api/generate/image/status', { taskId })
}

export async function executeVideoGenerationViaRegion(input: ExecutorInput): Promise<ExecutorResult> {
  const providerRegion = getProviderRegion(input.provider)

  if (providerRegion === 'cn') {
    const base = cnApiBaseUrl()
    if (!base) {
      return {
        success: false,
        errorCode: 'executor_region_missing',
        errorMessage: 'China executor is not configured. Set CREATOR_CN_API_BASE_URL.',
        providerRegion,
      }
    }
    return forwardToExecutor(base, '/api/generate/video', input)
  }

  const base = globalApiBaseUrl()
  if (!base) {
    return {
      success: false,
      errorCode: 'global_executor_not_configured',
      errorMessage: 'Global executor is not configured. Set CREATOR_GLOBAL_API_BASE_URL.',
      providerRegion,
    }
  }
  return forwardToExecutor(base, '/api/generate/video', input)
}
