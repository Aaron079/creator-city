import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import {
  PROVIDER_GATEWAY_SCHEMA_MISSING_CODE,
  PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE,
  isProviderGatewaySchemaMissing,
} from '@/lib/gateway/schema-errors'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录。' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ message: '无权限：仅管理员可访问。' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const providerId = searchParams.get('providerId') ?? undefined
  const limit = Math.min(Number(searchParams.get('limit') ?? '100'), 500)

  let rows
  try {
    rows = await db.providerCostLedger.findMany({
      where: providerId ? { providerId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  } catch (error) {
    if (isProviderGatewaySchemaMissing(error)) {
      return NextResponse.json({
        costs: [],
        totalUsd: 0,
        count: 0,
        errorCode: PROVIDER_GATEWAY_SCHEMA_MISSING_CODE,
        message: PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE,
      })
    }
    console.error('[provider-gateway] failed to load provider costs', error)
    return NextResponse.json({ message: '加载 Provider Gateway 成本流水失败。' }, { status: 500 })
  }

  const total = rows.reduce((sum, r) => sum + Number(r.providerCostUsd), 0)

  return NextResponse.json({ costs: rows, totalUsd: total, count: rows.length })
}
