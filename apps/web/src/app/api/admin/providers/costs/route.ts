import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录。' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ message: '无权限：仅管理员可访问。' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const providerId = searchParams.get('providerId') ?? undefined
  const limit = Math.min(Number(searchParams.get('limit') ?? '100'), 500)

  const rows = await db.providerCostLedger.findMany({
    where: providerId ? { providerId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const total = rows.reduce((sum, r) => sum + Number(r.providerCostUsd), 0)

  return NextResponse.json({ costs: rows, totalUsd: total, count: rows.length })
}
