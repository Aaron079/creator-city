import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { registerWebAlias } from './register-web-alias'

type JsonRecord = Record<string, unknown>

function loadEnvFile(relativePath: string) {
  const envPath = join(process.cwd(), relativePath)
  if (!existsSync(envPath)) return false
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
  return true
}

function loadProjectEnv() {
  loadEnvFile('.env')
  loadEnvFile('apps/server/.env')
  loadEnvFile('apps/web/.env.local')
}

function backupName(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
  return `creator-city-state-${stamp}.json`
}

function recordValue(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function nodeAssetId(node: { metadataJson?: unknown }) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(metadata.assetId) || stringValue(mediaPersistence.assetId)
}

function firstNodeUrl(node: {
  kind?: string | null
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  metadataJson?: unknown
}) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  const candidates = node.kind === 'video'
    ? [node.resultVideoUrl, metadata.resultVideoUrl, metadata.videoUrl, metadata.assetUrl, metadata.originalProviderVideoUrl, mediaPersistence.stableUrl]
    : [node.resultImageUrl, metadata.resultImageUrl, metadata.imageUrl, metadata.assetUrl, metadata.originalProviderImageUrl, mediaPersistence.stableUrl]
  return candidates.map(stringValue).find(Boolean) || ''
}

function unrecoverableReason(node: {
  kind?: string | null
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  metadataJson?: unknown
}) {
  const metadata = recordValue(node.metadataJson)
  const existing = stringValue(metadata.recoveryStatus) || stringValue(metadata.assetResolveStatus)
  if (existing.startsWith('unrecoverable_')) return existing
  const url = firstNodeUrl(node)
  if (!url) return 'unrecoverable_no_record'
  if (url.startsWith('blob:')) return 'unrecoverable_blob_url'
  if (/x-tos-signature|x-tos-expires|x-amz-signature|x-amz-expires|x-oss-signature|x-oss-expires|signature=|expires=|security-token=/i.test(url)) {
    return 'unrecoverable_expired_signed_url_without_storage_key'
  }
  if (!/^https?:\/\//i.test(url) && !url.startsWith('data:')) return 'unrecoverable_no_record'
  return ''
}

function readSourceExcerpt(relativePath: string, pattern: RegExp) {
  const fullPath = join(process.cwd(), relativePath)
  if (!existsSync(fullPath)) return null
  const lines = readFileSync(fullPath, 'utf8').split(/\r?\n/)
  const index = lines.findIndex((line) => pattern.test(line))
  if (index < 0) return null
  return {
    file: relativePath,
    line: index + 1,
    excerpt: lines.slice(Math.max(0, index - 3), index + 4),
  }
}

function writeBackup(payload: unknown) {
  const backupDir = join(process.cwd(), 'backups')
  mkdirSync(backupDir, { recursive: true })
  const outputPath = join(backupDir, backupName())
  writeFileSync(outputPath, JSON.stringify(payload, null, 2))
  return outputPath
}

async function main() {
  loadProjectEnv()

  const localStorageKeys = [
    {
      key: 'creator-city:canvas-snapshot:<projectId>',
      role: 'full local canvas fallback snapshot written by VisualCanvasWorkspace',
    },
    {
      key: 'creator-city:canvas-cache:<projectId>',
      role: 'cached server canvas for fast open',
    },
    {
      key: 'creator-city:draft:<projectId>',
      role: 'local draft fallback before/after server save',
    },
    {
      key: 'creator-city:last-project-id',
      role: 'route hint for /create without query string',
    },
    {
      key: 'creator-city:last-workflow-id',
      role: 'route/session hint for the last workflow',
    },
  ]

  if (!process.env.DATABASE_URL?.trim()) {
    const outputPath = writeBackup({
      exportedAt: new Date().toISOString(),
      ok: false,
      missingEnv: ['DATABASE_URL'],
      message: '数据库环境变量不可用，无法导出真实 Asset/GenerationJob/Project/Canvas 数据。',
      localStorageKeys,
      codeFallbacks: {
        defaultCanvas: readSourceExcerpt('apps/web/src/components/canvas/CanvasProvider.tsx', /DEFAULT_NODES/),
        visualCanvasKeys: readSourceExcerpt('apps/web/src/components/create/VisualCanvasWorkspace.tsx', /creator-city:canvas-cache/),
      },
    })
    console.log(JSON.stringify({ script: 'export-current-creator-city-state', ok: false, backup: outputPath, missingEnv: ['DATABASE_URL'] }, null, 2))
    return
  }

  registerWebAlias()
  const { db } = await import('../apps/web/src/lib/db')

  const [
    assets,
    generationJobs,
    projects,
    workflows,
    nodes,
    edges,
  ] = await Promise.all([
    db.asset.findMany({ orderBy: { createdAt: 'desc' }, take: 10000 }),
    db.generationJob.findMany({ orderBy: { createdAt: 'desc' }, take: 10000 }),
    db.project.findMany({ orderBy: { updatedAt: 'desc' }, take: 1000 }),
    db.canvasWorkflow.findMany({ orderBy: { updatedAt: 'desc' }, take: 2000 }),
    db.canvasNode.findMany({ orderBy: { updatedAt: 'desc' }, take: 20000 }),
    db.canvasEdge.findMany({ orderBy: { updatedAt: 'desc' }, take: 20000 }),
  ])

  const assetIds = new Set(assets.map((asset) => asset.id))
  const unresolvedCanvasMedia = nodes
    .filter((node) => node.kind === 'image' || node.kind === 'video')
    .map((node) => {
      const assetId = nodeAssetId(node)
      const reason = assetId && assetIds.has(assetId) ? '' : unrecoverableReason(node)
      return {
        dbNodeId: node.id,
        workflowId: node.workflowId,
        nodeId: node.nodeId,
        kind: node.kind,
        assetId: assetId || null,
        url: firstNodeUrl(node) || null,
        reason: reason || null,
      }
    })
    .filter((item) => item.reason || !item.assetId)

  const payload = {
    exportedAt: new Date().toISOString(),
    ok: true,
    limits: {
      assets: 10000,
      generationJobs: 10000,
      projects: 1000,
      canvasWorkflows: 2000,
      canvasNodes: 20000,
      canvasEdges: 20000,
    },
    localStorageKeys,
    assets,
    generationJobs,
    projects,
    canvas: {
      workflows,
      nodes,
      edges,
    },
    currentUnrecoverableAssets: assets
      .filter((asset) => String(asset.status) === 'UNRECOVERABLE' || stringValue(asset.recoveryStatus).startsWith('unrecoverable_'))
      .map((asset) => ({
        id: asset.id,
        type: asset.type,
        status: asset.status,
        recoveryStatus: asset.recoveryStatus,
        error: asset.error,
        storageKey: asset.storageKey,
        originalUrl: asset.originalUrl,
        providerJobId: asset.providerJobId,
      })),
    currentUnrecoverableCanvasNodes: unresolvedCanvasMedia,
    cannotRecoverReasons: {
      unrecoverable_blob_url: 'Only a browser blob URL was saved; it is gone after refresh.',
      unrecoverable_expired_signed_url_without_storage_key: 'Only an expired provider/object-store signed URL was saved; no durable storageKey exists.',
      unrecoverable_provider_expired: 'Provider URL cannot be downloaded and no retrievable provider job result is available.',
      unrecoverable_provider_retrieve_not_implemented: 'Provider job id exists but the adapter cannot retrieve historical output.',
      unrecoverable_no_record: 'No assetId, storageKey, usable URL, dataUrl, or providerJobId was saved.',
    },
  }

  const outputPath = writeBackup(payload)
  console.log(JSON.stringify({
    script: 'export-current-creator-city-state',
    ok: true,
    backup: outputPath,
    counts: {
      assets: assets.length,
      generationJobs: generationJobs.length,
      projects: projects.length,
      canvasWorkflows: workflows.length,
      canvasNodes: nodes.length,
      canvasEdges: edges.length,
      currentUnrecoverableCanvasNodes: unresolvedCanvasMedia.length,
    },
  }, null, 2))

  await db.$disconnect()
}

main().catch((error) => {
  console.error('[export-current-creator-city-state] failed', error)
  process.exitCode = 1
})
