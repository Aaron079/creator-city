import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { registerWebAlias } from './register-web-alias'

type JsonRecord = Record<string, unknown>

const REQUIRED_DB_ENV = ['DATABASE_URL']

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

function missingEnv(keys: string[]) {
  return keys.filter((key) => !process.env[key]?.trim())
}

function recordValue(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function nodeAssetId(node: { assetId?: unknown; metadataJson?: unknown }) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(node.assetId)
    || stringValue(metadata.assetId)
    || stringValue(mediaPersistence.assetId)
}

function firstNodeUrl(node: {
  kind?: string | null
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  resultAudioUrl?: string | null
  resultPreview?: string | null
  metadataJson?: unknown
}) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  const candidates = node.kind === 'video'
    ? [
        node.resultVideoUrl,
        metadata.resultVideoUrl,
        metadata.videoUrl,
        metadata.assetUrl,
        metadata.resolvedUrl,
        metadata.originalProviderVideoUrl,
        metadata.originalProviderUrl,
        mediaPersistence.stableUrl,
      ]
    : [
        node.resultImageUrl,
        metadata.resultImageUrl,
        metadata.imageUrl,
        metadata.assetUrl,
        metadata.resolvedUrl,
        metadata.originalProviderImageUrl,
        metadata.originalProviderUrl,
        mediaPersistence.stableUrl,
      ]
  return candidates.map(stringValue).find(Boolean) || ''
}

function nodePrompt(node: { prompt?: string | null; metadataJson?: unknown }) {
  const metadata = recordValue(node.metadataJson)
  return stringValue(node.prompt)
    || stringValue(metadata.prompt)
    || stringValue(metadata.compiledPrompt)
    || stringValue(metadata.compiledPromptPreview)
}

function storageFields(asset: {
  storageKey?: string | null
  storageProvider?: string | null
  bucket?: string | null
  metadataJson?: unknown
  metadata?: unknown
}) {
  const metadata = recordValue(asset.metadataJson) || recordValue(asset.metadata)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return {
    storageKey: stringValue(asset.storageKey) || stringValue(metadata.storageKey) || stringValue(mediaPersistence.storageKey) || stringValue(mediaPersistence.key),
    storageProvider: stringValue(asset.storageProvider) || stringValue(metadata.storageProvider) || stringValue(mediaPersistence.storageProvider),
    bucket: stringValue(asset.bucket) || stringValue(metadata.bucket) || stringValue(metadata.storageBucket) || stringValue(mediaPersistence.bucket),
  }
}

function providerJobIdFor(value: {
  providerJobId?: string | null
  generationJobId?: string | null
  metadataJson?: unknown
  metadata?: unknown
}) {
  const metadata = recordValue(value.metadataJson) || recordValue(value.metadata)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(value.providerJobId)
    || stringValue(value.generationJobId)
    || stringValue(metadata.providerJobId)
    || stringValue(metadata.taskId)
    || stringValue(metadata.generationJobId)
    || stringValue(mediaPersistence.providerJobId)
}

