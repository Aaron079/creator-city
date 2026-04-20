import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface RunTaskInput {
  agentId: string
  projectId: string
  taskId: string  // existing ProjectTask id
  instructions?: string
}

export interface RunTaskResult {
  taskId: string
  agentId: string
  status: 'queued' | 'started'
  estimatedMs: number
}

const TASK_DURATIONS: Record<string, number> = {
  WRITE_SCRIPT:      30_000,
  GENERATE_OUTLINE:  15_000,
  COMPOSE_MUSIC:     45_000,
  EDIT_VIDEO:        60_000,
  CREATE_VFX:        90_000,
  MARKET_ANALYSIS:   20_000,
  RESEARCH:          25_000,
  REVIEW:            10_000,
  GENERIC:           20_000,
}

@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name)

  constructor(private readonly prisma: PrismaService) {}

  /** Assign an agent to an existing project task */
  async runTask(userId: string, input: RunTaskInput): Promise<RunTaskResult> {
    const agent = await this.prisma.agent.findUnique({ where: { id: input.agentId } })
    if (!agent) throw new NotFoundException('Agent not found')
    if (agent.ownerId !== userId) throw new ForbiddenException()
    if (agent.status !== 'IDLE') throw new BadRequestException(`Agent is ${agent.status}, not IDLE`)

    const task = await this.prisma.projectTask.findUnique({ where: { id: input.taskId } })
    if (!task) throw new NotFoundException('Task not found')
    if (task.projectId !== input.projectId) throw new BadRequestException('Task/project mismatch')

    const estimatedMs = TASK_DURATIONS['GENERIC'] ?? 20_000

    await this.prisma.$transaction([
      this.prisma.projectTask.update({
        where: { id: input.taskId },
        data: { status: 'IN_PROGRESS', agentId: input.agentId },
      }),
      this.prisma.agent.update({
        where: { id: input.agentId },
        data: { status: 'WORKING' },
      }),
    ])

    // Schedule completion (in production use BullMQ / jobs)
    setTimeout(() => this.completeTask(input.taskId, input.agentId), estimatedMs)
    this.logger.log(`Agent ${agent.name} started task ${input.taskId}`)

    return { taskId: input.taskId, agentId: input.agentId, status: 'started', estimatedMs }
  }

  async completeTask(taskId: string, agentId: string) {
    const task = await this.prisma.projectTask.findUnique({ where: { id: taskId } })
    if (!task || task.status !== 'IN_PROGRESS') return

    await this.prisma.$transaction([
      this.prisma.projectTask.update({
        where: { id: taskId },
        data: { status: 'REVIEW', completedAt: new Date() },
      }),
      this.prisma.agent.update({
        where: { id: agentId },
        data: { status: 'IDLE', experience: { increment: 50 } },
      }),
      this.prisma.agentGrowth.create({
        data: {
          agentId,
          xpGained: 50,
          tasksCompleted: 1,
        },
      }),
    ])

    this.logger.log(`Agent ${agentId} completed task ${taskId}`)
  }

  async getActiveTasksForProject(projectId: string) {
    return this.prisma.projectTask.findMany({
      where: { projectId, status: 'IN_PROGRESS', agentId: { not: null } },
      include: {
        agent: { select: { id: true, name: true, role: true, status: true } },
      },
    })
  }

  async cancelTask(userId: string, taskId: string) {
    const task = await this.prisma.projectTask.findUnique({
      where: { id: taskId },
      include: { project: true },
    })
    if (!task) throw new NotFoundException('Task not found')
    if (task.project.ownerId !== userId) throw new ForbiddenException()
    if (task.status !== 'IN_PROGRESS') throw new BadRequestException('Task is not in progress')

    const updates: Promise<unknown>[] = [
      this.prisma.projectTask.update({
        where: { id: taskId },
        data: { status: 'TODO', agentId: null },
      }),
    ]

    if (task.agentId) {
      updates.push(
        this.prisma.agent.update({
          where: { id: task.agentId },
          data: { status: 'IDLE' },
        }),
      )
    }

    await Promise.all(updates)
    return { cancelled: true, taskId }
  }
}
