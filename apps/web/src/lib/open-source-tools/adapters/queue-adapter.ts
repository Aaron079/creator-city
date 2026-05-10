import type { OpenSourceToolHealth } from '../types'

export async function getQueueHealth(): Promise<OpenSourceToolHealth> {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST
  if (!redisUrl) {
    return { toolId: 'bullmq', status: 'misconfigured', message: 'REDIS_URL or REDIS_HOST not set', checkedAt: new Date().toISOString() }
  }
  // BullMQ health is verified by checking Redis connectivity at runtime.
  // Without importing ioredis here (not installed), we report configured status.
  return { toolId: 'bullmq', status: 'enabled', message: 'Redis env configured', checkedAt: new Date().toISOString() }
}
