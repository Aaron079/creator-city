import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  deleteObject,
  getChinaObject,
  getChinaStorageStatus,
  getConfiguredChinaStorageProvider,
  getSignedDownloadUrl,
  putChinaObject,
} from '@/lib/storage/china/gateway'
import { isChinaStorageError } from '@/lib/storage/china/errors'

export const dynamic = 'force-dynamic'

const VOLCENGINE_ARK_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const CONNECTIVITY_TIMEOUT_MS = 12000

type ConnectivityErrorCode =
  | 'volcengine_network_failed'
  | 'volcengine_auth_failed'
  | 'volcengine_endpoint_invalid'
  | 'seedream_model_invalid'
  | 'seedance_model_invalid'
  | 'oss_client_init_failed'
  | 'oss_upload_failed'
  | 'oss_signed_url_failed'
  | 'oss_read_failed'
  | 'oss_delete_failed'

type VolcengineConnectivity = {
  ok: boolean
  endpoint: string
  authOk: boolean
  networkOk: boolean
  status: number | null
  errorCode: ConnectivityErrorCode | null
  errorMessage: string | null
  requestId: string | null
}

type ModelConnectivity = {
  ok: boolean
  model: string
  errorCode: ConnectivityErrorCode | null
}

type OssConnectivity = {
  ok: boolean
  bucket: string
  signedUrlAvailable: boolean
  uploadTestOk: boolean
  readTestOk: boolean
  deleteTestOk: boolean
  errorCode: ConnectivityErrorCode | null
  errorMessage: string | null
}

function envValue(name: string) {
  return process.env[name]?.trim() || ''
}

function normalizedArkBaseUrl() {
  return (envValue('VOLCENGINE_ARK_BASE_URL') || VOLCENGINE_ARK_DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function modelsEndpoint(baseUrl: string) {
  return /\/models$/i.test(baseUrl) ? baseUrl : `${baseUrl}/models`
}

function timeoutSignal(ms = CONNECTIVITY_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, cancel: () => clearTimeout(timer) }
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function parseJson(raw: string) {
  if (!raw.trim()) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function responseRequestId(response: Response, data: unknown) {
  const record = recordValue(data)
  const error = recordValue(record.error)
  return typeof error.request_id === 'string'
    ? error.request_id
    : typeof record.request_id === 'string'
      ? record.request_id
      : response.headers.get('x-request-id') || response.headers.get('x-tt-logid')
}

function responseErrorCode(data: unknown) {
  const record = recordValue(data)
  const error = recordValue(record.error)
  return typeof error.code === 'string'
    ? error.code
    : typeof record.code === 'string'
      ? record.code
      : ''
}

function responseErrorMessage(data: unknown, fallback: string) {
  const record = recordValue(data)
  const error = recordValue(record.error)
  return typeof error.message === 'string'
    ? error.message
    : typeof record.message === 'string'
      ? record.message
      : fallback
}

function fetchErrorMessage(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error || 'fetch failed')
}

function extractModelIds(data: unknown) {
  const record = recordValue(data)
  const rawItems = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.models)
      ? record.models
      : []
  const ids = rawItems
    .map((item) => {
      if (typeof item === 'string') return item
      const itemRecord = recordValue(item)
      return typeof itemRecord.id === 'string'
        ? itemRecord.id
        : typeof itemRecord.model === 'string'
          ? itemRecord.model
          : ''
    })
    .filter(Boolean)
  return ids.length ? new Set(ids) : null
}

async function checkVolcengine(): Promise<VolcengineConnectivity & { modelIds: Set<string> | null }> {
  const endpoint = modelsEndpoint(normalizedArkBaseUrl())
  const apiKey = envValue('VOLCENGINE_ARK_API_KEY')
  if (!apiKey) {
    return {
      ok: false,
      endpoint,
      authOk: false,
      networkOk: false,
      status: null,
      errorCode: 'volcengine_auth_failed',
      errorMessage: 'VOLCENGINE_ARK_API_KEY is not configured.',
      requestId: null,
      modelIds: null,
    }
  }

  const { signal, cancel } = timeoutSignal()
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
    })
    const raw = await response.text().catch(() => '')
    const data = parseJson(raw)
    const requestId = responseRequestId(response, data)
    const upstreamMessage = responseErrorMessage(data, response.statusText || `HTTP ${response.status}`)
    const rawCode = responseErrorCode(data)
    const authFailed = response.status === 401 || response.status === 403
    const endpointInvalid = response.status === 404 || response.status === 405
    const ok = response.ok
    return {
      ok,
      endpoint,
      authOk: !authFailed,
      networkOk: true,
      status: response.status,
      errorCode: ok
        ? null
        : authFailed
          ? 'volcengine_auth_failed'
          : endpointInvalid
            ? 'volcengine_endpoint_invalid'
            : 'volcengine_endpoint_invalid',
      errorMessage: ok ? null : [rawCode, upstreamMessage].filter(Boolean).join(': ') || `Volcengine metadata request returned HTTP ${response.status}.`,
      requestId,
      modelIds: response.ok ? extractModelIds(data) : null,
    }
  } catch (error) {
    return {
      ok: false,
      endpoint,
      authOk: false,
      networkOk: false,
      status: null,
      errorCode: 'volcengine_network_failed',
      errorMessage: fetchErrorMessage(error),
      requestId: null,
      modelIds: null,
    }
  } finally {
    cancel()
  }
}

