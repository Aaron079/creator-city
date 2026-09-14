import assert from 'node:assert/strict'
import { test } from 'node:test'
import Module, { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const load = loader._load
let dbCalls = 0
let recorded: Record<string, unknown> = {}
loader._load = function (id, ...args) {
  if (id === '@/lib/auth/current-user') return { getCurrentUser: async () => ({ id: 'admin', role: 'ADMIN', status: 'ACTIVE' }) }
  if (id === '@/lib/db') return { db: {
    user: { findUnique: async () => { dbCalls++; return { id: 'user' } } },
    providerCostLedger: { create: ({ data }: { data: Record<string, unknown> }) => { recorded = data; return Promise.resolve() } },
    providerAccount: { upsert: () => Promise.resolve() },
    $transaction: (calls: Promise<unknown>[]) => Promise.all(calls),
  } }
  return load.call(this, id, ...args)
}
const grant = require('../../app/api/admin/credits/grant/route') as typeof import('../../app/api/admin/credits/grant/route')
const packages = require('../../app/api/credits/packages/route') as typeof import('../../app/api/credits/packages/route')
const { recordProviderCost } = require('../gateway/cost-recorder') as typeof import('../gateway/cost-recorder')
loader._load = load

test('retired direct grants return a clear response without a target lookup', async () => {
  const response = await grant.POST(new Request('https://city.test', { method: 'POST', body: JSON.stringify({ targetUserEmail: 'test@example.test', amountCredits: 20 }) }) as never)
  assert.equal(response.status, 410)
  assert.equal((await response.json()).errorCode, 'CREDITS_RETIRED')
  assert.equal(dbCalls, 0)
})

test('credit packages no longer advertise future sales', async () => {
  assert.deepEqual((await (await packages.GET()).json()).packages, [])
})

test('provider cost accounting never records a new user credit charge', async () => {
  for (const creditsCharged of [undefined, 20]) {
    await recordProviderCost({ providerId: 'openai-image', nodeType: 'image', creditsCharged })
    assert.equal(recorded.userChargedCredits, 0)
    assert.equal(typeof recorded.providerCostUsd, 'number')
  }
})
