import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class LandsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapOwner<T extends { profile?: { avatarUrl: string | null } | null }>(owner: T) {
    return {
      ...owner,
      avatarUrl: owner.profile?.avatarUrl ?? null,
    }
  }

  async getMyLand(userId: string) {
    const land = await this.prisma.land.findUnique({
      where: { ownerId: userId },
      include: {
        buildings: { include: { agents: { select: { id: true, name: true, role: true, status: true } } } },
        agents: { select: { id: true, name: true, role: true, status: true, level: true } },
        owner: { select: { id: true, username: true, displayName: true, reputation: true, level: true } },
      },
    })
    if (!land) throw new NotFoundException('Land not found — you may need to complete onboarding')
    return land
  }

  async getLandById(id: string) {
    const land = await this.prisma.land.findUnique({
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
    if (!land) throw new NotFoundException('Land not found')
    return {
      ...land,
      owner: this.mapOwner(land.owner),
    }
  }

  async updateLand(userId: string, data: { name?: string; description?: string }) {
    const land = await this.prisma.land.findUnique({ where: { ownerId: userId } })
    if (!land) throw new NotFoundException('Land not found')
    return this.prisma.land.update({ where: { id: land.id }, data })
  }

  async getCityMap(zoneId = 'zone-1', limit = 100) {
    const lands = await this.prisma.land.findMany({
      where: { zoneId, isPublic: true },
      take: limit,
      orderBy: { reputation: 'desc' },
      select: {
        id: true,
        name: true,
        positionX: true,
        positionY: true,
        tier: true,
        reputation: true,
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profile: { select: { avatarUrl: true } },
          },
        },
        buildings: { select: { type: true, currentLevel: true } },
      },
    })

    return lands.map((land) => ({
      ...land,
      owner: this.mapOwner(land.owner),
    }))
  }

  /** Called during user registration to provision a starter land */
  async provisionStarterLand(userId: string, displayName: string) {
    return this.prisma.land.create({
      data: {
        ownerId: userId,
        name: `${displayName}'s Base`,
        positionX: Math.random() * 800 - 400,
        positionY: Math.random() * 800 - 400,
        buildings: {
          create: [
            { type: 'STUDIO', name: 'Starter Studio', currentLevel: 1 },
            { type: 'OFFICE', name: 'Operations', currentLevel: 1 },
          ],
        },
      },
    })
  }
}
