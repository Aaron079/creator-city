import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'
import { safeErrorMessage } from '@/lib/api/json-response'
import { resolveAssetById, type AssetResolveResult } from '@/lib/assets/asset-resolver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ResolveBatchBody = {
  assetIds?: unknown
}

type ResolveBatchAsset = AssetResolveResult & {
  nextAction: string
}

function uniqueAssetIds(value: unknown) {
  const ids = Array.isArray(value) ? value : []
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())).map((id) => id.trim()))].slice(0, 100)
}

function nextActionForStatus(status?: string | null) {
  if (status === 'ready') return 'show_media'
  if (
    status === 'missing_env'
    || status === 'storage_permission_error'
    || status === 'object_missing'
    || status === 'signing_error'
    || status === 'proxy_error'
    || status === 'needs_signed_url'
    || status === 'proxy_required'
  ) return 'manual_debug'
  return 'regenerate_from_prompt'
}

function resultWithNextAction(result: AssetResolveResult): ResolveBatchAsset {
  return {
    ...result,
    nextAction: nextActionForStatus(result.errorCode ?? result.recoveryStatus ?? result.status),
  }
}

function failedAsset(assetId: string, errorCode: string, errorMessage: string): ResolveBatchAsset {
  const status = errorCode as AssetResolveResult['status']
  return {
    assetId,
    status,
    ok: false,
    resolvedUrl: null,
    proxyUrl: null,
    signedUrlAvailable: false,
    proxyAvailable: false,
    thumbnailUrl: null,
    storageKey: null,
    storageProvider: null,
    bucket: null,
    providerJobId: null,
    originalUrl: null,
    currentUrl: null,
    stableUrl: null,
    recoveryStatus: errorCode,
    errorCode,
    errorMessage,
    error: errorMessage,
    actionTaken: 'marked_missing',
    storageKeyFailureReason: null,
    signedUrlGenerated: false,
    signedUrlError: null,
    proxyFallbackUrl: null,
    proxyFallbackStatus: null,
    whyUnrecoverable: errorMessage,
    nextAction: nextActionForStatus(errorCode),
  }
}

function errorCodeForResolveError(error: unknown) {
  const message = safeErrorMessage(error, 'Asset resolve failed.')
  const haystack = message.toLowerCase()
  if (/not configured|missing env|credential|access_key|secret/.test(haystack)) return 'missing_env'
  if (/403|permission|forbidden|accessdenied|denied|unauthori/.test(haystack)) return 'storage_permission_error'
  if (/404|not found|no such key|missing/.test(haystack)) return 'object_missing'
  if (/sign|signed|signature/.test(haystack)) return 'signing_error'
  if (/proxy/.test(haystack)) return 'proxy_error'
  return 'provider_error'
}

function batchResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  try {
    let body: ResolveBatchBody
    try {
      body = await request.json() as ResolveBatchBody
    } catch {
      return batchResponse({
        ok: false,
        success: false,
        assets: [],
        batch: {
          ok: false,
          errorCode: 'invalid_json',
          errorMessage: 'Invalid JSON',
          nextAction: 'manual_debug',
        },
      })
    }

    const assetIds = uniqueAssetIds(body.assetIds)
    if (!assetIds.length) return batchResponse({ ok: true, success: true, assets: [] })

    const user = await getCurrentUser()
    if (!user) {
      return batchResponse({
        ok: false,
        success: false,
        assets: assetIds.map((assetId) => failedAsset(assetId, 'auth_required', '请先登录。')),
        batch: {
          ok: false,
          errorCode: 'auth_required',
          errorMessage: '请先登录。',
          nextAction: 'manual_debug',
        },
      }, 401)
    }

    const assets: ResolveBatchAsset[] = await Promise.all(
      assetIds.map(async (assetId) => {
        try {
          const resolved = await resolveAssetById(assetId, user.id)
          return resolved
            ? resultWithNextAction(resolved)
            : failedAsset(assetId, 'asset_not_found', 'Asset not found or not accessible for current user.')
        } catch (error) {
          const errorMessage = safeErrorMessage(error, 'Asset resolve failed.')
          const errorCode = errorCodeForResolveError(error)
          console.error('[assets/resolve-batch] asset failed', { assetId, errorCode, errorMessage })
          return failedAsset(assetId, errorCode, errorMessage)
        }
      }),
    )

    return batchResponse({ ok: true, success: true, assets })
  } catch (error) {
    console.error('[assets/resolve-batch] failed', error)
    return batchResponse({
      ok: false,
      success: false,
      assets: [],
      batch: {
        ok: false,
        errorCode: 'asset_resolve_batch_failed',
        errorMessage: safeErrorMessage(error, '批量解析素材失败。'),
        nextAction: 'manual_debug',
      },
    })
  }
}
