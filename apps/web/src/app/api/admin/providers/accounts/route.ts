import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getGatewayAccountStatuses } from '@/lib/gateway/accounts'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录。' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ message: '无权限：仅管理员可访问。' }, { status: 403 })

  const statuses = getGatewayAccountStatuses()
  let dbAccounts: Array<{
    id: string
    providerId: string
    displayName: string
    monthlyBudgetUsd: unknown
    currentMonthCostUsd: unknown
    budgetMonth: string | null
    isActive: boolean
    lastCheckedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }> = []

  try {
    dbAccounts = await db.providerAccount.findMany({ orderBy: { providerId: 'asc' } })
  } catch {
    // DB not seeded yet — return env-only data
  }

  const dbMap = new Map(dbAccounts.map((a) => [a.providerId, a]))

  const accounts = statuses.map((s) => {
    const row = dbMap.get(s.providerId)
    return {
      providerId: s.providerId,
      displayName: s.displayName,
      envStatus: s.status,
      nodeTypes: s.nodeTypes,
      monthlyBudgetUsd: row?.monthlyBudgetUsd != null ? Number(row.monthlyBudgetUsd) : null,
      currentMonthCostUsd: row ? Number(row.currentMonthCostUsd) : 0,
      budgetMonth: row?.budgetMonth ?? null,
      isActive: row?.isActive ?? true,
      lastCheckedAt: row?.lastCheckedAt ?? null,
    }
  })

  return NextResponse.json({ accounts })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录。' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ message: '无权限：仅管理员可访问。' }, { status: 403 })

  let body: { providerId?: string; monthlyBudgetUsd?: number | null; isActive?: boolean }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
  }

  const { providerId, monthlyBudgetUsd, isActive } = body
  if (!providerId) return NextResponse.json({ message: 'providerId is required' }, { status: 400 })

  const account = await db.providerAccount.upsert({
    where: { providerId },
    create: {
      providerId,
      displayName: providerId,
      monthlyBudgetUsd: monthlyBudgetUsd ?? null,
      isActive: isActive ?? true,
    },
    update: {
      ...(monthlyBudgetUsd !== undefined ? { monthlyBudgetUsd: monthlyBudgetUsd ?? null } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  })

  return NextResponse.json({ account })
}
