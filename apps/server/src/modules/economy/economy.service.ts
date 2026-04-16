import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

type TxType = 'CREDIT' | 'DEBIT' | 'REWARD' | 'PURCHASE' | 'UPGRADE' | 'WITHDRAWAL' | 'FEE' | 'REFUND'

@Injectable()
export class EconomyService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string) {
    let wallet = await this.prisma.economyWallet.findUnique({ where: { userId } })
    if (!wallet) {
      // auto-create on first access
      wallet = await this.prisma.economyWallet.create({
        data: { userId, balance: 1000 }, // starter credits
      })
    }
    return wallet
  }

  async getTransactions(userId: string, options: { limit?: number; offset?: number; type?: string }) {
    const wallet = await this.getWallet(userId)
    const limit = Math.min(options.limit ?? 20, 100)

    const [items, total] = await Promise.all([
      this.prisma.economyTransaction.findMany({
        where: {
          walletId: wallet.id,
          ...(options.type && { type: options.type as never }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: options.offset ?? 0,
      }),
      this.prisma.economyTransaction.count({ where: { walletId: wallet.id } }),
    ])

    return { items, total, wallet }
  }

  async credit(
    userId: string,
    amount: number,
    description: string,
    type: TxType = 'REWARD',
    refType?: string,
    refId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive')
    const wallet = await this.getWallet(userId)

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.economyWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount }, totalEarned: { increment: amount } },
      })
      return tx.economyTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          status: 'COMPLETED',
          amount,
          balanceBefore: wallet.balance,
          balanceAfter: updated.balance,
          description,
          refType,
          refId,
        },
      })
    })
  }

  async debit(
    userId: string,
    amount: number,
    description: string,
    type: TxType = 'PURCHASE',
    refType?: string,
    refId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive')
    const wallet = await this.getWallet(userId)
    if (wallet.balance < amount) {
      throw new BadRequestException(`Insufficient credits (need ${amount}, have ${wallet.balance})`)
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.economyWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount }, totalSpent: { increment: amount } },
      })
      return tx.economyTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          status: 'COMPLETED',
          amount: -amount,
          balanceBefore: wallet.balance,
          balanceAfter: updated.balance,
          description,
          refType,
          refId,
        },
      })
    })
  }
}
