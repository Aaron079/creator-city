import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CreditsService } from './credits.service'
import { PrismaService } from '../../prisma/prisma.service'

test('legacy server cannot create new credit obligations or seed sale packages', async () => {
  let calls = 0
  const unexpected = async () => { calls++; throw new Error('database must not be called') }
  const service = new CreditsService({ userCreditWallet: { findUnique: unexpected, upsert: unexpected }, paymentOrder: { create: unexpected }, creditPackage: { findMany: unexpected } } as unknown as PrismaService)
  await assert.rejects(service.freeze('admin', { providerId: 'openai-text', nodeType: 'text', prompt: 'test' }), /积分制度已停用/)
  await assert.rejects(service.createOrder('admin', { packageId: 'old', credits: 20, priceUSD: 1 }), /积分制度已停用/)
  assert.deepEqual(await service.listPackages(), [])
  assert.equal(calls, 0)
})
