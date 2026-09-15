import { PrismaClient } from '@prisma/client'

function buildDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    const params = url.searchParams
    const isNeon = url.hostname.endsWith('.neon.tech')
    // Neon supports prepared statements; legacy PgBouncer mode disables their
    // cache and adds round trips while holding scarce pool connections.
    if (!isNeon && !params.has('pgbouncer')) params.set('pgbouncer', 'true')
    if (!params.has('sslmode')) params.set('sslmode', 'require')
    if (!params.has('connection_limit')) params.set('connection_limit', isNeon ? '5' : '2')
    if (!params.has('pool_timeout')) params.set('pool_timeout', isNeon ? '20' : '6')
    if (!params.has('connect_timeout')) params.set('connect_timeout', '10')
    if (isNeon) {
      // Release unresponsive/idle sockets instead of letting them monopolize
      // the pool across serverless suspension and database cold starts.
      if (!params.has('socket_timeout')) params.set('socket_timeout', '15')
      if (!params.has('max_idle_connection_lifetime')) params.set('max_idle_connection_lifetime', '60')
    }
    return url.toString()
  } catch {
    // Malformed URL — return as-is, let Prisma surface the real error
    return raw
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const patchedUrl = buildDatabaseUrl()

export const db = globalForPrisma.prisma ?? (
  patchedUrl
    ? new PrismaClient({ log: ['error'], datasourceUrl: patchedUrl })
    : new PrismaClient({ log: ['error'] })
)

globalForPrisma.prisma = db
