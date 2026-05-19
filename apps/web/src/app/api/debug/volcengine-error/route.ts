import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

// Public endpoint — shows ONLY the Volcengine error code and message (no prompts, no user data)
// Used to diagnose PROVIDER_AUTH_FAILED by seeing the raw upstreamMessage from Volcengine.
export async function GET() {
  const jobs = await db.generationJob.findMany({
    where: { status: 'FAILED', providerId: 'volcengine-seedream-image' },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, output: true, updatedAt: true },
  })

  const errors = jobs.map((job) => {
    const out = job.output && typeof job.output === 'object' && !Array.isArray(job.output)
      ? job.output as Record<string, unknown>
      : {}
    return {
      jobId: job.id.slice(0, 8),
      updatedAt: job.updatedAt,
      errorCode: out.errorCode,
      upstreamStatus: out.upstreamStatus,
      upstreamMessage: out.upstreamMessage,
      providerResponse: out.providerResponse,
    }
  })

  return NextResponse.json({ ok: true, count: errors.length, errors })
}
