import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { buildProviderManagementStatus } from '@/lib/provider-management'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录。' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ success: false, errorCode: 'FORBIDDEN', message: '无权限：仅管理员可访问。' }, { status: 403 })

  try {
    const result = await buildProviderManagementStatus()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[admin/providers/status]', error)
    return NextResponse.json({
      success: false,
      errorCode: 'PROVIDER_STATUS_FAILED',
      message: error instanceof Error ? error.message : '加载 Provider 状态失败。',
    }, { status: 500 })
  }
}
