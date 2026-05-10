import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { registerWebAlias } from './register-web-alias'

type CanvasNodeRow = any

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function mediaPersistenceRecord(metadata: Record<string, unknown>) {
  return recordValue(metadata.mediaPersistence)
}

function nodeAssetId(node: CanvasNodeRow) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  return stringValue(metadata.assetId) || stringValue(mediaPersistence.assetId)
}

function firstMediaUrl(node: CanvasNodeRow) {
  const metadata = recordValue(node.metadataJson)
  const pluginResult = recordValue(metadata.pluginResult)
  const pluginData = recordValue(pluginResult.data)
  const pluginOutput = recordValue(pluginResult.output)
  const urls = node.kind === 'video'
    ? [
        node.resultVideoUrl,
        metadata.resultVideoUrl,
        metadata.assetUrl,
        metadata.videoUrl,
        metadata.originalProviderVideoUrl,
        metadata.originalProviderUrl,
        pluginResult.videoUrl,
        pluginResult.resultVideoUrl,
        pluginResult.assetUrl,
        pluginData.videoUrl,
        pluginData.resultVideoUrl,
        pluginData.assetUrl,
        pluginOutput.videoUrl,
        pluginOutput.resultVideoUrl,
        pluginOutput.assetUrl,
      ]
    : [
        node.resultImageUrl,
        metadata.resultImageUrl,
        metadata.assetUrl,
        metadata.imageUrl,
        metadata.originalProviderImageUrl,
        metadata.originalProviderUrl,
        pluginResult.imageUrl,
        pluginResult.resultImageUrl,
        pluginResult.assetUrl,
        pluginData.imageUrl,
        pluginData.resultImageUrl,
        pluginData.assetUrl,
        pluginOutput.imageUrl,
        pluginOutput.resultImageUrl,
        pluginOutput.assetUrl,
      ]
  return urls.map(stringValue).find(Boolean) || ''
}

