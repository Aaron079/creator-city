#!/usr/bin/env tsx
/**
 * test-real-canvas-node-debug.ts
 * Calls the production debug API to get real canvas node state.
 * Requires P0_DEBUG_TOKEN env var to be set in both Vercel and locally.
 * Usage: P0_DEBUG_TOKEN=xxx pnpm dlx tsx scripts/test-real-canvas-node-debug.ts
 */

const BASE_URL = process.env.DEBUG_BASE_URL || 'https://creator-city-vert.vercel.app'
const TOKEN = process.env.P0_DEBUG_TOKEN || ''

async function main() {
  console.log('\n=== Real Canvas Node Debug ===\n')
  console.log(`Target: ${BASE_URL}`)

  if (!TOKEN) {
    console.log('[SKIP] P0_DEBUG_TOKEN not set. Set it as env var to run against production.')
    console.log('  export P0_DEBUG_TOKEN=<your-token>')
    console.log('  Also set it as Vercel env var: P0_DEBUG_TOKEN=<same-token>')
    process.exit(0)
  }

  try {
    const url = `${BASE_URL}/api/admin/p0-media-debug?token=${encodeURIComponent(TOKEN)}&limit=10`
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) {
      console.log(`[FAIL] HTTP ${response.status}: ${await response.text().catch(() => '')}`)
      process.exit(1)
    }
    const data = await response.json() as {
      ok: boolean
      count: number
      nodes: Array<{
        nodeId: string
        kind: string
        status: string
        position: { x: number; y: number }
        assetId: string | null
        storageKeyInMetadata: string | null
        recoveryStatus: string | null
        legacyUrl: string | null
        asset: {
          id: string
          storageKey: string | null
          storageProvider: string | null
          status: string
          resolvedUrl?: string
          resolvedUrlError?: string
        } | null
        assetByNodeId: { id: string; status: string } | null
        diagnosis: string
      }>
      ossConfigured: boolean
      publicBaseUrl: string
    }

    console.log(`\nOSS configured: ${data.ossConfigured ? '✓ YES' : '✗ NO'}`)
    console.log(`Public base URL: ${data.publicBaseUrl}`)
    console.log(`\n--- ${data.count} recent image/video nodes ---\n`)

    const diagSummary: Record<string, number> = {}
    for (const node of data.nodes) {
      diagSummary[node.diagnosis] = (diagSummary[node.diagnosis] || 0) + 1
      const icon = node.diagnosis === 'RESOLVED_OK' ? '✓' : '✗'
      console.log(`${icon} [${node.kind}] nodeId=${node.nodeId.slice(0, 12)}`)
      console.log(`    assetId: ${node.assetId || '(none)'}`)
      console.log(`    storageKey: ${node.storageKeyInMetadata || '(none)'}`)
      console.log(`    recoveryStatus: ${node.recoveryStatus || '(none)'}`)
      console.log(`    diagnosis: ${node.diagnosis}`)
      if (node.asset) {
        console.log(`    asset.storageKey: ${node.asset.storageKey || '(none)'}`)
        console.log(`    asset.status: ${node.asset.status}`)
        console.log(`    asset.resolvedUrl: ${node.asset.resolvedUrl ? node.asset.resolvedUrl.slice(0, 80) + '...' : '(none)'}`)
        if (node.asset.resolvedUrlError) {
          console.log(`    asset.resolvedUrlError: ${node.asset.resolvedUrlError}`)
        }
      }
      if (node.assetByNodeId && !node.assetId) {
        console.log(`    assetByNodeId: ${node.assetByNodeId.id} (${node.assetByNodeId.status})`)
      }
      if (node.legacyUrl) {
        console.log(`    legacyUrl: ${node.legacyUrl}`)
      }
      console.log('')
    }

    console.log('--- Diagnosis Summary ---')
    for (const [diag, count] of Object.entries(diagSummary)) {
      console.log(`  ${diag}: ${count}`)
    }
    console.log('')
  } catch (e) {
    console.log('[ERROR]', e instanceof Error ? e.message : e)
    process.exit(1)
  }
}

main()
