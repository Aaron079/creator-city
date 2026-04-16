import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(adminUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: adminUserId } })
    if (user?.role !== 'ADMIN') throw new ForbiddenException('Admin only')

    return this.prisma.apiProviderConfig.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, provider: true, model: true,
        isActive: true, isDefault: true, createdAt: true,
        // Never return apiKey
      },
    })
  }

  async findDefault() {
    return this.prisma.apiProviderConfig.findFirst({
      where: { isActive: true, isDefault: true },
      select: { id: true, name: true, provider: true, model: true, maxTokens: true, temperature: true },
    })
  }

  async create(
    adminUserId: string,
    data: {
      name: string
      provider: string
      apiKey: string
      baseUrl?: string
      model?: string
      maxTokens?: number
      isDefault?: boolean
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: adminUserId } })
    if (user?.role !== 'ADMIN') throw new ForbiddenException('Admin only')

    if (data.isDefault) {
      await this.prisma.apiProviderConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    return this.prisma.apiProviderConfig.create({
      data: {
        name: data.name,
        provider: data.provider as never,
        apiKey: data.apiKey, // encrypt in production
        baseUrl: data.baseUrl,
        model: data.model,
        maxTokens: data.maxTokens ?? 4096,
        isDefault: data.isDefault ?? false,
        createdBy: adminUserId,
      },
      select: { id: true, name: true, provider: true, model: true, isActive: true, isDefault: true },
    })
  }

  async logCall(data: {
    configId: string
    userId?: string
    agentId?: string
    requestType: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    costUSD: number
    latencyMs: number
    isSuccess: boolean
    errorMsg?: string
  }) {
    return this.prisma.apiCallLog.create({ data })
  }

  async getUsageStats(configId: string) {
    const stats = await this.prisma.apiCallLog.aggregate({
      where: { configId },
      _sum: { totalTokens: true, costUSD: true },
      _count: { id: true },
      _avg: { latencyMs: true },
    })
    return stats
  }
}
