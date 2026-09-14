import assert from 'node:assert/strict'
import { test } from 'node:test'
import Module, { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const originalLoad = loader._load
let user: { id: string; role: string; status: string } | null = null
let identityError = false
let walletCalls = 0
const reconciled: string[] = []
loader._load = function (id, ...args) {
  if (id === '@/lib/auth/current-user') return { getCurrentUser: async () => user }
  if (id === '@/lib/auth/cookies') return { getSessionToken: () => 'session-token' }
  if (id === '@/lib/auth/session') return { getSession: async () => {
    if (identityError) throw Object.assign(new Error('private database failure'), { code: 'SESSION_DB_UNAVAILABLE' })
    return user ? { user } : null
  } }
  if (id === '@/lib/credits/server') return { getOrCreateWallet: async () => { walletCalls++; return { balance: 0 } } }
  if (id === '@/lib/billing/reserve') return { reserveCreditsForJob: async () => { walletCalls++; throw new Error('must not reserve') } }
  if (id === '@/lib/billing/settle') return {
    settleJobCredits: async (id: string) => { reconciled.push(`settle:${id}`) },
    releaseJobCredits: async (id: string) => { reconciled.push(`release:${id}`) },
  }
  if (id === '@/lib/providers/env') return { checkEnvKeys: () => ({ configured: true }) }
  return originalLoad.call(this, id, ...args)
}
const { setupBilling, finalizeBilling } = require('./billing-middleware') as typeof import('./billing-middleware')
loader._load = originalLoad

test('active administrator generates at zero balance without wallet reads or reservations', async () => {
  user = { id: 'admin', role: 'ADMIN', status: 'ACTIVE' }
  const result = await setupBilling(null, 'openai-image', 'image', 'test')
  assert.deepEqual(result, { ok: true, ctx: { userId: 'admin', billingJobId: null, estimatedCredits: 0 } })
  assert.equal(walletCalls, 0)
})

test('anonymous and non-admin identities cannot generate', async () => {
  for (const identity of [null, { id: 'user', role: 'USER', status: 'ACTIVE' }, { id: 'admin', role: 'ADMIN', status: 'SUSPENDED' }]) {
    user = identity
    const result = await setupBilling(null, 'openai-text', 'text', 'test')
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, identity ? 403 : 401)
  }
})

test('session outage fails closed despite a cached admin identity, without wallet access or error leakage', async () => {
  user = { id: 'admin', role: 'ADMIN', status: 'ACTIVE' }
  identityError = true
  try {
    const result = await setupBilling(null, 'openai-text', 'text', 'test')
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.status, 503)
      assert.equal(result.errorResponse.errorCode, 'GENERATION_AUTH_UNAVAILABLE')
      assert.doesNotMatch(result.errorResponse.message, /private database/)
    }
    assert.equal(walletCalls, 0)
  } finally { identityError = false }
})

test('new unbilled results do not settle credits; historical job reconciliation remains available', async () => {
  const success = { success: true, providerId: 'openai-text', mode: 'real' as const, status: 'succeeded' as const, message: 'OK' }
  assert.equal(await finalizeBilling(success, null), success)
  assert.deepEqual(reconciled, [])
  await finalizeBilling(success, 'historical-job')
  await finalizeBilling({ ...success, success: false, status: 'failed' }, 'historical-failed-job')
  await finalizeBilling({ ...success, status: 'queued' }, 'historical-pending-job')
  assert.deepEqual(reconciled, ['settle:historical-job', 'release:historical-failed-job'])
})
