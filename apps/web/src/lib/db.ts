import { PrismaClient } from '@prisma/client'

/**
 * When using Supabase's connection pooler (PgBouncer), Prisma must not use
 * named prepared statements. `pgbouncer=true` switches Prisma to unnamed
 * prepared statements, fixing the "prepared statement s1 already exists" error.
 * sslmode=require is mandatory for Supabase pooler connections.
 * connection_limit=1 ensures each serverless invocation uses its own slot.
 */
function buildDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    const params = url.searchParams
    if (!params.has('pgbouncer')) params.set('pgbouncer', 'true')
    if (!params.has('sslmode')) params.set('sslmode', 'require')
    // 2 connections per serverless instance: allows instrumentation and the first
    // incoming request to run concurrently during cold start instead of serializing.
    // Still conservative — avoids exhausting Supabase's pgBouncer slot budget.
    if (!params.has('connection_limit')) params.set('connection_limit', '2')
    // Give the pooler more time to hand out a connection under DB load.
    if (!params.has('pool_timeout')) params.set('pool_timeout', '25')
    if (!params.has('connect_timeout')) params.set('connect_timeout', '10')
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

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
