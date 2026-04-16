import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

const UPGRADE_COST_PER_LEVEL: Record<number, number> = {
  1: 500,
  2: 1500,
  3: 4000,
  4: 10000,
  5: 25000,
}

const MAX_LEVEL = 5

@Injectable()
export class BuildingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyBuildings(userId: string) {
    const land = await this.prisma.land.findUnique({ where: { ownerId: userId } })
    if (!land) throw new NotFoundException('Land not found')

    return this.prisma.building.findMany({
      where: { landId: land.id },
      include: {
        levelHistory: { orderBy: { upgradedAt: 'desc' }, take: 5 },
        agents: { select: { id: true, name: true, role: true, status: true } },
      },
    })
  }

  async getBuildingById(id: string) {
    const b = await this.prisma.building.findUnique({
      where: { id },
      include: { levelHistory: true, agents: true },
    })
    if (!b) throw new NotFoundException('Building not found')
    return b
  }

  async upgrade(userId: string, buildingId: string) {
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
      include: { land: true },
    })
    if (!building) throw new NotFoundException('Building not found')
    if (building.land.ownerId !== userId) throw new ForbiddenException()
    if (building.currentLevel >= MAX_LEVEL) {
      throw new BadRequestException('Building is already at max level')
    }

    const cost = UPGRADE_COST_PER_LEVEL[building.currentLevel] ?? 0

    // Check wallet
    const wallet = await this.prisma.economyWallet.findUnique({ where: { userId } })
    if (!wallet || wallet.balance < cost) {
      throw new BadRequestException(`Insufficient credits. Need ${cost}, have ${wallet?.balance ?? 0}`)
    }

    const newLevel = building.currentLevel + 1

    const [upgraded] = await this.prisma.$transaction([
      this.prisma.building.update({
        where: { id: buildingId },
        data: { currentLevel: newLevel, updatedAt: new Date() },
      }),
      this.prisma.buildingLevel.create({
        data: {
          buildingId,
          fromLevel: building.currentLevel,
          toLevel: newLevel,
          upgradedBy: userId,
          costCredits: cost,
        },
      }),
      this.prisma.economyWallet.update({
        where: { userId },
        data: {
          balance: { decrement: cost },
          totalSpent: { increment: cost },
        },
      }),
      this.prisma.economyTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'UPGRADE',
          status: 'COMPLETED',
          amount: -cost,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance - cost,
          description: `Upgraded ${building.name} to level ${newLevel}`,
          refType: 'building',
          refId: buildingId,
        },
      }),
    ])

    return upgraded
  }

  async addBuilding(
    userId: string,
    data: { type: string; name: string; positionX?: number; positionY?: number },
  ) {
    const land = await this.prisma.land.findUnique({ where: { ownerId: userId } })
    if (!land) throw new NotFoundException('Land not found')

    return this.prisma.building.create({
      data: {
        landId: land.id,
        type: data.type as never,
        name: data.name,
        positionX: data.positionX ?? 0,
        positionY: data.positionY ?? 0,
      },
    })
  }
}
