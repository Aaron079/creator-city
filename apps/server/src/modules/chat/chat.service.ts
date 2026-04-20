import { Injectable, NotFoundException } from '@nestjs/common'
import { CommunityType, PostType } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  private mapMessage(
    post: {
      id: string
      communityId: string
      authorId: string
      content: string
      type: PostType
      createdAt: Date
      author: {
        id: string
        username: string
        displayName: string
        profile: { avatarUrl: string | null } | null
      }
    },
  ) {
    return {
      id: post.id,
      channelId: post.communityId,
      senderId: post.authorId,
      senderName: post.author.displayName || post.author.username,
      content: post.content,
      type: post.type === 'TEXT' ? 'TEXT' : 'MEDIA',
      timestamp: post.createdAt,
      sender: {
        id: post.author.id,
        username: post.author.username,
        displayName: post.author.displayName,
        avatarUrl: post.author.profile?.avatarUrl ?? null,
      },
    }
  }

  async getOrCreateChannel(name: string, type = 'PUBLIC', projectId?: string) {
    const communityType = type === 'PUBLIC' ? CommunityType.PUBLIC : CommunityType.PRIVATE
    const projectTag = projectId ? `project:${projectId}` : null

    let channel = await this.prisma.community.findFirst({
      where: projectTag
        ? { tags: { has: projectTag } }
        : { name, type: communityType },
    })

    if (!channel) {
      const fallbackOwner = await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true },
      })

      if (!fallbackOwner) {
        throw new NotFoundException('No community owner available')
      }

      channel = await this.prisma.community.create({
        data: {
          name,
          type: communityType,
          ownerId: fallbackOwner.id,
          tags: projectTag ? [projectTag] : [],
        },
      })
    }

    return channel
  }

  async sendMessage(channelId: string, senderId: string, content: string, type = 'TEXT') {
    const channel = await this.prisma.community.findUnique({ where: { id: channelId } })
    if (!channel) throw new NotFoundException('Channel not found')

    const postType = type === 'TEXT' ? PostType.TEXT : PostType.IMAGE

    const message = await this.prisma.communityPost.create({
      data: {
        communityId: channelId,
        authorId: senderId,
        title: content.slice(0, 80) || 'Message',
        content,
        type: postType,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
    })

    return this.mapMessage(message)
  }

  async getMessages(channelId: string, options: { limit?: number; before?: string }) {
    const limit = Math.min(options.limit ?? 50, 100)

    const messages = await this.prisma.communityPost.findMany({
      where: {
        communityId: channelId,
        ...(options.before && { id: { lt: options.before } }),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return messages.map((message) => this.mapMessage(message))
  }

  async getPublicChannels() {
    const channels = await this.prisma.community.findMany({
      where: { type: CommunityType.PUBLIC },
      include: { _count: { select: { posts: true } } },
    })

    return channels.map((channel) => ({
      ...channel,
      _count: { messages: channel._count.posts },
    }))
  }
}
