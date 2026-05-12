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
import { providerFetch } from '@/lib/providers/china/provider-fetch'

export const dynamic = 'force-dynamic'

const VOLCENGINE_ARK_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

type ConnectivityErrorCode =
  | 'volcengine_network_failed'
  | 'volcengine_auth_failed'
  | 'volcengine_endpoint_invalid'
  | 'provider_connectivity_requires_manual_generation_test'
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
  providerEndpoint?: string
  providerRequestMethod?: string
  providerHttpStatus?: number
  providerFetchError?: string
  providerFetchCause?: Record<string, unknown>
  upstreamMessage?: string
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

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
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

  const result = await providerFetch(endpoint, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    timeoutMs: 12_000,
    submittedInput: {
      endpoint: '/models',
      method: 'GET',
      purpose: 'connectivity',
    },
  })
  if (result.ok) {
    return {
      ok: true,
      endpoint,
      authOk: true,
      networkOk: true,
      status: result.providerHttpStatus,
      errorCode: null,
      errorMessage: null,
      requestId: result.requestId ?? null,
      providerEndpoint: result.providerEndpoint,
      providerRequestMethod: result.providerRequestMethod,
      providerHttpStatus: result.providerHttpStatus,
      upstreamMessage: result.upstreamMessage,
      modelIds: extractModelIds(result.data),
    }
  }

  const reachedProvider = typeof result.providerHttpStatus === 'number'
  const metadataUnavailable = result.providerHttpStatus === 404 || result.providerHttpStatus === 405
  return {
    ok: false,
    endpoint,
    authOk: result.errorCode !== 'provider_auth_failed',
    networkOk: reachedProvider,
    status: result.providerHttpStatus ?? null,
    errorCode: result.errorCode === 'provider_auth_failed'
      ? 'volcengine_auth_failed'
      : metadataUnavailable
        ? 'provider_connectivity_requires_manual_generation_test'
        : reachedProvider
          ? 'volcengine_endpoint_invalid'
          : 'volcengine_network_failed',
    errorMessage: metadataUnavailable
      ? 'Volcengine models metadata endpoint is unavailable; manual generation test is required and was not run automatically.'
      : result.errorMessage,
    requestId: result.requestId ?? null,
    providerEndpoint: result.providerEndpoint,
    providerRequestMethod: result.providerRequestMethod,
    providerHttpStatus: result.providerHttpStatus,
    providerFetchError: result.providerFetchError,
    providerFetchCause: result.providerFetchCause,
    upstreamMessage: result.upstreamMessage,
    modelIds: null,
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
    providerEndpoint: volcengine.providerEndpoint,
    providerRequestMethod: volcengine.providerRequestMethod,
    providerHttpStatus: volcengine.providerHttpStatus,
    providerFetchError: volcengine.providerFetchError,
    providerFetchCause: volcengine.providerFetchCause,
    upstreamMessage: volcengine.upstreamMessage,
  }

  return NextResponse.json({
    ok: publicVolcengine.ok && seedream.ok && seedance.ok && oss.ok,
    volcengine: publicVolcengine,
    seedream,
    seedance,
    oss,
  }, { status: 200 })
}
