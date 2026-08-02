import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getOrCreateWalletWithStore } from './server'

describe('getOrCreateWalletWithStore', () => {
  test('returns the concurrently created wallet after a unique create collision', async () => {
    const wallet = {
      id: 'wallet-1',
      userId: 'user-1',
      balance: 0,
      frozenBalance: 0,
      totalPurchased: 0,
      totalConsumed: 0,
    }
    let findUniqueCalls = 0
    const store = {
      upsert: async () => {
        const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
        throw error
      },
      findUnique: async () => {
        findUniqueCalls += 1
        return wallet
      },
    }

    const result = await getOrCreateWalletWithStore(store, wallet.userId)

    assert.equal(result, wallet)
    assert.equal(findUniqueCalls, 1)
  })
})
