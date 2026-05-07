import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { setProviderEnabled } from '@/lib/admin/provider-management'

export const dynamic = 'force-dynamic'

type ToggleProviderBody = {
  providerId?: string
  enabled?: boolean
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录。' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ success: false, errorCode: 'FORBIDDEN', message: '无权限：仅管理员可访问。' }, { status: 403 })

  let body: ToggleProviderBody
  try {
    body = await request.json() as ToggleProviderBody
  } catch {
    return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT', message: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.providerId || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT', message: 'providerId and enabled are required' }, { status: 400 })
  }

  try {
    const result = await setProviderEnabled(body.providerId, body.enabled)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('[admin/providers/toggle]', error)
    return NextResponse.json({
      success: false,
      errorCode: 'PROVIDER_TOGGLE_FAILED',
      message: error instanceof Error ? error.message : '更新 Provider 启用状态失败。',
    }, { status: 500 })
  }
}
