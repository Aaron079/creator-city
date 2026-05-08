import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSeedanceVideoStatus } from '@/lib/providers/china/volcengine'
import { getCurrentUser } from '@/lib/auth/current-user'

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
