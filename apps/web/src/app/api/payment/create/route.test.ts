import assert from 'node:assert/strict'
import { test } from 'node:test'
import Module, { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const load = loader._load
let calls = 0
loader._load = function (id, ...args) {
  if (id === '@/lib/payment/stripe') return { createPaymentIntent: async () => { calls++; return { id: 'test-intent', clientSecret: 'fixture', amount: 100, currency: 'cny' } } }
  return load.call(this, id, ...args)
}
const { POST } = require('./route') as typeof import('./route')
loader._load = load

test('ordinary service orders retain their pre-existing launch policy without enabling credit sales', async () => {
  const previous = process.env.PLATFORM_CREDITS_RECHARGE_ENABLED
  try {
    process.env.PLATFORM_CREDITS_RECHARGE_ENABLED = 'false'
    const request = () => new Request('https://city.test/api/payment/create', { method: 'POST', body: JSON.stringify({ orderId: 'service-order', amount: 1 }) }) as never
    assert.equal((await POST(request())).status, 503)
    assert.equal(calls, 0)
    process.env.PLATFORM_CREDITS_RECHARGE_ENABLED = 'true'
    assert.equal((await POST(request())).status, 200)
    assert.equal(calls, 1)
  } finally {
    if (previous === undefined) delete process.env.PLATFORM_CREDITS_RECHARGE_ENABLED
    else process.env.PLATFORM_CREDITS_RECHARGE_ENABLED = previous
  }
})
