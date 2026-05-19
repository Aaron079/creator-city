import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// Debug endpoint: read the last N failed image generation jobs and expose
// the exact Volcengine error (upstreamMessage, upstreamStatus) stored in output.
// Protected by CREATOR_EXECUTOR_SHARED_SECRET via ?secret= query param.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const querySecret = searchParams.get('secret') ?? ''
  const expectedSecret = process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim() ?? ''
  if (!expectedSecret || querySecret !== expectedSecret) {
    return NextResponse.json({ error: 'unauthorized — pass ?secret=<CREATOR_EXECUTOR_SHARED_SECRET>' }, { status: 401 })
  }

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10), 20)
  const providerId = searchParams.get('providerId') ?? 'volcengine-seedream-image'

  const jobs = await db.generationJob.findMany({
    where: { status: 'FAILED', providerId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      providerId: true,
      prompt: true,
      error: true,
      errorMessage: true,
      output: true,
      createdAt: true,
      completedAt: true,
      updatedAt: true,
    },
  })

  const annotated = jobs.map((job) => {
    const output = job.output && typeof job.output === 'object' && !Array.isArray(job.output)
      ? job.output as Record<string, unknown>
      : {}
    return {
      id: job.id,
      status: job.status,
      providerId: job.providerId,
      promptPreview: typeof job.prompt === 'string' ? job.prompt.slice(0, 80) : '',
      errorMessage: job.errorMessage,
      errorCode: output.errorCode,
      upstreamStatus: output.upstreamStatus,
      upstreamMessage: output.upstreamMessage,
      providerResponse: output.providerResponse,
      providerEndpoint: output.providerEndpoint,
      requestId: output.requestId,
      submittedInput: output.submittedInput,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      updatedAt: job.updatedAt,
    }
  })

  return NextResponse.json({
    ok: true,
    count: annotated.length,
    providerId,
    jobs: annotated,
    note: 'upstreamMessage contains the exact Volcengine error. upstreamStatus is the HTTP status Volcengine returned.',
  })
}
