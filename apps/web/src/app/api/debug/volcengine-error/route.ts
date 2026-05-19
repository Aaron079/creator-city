import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

// Public endpoint — shows error codes and messages from recent GenerationJobs
// Queries ALL statuses (not just FAILED) so stuck PROCESSING jobs are visible too.
export async function GET() {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000) // last 48h

  const jobs = await db.generationJob.findMany({
    where: {
      providerId: 'volcengine-seedream-image',
      updatedAt: { gte: since },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: { id: true, status: true, output: true, error: true, errorMessage: true, createdAt: true, updatedAt: true, completedAt: true },
  })

  const rows = jobs.map((job) => {
    const out = job.output && typeof job.output === 'object' && !Array.isArray(job.output)
      ? job.output as Record<string, unknown>
      : {}
    return {
      jobId: job.id.slice(0, 8),
      status: job.status,
      errorCode: out.errorCode ?? null,
      upstreamStatus: out.upstreamStatus ?? null,
      upstreamMessage: out.upstreamMessage ?? null,
      errorMessage: job.errorMessage ?? null,
      providerResponse: out.providerResponse ?? null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      durationMs: job.completedAt ? new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime() : null,
    }
  })

  return NextResponse.json({ ok: true, count: rows.length, since, jobs: rows })
}
