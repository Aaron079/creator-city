import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type {
  UserCreditWallet,
  CreditLedger,
  CreditPackage,
  PaymentOrder,
  GenerationJob,
  Prisma,
} from '@prisma/client'

// ─── Provider credit costs ────────────────────────────────────────────────────

const PROVIDER_CREDIT_COST: Record<string, number> = {
  'custom-video-gateway': 100,
  runway: 150,
  'openai-images': 20,
  'openai-text': 5,
  'anthropic-claude': 5,
  elevenlabs: 30,
  udio: 40,
  suno: 40,
}

const NODE_TYPE_DEFAULT_COST: Record<string, number> = {
  video: 100,
  image: 20,
  audio: 30,
  music: 40,
  text: 5,
}

// USD cost per generation for admin overview (in cents)
const PROVIDER_USD_COST_CENTS: Record<string, number> = {
  'custom-video-gateway': 0,
  runway: 50,
  'openai-images': 4,
  'openai-text': 1,
  'anthropic-claude': 1,
  elevenlabs: 5,
  udio: 8,
  suno: 8,
}

// ─── Default packages (seeded if none exist) ─────────────────────────────────

const DEFAULT_PACKAGES = [
  {
    id: 'starter_500',
    name: 'Starter 500',
    credits: 500,
    bonusCredits: 0,
    priceUSD: 699,
    priceCNY: 4900,
    prices: [
      { region: 'CN', provider: 'alipay', currency: 'CNY', amount: 4900 },
      { region: 'CN', provider: 'wechat', currency: 'CNY', amount: 4900 },
      { region: 'CN', provider: 'manual', currency: 'CNY', amount: 4900 },
      { region: 'GLOBAL', provider: 'stripe', currency: 'USD', amount: 699 },
      { region: 'GLOBAL', provider: 'paddle', currency: 'USD', amount: 699 },
    ],
    description: '500 Creator City Credits',
    sortOrder: 1,
  },
  {
    id: 'creator_1500',
    name: 'Creator 1500',
    credits: 1300,
    bonusCredits: 200,
    priceUSD: 1499,
    priceCNY: 9900,
    prices: [
      { region: 'CN', provider: 'alipay', currency: 'CNY', amount: 9900 },
      { region: 'CN', provider: 'wechat', currency: 'CNY', amount: 9900 },
      { region: 'CN', provider: 'manual', currency: 'CNY', amount: 9900 },
      { region: 'GLOBAL', provider: 'stripe', currency: 'USD', amount: 1499 },
      { region: 'GLOBAL', provider: 'paddle', currency: 'USD', amount: 1499 },
    ],
    description: '1500 credits including 200 bonus credits',
    sortOrder: 2,
  },
  {
    id: 'studio_5500',
    name: 'Studio 5500',
    credits: 4800,
    bonusCredits: 700,
    priceUSD: 4999,
    priceCNY: 34900,
    prices: [
      { region: 'CN', provider: 'alipay', currency: 'CNY', amount: 34900 },
      { region: 'CN', provider: 'wechat', currency: 'CNY', amount: 34900 },
      { region: 'CN', provider: 'manual', currency: 'CNY', amount: 34900 },
      { region: 'GLOBAL', provider: 'stripe', currency: 'USD', amount: 4999 },
      { region: 'GLOBAL', provider: 'paddle', currency: 'USD', amount: 4999 },
    ],
    description: '5500 credits for production workflows',
    sortOrder: 3,
  },
  {
    id: 'team_15000',
    name: 'Team 15000',
    credits: 12500,
    bonusCredits: 2500,
    priceUSD: 12999,
    priceCNY: 89900,
    prices: [
      { region: 'CN', provider: 'alipay', currency: 'CNY', amount: 89900 },
      { region: 'CN', provider: 'wechat', currency: 'CNY', amount: 89900 },
      { region: 'CN', provider: 'manual', currency: 'CNY', amount: 89900 },
      { region: 'GLOBAL', provider: 'stripe', currency: 'USD', amount: 12999 },
      { region: 'GLOBAL', provider: 'paddle', currency: 'USD', amount: 12999 },
    ],
    description: '15000 credits for team production',
    sortOrder: 4,
  },
  {
    id: 'enterprise_50000',
    name: 'Enterprise 50000',
    credits: 40000,
    bonusCredits: 10000,
    priceUSD: 39999,
    priceCNY: 279900,
    prices: [
      { region: 'CN', provider: 'alipay', currency: 'CNY', amount: 279900 },
      { region: 'CN', provider: 'wechat', currency: 'CNY', amount: 279900 },
      { region: 'CN', provider: 'manual', currency: 'CNY', amount: 279900 },
      { region: 'GLOBAL', provider: 'stripe', currency: 'USD', amount: 39999 },
      { region: 'GLOBAL', provider: 'paddle', currency: 'USD', amount: 39999 },
    ],
    description: '50000 credits for studio-scale generation',
    sortOrder: 5,
  },
]

