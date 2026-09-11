const INTERNAL_SPATIAL_PREVIS_PROVIDER_FIELDS = new Set([
  'model',
  'provider',
  'providerId',
  'taskId',
  'providerOriginalUrl',
  'originalProviderVideoUrl',
  'temporaryUrl',
  'proxyUrl',
  'providerRegion',
  'sourceProviderRegion',
  'executionRegion',
  'storageRegion',
  'executorKind',
  'providerResponse',
  'providerEndpoint',
  'providerRequestMethod',
  'providerHttpStatus',
  'providerFetchError',
  'providerFetchCause',
  'upstreamMessage',
  'upstreamStatus',
  'requestId',
  'ossRequestId',
  'storageProvider',
  'storageKey',
  'mediaDownloadUrl',
  'sourceUrl',
  'mediaPersistence',
  'generationJob',
  'assetUrl',
  'stableUrl',
  'resolvedUrl',
  'resultVideoUrl',
])

export function sanitizeInternalSpatialPrevisNodeMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !INTERNAL_SPATIAL_PREVIS_PROVIDER_FIELDS.has(key)),
  ) as Record<string, unknown>
}

export function internalSpatialPrevisTestStatusPayload(input: {
  generationJobId: string
  status: string
  asset?: { id: string; url: string } | null
}) {
  if (input.status === 'SUCCEEDED') {
    if (!input.asset) {
      return {
        success: false,
        status: 'failed',
        generationJobId: input.generationJobId,
        errorCode: 'spatial_previs_test_asset_missing',
        message: '三维预演测试未能完成。',
      }
    }
    return {
      success: true,
      status: 'succeeded',
      generationJobId: input.generationJobId,
      assetId: input.asset.id,
      outputAssetId: input.asset.id,
      asset: { id: input.asset.id, type: 'VIDEO', url: input.asset.url },
      resultVideoUrl: input.asset.url,
      videoUrl: input.asset.url,
      stableUrl: input.asset.url,
      message: '三维预演测试已完成',
    }
  }
  if (input.status === 'FAILED') {
    return {
      success: false,
      status: 'failed',
      generationJobId: input.generationJobId,
      errorCode: 'spatial_previs_test_failed',
      message: '三维预演测试未能完成。',
    }
  }
  return {
    success: true,
    status: 'running',
    generationJobId: input.generationJobId,
    message: '三维预演测试生成中',
  }
}
