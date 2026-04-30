import { getApiBase, readJson } from './server-api'
import type { CreditLedgerEntry, LedgerType } from './types'

function normalizeType(type: string): LedgerType {
  const key = type.toLowerCase()
  if (key === 'freeze') return 'reserve'
  if (key === 'unfreeze') return 'release'
  if (key === 'admin_adjustment') return 'admin_adjustment'
  return key as LedgerType
}

export async function appendLedgerEntry(): Promise<never> {
  throw new Error('CreditLedger is append-only and can only be written by backend wallet/order transactions.')
}

export async function listLedger(authToken: string): Promise<{ items: CreditLedgerEntry[]; total: number }> {
  const res = await fetch(`${getApiBase()}/api/v1/credits/ledger`, {
    headers: { Authorization: `Bearer ${authToken}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Ledger fetch failed: ${res.status}`)

  const data = await readJson<{
    items?: Array<{
      id: string
      walletId: string
      userId?: string | null
      type: string
      delta: number
      amountCredits?: number
      balance: number
      refType?: string | null
      refId?: string | null
      paymentOrderId?: string | null
      generationJobId?: string | null
      note?: string | null
      description?: string | null
      createdAt: string
    }>
    total?: number
  }>(res)

  return {
    total: data.total ?? 0,
    items: (data.items ?? []).map((item) => ({
      id: item.id,
      userId: item.userId ?? undefined,
      walletId: item.walletId,
      type: normalizeType(item.type),
      amountCredits: item.amountCredits ?? item.delta,
      balanceAfter: item.balance,
      relatedPaymentOrderId: item.paymentOrderId ?? (item.refType === 'payment_order' ? item.refId : null),
      relatedGenerationJobId: item.generationJobId ?? (item.refType === 'generation_job' ? item.refId : null),
      description: item.description ?? item.note ?? null,
      createdAt: item.createdAt,
    })),
  }
}
