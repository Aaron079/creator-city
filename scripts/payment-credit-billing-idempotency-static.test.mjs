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

test('setupBilling extracts stable billing idempotency context from supported headers', () => {
  const middleware = read('apps/web/src/lib/credits/billing-middleware.ts')

  assert.match(middleware, /export type BillingIdempotencyContext/)
  assert.match(middleware, /billingRequestId:\s*string/)
  assert.match(middleware, /source:\s*'header'\s*\|\s*'body'\s*\|\s*'server-derived'/)
  assert.match(middleware, /Idempotency-Key/)
  assert.match(middleware, /X-Idempotency-Key/)
  assert.match(middleware, /X-Creator-Request-Id/)
  assertBefore(
    middleware,
    "'Idempotency-Key'",
    "'X-Idempotency-Key'",
    'standard Idempotency-Key must be the first header preference',
  )
  assertBefore(
    middleware,
    "'X-Idempotency-Key'",
    "'X-Creator-Request-Id'",
    'X-Idempotency-Key must be checked before X-Creator-Request-Id',
  )
  assert.match(middleware, /billingIdempotency.*billingRequestId/s)
  assert.match(middleware, /BILLING_IDEMPOTENCY_CONTEXT_MISSING/)
})

test('all setupBilling callers provide a Request object that can expose headers', () => {
  const agent = read('apps/web/src/app/api/agents/text/route.ts')
  const text = read('apps/web/src/app/api/generate/text/route.ts')
  const audio = read('apps/web/src/app/api/generate/audio/route.ts')
  const music = read('apps/web/src/app/api/generate/music/route.ts')
  const image = read('apps/web/src/app/api/generate/image/route.ts')
  const video = read('apps/web/src/app/api/generate/video/route.ts')

  assert.match(agent, /setupBilling\(request,\s*'openai-text'/)
  assert.match(text, /setupBilling\(request,\s*providerId,\s*'text'/)
  assert.match(audio, /setupBilling\(request,\s*providerId,\s*'audio'/)
  assert.match(music, /setupBilling\(request,\s*providerId,\s*'music'/)
  assert.match(image, /setupBilling\(request,\s*providerId,\s*'image'/)
  assert.match(video, /setupBilling\(request,\s*providerId,\s*'video'/)
})

test('Canvas generation launch sends a stable Idempotency-Key header outside the provider payload', () => {
  const canvas = read('apps/web/src/components/create/VisualCanvasWorkspace.tsx')

  assert.match(canvas, /function createGenerationIdempotencyKey\(/)
  assert.match(canvas, /clientActionId\s*=\s*crypto\.randomUUID\(\)/)
  assert.match(canvas, /generationIdempotencyKey\?:\s*string/)
  assert.match(canvas, /const headers:\s*Record<string,\s*string>\s*=\s*\{\s*'content-type':\s*'application\/json'\s*\}/)
  assert.match(canvas, /headers\['Idempotency-Key'\]\s*=\s*generationIdempotencyKey/)
  assert.match(canvas, /fetch\(endpoint,\s*\{[\s\S]*headers,[\s\S]*body:\s*JSON\.stringify\(requestBody\)/)
  assert.doesNotMatch(canvas, /requestBody[\s\S]{0,120}idempotency/i)
})

test('Canvas creates one billing request id per deliberate generation action', () => {
  const canvas = read('apps/web/src/components/create/VisualCanvasWorkspace.tsx')

  assert.match(canvas, /const generationIdempotencyKey\s*=\s*createGenerationIdempotencyKey\(effectiveProjectId,\s*node\.id\)/)
  assert.match(canvas, /const generationIdempotencyKey\s*=\s*createGenerationIdempotencyKey\(projectId,\s*nodeSnapshot\.id\)/)
  assert.match(canvas, /generationController\.signal,\s*generationIdempotencyKey/)
  assert.match(canvas, /generationController\?\.signal,\s*generationIdempotencyKey/)
})

test('Canvas media debug regeneration POSTs send an Idempotency-Key header outside the provider payload', () => {
  const debugPanel = read('apps/web/src/components/create/P0MediaDebugPanel.tsx')

  assert.match(debugPanel, /function createDebugGenerationIdempotencyKey\(/)
  assert.match(debugPanel, /const generationIdempotencyKey\s*=\s*createDebugGenerationIdempotencyKey\(projectId,\s*node\.id\)/)
  assert.match(debugPanel, /headers:\s*\{[\s\S]*'Idempotency-Key':\s*generationIdempotencyKey[\s\S]*\}/)
  assert.doesNotMatch(debugPanel, /body:\s*JSON\.stringify\(\{[\s\S]{0,900}idempotency/i)
})

test('BYOK generation paths bypass platform credit billing even when a client request id is present', () => {
  const text = read('apps/web/src/app/api/generate/text/route.ts')
  const image = read('apps/web/src/app/api/generate/image/route.ts')

  assertBefore(
    text,
    "body.billingMode === 'user_provider_account'",
    'setupBilling(request, providerId, \'text\'',
    'text BYOK must bypass platform billing before setupBilling',
  )
  assertBefore(
    image,
    "body.billingMode === 'user_provider_account'",
    "setupBilling(request, providerId, 'image'",
    'image BYOK must bypass platform billing before setupBilling',
  )
})

test('historical duplicate review SQL stays read-only and covers launch-blocking duplicate scenarios', () => {
  const sql = read('scripts/payment-credit-idempotency-history-check.sql')

  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|MERGE|CALL)\b/i)
  assert.match(sql, /duplicate_purchase_ledger/i)
  assert.match(sql, /duplicate_generation_reserve_ledger/i)
  assert.match(sql, /duplicate_generation_settle_ledger/i)
  assert.match(sql, /duplicate_generation_refund_ledger/i)
  assert.match(sql, /paid_order_missing_purchase_ledger/i)
  assert.match(sql, /pending_order_with_purchase_ledger/i)
  assert.match(sql, /wallet_ledger_drift_candidate/i)
})

test('web reserve and settle use stable idempotency keys when billingRequestId exists', () => {
  const reserve = read('apps/web/src/lib/billing/reserve.ts')
  const settle = read('apps/web/src/lib/billing/settle.ts')

  assert.match(reserve, /billingRequestId\?:\s*string/)
  assert.match(reserve, /generationJob\.findFirst\(\{\s*where:\s*\{\s*userId,\s*billingRequestId/s)
  assert.match(reserve, /billingRequestId:\s*billingRequestId\s*\?\?\s*null/)
  assert.match(reserve, /idempotencyKey:\s*reserveLedgerIdempotencyKey/)
  assertBefore(
    reserve,
    'tx.userCreditWallet.updateMany',
    'tx.generationJob.create',
    'reserve must keep conditional wallet claim before job creation',
  )

  assert.match(settle, /generationJob\.updateMany/)
  assertBefore(
    settle,
    'tx.generationJob.updateMany',
    'tx.userCreditWallet.update',
    'settle/release must claim the FROZEN job before wallet mutation',
  )
  assert.match(settle, /idempotencyKey:\s*settleLedgerIdempotencyKey/)
  assert.match(settle, /idempotencyKey:\s*releaseLedgerIdempotencyKey/)
})

test('Prisma schema contains nullable idempotency fields and unique anchors', () => {
  const schema = read('apps/server/prisma/schema.prisma')

  assert.match(schema, /model CreditLedger[\s\S]*idempotencyKey\s+String\?\s+@unique/)
  assert.match(schema, /model PaymentOrder[\s\S]*idempotencyKey\s+String\?\s+@unique/)
  assert.match(schema, /model PaymentOrder[\s\S]*fulfilledAt\s+DateTime\?/)
  assert.match(schema, /model GenerationJob[\s\S]*billingRequestId\s+String\?/)
  assert.match(schema, /@@unique\(\[userId,\s*billingRequestId\]\)/)
})

test('China payment creation supports stable order idempotency when a header is present', () => {
  const route = read('apps/web/src/app/api/payment/china/create/route.ts')

  assert.match(route, /PAYMENT_IDEMPOTENCY_HEADERS/)
  assert.match(route, /Idempotency-Key/)
  assert.match(route, /X-Idempotency-Key/)
  assert.match(route, /X-Creator-Request-Id/)
  assert.match(route, /getPaymentIdempotencyKey\(request,\s*user\.id\)/)
  assert.match(route, /paymentOrder\.findUnique\(\{\s*where:\s*\{\s*idempotencyKey\s*\}/s)
  assert.match(route, /idempotencyKey,/)
  assert.match(route, /PAYMENT_IDEMPOTENCY_CONFLICT/)
})
