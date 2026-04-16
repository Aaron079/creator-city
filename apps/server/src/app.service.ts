import { Injectable } from '@nestjs/common'
import { PrismaService } from './prisma/prisma.service'

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth() {
    return {
      status: 'ok',
      service: 'creator-city-server',
      version: process.env['npm_package_version'] ?? '0.1.0',
      environment: process.env['NODE_ENV'] ?? 'development',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    }
  }

  async getReadiness() {
    let dbStatus: 'ok' | 'error' = 'error'
    let dbMessage: string | undefined

    try {
      await this.prisma.$queryRaw`SELECT 1`
      dbStatus = 'ok'
    } catch (err) {
      dbMessage = err instanceof Error ? err.message : 'unknown error'
    }

    const ready = dbStatus === 'ok'

    return {
      status: ready ? 'ready' : 'not_ready',
      checks: {
        database: { status: dbStatus, ...(dbMessage && { message: dbMessage }) },
      },
      timestamp: new Date().toISOString(),
    }
  }
}
