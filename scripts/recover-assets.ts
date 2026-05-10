import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { registerWebAlias } from './register-web-alias'

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

async function main() {
  loadServerEnv()
  registerWebAlias()
  const { db } = await import('../apps/web/src/lib/db')
  const { resolveAssetRecord } = await import('../apps/web/src/lib/assets/asset-resolver')
  const userId = process.env.CREATOR_CITY_USER_ID || process.env.USER_ID
  const assets = await db.asset.findMany({
    where: userId ? { ownerId: userId } : {},
    orderBy: { createdAt: 'asc' },
    take: 5000,
  })
  const summary = {
    totalAssets: assets.length,
    readyAssets: 0,
    needsRecoveryAssets: assets.filter((asset) => String(asset.status) === 'NEEDS_RECOVERY').length,
    readableAssets: 0,
    recoveredAssets: 0,
    uploadedToStorageAssets: 0,
    storageKeyWrittenAssets: 0,
    canvasNodeAssetIdBackfilled: 0,
    storageKeyAssets: 0,
    missingStorageKeyAssets: 0,
    unrecoverableAssets: 0,
    unrecoverableReasons: {} as Record<string, number>,
    recoveredAssetIds: [] as string[],
  }

  for (const asset of assets) {
    const hadStorageKey = Boolean(asset.storageKey)
    const result = await resolveAssetRecord(asset)
    if (result.status === 'ready') summary.readyAssets += 1
    if (result.resolvedUrl) summary.readableAssets += 1
    if (result.actionTaken === 'reuploaded_from_original_url' || result.actionTaken === 'recovered_from_provider') {
      summary.recoveredAssets += 1
      summary.uploadedToStorageAssets += 1
      summary.recoveredAssetIds.push(result.assetId)
    }
    if (!hadStorageKey && result.storageKey) summary.storageKeyWrittenAssets += 1
    if (result.storageKey) summary.storageKeyAssets += 1
    else summary.missingStorageKeyAssets += 1
    if (result.status.startsWith('unrecoverable_')) {
      summary.unrecoverableAssets += 1
      const reason = result.recoveryStatus || result.status
      summary.unrecoverableReasons[reason] = (summary.unrecoverableReasons[reason] ?? 0) + 1
    }
  }

  console.log(JSON.stringify({
    script: 'recover-assets',
    ...summary,
  }, null, 2))
  await db.$disconnect()
}

main()
  .catch((error) => {
    console.error('[recover-assets] failed', error)
    process.exitCode = 1
  })
