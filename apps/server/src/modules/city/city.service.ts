import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class CityService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyBase(userId: string) {
    const base = await this.prisma.cityBase.findUnique({
      where: { ownerId: userId },
      include: { buildings: true, agents: true },
    })
    if (!base) throw new NotFoundException('City base not found')
    return base
  }

  async getBaseById(id: string) {
    const base = await this.prisma.cityBase.findUnique({
      where: { id },
      include: {
        buildings: true,
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, reputation: true },
        },
      },
    })
    if (!base) throw new NotFoundException('City base not found')
    return base
  }

  async updateBase(userId: string, data: { name?: string; description?: string }) {
    const base = await this.prisma.cityBase.findUnique({ where: { ownerId: userId } })
    if (!base) throw new NotFoundException('City base not found')

    return this.prisma.cityBase.update({
      where: { id: base.id },
      data,
    })
  }

  async upgradeBuilding(userId: string, buildingId: string) {
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
      include: { base: true },
    })

    if (!building) throw new NotFoundException('Building not found')
    if (building.base.ownerId !== userId) throw new ForbiddenException()
    if (building.level >= 5) throw new ForbiddenException('Building already at max level')

    return this.prisma.building.update({
      where: { id: buildingId },
      data: { level: building.level + 1 },
    })
  }

  async addBuilding(
    userId: string,
    data: { type: string; name: string; positionX: number; positionY: number },
  ) {
    const base = await this.prisma.cityBase.findUnique({ where: { ownerId: userId } })
    if (!base) throw new NotFoundException('City base not found')

    return this.prisma.building.create({
      data: {
        baseId: base.id,
        type: data.type as never,
        name: data.name,
        positionX: data.positionX,
        positionY: data.positionY,
        level: 1,
      },
    })
  }

  async getCityMap(zoneId = 'default') {
    return this.prisma.cityBase.findMany({
      where: { zoneId },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, reputation: true },
        },
        buildings: { select: { type: true, level: true } },
      },
      orderBy: { reputation: 'desc' },
      take: 100,
    })
  }
}
