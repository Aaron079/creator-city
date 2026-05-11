export type MediaRecoveryAction =
  | 'asset_recovered'
  | 'asset_found_by_node'
  | 'resynced_from_old_url'
  | 'no_recovery_source'
  | 'old_url_expired'
  | 'provider_media_download_failed'
  | 'storage_permission_error'
  | 'signing_error'
  | 'proxy_error'
  | 'error'

export type MediaRecoveryNextAction = 'show_media' | 'regenerate_from_prompt' | 'manual_debug'

export type FailedRecoveryUrl = {
  url: string
  reason: string
}

export type MediaRecoveryResponse = {
  ok: boolean
  success: boolean
  action: MediaRecoveryAction
  assetId: string | null
  resolvedUrl: string | null
  proxyUrl: string | null
  signedUrlAvailable: boolean | null
  proxyAvailable: boolean | null
  assetUrl: string | null
  stableUrl: string | null
  storageKey: string | null
  storageProvider: string | null
  bucket: string | null
  providerJobId: string | null
  recoveryStatus: string
  status: string
  errorCode: string | null
  errorMessage: string | null
  message: string | null
  error: string | null
  attemptedUrls: string[]
  failedUrls: FailedRecoveryUrl[]
  nextAction: MediaRecoveryNextAction
  mediaPersistence?: unknown
  upstreamStatus?: number | null
  upstreamMessage?: string | null
  requestId?: string | null
  actionTaken?: string | null
}

type RecoveryLike = {
  assetId?: unknown
  resolvedUrl?: unknown
  proxyUrl?: unknown
  proxyFallbackUrl?: unknown
  signedUrlAvailable?: unknown
  signedUrlGenerated?: unknown
  proxyAvailable?: unknown
  assetUrl?: unknown
  stableUrl?: unknown
  storageKey?: unknown
  storageProvider?: unknown
  bucket?: unknown
  providerJobId?: unknown
  recoveryStatus?: unknown
  status?: unknown
  errorCode?: unknown
  errorMessage?: unknown
  message?: unknown
  error?: unknown
  attemptedUrls?: unknown
  failedUrls?: unknown
  mediaPersistence?: unknown
  upstreamStatus?: unknown
  upstreamMessage?: unknown
  requestId?: unknown
  actionTaken?: unknown
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function attemptedUrlStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()]
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>
      const url = stringValue(record.url)
      return url ? [url] : []
    }
    return []
  })
}

function failedUrlRecords(value: unknown): FailedRecoveryUrl[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [{ url: item.trim(), reason: 'failed' }]
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>
      const url = stringValue(record.url)
      if (!url) return []
      return [{
        url,
        reason: stringValue(record.reason)
          || stringValue(record.errorCode)
          || stringValue(record.message)
          || stringValue(record.error)
          || 'failed',
      }]
    }
    return []
  })
}

function nextActionFor(action: MediaRecoveryAction): MediaRecoveryNextAction {
  if (action === 'asset_recovered' || action === 'asset_found_by_node' || action === 'resynced_from_old_url') return 'show_media'
  if (action === 'no_recovery_source' || action === 'old_url_expired' || action === 'provider_media_download_failed') return 'regenerate_from_prompt'
  return 'manual_debug'
}

export function normalizeRecoveryFailureCode(code: string) {
  if (!code) return 'generation_failed'
  if (code === 'ASSET_NOT_FOUND_BY_NODE' || code === 'ASSET_NOT_FOUND_FOR_NODE' || code === 'asset_not_found_by_node') return 'no_recovery_source'
  if (code === 'MEDIA_SOURCE_EXPIRED' || code === 'ASSET_DOWNLOAD_FAILED' || code === 'ASSET_DOWNLOAD_ERROR' || code === 'MEDIA_FETCH_FAILED') return 'old_url_expired'
  if (code === 'unrecoverable_provider_expired' || code === 'unrecoverable_expired_signed_url_without_storage_key') return 'old_url_expired'
  if (code === 'PROVIDER_MEDIA_DOWNLOAD_FAILED') return 'provider_media_download_failed'
  if (code === 'PROVIDER_INVALID_PARAMETER') return 'provider_invalid_parameter'
  if (code === 'PROVIDER_NOT_CONFIGURED' || code === 'missing_env') return 'provider_env_missing'
  if (code === 'provider_error') return 'generation_failed'
  return code
}

