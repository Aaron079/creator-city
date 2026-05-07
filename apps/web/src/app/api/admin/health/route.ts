import { NextResponse } from 'next/server'
import { buildAdminHealth } from '@/lib/admin/health'
import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: '请先登录。',
      }, { status: 401 })
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        errorCode: 'FORBIDDEN',
        message: '需要管理员权限',
      }, { status: 403 })
    }

    const health = await buildAdminHealth(user)
    return NextResponse.json({ success: true, ...health })
  } catch (error) {
    console.error('[admin/health]', error)
    return NextResponse.json({
      success: false,
      errorCode: 'ADMIN_HEALTH_FAILED',
      message: error instanceof Error ? error.message : '系统健康检查失败。',
    }, { status: 500 })
  }
}
