import { BadRequestException } from '@nestjs/common'
import { CreditsService } from './credits.service'

type MockPrismaModel<T extends string> = Record<T, jest.Mock>

type MockPrisma = {
  userCreditWallet: MockPrismaModel<'findUnique' | 'create' | 'update' | 'updateMany'>
  generationJob: MockPrismaModel<'findUnique' | 'findFirst' | 'create' | 'update' | 'updateMany'>
  creditLedger: MockPrismaModel<'create' | 'findFirst'>
  providerCostLedger: MockPrismaModel<'create'>
  paymentOrder: MockPrismaModel<'findUnique' | 'update' | 'updateMany'>
  $transaction: jest.Mock
}

function createMockPrisma(overrides: Record<string, unknown> = {}) {
  const prisma: MockPrisma = {
    userCreditWallet: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    generationJob: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    creditLedger: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    providerCostLedger: {
      create: jest.fn(),
    },
    paymentOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ...overrides,
  } as MockPrisma
  prisma.$transaction = jest.fn(async (callback: (tx: MockPrisma) => unknown) => callback(prisma))
  return prisma
}

function firstCallOrder(mock: jest.Mock) {
  const order = mock.mock.invocationCallOrder[0]
  if (order === undefined) throw new Error('Expected mock to have been called')
  return order
}

