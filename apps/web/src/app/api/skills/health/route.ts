import { NextResponse } from 'next/server'
import { runAllHealthChecks } from '@/lib/open-source-tools/health'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results = await runAllHealthChecks()
  const summary = {
    total: results.length,
    enabled: results.filter((r) => r.status === 'enabled').length,
    disabled: results.filter((r) => r.status === 'disabled').length,
    misconfigured: results.filter((r) => r.status === 'misconfigured').length,
    error: results.filter((r) => r.status === 'error').length,
  }
  return NextResponse.json({ success: true, health: results, summary, checkedAt: new Date().toISOString() })
}
