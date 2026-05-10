#!/usr/bin/env tsx
/**
 * test-real-canvas-node-debug.ts
 * Calls the production debug API to get real canvas node state.
 * Requires P0_DEBUG_TOKEN env var to be set in both Vercel and locally.
 * Usage: P0_DEBUG_TOKEN=xxx pnpm dlx tsx scripts/test-real-canvas-node-debug.ts
 */

function argValue(name: string) {
  const index = process.argv.indexOf(name)
  if (index >= 0) return process.argv[index + 1]
  const prefix = `${name}=`
  const item = process.argv.find((arg) => arg.startsWith(prefix))
  return item ? item.slice(prefix.length) : undefined
}

const BASE_URL = argValue('--base-url') || process.env.DEBUG_BASE_URL || 'https://creator-city-vert.vercel.app'
const TOKEN = process.env.P0_DEBUG_TOKEN || ''

async function main() {
  console.log('\n=== Real Canvas Node Debug ===\n')
  console.log(`Target: ${BASE_URL}`)

  if (!TOKEN) {
    console.log('[FAIL] P0_DEBUG_TOKEN not set.')
    console.log('  This script cannot verify real production canvas nodes without the protected debug token.')
    console.log('  Required local run:')
    console.log(`  cd /Users/aaron/creator-city && P0_DEBUG_TOKEN=<token configured in Vercel Production> pnpm dlx tsx scripts/test-real-canvas-node-debug.ts --base-url ${BASE_URL}`)
    console.log('  Required Vercel Production env: P0_DEBUG_TOKEN=<same-token>')
    process.exit(1)
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
        storageKeyExists: boolean
        recoveryStatus: string | null
        resolveBatchStatus: string
        resolvedUrlExists: boolean
        canvasNodeCardShouldUse: { source: string; url: { host: string; exists: boolean } | null } | null
        assetExists: boolean
        assetStatus: string | null
        assetRecoveryStatus: string | null
        objectExists?: { exists: boolean; status: number; message: string | null } | null
      }>
      ossConfigured: boolean
      env?: { ossConfigured: boolean; publicBaseUrlConfigured: boolean; p0DebugTokenConfigured: boolean }
      summary?: Record<string, number>
    }

    console.log(`\nOSS configured: ${(data.env?.ossConfigured ?? data.ossConfigured) ? '✓ YES' : '✗ NO'}`)
    console.log(`Public base URL configured: ${data.env?.publicBaseUrlConfigured ? '✓ YES' : '✗ NO'}`)
    console.log(`\n--- ${data.count} recent image/video nodes ---\n`)

    const diagSummary: Record<string, number> = {}
    for (const node of data.nodes) {
      diagSummary[node.resolveBatchStatus] = (diagSummary[node.resolveBatchStatus] || 0) + 1
      const icon = node.resolvedUrlExists ? '✓' : '✗'
      console.log(`${icon} [${node.kind}] nodeId=${node.nodeId.slice(0, 12)}`)
      console.log(`    assetId: ${node.assetId || '(none)'}`)
      console.log(`    storageKey exists: ${node.storageKeyExists ? 'yes' : 'no'}`)
      console.log(`    recoveryStatus: ${node.recoveryStatus || '(none)'}`)
      console.log(`    resolveBatchStatus: ${node.resolveBatchStatus}`)
      console.log(`    CanvasNodeCard src: ${node.canvasNodeCardShouldUse?.source || '(none)'}`)
      if (node.assetExists) {
        console.log(`    asset.status: ${node.assetStatus || '(none)'}`)
        console.log(`    asset.recoveryStatus: ${node.assetRecoveryStatus || '(none)'}`)
        if (node.objectExists) {
          console.log(`    object.exists: ${node.objectExists.exists ? 'yes' : 'no'} (HTTP ${node.objectExists.status})`)
          if (node.objectExists.message) console.log(`    object.message: ${node.objectExists.message}`)
        }
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