@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Wallet ──────────────────────────────────────────────────────────────

  async getOrCreateWallet(userId: string): Promise<UserCreditWallet> {
    const existing = await this.prisma.userCreditWallet.findUnique({ where: { userId } })
    if (existing) return existing
    return this.prisma.userCreditWallet.create({ data: { userId } })
  }

  async getWallet(userId: string) {
    const wallet = await this.getOrCreateWallet(userId)
    return {
      balance: wallet.balance,
      frozenBalance: wallet.frozenBalance,
      totalPurchased: wallet.totalPurchased,
      totalConsumed: wallet.totalConsumed,
      availableBalance: wallet.balance,
    }
  }

  // ─── Ledger ───────────────────────────────────────────────────────────────

  async getLedger(userId: string, limit = 20, offset = 0) {
    const wallet = await this.getOrCreateWallet(userId)
    const [items, total] = await Promise.all([
      this.prisma.creditLedger.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      this.prisma.creditLedger.count({ where: { walletId: wallet.id } }),
    ])
    return { items, total, wallet }
  }

  // ─── Cost estimation ──────────────────────────────────────────────────────

  estimateCost(providerId: string, nodeType: string): number {
    return PROVIDER_CREDIT_COST[providerId] ?? NODE_TYPE_DEFAULT_COST[nodeType] ?? 50
  }

  // ─── Freeze credits ───────────────────────────────────────────────────────

  async freeze(
    userId: string,
    input: { providerId: string; nodeType: string; prompt: string; externalJobId?: string },
  ): Promise<{ jobId: string; estimatedCost: number; balance: number }> {
    const wallet = await this.getOrCreateWallet(userId)
    const estimatedCost = this.estimateCost(input.providerId, input.nodeType)

    if (wallet.balance < estimatedCost) {
      throw new BadRequestException(
        `Insufficient credits: need ${estimatedCost}, have ${wallet.balance}. Please purchase more credits.`,
      )
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.userCreditWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: estimatedCost },
          frozenBalance: { increment: estimatedCost },
        },
      })

      const job = await tx.generationJob.create({
        data: {
          userId,
          walletId: wallet.id,
          providerId: input.providerId,
          nodeType: input.nodeType,
          prompt: input.prompt,
          estimatedCost,
          billingStatus: 'FROZEN',
          frozenAt: new Date(),
          externalJobId: input.externalJobId,
        },
      })

      await tx.creditLedger.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'RESERVE',
          delta: -estimatedCost,
          frozen: estimatedCost,
          balance: updated.balance,
          amountCredits: -estimatedCost,
          refType: 'generation_job',
          refId: job.id,
          generationJobId: job.id,
          note: `${input.providerId} / ${input.nodeType} generation`,
          description: `${input.providerId} / ${input.nodeType} generation`,
        },
      })

      return { job, updated }
    })

    return {
      jobId: result.job.id,
      estimatedCost,
      balance: result.updated.balance,
    }
  }

  // ─── Settle credits ───────────────────────────────────────────────────────

  async settle(jobId: string, actualCost?: number): Promise<void> {
    const job = await this.prisma.generationJob.findUnique({ where: { id: jobId } })
    if (!job) throw new NotFoundException(`GenerationJob ${jobId} not found`)
    if (job.billingStatus !== 'FROZEN') return

    const wallet = await this.prisma.userCreditWallet.findUnique({ where: { id: job.walletId! } })
    if (!wallet) throw new NotFoundException('Wallet not found for job')

    const cost = actualCost ?? job.estimatedCost
    const frozenUsed = job.estimatedCost
    const refund = frozenUsed - cost

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.userCreditWallet.update({
        where: { id: wallet.id },
        data: {
          frozenBalance: { decrement: frozenUsed },
          balance: refund > 0 ? { increment: refund } : undefined,
          totalConsumed: { increment: cost },
        },
      })

      await tx.generationJob.update({
        where: { id: jobId },
        data: {
          billingStatus: 'SETTLED',
          actualCost: cost,
          settledAt: new Date(),
        },
      })

      await tx.creditLedger.create({
        data: {
          walletId: wallet.id,
          userId: job.userId,
          type: 'SETTLE',
          delta: refund > 0 ? refund : 0,
          frozen: -frozenUsed,
          balance: updated.balance,
          amountCredits: -cost,
          refType: 'generation_job',
          refId: jobId,
          generationJobId: jobId,
          note: `Settled: ${cost} credits consumed`,
          description: `Settled: ${cost} credits consumed`,
        },
      })

      await tx.providerCostLedger.create({
        data: {
          userId: job.userId,
          generationJobId: jobId,
          providerId: job.providerId,
          jobType: job.nodeType,
          providerCostUsd: ((PROVIDER_USD_COST_CENTS[job.providerId] ?? 0) / 100).toString(),
          providerCostCny: (((PROVIDER_USD_COST_CENTS[job.providerId] ?? 0) / 100) * Number(process.env.USD_CNY_RATE ?? 7.2)).toString(),
          userChargedCredits: cost,
        },
      })
    })
  }

  // ─── Refund credits ───────────────────────────────────────────────────────

  async refund(jobId: string, reason?: string): Promise<void> {
    const job = await this.prisma.generationJob.findUnique({ where: { id: jobId } })
    if (!job) throw new NotFoundException(`GenerationJob ${jobId} not found`)
    if (job.billingStatus !== 'FROZEN') return

    const wallet = await this.prisma.userCreditWallet.findUnique({ where: { id: job.walletId! } })
    if (!wallet) throw new NotFoundException('Wallet not found for job')

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.userCreditWallet.update({
        where: { id: wallet.id },
        data: {
          frozenBalance: { decrement: job.estimatedCost },
          balance: { increment: job.estimatedCost },
        },
      })

      await tx.generationJob.update({
        where: { id: jobId },
        data: {
          billingStatus: 'REFUNDED',
          errorMessage: reason,
        },
      })

      await tx.creditLedger.create({
        data: {
          walletId: wallet.id,
          userId: job.userId,
          type: 'REFUND',
          delta: job.estimatedCost,
          frozen: -job.estimatedCost,
          balance: updated.balance,
          amountCredits: job.estimatedCost,
          refType: 'generation_job',
          refId: jobId,
          generationJobId: jobId,
          note: reason ?? 'Generation failed — credits refunded',
          description: reason ?? 'Generation failed — credits refunded',
        },
      })
    })
  }

  // ─── Update job external ID ───────────────────────────────────────────────

  async updateJobExternalId(jobId: string, externalJobId: string): Promise<void> {
    await this.prisma.generationJob.update({
      where: { id: jobId },
      data: { externalJobId },
    })
  }

  // ─── Packages ─────────────────────────────────────────────────────────────

  async listPackages(): Promise<CreditPackage[]> {
    const packages = await this.prisma.creditPackage.findMany({
      where: { status: 'ACTIVE', isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (packages.length === 0) {
      await this.prisma.creditPackage.createMany({
        data: DEFAULT_PACKAGES,
        skipDuplicates: true,
      })
      return this.prisma.creditPackage.findMany({
        where: { status: 'ACTIVE', isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
    }
    return packages
  }

  async getPackage(packageId: string): Promise<CreditPackage> {
    const pkg = await this.prisma.creditPackage.findUnique({ where: { id: packageId } })
    if (!pkg || pkg.status !== 'ACTIVE' || !pkg.isActive) throw new NotFoundException('Package not found or unavailable')
    return pkg
  }

  // ─── Orders ───────────────────────────────────────────────────────────────

  async createOrder(
    userId: string,
    input: {
      packageId: string
      stripeSessionId?: string
      credits: number
      priceUSD: number
      region?: string
      provider?: string
      currency?: string
      amount?: number
      externalOrderId?: string
    },
  ): Promise<PaymentOrder> {
    const wallet = await this.getOrCreateWallet(userId)
    return this.prisma.paymentOrder.create({
      data: {
        userId,
        walletId: wallet.id,
        packageId: input.packageId,
        stripeSessionId: input.stripeSessionId ?? null,
        credits: input.credits,
        priceUSD: input.priceUSD,
        region: input.region ?? 'GLOBAL',
        provider: input.provider ?? 'stripe',
        currency: input.currency ?? 'USD',
        amount: input.amount ?? input.priceUSD,
        externalOrderId: input.externalOrderId ?? input.stripeSessionId ?? undefined,
        status: 'PENDING',
      },
    })
  }

  async fulfillOrder(input: {
    stripeSessionId?: string
    orderId?: string
    externalOrderId?: string
    stripePaymentIntentId?: string
    externalPaymentId?: string
    rawNotifyJson?: string
  }): Promise<void> {
    const order = input.orderId
      ? await this.prisma.paymentOrder.findUnique({ where: { id: input.orderId } })
      : input.externalOrderId
        ? await this.prisma.paymentOrder.findUnique({ where: { externalOrderId: input.externalOrderId } })
        : input.stripeSessionId
          ? await this.prisma.paymentOrder.findUnique({ where: { stripeSessionId: input.stripeSessionId } })
          : null
    if (!order) throw new NotFoundException('Payment order not found')
    if (order.status === 'PAID') return

    const wallet = await this.prisma.userCreditWallet.findUnique({ where: { id: order.walletId } })
    if (!wallet) throw new NotFoundException('Wallet not found for order')

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.userCreditWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: order.credits },
          totalPurchased: { increment: order.credits },
        },
      })

      await tx.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          stripePaymentIntentId: input.stripePaymentIntentId ?? null,
          externalPaymentId: input.externalPaymentId ?? input.stripePaymentIntentId ?? null,
          rawNotifyJson: input.rawNotifyJson ? JSON.parse(input.rawNotifyJson) as Prisma.InputJsonValue : undefined,
          issuedAt: new Date(),
          paidAt: new Date(),
        },
      })

      await tx.creditLedger.create({
        data: {
          walletId: wallet.id,
          userId: order.userId,
          type: 'PURCHASE',
          delta: order.credits,
          frozen: 0,
          balance: updated.balance,
          amountCredits: order.credits,
          refType: 'payment_order',
          refId: order.id,
          paymentOrderId: order.id,
          note: `Purchased ${order.credits} credits via ${order.provider}`,
          description: `Purchased ${order.credits} credits via ${order.provider}`,
        },
      })
    })
  }

  async failOrder(orderId: string): Promise<void> {
    await this.prisma.paymentOrder.update({ where: { id: orderId }, data: { status: 'FAILED' } })
  }

  // ─── Admin overview ───────────────────────────────────────────────────────

  async getAdminOverview() {
    const [
      totalRevenueCents,
      totalCreditsSold,
      totalCreditsConsumed,
      jobsByProvider,
      recentOrders,
      activeWallets,
    ] = await Promise.all([
      this.prisma.paymentOrder.aggregate({ where: { status: 'PAID' }, _sum: { priceUSD: true } }),
      this.prisma.paymentOrder.aggregate({ where: { status: 'PAID' }, _sum: { credits: true } }),
      this.prisma.generationJob.aggregate({ where: { billingStatus: 'SETTLED' }, _sum: { actualCost: true } }),
      this.prisma.generationJob.groupBy({
        by: ['providerId'],
        where: { billingStatus: 'SETTLED' },
        _count: { id: true },
        _sum: { actualCost: true },
        orderBy: { _sum: { actualCost: 'desc' } },
      }),
      this.prisma.paymentOrder.findMany({
        where: { status: 'PAID' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, userId: true, credits: true, priceUSD: true, issuedAt: true },
      }),
      this.prisma.userCreditWallet.count({ where: { totalPurchased: { gt: 0 } } }),
    ])

    const estimatedCostCents = jobsByProvider.reduce((acc, row) => {
      const unitCost = PROVIDER_USD_COST_CENTS[row.providerId] ?? 0
      return acc + (row._count.id * unitCost)
    }, 0)

    return {
      revenue: {
        totalUSD: (totalRevenueCents._sum.priceUSD ?? 0) / 100,
        totalCents: totalRevenueCents._sum.priceUSD ?? 0,
      },
      credits: {
        totalSold: totalCreditsSold._sum.credits ?? 0,
        totalConsumed: totalCreditsConsumed._sum.actualCost ?? 0,
      },
      cost: {
        estimatedCents: estimatedCostCents,
        estimatedUSD: estimatedCostCents / 100,
      },
      margin: {
        estimatedCents: (totalRevenueCents._sum.priceUSD ?? 0) - estimatedCostCents,
      },
      jobsByProvider: jobsByProvider.map((row) => ({
        providerId: row.providerId,
        count: row._count.id,
        creditsConsumed: row._sum.actualCost ?? 0,
      })),
      recentOrders,
      activeWallets,
    }
  }

  async listAdminOrders(limit = 50) {
    return this.prisma.paymentOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true,
        userId: true,
        packageId: true,
        region: true,
        provider: true,
        status: true,
        amount: true,
        currency: true,
        credits: true,
        externalOrderId: true,
        externalPaymentId: true,
        createdAt: true,
        paidAt: true,
      },
    })
  }

  async listAdminWallets(limit = 50) {
    return this.prisma.userCreditWallet.findMany({
      orderBy: { updatedAt: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true,
        userId: true,
        balance: true,
        frozenBalance: true,
        totalPurchased: true,
        totalConsumed: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }
}
