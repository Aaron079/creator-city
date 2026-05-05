import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getChinaInfrastructureStatus } from '@/lib/china/status'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录。' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ message: '无权限：仅管理员可访问。' }, { status: 403 })

  return NextResponse.json(getChinaInfrastructureStatus())
}
