import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
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

  private toInputJsonValue(value: unknown): Prisma.InputJsonValue | null {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value
    }

    if (value === null) {
      return null
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.toInputJsonValue(item))
    }

    if (typeof value === 'object') {
      const result: Record<string, Prisma.InputJsonValue | null> = {}
      for (const [key, item] of Object.entries(value)) {
        result[key] = this.toInputJsonValue(item)
      }
      return result
    }

    return String(value)
  }

  private toInputJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
    const result: Record<string, Prisma.InputJsonValue | null> = {}

    for (const [key, item] of Object.entries(value)) {
      result[key] = this.toInputJsonValue(item)
    }

    return result
  }

  async create(userId: string, type: NotificationType, input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title: input.title,
        body: input.body,
        ...(input.data !== undefined && { data: this.toInputJsonObject(input.data) }),
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
