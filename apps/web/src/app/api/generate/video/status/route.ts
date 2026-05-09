import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSeedanceVideoStatus } from '@/lib/providers/china/volcengine'
import { getCurrentUser } from '@/lib/auth/current-user'
import { persistGeneratedMedia } from '@/lib/assets/persist-generated-media'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({
      success: false,
      status: 'error',
      errorCode: 'UNAUTHORIZED',
      message: '请先登录后再查询视频任务。',
    }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const providerId = searchParams.get('providerId') ?? ''
  const taskId = searchParams.get('taskId') ?? ''
  const projectId = searchParams.get('projectId')?.trim() || undefined
  const workflowId = searchParams.get('workflowId')?.trim() || undefined
  const nodeId = searchParams.get('nodeId')?.trim() || undefined

  if (!taskId) {
    return NextResponse.json({
      success: false,
      status: 'error',
      errorCode: 'TASK_ID_REQUIRED',
      message: 'taskId is required',
    }, { status: 400 })
  }

  if (providerId !== 'volcengine-seedance-video') {
    return NextResponse.json({
      success: false,
      providerId,
      taskId,
      status: 'error',
      errorCode: 'PROVIDER_NOT_SUPPORTED',
      message: '该视频任务查询接口目前仅支持 volcengine-seedance-video。',
    }, { status: 200 })
  }

  const result = await getSeedanceVideoStatus(taskId)
  if (!result.success) {
    return NextResponse.json({
      success: false,
      providerId,
      taskId,
      status: 'error',
      errorCode: result.errorCode,
      message: result.message,
      model: result.model,
      upstreamStatus: result.upstreamStatus,
      upstreamMessage: result.upstreamMessage,
      rawCode: result.rawCode,
      requestId: result.requestId,
    }, { status: 200 })
  }

  if (result.status === 'done' && result.videoUrl) {
    const persistence = await persistGeneratedMedia({
      url: result.videoUrl,
      type: 'video',
      projectId,
      workflowId,
      nodeId,
      filenameHint: 'generated-video.mp4',
      sourceProvider: providerId,
      userId: currentUser.id,
      metadata: { model: result.model, taskId },
    }).catch((error: unknown) => ({
      ok: false as const,
      errorCode: 'MEDIA_PERSIST_FAILED',
      message: error instanceof Error ? error.message : '生成视频转存失败。',
    }))

    if (persistence.ok) {
      return NextResponse.json({
        success: true,
        providerId,
        taskId,
        status: 'done',
        resultVideoUrl: persistence.stableUrl,
        videoUrl: persistence.stableUrl,
        assetUrl: persistence.stableUrl,
        assetId: persistence.assetId,
        originalProviderVideoUrl: result.videoUrl,
        mediaPersistence: persistence,
        model: result.model,
        message: result.message,
      }, { status: 200 })
    }

    return NextResponse.json({
      success: true,
      providerId,
      taskId,
      status: 'done',
      resultVideoUrl: result.videoUrl,
      videoUrl: result.videoUrl,
      originalProviderVideoUrl: result.videoUrl,
      mediaPersistence: {
        status: 'failed',
        errorCode: persistence.errorCode,
        message: persistence.message,
      },
      warning: '生成成功，但媒体转存失败，链接可能会过期。',
      model: result.model,
      message: result.message,
    }, { status: 200 })
  }

  return NextResponse.json({
    success: true,
    providerId,
    taskId,
    status: result.status,
    videoUrl: result.status === 'done' ? result.videoUrl : undefined,
    model: result.model,
    message: result.message,
  }, { status: 200 })
}
