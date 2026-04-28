import { NextResponse } from 'next/server'
import { getAdapter } from '@/lib/providers/registry'
import { PROVIDER_ERROR_CODES } from '@/lib/providers/errors'

export const dynamic = 'force-dynamic'

// Job ID format: "{providerId}:{externalId}" — provider is derived from the prefix.
function parseJobId(jobId: string): { adapterId: string; rawId: string } | null {
  const colon = jobId.indexOf(':')
  if (colon === -1) return null
  return { adapterId: jobId.slice(0, colon), rawId: jobId }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params

  if (!jobId) {
    return NextResponse.json(
      { success: false, message: 'Missing job ID.', errorCode: PROVIDER_ERROR_CODES.INVALID_INPUT },
      { status: 400 },
    )
  }

  const parsed = parseJobId(decodeURIComponent(jobId))
  if (!parsed) {
    return NextResponse.json(
      { success: false, message: `Invalid job ID format: "${jobId}". Expected "{provider}:{id}".`, errorCode: PROVIDER_ERROR_CODES.INVALID_INPUT },
      { status: 400 },
    )
  }

  const adapter = getAdapter(parsed.adapterId)
  if (!adapter) {
    return NextResponse.json(
      { success: false, message: `No adapter for provider "${parsed.adapterId}".`, errorCode: PROVIDER_ERROR_CODES.PROVIDER_NOT_FOUND },
      { status: 404 },
    )
  }

  if (!adapter.getJob) {
    return NextResponse.json(
      { success: false, message: `Adapter "${parsed.adapterId}" does not support job polling.`, errorCode: PROVIDER_ERROR_CODES.ADAPTER_NOT_IMPLEMENTED },
      { status: 501 },
    )
  }

  try {
    const result = await adapter.getJob(parsed.rawId)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Job lookup failed'
    console.error(`[generate/jobs/${jobId}]`, error)
    return NextResponse.json(
      { success: false, message, errorCode: PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED },
      { status: 500 },
    )
  }
}
