import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyAgents(userId: string) {
    return this.prisma.agent.findMany({
      where: { ownerId: userId },
      include: {
        profile: true,
        growth: { orderBy: { date: 'desc' }, take: 7 },
        tasks: { where: { status: 'IN_PROGRESS' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async getAgentById(agentId: string, userId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        profile: true,
        growth: { orderBy: { date: 'desc' }, take: 30 },
        tasks: { orderBy: { createdAt: 'desc' }, take: 20 },
        building: { select: { id: true, name: true, type: true } },
      },
    })
    if (!agent) throw new NotFoundException('Agent not found')
    if (agent.ownerId !== userId) throw new ForbiddenException()
    return agent
  }

  async updateProfile(
    userId: string,
    agentId: string,
    data: { bio?: string; avatarUrl?: string; specialties?: string[] },
  ) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) throw new NotFoundException('Agent not found')
    if (agent.ownerId !== userId) throw new ForbiddenException()

    return this.prisma.agentProfile.upsert({
      where: { agentId },
      update: { ...data, updatedAt: new Date() },
      create: { agentId, ...data },
    })
  }

  async hireAgent(
    userId: string,
    data: { name: string; role: string; buildingId?: string },
  ) {
    const land = await this.prisma.land.findUnique({ where: { ownerId: userId } })
    if (!land) throw new NotFoundException('Land not found')

    if (data.buildingId) {
      const building = await this.prisma.building.findFirst({
        where: { id: data.buildingId, landId: land.id },
      })
      if (!building) throw new BadRequestException('Building not found on your land')
    }

    const agent = await this.prisma.agent.create({
      data: {
        ownerId: userId,
        landId: land.id,
        buildingId: data.buildingId,
        name: data.name,
        role: data.role as never,
      },
    })

    // Initialize profile
    await this.prisma.agentProfile.create({
      data: {
        agentId: agent.id,
        specialties: [],
        traits: [
          { name: 'creativity', value: Math.floor(Math.random() * 40) + 60 },
          { name: 'efficiency', value: Math.floor(Math.random() * 40) + 60 },
          { name: 'collaboration', value: Math.floor(Math.random() * 40) + 60 },
          { name: 'ambition', value: Math.floor(Math.random() * 40) + 60 },
        ],
      },
    })

    return agent
  }

  async updateStatus(userId: string, agentId: string, status: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) throw new NotFoundException('Agent not found')
    if (agent.ownerId !== userId) throw new ForbiddenException()

    return this.prisma.agent.update({
      where: { id: agentId },
      data: { status: status as never },
    })
  }

  async getGrowthHistory(userId: string, agentId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.ownerId !== userId) throw new ForbiddenException()

    return this.prisma.agentGrowth.findMany({
      where: { agentId },
      orderBy: { date: 'desc' },
      take: 90,
    })
  }
}
