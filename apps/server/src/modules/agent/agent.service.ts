import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { AgentRole } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

  private toTaskDescription(taskType: string, input: Record<string, unknown>) {
    return JSON.stringify({ taskType, input })
  }

  private toTaskOutput(taskType: string): Record<string, unknown> {
    return {
      taskType,
      completedAt: new Date().toISOString(),
      result: `${taskType} completed successfully`,
      quality: Math.floor(Math.random() * 30) + 70,
    }
  }

  private ensureAgentRole(role: string): AgentRole {
    if (!Object.values(AgentRole).includes(role as AgentRole)) {
      throw new BadRequestException('Invalid agent role')
    }

    return role as AgentRole
  }

  // ─── Agent CRUD ────────────────────────────────────────────────────

  async getMyAgents(userId: string) {
    return this.prisma.agent.findMany({
      where: { ownerId: userId },
      include: { tasks: { where: { status: 'IN_PROGRESS' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async hireAgent(userId: string, data: { name: string; role: string; baseId: string }) {
    // Verify user owns the land
    const land = await this.prisma.land.findFirst({
      where: { id: data.baseId, ownerId: userId },
    })
    if (!land) throw new ForbiddenException('You do not own this base')

    const role = this.ensureAgentRole(data.role)

    const agent = await this.prisma.agent.create({
      data: {
        ownerId: userId,
        landId: data.baseId,
        name: data.name,
        role,
        tier: 'BASIC',
        status: 'IDLE',
      },
    })

    await this.prisma.agentProfile.upsert({
      where: { agentId: agent.id },
      update: {
        specialties: [role.toLowerCase()],
        traits: {
          creativity: Math.floor(Math.random() * 40) + 60,
          efficiency: Math.floor(Math.random() * 40) + 60,
          collaboration: Math.floor(Math.random() * 40) + 60,
          ambition: Math.floor(Math.random() * 40) + 60,
        },
      },
      create: {
        agentId: agent.id,
        specialties: [role.toLowerCase()],
        traits: {
          creativity: Math.floor(Math.random() * 40) + 60,
          efficiency: Math.floor(Math.random() * 40) + 60,
          collaboration: Math.floor(Math.random() * 40) + 60,
          ambition: Math.floor(Math.random() * 40) + 60,
        },
      },
    })

    return agent
  }

  async getAgent(userId: string, agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        profile: true,
        tasks: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!agent) throw new NotFoundException('Agent not found')
    if (agent.ownerId !== userId) throw new ForbiddenException()
    return agent
  }

  // ─── Task Assignment ───────────────────────────────────────────────

  async assignTask(
    userId: string,
    agentId: string,
    projectId: string,
    taskType: string,
    input: Record<string, unknown>,
  ) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) throw new NotFoundException('Agent not found')
    if (agent.ownerId !== userId) throw new ForbiddenException()
    if (agent.status !== 'IDLE') {
      throw new BadRequestException('Agent is not available (not IDLE)')
    }

    // Verify access to project
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId, isActive: true } } },
        ],
      },
    })
    if (!project) throw new NotFoundException('Project not found or no access')

    const estimatedMs = this.estimateDuration(taskType)

    const [task] = await this.prisma.$transaction([
      this.prisma.projectTask.create({
        data: {
          projectId,
          agentId,
          assignedTo: userId,
          title: taskType,
          description: this.toTaskDescription(taskType, input),
          status: 'IN_PROGRESS',
        },
      }),
      this.prisma.agent.update({
        where: { id: agentId },
        data: { status: 'WORKING' },
      }),
    ])

    // Schedule task completion (simplified — production would use a queue)
    setTimeout(() => {
      void this.completeTask(task.id, agentId, taskType)
    }, estimatedMs)

    return task
  }

  async completeTask(taskId: string, agentId: string, taskType: string) {
    const task = await this.prisma.projectTask.findUnique({ where: { id: taskId } })
    if (!task || task.status !== 'IN_PROGRESS') return

    const output = this.toTaskOutput(taskType)
    const completedAt = new Date()
    const outputNote = JSON.stringify(output)

    const nextDescription = task.description
      ? `${task.description}\n\nOutput: ${outputNote}`
      : `Output: ${outputNote}`

    await this.prisma.$transaction([
      this.prisma.projectTask.update({
        where: { id: taskId },
        data: {
          status: 'REVIEW',
          completedAt,
          description: nextDescription,
        },
      }),
      this.prisma.agent.update({
        where: { id: agentId },
        data: { status: 'IDLE', experience: { increment: 50 } },
      }),
    ])
  }

  async getTaskHistory(userId: string, agentId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.ownerId !== userId) throw new ForbiddenException()

    return this.prisma.projectTask.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private estimateDuration(taskType: string): number {
    const durations: Record<string, number> = {
      WRITE_SCRIPT: 30000,
      GENERATE_OUTLINE: 15000,
      COMPOSE_MUSIC: 45000,
      EDIT_VIDEO: 60000,
      CREATE_VFX: 90000,
      MARKET_ANALYSIS: 20000,
      RESEARCH: 25000,
      REVIEW: 10000,
    }
    return durations[taskType] ?? 30000
  }

}
