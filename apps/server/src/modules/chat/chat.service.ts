import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateChannel(name: string, type = 'PUBLIC', projectId?: string) {
    let channel = await this.prisma.chatChannel.findFirst({
      where: projectId ? { projectId } : { name, type },
    })

    if (!channel) {
      channel = await this.prisma.chatChannel.create({
        data: { name, type, projectId },
      })
    }

    return channel
  }

  async sendMessage(channelId: string, senderId: string, content: string, type = 'TEXT') {
    const channel = await this.prisma.chatChannel.findUnique({ where: { id: channelId } })
    if (!channel) throw new NotFoundException('Channel not found')

    return this.prisma.chatMessage.create({
      data: { channelId, senderId, content, type },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    })
  }

  async getMessages(channelId: string, options: { limit?: number; before?: string }) {
    const limit = Math.min(options.limit ?? 50, 100)

    return this.prisma.chatMessage.findMany({
      where: {
        channelId,
        ...(options.before && { id: { lt: options.before } }),
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async getPublicChannels() {
    return this.prisma.chatChannel.findMany({
      where: { type: 'PUBLIC' },
      include: { _count: { select: { messages: true } } },
    })
  }
}
