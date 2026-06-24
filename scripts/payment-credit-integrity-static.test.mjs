import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function assertBefore(source, first, second, message) {
  const firstIndex = source.indexOf(first)
  const secondIndex = source.indexOf(second)
  assert.notEqual(firstIndex, -1, `${first} not found`)
  assert.notEqual(secondIndex, -1, `${second} not found`)
  assert.ok(firstIndex < secondIndex, message)
}

test('manual recharge and China payment creation use the recharge kill switch', () => {
  const manualRoute = read('apps/web/src/app/api/credits/manual-recharge/route.ts')
  const chinaCreateRoute = read('apps/web/src/app/api/payment/china/create/route.ts')
  const credits = read('apps/web/src/lib/credits/server.ts')

  assert.match(credits, /PLATFORM_CREDITS_RECHARGE_ENABLED/)
  assert.match(credits, /errorCode:\s*'PLATFORM_CREDITS_RECHARGE_DISABLED'/)
  assert.match(credits, /message:\s*'平台充值功能暂未开放。'/)
  assert.match(manualRoute, /assertPlatformCreditsRechargeEnabled/)
  assert.match(chinaCreateRoute, /assertPlatformCreditsRechargeEnabled/)
  assert.match(manualRoute, /status:\s*503/)
  assert.match(chinaCreateRoute, /status:\s*503/)
})

test('web recharge approval and reserve use conditional claims before credit mutation', () => {
  const reserve = read('apps/web/src/lib/billing/reserve.ts')
  const credits = read('apps/web/src/lib/credits/server.ts')

  assert.match(reserve, /userCreditWallet\.updateMany/)
  assert.match(reserve, /balance:\s*\{\s*gte:\s*estimatedCredits\s*\}/)
  assert.match(credits, /paymentOrder\.updateMany/)
  assert.match(credits, /provider:\s*'manual'/)
  assert.match(credits, /status:\s*PaymentOrderStatus\.PENDING/)
  assertBefore(
    credits,
    'tx.paymentOrder.updateMany',
    'tx.userCreditWallet.update',
    'manual approval must claim the order before crediting the wallet',
  )
})
