import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { AssetStatus, AssetType, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAssetType(type: string): AssetType {
    return type as AssetType
  }

  private toMetadataJson(metadata?: Record<string, unknown>): Prisma.InputJsonValue {
    return (metadata ?? {}) as Prisma.InputJsonValue
  }

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
    const type = this.ensureAssetType(data.type)

    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          ownerId: userId,
          name: data.name,
          type,
          url: data.url,
          mimeType: data.mimeType,
          sizeBytes: BigInt(data.sizeBytes),
          status: AssetStatus.READY,
          tags: data.tags ?? [],
          metadata: this.toMetadataJson(data.metadata),
        },
      })

      if (data.projectId) {
        await tx.projectAsset.create({
          data: {
            projectId: data.projectId,
            assetId: asset.id,
            addedBy: userId,
          },
        })
      }

      return asset
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
        OR: [
          { ownerId: userId },
          { members: { some: { userId, isActive: true } } },
          { visibility: 'PUBLIC' },
        ],
      },
    })
    if (!project) throw new ForbiddenException()

    return this.prisma.asset.findMany({
      where: { projectAssets: { some: { projectId } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async delete(userId: string, assetId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } })
    if (!asset) throw new NotFoundException('Asset not found')
    if (asset.ownerId !== userId) throw new ForbiddenException()

    return this.prisma.asset.delete({ where: { id: assetId } })
  }
}
