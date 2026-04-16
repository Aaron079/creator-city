import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateProjectDto } from './dto/create-project.dto'

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type as never,
        visibility: (dto.visibility ?? 'PRIVATE') as never,
        tags: dto.tags ?? [],
        genre: dto.genre ?? [],
        ownerId: userId,
        phases: {
          create: [
            { name: 'Development', order: 1 },
            { name: 'Pre-Production', order: 2 },
            { name: 'Production', order: 3 },
            { name: 'Post-Production', order: 4 },
            { name: 'Distribution', order: 5 },
          ],
        },
      },
      include: { phases: true, collaborators: true },
    })
  }

  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } },
        ],
      },
      include: {
        owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        collaborators: { include: { user: { select: { id: true, username: true, displayName: true } } } },
        _count: { select: { assets: true, agentTasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findPublic(options: { type?: string; genre?: string; page?: number; limit?: number }) {
    const page = options.page ?? 1
    const limit = Math.min(options.limit ?? 20, 50)
    const skip = (page - 1) * limit

    const where = {
      visibility: 'PUBLIC' as const,
      status: 'PUBLISHED' as const,
      ...(options.type && { type: options.type as never }),
      ...(options.genre && { genre: { has: options.genre } }),
    }

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { views: 'desc' },
        include: {
          owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ])

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findById(id: string, userId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        collaborators: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        },
        phases: { include: { tasks: true }, orderBy: { order: 'asc' } },
        agentTasks: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })

    if (!project) throw new NotFoundException('Project not found')

    const isOwner = project.ownerId === userId
    const isCollaborator = project.collaborators.some((c) => c.userId === userId)

    if (project.visibility === 'PRIVATE' && !isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project')
    }

    // Increment view count for public projects
    if (project.visibility === 'PUBLIC' && !isOwner) {
      await this.prisma.project.update({ where: { id }, data: { views: { increment: 1 } } })
    }

    return project
  }

  async update(userId: string, id: string, data: Partial<CreateProjectDto> & { status?: string }) {
    const project = await this.prisma.project.findUnique({ where: { id } })
    if (!project) throw new NotFoundException('Project not found')
    if (project.ownerId !== userId) throw new ForbiddenException()

    return this.prisma.project.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.visibility && { visibility: data.visibility as never }),
        ...(data.status && { status: data.status as never }),
        ...(data.tags && { tags: data.tags }),
        ...(data.genre && { genre: data.genre }),
      },
    })
  }

  async inviteCollaborator(ownerId: string, projectId: string, userId: string, role: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new NotFoundException('Project not found')
    if (project.ownerId !== ownerId) throw new ForbiddenException()

    return this.prisma.projectCollaborator.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { role },
      create: { projectId, userId, role, permissions: ['READ', 'WRITE'] },
    })
  }
}
