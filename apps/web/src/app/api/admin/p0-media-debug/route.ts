import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveAssetUrl } from '@/lib/assets/storage-adapter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function recordValue(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
}
function stringValue(v: unknown) {
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const expectedToken = process.env.P0_DEBUG_TOKEN ?? ''
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? '10'), 50)

  try {
    // Get recent image/video canvas nodes
    const nodes = await db.canvasNode.findMany({
      where: { kind: { in: ['image', 'video'] } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        nodeId: true,
        kind: true,
        status: true,
        resultImageUrl: true,
        resultVideoUrl: true,
        metadataJson: true,
        x: true,
        y: true,
        updatedAt: true,
      },
    })

    const result = await Promise.all(nodes.map(async (node) => {
      const metadata = recordValue(node.metadataJson)
      const mediaPersistence = recordValue(metadata.mediaPersistence)
      const assetId = stringValue(metadata.assetId) || stringValue(mediaPersistence.assetId) || ''
      const storageKey = stringValue(metadata.storageKey) || stringValue(mediaPersistence.storageKey) || ''
      const recoveryStatus = stringValue(metadata.recoveryStatus) || stringValue(metadata.assetResolveStatus) || ''
      const legacyUrl = stringValue(node.resultImageUrl ?? '') || stringValue(node.resultVideoUrl ?? '') || stringValue(metadata.assetUrl as unknown) || ''

      let assetRecord: {
        id: string
        storageKey: string | null
        storageProvider: string | null
        bucket: string | null
        status: string
        recoveryStatus: string | null
        resolvedUrl?: string
        resolvedUrlError?: string
      } | null = null

      if (assetId) {
        try {
          const asset = await db.asset.findFirst({
            where: { id: assetId },
            select: {
              id: true,
              storageKey: true,
              storageProvider: true,
              bucket: true,
              status: true,
              recoveryStatus: true,
              url: true,
            },
          })
          if (asset) {
            let resolvedUrl = ''
            let resolvedUrlError = ''
            try {
              const resolved = await resolveAssetUrl(asset)
              resolvedUrl = resolved.url || ''
            } catch (e) {
              resolvedUrlError = e instanceof Error ? e.message : 'resolve error'
            }
            assetRecord = {
              id: asset.id,
              storageKey: asset.storageKey,
              storageProvider: asset.storageProvider,
              bucket: asset.bucket,
              status: asset.status,
              recoveryStatus: asset.recoveryStatus,
              resolvedUrl,
              resolvedUrlError: resolvedUrlError || undefined,
            }
          }
        } catch {
          // ignore
        }
      }

      // If no assetId, try to find by nodeId
      let assetByNodeId: { id: string; status: string } | null = null
      if (!assetId) {
        try {
          const byNode = await db.asset.findFirst({
            where: { nodeId: node.nodeId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true },
          })
          assetByNodeId = byNode
        } catch {
          // ignore
        }
      }

      return {
        nodeId: node.nodeId,
        kind: node.kind,
        status: node.status,
        position: { x: node.x, y: node.y },
        updatedAt: node.updatedAt,
        assetId: assetId || null,
        storageKeyInMetadata: storageKey || null,
        recoveryStatus: recoveryStatus || null,
        legacyUrl: legacyUrl ? legacyUrl.slice(0, 120) + (legacyUrl.length > 120 ? '...' : '') : null,
        asset: assetRecord,
        assetByNodeId: assetByNodeId ? { id: assetByNodeId.id, status: assetByNodeId.status } : null,
        diagnosis: !assetId
          ? (assetByNodeId ? 'HAS_ASSET_BY_NODE_ID_BUT_MISSING_ASSETID' : (legacyUrl ? 'NO_ASSETID_HAS_LEGACY_URL' : 'NO_ASSETID_NO_URL'))
          : !assetRecord
            ? 'ASSETID_NOT_IN_DB'
            : !assetRecord.storageKey
              ? 'ASSET_HAS_NO_STORAGE_KEY'
              : assetRecord.resolvedUrl
                ? 'RESOLVED_OK'
                : 'STORAGE_KEY_BUT_NO_RESOLVED_URL',
      }
    }))

    return NextResponse.json({
      ok: true,
      count: result.length,
      nodes: result,
      ossConfigured: Boolean(process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_OSS_BUCKET),
      publicBaseUrl: process.env.ALIYUN_OSS_PUBLIC_BASE_URL ? 'SET' : 'NOT_SET',
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'unknown error' }, { status: 500 })
  }
}
