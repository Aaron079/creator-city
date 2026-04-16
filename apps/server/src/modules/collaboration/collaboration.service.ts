import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getMyInvitations(userId: string) {
    return this.prisma.invitation.findMany({
      where: { toId: userId, status: 'PENDING' },
      include: {
        from: { select: { id: true, username: true, displayName: true } },
        project: { select: { id: true, title: true, type: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getSentInvitations(userId: string) {
    return this.prisma.invitation.findMany({
      where: { fromId: userId },
      include: {
        to: { select: { id: true, username: true, displayName: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async declineInvitation(userId: string, invitationId: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { id: invitationId } })
    if (!inv) throw new NotFoundException()
    if (inv.toId !== userId) throw new ForbiddenException()

    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'DECLINED' },
    })

    await this.notifications.create(inv.fromId, 'COLLAB_REQUEST', {
      title: 'Invitation Declined',
      body: 'Your collaboration invitation was declined.',
      data: { invitationId, projectId: inv.projectId },
    })

    return updated
  }

  async getCollaborators(userId: string) {
    // Users who have shared projects with me
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId, isActive: true },
      select: { projectId: true },
    })

    const projectIds = memberships.map((m) => m.projectId)

    return this.prisma.projectMember.findMany({
      where: {
        projectId: { in: projectIds },
        isActive: true,
        NOT: { userId },
      },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        project: { select: { id: true, title: true } },
      },
      distinct: ['userId'],
    })
  }
}
