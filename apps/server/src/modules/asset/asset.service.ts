import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: {
    name: string
    type: string
    url: string
    mimeType: string
    sizeBytes: number
    projectId?: string
    tags?: string[]
    metadata?: Record<string, unknown>
  }) {
    return this.prisma.asset.create({
      data: {
        ownerId: userId,
        name: data.name,
        type: data.type as never,
        url: data.url,
        mimeType: data.mimeType,
        sizeBytes: BigInt(data.sizeBytes),
        status: 'READY',
        projectId: data.projectId,
        tags: data.tags ?? [],
        metadata: data.metadata ?? {},
      },
    })
  }

  async findByUser(userId: string) {
    return this.prisma.asset.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findByProject(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [{ ownerId: userId }, { collaborators: { some: { userId } } }, { visibility: 'PUBLIC' }],
      },
    })
    if (!project) throw new ForbiddenException()

    return this.prisma.asset.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } })
  }

  async delete(userId: string, assetId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } })
    if (!asset) throw new NotFoundException('Asset not found')
    if (asset.ownerId !== userId) throw new ForbiddenException()

    return this.prisma.asset.delete({ where: { id: assetId } })
  }
}
