/**
 * Unit tests for paymentLaunchGate.ts
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/payment/paymentLaunchGate.test.ts
 *
 * Covers:
 *  - env not set   → gate closed (503 + PLATFORM_CREDITS_RECHARGE_DISABLED)
 *  - env = 'false' → gate closed
 *  - env = '1'     → gate closed
 *  - env = 'True'  → gate closed (case-sensitive)
 *  - env = 'true'  → gate open (null)
 *  - gate closed:  errorCode, status, success: false
 *  - gate closed:  does not return clientSecret
 *  - gate open:    returns null (caller proceeds)
 */

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { paymentLaunchGate } from './paymentLaunchGate'

const ENV_KEY = 'PLATFORM_CREDITS_RECHARGE_ENABLED'

describe('paymentLaunchGate — gate closed (fail closed)', () => {
  let original: string | undefined

  beforeEach(() => {
    original = process.env[ENV_KEY]
    delete process.env[ENV_KEY]
  })

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = original
    }
  })

  test('env not set → returns gate error', () => {
    delete process.env[ENV_KEY]
    const result = paymentLaunchGate()
    assert.notEqual(result, null)
  })

  test('env = "false" → returns gate error', () => {
    process.env[ENV_KEY] = 'false'
    const result = paymentLaunchGate()
    assert.notEqual(result, null)
  })

  test('env = "1" → returns gate error', () => {
    process.env[ENV_KEY] = '1'
    const result = paymentLaunchGate()
    assert.notEqual(result, null)
  })

  test('env = "True" (case) → returns gate error', () => {
    process.env[ENV_KEY] = 'True'
    const result = paymentLaunchGate()
    assert.notEqual(result, null)
  })

  test('gate closed: status is 503', () => {
    delete process.env[ENV_KEY]
    const result = paymentLaunchGate()
    assert.equal(result?.status, 503)
  })

  test('gate closed: errorCode is PLATFORM_CREDITS_RECHARGE_DISABLED', () => {
    delete process.env[ENV_KEY]
    const result = paymentLaunchGate()
    assert.equal(result?.body.errorCode, 'PLATFORM_CREDITS_RECHARGE_DISABLED')
  })

  test('gate closed: success is false', () => {
    delete process.env[ENV_KEY]
    const result = paymentLaunchGate()
    assert.equal(result?.body.success, false)
  })

  test('gate closed: body has message', () => {
    delete process.env[ENV_KEY]
    const result = paymentLaunchGate()
    assert.ok(typeof result?.body.message === 'string' && result.body.message.length > 0)
  })

  test('gate closed: body does not contain clientSecret', () => {
    delete process.env[ENV_KEY]
    const result = paymentLaunchGate()
    assert.ok(result !== null)
    assert.ok(!('clientSecret' in result.body))
  })

  test('gate closed: body does not contain orderId', () => {
    delete process.env[ENV_KEY]
    const result = paymentLaunchGate()
    assert.ok(result !== null)
    assert.ok(!('orderId' in result.body))
  })
})

describe('paymentLaunchGate — gate open', () => {
  let original: string | undefined

  beforeEach(() => {
    original = process.env[ENV_KEY]
    process.env[ENV_KEY] = 'true'
  })

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = original
    }
  })

  test('env = "true" → returns null (gate open)', () => {
    const result = paymentLaunchGate()
    assert.equal(result, null)
  })

  test('gate open: caller can proceed (null is falsy)', () => {
    const result = paymentLaunchGate()
    assert.ok(!result, 'null is falsy — route should continue')
  })
})

describe('paymentLaunchGate — static shape contract', () => {
  test('gate error body matches expected shape', () => {
    const saved = process.env[ENV_KEY]
    delete process.env[ENV_KEY]
    const result = paymentLaunchGate()
    assert.ok(result !== null)
    assert.deepEqual(Object.keys(result.body).sort(), ['errorCode', 'message', 'success'])
    if (saved !== undefined) process.env[ENV_KEY] = saved
  })

  test('gate error status is always 503', () => {
    const saved = process.env[ENV_KEY]
    for (const val of [undefined, 'false', '', '0', 'True', 'TRUE']) {
      if (val === undefined) { delete process.env[ENV_KEY] } else { process.env[ENV_KEY] = val }
      assert.equal(paymentLaunchGate()?.status, 503, `status should be 503 for env=${String(val)}`)
    }
    if (saved !== undefined) process.env[ENV_KEY] = saved; else delete process.env[ENV_KEY]
  })
})
