import { db } from '@/lib/db'
import { runGenerate } from '@/lib/providers/generate'
import type { GenerateRequest, GenerateResponse } from '@/lib/providers/types'
import type { Prisma } from '@prisma/client'

// Call only after route authorization. Ownership does not depend on a credit reservation.
export async function runOwnedGeneration(request: GenerateRequest, userId: string): Promise<GenerateResponse & {
  generationJobId?: string
  jobTrackingWarning?: { code: string; message: string }
}> {
  let generationJobId: string | undefined
  let result: GenerateResponse | undefined
  try {
    const job = await db.generationJob.create({
      data: {
        userId,
        providerId: request.providerId,
        nodeType: request.nodeType,
        prompt: request.prompt,
        projectId: request.projectId || null,
        nodeId: request.nodeId || null,
        walletId: null,
        estimatedCost: 0,
        actualCost: 0,
        billingStatus: 'PENDING',
        status: 'QUEUED',
      },
    })
    generationJobId = job.id
    result = await runGenerate(request)
    const pending = result.status === 'queued' || result.status === 'running'
    const update: Prisma.GenerationJobUpdateArgs = {
      where: { id: job.id },
      data: {
        externalJobId: result.jobId ?? null,
        status: pending ? (result.status === 'running' ? 'PROCESSING' : 'QUEUED') : result.success ? 'SUCCEEDED' : 'FAILED',
        output: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
        ...(!pending ? { completedAt: new Date() } : {}),
      },
    }
    try {
      await db.generationJob.update(update)
    } catch (error) {
      if (!pending || !result.jobId) throw error
      // Retry only the association write, never the paid provider request.
      await db.generationJob.update(update)
    }
    return { ...result, billingJobId: undefined, generationJobId }
  } catch (error) {
    console.error('[generation] job tracking failed', error)
    if (result?.success && result.status === 'succeeded') {
      return {
        ...result,
        billingJobId: undefined,
        generationJobId,
        jobTrackingWarning: {
          code: 'GENERATION_JOB_TRACKING_FAILED',
          message: '内容已生成，但任务记录更新失败。请勿重新生成；本次结果可能无法从任务历史中恢复。',
        },
      }
    }
    return {
      success: false,
      providerId: request.providerId,
      mode: result?.mode ?? 'unavailable',
      status: 'failed',
      generationJobId,
      jobId: result?.jobId,
      errorCode: 'GENERATION_JOB_TRACKING_FAILED',
      message: generationJobId
        ? '请求已发送，但任务关联暂不可用。任务编号仅供排查，无法确认能否恢复查询。请勿重新提交，模型服务可能仍在处理原任务。'
        : '任务记录暂不可用，尚未向模型服务发送生成请求。',
    }
  }
}
