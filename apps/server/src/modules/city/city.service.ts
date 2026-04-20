import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { BuildingType } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class CityService {
  constructor(private readonly prisma: PrismaService) {}

  private mapBuilding<T extends { currentLevel: number }>(building: T) {
    return {
      ...building,
      level: building.currentLevel,
    }
  }

  private mapOwner<T extends { profile: { avatarUrl: string | null } | null }>(owner: T) {
    return {
      ...owner,
      avatarUrl: owner.profile?.avatarUrl ?? null,
    }
  }

  async getMyBase(userId: string) {
    const base = await this.prisma.land.findUnique({
      where: { ownerId: userId },
      include: { buildings: true, agents: true },
    })
    if (!base) throw new NotFoundException('City base not found')
    return {
      ...base,
      buildings: base.buildings.map((building) => this.mapBuilding(building)),
    }
  }

  async getBaseById(id: string) {
    const base = await this.prisma.land.findUnique({
      where: { id },
      include: {
        buildings: true,
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            reputation: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
    })
    if (!base) throw new NotFoundException('City base not found')
    return {
      ...base,
      owner: this.mapOwner(base.owner),
      buildings: base.buildings.map((building) => this.mapBuilding(building)),
    }
  }

  async updateBase(userId: string, data: { name?: string; description?: string }) {
    const base = await this.prisma.land.findUnique({ where: { ownerId: userId } })
    if (!base) throw new NotFoundException('City base not found')

    return this.prisma.land.update({
      where: { id: base.id },
      data,
    })
  }

  async upgradeBuilding(userId: string, buildingId: string) {
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
      include: { land: { select: { ownerId: true } } },
    })

    if (!building) throw new NotFoundException('Building not found')
    if (building.land.ownerId !== userId) throw new ForbiddenException()
    if (building.currentLevel >= 5) throw new ForbiddenException('Building already at max level')

    return this.prisma.building.update({
      where: { id: buildingId },
      data: { currentLevel: building.currentLevel + 1 },
    })
  }

  async addBuilding(
    userId: string,
    data: { type: string; name: string; positionX: number; positionY: number },
  ) {
    const base = await this.prisma.land.findUnique({ where: { ownerId: userId } })
    if (!base) throw new NotFoundException('City base not found')

    if (!Object.values(BuildingType).includes(data.type as BuildingType)) {
      throw new ForbiddenException('Invalid building type')
    }

    const buildingType = data.type as BuildingType

    return this.prisma.building.create({
      data: {
        landId: base.id,
        type: buildingType,
        name: data.name,
        positionX: data.positionX,
        positionY: data.positionY,
        currentLevel: 1,
      },
    })
  }

  async getCityMap(zoneId = 'zone-1') {
    const bases = await this.prisma.land.findMany({
      where: { zoneId },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            reputation: true,
            profile: { select: { avatarUrl: true } },
          },
        },
        buildings: { select: { type: true, currentLevel: true } },
      },
      orderBy: { reputation: 'desc' },
      take: 100,
    })

    return bases.map((base) => ({
      ...base,
      owner: this.mapOwner(base.owner),
      buildings: base.buildings.map((building) => this.mapBuilding(building)),
    }))
  }
}
