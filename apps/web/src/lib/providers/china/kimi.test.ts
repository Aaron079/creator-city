import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { generateKimiText, getKimiStatus } from './kimi'

const originalEnv = process.env
const originalFetch = globalThis.fetch
beforeEach(() => {
  process.env = { NODE_ENV: 'test', MOONSHOT_API_KEY: 'test-only', MOONSHOT_BASE_URL: 'https://example.test/v1///', KIMI_MODEL_TEXT: 'configured-text-model' }
  globalThis.fetch = async () => { throw new Error('Unexpected network call') }
})
afterEach(() => { process.env = originalEnv; globalThis.fetch = originalFetch })

test('multimodal status and invocation share the configured text-model fallback', async () => {
  let payload: Record<string, unknown> = {}
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://example.test/v1/chat/completions')
    payload = JSON.parse(String(init?.body))
    return Response.json({ choices: [{ message: { content: 'final text' } }] })
  }
  const result = await generateKimiText({ providerId: 'kimi-multimodal', prompt: 'actual prompt', purpose: 'generate', maxTokens: 77 })
  assert.equal(result.model, 'configured-text-model')
  assert.equal(getKimiStatus('kimi-multimodal')?.model, result.model)
  assert.equal(getKimiStatus('kimi-multimodal')?.baseUrl, 'https://example.test/v1')
  assert.equal(payload.max_tokens, 77)
  assert.deepEqual((payload.messages as Array<{ content: string }>)[1], { role: 'user', content: 'actual prompt' })
})

test('explicit multimodal configuration and BYOK key take precedence', async () => {
  process.env.KIMI_MODEL_MULTIMODAL = 'configured-multimodal-model'
  globalThis.fetch = async (_url, init) => {
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-byok')
    assert.equal(JSON.parse(String(init?.body)).model, 'configured-multimodal-model')
    return Response.json({ choices: [{ message: { content: 'OK' } }] })
  }
  const result = await generateKimiText({ providerId: 'kimi-multimodal', prompt: 'test', purpose: 'generate', apiKeyOverride: 'test-byok' })
  assert.equal(result.success, true)
  assert.equal(getKimiStatus('kimi-multimodal')?.model, result.model)
})

for (const code of ['ENOTFOUND', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT', 'CERT_HAS_EXPIRED']) {
  test(`network diagnostics preserve ${code} without exposing error details or retrying`, async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      throw new TypeError('private-token https://private.example/?key=private-token', {
        cause: Object.assign(new Error('private-host private-token'), { code, address: 'private-address' }),
      })
    }
    const result = await generateKimiText({ prompt: 'test', purpose: 'generate' })
    assert.equal(result.success, false)
    if (result.success) return
    assert.equal(result.rawCode, code)
    assert.doesNotMatch(JSON.stringify(result), /private-/)
    assert.equal(calls, 1)
  })
}

test('unknown cause codes and non-Error failures cannot leak secrets', async () => {
  for (const error of [
    new Error('private-message', { cause: { code: 'PRIVATE_SECRET_TOKEN' } }),
    new Error('https://user:private-password@host?api_key=private-query', { cause: { code: 'ENOTFOUND?api_key=private-token' } }),
    'private-token',
  ]) {
    globalThis.fetch = async () => { throw error }
    const result = await generateKimiText({ prompt: 'test', purpose: 'generate' })
    assert.equal(result.success, false)
    if (result.success) continue
    assert.equal(result.rawCode, undefined)
    assert.doesNotMatch(JSON.stringify(result), /private|PRIVATE/)
  }
})

test('abort classification and reasoning-only rejection are retained', async () => {
  globalThis.fetch = async () => { throw new DOMException('aborted', 'AbortError') }
  const aborted = await generateKimiText({ prompt: 'test', purpose: 'generate' })
  assert.equal(aborted.success, false)
  if (!aborted.success) assert.equal(aborted.errorCode, 'KIMI_REQUEST_TIMEOUT')
  globalThis.fetch = async () => Response.json({ choices: [{ message: { reasoning_content: 'not final' } }] })
  const reasoning = await generateKimiText({ prompt: 'test', purpose: 'generate' })
  assert.equal(reasoning.success, false)
  if (!reasoning.success) assert.equal(reasoning.errorCode, 'KIMI_EMPTY_FINAL_CONTENT')
})

test('HTTP error codes are not mistaken for transport diagnostics', async () => {
  globalThis.fetch = async () => Response.json({ error: { message: 'test quota', code: 'quota_exceeded' } }, { status: 429, headers: { 'x-request-id': 'test-request' } })
  const result = await generateKimiText({ prompt: 'test', purpose: 'generate' })
  assert.equal(result.success, false)
  if (result.success) return
  assert.equal(result.upstreamStatus, 429)
  assert.equal(result.rawCode, 'quota_exceeded')
  assert.equal(result.requestId, 'test-request')
})

test('HTTP 429 preserves quota and rate-limit codes, including the upstream type fallback', async () => {
  for (const code of ['insufficient_quota', 'rate_limit_exceeded']) {
    for (const field of ['code', 'type']) {
      globalThis.fetch = async () => Response.json({ error: { [field]: code, message: 'test upstream error' } }, { status: 429 })
      const result = await generateKimiText({ prompt: 'test', purpose: 'generate' })
      assert.equal(result.success, false)
      if (!result.success) assert.equal(result.rawCode, code)
    }
  }
})
