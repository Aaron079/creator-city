import { NextResponse } from 'next/server'
import { getGatewayAccountStatuses } from '@/lib/gateway/accounts'
import { db } from '@/lib/db'
import {
  PROVIDER_GATEWAY_SCHEMA_MISSING_CODE,
  PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE,
  isProviderGatewaySchemaMissing,
} from '@/lib/gateway/schema-errors'

export const dynamic = 'force-dynamic'

export async function GET() {
  const statuses = getGatewayAccountStatuses()

  let dbAccounts: Array<{ providerId: string; currentMonthCostUsd: unknown; monthlyBudgetUsd: unknown; budgetMonth: string | null }> = []
  let schemaMissing = false
  try {
    dbAccounts = await db.providerAccount.findMany({
      select: { providerId: true, currentMonthCostUsd: true, monthlyBudgetUsd: true, budgetMonth: true },
    })
  } catch (error) {
    if (!isProviderGatewaySchemaMissing(error)) {
      console.error('[provider-gateway] failed to load provider status costs', error)
      return NextResponse.json({ message: '加载 Provider Gateway 状态失败。' }, { status: 500 })
    }
    schemaMissing = true
  }

  const dbMap = new Map(dbAccounts.map((a) => [a.providerId, a]))

  const providers = statuses.map((s) => {
    const db = dbMap.get(s.providerId)
    return {
      ...s,
      currentMonthCostUsd: db ? Number(db.currentMonthCostUsd) : 0,
      monthlyBudgetUsd: db?.monthlyBudgetUsd != null ? Number(db.monthlyBudgetUsd) : null,
      budgetMonth: db?.budgetMonth ?? null,
    }
  })

  return NextResponse.json({
    providers,
    ...(schemaMissing ? {
      errorCode: PROVIDER_GATEWAY_SCHEMA_MISSING_CODE,
      message: PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE,
    } : {}),
  })
}
