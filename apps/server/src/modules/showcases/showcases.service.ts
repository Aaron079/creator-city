import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ShowcasesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(options: { featured?: boolean; limit?: number; offset?: number }) {
    const limit = Math.min(options.limit ?? 20, 50)
    const [items, total] = await Promise.all([
      this.prisma.showcase.findMany({
        where: { ...(options.featured && { isFeatured: true }) },
        orderBy: [{ isFeatured: 'desc' }, { likes: 'desc' }, { publishedAt: 'desc' }],
        take: limit,
        skip: options.offset ?? 0,
        include: {
          author: { select: { id: true, username: true, displayName: true } },
          project: { select: { id: true, title: true, type: true } },
        },
      }),
      this.prisma.showcase.count(),
    ])
    return { items, total }
  }

  async findById(id: string) {
    const s = await this.prisma.showcase.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, displayName: true } },
        project: { select: { id: true, title: true, type: true, description: true } },
      },
    })
    if (!s) throw new NotFoundException('Showcase not found')
    await this.prisma.showcase.update({ where: { id }, data: { views: { increment: 1 } } })
    return s
  }

  async create(
    userId: string,
    data: {
      projectId: string
      title: string
      description?: string
      thumbnailUrl?: string
      videoUrl?: string
      tags?: string[]
    },
  ) {
    // Verify user owns / is a member of the project
    const membership = await this.prisma.projectMember.findFirst({
      where: { projectId: data.projectId, userId, isActive: true },
    })
    const project = await this.prisma.project.findUnique({ where: { id: data.projectId } })
    if (!project) throw new NotFoundException('Project not found')
    if (project.ownerId !== userId && !membership) throw new ForbiddenException()

    return this.prisma.showcase.create({
      data: {
        projectId: data.projectId,
        authorId: userId,
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        videoUrl: data.videoUrl,
        tags: data.tags ?? [],
      },
      include: {
        author: { select: { id: true, username: true, displayName: true } },
        project: { select: { id: true, title: true, type: true } },
      },
    })
  }

  async like(userId: string, showcaseId: string) {
    return this.prisma.showcase.update({
      where: { id: showcaseId },
      data: { likes: { increment: 1 } },
    })
  }

  async delete(userId: string, showcaseId: string) {
    const s = await this.prisma.showcase.findUnique({ where: { id: showcaseId } })
    if (!s) throw new NotFoundException()
    if (s.authorId !== userId) throw new ForbiddenException()
    return this.prisma.showcase.delete({ where: { id: showcaseId } })
  }
}
