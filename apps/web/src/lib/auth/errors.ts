// Safe error utilities for auth routes — never leaks credentials to client

const REDACT_PATTERNS: [RegExp, string][] = [
  [/postgresql:\/\/[^\s'"]+/gi,        '[DB_URL_REDACTED]'],
  [/mysql:\/\/[^\s'"]+/gi,             '[DB_URL_REDACTED]'],
  [/password["']?\s*[:=]\s*["']?[^\s,;'"]{0,80}/gi, '[PASSWORD_REDACTED]'],
  [/secret["']?\s*[:=]\s*["']?[^\s,;'"]{0,80}/gi,   '[SECRET_REDACTED]'],
  [/token["']?\s*[:=]\s*["']?[^\s,;'"]{0,80}/gi,    '[TOKEN_REDACTED]'],
]

function sanitizeMessage(raw: string): string {
  let s = raw
  for (const [pattern, replacement] of REDACT_PATTERNS) {
    s = s.replace(pattern, replacement)
  }
  return s.slice(0, 300)
}

export interface SafeError {
  name: string
  /** Combined from err.code (P2xxx) or err.errorCode (P1xxx) */
  code: string
  message: string
  meta?: unknown
}

export function extractSafeError(err: unknown): SafeError {
  const e = err as Record<string, unknown>
  const name = (typeof e?.name === 'string' ? e.name : 'Error').slice(0, 100)

  // PrismaClientKnownRequestError   → .code     (P2xxx)
  // PrismaClientInitializationError → .errorCode (P1xxx)
  const code =
    (typeof e?.code === 'string' && e.code) ||
    (typeof e?.errorCode === 'string' && e.errorCode) ||
    'UNKNOWN'

  const rawMsg = typeof e?.message === 'string' ? e.message : String(err ?? '')
  const message = sanitizeMessage(rawMsg)
  const meta = e?.meta ?? undefined

  return { name, code, message, meta }
}

interface MappedError {
  httpStatus: number
  errorCode: string
  userMessage: string
}

const PRISMA_MAP: Record<string, MappedError> = {
  P1000: { httpStatus: 500, errorCode: 'DB_AUTH_FAILED',        userMessage: '数据库认证失败，请联系管理员。' },
  P1001: { httpStatus: 500, errorCode: 'DB_UNREACHABLE',        userMessage: '无法连接数据库，请稍后重试。' },
  P1002: { httpStatus: 500, errorCode: 'DB_TIMEOUT',            userMessage: '数据库连接超时，请稍后重试。' },
  P1012: { httpStatus: 500, errorCode: 'DB_CONFIG_MISSING',     userMessage: '数据库配置缺失，请联系管理员。' },
  P2002: { httpStatus: 409, errorCode: 'EMAIL_EXISTS',          userMessage: '该邮箱已注册。' },
  P2003: { httpStatus: 500, errorCode: 'DB_RELATION_FAILED',    userMessage: '数据关联失败，请联系管理员。' },
  P2011: { httpStatus: 500, errorCode: 'DB_NULL_CONSTRAINT',    userMessage: '必填字段为空，请联系管理员。' },
  P2014: { httpStatus: 500, errorCode: 'DB_RELATION_VIOLATION', userMessage: '数据关联冲突，请联系管理员。' },
  P2021: { httpStatus: 500, errorCode: 'DB_SCHEMA_MISSING',     userMessage: '数据库表结构未初始化，请联系管理员。' },
  P2022: { httpStatus: 500, errorCode: 'DB_COLUMN_MISSING',     userMessage: '数据库字段缺失，请联系管理员。' },
}

export function mapPrismaError(safe: SafeError): MappedError | null {
  return PRISMA_MAP[safe.code] ?? null
}

export function logAndRespond(
  route: string,
  safe: SafeError,
  mapped: MappedError | null,
): { body: Record<string, unknown>; status: number } {
  // Server-side log — full detail, never returned to client
  console.error(
    `[${route}] name=${safe.name} code=${safe.code}`,
    safe.meta ? `meta=${JSON.stringify(safe.meta)}` : '',
    `msg=${safe.message}`,
  )

  if (mapped) {
    return {
      body: { message: mapped.userMessage, errorCode: mapped.errorCode },
      status: mapped.httpStatus,
    }
  }

  // Unknown error — return name/message truncated, safe to expose
  return {
    body: {
      message: '注册失败，请稍后重试。',
      errorCode: 'UNKNOWN',
      errorName: safe.name,
      errorMessage: safe.message,
    },
    status: 500,
  }
}