function classifyUnrecoverable(url: string) {
  const lower = url.toLowerCase()
  if (!url) return 'unrecoverable_no_record'
  if (lower.startsWith('blob:')) return 'unrecoverable_blob_url'
  if (/x-tos-signature|x-tos-expires|x-amz-signature|x-amz-expires|x-oss-signature|x-oss-expires|signature=|expires=|security-token=/i.test(url)) {
    return 'unrecoverable_expired_signed_url_without_storage_key'
  }
  if (!/^https?:\/\//i.test(url)) return 'unrecoverable_no_record'
  return 'unrecoverable_provider_expired'
}

function loadServerEnv() {
  const envPath = existsSync(join(process.cwd(), 'apps/server/.env'))
    ? join(process.cwd(), 'apps/server/.env')
    : join(__dirname, '../apps/server/.env')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

async function findMatchingAsset(db: any, node: CanvasNodeRow, url: string) {
  return db.asset.findFirst({
    where: {
      OR: [
        { workflowId: node.workflowId, nodeId: node.nodeId },
        ...(url ? [
          { url },
          { originalUrl: url },
          { dataUrl: url },
          { thumbnailUrl: url },
        ] : []),
      ],
    },
    orderBy: { updatedAt: 'desc' },
  })
}

async function patchNode(db: any, node: CanvasNodeRow, patch: Record<string, unknown>, resultUrl?: string | null) {
  const metadata = recordValue(node.metadataJson)
  const nextMetadata = {
    ...metadata,
    ...patch,
  }
  await db.canvasNode.update({
    where: { id: node.id },
    data: {
      metadataJson: nextMetadata,
      ...(node.kind === 'image' && resultUrl ? { resultImageUrl: resultUrl } : {}),
      ...(node.kind === 'video' && resultUrl ? { resultVideoUrl: resultUrl } : {}),
    },
  })
}

async function main() {
  loadServerEnv()
  registerWebAlias()
  const { db } = await import('../apps/web/src/lib/db')
  const { resolveAssetRecord } = await import('../apps/web/src/lib/assets/asset-resolver')
  const { persistGeneratedMedia } = await import('../apps/web/src/lib/assets/persist-generated-media')
  const apply = process.argv.includes('--apply')
  const nodes = await db.canvasNode.findMany({
    where: { kind: { in: ['image', 'video'] } },
    include: { workflow: { select: { id: true, projectId: true, project: { select: { ownerId: true } } } } },
    orderBy: { createdAt: 'asc' },
  })
  const report = {
    scannedNodes: nodes.length,
    mediaNodes: 0,
    alreadyHadAssetId: 0,
    boundExistingAssets: 0,
    recoveredFromOldUrl: 0,
    wouldRecoverFromOldUrl: 0,
    unrecoverable: 0,
    unrecoverableReasons: {} as Record<string, number>,
  }

  for (const node of nodes) {
    report.mediaNodes += 1
    if (nodeAssetId(node)) {
      report.alreadyHadAssetId += 1
      continue
    }

    const url = firstMediaUrl(node)
    const existing = await findMatchingAsset(db, node, url)
    if (existing) {
      if (!apply) {
        report.boundExistingAssets += 1
        continue
      }
      const resolved = await resolveAssetRecord(existing)
      await patchNode(db, node, {
        assetId: existing.id,
        assetResolveStatus: resolved.status,
        recoveryStatus: resolved.recoveryStatus ?? resolved.status,
        ...(resolved.error ? { error: resolved.error } : {}),
        mediaPersistence: {
          ...mediaPersistenceRecord(recordValue(node.metadataJson)),
          status: resolved.status === 'ready' ? 'persisted' : resolved.status,
          assetId: existing.id,
          storageKey: resolved.storageKey,
          storageProvider: resolved.storageProvider,
          bucket: resolved.bucket,
          providerJobId: resolved.providerJobId,
          backfilledAt: new Date().toISOString(),
        },
      }, resolved.resolvedUrl)
      report.boundExistingAssets += 1
      if (resolved.status.startsWith('unrecoverable_')) {
        report.unrecoverable += 1
        const reason = resolved.recoveryStatus || resolved.status
        report.unrecoverableReasons[reason] = (report.unrecoverableReasons[reason] ?? 0) + 1
      }
      continue
    }

    if (url && /^https?:\/\//i.test(url)) {
      if (!apply) {
        report.wouldRecoverFromOldUrl += 1
        continue
      }
      const persistence = await persistGeneratedMedia({
        url,
        type: node.kind === 'video' ? 'video' : 'image',
        projectId: node.workflow.projectId,
        workflowId: node.workflowId,
        nodeId: node.nodeId,
        filenameHint: `${node.title || node.nodeId}-${node.kind}.${node.kind === 'image' ? 'png' : 'mp4'}`,
        sourceProvider: 'legacy-canvas-backfill',
        userId: node.workflow.project.ownerId,
        metadata: {
          source: 'backfill-canvas-asset-ids',
          originalUrl: url,
        },
      })
      if (persistence.ok) {
        await patchNode(db, node, {
          assetId: persistence.assetId,
          assetResolveStatus: 'ready',
          recoveryStatus: 'recovered_from_old_url',
          assetUrl: persistence.stableUrl,
          mediaPersistence: {
            status: 'persisted',
            ...persistence,
            backfilledAt: new Date().toISOString(),
          },
        }, persistence.stableUrl)
        report.recoveredFromOldUrl += 1
        continue
      }
    }

    const reason = classifyUnrecoverable(url)
    if (apply) {
      await patchNode(db, node, {
        assetResolveStatus: reason,
        recoveryStatus: reason,
        error: reason === 'unrecoverable_blob_url'
          ? '该资产当时只保存为浏览器临时 blob URL，刷新后无法恢复。'
          : reason === 'unrecoverable_expired_signed_url_without_storage_key'
            ? '该资产只保存了过期临时签名链接，没有保存永久 storageKey。'
            : '当前画布节点没有 assetId，也没有可恢复的原始 URL。',
      })
    }
    report.unrecoverable += 1
    report.unrecoverableReasons[reason] = (report.unrecoverableReasons[reason] ?? 0) + 1
  }

  console.log(JSON.stringify({
    script: 'backfill-canvas-asset-ids',
    mode: apply ? 'apply' : 'dry-run',
    writes: apply,
    message: apply
      ? 'DB/storage writes were enabled with --apply.'
      : 'No DB/storage writes were performed. Re-run with --apply only after explicitly approving bulk backfill risk.',
    ...report,
  }, null, 2))
  await db.$disconnect()
}

main()
  .catch((error) => {
    console.error('[backfill-canvas-asset-ids] failed', error)
    process.exitCode = 1
  })
