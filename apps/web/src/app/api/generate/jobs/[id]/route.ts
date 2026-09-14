import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdapter } from '@/lib/providers/registry'
import { PROVIDER_ERROR_CODES } from '@/lib/providers/errors'
import { settleCredits, refundCredits } from '@/lib/credits/billing-client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

// Job ID format: "{providerId}:{externalId}" — provider is derived from the prefix.
function parseJobId(jobId: string): { adapterId: string; externalId: string } | null {
  const colon = jobId.indexOf(':')
  if (colon <= 0 || colon === jobId.length - 1 || /[\s/\\?#%]/.test(jobId) || [...jobId].some(char => char.charCodeAt(0) < 32)) return null
  return { adapterId: jobId.slice(0, colon), externalId: jobId.slice(colon + 1) }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const billingJobId = request.nextUrl.searchParams.get('billingJobId')

  let decodedId: string
  try { decodedId = decodeURIComponent(jobId) } catch { decodedId = '' }
  const parsed = parseJobId(decodedId)
  if (!parsed || (billingJobId !== null && !billingJobId.trim())) {
    return NextResponse.json(
      { success: false, message: 'Invalid job ID.', errorCode: PROVIDER_ERROR_CODES.INVALID_INPUT },
      { status: 400 },
    )
  }

  let generationJob
  const externalIds = [decodedId, parsed.externalId]
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, message: 'Authentication required.', errorCode: 'UNAUTHENTICATED' }, { status: 401 })
    if (user.status !== 'ACTIVE') return NextResponse.json({ success: false, message: 'Account is not active.', errorCode: 'FORBIDDEN' }, { status: 403 })

    const jobs = await db.generationJob.findMany({
      where: {
        userId: user.id,
        providerId: parsed.adapterId,
        ...(billingJobId !== null ? { id: billingJobId } : {}),
        OR: [{ externalJobId: { in: externalIds } }, { providerJobId: { in: externalIds } }],
      },
      take: 2,
    })
    if (jobs.length > 1) return NextResponse.json({ success: false, message: 'Ambiguous job association.', errorCode: 'GENERATION_JOB_AMBIGUOUS' }, { status: 409 })
    generationJob = jobs[0]
    if (!generationJob || [generationJob.externalJobId, generationJob.providerJobId].some(id => id !== null && !externalIds.includes(id))) {
      return NextResponse.json({ success: false, message: 'Generation job not found.', errorCode: 'GENERATION_JOB_NOT_FOUND' }, { status: 404 })
    }
  } catch (error) {
    console.error('[generate/jobs] ownership lookup failed', error)
    return NextResponse.json(
      { success: false, message: 'Job ownership is temporarily unavailable.', errorCode: 'GENERATION_JOB_LOOKUP_UNAVAILABLE' },
      { status: 503 },
    )
  }

  const adapter = getAdapter(generationJob.providerId)
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
    const storedId = generationJob.externalJobId ?? generationJob.providerJobId!
    const providerJobId = storedId === parsed.externalId ? `${generationJob.providerId}:${storedId}` : storedId
    const result = await adapter.getJob(providerJobId)
    if (result.providerId !== generationJob.providerId || (result.jobId !== undefined && !externalIds.includes(result.jobId))) {
      return NextResponse.json({ success: false, message: 'Provider returned a different job.', errorCode: 'PROVIDER_JOB_MISMATCH' }, { status: 502 })
    }

    const historicalBillingId = generationJob.walletId && generationJob.estimatedCost > 0 ? generationJob.id : undefined
    const succeeded = result.success && result.status === 'succeeded'
    // The gateway also labels unrecognized poll responses "failed", without a job ID.
    const failed = !result.success && result.status === 'failed' && (result.jobId !== undefined || generationJob.status === 'FAILED')
    let jobTrackingWarning: { code: string; message: string } | undefined
    if (generationJob.walletId === null && generationJob.estimatedCost === 0 && result.mode === 'real' && (succeeded || failed)) {
      try {
        await db.generationJob.updateMany({
          where: {
            id: generationJob.id,
            userId: generationJob.userId,
            providerId: generationJob.providerId,
            externalJobId: generationJob.externalJobId,
            providerJobId: generationJob.providerJobId,
            walletId: null,
            estimatedCost: 0,
            status: { in: ['QUEUED', 'PROCESSING'] },
          },
          data: {
            status: succeeded ? 'SUCCEEDED' : 'FAILED',
            output: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        })
      } catch (error) {
        console.error('[generate/jobs] terminal persistence failed', error)
        jobTrackingWarning = {
          code: 'GENERATION_JOB_TRACKING_FAILED',
          message: '已获取模型服务结果，但任务记录更新失败。请勿重新提交生成请求；任务历史可能尚未更新。',
        }
      }
    }
    if (historicalBillingId && generationJob.billingStatus === 'FROZEN' && result.mode === 'real') {
      if (succeeded) {
        await settleCredits(historicalBillingId)
      } else if (failed) {
        await refundCredits(historicalBillingId, result.message)
      }
    }

    return NextResponse.json({ ...result, jobId: providerJobId, generationJobId: generationJob.id, billingJobId: historicalBillingId, jobTrackingWarning })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Job lookup failed'
    console.error(`[generate/jobs/${jobId}]`, error)

    return NextResponse.json(
      { success: false, message, errorCode: PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED },
      { status: 500 },
    )
  }
}
