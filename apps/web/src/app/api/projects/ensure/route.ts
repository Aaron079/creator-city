import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { isProjectCanvasSchemaMissing, projectJsonError } from '@/lib/projects/api-errors'
import { ensureActiveProject } from '@/lib/projects/ensure-active-project'

export const dynamic = 'force-dynamic'

async function handleEnsure() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: '请先登录',
    }, { status: 401 })
  }

  try {
    const result = await ensureActiveProject(user)
    return NextResponse.json({
      success: true,
      project: result.project,
      workflow: result.workflow,
      ...(result.membershipWarning ? { membershipWarning: result.membershipWarning } : {}),
    })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return NextResponse.json({
        success: false,
        errorCode: 'DB_SCHEMA_MISSING',
        message: '项目数据库表未同步',
      }, { status: 503 })
    }
    console.error('[projects/ensure] failed to ensure active project', error)
    return projectJsonError('PROJECT_ACCESS_FAILED', '打开项目失败。', 500)
  }
}

export async function GET() {
  return handleEnsure()
}

export async function POST() {
  return handleEnsure()
}
