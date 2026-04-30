/**
 * Server-side only. Calls the NestJS /api/v1/credits/* endpoints.
 * Never import from client components.
 */

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
}

function getInternalSecret(): string {
  const s = process.env.INTERNAL_API_SECRET
  if (!s) throw new Error('INTERNAL_API_SECRET is not configured')
  return s
}

function internalHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-internal-secret': getInternalSecret(),
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FreezeResult {
  jobId: string
  estimatedCost: number
  balance: number
}

export interface WalletInfo {
  balance: number
  frozenBalance: number
  totalPurchased: number
  totalConsumed: number
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  bonusCredits: number
  priceUSD: number
  description: string | null
}

export interface PaymentOrderRecord {
  id: string
  userId: string
  stripeSessionId: string | null
  credits: number
  priceUSD: number
  status: string
}

// ─── User-authenticated calls ─────────────────────────────────────────────────

export async function freezeCredits(
  authToken: string,
  input: { providerId: string; nodeType: string; prompt: string },
): Promise<FreezeResult> {
  const res = await fetch(`${getApiBase()}/api/v1/credits/freeze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(input),
  })

  if (res.status === 400) {
    const data = await res.json() as { message?: string }
    throw new InsufficientCreditsError(data.message ?? 'Insufficient credits')
  }
  if (!res.ok) {
    const data = await res.json() as { message?: string }
    throw new Error(data.message ?? `Billing error ${res.status}`)
  }

  return res.json() as Promise<FreezeResult>
}

export async function fetchWallet(authToken: string): Promise<WalletInfo> {
  const res = await fetch(`${getApiBase()}/api/v1/credits/wallet`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
  if (!res.ok) throw new Error(`Wallet fetch failed: ${res.status}`)
  return res.json() as Promise<WalletInfo>
}

export async function fetchPackages(): Promise<CreditPackage[]> {
  const res = await fetch(`${getApiBase()}/api/v1/credits/packages`)
  if (!res.ok) throw new Error(`Packages fetch failed: ${res.status}`)
  return res.json() as Promise<CreditPackage[]>
}

export async function createOrder(
  authToken: string,
  input: { packageId: string; stripeSessionId: string; credits: number; priceUSD: number },
): Promise<PaymentOrderRecord> {
  const res = await fetch(`${getApiBase()}/api/v1/credits/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const data = await res.json() as { message?: string }
    throw new Error(data.message ?? `Order creation failed: ${res.status}`)
  }
  return res.json() as Promise<PaymentOrderRecord>
}

// ─── Internal calls (Next.js server → NestJS) ─────────────────────────────────

export async function settleCredits(jobId: string, actualCost?: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/v1/credits/internal/settle`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify({ jobId, actualCost }),
  })
  if (!res.ok) console.error('[billing] settle failed', res.status, await res.text())
}

export async function refundCredits(jobId: string, reason?: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/v1/credits/internal/refund`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify({ jobId, reason }),
  })
  if (!res.ok) console.error('[billing] refund failed', res.status, await res.text())
}

export async function updateJobExternalId(jobId: string, externalJobId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/v1/credits/internal/update-job`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify({ jobId, externalJobId }),
  })
  if (!res.ok) console.error('[billing] update-job failed', res.status, await res.text())
}

export async function fulfillOrder(input: string | {
  stripeSessionId?: string
  orderId?: string
  externalOrderId?: string
  stripePaymentIntentId?: string
  externalPaymentId?: string
  rawNotifyJson?: string
}, stripePaymentIntentId?: string): Promise<void> {
  const payload = typeof input === 'string'
    ? { stripeSessionId: input, stripePaymentIntentId }
    : input
  const res = await fetch(`${getApiBase()}/api/v1/credits/internal/fulfill-order`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Fulfill order failed: ${res.status} ${await res.text()}`)
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsufficientCreditsError'
  }
}
