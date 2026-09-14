import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { openaiImagesAdapter, openaiTextAdapter } from './openai'

const originalEnv = process.env
const originalFetch = globalThis.fetch
beforeEach(() => {
  process.env = { NODE_ENV: 'test', OPENAI_API_KEY: 'test-only', PROVIDER_DEFAULT_TIMEOUT_MS: '20' }
  globalThis.fetch = async () => { throw new Error('Unexpected network call') }
})
afterEach(() => {
  process.env = originalEnv
  globalThis.fetch = originalFetch
})

for (const model of ['gpt-image-1', 'gpt-image-1-mini', 'gpt-image-1.5', 'dall-e-3']) {
  test(`${model} keeps the configured model and uses compatible image dimensions`, async () => {
    process.env.OPENAI_IMAGE_MODEL = model
    const payloads: Record<string, unknown>[] = []
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/images/generations')
      payloads.push(JSON.parse(String(init?.body)))
      return Response.json({ data: [{ b64_json: 'dGVzdA==' }] })
    }
    for (const ratio of ['1:1', '9:16', '16:9', undefined]) {
      const result = await openaiImagesAdapter.generateImage!({ providerId: 'openai-image', nodeType: 'image', prompt: 'test', params: { ratio } })
      assert.equal(result.result?.imageUrl, 'data:image/png;base64,dGVzdA==')
    }
    assert.deepEqual(payloads.map((payload) => payload.size), model.startsWith('gpt-image')
      ? ['1024x1024', '1024x1536', '1536x1024', '1536x1024']
      : ['1024x1024', '1024x1792', '1792x1024', '1792x1024'])
    for (const payload of payloads) {
      assert.equal(payload.model, model)
      assert.equal(payload.n, 1)
      assert.equal(payload.response_format, model.startsWith('gpt-image') ? undefined : 'url')
    }
  })
}

for (const kind of ['image', 'text'] as const) {
  for (const status of [200, 429]) {
    test(`${kind} deadline covers a stalled HTTP ${status} response body without retrying`, async () => {
      let signal: AbortSignal | null | undefined
      let calls = 0
      let finishBody: (() => void) | undefined
      globalThis.fetch = async (_url, init) => {
        calls++
        signal = init?.signal
        return new Response(new ReadableStream({
          start(controller) {
            signal?.addEventListener('abort', () => controller.error(signal?.reason), { once: true })
            finishBody = () => controller.close()
          },
        }), { status })
      }
      const pending = kind === 'image'
        ? openaiImagesAdapter.generateImage!({ providerId: 'openai-image', nodeType: 'image', prompt: 'test' })
        : openaiTextAdapter.generateText!({ providerId: 'openai-text', nodeType: 'text', prompt: 'test' })
      const outcome = pending.then(() => null, (error: unknown) => error)
      await new Promise((resolve) => setTimeout(resolve, 60))
      const aborted = signal?.aborted
      if (!aborted) finishBody?.()
      const error = await outcome
      assert.equal(aborted, true, 'deadline must remain active while consuming the body')
      assert.ok(error instanceof Error && error.name === 'AbortError')
      assert.equal(calls, 1)
    })
  }
}

test('completed responses clear their deadline and preserve HTTP error mapping', async () => {
  let signal: AbortSignal | null | undefined
  globalThis.fetch = async (_url, init) => {
    signal = init?.signal
    return Response.json({ error: { message: 'test quota' } }, { status: 429 })
  }
  await assert.rejects(openaiImagesAdapter.generateImage!({ providerId: 'openai-image', nodeType: 'image', prompt: 'test' }), { code: 'OPENAI_RATE_LIMITED' })
  await new Promise((resolve) => setTimeout(resolve, 40))
  assert.equal(signal?.aborted, false)
})

test('default image model and URL responses are preserved', async () => {
  globalThis.fetch = async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).model, 'gpt-image-1')
    return Response.json({ data: [{ url: 'https://example.test/image.png' }] })
  }
  const result = await openaiImagesAdapter.generateImage!({ providerId: 'openai-image', nodeType: 'image', prompt: 'test', params: { ratio: '1:1' } })
  assert.equal(result.result?.imageUrl, 'https://example.test/image.png')
})

for (const kind of ['image', 'text'] as const) {
  test(`${kind} distinguishes insufficient quota from rate limiting on HTTP 429`, async () => {
    for (const upstreamCode of ['insufficient_quota', 'rate_limit_exceeded']) {
      globalThis.fetch = async () => Response.json({ error: { code: upstreamCode, message: 'test provider error' } }, { status: 429 })
      const pending = kind === 'image'
        ? openaiImagesAdapter.generateImage!({ providerId: 'openai-image', nodeType: 'image', prompt: 'test' })
        : openaiTextAdapter.generateText!({ providerId: 'openai-text', nodeType: 'text', prompt: 'test' })
      if (upstreamCode === 'insufficient_quota') {
        const result = await pending
        assert.equal(result.success, false)
        assert.equal(result.errorCode, 'OPENAI_INSUFFICIENT_QUOTA')
      } else {
        await assert.rejects(pending, { code: 'OPENAI_RATE_LIMITED' })
      }
    }
  })
}
