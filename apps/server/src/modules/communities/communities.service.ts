import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Communities ───────────────────────────────────────────────────────────

  async findAll(options: { type?: string; limit?: number; offset?: number }) {
    const limit = Math.min(options.limit ?? 20, 50)
    const [items, total] = await Promise.all([
      this.prisma.community.findMany({
        where: {
          type: (options.type as never) ?? 'PUBLIC',
        },
        orderBy: { memberCount: 'desc' },
        take: limit,
        skip: options.offset ?? 0,
        include: {
          owner: { select: { id: true, username: true, displayName: true } },
          _count: { select: { posts: true } },
        },
      }),
      this.prisma.community.count({ where: { type: (options.type as never) ?? 'PUBLIC' } }),
    ])
    return { items, total }
  }

  async findById(id: string) {
    const c = await this.prisma.community.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
        _count: { select: { posts: true } },
      },
    })
    if (!c) throw new NotFoundException('Community not found')
    return c
  }

  async create(userId: string, data: { name: string; description?: string; type?: string; tags?: string[] }) {
    return this.prisma.community.create({
      data: {
        ownerId: userId,
        name: data.name,
        description: data.description,
        type: (data.type ?? 'PUBLIC') as never,
        tags: data.tags ?? [],
      },
    })
  }

  // ─── Posts ─────────────────────────────────────────────────────────────────

  async getPosts(communityId: string, options: { limit?: number; offset?: number }) {
    const limit = Math.min(options.limit ?? 20, 50)
    const [items, total] = await Promise.all([
      this.prisma.communityPost.findMany({
        where: { communityId },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: options.offset ?? 0,
        include: {
          author: { select: { id: true, username: true, displayName: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.communityPost.count({ where: { communityId } }),
    ])
    return { items, total }
  }

  async createPost(
    userId: string,
    communityId: string,
    data: { title: string; content: string; type?: string; tags?: string[]; mediaUrls?: string[] },
  ) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } })
    if (!community) throw new NotFoundException('Community not found')

    const post = await this.prisma.communityPost.create({
      data: {
        communityId,
        authorId: userId,
        title: data.title,
        content: data.content,
        type: (data.type ?? 'TEXT') as never,
        tags: data.tags ?? [],
        mediaUrls: data.mediaUrls ?? [],
      },
      include: { author: { select: { id: true, username: true, displayName: true } } },
    })

    await this.prisma.community.update({
      where: { id: communityId },
      data: { memberCount: { increment: 0 } }, // trigger updatedAt
    })

    return post
  }

  async getPostComments(postId: string, options: { limit?: number }) {
    return this.prisma.communityComment.findMany({
      where: { postId, parentId: null },
      orderBy: { createdAt: 'asc' },
      take: Math.min(options.limit ?? 50, 100),
      include: {
        author: { select: { id: true, username: true, displayName: true } },
        replies: {
          include: { author: { select: { id: true, username: true, displayName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
  }

  async addComment(
    userId: string,
    postId: string,
    content: string,
    parentId?: string,
  ) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } })
    if (!post) throw new NotFoundException('Post not found')

    const comment = await this.prisma.communityComment.create({
      data: { postId, authorId: userId, content, parentId },
      include: { author: { select: { id: true, username: true, displayName: true } } },
    })

    await this.prisma.communityPost.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    })

    return comment
  }

  async deletePost(userId: string, postId: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      include: { community: true },
    })
    if (!post) throw new NotFoundException()
    const isOwner = post.authorId === userId || post.community.ownerId === userId
    if (!isOwner) throw new ForbiddenException()

    return this.prisma.communityPost.delete({ where: { id: postId } })
  }
}
