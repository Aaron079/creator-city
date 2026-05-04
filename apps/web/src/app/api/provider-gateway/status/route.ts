import { NextResponse } from 'next/server'
import { getGatewayAccountStatuses } from '@/lib/gateway/accounts'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const statuses = getGatewayAccountStatuses()

  // Attach monthly cost from DB (best-effort, non-fatal)
  let dbAccounts: Array<{ providerId: string; currentMonthCostUsd: unknown; monthlyBudgetUsd: unknown; budgetMonth: string | null }> = []
  try {
    dbAccounts = await db.providerAccount.findMany({
      select: { providerId: true, currentMonthCostUsd: true, monthlyBudgetUsd: true, budgetMonth: true },
    })
  } catch {
    // DB unavailable — return env-only status
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

  return NextResponse.json({ providers })
}
