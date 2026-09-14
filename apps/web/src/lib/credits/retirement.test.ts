import assert from 'node:assert/strict'
import { test } from 'node:test'
import Module, { createRequire } from 'node:module'
import { paymentLaunchGate } from '../payment/paymentLaunchGate'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const load = loader._load
let writes = 0
const unexpectedWrite = async () => { writes++; throw new Error('unexpected database call') }
loader._load = function (id, ...args) {
  if (id === '@/lib/db') return { db: { userCreditWallet: { upsert: unexpectedWrite }, paymentOrder: { create: unexpectedWrite }, $transaction: unexpectedWrite } }
  return load.call(this, id, ...args)
}
const { submitManualRechargeRequest, adminDirectGrant } = require('./server') as typeof import('./server')
const { reserveCreditsForJob } = require('../billing/reserve') as typeof import('../billing/reserve')
loader._load = load

test('retired credit purchases cannot reopen through the former environment flag', () => {
  const old = process.env.PLATFORM_CREDITS_RECHARGE_ENABLED
  process.env.PLATFORM_CREDITS_RECHARGE_ENABLED = 'true'
  try { assert.notEqual(paymentLaunchGate(), null) }
  finally { if (old === undefined) delete process.env.PLATFORM_CREDITS_RECHARGE_ENABLED; else process.env.PLATFORM_CREDITS_RECHARGE_ENABLED = old }
})

test('new recharge, grant and reserve operations fail without database mutation', async () => {
  const retired = { code: 'CREDITS_RETIRED' }
  await assert.rejects(submitManualRechargeRequest('admin', 20), retired)
  await assert.rejects(adminDirectGrant({ userId: 'admin', adminUserId: 'admin', amountCredits: 20 }), retired)
  await assert.rejects(reserveCreditsForJob({ userId: 'admin', estimatedCredits: 20, providerId: 'openai-image', nodeType: 'image', prompt: 'test' }), retired)
  assert.equal(writes, 0)
})