function checkModel(model: string, modelIds: Set<string> | null, errorCode: ConnectivityErrorCode): ModelConnectivity {
  const configured = Boolean(model)
  const listed = configured && modelIds ? modelIds.has(model) : true
  return {
    ok: configured && listed,
    model,
    errorCode: configured && listed ? null : errorCode,
  }
}

function storageErrorMessage(error: unknown) {
  if (isChinaStorageError(error)) {
    const details = recordValue(error.details)
    const upstreamCode = typeof details.code === 'string' ? details.code : ''
    const requestId = typeof details.requestId === 'string' ? `requestId=${details.requestId}` : ''
    return [upstreamCode, error.message, requestId].filter(Boolean).join(' · ')
  }
  return error instanceof Error ? error.message : String(error || 'OSS operation failed.')
}

async function checkOss(): Promise<OssConnectivity> {
  const provider = getConfiguredChinaStorageProvider()
  const config = getChinaStorageStatus(provider)
  const result: OssConnectivity = {
    ok: false,
    bucket: config.bucket || '',
    signedUrlAvailable: false,
    uploadTestOk: false,
    readTestOk: false,
    deleteTestOk: false,
    errorCode: null,
    errorMessage: null,
  }

  if (!config.configured) {
    return {
      ...result,
      errorCode: 'oss_client_init_failed',
      errorMessage: `OSS config missing: ${config.missing.join(', ')}`,
    }
  }

  const key = `test/healthcheck/connectivity-${Date.now()}-${randomUUID()}.txt`
  const body = Buffer.from(`creator-city connectivity ${new Date().toISOString()}\n`, 'utf8')

  try {
    const signed = await getSignedDownloadUrl({
      provider,
      key,
      contentType: 'text/plain',
      expiresInSeconds: 300,
    })
    result.bucket = signed.bucket || result.bucket
    result.signedUrlAvailable = Boolean(signed.signedUrl || signed.url || signed.publicUrl)
    if (!result.signedUrlAvailable) {
      result.errorCode = 'oss_signed_url_failed'
      result.errorMessage = 'OSS signed URL generation returned an empty URL.'
    }
  } catch (error) {
    result.errorCode = 'oss_signed_url_failed'
    result.errorMessage = storageErrorMessage(error)
  }

  try {
    const uploaded = await putChinaObject({
      provider,
      key,
      body,
      contentType: 'text/plain',
      metadata: {
        source: 'creator-city-connectivity',
      },
    })
    result.bucket = uploaded.bucket || result.bucket
    result.uploadTestOk = true
  } catch (error) {
    return {
      ...result,
      errorCode: result.errorCode ?? 'oss_upload_failed',
      errorMessage: result.errorMessage ?? storageErrorMessage(error),
    }
  }

  try {
    const object = await getChinaObject({ provider, key })
    result.bucket = object.bucket || result.bucket
    result.readTestOk = object.body.toString('utf8') === body.toString('utf8')
    if (!result.readTestOk) {
      result.errorCode = result.errorCode ?? 'oss_read_failed'
      result.errorMessage = result.errorMessage ?? 'OSS read test returned unexpected content.'
    }
  } catch (error) {
    result.errorCode = result.errorCode ?? 'oss_read_failed'
    result.errorMessage = result.errorMessage ?? storageErrorMessage(error)
  }

  try {
    await deleteObject({ provider, key })
    result.deleteTestOk = true
  } catch (error) {
    result.errorCode = result.errorCode ?? 'oss_delete_failed'
    result.errorMessage = result.errorMessage ?? storageErrorMessage(error)
  }

  result.ok = result.signedUrlAvailable && result.uploadTestOk && result.readTestOk && result.deleteTestOk
  return result
}

export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({
      ok: false,
      errorCode: 'UNAUTHORIZED',
      message: '请先登录后再检查外接 API 连通性。',
    }, { status: 401 })
  }

  const volcengine = await checkVolcengine()
  const seedream = checkModel(envValue('VOLCENGINE_SEEDREAM_MODEL'), volcengine.modelIds, 'seedream_model_invalid')
  const seedance = checkModel(envValue('VOLCENGINE_SEEDANCE_MODEL'), volcengine.modelIds, 'seedance_model_invalid')
  const oss = await checkOss()
  const publicVolcengine: VolcengineConnectivity = {
    ok: volcengine.ok,
    endpoint: volcengine.endpoint,
    authOk: volcengine.authOk,
    networkOk: volcengine.networkOk,
    status: volcengine.status,
    errorCode: volcengine.errorCode,
    errorMessage: volcengine.errorMessage,
    requestId: volcengine.requestId,
  }

  return NextResponse.json({
    ok: publicVolcengine.ok && seedream.ok && seedance.ok && oss.ok,
    volcengine: publicVolcengine,
    seedream,
    seedance,
    oss,
  }, { status: 200 })
}
