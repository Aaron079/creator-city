import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Agent CRUD ────────────────────────────────────────────────────

  async getMyAgents(userId: string) {
    return this.prisma.agent.findMany({
      where: { ownerId: userId },
      include: { tasks: { where: { status: 'IN_PROGRESS' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async hireAgent(userId: string, data: { name: string; role: string; baseId: string }) {
    // Verify user owns the base
    const base = await this.prisma.cityBase.findFirst({
      where: { id: data.baseId, ownerId: userId },
    })
    if (!base) throw new ForbiddenException('You do not own this base')

    return this.prisma.agent.create({
      data: {
        ownerId: userId,
        baseId: data.baseId,
        name: data.name,
        role: data.role as never,
        tier: 'BASIC',
        status: 'IDLE',
        personality: {
          creativity: Math.floor(Math.random() * 40) + 60,
          efficiency: Math.floor(Math.random() * 40) + 60,
          collaboration: Math.floor(Math.random() * 40) + 60,
          ambition: Math.floor(Math.random() * 40) + 60,
        },
      },
    })
  }

  async getAgent(userId: string, agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
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
        OR: [{ ownerId: userId }, { collaborators: { some: { userId } } }],
      },
    })
    if (!project) throw new NotFoundException('Project not found or no access')

    const estimatedMs = this.estimateDuration(taskType)

    const [task] = await this.prisma.$transaction([
      this.prisma.agentTask.create({
        data: {
          agentId,
          projectId,
          type: taskType,
          status: 'IN_PROGRESS',
          input,
          startedAt: new Date(),
          estimatedDurationMs: estimatedMs,
        },
      }),
      this.prisma.agent.update({
        where: { id: agentId },
        data: { status: 'WORKING' },
      }),
    ])

    // Schedule task completion (simplified — production would use a queue)
    setTimeout(() => this.completeTask(task.id, agentId), estimatedMs)

    return task
  }

  async completeTask(taskId: string, agentId: string) {
    const task = await this.prisma.agentTask.findUnique({ where: { id: taskId } })
    if (!task || task.status !== 'IN_PROGRESS') return

    const output = this.simulateOutput(task.type)
    const now = new Date()
    const actualMs = task.startedAt ? now.getTime() - task.startedAt.getTime() : task.estimatedDurationMs

    await this.prisma.$transaction([
      this.prisma.agentTask.update({
        where: { id: taskId },
        data: { status: 'COMPLETED', output, completedAt: now, actualDurationMs: actualMs },
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

    return this.prisma.agentTask.findMany({
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

  private simulateOutput(taskType: string): Record<string, unknown> {
    return {
      taskType,
      completedAt: new Date().toISOString(),
      result: `${taskType} completed successfully`,
      quality: Math.floor(Math.random() * 30) + 70,
    }
  }
}
