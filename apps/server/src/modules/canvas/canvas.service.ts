import { Injectable, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Canvas = shared real-time JSON state attached to a project.
 * Stored in project.metadata (JSON field to be added later) or
 * as a separate Redis key for perf. This service provides the
 * persistence layer and last-written-wins merge.
 *
 * In Phase 2, this will be backed by Redis + socket.io rooms.
 */
@Injectable()
export class CanvasService {
  // In-memory placeholder until Redis integration
  private readonly store = new Map<string, Record<string, unknown>>()

  constructor(private readonly prisma: PrismaService) {}

  private async assertMember(projectId: string, userId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    })
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!member && project?.ownerId !== userId) throw new ForbiddenException('Not a project member')
  }

  async getCanvas(projectId: string, userId: string) {
    await this.assertMember(projectId, userId)
    return {
      projectId,
      canvas: this.store.get(projectId) ?? {},
      updatedAt: new Date().toISOString(),
    }
  }

  async updateCanvas(
    projectId: string,
    userId: string,
    patch: Record<string, unknown>,
  ) {
    await this.assertMember(projectId, userId)
    const current = this.store.get(projectId) ?? {}
    const updated = { ...current, ...patch, _lastEditedBy: userId, _lastEditedAt: new Date().toISOString() }
    this.store.set(projectId, updated)
    return { projectId, canvas: updated }
  }

  async clearCanvas(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (project?.ownerId !== userId) throw new ForbiddenException('Only project owner can clear canvas')
    this.store.delete(projectId)
    return { projectId, cleared: true }
  }
}
