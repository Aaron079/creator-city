import { NextResponse } from 'next/server'
import { resolveAllProviderStatuses, buildStatusSummary } from '@/lib/providers/status'
import { getGatewayProvider } from '@/lib/providers/catalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const statuses = resolveAllProviderStatuses()
    const summary = buildStatusSummary(statuses)

    return NextResponse.json({
      providers: statuses.map((s) => {
        const gatewayEntry = getGatewayProvider(s.id)
        return {
          id: s.id,
          displayName: s.displayName,
          category: s.category,
          status: s.status,
          configured: s.configured,
          missingEnvKeys: s.missingEnvKeys,
          canTest: s.canTest,
          setupHint: s.setupHint,
          hasAdapter: gatewayEntry !== null,
        }
      }),
      summary,
    })
  } catch (error) {
    console.error('[providers/status] unhandled error', error)
    return NextResponse.json(
      { error: 'Failed to resolve provider statuses.', errorCode: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
