import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { runAuthDbOperationWithRetry } from './login-db-retry'

function prismaPoolTimeout() {
  return Object.assign(new Error('Timed out fetching a new connection from the connection pool.'), {
    code: 'P2024',
  })
}

describe('runAuthDbOperationWithRetry', () => {
  test('retries transient auth database failures before succeeding', async () => {
    let calls = 0

    const result = await runAuthDbOperationWithRetry(
      'login:userLookup',
      async () => {
        calls += 1
        if (calls < 3) throw prismaPoolTimeout()
        return { id: 'user-1' }
      },
      { retryDelaysMs: [0, 0] },
    )

    assert.deepEqual(result, { id: 'user-1' })
    assert.equal(calls, 3)
  })

  test('does not retry non database failures', async () => {
    let calls = 0
    const error = new Error('bad json')

    await assert.rejects(
      runAuthDbOperationWithRetry(
        'login:parse',
        async () => {
          calls += 1
          throw error
        },
        { retryDelaysMs: [0, 0] },
      ),
      error,
    )

    assert.equal(calls, 1)
  })
})