async function main() {
  loadProjectEnv()

  const missingRequired = missingEnv(REQUIRED_DB_ENV)
  if (missingRequired.length) {
    console.log(JSON.stringify({
      script: 'trace-creator-city-data-flow',
      ok: false,
      missingEnv: missingRequired,
      message: '数据库环境变量不可用，无法审计真实 Asset/GenerationJob/Canvas 数据。',
      localStoragePersistence: {
        participates: true,
        keys: [
          'creator-city:canvas-snapshot:<projectId>',
          'creator-city:canvas-cache:<projectId>',
          'creator-city:draft:<projectId>',
          'creator-city:last-project-id',
          'creator-city:last-workflow-id',
        ],
        role: 'local fallback/cache; should not be the only durable persistence layer',
      },
    }, null, 2))
    return
  }

  registerWebAlias()
  const { db } = await import('../apps/web/src/lib/db')
  const { checkObjectExists } = await import('../apps/web/src/lib/assets/storage-adapter')

  const [
    assetCount,
    generationJobCount,
    projectCount,
    canvasWorkflowCount,
    canvasNodeCount,
    canvasEdgeCount,
    assets,
    generationJobs,
    canvasNodes,
  ] = await Promise.all([
    db.asset.count(),
    db.generationJob.count(),
    db.project.count(),
    db.canvasWorkflow.count(),
    db.canvasNode.count(),
    db.canvasEdge.count(),
    db.asset.findMany({ orderBy: { createdAt: 'desc' }, take: 5000 }),
    db.generationJob.findMany({ orderBy: { createdAt: 'desc' }, take: 5000 }),
    db.canvasNode.findMany({ where: { kind: { in: ['image', 'video'] } }, orderBy: { createdAt: 'desc' }, take: 5000 }),
  ])

  const assetIds = new Set(assets.map((asset) => asset.id))
  const assetsWithStorageKey = assets.filter((asset) => storageFields(asset).storageKey)
  let storageKeyUnreadable = 0
  const storageCheckErrors: Array<{ assetId: string; message?: string | null }> = []

  for (const asset of assetsWithStorageKey) {
    const exists = await checkObjectExists(asset)
    if (!exists.exists) {
      storageKeyUnreadable += 1
      if (storageCheckErrors.length < 20) {
        storageCheckErrors.push({ assetId: asset.id, message: exists.message ?? null })
      }
    }
  }

  const canvasNodesWithAssetId = canvasNodes.filter((node) => nodeAssetId(node))
  const canvasNodesWithoutAssetIdButUrl = canvasNodes.filter((node) => !nodeAssetId(node) && firstNodeUrl(node))
  const canvasNodesPromptWithoutAsset = canvasNodes.filter((node) => nodePrompt(node) && !nodeAssetId(node))
  const generationJobsWithOutputAsset = generationJobs.filter((job) => stringValue(job.outputAssetId))
  const generationJobsWithoutAsset = generationJobs.filter((job) => {
    const outputAssetId = stringValue(job.outputAssetId)
    if (outputAssetId) return !assetIds.has(outputAssetId)
    const providerJobId = providerJobIdFor(job)
    return Boolean(providerJobId) && !assets.some((asset) => providerJobIdFor(asset) === providerJobId)
  })
  const assetsMissingStorageKey = assets.filter((asset) => !storageFields(asset).storageKey)
  const assetsOriginalUrlNoStorageKey = assets.filter((asset) => stringValue(asset.originalUrl) && !storageFields(asset).storageKey)
  const providerJobIdsWithAsset = new Set(assets.map(providerJobIdFor).filter(Boolean))
  const providerJobIdNoAsset = generationJobs.filter((job) => {
    const providerJobId = providerJobIdFor(job)
    return Boolean(providerJobId) && !providerJobIdsWithAsset.has(providerJobId)
  })

  const likelyBreaks = [
    generationJobsWithoutAsset.length ? 'GenerationJob exists without linked Asset/outputAssetId.' : '',
    assetsMissingStorageKey.length ? 'Asset rows exist without durable storageKey.' : '',
    storageKeyUnreadable ? 'Asset rows have storageKey but object storage is unreadable.' : '',
    canvasNodesWithoutAssetIdButUrl.length ? 'Canvas media nodes have URL but no assetId.' : '',
    canvasNodesPromptWithoutAsset.length ? 'Canvas generated/prompted media nodes have no Asset linkage.' : '',
  ].filter(Boolean)

  console.log(JSON.stringify({
    script: 'trace-creator-city-data-flow',
    ok: true,
    counts: {
      assets: assetCount,
      generationJobs: generationJobCount,
      projects: projectCount,
      canvasWorkflows: canvasWorkflowCount,
      canvasNodes: canvasNodeCount,
      canvasEdges: canvasEdgeCount,
    },
    canvasMediaNodes: {
      totalScanned: canvasNodes.length,
      withAssetId: canvasNodesWithAssetId.length,
      withoutAssetIdButWithUrl: canvasNodesWithoutAssetIdButUrl.length,
      withPromptButWithoutAsset: canvasNodesPromptWithoutAsset.length,
    },
    generationJobs: {
      sampled: generationJobs.length,
      withOutputAssetId: generationJobsWithOutputAsset.length,
      withGenerationJobButNoAsset: generationJobsWithoutAsset.length,
      withProviderJobIdButNoAsset: providerJobIdNoAsset.length,
    },
    assets: {
      sampled: assets.length,
      withoutStorageKey: assetsMissingStorageKey.length,
      withStorageKeyButObjectUnreadable: storageKeyUnreadable,
      withOriginalUrlButNoStorageKey: assetsOriginalUrlNoStorageKey.length,
    },
    localStoragePersistence: {
      participates: true,
      keys: [
        'creator-city:canvas-snapshot:<projectId>',
        'creator-city:canvas-cache:<projectId>',
        'creator-city:draft:<projectId>',
        'creator-city:last-project-id',
        'creator-city:last-workflow-id',
      ],
      role: 'fallback/cache; DB CanvasWorkflow/CanvasNode/CanvasEdge is the stable persistence path',
    },
    storageCheckErrors,
    mostLikelyBrokenLink: likelyBreaks[0] ?? 'No obvious sampled break found; inspect provider/runtime logs.',
    likelyBrokenLinks: likelyBreaks,
  }, null, 2))

  await db.$disconnect()
}

main().catch((error) => {
  console.error('[trace-creator-city-data-flow] failed', error)
  process.exitCode = 1
})
