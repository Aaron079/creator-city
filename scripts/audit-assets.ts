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
  const { auditAsset, auditAssetsForUser, summarizeAssetAudit } = await import('../apps/web/src/lib/assets/asset-recovery')
  const userId = process.env.CREATOR_CITY_USER_ID || process.env.USER_ID
  const assets = await db.asset.findMany({
    where: userId ? { ownerId: userId } : {},
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })
  const rows = userId
    ? (await auditAssetsForUser(userId)).rows
    : await Promise.all(assets.map((asset) => auditAsset(asset)))
  const summary = summarizeAssetAudit(rows)
  const storageKeyCount = rows.filter((row) => row.storageKey).length
  const missingStorageKey = rows.filter((row) => !row.storageKey).length
  const unrecoverableReasons = rows.reduce<Record<string, number>>((acc, row) => {
    if (!row.unrecoverableReason && row.failureReason) return acc
    const reason = row.unrecoverableReason || row.failureReason || 'unknown'
    if (!row.reachable) acc[reason] = (acc[reason] ?? 0) + 1
    return acc
  }, {})

  console.log(JSON.stringify({
    script: 'audit-assets',
    totalAssets: rows.length,
    readyAssets: rows.filter((row) => row.status === 'READY').length,
    failedAssets: rows.filter((row) => row.status === 'FAILED').length,
    missingAssets: rows.filter((row) => row.status === 'MISSING').length,
    needsRecoveryAssets: rows.filter((row) => row.status === 'NEEDS_RECOVERY').length,
    unrecoverableAssets: rows.filter((row) => row.status === 'UNRECOVERABLE' || row.unrecoverableReason).length,
    readableAssets: summary.reachable,
    recoveredAssets: rows.filter((row) => row.status === 'READY' && row.storageKey).length,
    storageKeyAssets: storageKeyCount,
    missingStorageKeyAssets: missingStorageKey,
    providerJobIdAssets: rows.filter((row) => row.providerJobId).length,
    urlReachableAssets: rows.filter((row) => row.reachable).length,
    url403or404Assets: rows.filter((row) => row.httpStatus === 403 || row.httpStatus === 404).length,
    likelyExpiredSignedUrlAssets: rows.filter((row) => row.isExpiredSignedUrl).length,
    likelyBlobUrlAssets: rows.filter((row) => row.isBlobUrl).length,
    likelyProviderTemporaryUrlAssets: rows.filter((row) => row.isProviderTemporaryUrl).length,
    unrecoverableReasons,
    summary,
  }, null, 2))
  await db.$disconnect()
}

main()
  .catch((error) => {
    console.error('[audit-assets] failed', error)
    process.exitCode = 1
  })