describe('CreditsService payment integrity', () => {
  it('fulfills a payment order by atomically claiming PENDING before wallet credit', async () => {
    const prisma = createMockPrisma()
    const order = {
      id: 'order_1',
      userId: 'user_1',
      walletId: 'wallet_1',
      provider: 'stripe',
      currency: 'USD',
      amount: 699,
      credits: 500,
      status: 'PENDING',
      rawNotifyJson: null,
    }

    prisma.paymentOrder.findUnique.mockResolvedValue(order)
    prisma.paymentOrder.updateMany.mockResolvedValue({ count: 1 })
    prisma.userCreditWallet.findUnique.mockResolvedValue({ id: 'wallet_1' })
    prisma.userCreditWallet.update.mockResolvedValue({ id: 'wallet_1', balance: 500 })
    prisma.creditLedger.create.mockResolvedValue({ id: 'ledger_1' })

    const service = new CreditsService(prisma as never)
    await service.fulfillOrder({
      orderId: 'order_1',
      provider: 'stripe',
      currency: 'USD',
      amount: 699,
      credits: 500,
    })

    expect(prisma.paymentOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order_1', status: 'PENDING' },
    }))
    expect(prisma.userCreditWallet.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'wallet_1' },
      data: expect.objectContaining({
        balance: { increment: 500 },
        totalPurchased: { increment: 500 },
      }),
    }))
    expect(prisma.creditLedger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'PURCHASE',
        paymentOrderId: 'order_1',
        delta: 500,
        idempotencyKey: 'payment-order:order_1:fulfill',
      }),
    }))
    expect(prisma.paymentOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        fulfilledAt: expect.any(Date),
      }),
    }))
    expect(firstCallOrder(prisma.paymentOrder.updateMany))
      .toBeLessThan(firstCallOrder(prisma.userCreditWallet.update))
  })

  it('rejects fulfillment mismatches before changing wallet or ledger', async () => {
    const prisma = createMockPrisma()
    prisma.paymentOrder.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'user_1',
      walletId: 'wallet_1',
      provider: 'stripe',
      currency: 'USD',
      amount: 699,
      credits: 500,
      status: 'PENDING',
    })
    prisma.userCreditWallet.findUnique.mockResolvedValue({ id: 'wallet_1' })
    prisma.userCreditWallet.update.mockResolvedValue({ id: 'wallet_1', balance: 500 })
    prisma.paymentOrder.update.mockResolvedValue({ id: 'order_1', status: 'PAID' })
    prisma.creditLedger.create.mockResolvedValue({ id: 'ledger_1' })

    const service = new CreditsService(prisma as never)
    await expect(service.fulfillOrder({
      orderId: 'order_1',
      provider: 'stripe',
      currency: 'USD',
      amount: 123,
      credits: 500,
    })).rejects.toBeInstanceOf(BadRequestException)

    expect(prisma.userCreditWallet.update).not.toHaveBeenCalled()
    expect(prisma.creditLedger.create).not.toHaveBeenCalled()
    expect(prisma.paymentOrder.updateMany).not.toHaveBeenCalled()
  })

  it.each([
    ['provider', { provider: 'paddle', currency: 'USD', amount: 699, credits: 500 }],
    ['currency', { provider: 'stripe', currency: 'CNY', amount: 699, credits: 500 }],
    ['amount', { provider: 'stripe', currency: 'USD', amount: 123, credits: 500 }],
  ])('rejects fulfillment %s mismatch before claiming an order', async (_name, mismatch) => {
    const prisma = createMockPrisma()
    prisma.paymentOrder.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'user_1',
      walletId: 'wallet_1',
      provider: 'stripe',
      currency: 'USD',
      amount: 699,
      credits: 500,
      status: 'PENDING',
    })

    const service = new CreditsService(prisma as never)
    await expect(service.fulfillOrder({
      orderId: 'order_1',
      ...mismatch,
    })).rejects.toBeInstanceOf(BadRequestException)

    expect(prisma.paymentOrder.updateMany).not.toHaveBeenCalled()
    expect(prisma.userCreditWallet.update).not.toHaveBeenCalled()
    expect(prisma.creditLedger.create).not.toHaveBeenCalled()
  })

  it('treats a lost fulfillment claim as idempotent without crediting again', async () => {
    const prisma = createMockPrisma()
    prisma.paymentOrder.findUnique
      .mockResolvedValueOnce({
        id: 'order_1',
        userId: 'user_1',
        walletId: 'wallet_1',
        provider: 'stripe',
        currency: 'USD',
        amount: 699,
        credits: 500,
        status: 'PENDING',
      })
      .mockResolvedValueOnce({ id: 'order_1', status: 'PAID' })
    prisma.paymentOrder.updateMany.mockResolvedValue({ count: 0 })

    const service = new CreditsService(prisma as never)
    await service.fulfillOrder({ orderId: 'order_1' })

    expect(prisma.paymentOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order_1', status: 'PENDING' },
    }))
    expect(prisma.userCreditWallet.update).not.toHaveBeenCalled()
    expect(prisma.creditLedger.create).not.toHaveBeenCalled()
  })

  it('freezes credits with a conditional wallet update to prevent concurrent overdraw', async () => {
    const prisma = createMockPrisma()
    prisma.userCreditWallet.findUnique
      .mockResolvedValueOnce({ id: 'wallet_1', userId: 'user_1', balance: 100, frozenBalance: 0 })
      .mockResolvedValueOnce({ id: 'wallet_1', userId: 'user_1', balance: 0, frozenBalance: 0 })
    prisma.userCreditWallet.updateMany.mockResolvedValue({ count: 0 })
    prisma.userCreditWallet.update.mockResolvedValue({ id: 'wallet_1', balance: 0, frozenBalance: 100 })
    prisma.generationJob.create.mockResolvedValue({ id: 'job_1' })
    prisma.creditLedger.create.mockResolvedValue({ id: 'ledger_1' })

    const service = new CreditsService(prisma as never)
    await expect(service.freeze('user_1', {
      providerId: 'custom-video-gateway',
      nodeType: 'video',
      prompt: 'test',
    })).rejects.toBeInstanceOf(BadRequestException)

    expect(prisma.userCreditWallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'wallet_1', balance: { gte: 100 } },
      data: expect.objectContaining({
        balance: { decrement: 100 },
        frozenBalance: { increment: 100 },
      }),
    }))
    expect(prisma.generationJob.create).not.toHaveBeenCalled()
  })

  it('reuses an existing frozen generation job for the same billingRequestId without reserving twice', async () => {
    const prisma = createMockPrisma()
    prisma.userCreditWallet.findUnique.mockResolvedValue({ id: 'wallet_1', userId: 'user_1', balance: 100, frozenBalance: 20 })
    prisma.generationJob.findFirst.mockResolvedValue({
      id: 'job_existing',
      userId: 'user_1',
      walletId: 'wallet_1',
      providerId: 'openai-images',
      nodeType: 'image',
      projectId: 'project_1',
      nodeId: 'node_1',
      prompt: 'test',
      estimatedCost: 20,
      billingStatus: 'FROZEN',
    })
    prisma.userCreditWallet.updateMany.mockResolvedValue({ count: 1 })
    prisma.generationJob.create.mockResolvedValue({ id: 'job_new' })
    prisma.creditLedger.create.mockResolvedValue({ id: 'ledger_1' })

    const service = new CreditsService(prisma as never)
    const result = await service.freeze('user_1', {
      providerId: 'openai-images',
      nodeType: 'image',
      prompt: 'test',
      projectId: 'project_1',
      nodeId: 'node_1',
      billingRequestId: 'request_1',
    } as never)

    expect(result).toEqual({ jobId: 'job_existing', estimatedCost: 20, balance: 100 })
    expect(prisma.userCreditWallet.updateMany).not.toHaveBeenCalled()
    expect(prisma.generationJob.create).not.toHaveBeenCalled()
    expect(prisma.creditLedger.create).not.toHaveBeenCalled()
  })

  it('settles only by claiming a FROZEN job before wallet mutation', async () => {
    const prisma = createMockPrisma()
    prisma.generationJob.findUnique.mockResolvedValue({
      id: 'job_1',
      userId: 'user_1',
      walletId: 'wallet_1',
      providerId: 'openai-images',
      nodeType: 'image',
      estimatedCost: 20,
      billingStatus: 'FROZEN',
    })
    prisma.userCreditWallet.findUnique.mockResolvedValue({ id: 'wallet_1' })
    prisma.generationJob.updateMany.mockResolvedValue({ count: 1 })
    prisma.userCreditWallet.update.mockResolvedValue({ id: 'wallet_1', balance: 2 })

    const service = new CreditsService(prisma as never)
    await service.settle('job_1', 18)

    expect(prisma.generationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'job_1', billingStatus: 'FROZEN' },
      data: expect.objectContaining({ billingStatus: 'SETTLED', actualCost: 18 }),
    }))
    expect(firstCallOrder(prisma.generationJob.updateMany))
      .toBeLessThan(firstCallOrder(prisma.userCreditWallet.update))
  })

  it('refunds only by claiming a FROZEN job before wallet mutation', async () => {
    const prisma = createMockPrisma()
    prisma.generationJob.findUnique.mockResolvedValue({
      id: 'job_1',
      userId: 'user_1',
      walletId: 'wallet_1',
      providerId: 'openai-images',
      nodeType: 'image',
      estimatedCost: 20,
      billingStatus: 'FROZEN',
    })
    prisma.userCreditWallet.findUnique.mockResolvedValue({ id: 'wallet_1' })
    prisma.generationJob.updateMany.mockResolvedValue({ count: 1 })
    prisma.userCreditWallet.update.mockResolvedValue({ id: 'wallet_1', balance: 20 })

    const service = new CreditsService(prisma as never)
    await service.refund('job_1', 'failed')

    expect(prisma.generationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'job_1', billingStatus: 'FROZEN' },
      data: expect.objectContaining({ billingStatus: 'REFUNDED', errorMessage: 'failed' }),
    }))
    expect(firstCallOrder(prisma.generationJob.updateMany))
      .toBeLessThan(firstCallOrder(prisma.userCreditWallet.update))
  })
})
