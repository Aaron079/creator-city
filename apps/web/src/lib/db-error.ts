/**
 * Shared helper for detecting Prisma connection-pool / DB unavailable errors.
 * Distinguishes transient infrastructure errors from business logic errors,
 * so callers can return 503 instead of 500 or 401.
 */

// SESSION_DB_UNAVAILABLE is thrown by lib/auth/session.ts when all session lookup retries fail
const DB_ERROR_CODES = new Set(['P2024', 'P1001', 'P1002', 'P1008', 'P1017', 'SESSION_DB_UNAVAILABLE'])

const DB_ERROR_PATTERNS = [
  'timed out fetching a new connection',
  'connection pool',
  'too many clients',
  'pool_timeout',
  'pgbouncer',
  'connection refused',
  'connection reset',
  'server closed the connection',
  'cannot acquire connection',
]

export function isDbConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as Error & { code?: string }).code ?? ''
  if (DB_ERROR_CODES.has(code)) return true
  const msg = error.message.toLowerCase()
  return DB_ERROR_PATTERNS.some((pattern) => msg.includes(pattern))
}
