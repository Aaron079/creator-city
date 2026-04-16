import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

type NotificationType =
  | 'COLLAB_REQUEST' | 'PROJECT_UPDATE' | 'AGENT_COMPLETE'
  | 'REPUTATION_GAINED' | 'NEW_FOLLOWER' | 'MESSAGE'
  | 'SYSTEM' | 'INVITATION'

interface CreateNotificationInput {
  title: string
  body: string
  data?: Record<string, unknown>
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, type: NotificationType, input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title: input.title,
        body: input.body,
        data: input.data ?? null,
      },
    })
  }

  async getForUser(userId: string, options: { unreadOnly?: boolean; limit?: number; offset?: number }) {
    const limit = Math.min(options.limit ?? 20, 100)
    const offset = options.offset ?? 0

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          userId,
          ...(options.unreadOnly && { isRead: false }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({
        where: { userId, ...(options.unreadOnly && { isRead: false }) },
      }),
    ])

    return { items, total, unread: await this.countUnread(userId) }
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } })
  }
}