export function terminalRecoveryAction(code: string, attemptedUrls: string[] = []): MediaRecoveryAction {
  const normalized = normalizeRecoveryFailureCode(code)
  if (normalized === 'no_recovery_source') return 'no_recovery_source'
  if (normalized === 'provider_media_download_failed') return 'provider_media_download_failed'
  if (normalized === 'old_url_expired') return 'old_url_expired'
  if (normalized === 'storage_permission_error') return 'storage_permission_error'
  if (normalized === 'signing_error') return 'signing_error'
  if (normalized === 'proxy_error') return 'proxy_error'
  if (attemptedUrls.length) return 'old_url_expired'
  return 'error'
}

export function recoveryResponse(
  input: RecoveryLike,
  options: {
    ok: boolean
    action: MediaRecoveryAction
    recoveryStatus?: string
    errorCode?: string | null
    errorMessage?: string | null
    attemptedUrls?: unknown
    failedUrls?: unknown
  },
): MediaRecoveryResponse {
  const resolvedUrl = stringValue(input.resolvedUrl) || stringValue(input.assetUrl) || stringValue(input.stableUrl)
  const proxyUrl = stringValue(input.proxyUrl) || stringValue(input.proxyFallbackUrl)
  const action = options.action
  const ok = options.ok && Boolean(resolvedUrl || proxyUrl || input.assetId)
  const rawFailureCode = options.errorCode
    || options.recoveryStatus
    || stringValue(input.errorCode)
    || stringValue(input.status)
    || stringValue(input.recoveryStatus)
  const fallbackCode = ok ? null : normalizeRecoveryFailureCode(rawFailureCode)
  const attemptedUrls = [
    ...attemptedUrlStrings(options.attemptedUrls),
    ...attemptedUrlStrings(input.attemptedUrls),
  ].filter((value, index, array) => value && array.indexOf(value) === index)
  const failedUrls = [
    ...failedUrlRecords(options.failedUrls),
    ...failedUrlRecords(input.failedUrls),
    ...failedUrlRecords(input.attemptedUrls),
  ].filter((value, index, array) => value.url && array.findIndex((item) => item.url === value.url && item.reason === value.reason) === index)
  const errorMessage = options.errorMessage
    ?? stringValue(input.errorMessage)
    ?? stringValue(input.message)
    ?? stringValue(input.error)
    ?? null
  const recoveryStatus = ok
    ? 'ready'
    : fallbackCode || 'generation_failed'

  return {
    ok,
    success: ok,
    action,
    assetId: stringValue(input.assetId) || null,
    resolvedUrl: resolvedUrl || null,
    proxyUrl: proxyUrl || null,
    signedUrlAvailable: typeof input.signedUrlAvailable === 'boolean'
      ? input.signedUrlAvailable
      : typeof input.signedUrlGenerated === 'boolean'
        ? input.signedUrlGenerated
        : null,
    proxyAvailable: typeof input.proxyAvailable === 'boolean'
      ? input.proxyAvailable
      : proxyUrl
        ? true
        : null,
    assetUrl: resolvedUrl || null,
    stableUrl: resolvedUrl || null,
    storageKey: stringValue(input.storageKey) || null,
    storageProvider: stringValue(input.storageProvider) || null,
    bucket: stringValue(input.bucket) || null,
    providerJobId: stringValue(input.providerJobId) || null,
    recoveryStatus,
    status: recoveryStatus,
    errorCode: ok ? null : fallbackCode,
    errorMessage,
    message: errorMessage,
    error: errorMessage,
    attemptedUrls,
    failedUrls,
    nextAction: nextActionFor(action),
    ...(input.mediaPersistence !== undefined ? { mediaPersistence: input.mediaPersistence } : {}),
    upstreamStatus: numberValue(input.upstreamStatus) ?? null,
    upstreamMessage: stringValue(input.upstreamMessage) || null,
    requestId: stringValue(input.requestId) || null,
    actionTaken: stringValue(input.actionTaken) || null,
  }
}
