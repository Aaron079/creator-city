import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { resolveAssetById } from '@/lib/assets/asset-resolver'
import { recoveryResponse, terminalRecoveryAction } from '@/lib/assets/recovery-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: { assetId: string }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const assetId = params.assetId?.trim()
    if (!assetId) {
      return jsonOk(recoveryResponse(
        { errorCode: 'no_recovery_source', message: 'assetId is required.' },
        { ok: false, action: 'no_recovery_source', recoveryStatus: 'no_recovery_source' },
      ), { status: 400 })
    }

    const recovered = await resolveAssetById(assetId, user.id)
    if (!recovered) {
      return jsonOk(recoveryResponse(
        { assetId, errorCode: 'no_recovery_source', message: '素材不存在。' },
        { ok: false, action: 'no_recovery_source', recoveryStatus: 'no_recovery_source' },
      ), { status: 404 })
    }

    const isReady = recovered.status === 'ready' && Boolean(recovered.resolvedUrl)
    return jsonOk(recoveryResponse(recovered, {
      ok: isReady,
      action: isReady ? 'asset_recovered' : terminalRecoveryAction(recovered.recoveryStatus || recovered.status),
      recoveryStatus: isReady ? 'ready' : recovered.recoveryStatus || recovered.status,
      errorCode: isReady ? null : recovered.recoveryStatus || recovered.status,
      errorMessage: recovered.error,
    }), { status: isReady ? 200 : 200 })
  } catch (error) {
    console.error('[assets/recover] failed', { assetId: params.assetId, error })
    return jsonOk(recoveryResponse(
      { errorCode: 'generation_failed', message: safeErrorMessage(error, '恢复素材失败。') },
      { ok: false, action: 'error', recoveryStatus: 'generation_failed' },
    ), { status: 500 })
  }
}
