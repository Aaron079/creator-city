/**
 * Unit tests for error-normalizer.ts
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/gateway/error-normalizer.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProviderError } from './error-normalizer'

describe('normalizeProviderError', () => {
  test('401 status → PROVIDER_AUTH_FAILED, not retryable', () => {
    const result = normalizeProviderError({ status: 401, message: 'Unauthorized' })
    assert.equal(result.errorCode, 'PROVIDER_AUTH_FAILED')
    assert.equal(result.retryable, false)
  })

  test('403 status → PROVIDER_AUTH_FAILED', () => {
    const result = normalizeProviderError({ status: 403, message: 'Forbidden' })
    assert.equal(result.errorCode, 'PROVIDER_AUTH_FAILED')
  })

  test('message "Invalid API key" → PROVIDER_AUTH_FAILED', () => {
    const result = normalizeProviderError({ message: 'Invalid API key provided' })
    assert.equal(result.errorCode, 'PROVIDER_AUTH_FAILED')
  })

  test('429 status → PROVIDER_RATE_LIMITED, retryable', () => {
    const result = normalizeProviderError({ status: 429, message: 'Too many requests' })
    assert.equal(result.errorCode, 'PROVIDER_RATE_LIMITED')
    assert.equal(result.retryable, true)
  })

  test('message "rate limit exceeded" → PROVIDER_RATE_LIMITED', () => {
    const result = normalizeProviderError({ message: 'Rate limit exceeded' })
    assert.equal(result.errorCode, 'PROVIDER_RATE_LIMITED')
  })

  test('504 status → PROVIDER_TIMEOUT, retryable', () => {
    const result = normalizeProviderError({ status: 504, message: 'Gateway timeout' })
    assert.equal(result.errorCode, 'PROVIDER_TIMEOUT')
    assert.equal(result.retryable, true)
  })

  test('code ETIMEDOUT → PROVIDER_TIMEOUT', () => {
    const result = normalizeProviderError({ code: 'ETIMEDOUT', message: 'connect timed out' })
    assert.equal(result.errorCode, 'PROVIDER_TIMEOUT')
  })

  test('content policy message → PROVIDER_CONTENT_POLICY, not retryable', () => {
    const result = normalizeProviderError({ status: 400, message: 'Content policy violation: NSFW content detected' })
    assert.equal(result.errorCode, 'PROVIDER_CONTENT_POLICY')
    assert.equal(result.retryable, false)
  })

  test('moderation message → PROVIDER_CONTENT_POLICY', () => {
    const result = normalizeProviderError({ message: 'Request rejected by safety moderation system' })
    assert.equal(result.errorCode, 'PROVIDER_CONTENT_POLICY')
  })

  test('insufficient credits message → PROVIDER_INSUFFICIENT_CREDITS', () => {
    const result = normalizeProviderError({ message: 'Insufficient credits to complete this request' })
    assert.equal(result.errorCode, 'PROVIDER_INSUFFICIENT_CREDITS')
    assert.equal(result.retryable, false)
  })

  test('budget exceeded → PROVIDER_BUDGET_EXCEEDED', () => {
    const result = normalizeProviderError({ message: 'Monthly spend limit exceeded for this account' })
    assert.equal(result.errorCode, 'PROVIDER_BUDGET_EXCEEDED')
    assert.equal(result.retryable, false)
  })

  test('not configured message → PROVIDER_NOT_CONFIGURED', () => {
    const result = normalizeProviderError({ message: 'Provider is not configured: missing API key' })
    assert.equal(result.errorCode, 'PROVIDER_NOT_CONFIGURED')
  })

  test('400 bad request → PROVIDER_BAD_REQUEST', () => {
    const result = normalizeProviderError({ status: 400, message: 'Invalid parameter: width must be multiple of 8' })
    assert.equal(result.errorCode, 'PROVIDER_BAD_REQUEST')
  })

  test('cancel message → PROVIDER_TASK_CANCELLED', () => {
    const result = normalizeProviderError({ message: 'Job was cancelled by user' })
    assert.equal(result.errorCode, 'PROVIDER_TASK_CANCELLED')
  })

  test('Error instance → UNKNOWN_PROVIDER_ERROR with message', () => {
    const result = normalizeProviderError(new Error('some unexpected thing happened'))
    assert.equal(result.errorCode, 'UNKNOWN_PROVIDER_ERROR')
    assert.ok(result.message.includes('unexpected'))
  })

  test('null input → UNKNOWN_PROVIDER_ERROR', () => {
    const result = normalizeProviderError(null)
    assert.equal(result.errorCode, 'UNKNOWN_PROVIDER_ERROR')
  })

  test('undefined input → UNKNOWN_PROVIDER_ERROR', () => {
    const result = normalizeProviderError(undefined)
    assert.equal(result.errorCode, 'UNKNOWN_PROVIDER_ERROR')
  })

  test('plain string input → UNKNOWN_PROVIDER_ERROR', () => {
    const result = normalizeProviderError('something went wrong')
    assert.equal(result.errorCode, 'UNKNOWN_PROVIDER_ERROR')
  })
})
